# backend/app/services/parking_service.py - SISTEMA COMPLETO DE ESTACIONAMENTO

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc, asc
from fastapi import Request, HTTPException, status
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.models.property import Property
from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.user import User
from app.schemas.reservation import (
    ParkingAvailabilityRequest,
    ParkingAvailabilityResponse,
    ParkingConflictAlert
)
from app.services.audit_service import AuditService


class ParkingService:
    """Serviço para operações de estacionamento"""
    
    def __init__(self, db: Session):
        self.db = db

    def check_parking_availability(
        self,
        request: ParkingAvailabilityRequest,
        tenant_id: int
    ) -> ParkingAvailabilityResponse:
        """
        Verifica disponibilidade de estacionamento para um período.
        Retorna informações detalhadas sobre disponibilidade conforme política da propriedade.
        """
        
        # Buscar propriedade e validar configuração
        property_obj = self.db.query(Property).filter(
            Property.id == request.property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise ValueError("Propriedade não encontrada")
        
        if not property_obj.parking_enabled:
            return ParkingAvailabilityResponse(
                property_id=property_obj.id,
                property_name=property_obj.name,
                parking_enabled=False,
                parking_spots_total=0,
                parking_policy="integral",
                period_start=request.check_in_date,
                period_end=request.check_out_date,
                spots_available_all_days=0,
                spots_available_partial=0,
                daily_availability=[],
                can_reserve_integral=False,
                can_reserve_flexible=False,
                conflicts=["Propriedade não oferece estacionamento"]
            )
        
        if not property_obj.parking_spots_total or property_obj.parking_spots_total <= 0:
            return ParkingAvailabilityResponse(
                property_id=property_obj.id,
                property_name=property_obj.name,
                parking_enabled=True,
                parking_spots_total=0,
                parking_policy=property_obj.parking_policy,
                period_start=request.check_in_date,
                period_end=request.check_out_date,
                spots_available_all_days=0,
                spots_available_partial=0,
                daily_availability=[],
                can_reserve_integral=False,
                can_reserve_flexible=False,
                conflicts=["Nenhuma vaga de estacionamento configurada"]
            )
        
        # Gerar lista de datas do período (não inclui check-out)
        date_list = []
        current_date = request.check_in_date
        while current_date < request.check_out_date:
            date_list.append(current_date)
            current_date += timedelta(days=1)
        
        print(f"🅿️ Verificando disponibilidade de estacionamento:")
        print(f"   Propriedade: {property_obj.name} (ID: {property_obj.id})")
        print(f"   Período: {request.check_in_date} até {request.check_out_date}")
        print(f"   Datas a verificar: {date_list}")
        print(f"   Total de vagas: {property_obj.parking_spots_total}")
        print(f"   Política: {property_obj.parking_policy}")
        
        # Buscar reservas que conflitam com estacionamento no período
        conflicting_reservations = self._get_conflicting_reservations(
            request.property_id,
            request.check_in_date,
            request.check_out_date,
            tenant_id,
            request.exclude_reservation_id
        )
        
        print(f"   Reservas com estacionamento encontradas: {len(conflicting_reservations)}")
        
        # Calcular disponibilidade diária
        daily_availability = []
        min_spots_available = property_obj.parking_spots_total
        conflicts_found = []
        
        for check_date in date_list:
            occupied_spots = self._count_occupied_spots_on_date(
                conflicting_reservations, 
                check_date
            )
            available_spots = property_obj.parking_spots_total - occupied_spots
            
            print(f"   Data {check_date}: {occupied_spots} ocupadas, {available_spots} disponíveis")
            
            # Registrar conflitos se não há vagas
            date_conflicts = []
            if available_spots <= 0:
                conflicting_res_on_date = [
                    res for res in conflicting_reservations
                    if res['check_in_date'] <= check_date < res['check_out_date']
                ]
                for res in conflicting_res_on_date[:3]:  # Máximo 3 para não poluir
                    date_conflicts.append(f"Reserva {res['reservation_number']} ({res['guest_name']})")
                
                if len(conflicting_res_on_date) > 3:
                    date_conflicts.append(f"... e mais {len(conflicting_res_on_date) - 3} reservas")
            
            daily_availability.append({
                'date': check_date.isoformat(),
                'spots_total': property_obj.parking_spots_total,
                'spots_occupied': occupied_spots,
                'spots_available': available_spots,
                'conflicts': date_conflicts
            })
            
            # Acompanhar mínimo de vagas disponíveis
            if available_spots < min_spots_available:
                min_spots_available = available_spots
            
            # Coletar conflitos gerais
            if date_conflicts:
                conflicts_found.extend([
                    f"Data {check_date.strftime('%d/%m/%Y')}: {conflict}"
                    for conflict in date_conflicts
                ])
        
        # Calcular disponibilidade conforme políticas
        spots_available_all_days = max(0, min_spots_available)  # Vagas disponíveis em TODOS os dias
        spots_available_partial = max(0, min(
            property_obj.parking_spots_total,
            max([day['spots_available'] for day in daily_availability] + [0])
        ))  # Máximo de vagas disponíveis em PELO MENOS um dia
        
        # Verificar se pode reservar conforme cada política
        can_reserve_integral = spots_available_all_days > 0  # Integral: precisa ter vaga em todos os dias
        can_reserve_flexible = spots_available_partial > 0   # Flexível: precisa ter vaga em pelo menos um dia
        
        # Preparar mensagens de conflito
        conflicts = []
        if not can_reserve_integral and not can_reserve_flexible:
            conflicts.append("Não há vagas disponíveis em nenhum dia do período")
        elif not can_reserve_integral and property_obj.parking_policy == "integral":
            conflicts.append("Política Integral ativa: não há vagas disponíveis para todo o período")
            conflicts.extend(conflicts_found[:5])  # Máximo 5 conflitos específicos
        elif not can_reserve_flexible:
            conflicts.append("Não há vagas disponíveis em nenhum dia")
        
        print(f"   Resultado:")
        print(f"   - Vagas disponíveis todos os dias: {spots_available_all_days}")
        print(f"   - Vagas disponíveis parcialmente: {spots_available_partial}")
        print(f"   - Pode reservar (integral): {can_reserve_integral}")
        print(f"   - Pode reservar (flexível): {can_reserve_flexible}")
        print(f"   - Conflitos: {len(conflicts)}")
        
        # Gerar sugestões de datas alternativas se não pode reservar
        alternative_dates = None
        if not can_reserve_integral and not can_reserve_flexible:
            alternative_dates = self._suggest_alternative_dates(
                property_obj,
                request.check_in_date,
                request.check_out_date,
                tenant_id,
                request.exclude_reservation_id
            )
        
        return ParkingAvailabilityResponse(
            property_id=property_obj.id,
            property_name=property_obj.name,
            parking_enabled=property_obj.parking_enabled,
            parking_spots_total=property_obj.parking_spots_total,
            parking_policy=property_obj.parking_policy,
            period_start=request.check_in_date,
            period_end=request.check_out_date,
            spots_available_all_days=spots_available_all_days,
            spots_available_partial=spots_available_partial,
            daily_availability=daily_availability,
            can_reserve_integral=can_reserve_integral,
            can_reserve_flexible=can_reserve_flexible,
            conflicts=conflicts if conflicts else None,
            alternative_dates=alternative_dates
        )

    def _get_conflicting_reservations(
        self,
        property_id: int,
        check_in_date: date,
        check_out_date: date,
        tenant_id: int,
        exclude_reservation_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Busca reservas que solicitaram estacionamento e conflitam com o período.
        Retorna lista de dicionários com dados das reservas.
        """
        
        query = self.db.query(Reservation).options(
            joinedload(Reservation.guest)
        ).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.parking_requested == True,  # Apenas reservas que solicitaram estacionamento
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),  # Status ativos
            Reservation.is_active == True,
            # Verificar sobreposição de datas
            not_(
                or_(
                    Reservation.check_out_date <= check_in_date,  # Termina antes do nosso período
                    Reservation.check_in_date >= check_out_date   # Começa depois do nosso período
                )
            )
        )
        
        # Excluir reserva específica (usado em atualizações)
        if exclude_reservation_id:
            query = query.filter(Reservation.id != exclude_reservation_id)
        
        reservations = query.all()
        
        # Converter para formato de dicionário
        result = []
        for reservation in reservations:
            result.append({
                'id': reservation.id,
                'reservation_number': reservation.reservation_number,
                'guest_name': reservation.guest.full_name if reservation.guest else 'Hóspede não encontrado',
                'check_in_date': reservation.check_in_date,
                'check_out_date': reservation.check_out_date,
                'status': reservation.status
            })
        
        return result

    def _count_occupied_spots_on_date(
        self,
        conflicting_reservations: List[Dict[str, Any]],
        target_date: date
    ) -> int:
        """
        Conta quantas vagas estão ocupadas em uma data específica.
        """
        occupied = 0
        
        for reservation in conflicting_reservations:
            # Verificar se a reserva está ativa na data alvo
            if (reservation['check_in_date'] <= target_date < reservation['check_out_date']):
                occupied += 1
        
        return occupied

    def _suggest_alternative_dates(
        self,
        property_obj: Property,
        original_check_in: date,
        original_check_out: date,
        tenant_id: int,
        exclude_reservation_id: Optional[int] = None,
        max_suggestions: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Sugere datas alternativas quando não há disponibilidade.
        """
        suggestions = []
        stay_duration = (original_check_out - original_check_in).days
        
        # Tentar períodos próximos (antes e depois)
        for offset in [1, 2, 3, 7, 14]:  # 1, 2, 3 dias, 1 semana, 2 semanas
            for direction in [-1, 1]:  # antes e depois
                try:
                    new_check_in = original_check_in + timedelta(days=offset * direction)
                    new_check_out = new_check_in + timedelta(days=stay_duration)
                    
                    # Não sugerir datas no passado
                    if new_check_in < date.today():
                        continue
                    
                    # Verificar disponibilidade do período alternativo
                    alt_request = ParkingAvailabilityRequest(
                        property_id=property_obj.id,
                        check_in_date=new_check_in,
                        check_out_date=new_check_out,
                        exclude_reservation_id=exclude_reservation_id
                    )
                    
                    alt_availability = self.check_parking_availability(alt_request, tenant_id)
                    
                    if alt_availability.can_reserve_integral or (
                        property_obj.parking_policy == "flexible" and alt_availability.can_reserve_flexible
                    ):
                        suggestions.append({
                            'check_in_date': new_check_in.isoformat(),
                            'check_out_date': new_check_out.isoformat(),
                            'spots_available': alt_availability.spots_available_all_days,
                            'policy_compatible': True,
                            'offset_days': offset * direction,
                            'description': f"{'Antes' if direction == -1 else 'Depois'} por {offset} dia(s)"
                        })
                        
                        if len(suggestions) >= max_suggestions:
                            return suggestions
                            
                except Exception as e:
                    print(f"⚠️ Erro ao sugerir data alternativa: {e}")
                    continue
        
        return suggestions[:max_suggestions]

    def get_parking_conflicts(
        self,
        property_id: int,
        check_in_date: date,
        check_out_date: date,
        tenant_id: int,
        exclude_reservation_id: Optional[int] = None
    ) -> List[ParkingConflictAlert]:
        """
        Busca conflitos detalhados de estacionamento.
        Retorna lista de alertas de conflito.
        """
        
        property_obj = self.db.query(Property).filter(
            Property.id == property_id,
            Property.tenant_id == tenant_id
        ).first()
        
        if not property_obj or not property_obj.parking_enabled:
            return []
        
        conflicting_reservations = self._get_conflicting_reservations(
            property_id, check_in_date, check_out_date, tenant_id, exclude_reservation_id
        )
        
        alerts = []
        
        # Gerar lista de datas
        date_list = []
        current_date = check_in_date
        while current_date < check_out_date:
            date_list.append(current_date)
            current_date += timedelta(days=1)
        
        for check_date in date_list:
            occupied_spots = self._count_occupied_spots_on_date(conflicting_reservations, check_date)
            available_spots = property_obj.parking_spots_total - occupied_spots
            
            if available_spots <= 0:
                # Buscar reservas conflitantes nesta data
                conflicting_on_date = [
                    res for res in conflicting_reservations
                    if res['check_in_date'] <= check_date < res['check_out_date']
                ]
                
                conflicting_numbers = [res['reservation_number'] for res in conflicting_on_date]
                
                alert = ParkingConflictAlert(
                    severity="error" if property_obj.parking_policy == "integral" else "warning",
                    message=f"Sem vagas disponíveis em {check_date.strftime('%d/%m/%Y')}",
                    affected_dates=[check_date],
                    conflicting_reservations=conflicting_numbers,
                    suggested_action="Considere alterar as datas ou entrar em contato com os hóspedes para reorganizar"
                )
                alerts.append(alert)
            
            elif available_spots == 1 and property_obj.parking_spots_total > 1:
                # Alerta de baixa disponibilidade
                alert = ParkingConflictAlert(
                    severity="warning",
                    message=f"Apenas 1 vaga disponível em {check_date.strftime('%d/%m/%Y')}",
                    affected_dates=[check_date],
                    conflicting_reservations=[],
                    suggested_action="Considere confirmar a disponibilidade antes de aceitar mais reservas"
                )
                alerts.append(alert)
        
        return alerts

    def validate_parking_request(
        self,
        property_id: int,
        check_in_date: date,
        check_out_date: date,
        tenant_id: int,
        exclude_reservation_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Valida se uma solicitação de estacionamento pode ser atendida.
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        
        try:
            request = ParkingAvailabilityRequest(
                property_id=property_id,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                exclude_reservation_id=exclude_reservation_id
            )
            
            availability = self.check_parking_availability(request, tenant_id)
            
            if not availability.parking_enabled:
                return False, "Propriedade não oferece estacionamento"
            
            if availability.parking_spots_total <= 0:
                return False, "Nenhuma vaga de estacionamento configurada"
            
            # Verificar conforme política
            if availability.parking_policy == "integral":
                if not availability.can_reserve_integral:
                    conflicts_msg = "; ".join(availability.conflicts) if availability.conflicts else ""
                    return False, f"Política Integral: não há vagas para todo o período. {conflicts_msg}"
            
            elif availability.parking_policy == "flexible":
                if not availability.can_reserve_flexible:
                    return False, "Não há vagas disponíveis em nenhum dia"
                
                # Se flexível e há conflitos parciais, apenas avisar (não bloquear)
                if not availability.can_reserve_integral:
                    conflicts_msg = "; ".join(availability.conflicts[:2]) if availability.conflicts else ""
                    return True, f"AVISO: Vagas limitadas em alguns dias. {conflicts_msg}"
            
            return True, None
            
        except Exception as e:
            return False, f"Erro ao validar estacionamento: {str(e)}"

    def get_parking_occupancy(
        self,
        property_id: int,
        start_date: date,
        end_date: date,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        Retorna dados de ocupação do estacionamento por período.
        Usado para relatórios e gráficos.
        """
        
        property_obj = self.db.query(Property).filter(
            Property.id == property_id,
            Property.tenant_id == tenant_id
        ).first()
        
        if not property_obj:
            raise ValueError("Propriedade não encontrada")
        
        if not property_obj.parking_enabled:
            return {
                'property_id': property_id,
                'property_name': property_obj.name,
                'parking_enabled': False,
                'period_start': start_date.isoformat(),
                'period_end': end_date.isoformat(),
                'parking_spots_total': 0,
                'daily_data': [],
                'summary': {
                    'avg_occupancy_rate': 0.0,
                    'max_occupancy': 0,
                    'min_occupancy': 0,
                    'total_requests': 0
                }
            }
        
        # Buscar todas as reservas com estacionamento no período
        reservations_with_parking = self.db.query(Reservation).options(
            joinedload(Reservation.guest)
        ).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.parking_requested == True,
            Reservation.status.in_(['pending', 'confirmed', 'checked_in', 'checked_out']),
            Reservation.is_active == True,
            not_(
                or_(
                    Reservation.check_out_date <= start_date,
                    Reservation.check_in_date >= end_date
                )
            )
        ).all()
        
        # Gerar dados diários
        daily_data = []
        total_occupancy = 0
        max_occupancy = 0
        min_occupancy = property_obj.parking_spots_total
        
        current_date = start_date
        while current_date <= end_date:
            # Contar reservas ativas nesta data
            active_reservations = [
                res for res in reservations_with_parking
                if res.check_in_date <= current_date < res.check_out_date
            ]
            
            occupied_spots = len(active_reservations)
            available_spots = property_obj.parking_spots_total - occupied_spots
            occupancy_rate = (occupied_spots / property_obj.parking_spots_total * 100) if property_obj.parking_spots_total > 0 else 0
            
            daily_data.append({
                'date': current_date.isoformat(),
                'day_of_week': current_date.strftime('%A'),
                'occupied_spots': occupied_spots,
                'available_spots': available_spots,
                'occupancy_rate': round(occupancy_rate, 1),
                'reservations': [
                    {
                        'reservation_number': res.reservation_number,
                        'guest_name': res.guest.full_name if res.guest else 'N/A',
                        'status': res.status
                    }
                    for res in active_reservations
                ]
            })
            
            # Atualizar estatísticas
            total_occupancy += occupancy_rate
            max_occupancy = max(max_occupancy, occupied_spots)
            min_occupancy = min(min_occupancy, occupied_spots)
            
            current_date += timedelta(days=1)
        
        # Calcular médias
        days_count = len(daily_data)
        avg_occupancy_rate = (total_occupancy / days_count) if days_count > 0 else 0
        
        # Contar total de solicitações únicas no período
        total_requests = len(set(res.id for res in reservations_with_parking))
        
        return {
            'property_id': property_id,
            'property_name': property_obj.name,
            'parking_enabled': property_obj.parking_enabled,
            'parking_policy': property_obj.parking_policy,
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat(),
            'parking_spots_total': property_obj.parking_spots_total,
            'daily_data': daily_data,
            'summary': {
                'avg_occupancy_rate': round(avg_occupancy_rate, 1),
                'max_occupancy': max_occupancy,
                'min_occupancy': min_occupancy,
                'total_requests': total_requests,
                'days_analyzed': days_count,
                'peak_occupancy_days': [
                    day for day in daily_data 
                    if day['occupied_spots'] == max_occupancy
                ][:5]  # Máximo 5 dias de pico
            }
        }

    def get_parking_stats_for_property(
        self,
        property_id: int,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        Retorna estatísticas gerais de estacionamento para uma propriedade.
        Usado em dashboards e relatórios.
        """
        
        property_obj = self.db.query(Property).filter(
            Property.id == property_id,
            Property.tenant_id == tenant_id
        ).first()
        
        if not property_obj or not property_obj.parking_enabled:
            return {
                'parking_enabled': False,
                'parking_spots_total': 0,
                'current_occupancy': 0,
                'occupancy_rate': 0.0,
                'total_requests_ever': 0,
                'requests_this_month': 0,
                'avg_request_rate': 0.0
            }
        
        today = date.today()
        
        # Ocupação atual (reservas que incluem hoje)
        current_occupancy = self.db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.parking_requested == True,
            Reservation.status.in_(['confirmed', 'checked_in']),
            Reservation.check_in_date <= today,
            Reservation.check_out_date > today,
            Reservation.is_active == True
        ).scalar() or 0
        
        occupancy_rate = (current_occupancy / property_obj.parking_spots_total * 100) if property_obj.parking_spots_total > 0 else 0
        
        # Total de solicitações (histórico)
        total_requests_ever = self.db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.parking_requested == True,
            Reservation.is_active == True
        ).scalar() or 0
        
        # Solicitações este mês
        first_day_month = today.replace(day=1)
        requests_this_month = self.db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.parking_requested == True,
            Reservation.created_at >= first_day_month,
            Reservation.is_active == True
        ).scalar() or 0
        
        # Taxa média de solicitações (% de reservas que pedem estacionamento)
        total_reservations = self.db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).scalar() or 0
        
        avg_request_rate = (total_requests_ever / total_reservations * 100) if total_reservations > 0 else 0
        
        return {
            'parking_enabled': property_obj.parking_enabled,
            'parking_spots_total': property_obj.parking_spots_total,
            'parking_policy': property_obj.parking_policy,
            'current_occupancy': current_occupancy,
            'available_spots': property_obj.parking_spots_total - current_occupancy,
            'occupancy_rate': round(occupancy_rate, 1),
            'total_requests_ever': total_requests_ever,
            'requests_this_month': requests_this_month,
            'avg_request_rate': round(avg_request_rate, 1),
            'total_reservations': total_reservations
        }

    def release_parking_spot(
        self,
        reservation_id: int,
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None,
        reason: str = "Check-out realizado"
    ) -> bool:
        """
        Libera vaga de estacionamento (usado no check-out/cancelamento).
        Registra auditoria da liberação.
        """
        
        reservation = self.db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id
        ).first()
        
        if not reservation:
            return False
        
        if not reservation.parking_requested:
            return True  # Não tinha estacionamento mesmo
        
        try:
            # Registrar auditoria da liberação
            audit_service = AuditService(self.db)
            
            audit_service.log_update(
                table_name="reservations",
                record_id=reservation_id,
                old_values={'parking_status': 'occupied'},
                new_values={'parking_status': 'released'},
                user=current_user,
                request=request,
                description=f"Vaga de estacionamento liberada: {reason}"
            )
            
            print(f"🅿️ Vaga de estacionamento liberada para reserva {reservation.reservation_number}")
            return True
            
        except Exception as e:
            print(f"⚠️ Erro ao registrar liberação de estacionamento: {e}")
            return False

    def reserve_parking_spot(
        self,
        reservation_id: int,
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> bool:
        """
        Reserva vaga de estacionamento (usado na criação/confirmação).
        Registra auditoria da reserva.
        """
        
        reservation = self.db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id
        ).first()
        
        if not reservation or not reservation.parking_requested:
            return False
        
        # Validar disponibilidade
        is_valid, error_message = self.validate_parking_request(
            reservation.property_id,
            reservation.check_in_date,
            reservation.check_out_date,
            tenant_id,
            reservation_id
        )
        
        if not is_valid:
            print(f"⚠️ Não foi possível reservar estacionamento: {error_message}")
            return False
        
        try:
            # Registrar auditoria da reserva
            audit_service = AuditService(self.db)
            
            audit_service.log_update(
                table_name="reservations",
                record_id=reservation_id,
                old_values={'parking_status': 'requested'},
                new_values={'parking_status': 'reserved'},
                user=current_user,
                request=request,
                description=f"Vaga de estacionamento reservada para {reservation.check_in_date} - {reservation.check_out_date}"
            )
            
            print(f"🅿️ Vaga de estacionamento reservada para reserva {reservation.reservation_number}")
            return True
            
        except Exception as e:
            print(f"⚠️ Erro ao registrar reserva de estacionamento: {e}")
            return False