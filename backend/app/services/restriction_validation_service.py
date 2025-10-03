# backend/app/services/restriction_validation_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
import logging

from app.models.reservation_restriction import ReservationRestriction, RestrictionType
from app.models.property import Property
from app.models.room_type import RoomType
from app.models.room import Room
from app.schemas.reservation_restriction import (
    RestrictionValidationRequest, RestrictionValidationResponse, RestrictionViolation,
    CalendarRestrictionRequest, CalendarRestrictionResponse, CalendarDayRestriction
)

logger = logging.getLogger(__name__)


class RestrictionValidationService:
    """Serviço especializado para validação de restrições de reserva"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ============== VALIDAÇÃO PRINCIPAL ==============
    
    def validate_reservation_restrictions(
        self,
        validation_request: RestrictionValidationRequest,
        tenant_id: int
    ) -> RestrictionValidationResponse:
        """
        Valida se uma reserva pode ser feita baseada nas restrições existentes.
        Aplica hierarquia de precedência: Room > RoomType > Property
        """
        violations = []
        warnings = []
        
        # Calcular dados básicos
        nights = (validation_request.check_out_date - validation_request.check_in_date).days
        advance_days = validation_request.advance_days or 0
        
        # Buscar restrições aplicáveis
        applicable_restrictions = self._get_applicable_restrictions(
            property_id=validation_request.property_id,
            room_id=validation_request.room_id,
            room_type_id=validation_request.room_type_id,
            check_in_date=validation_request.check_in_date,
            check_out_date=validation_request.check_out_date,
            tenant_id=tenant_id
        )
        
        # Processar restrições por precedência
        effective_restrictions = self._apply_precedence_rules(applicable_restrictions)
        
        # Validar cada tipo de restrição
        for restriction in effective_restrictions:
            violation = self._validate_single_restriction(
                restriction, validation_request, nights, advance_days
            )
            if violation:
                violations.append(violation)
        
        # Verificar warnings adicionais
        warnings = self._generate_warnings(effective_restrictions, validation_request)
        
        return RestrictionValidationResponse(
            is_valid=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            property_id=validation_request.property_id,
            room_id=validation_request.room_id,
            room_type_id=validation_request.room_type_id,
            check_in_date=validation_request.check_in_date,
            check_out_date=validation_request.check_out_date,
            nights=nights,
            applicable_restrictions=effective_restrictions
        )
    
    def _get_applicable_restrictions(
        self,
        property_id: int,
        room_id: Optional[int],
        room_type_id: Optional[int],
        check_in_date: date,
        check_out_date: date,
        tenant_id: int
    ) -> List[ReservationRestriction]:
        """Busca todas as restrições que se aplicam ao período e escopo especificados"""
        
        # Buscar room_type_id se não fornecido mas room_id foi fornecido
        if room_id and not room_type_id:
            room = self.db.query(Room).filter(
                Room.id == room_id,
                Room.tenant_id == tenant_id
            ).first()
            if room:
                room_type_id = room.room_type_id
        
        query = self.db.query(ReservationRestriction).options(
            joinedload(ReservationRestriction.property_obj),
            joinedload(ReservationRestriction.room_type),
            joinedload(ReservationRestriction.room)
        ).filter(
            ReservationRestriction.tenant_id == tenant_id,
            ReservationRestriction.property_id == property_id,
            ReservationRestriction.is_active == True,
            # Overlap de datas - restrição se aplica se há sobreposição
            and_(
                ReservationRestriction.date_from <= check_out_date,
                ReservationRestriction.date_to >= check_in_date
            )
        )
        
        # Filtrar por escopo (Property, RoomType ou Room específico)
        scope_filters = []
        
        # Restrições de propriedade (aplicam a todos)
        scope_filters.append(
            and_(
                ReservationRestriction.room_type_id.is_(None),
                ReservationRestriction.room_id.is_(None)
            )
        )
        
        # Restrições de tipo de quarto (se aplicável)
        if room_type_id:
            scope_filters.append(
                and_(
                    ReservationRestriction.room_type_id == room_type_id,
                    ReservationRestriction.room_id.is_(None)
                )
            )
        
        # Restrições de quarto específico (se aplicável)
        if room_id:
            scope_filters.append(ReservationRestriction.room_id == room_id)
        
        query = query.filter(or_(*scope_filters))
        
        # Ordenar por precedência (Room > RoomType > Property) e prioridade
        restrictions = query.order_by(
            # Room-level primeiro (room_id não nulo)
            ReservationRestriction.room_id.desc().nullslast(),
            # RoomType-level segundo (room_type_id não nulo, room_id nulo)
            ReservationRestriction.room_type_id.desc().nullslast(),
            # Property-level último (ambos nulos)
            # Dentro do mesmo nível, ordenar por prioridade
            ReservationRestriction.priority.desc()
        ).all()
        
        # Filtrar por dias da semana se especificado
        applicable_restrictions = []
        for restriction in restrictions:
            if self._applies_to_date_range(restriction, check_in_date, check_out_date):
                applicable_restrictions.append(restriction)
        
        return applicable_restrictions
    
    def _applies_to_date_range(
        self,
        restriction: ReservationRestriction,
        check_in_date: date,
        check_out_date: date
    ) -> bool:
        """Verifica se a restrição se aplica ao período, considerando dias da semana"""
        
        # Se não há filtro de dias da semana, aplica a todos os dias
        if not restriction.days_of_week:
            return True
        
        # Verificar se algum dia do período está nos dias aplicáveis
        current_date = check_in_date
        while current_date < check_out_date:
            weekday = current_date.weekday()  # 0=segunda, 6=domingo
            if weekday in restriction.days_of_week:
                # Verificar se a data está dentro do período da restrição
                if restriction.date_from <= current_date <= restriction.date_to:
                    return True
            current_date += timedelta(days=1)
        
        return False
    
    def _apply_precedence_rules(
        self,
        restrictions: List[ReservationRestriction]
    ) -> List[ReservationRestriction]:
        """
        Aplica regras de precedência: Room > RoomType > Property
        Para cada tipo de restrição, mantém apenas a mais específica
        """
        # Agrupar por tipo de restrição
        by_type = {}
        for restriction in restrictions:
            restriction_type = restriction.restriction_type
            if restriction_type not in by_type:
                by_type[restriction_type] = []
            by_type[restriction_type].append(restriction)
        
        # Para cada tipo, aplicar precedência
        effective_restrictions = []
        for restriction_type, type_restrictions in by_type.items():
            # Ordenar por especificidade: Room > RoomType > Property
            type_restrictions.sort(key=lambda r: (
                0 if r.room_id else 1 if r.room_type_id else 2,  # Especificidade
                -r.priority  # Prioridade (decrescente)
            ))
            
            # Manter apenas a mais específica
            if type_restrictions:
                effective_restrictions.append(type_restrictions[0])
        
        return effective_restrictions
    
    def _validate_single_restriction(
        self,
        restriction: ReservationRestriction,
        validation_request: RestrictionValidationRequest,
        nights: int,
        advance_days: int
    ) -> Optional[RestrictionViolation]:
        """Valida uma restrição específica"""
        
        restriction_type = restriction.restriction_type
        
        # MIN_STAY
        if restriction_type == RestrictionType.MIN_STAY:
            if nights < restriction.restriction_value:
                return RestrictionViolation(
                    restriction_id=restriction.id,
                    restriction_type=restriction_type,
                    restriction_description=restriction.restriction_description,
                    violation_message=f"Estadia mínima de {restriction.restriction_value} noites não atendida (solicitado: {nights} noites)",
                    scope_level=restriction.scope_level,
                    scope_description=restriction.scope_description,
                    can_override=False
                )
        
        # MAX_STAY
        elif restriction_type == RestrictionType.MAX_STAY:
            if nights > restriction.restriction_value:
                return RestrictionViolation(
                    restriction_id=restriction.id,
                    restriction_type=restriction_type,
                    restriction_description=restriction.restriction_description,
                    violation_message=f"Estadia máxima de {restriction.restriction_value} noites excedida (solicitado: {nights} noites)",
                    scope_level=restriction.scope_level,
                    scope_description=restriction.scope_description,
                    can_override=True  # Max stay pode ser flexível
                )
        
        # CLOSED_TO_ARRIVAL
        elif restriction_type == RestrictionType.CLOSED_TO_ARRIVAL:
            if restriction.is_restricted:
                # Verificar se o check-in cai em uma data com CTA
                if self._date_has_restriction(restriction, validation_request.check_in_date):
                    return RestrictionViolation(
                        restriction_id=restriction.id,
                        restriction_type=restriction_type,
                        restriction_description=restriction.restriction_description,
                        violation_message=f"Chegada bloqueada para {validation_request.check_in_date}",
                        scope_level=restriction.scope_level,
                        scope_description=restriction.scope_description,
                        date_affected=validation_request.check_in_date,
                        can_override=False
                    )
        
        # CLOSED_TO_DEPARTURE
        elif restriction_type == RestrictionType.CLOSED_TO_DEPARTURE:
            if restriction.is_restricted:
                # Verificar se o check-out cai em uma data com CTD
                if self._date_has_restriction(restriction, validation_request.check_out_date):
                    return RestrictionViolation(
                        restriction_id=restriction.id,
                        restriction_type=restriction_type,
                        restriction_description=restriction.restriction_description,
                        violation_message=f"Saída bloqueada para {validation_request.check_out_date}",
                        scope_level=restriction.scope_level,
                        scope_description=restriction.scope_description,
                        date_affected=validation_request.check_out_date,
                        can_override=False
                    )
        
        # STOP_SELL
        elif restriction_type == RestrictionType.STOP_SELL:
            if restriction.is_restricted:
                # Verificar se alguma data da estadia tem stop sell
                current_date = validation_request.check_in_date
                while current_date < validation_request.check_out_date:
                    if self._date_has_restriction(restriction, current_date):
                        return RestrictionViolation(
                            restriction_id=restriction.id,
                            restriction_type=restriction_type,
                            restriction_description=restriction.restriction_description,
                            violation_message=f"Vendas bloqueadas para {current_date}",
                            scope_level=restriction.scope_level,
                            scope_description=restriction.scope_description,
                            date_affected=current_date,
                            can_override=False
                        )
                    current_date += timedelta(days=1)
        
        # MIN_ADVANCE_BOOKING
        elif restriction_type == RestrictionType.MIN_ADVANCE_BOOKING:
            if advance_days < restriction.restriction_value:
                return RestrictionViolation(
                    restriction_id=restriction.id,
                    restriction_type=restriction_type,
                    restriction_description=restriction.restriction_description,
                    violation_message=f"Antecedência mínima de {restriction.restriction_value} dias não atendida (atual: {advance_days} dias)",
                    scope_level=restriction.scope_level,
                    scope_description=restriction.scope_description,
                    can_override=True
                )
        
        # MAX_ADVANCE_BOOKING
        elif restriction_type == RestrictionType.MAX_ADVANCE_BOOKING:
            if advance_days > restriction.restriction_value:
                return RestrictionViolation(
                    restriction_id=restriction.id,
                    restriction_type=restriction_type,
                    restriction_description=restriction.restriction_description,
                    violation_message=f"Antecedência máxima de {restriction.restriction_value} dias excedida (atual: {advance_days} dias)",
                    scope_level=restriction.scope_level,
                    scope_description=restriction.scope_description,
                    can_override=True
                )
        
        return None
    
    def _date_has_restriction(self, restriction: ReservationRestriction, check_date: date) -> bool:
        """Verifica se uma data específica tem a restrição aplicada"""
        # Verificar se está no período
        if not (restriction.date_from <= check_date <= restriction.date_to):
            return False
        
        # Verificar dia da semana se especificado
        if restriction.days_of_week:
            weekday = check_date.weekday()
            if weekday not in restriction.days_of_week:
                return False
        
        return True
    
    def _generate_warnings(
        self,
        restrictions: List[ReservationRestriction],
        validation_request: RestrictionValidationRequest
    ) -> List[str]:
        """Gera avisos não bloqueantes"""
        warnings = []
        
        # Aviso sobre restrições próximas
        for restriction in restrictions:
            if restriction.restriction_type == RestrictionType.MIN_STAY:
                nights = (validation_request.check_out_date - validation_request.check_in_date).days
                if nights == restriction.restriction_value:
                    warnings.append(f"Estadia no limite mínimo de {restriction.restriction_value} noites")
        
        return warnings
    
    # ============== CALENDAR GRID ==============
    
    def get_restriction_calendar(
        self,
        calendar_request: CalendarRestrictionRequest,
        tenant_id: int
    ) -> CalendarRestrictionResponse:
        """Gera calendário de restrições para visualização"""
        
        # Buscar todas as restrições no período
        restrictions = self._get_calendar_restrictions(calendar_request, tenant_id)
        
        # Gerar dias do calendário
        days = []
        current_date = calendar_request.date_from
        restriction_summary = {}
        days_with_restrictions = 0
        
        while current_date <= calendar_request.date_to:
            day_restrictions = []
            
            # Filtrar restrições que se aplicam a este dia
            for restriction in restrictions:
                if self._date_has_restriction(restriction, current_date):
                    day_restrictions.append(restriction)
            
            # Criar objeto do dia
            day = self._create_calendar_day(current_date, day_restrictions)
            days.append(day)
            
            # Atualizar estatísticas
            if day_restrictions:
                days_with_restrictions += 1
            
            for restriction in day_restrictions:
                restriction_type = restriction.restriction_type
                restriction_summary[restriction_type] = restriction_summary.get(restriction_type, 0) + 1
            
            current_date += timedelta(days=1)
        
        return CalendarRestrictionResponse(
            property_id=calendar_request.property_id,
            room_type_id=calendar_request.room_type_id,
            room_id=calendar_request.room_id,
            date_from=calendar_request.date_from,
            date_to=calendar_request.date_to,
            days=days,
            total_days=len(days),
            days_with_restrictions=days_with_restrictions,
            total_restrictions=len(restrictions),
            restriction_summary=restriction_summary
        )
    
    def _get_calendar_restrictions(
        self,
        calendar_request: CalendarRestrictionRequest,
        tenant_id: int
    ) -> List[ReservationRestriction]:
        """Busca restrições para o calendário"""
        
        query = self.db.query(ReservationRestriction).options(
            joinedload(ReservationRestriction.property_obj),
            joinedload(ReservationRestriction.room_type),
            joinedload(ReservationRestriction.room)
        ).filter(
            ReservationRestriction.tenant_id == tenant_id,
            ReservationRestriction.property_id == calendar_request.property_id,
            # Overlap com período solicitado
            and_(
                ReservationRestriction.date_from <= calendar_request.date_to,
                ReservationRestriction.date_to >= calendar_request.date_from
            )
        )
        
        # Filtrar por escopo
        scope_filters = []
        
        # Sempre incluir restrições de propriedade
        scope_filters.append(
            and_(
                ReservationRestriction.room_type_id.is_(None),
                ReservationRestriction.room_id.is_(None)
            )
        )
        
        if calendar_request.room_type_id:
            scope_filters.append(
                and_(
                    ReservationRestriction.room_type_id == calendar_request.room_type_id,
                    ReservationRestriction.room_id.is_(None)
                )
            )
        
        if calendar_request.room_id:
            scope_filters.append(ReservationRestriction.room_id == calendar_request.room_id)
        
        query = query.filter(or_(*scope_filters))
        
        # Filtrar por tipos de restrição se especificado
        if calendar_request.restriction_types:
            query = query.filter(ReservationRestriction.restriction_type.in_(calendar_request.restriction_types))
        
        # Filtrar por status ativo se necessário
        if not calendar_request.include_inactive:
            query = query.filter(ReservationRestriction.is_active == True)
        
        return query.all()
    
    def _create_calendar_day(
        self,
        date: date,
        restrictions: List[ReservationRestriction]
    ) -> CalendarDayRestriction:
        """Cria objeto de dia do calendário com restrições consolidadas"""
        
        # Aplicar precedência
        effective_restrictions = self._apply_precedence_rules(restrictions)
        
        # Analisar restrições efetivas
        has_min_stay = False
        has_max_stay = False
        is_closed_to_arrival = False
        is_closed_to_departure = False
        is_stop_sell = False
        min_stay_value = None
        max_stay_value = None
        
        for restriction in effective_restrictions:
            if restriction.restriction_type == RestrictionType.MIN_STAY:
                has_min_stay = True
                min_stay_value = restriction.restriction_value
            elif restriction.restriction_type == RestrictionType.MAX_STAY:
                has_max_stay = True
                max_stay_value = restriction.restriction_value
            elif restriction.restriction_type == RestrictionType.CLOSED_TO_ARRIVAL and restriction.is_restricted:
                is_closed_to_arrival = True
            elif restriction.restriction_type == RestrictionType.CLOSED_TO_DEPARTURE and restriction.is_restricted:
                is_closed_to_departure = True
            elif restriction.restriction_type == RestrictionType.STOP_SELL and restriction.is_restricted:
                is_stop_sell = True
        
        # Determinar nível de restrição para cores
        if is_stop_sell:
            restriction_level = "blocked"
        elif is_closed_to_arrival and is_closed_to_departure:
            restriction_level = "high"
        elif is_closed_to_arrival or is_closed_to_departure:
            restriction_level = "medium"
        elif has_min_stay or has_max_stay:
            restriction_level = "low"
        else:
            restriction_level = "none"
        
        return CalendarDayRestriction(
            date=date,
            restrictions=effective_restrictions,
            has_min_stay=has_min_stay,
            has_max_stay=has_max_stay,
            is_closed_to_arrival=is_closed_to_arrival,
            is_closed_to_departure=is_closed_to_departure,
            is_stop_sell=is_stop_sell,
            min_stay_value=min_stay_value,
            max_stay_value=max_stay_value,
            restriction_level=restriction_level
        )