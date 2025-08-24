# backend/app/services/reservation_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, not_
from fastapi import Request
from datetime import datetime, date
from decimal import Decimal

from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.user import User
from app.schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationFilters,
    CheckInRequest, CheckOutRequest, CancelReservationRequest,
    AvailabilityRequest, AvailabilityResponse
)
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext


class ReservationService:
    """Serviço para operações com reservas"""
    
    def __init__(self, db: Session):
        self.db = db

    def generate_reservation_number(self, tenant_id: int) -> str:
        """Gera número único de reserva"""
        year = datetime.now().year
        
        # Contar reservas do ano atual
        count = self.db.query(func.count(Reservation.id)).filter(
            Reservation.tenant_id == tenant_id,
            func.extract('year', Reservation.created_at) == year
        ).scalar()
        
        sequence = count + 1
        return f"RES-{year}-{sequence:06d}"

    def get_reservation_by_id(self, reservation_id: int, tenant_id: int) -> Optional[Reservation]:
        """Busca reserva por ID dentro do tenant"""
        return self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()

    def get_reservation_by_number(self, reservation_number: str, tenant_id: int) -> Optional[Reservation]:
        """Busca reserva por número dentro do tenant"""
        return self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.reservation_number == reservation_number,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()

    def check_room_availability(
        self, 
        room_ids: List[int], 
        check_in_date: date, 
        check_out_date: date, 
        tenant_id: int,
        exclude_reservation_id: Optional[int] = None
    ) -> Dict[int, bool]:
        """
        Verifica disponibilidade de quartos específicos em um período.
        Retorna dict {room_id: is_available}
        """
        # Buscar reservas que conflitam no período
        conflicts_query = self.db.query(ReservationRoom).join(Reservation).filter(
            ReservationRoom.room_id.in_(room_ids),
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True,
            Reservation.status.in_(['confirmed', 'checked_in']),
            not_(
                or_(
                    ReservationRoom.check_out_date <= check_in_date,
                    ReservationRoom.check_in_date >= check_out_date
                )
            )
        )
        
        # Excluir reserva específica se fornecida (para updates)
        if exclude_reservation_id:
            conflicts_query = conflicts_query.filter(
                Reservation.id != exclude_reservation_id
            )
        
        conflicting_room_ids = set(r.room_id for r in conflicts_query.all())
        
        # Montar resultado
        availability = {}
        for room_id in room_ids:
            availability[room_id] = room_id not in conflicting_room_ids
        
        return availability

    def get_available_rooms(
        self, 
        property_id: int, 
        check_in_date: date, 
        check_out_date: date, 
        tenant_id: int,
        room_type_id: Optional[int] = None,
        exclude_reservation_id: Optional[int] = None
    ) -> List[Room]:
        """Busca quartos disponíveis em uma propriedade para um período"""
        
        # Query base dos quartos
        rooms_query = self.db.query(Room).options(
            joinedload(Room.room_type)
        ).filter(
            Room.property_id == property_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True,
            Room.is_operational == True,
            Room.is_out_of_order == False
        )
        
        # Filtrar por tipo se especificado
        if room_type_id:
            rooms_query = rooms_query.filter(Room.room_type_id == room_type_id)
        
        all_rooms = rooms_query.all()
        room_ids = [r.id for r in all_rooms]
        
        # Verificar disponibilidade
        availability = self.check_room_availability(
            room_ids, check_in_date, check_out_date, tenant_id, exclude_reservation_id
        )
        
        # Retornar apenas quartos disponíveis
        return [room for room in all_rooms if availability.get(room.id, False)]

    def check_availability(self, availability_request: AvailabilityRequest, tenant_id: int) -> AvailabilityResponse:
        """Verifica disponibilidade geral para uma consulta"""
        
        available_rooms = self.get_available_rooms(
            property_id=availability_request.property_id,
            check_in_date=availability_request.check_in_date,
            check_out_date=availability_request.check_out_date,
            tenant_id=tenant_id,
            room_type_id=availability_request.room_type_id
        )
        
        # Buscar reservas conflitantes (para informação) - apenas reservation_number
        conflicts_query = self.db.query(Reservation.reservation_number).join(ReservationRoom).filter(
            Reservation.property_id == availability_request.property_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True,
            Reservation.status.in_(['confirmed', 'checked_in']),
            not_(
                or_(
                    ReservationRoom.check_out_date <= availability_request.check_in_date,
                    ReservationRoom.check_in_date >= availability_request.check_out_date
                )
            )
        ).distinct()

        conflicting_reservations = [r[0] for r in conflicts_query.all()]
        
        # Preparar dados dos quartos disponíveis
        rooms_data = []
        for room in available_rooms:
            rooms_data.append({
                'id': room.id,
                'room_number': room.room_number,
                'name': room.name,
                'room_type_id': room.room_type_id,
                'room_type_name': room.room_type.name if room.room_type else None,
                'max_occupancy': room.effective_max_occupancy,
                'floor': room.floor,
                'building': room.building
            })
        
        return AvailabilityResponse(
            available=len(available_rooms) > 0,
            available_rooms=rooms_data,
            total_available_rooms=len(available_rooms),
            conflicting_reservations=conflicting_reservations if conflicting_reservations else None
        )

    def get_reservations(
        self, 
        tenant_id: int, 
        filters: Optional[ReservationFilters] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[Reservation]:
        """Lista reservas com filtros opcionais"""
        query = self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            joinedload(Reservation.reservation_rooms)
        ).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        )
        
        if filters:
            if filters.status:
                query = query.filter(Reservation.status == filters.status)
            
            if filters.source:
                query = query.filter(Reservation.source == filters.source)
            
            if filters.property_id:
                query = query.filter(Reservation.property_id == filters.property_id)
            
            if filters.guest_id:
                query = query.filter(Reservation.guest_id == filters.guest_id)
            
            # Filtros de data
            if filters.check_in_from:
                query = query.filter(Reservation.check_in_date >= filters.check_in_from)
            if filters.check_in_to:
                query = query.filter(Reservation.check_in_date <= filters.check_in_to)
            if filters.check_out_from:
                query = query.filter(Reservation.check_out_date >= filters.check_out_from)
            if filters.check_out_to:
                query = query.filter(Reservation.check_out_date <= filters.check_out_to)
            
            # Filtros de criação
            if filters.created_from:
                query = query.filter(Reservation.created_at >= filters.created_from)
            if filters.created_to:
                query = query.filter(Reservation.created_at <= filters.created_to)
            
            # Filtros financeiros
            if filters.min_amount:
                query = query.filter(Reservation.total_amount >= filters.min_amount)
            if filters.max_amount:
                query = query.filter(Reservation.total_amount <= filters.max_amount)
            
            # Filtros boolean
            if filters.is_paid is not None:
                if filters.is_paid:
                    query = query.filter(Reservation.paid_amount >= Reservation.total_amount)
                else:
                    query = query.filter(Reservation.paid_amount < Reservation.total_amount)
            
            if filters.requires_deposit is not None:
                query = query.filter(Reservation.requires_deposit == filters.requires_deposit)
            
            if filters.is_group_reservation is not None:
                query = query.filter(Reservation.is_group_reservation == filters.is_group_reservation)
            
            # Busca textual
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.join(Guest).filter(
                    or_(
                        Reservation.reservation_number.ilike(search_term),
                        Guest.first_name.ilike(search_term),
                        Guest.last_name.ilike(search_term),
                        Guest.email.ilike(search_term),
                        Reservation.internal_notes.ilike(search_term)
                    )
                )
        
        return query.order_by(Reservation.created_at.desc()).offset(skip).limit(limit).all()

    def count_reservations(self, tenant_id: int, filters: Optional[ReservationFilters] = None) -> int:
        """Conta total de reservas (para paginação)"""
        query = self.db.query(func.count(Reservation.id)).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        )
        
        # Aplicar mesmos filtros da busca (versão simplificada)
        if filters:
            if filters.status:
                query = query.filter(Reservation.status == filters.status)
            if filters.property_id:
                query = query.filter(Reservation.property_id == filters.property_id)
            if filters.guest_id:
                query = query.filter(Reservation.guest_id == filters.guest_id)
            if filters.check_in_from:
                query = query.filter(Reservation.check_in_date >= filters.check_in_from)
            if filters.check_in_to:
                query = query.filter(Reservation.check_in_date <= filters.check_in_to)
        
        return query.scalar()

    def create_reservation(
        self, 
        reservation_data: ReservationCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Reservation:
        """Cria nova reserva com auditoria automática"""
        
        # Validar se guest existe no tenant
        guest = self.db.query(Guest).filter(
            Guest.id == reservation_data.guest_id,
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        ).first()
        
        if not guest:
            raise ValueError("Hóspede não encontrado neste tenant")

        # Validar se propriedade existe no tenant
        property_obj = self.db.query(Property).filter(
            Property.id == reservation_data.property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise ValueError("Propriedade não encontrada neste tenant")

        # Verificar disponibilidade dos quartos
        room_ids = [room.room_id for room in reservation_data.rooms]
        availability = self.check_room_availability(
            room_ids, 
            reservation_data.check_in_date, 
            reservation_data.check_out_date, 
            tenant_id
        )
        
        unavailable_rooms = [room_id for room_id, available in availability.items() if not available]
        if unavailable_rooms:
            raise ValueError(f"Quartos não disponíveis no período: {unavailable_rooms}")

        # Gerar número da reserva
        reservation_number = self.generate_reservation_number(tenant_id)
        
        # Calcular total_guests
        total_guests = reservation_data.adults + reservation_data.children

        # Criar reserva principal
        db_reservation = Reservation(
            reservation_number=reservation_number,
            guest_id=reservation_data.guest_id,
            property_id=reservation_data.property_id,
            check_in_date=reservation_data.check_in_date,
            check_out_date=reservation_data.check_out_date,
            adults=reservation_data.adults,
            children=reservation_data.children,
            total_guests=total_guests,
            room_rate=reservation_data.room_rate,
            total_amount=reservation_data.total_amount,
            discount=reservation_data.discount,
            taxes=reservation_data.taxes,
            source=reservation_data.source,
            source_reference=reservation_data.source_reference,
            guest_requests=reservation_data.guest_requests,
            internal_notes=reservation_data.internal_notes,
            preferences=reservation_data.preferences,
            extra_data=reservation_data.extra_data,
            is_group_reservation=reservation_data.is_group_reservation,
            requires_deposit=reservation_data.requires_deposit,
            tenant_id=tenant_id
        )

        try:
            self.db.add(db_reservation)
            self.db.flush()  # Para obter o ID

            # Criar vínculos com quartos
            for room_data in reservation_data.rooms:
                reservation_room = ReservationRoom(
                    reservation_id=db_reservation.id,
                    room_id=room_data.room_id,
                    check_in_date=room_data.check_in_date,
                    check_out_date=room_data.check_out_date,
                    rate_per_night=room_data.rate_per_night,
                    notes=room_data.notes
                )
                
                # Calcular total_amount do quarto se rate_per_night fornecido
                if room_data.rate_per_night:
                    nights = (room_data.check_out_date - room_data.check_in_date).days
                    reservation_room.total_amount = room_data.rate_per_night * nights
                
                self.db.add(reservation_room)
            
            self.db.commit()
            self.db.refresh(db_reservation)
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                new_values = _extract_model_data(db_reservation)
                audit.log_create(
                    "reservations", 
                    db_reservation.id, 
                    new_values, 
                    f"Reserva '{db_reservation.reservation_number}' criada para {guest.full_name}"
                )
            
            return db_reservation
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar reserva - dados duplicados ou conflito")

    def update_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int, 
        reservation_data: ReservationUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """Atualiza reserva com auditoria automática"""
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(reservation_obj)

        # Verificar se reserva pode ser modificada
        if reservation_obj.status in ['checked_out', 'cancelled']:
            raise ValueError("Não é possível modificar reservas finalizadas ou canceladas")

        # Verificar dados que serão atualizados
        update_data = reservation_data.dict(exclude_unset=True)

        # Validações específicas para update
        if 'guest_id' in update_data:
            guest = self.db.query(Guest).filter(
                Guest.id == update_data['guest_id'],
                Guest.tenant_id == tenant_id,
                Guest.is_active == True
            ).first()
            if not guest:
                raise ValueError("Hóspede não encontrado")

        # Se as datas mudaram, verificar disponibilidade
        dates_changed = 'check_in_date' in update_data or 'check_out_date' in update_data
        if dates_changed:
            new_check_in = update_data.get('check_in_date', reservation_obj.check_in_date)
            new_check_out = update_data.get('check_out_date', reservation_obj.check_out_date)
            
            # Verificar disponibilidade dos quartos atuais no novo período
            current_room_ids = [rr.room_id for rr in reservation_obj.reservation_rooms]
            availability = self.check_room_availability(
                current_room_ids, new_check_in, new_check_out, tenant_id, reservation_id
            )
            
            unavailable_rooms = [room_id for room_id, available in availability.items() if not available]
            if unavailable_rooms:
                raise ValueError(f"Quartos não disponíveis no novo período: {unavailable_rooms}")

        # Atualizar campos de hóspedes se necessário
        if 'adults' in update_data or 'children' in update_data:
            adults = update_data.get('adults', reservation_obj.adults)
            children = update_data.get('children', reservation_obj.children)
            update_data['total_guests'] = adults + children

        # Aplicar alterações apenas nos campos fornecidos
        for field, value in update_data.items():
            if hasattr(reservation_obj, field):
                setattr(reservation_obj, field, value)

        # Atualizar datas dos quartos se as datas da reserva mudaram
        if dates_changed:
            for reservation_room in reservation_obj.reservation_rooms:
                reservation_room.check_in_date = reservation_obj.check_in_date
                reservation_room.check_out_date = reservation_obj.check_out_date

        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(reservation_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "reservations", 
                    reservation_obj.id, 
                    old_values, 
                    new_values,
                    f"Reserva '{reservation_obj.reservation_number}' atualizada"
                )
            
            return reservation_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar reserva")

    def confirm_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """Confirma uma reserva pendente"""
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            return None

        if reservation_obj.status != 'pending':
            raise ValueError("Apenas reservas pendentes podem ser confirmadas")

        old_values = _extract_model_data(reservation_obj)
        
        reservation_obj.status = 'confirmed'
        reservation_obj.confirmed_date = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(reservation_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "reservations", 
                    reservation_obj.id, 
                    old_values, 
                    new_values,
                    f"Reserva '{reservation_obj.reservation_number}' confirmada"
                )
            
            return reservation_obj
            
        except Exception:
            self.db.rollback()
            return None

    def check_in_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        check_in_request: CheckInRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """Realiza check-in da reserva"""
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            return None

        if not reservation_obj.can_check_in:
            raise ValueError("Check-in não permitido para esta reserva")

        old_values = _extract_model_data(reservation_obj)
        
        reservation_obj.status = 'checked_in'
        reservation_obj.checked_in_date = check_in_request.actual_check_in_time or datetime.utcnow()
        
        if check_in_request.notes:
            current_notes = reservation_obj.internal_notes or ""
            reservation_obj.internal_notes = f"{current_notes}\nCheck-in: {check_in_request.notes}".strip()
        
        # Atualizar status dos quartos
        for reservation_room in reservation_obj.reservation_rooms:
            reservation_room.status = 'occupied'
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(reservation_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "reservations", 
                    reservation_obj.id, 
                    old_values, 
                    new_values,
                    f"Check-in realizado para reserva '{reservation_obj.reservation_number}'"
                )
            
            return reservation_obj
            
        except Exception:
            self.db.rollback()
            return None

    def check_out_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        check_out_request: CheckOutRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """Realiza check-out da reserva"""
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            return None

        if not reservation_obj.can_check_out:
            raise ValueError("Check-out não permitido para esta reserva")

        old_values = _extract_model_data(reservation_obj)
        
        reservation_obj.status = 'checked_out'
        reservation_obj.checked_out_date = check_out_request.actual_check_out_time or datetime.utcnow()
        
        # Adicionar taxas finais se especificadas
        if check_out_request.final_charges:
            current_total = reservation_obj.total_amount or Decimal('0')
            reservation_obj.total_amount = current_total + check_out_request.final_charges
        
        if check_out_request.notes:
            current_notes = reservation_obj.internal_notes or ""
            reservation_obj.internal_notes = f"{current_notes}\nCheck-out: {check_out_request.notes}".strip()
        
        # Atualizar status dos quartos
        for reservation_room in reservation_obj.reservation_rooms:
            reservation_room.status = 'checked_out'
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(reservation_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "reservations", 
                    reservation_obj.id, 
                    old_values, 
                    new_values,
                    f"Check-out realizado para reserva '{reservation_obj.reservation_number}'"
                )
            
            return reservation_obj
            
        except Exception:
            self.db.rollback()
            return None

    def cancel_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        cancel_request: CancelReservationRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """Cancela uma reserva"""
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            return None

        if not reservation_obj.can_cancel:
            raise ValueError("Esta reserva não pode ser cancelada")

        old_values = _extract_model_data(reservation_obj)
        
        reservation_obj.status = 'cancelled'
        reservation_obj.cancelled_date = datetime.utcnow()
        reservation_obj.cancellation_reason = cancel_request.cancellation_reason
        
        # Processar reembolso se especificado
        if cancel_request.refund_amount:
            reservation_obj.paid_amount = max(
                Decimal('0'), 
                reservation_obj.paid_amount - cancel_request.refund_amount
            )
        
        if cancel_request.notes:
            current_notes = reservation_obj.internal_notes or ""
            reservation_obj.internal_notes = f"{current_notes}\nCancelamento: {cancel_request.notes}".strip()
        
        # Atualizar status dos quartos
        for reservation_room in reservation_obj.reservation_rooms:
            reservation_room.status = 'cancelled'
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(reservation_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "reservations", 
                    reservation_obj.id, 
                    old_values, 
                    new_values,
                    f"Reserva '{reservation_obj.reservation_number}' cancelada: {cancel_request.cancellation_reason}"
                )
            
            return reservation_obj
            
        except Exception:
            self.db.rollback()
            return None

    def get_reservations_by_date_range(
        self, 
        tenant_id: int, 
        start_date: date, 
        end_date: date,
        property_id: Optional[int] = None,
        status_filter: Optional[List[str]] = None
    ) -> List[Reservation]:
        """Busca reservas em um período (para calendários)"""
        
        query = self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True,
            not_(
                or_(
                    Reservation.check_out_date <= start_date,
                    Reservation.check_in_date >= end_date
                )
            )
        )
        
        if property_id:
            query = query.filter(Reservation.property_id == property_id)
        
        if status_filter:
            query = query.filter(Reservation.status.in_(status_filter))
        
        return query.order_by(Reservation.check_in_date).all()

    def get_reservation_stats(self, tenant_id: int, property_id: Optional[int] = None) -> Dict[str, Any]:
        """Obtém estatísticas das reservas"""
        query = self.db.query(Reservation).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            query = query.filter(Reservation.property_id == property_id)

        # Estatísticas por status
        stats_by_status = query.with_entities(
            Reservation.status,
            func.count(Reservation.id)
        ).group_by(Reservation.status).all()
        
        status_counts = {status: count for status, count in stats_by_status}
        
        # Reservas hoje
        today = date.today()
        arrivals_today = query.filter(Reservation.check_in_date == today).count()
        departures_today = query.filter(Reservation.check_out_date == today).count()
        current_guests = query.filter(Reservation.status == 'checked_in').count()
        
        # Receita
        revenue_query = query.filter(Reservation.status.in_(['checked_out', 'checked_in']))
        total_revenue = revenue_query.with_entities(
            func.coalesce(func.sum(Reservation.paid_amount), 0)
        ).scalar()
        
        pending_revenue = query.filter(
            Reservation.status.in_(['confirmed', 'checked_in'])
        ).with_entities(
            func.coalesce(func.sum(Reservation.total_amount - Reservation.paid_amount), 0)
        ).scalar()

        return {
            'total_reservations': sum(status_counts.values()),
            'status_counts': status_counts,
            'arrivals_today': arrivals_today,
            'departures_today': departures_today,
            'current_guests': current_guests,
            'total_revenue': float(total_revenue or 0),
            'pending_revenue': float(pending_revenue or 0)
        }