# backend/app/services/room_availability_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, case, text
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.reservation import Reservation, ReservationRoom
from app.schemas.room_availability import (
    RoomAvailabilityCreate,
    RoomAvailabilityUpdate,
    RoomAvailabilityFilters,
    BulkAvailabilityUpdate,
    CalendarAvailabilityRequest
)
from app.utils.decorators import audit_operation

# ✅ NOVO: Imports para validação de restrições
from app.services.restriction_validation_service import RestrictionValidationService
from app.schemas.reservation_restriction import (
    RestrictionValidationRequest, RestrictionValidationResponse
)

# ✅ SSE: Import do serviço de notificações
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


class RoomAvailabilityService:
    """Serviço para operações com disponibilidade de quartos - estendido para Channel Manager e Restrições"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_availability_by_id(self, availability_id: int, tenant_id: int) -> Optional[RoomAvailability]:
        """Busca disponibilidade por ID dentro do tenant"""
        return self.db.query(RoomAvailability).options(
            joinedload(RoomAvailability.room).joinedload(Room.room_type),
            joinedload(RoomAvailability.room).joinedload(Room.property_obj),
            joinedload(RoomAvailability.reservation)
        ).filter(
            RoomAvailability.id == availability_id,
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).first()

    def get_availability_by_room_date(
        self, 
        room_id: int, 
        date: date, 
        tenant_id: int
    ) -> Optional[RoomAvailability]:
        """Busca disponibilidade específica de um quarto em uma data"""
        return self.db.query(RoomAvailability).filter(
            RoomAvailability.room_id == room_id,
            RoomAvailability.date == date,
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).first()

    def get_availabilities(
        self, 
        tenant_id: int, 
        filters: RoomAvailabilityFilters,
        skip: int = 0,
        limit: int = 20
    ) -> List[RoomAvailability]:
        """Lista disponibilidades com filtros"""
        query = self.db.query(RoomAvailability).options(
            joinedload(RoomAvailability.room).joinedload(Room.room_type),
            joinedload(RoomAvailability.room).joinedload(Room.property_obj)
        ).join(Room).join(RoomType).join(Property)
        
        # Aplicar filtros
        query = self._apply_filters(query, tenant_id, filters)
        
        return query.offset(skip).limit(limit).all()

    def count_availabilities(self, tenant_id: int, filters: RoomAvailabilityFilters) -> int:
        """Conta disponibilidades com filtros"""
        query = self.db.query(func.count(RoomAvailability.id)).join(Room).join(RoomType).join(Property)
        query = self._apply_filters(query, tenant_id, filters)
        return query.scalar()

    @audit_operation("room_availability", "CREATE")
    def create_availability(
        self, 
        availability_data: RoomAvailabilityCreate, 
        tenant_id: int,
        mark_for_sync: bool = True
    ) -> RoomAvailability:
        """Cria nova disponibilidade"""
        
        # Verificar se quarto existe no tenant
        room = self.db.query(Room).filter(
            Room.id == availability_data.room_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).first()
        
        if not room:
            raise ValueError("Quarto não encontrado")
        
        # Verificar duplicação
        existing = self.get_availability_by_room_date(
            availability_data.room_id, 
            availability_data.date, 
            tenant_id
        )
        
        if existing:
            raise ValueError(f"Disponibilidade já existe para este quarto na data {availability_data.date}")
        
        # Criar disponibilidade
        db_availability = RoomAvailability(
            tenant_id=tenant_id,
            **availability_data.model_dump()
        )
        
        # Marcar para sincronização com channel manager
        if mark_for_sync:
            db_availability.mark_for_sync()
        
        try:
            self.db.add(db_availability)
            self.db.commit()
            self.db.refresh(db_availability)
            
            # ✅ SSE: Notificar criação de disponibilidade
            notification_service.notify_availability_updated(
                tenant_id=tenant_id,
                room_ids=[availability_data.room_id],
                date_from=availability_data.date.isoformat(),
                date_to=availability_data.date.isoformat(),
                updated_count=1
            )
            
            return db_availability
        except IntegrityError as e:
            self.db.rollback()
            raise ValueError(f"Erro ao criar disponibilidade: {str(e)}")

    @audit_operation("room_availability", "UPDATE")
    def update_availability(
        self, 
        availability_id: int, 
        availability_data: RoomAvailabilityUpdate, 
        tenant_id: int,
        mark_for_sync: bool = True
    ) -> Optional[RoomAvailability]:
        """Atualiza disponibilidade existente"""
        
        availability = self.get_availability_by_id(availability_id, tenant_id)
        if not availability:
            return None
        
        # Aplicar atualizações
        update_data = availability_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(availability, field, value)
        
        availability.updated_at = datetime.utcnow()
        
        # Marcar para sincronização
        if mark_for_sync:
            availability.mark_for_sync()
        
        try:
            self.db.commit()
            self.db.refresh(availability)
            
            # ✅ SSE: Notificar atualização de disponibilidade
            notification_service.notify_availability_updated(
                tenant_id=tenant_id,
                room_ids=[availability.room_id],
                date_from=availability.date.isoformat(),
                date_to=availability.date.isoformat(),
                updated_count=1
            )
            
            return availability
        except IntegrityError as e:
            self.db.rollback()
            raise ValueError(f"Erro ao atualizar disponibilidade: {str(e)}")

    @audit_operation("room_availability", "DELETE")
    def delete_availability(self, availability_id: int, tenant_id: int) -> bool:
        """Remove disponibilidade (soft delete)"""
        availability = self.get_availability_by_id(availability_id, tenant_id)
        if not availability:
            return False
        
        availability.is_active = False
        availability.updated_at = datetime.utcnow()
        availability.mark_for_sync()  # Sincronizar remoção
        
        self.db.commit()
        
        # ✅ SSE: Notificar remoção de disponibilidade
        notification_service.notify_availability_updated(
            tenant_id=tenant_id,
            room_ids=[availability.room_id],
            date_from=availability.date.isoformat(),
            date_to=availability.date.isoformat(),
            updated_count=1
        )
        
        return True

    def bulk_update_availability(
        self, 
        bulk_data: BulkAvailabilityUpdate, 
        tenant_id: int,
        mark_for_sync: bool = True
    ) -> Dict[str, Any]:
        """Atualização em massa de disponibilidades"""
        
        # Validar quartos pertencem ao tenant
        valid_rooms = self.db.query(Room.id).filter(
            Room.id.in_(bulk_data.room_ids),
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).all()
        
        valid_room_ids = [room.id for room in valid_rooms]
        if not valid_room_ids:
            raise ValueError("Nenhum quarto válido encontrado")
        
        # Gerar lista de datas
        current_date = bulk_data.date_from
        dates = []
        while current_date <= bulk_data.date_to:
            dates.append(current_date)
            current_date += timedelta(days=1)
        
        created_count = 0
        updated_count = 0
        errors = []
        
        # Preparar dados de atualização
        update_data = bulk_data.model_dump(exclude={'room_ids', 'date_from', 'date_to'}, exclude_unset=True)
        
        for room_id in valid_room_ids:
            for target_date in dates:
                try:
                    existing = self.get_availability_by_room_date(room_id, target_date, tenant_id)
                    
                    if existing:
                        # Atualizar existente
                        for field, value in update_data.items():
                            setattr(existing, field, value)
                        existing.updated_at = datetime.utcnow()
                        
                        if mark_for_sync:
                            existing.mark_for_sync()
                        
                        updated_count += 1
                    else:
                        # Criar novo
                        new_availability = RoomAvailability(
                            tenant_id=tenant_id,
                            room_id=room_id,
                            date=target_date,
                            **update_data
                        )
                        
                        if mark_for_sync:
                            new_availability.mark_for_sync()
                        
                        self.db.add(new_availability)
                        created_count += 1
                        
                except Exception as e:
                    errors.append(f"Erro no quarto {room_id}, data {target_date}: {str(e)}")
        
        try:
            self.db.commit()
            
            # ✅ SSE: Notificar bulk update concluído
            total_affected = created_count + updated_count
            notification_service.notify_bulk_update_completed(
                tenant_id=tenant_id,
                affected_records=total_affected,
                success=len(errors) == 0
            )
            
            # ✅ SSE: Notificar atualização de disponibilidade
            notification_service.notify_availability_updated(
                tenant_id=tenant_id,
                room_ids=valid_room_ids,
                date_from=bulk_data.date_from.isoformat(),
                date_to=bulk_data.date_to.isoformat(),
                updated_count=total_affected
            )
            
            # ✅ SSE: Atualizar contagem de pendentes se marcou para sync
            if mark_for_sync:
                self._notify_pending_count_updated(tenant_id)
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Erro ao salvar atualizações em massa: {str(e)}")
        
        return {
            "created": created_count,
            "updated": updated_count,
            "errors": errors,
            "total_processed": created_count + updated_count
        }

    def get_calendar_availability(
        self, 
        request: CalendarAvailabilityRequest, 
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """Busca disponibilidade para calendário"""
        
        # Query base
        query = self.db.query(RoomAvailability).options(
            joinedload(RoomAvailability.room).joinedload(Room.room_type),
            joinedload(RoomAvailability.room).joinedload(Room.property_obj)
        ).join(Room).join(RoomType).join(Property)
        
        # Filtros básicos
        query = query.filter(
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True,
            RoomAvailability.date >= request.date_from,
            RoomAvailability.date <= request.date_to
        )
        
        # Filtros específicos
        if request.room_ids:
            query = query.filter(RoomAvailability.room_id.in_(request.room_ids))
        
        if request.property_id:
            query = query.filter(Property.id == request.property_id)
        
        if request.room_type_id:
            query = query.filter(RoomType.id == request.room_type_id)
        
        if not request.include_reserved:
            query = query.filter(RoomAvailability.is_reserved == False)
        
        # Agrupar por data
        availabilities = query.order_by(RoomAvailability.date, Room.room_number).all()
        
        # Organizar por data
        calendar_data = {}
        for availability in availabilities:
            date_key = availability.date.isoformat()
            if date_key not in calendar_data:
                calendar_data[date_key] = {
                    'date': availability.date,
                    'availabilities': [],
                    'summary': {
                        'total': 0,
                        'available': 0,
                        'blocked': 0,
                        'reserved': 0,
                        'maintenance': 0,
                        'out_of_order': 0
                    }
                }
            
            calendar_data[date_key]['availabilities'].append(availability)
            calendar_data[date_key]['summary']['total'] += 1
            
            # Contar por status
            status = availability.status
            if status in calendar_data[date_key]['summary']:
                calendar_data[date_key]['summary'][status] += 1
        
        return list(calendar_data.values())

    def get_availability_stats(
        self, 
        tenant_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        property_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Estatísticas de disponibilidade"""
        
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date_from + timedelta(days=30)
        
        # Query base
        query = self.db.query(RoomAvailability).join(Room).join(Property)
        query = query.filter(
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True,
            RoomAvailability.date >= date_from,
            RoomAvailability.date <= date_to
        )
        
        if property_id:
            query = query.filter(Property.id == property_id)
        
        # Contar por status
        stats_query = query.with_entities(
            func.count(RoomAvailability.id).label('total'),
            func.sum(case((RoomAvailability.is_available == True, 1), else_=0)).label('available'),
            func.sum(case((RoomAvailability.is_blocked == True, 1), else_=0)).label('blocked'),
            func.sum(case((RoomAvailability.is_reserved == True, 1), else_=0)).label('reserved'),
            func.sum(case((RoomAvailability.is_maintenance == True, 1), else_=0)).label('maintenance'),
            func.sum(case((RoomAvailability.is_out_of_order == True, 1), else_=0)).label('out_of_order')
        )
        
        result = stats_query.first()
        
        total = result.total or 0
        available = result.available or 0
        reserved = result.reserved or 0
        
        occupancy_rate = (reserved / total * 100) if total > 0 else 0
        availability_rate = (available / total * 100) if total > 0 else 0
        
        return {
            'total_rooms': total,
            'available_rooms': available,
            'blocked_rooms': result.blocked or 0,
            'reserved_rooms': reserved,
            'maintenance_rooms': result.maintenance or 0,
            'out_of_order_rooms': result.out_of_order or 0,
            'occupancy_rate': round(occupancy_rate, 2),
            'availability_rate': round(availability_rate, 2)
        }

    def check_room_availability(
        self, 
        room_id: int, 
        check_in_date: date, 
        check_out_date: date, 
        tenant_id: int,
        validate_restrictions: bool = True
    ) -> Dict[str, Any]:
        """
        Verifica disponibilidade de um quarto em período específico
        ✅ NOVO: Agora inclui validação de restrições
        """
        
        # Gerar lista de datas (excluindo check-out)
        current_date = check_in_date
        dates = []
        while current_date < check_out_date:
            dates.append(current_date)
            current_date += timedelta(days=1)
        
        # Buscar disponibilidades do RoomAvailability
        availabilities = self.db.query(RoomAvailability).filter(
            RoomAvailability.room_id == room_id,
            RoomAvailability.date.in_(dates),
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).all()
        
        # Verificar cada data
        conflicts = []
        total_rate = Decimal('0.00')
        restriction_violations = []
        
        for target_date in dates:
            availability = next(
                (a for a in availabilities if a.date == target_date), 
                None
            )
            
            if not availability:
                # Assumir disponível se não há registro específico
                continue
            
            if not availability.is_bookable:
                conflicts.append({
                    'date': target_date.isoformat(),
                    'reason': availability.reason or f"Status: {availability.status}"
                })
            
            # Somar tarifas
            if availability.rate_override:
                total_rate += availability.rate_override
        
        # ✅ NOVO: Validar restrições se solicitado
        if validate_restrictions:
            # Buscar dados do quarto para validação
            room = self.db.query(Room).filter(
                Room.id == room_id,
                Room.tenant_id == tenant_id
            ).first()
            
            if room:
                restriction_validation = self._validate_room_restrictions(
                    property_id=room.property_id,
                    room_id=room_id,
                    room_type_id=room.room_type_id,
                    check_in_date=check_in_date,
                    check_out_date=check_out_date,
                    tenant_id=tenant_id
                )
                
                if not restriction_validation.is_valid:
                    for violation in restriction_validation.violations:
                        restriction_violations.append({
                            'type': 'restriction',
                            'restriction_type': violation.restriction_type,
                            'message': violation.violation_message,
                            'date_affected': violation.date_affected.isoformat() if violation.date_affected else None,
                            'can_override': violation.can_override
                        })
        
        # Determinar se está disponível (sem conflitos básicos nem de restrições)
        is_available = len(conflicts) == 0 and len(restriction_violations) == 0
        
        return {
            'available': is_available,
            'conflicts': conflicts,
            'restriction_violations': restriction_violations,
            'nights': len(dates),
            'total_rate': total_rate,
            'details': [
                {
                    'date': a.date.isoformat(),
                    'status': a.status,
                    'rate': a.rate_override,
                    'is_bookable': a.is_bookable
                }
                for a in availabilities
            ]
        }

    # ✅ NOVO: Método para validar restrições individualmente
    def check_room_availability_with_restrictions(
        self,
        room_id: int,
        check_in_date: date,
        check_out_date: date,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        Versão específica que sempre valida restrições.
        Wrapper para o método principal com validate_restrictions=True
        """
        return self.check_room_availability(
            room_id=room_id,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
            tenant_id=tenant_id,
            validate_restrictions=True
        )

    # ✅ NOVO: Método para verificar múltiplos quartos com restrições
    def check_multiple_rooms_availability(
        self,
        room_ids: List[int],
        check_in_date: date,
        check_out_date: date,
        tenant_id: int,
        validate_restrictions: bool = True
    ) -> Dict[int, Dict[str, Any]]:
        """
        Verifica disponibilidade de múltiplos quartos incluindo restrições.
        Retorna dict {room_id: availability_data}
        """
        results = {}
        
        for room_id in room_ids:
            try:
                availability = self.check_room_availability(
                    room_id=room_id,
                    check_in_date=check_in_date,
                    check_out_date=check_out_date,
                    tenant_id=tenant_id,
                    validate_restrictions=validate_restrictions
                )
                results[room_id] = availability
            except Exception as e:
                results[room_id] = {
                    'available': False,
                    'conflicts': [{'date': 'error', 'reason': str(e)}],
                    'restriction_violations': [],
                    'nights': 0,
                    'total_rate': 0,
                    'details': []
                }
        
        return results

    # ✅ NOVO: Método auxiliar para validação de restrições
    def _validate_room_restrictions(
        self,
        property_id: int,
        room_id: int,
        room_type_id: int,
        check_in_date: date,
        check_out_date: date,
        tenant_id: int
    ) -> RestrictionValidationResponse:
        """Valida restrições para um quarto específico"""
        try:
            restriction_service = RestrictionValidationService(self.db)
            
            validation_request = RestrictionValidationRequest(
                property_id=property_id,
                room_id=room_id,
                room_type_id=room_type_id,
                check_in_date=check_in_date,
                check_out_date=check_out_date
            )
            
            return restriction_service.validate_reservation_restrictions(
                validation_request, tenant_id
            )
        except Exception as e:
            # Em caso de erro na validação, retornar como válido para não bloquear
            logger.warning(f"Erro na validação de restrições: {e}")
            return RestrictionValidationResponse(
                is_valid=True,
                violations=[],
                warnings=[],
                property_id=property_id,
                room_id=room_id,
                room_type_id=room_type_id,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                nights=(check_out_date - check_in_date).days,
                applicable_restrictions=[]
            )

    # ========== MÉTODOS ESPECÍFICOS PARA CHANNEL MANAGER ==========

    def get_pending_sync_availabilities(
        self,
        tenant_id: int,
        room_ids: Optional[List[int]] = None,
        limit: int = 100
    ) -> List[RoomAvailability]:
        """Busca disponibilidades pendentes de sincronização"""
        query = self.db.query(RoomAvailability).filter(
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.sync_pending == True,
            RoomAvailability.is_active == True
        )
        
        if room_ids:
            query = query.filter(RoomAvailability.room_id.in_(room_ids))
        
        return query.limit(limit).all()

    def mark_availability_synced(
        self,
        availability_ids: List[int],
        tenant_id: int,
        sync_timestamp: Optional[str] = None
    ) -> int:
        """Marca disponibilidades como sincronizadas"""
        count = self.db.query(RoomAvailability).filter(
            RoomAvailability.id.in_(availability_ids),
            RoomAvailability.tenant_id == tenant_id
        ).update({
            RoomAvailability.wubook_synced: True,
            RoomAvailability.sync_pending: False,
            RoomAvailability.last_wubook_sync: sync_timestamp or datetime.utcnow().isoformat(),
            RoomAvailability.wubook_sync_error: None
        }, synchronize_session=False)
        
        self.db.commit()
        
        # ✅ SSE: Notificar atualização de contagem de pendentes
        if count > 0:
            self._notify_pending_count_updated(tenant_id)
        
        return count

    def mark_availability_sync_error(
        self,
        availability_ids: List[int],
        tenant_id: int,
        error_message: str
    ) -> int:
        """Marca erro na sincronização de disponibilidades"""
        count = self.db.query(RoomAvailability).filter(
            RoomAvailability.id.in_(availability_ids),
            RoomAvailability.tenant_id == tenant_id
        ).update({
            RoomAvailability.sync_pending: True,
            RoomAvailability.wubook_sync_error: error_message
        }, synchronize_session=False)
        
        self.db.commit()
        
        # ✅ SSE: Notificar atualização de contagem de pendentes
        if count > 0:
            self._notify_pending_count_updated(tenant_id)
        
        return count

    def get_channel_manager_overview(
        self,
        tenant_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Visão geral para o Channel Manager"""
        
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date_from + timedelta(days=7)
        
        # Estatísticas de sincronização
        sync_stats = self.db.query(
            func.count(RoomAvailability.id).label('total'),
            func.sum(case((RoomAvailability.wubook_synced == True, 1), else_=0)).label('synced'),
            func.sum(case((RoomAvailability.sync_pending == True, 1), else_=0)).label('pending'),
            func.sum(case((RoomAvailability.wubook_sync_error.isnot(None), 1), else_=0)).label('errors')
        ).filter(
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True,
            RoomAvailability.date >= date_from,
            RoomAvailability.date <= date_to
        ).first()
        
        # Estatísticas de disponibilidade
        availability_stats = self.get_availability_stats(tenant_id, date_from, date_to)
        
        return {
            'period': {
                'date_from': date_from.isoformat(),
                'date_to': date_to.isoformat(),
                'days': (date_to - date_from).days + 1
            },
            'sync_status': {
                'total_records': sync_stats.total or 0,
                'synced': sync_stats.synced or 0,
                'pending': sync_stats.pending or 0,
                'errors': sync_stats.errors or 0,
                'sync_rate': round((sync_stats.synced or 0) / max(sync_stats.total or 1, 1) * 100, 2)
            },
            'availability': availability_stats
        }

    # ✅ SSE: Método auxiliar para notificar contagem de pendentes
    def _notify_pending_count_updated(self, tenant_id: int):
        """Notifica atualização na contagem de itens pendentes de sincronização"""
        try:
            # Buscar contagem total de pendentes
            total_pending = self.db.query(func.count(RoomAvailability.id)).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True
            ).scalar() or 0
            
            # Buscar data mais antiga pendente
            oldest = self.db.query(func.min(RoomAvailability.date)).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True
            ).scalar()
            
            oldest_date = oldest.isoformat() if oldest else None
            
            # Notificar via SSE
            notification_service.notify_sync_pending_updated(
                tenant_id=tenant_id,
                total=total_pending,
                oldest_date=oldest_date
            )
            
        except Exception as e:
            logger.warning(f"Erro ao notificar contagem de pendentes: {e}")

    # ✅ NOVO: Método para análise de restrições no período
    def get_restrictions_impact_overview(
        self,
        tenant_id: int,
        property_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Análise do impacto das restrições na disponibilidade.
        Útil para dashboards do Channel Manager.
        """
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date_from + timedelta(days=30)
        
        # Buscar todos os quartos no escopo
        rooms_query = self.db.query(Room).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        if property_id:
            rooms_query = rooms_query.filter(Room.property_id == property_id)
        
        rooms = rooms_query.all()
        
        total_room_days = len(rooms) * ((date_to - date_from).days + 1)
        restricted_room_days = 0
        restriction_types_count = {}
        
        # Para cada quarto, verificar restrições no período
        for room in rooms:
            current_date = date_from
            while current_date <= date_to:
                # Verificar se há restrições nesta data
                validation = self._validate_room_restrictions(
                    property_id=room.property_id,
                    room_id=room.id,
                    room_type_id=room.room_type_id,
                    check_in_date=current_date,
                    check_out_date=current_date + timedelta(days=1),
                    tenant_id=tenant_id
                )
                
                if not validation.is_valid:
                    restricted_room_days += 1
                    
                    # Contar tipos de restrição
                    for violation in validation.violations:
                        restriction_type = violation.restriction_type
                        restriction_types_count[restriction_type] = restriction_types_count.get(restriction_type, 0) + 1
                
                current_date += timedelta(days=1)
        
        restriction_impact_rate = (restricted_room_days / total_room_days * 100) if total_room_days > 0 else 0
        
        return {
            'period': {
                'date_from': date_from.isoformat(),
                'date_to': date_to.isoformat(),
                'total_days': (date_to - date_from).days + 1
            },
            'scope': {
                'total_rooms': len(rooms),
                'property_id': property_id
            },
            'impact': {
                'total_room_days': total_room_days,
                'restricted_room_days': restricted_room_days,
                'available_room_days': total_room_days - restricted_room_days,
                'restriction_impact_rate': round(restriction_impact_rate, 2)
            },
            'restriction_types': restriction_types_count
        }

    # ✅ NOVO: MÉTODOS DE LIMPEZA AUTOMÁTICA PARA DADOS ÓRFÃOS

    def cleanup_orphaned_availabilities(
        self, 
        room_id: int, 
        tenant_id: int,
        date_from: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Remove disponibilidades órfãs de um quarto específico.
        Usado quando um quarto é excluído.
        """
        try:
            # Definir data mínima (hoje se não especificado)
            if not date_from:
                date_from = date.today()
            
            # Buscar disponibilidades futuras órfãs
            orphaned_availabilities = self.db.query(RoomAvailability).filter(
                RoomAvailability.room_id == room_id,
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True
            ).all()
            
            availabilities_count = len(orphaned_availabilities)
            if availabilities_count == 0:
                logger.debug(f"Nenhuma disponibilidade órfã encontrada para quarto {room_id}")
                return {
                    "success": True,
                    "availabilities_cleaned": 0,
                    "message": "Nenhuma disponibilidade órfã encontrada"
                }
            
            # Desativar todas as disponibilidades órfãs
            for availability in orphaned_availabilities:
                availability.is_active = False
                availability.sync_pending = True  # Marcar para sincronização de remoção
                availability.updated_at = datetime.utcnow()
                logger.debug(f"Disponibilidade {availability.id} desativada (room_id: {room_id}, date: {availability.date})")
            
            self.db.commit()
            
            # ✅ SSE: Notificar limpeza
            self._notify_pending_count_updated(tenant_id)
            
            logger.info(f"Removidas {availabilities_count} disponibilidades órfãs para quarto {room_id}")
            return {
                "success": True,
                "availabilities_cleaned": availabilities_count,
                "message": f"Removidas {availabilities_count} disponibilidades órfãs"
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao limpar disponibilidades órfãs do quarto {room_id}: {e}")
            return {
                "success": False,
                "availabilities_cleaned": 0,
                "error": str(e),
                "message": f"Erro ao limpar disponibilidades: {str(e)}"
            }

    def cleanup_all_orphaned_availabilities(
        self, 
        tenant_id: int,
        date_from: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Limpa todas as disponibilidades órfãs do tenant.
        Usado para limpeza geral do sistema.
        """
        try:
            # Definir data mínima (hoje se não especificado)
            if not date_from:
                date_from = date.today()
            
            # Buscar disponibilidades que referenciam quartos inativos
            orphaned_availabilities = self.db.query(RoomAvailability).outerjoin(Room).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True,
                # Quarto não existe ou está inativo
                (Room.id.is_(None)) | (Room.is_active == False)
            ).all()
            
            availabilities_count = len(orphaned_availabilities)
            if availabilities_count == 0:
                logger.debug(f"Nenhuma disponibilidade órfã encontrada para tenant {tenant_id}")
                return {
                    "success": True,
                    "availabilities_cleaned": 0,
                    "message": "Nenhuma disponibilidade órfã encontrada"
                }
            
            # Desativar todas as disponibilidades órfãs
            for availability in orphaned_availabilities:
                availability.is_active = False
                availability.sync_pending = True
                availability.updated_at = datetime.utcnow()
                logger.debug(f"Disponibilidade órfã {availability.id} desativada")
            
            self.db.commit()
            
            # ✅ SSE: Notificar limpeza
            self._notify_pending_count_updated(tenant_id)
            
            logger.info(f"Limpeza completa: removidas {availabilities_count} disponibilidades órfãs do tenant {tenant_id}")
            return {
                "success": True,
                "availabilities_cleaned": availabilities_count,
                "message": f"Limpeza concluída: {availabilities_count} disponibilidades órfãs removidas"
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro na limpeza completa de disponibilidades órfãs do tenant {tenant_id}: {e}")
            return {
                "success": False,
                "availabilities_cleaned": 0,
                "error": str(e),
                "message": f"Erro na limpeza: {str(e)}"
            }

    def get_orphaned_availabilities_report(
        self, 
        tenant_id: int,
        date_from: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Gera relatório de disponibilidades órfãs.
        Útil para análise e auditoria.
        """
        try:
            # Definir data mínima (hoje se não especificado)
            if not date_from:
                date_from = date.today()
            
            # Disponibilidades órfãs (quartos inexistentes ou inativos)
            orphaned_query = self.db.query(RoomAvailability).outerjoin(Room).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True,
                (Room.id.is_(None)) | (Room.is_active == False)
            )
            
            orphaned_availabilities = orphaned_query.all()
            
            # Disponibilidades com erros de sincronização
            error_availabilities = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True,
                RoomAvailability.wubook_sync_error.isnot(None)
            ).count()
            
            # Disponibilidades pendentes de sincronização
            pending_sync = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True,
                RoomAvailability.sync_pending == True
            ).count()
            
            # Total de disponibilidades ativas
            total_active = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date_from,
                RoomAvailability.is_active == True
            ).count()
            
            return {
                "date_from": date_from.isoformat(),
                "total_active_availabilities": total_active,
                "orphaned_availabilities": len(orphaned_availabilities),
                "error_availabilities": error_availabilities,
                "pending_sync": pending_sync,
                "orphaned_details": [
                    {
                        "availability_id": a.id,
                        "room_id": a.room_id,
                        "date": a.date.isoformat(),
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                        "last_sync_error": a.wubook_sync_error
                    }
                    for a in orphaned_availabilities[:50]  # Limitar a 50 para performance
                ],
                "health_score": round(
                    (total_active - len(orphaned_availabilities) - error_availabilities) / max(total_active, 1) * 100, 2
                )
            }
            
        except Exception as e:
            logger.error(f"Erro ao gerar relatório de disponibilidades órfãs: {e}")
            return {
                "error": str(e),
                "date_from": date_from.isoformat() if date_from else None,
                "total_active_availabilities": 0,
                "orphaned_availabilities": 0,
                "error_availabilities": 0,
                "pending_sync": 0,
                "orphaned_details": [],
                "health_score": 0.0
            }

    def _apply_filters(self, query, tenant_id: int, filters: RoomAvailabilityFilters):
        """Aplica filtros na query"""
        query = query.filter(
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        )
        
        if filters.room_id:
            query = query.filter(RoomAvailability.room_id == filters.room_id)
        
        if filters.property_id:
            query = query.filter(Property.id == filters.property_id)
        
        if filters.room_type_id:
            query = query.filter(RoomType.id == filters.room_type_id)
        
        if filters.date_from:
            query = query.filter(RoomAvailability.date >= filters.date_from)
        
        if filters.date_to:
            query = query.filter(RoomAvailability.date <= filters.date_to)
        
        # Filtros de status
        if filters.is_available is not None:
            query = query.filter(RoomAvailability.is_available == filters.is_available)
        
        if filters.is_blocked is not None:
            query = query.filter(RoomAvailability.is_blocked == filters.is_blocked)
        
        if filters.is_out_of_order is not None:
            query = query.filter(RoomAvailability.is_out_of_order == filters.is_out_of_order)
        
        if filters.is_maintenance is not None:
            query = query.filter(RoomAvailability.is_maintenance == filters.is_maintenance)
        
        if filters.is_reserved is not None:
            query = query.filter(RoomAvailability.is_reserved == filters.is_reserved)
        
        if filters.closed_to_arrival is not None:
            query = query.filter(RoomAvailability.closed_to_arrival == filters.closed_to_arrival)
        
        if filters.closed_to_departure is not None:
            query = query.filter(RoomAvailability.closed_to_departure == filters.closed_to_departure)
        
        # Filtros de preço
        if filters.has_rate_override is not None:
            if filters.has_rate_override:
                query = query.filter(RoomAvailability.rate_override.isnot(None))
            else:
                query = query.filter(RoomAvailability.rate_override.is_(None))
        
        if filters.min_rate:
            query = query.filter(RoomAvailability.rate_override >= filters.min_rate)
        
        if filters.max_rate:
            query = query.filter(RoomAvailability.rate_override <= filters.max_rate)
        
        # Busca textual
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    Room.name.ilike(search_term),
                    Room.room_number.ilike(search_term),
                    RoomAvailability.reason.ilike(search_term),
                    RoomAvailability.notes.ilike(search_term)
                )
            )
        
        return query