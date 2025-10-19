# backend/app/services/pricing_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import logging

from app.models.wubook_rate_plan import WuBookRatePlan
from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.room_type import RoomType
from app.schemas.rate_plan import RateCalculationRequest, RateCalculationResponse

logger = logging.getLogger(__name__)


class PricingService:
    """Serviço para cálculos de preços e yield management"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============== CÁLCULO DE TARIFAS ==============
    
    def calculate_rate(
        self, 
        request: RateCalculationRequest, 
        tenant_id: int
    ) -> RateCalculationResponse:
        """Calcula tarifa para uma estadia"""
        try:
            # Buscar rate plan
            rate_plan = self.db.query(WuBookRatePlan).filter(
                WuBookRatePlan.id == request.rate_plan_id,
                WuBookRatePlan.tenant_id == tenant_id,
                WuBookRatePlan.is_active == True
            ).first()
            
            if not rate_plan:
                raise ValueError("Plano de tarifa não encontrado")
            
            # Calcular número de noites
            total_nights = (request.checkout_date - request.checkin_date).days
            if total_nights <= 0:
                raise ValueError("Data de saída deve ser posterior à data de entrada")
            
            # Validar regras básicas
            validation_errors = self._validate_booking_rules(
                rate_plan, request.checkin_date, request.checkout_date, total_nights
            )
            
            # Obter preço base por ocupação
            base_rate_per_night = self._get_base_rate_for_occupancy(rate_plan, request.occupancy)
            
            if not base_rate_per_night:
                validation_errors.append("Preço não definido para esta ocupação")
            
            # Calcular preços por noite (considerando override de availability)
            nightly_rates = self._calculate_nightly_rates(
                rate_plan, request.checkin_date, request.checkout_date, 
                base_rate_per_night, request.room_id, tenant_id
            )
            
            # Calcular total base
            total_base_amount = sum(nightly_rates)
            
            # Calcular taxas de pessoa extra
            extra_person_charges = self._calculate_extra_person_charges(
                rate_plan, request.occupancy, total_nights
            )
            
            # Aplicar ajustes sazonais e promoções
            seasonal_adjustment = None
            promotional_discount = None
            
            if request.apply_promotions:
                seasonal_adjustment = self._calculate_seasonal_adjustment(
                    rate_plan, request.checkin_date, request.checkout_date
                )
                promotional_discount = self._calculate_promotional_discount(
                    rate_plan, total_base_amount, request.checkin_date
                )
            
            # Calcular subtotal
            subtotal = total_base_amount
            if extra_person_charges:
                subtotal += extra_person_charges
            if seasonal_adjustment:
                subtotal += seasonal_adjustment
            if promotional_discount:
                subtotal -= promotional_discount
            
            # Aplicar impostos
            taxes = None
            if request.include_taxes:
                taxes = self._calculate_taxes(subtotal, rate_plan)
            
            # Total final
            total_amount = subtotal
            if taxes:
                total_amount += taxes
            
            # Arredondar valores
            subtotal = subtotal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total_amount = total_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            return RateCalculationResponse(
                rate_plan_id=rate_plan.id,
                rate_plan_name=rate_plan.name,
                checkin_date=request.checkin_date,
                checkout_date=request.checkout_date,
                total_nights=total_nights,
                occupancy=request.occupancy,
                base_rate_per_night=base_rate_per_night or Decimal('0'),
                total_base_amount=total_base_amount,
                extra_person_charges=extra_person_charges,
                seasonal_adjustment=seasonal_adjustment,
                promotional_discount=promotional_discount,
                subtotal=subtotal,
                taxes=taxes,
                total_amount=total_amount,
                is_valid=len(validation_errors) == 0,
                validation_errors=validation_errors if validation_errors else None
            )
            
        except Exception as e:
            logger.error(f"Erro no cálculo de tarifa: {str(e)}")
            return RateCalculationResponse(
                rate_plan_id=request.rate_plan_id,
                rate_plan_name="Erro",
                checkin_date=request.checkin_date,
                checkout_date=request.checkout_date,
                total_nights=0,
                occupancy=request.occupancy,
                base_rate_per_night=Decimal('0'),
                total_base_amount=Decimal('0'),
                subtotal=Decimal('0'),
                total_amount=Decimal('0'),
                is_valid=False,
                validation_errors=[str(e)]
            )
    
    def get_best_available_rate(
        self, 
        room_type_id: int,
        checkin_date: date,
        checkout_date: date,
        occupancy: int,
        tenant_id: int,
        property_id: Optional[int] = None
    ) -> Optional[RateCalculationResponse]:
        """Encontra a melhor tarifa disponível para critérios específicos"""
        
        # Buscar rate plans aplicáveis
        query = self.db.query(WuBookRatePlan).filter(
            WuBookRatePlan.tenant_id == tenant_id,
            WuBookRatePlan.is_active == True,
            or_(
                WuBookRatePlan.room_type_id == room_type_id,
                WuBookRatePlan.room_type_id.is_(None)
            )
        )
        
        if property_id:
            query = query.filter(
                or_(
                    WuBookRatePlan.property_id == property_id,
                    WuBookRatePlan.property_id.is_(None)
                )
            )
        
        # Filtrar por validade
        checkin_str = checkin_date.isoformat()
        query = query.filter(
            and_(
                or_(WuBookRatePlan.valid_from.is_(None), WuBookRatePlan.valid_from <= checkin_str),
                or_(WuBookRatePlan.valid_to.is_(None), WuBookRatePlan.valid_to >= checkin_str)
            )
        )
        
        rate_plans = query.order_by(WuBookRatePlan.is_default.desc()).all()
        
        best_rate = None
        lowest_price = None
        
        for rate_plan in rate_plans:
            request = RateCalculationRequest(
                rate_plan_id=rate_plan.id,
                checkin_date=checkin_date,
                checkout_date=checkout_date,
                occupancy=occupancy
            )
            
            calculation = self.calculate_rate(request, tenant_id)
            
            if calculation.is_valid:
                if lowest_price is None or calculation.total_amount < lowest_price:
                    lowest_price = calculation.total_amount
                    best_rate = calculation
        
        return best_rate
    
    # ============== MÉTODOS AUXILIARES ==============
    
    def _get_base_rate_for_occupancy(self, rate_plan: WuBookRatePlan, occupancy: int) -> Optional[Decimal]:
        """Obtém preço base para uma ocupação específica"""
        if occupancy == 1:
            return rate_plan.base_rate_single
        elif occupancy == 2:
            return rate_plan.base_rate_double or rate_plan.base_rate_single
        elif occupancy == 3:
            return rate_plan.base_rate_triple or rate_plan.base_rate_double or rate_plan.base_rate_single
        elif occupancy == 4:
            return rate_plan.base_rate_quad or rate_plan.base_rate_triple or rate_plan.base_rate_double
        else:
            # Para ocupação > 4, usar quádruplo como base
            return rate_plan.base_rate_quad or rate_plan.base_rate_double
    
    def _calculate_nightly_rates(
        self, 
        rate_plan: WuBookRatePlan, 
        checkin_date: date, 
        checkout_date: date,
        base_rate: Decimal,
        room_id: Optional[int],
        tenant_id: int
    ) -> List[Decimal]:
        """Calcula preços por noite considerando overrides de availability"""
        nightly_rates = []
        current_date = checkin_date
        
        while current_date < checkout_date:
            rate_for_night = base_rate
            
            # Verificar se há override de preço na availability
            if room_id:
                availability = self.db.query(RoomAvailability).filter(
                    RoomAvailability.room_id == room_id,
                    RoomAvailability.date == current_date,
                    RoomAvailability.tenant_id == tenant_id
                ).first()
                
                if availability and availability.rate_override:
                    rate_for_night = availability.rate_override
            
            nightly_rates.append(rate_for_night)
            current_date += timedelta(days=1)
        
        return nightly_rates
    
    def _calculate_extra_person_charges(
        self, 
        rate_plan: WuBookRatePlan, 
        occupancy: int, 
        total_nights: int
    ) -> Optional[Decimal]:
        """Calcula taxas de pessoa extra"""
        extra_charges = Decimal('0')
        
        # Determinar ocupação base incluída no preço
        base_occupancy = 2  # Assumir que preço double inclui 2 pessoas
        
        if occupancy > base_occupancy:
            extra_adults = occupancy - base_occupancy
            
            if rate_plan.extra_adult_rate and extra_adults > 0:
                extra_charges += rate_plan.extra_adult_rate * extra_adults * total_nights
        
        return extra_charges if extra_charges > 0 else None
    
    def _calculate_seasonal_adjustment(
        self, 
        rate_plan: WuBookRatePlan, 
        checkin_date: date, 
        checkout_date: date
    ) -> Optional[Decimal]:
        """Calcula ajuste sazonal"""
        # Implementação básica - pode ser expandida
        # Por enquanto, retorna None (sem ajuste)
        return None
    
    def _calculate_promotional_discount(
        self, 
        rate_plan: WuBookRatePlan, 
        base_amount: Decimal, 
        checkin_date: date
    ) -> Optional[Decimal]:
        """Calcula desconto promocional"""
        # Implementação básica - pode ser expandida
        # Por enquanto, retorna None (sem desconto)
        return None
    
    def _calculate_taxes(self, subtotal: Decimal, rate_plan: WuBookRatePlan) -> Optional[Decimal]:
        """Calcula impostos"""
        # Implementação básica - 10% de impostos
        tax_rate = Decimal('0.10')  # 10%
        return subtotal * tax_rate
    
    def _validate_booking_rules(
        self, 
        rate_plan: WuBookRatePlan, 
        checkin_date: date, 
        checkout_date: date, 
        total_nights: int
    ) -> List[str]:
        """Valida regras de reserva"""
        errors = []
        
        # Validar estadia mínima
        if total_nights < rate_plan.min_stay:
            errors.append(f"Estadia mínima: {rate_plan.min_stay} noites")
        
        # Validar estadia máxima
        if rate_plan.max_stay and total_nights > rate_plan.max_stay:
            errors.append(f"Estadia máxima: {rate_plan.max_stay} noites")
        
        # Validar antecedência
        days_ahead = (checkin_date - date.today()).days
        
        if days_ahead < rate_plan.min_advance_days:
            errors.append(f"Antecedência mínima: {rate_plan.min_advance_days} dias")
        
        if rate_plan.max_advance_days and days_ahead > rate_plan.max_advance_days:
            errors.append(f"Antecedência máxima: {rate_plan.max_advance_days} dias")
        
        # Validar período de validade
        checkin_str = checkin_date.isoformat()
        
        if rate_plan.valid_from and checkin_str < rate_plan.valid_from:
            errors.append(f"Válido a partir de: {rate_plan.valid_from}")
        
        if rate_plan.valid_to and checkin_str > rate_plan.valid_to:
            errors.append(f"Válido até: {rate_plan.valid_to}")
        
        return errors
    
    # ============== YIELD MANAGEMENT ==============
    
    def calculate_occupancy_based_pricing(
        self, 
        rate_plan_id: int,
        target_date: date,
        tenant_id: int,
        occupancy_threshold: float = 0.8,
        price_increase_percentage: float = 0.1
    ) -> Dict[str, Any]:
        """Calcula preços baseados na ocupação (yield management básico)"""
        try:
            # Buscar rate plan
            rate_plan = self.db.query(WuBookRatePlan).filter(
                WuBookRatePlan.id == rate_plan_id,
                WuBookRatePlan.tenant_id == tenant_id
            ).first()
            
            if not rate_plan:
                return {"error": "Rate plan não encontrado"}
            
            # Calcular ocupação atual para a data
            if rate_plan.room_type_id:
                # Buscar quartos do tipo específico
                rooms_query = self.db.query(Room).filter(
                    Room.room_type_id == rate_plan.room_type_id,
                    Room.tenant_id == tenant_id,
                    Room.is_active == True
                )
                
                total_rooms = rooms_query.count()
                
                if total_rooms > 0:
                    # Contar quartos ocupados/reservados
                    occupied_rooms = self.db.query(RoomAvailability).filter(
                        RoomAvailability.date == target_date,
                        RoomAvailability.tenant_id == tenant_id,
                        RoomAvailability.room_id.in_([r.id for r in rooms_query.all()]),
                        or_(
                            RoomAvailability.is_reserved == True,
                            RoomAvailability.is_available == False
                        )
                    ).count()
                    
                    current_occupancy = occupied_rooms / total_rooms
                    
                    # Determinar se deve aplicar yield
                    should_increase = current_occupancy >= occupancy_threshold
                    
                    # Calcular novos preços se necessário
                    adjusted_rates = {}
                    if should_increase:
                        multiplier = Decimal(str(1 + price_increase_percentage))
                        
                        if rate_plan.base_rate_single:
                            adjusted_rates['base_rate_single'] = rate_plan.base_rate_single * multiplier
                        if rate_plan.base_rate_double:
                            adjusted_rates['base_rate_double'] = rate_plan.base_rate_double * multiplier
                        if rate_plan.base_rate_triple:
                            adjusted_rates['base_rate_triple'] = rate_plan.base_rate_triple * multiplier
                        if rate_plan.base_rate_quad:
                            adjusted_rates['base_rate_quad'] = rate_plan.base_rate_quad * multiplier
                    
                    return {
                        "rate_plan_id": rate_plan_id,
                        "target_date": target_date.isoformat(),
                        "total_rooms": total_rooms,
                        "occupied_rooms": occupied_rooms,
                        "current_occupancy": round(current_occupancy * 100, 2),
                        "occupancy_threshold": round(occupancy_threshold * 100, 2),
                        "should_increase_prices": should_increase,
                        "price_increase_percentage": round(price_increase_percentage * 100, 2),
                        "adjusted_rates": adjusted_rates
                    }
            
            return {"error": "Não foi possível calcular ocupação"}
            
        except Exception as e:
            logger.error(f"Erro no yield management: {str(e)}")
            return {"error": str(e)}
    
    def get_pricing_recommendations(
        self, 
        tenant_id: int,
        date_from: date,
        date_to: date,
        property_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Gera recomendações de preços baseadas em análise de demanda"""
        recommendations = []
        
        # Buscar rate plans ativos
        query = self.db.query(WuBookRatePlan).filter(
            WuBookRatePlan.tenant_id == tenant_id,
            WuBookRatePlan.is_active == True
        )
        
        if property_id:
            query = query.filter(
                or_(
                    WuBookRatePlan.property_id == property_id,
                    WuBookRatePlan.property_id.is_(None)
                )
            )
        
        rate_plans = query.all()
        
        current_date = date_from
        while current_date <= date_to:
            for rate_plan in rate_plans:
                yield_analysis = self.calculate_occupancy_based_pricing(
                    rate_plan.id, current_date, tenant_id
                )
                
                if not yield_analysis.get('error') and yield_analysis.get('should_increase_prices'):
                    recommendations.append({
                        "date": current_date.isoformat(),
                        "rate_plan_id": rate_plan.id,
                        "rate_plan_name": rate_plan.name,
                        "current_occupancy": yield_analysis.get('current_occupancy'),
                        "recommendation": "increase_prices",
                        "suggested_increase": yield_analysis.get('price_increase_percentage'),
                        "reason": f"Ocupação alta ({yield_analysis.get('current_occupancy')}%)"
                    })
            
            current_date += timedelta(days=1)
        
        return recommendations