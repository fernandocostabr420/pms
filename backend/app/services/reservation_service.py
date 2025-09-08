# backend/app/services/reservation_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, not_, desc
from fastapi import Request, HTTPException, status
from datetime import datetime, date
from decimal import Decimal

from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationFilters,
    CheckInRequest, CheckOutRequest, CancelReservationRequest,
    AvailabilityRequest, AvailabilityResponse
)
from app.services.guest_service import GuestService
from app.schemas.guest import GuestCheckInData, GuestUpdate

from app.services.audit_service import AuditService
from app.schemas.reservation import ReservationDetailedResponse

# ✅ NOVOS IMPORTS PARA AUDITORIA AUTOMÁTICA
from app.utils.decorators import (
    audit_operation, 
    auto_audit_update, 
    AuditContext, 
    _extract_model_data,
    create_audit_log
)
from app.services.audit_formatting_service import AuditFormattingService


class ReservationService:
    """Serviço para operações com reservas - COM AUDITORIA COMPLETA"""
    
    def __init__(self, db: Session):
        self.db = db
        # ✅ ADICIONADO: Serviço de formatação de auditoria
        self.audit_formatter = AuditFormattingService()

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
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),
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
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),
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
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
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

    # ✅ MÉTODO CREATE_RESERVATION COM AUDITORIA AUTOMÁTICA
    @audit_operation("reservations", "CREATE", "Nova reserva criada")
    def create_reservation(
        self, 
        reservation_data: ReservationCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Reservation:
        """
        Cria nova reserva com auditoria automática.
        O decorador @audit_operation captura automaticamente todos os dados da reserva criada.
        """
        
        # Validar se guest existe no tenant
        guest = self.db.query(Guest).filter(
            Guest.id == reservation_data.guest_id,
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        ).first()
        
        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hóspede não encontrado neste tenant"
            )

        # Validar se propriedade existe no tenant
        property_obj = self.db.query(Property).filter(
            Property.id == reservation_data.property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada neste tenant"
            )

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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quartos não disponíveis no período: {unavailable_rooms}"
            )

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
            
            # ✅ AUDITORIA AUTOMÁTICA PELO DECORADOR
            # Vai registrar: guest_id, property_id, dates, amounts, status='pending', etc.
            
            return db_reservation
            
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro ao criar reserva - dados duplicados ou conflito"
            )

    # ✅ MÉTODO UPDATE_RESERVATION COM AUDITORIA AUTOMÁTICA - CORRIGIDO COMPLETO
    @auto_audit_update("reservations", "Reserva atualizada")
    def update_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int, 
        reservation_data: ReservationUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """
        Atualiza reserva com auditoria automática.
        O decorador @auto_audit_update captura valores antes/depois automaticamente.
        """
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )

        # Verificar se reserva pode ser modificada
        if reservation_obj.status in ['checked_out', 'cancelled']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível modificar reservas finalizadas ou canceladas"
            )

        # Verificar dados que serão atualizados
        update_data = reservation_data.dict(exclude_unset=True)
        print(f"🔄 Dados recebidos para atualização: {update_data}")

        # Validações específicas para update
        if 'guest_id' in update_data:
            guest = self.db.query(Guest).filter(
                Guest.id == update_data['guest_id'],
                Guest.tenant_id == tenant_id,
                Guest.is_active == True
            ).first()
            if not guest:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Hóspede não encontrado"
                )

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
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quartos não disponíveis no novo período: {unavailable_rooms}"
                )

        # ✅ PROCESSAR ATUALIZAÇÃO DE QUARTOS ANTES DOS CAMPOS BÁSICOS
        rooms_updated = False
        if 'rooms' in update_data and update_data['rooms'] is not None:
            print(f"🔄 Atualizando quartos da reserva {reservation_id}")
            print(f"📊 Quartos atuais: {[rr.room_id for rr in reservation_obj.reservation_rooms]}")
            print(f"📊 Novos quartos: {[r['room_id'] for r in update_data['rooms']]}")
            
            # Verificar disponibilidade dos novos quartos
            new_room_ids = [room_data['room_id'] for room_data in update_data['rooms']]
            check_in_date = update_data.get('check_in_date', reservation_obj.check_in_date)
            check_out_date = update_data.get('check_out_date', reservation_obj.check_out_date)
            
            availability = self.check_room_availability(
                new_room_ids, check_in_date, check_out_date, tenant_id, reservation_id
            )
            
            unavailable_rooms = [room_id for room_id, available in availability.items() if not available]
            if unavailable_rooms:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Novos quartos não disponíveis no período: {unavailable_rooms}"
                )
            
            # Remover quartos existentes
            for existing_room in reservation_obj.reservation_rooms:
                self.db.delete(existing_room)
            
            # Criar novos vínculos de quartos
            for room_data in update_data['rooms']:
                reservation_room = ReservationRoom(
                    reservation_id=reservation_obj.id,
                    room_id=room_data['room_id'],
                    check_in_date=room_data.get('check_in_date', check_in_date),
                    check_out_date=room_data.get('check_out_date', check_out_date),
                    rate_per_night=room_data.get('rate_per_night'),
                    notes=room_data.get('notes')
                )
                
                # Calcular total_amount do quarto se rate_per_night fornecido
                if room_data.get('rate_per_night'):
                    nights = (reservation_room.check_out_date - reservation_room.check_in_date).days
                    reservation_room.total_amount = room_data['rate_per_night'] * nights
                
                self.db.add(reservation_room)
            
            rooms_updated = True
            print(f"✅ Quartos atualizados: {[r['room_id'] for r in update_data['rooms']]}")
            
            # ✅ IMPORTANTE: Remover 'rooms' do update_data para não processar no loop básico
            del update_data['rooms']

        # Atualizar campos de hóspedes se necessário
        if 'adults' in update_data or 'children' in update_data:
            adults = update_data.get('adults', reservation_obj.adults)
            children = update_data.get('children', reservation_obj.children)
            update_data['total_guests'] = adults + children

        # ✅ APLICAR ALTERAÇÕES APENAS NOS CAMPOS BÁSICOS DA RESERVA
        for field, value in update_data.items():
            if hasattr(reservation_obj, field):
                print(f"📝 Atualizando campo {field}: {getattr(reservation_obj, field)} → {value}")
                setattr(reservation_obj, field, value)

        # Atualizar datas dos quartos se as datas da reserva mudaram (apenas se não atualizamos os quartos)
        if dates_changed and not rooms_updated:
            for reservation_room in reservation_obj.reservation_rooms:
                reservation_room.check_in_date = reservation_obj.check_in_date
                reservation_room.check_out_date = reservation_obj.check_out_date

        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # ✅ AUDITORIA AUTOMÁTICA PELO DECORADOR
            # Vai mostrar: "Total: R$ 150,00 → R$ 180,00", "Check-in: 15/09 → 16/09", "Quartos: [1] → [2]", etc.
            
            print(f"✅ Reserva {reservation_id} atualizada com sucesso")
            if rooms_updated:
                print(f"✅ Quartos da reserva também foram atualizados")
            
            return reservation_obj
            
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro ao atualizar reserva"
            )

    # ✅ MÉTODO CONFIRM_RESERVATION COM AUDITORIA AUTOMÁTICA
    @auto_audit_update("reservations", "Reserva confirmada")
    def confirm_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """
        Confirma uma reserva pendente.
        Auditoria automática vai capturar: Status: "pending" → "confirmed"
        """
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )

        if reservation_obj.status != 'pending':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apenas reservas pendentes podem ser confirmadas"
            )

        # ✅ ALTERAÇÕES CAPTURADAS AUTOMATICAMENTE PELO DECORADOR
        reservation_obj.status = 'confirmed'
        reservation_obj.confirmed_date = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # ✅ AUDITORIA AUTOMÁTICA: "✅ Reserva confirmada"
            return reservation_obj
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao confirmar reserva"
            )

    # ✅ MÉTODO CHECK_IN COM AUDITORIA AUTOMÁTICA E MANUAL
    @auto_audit_update("reservations", "Check-in realizado")
    def check_in_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        check_in_request: CheckInRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """
        Realiza check-in da reserva com atualização de dados do hóspede.
        Auditoria automática para reserva + manual para dados do hóspede.
        """
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )

        if not reservation_obj.can_check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-in não permitido para esta reserva"
            )

        # ✅ PROCESSAR DADOS DO HÓSPEDE SE FORNECIDOS
        guest_updated = False
        if check_in_request.guest_data:
            try:
                guest_updated = self._process_guest_checkin_data(
                    reservation_obj.guest_id,
                    tenant_id,
                    check_in_request.guest_data,
                    current_user,
                    request
                )
            except Exception as e:
                # Se falhar na atualização do hóspede, abortar check-in
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Erro ao atualizar dados do hóspede: {str(e)}"
                )

        # ✅ ALTERAÇÕES NA RESERVA CAPTURADAS AUTOMATICAMENTE
        reservation_obj.status = 'checked_in'
        reservation_obj.checked_in_date = check_in_request.actual_check_in_time or datetime.utcnow()
        
        # Adicionar notas do check-in
        check_in_notes = []
        if check_in_request.notes:
            check_in_notes.append(f"Check-in: {check_in_request.notes}")
        
        if guest_updated:
            check_in_notes.append("Check-in: Dados do hóspede atualizados")
        
        if check_in_notes:
            current_notes = reservation_obj.internal_notes or ""
            new_notes = "\n".join(check_in_notes)
            reservation_obj.internal_notes = f"{current_notes}\n{new_notes}".strip()
        
        # Atualizar status dos quartos
        for reservation_room in reservation_obj.reservation_rooms:
            reservation_room.status = 'occupied'
        
        try:
            self.db.commit()
            self.db.refresh(reservation_obj)
            
            # ✅ AUDITORIA AUTOMÁTICA: "🏨 Check-in realizado"
            # Vai capturar: Status: "confirmed" → "checked_in", checked_in_date, internal_notes
            
            return reservation_obj
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao realizar check-in"
            )

    def _process_guest_checkin_data(
        self,
        guest_id: int,
        tenant_id: int,
        guest_data: GuestCheckInData,
        current_user: User,
        request: Optional[Request] = None
    ) -> bool:
        """
        Processa e atualiza dados do hóspede durante o check-in
        Retorna True se dados foram atualizados, False caso contrário
        """
        guest_service = GuestService(self.db)
        
        # Buscar o hóspede
        guest = guest_service.get_guest_by_id(guest_id, tenant_id)
        if not guest:
            raise ValueError("Hóspede não encontrado")
        
        # ✅ VALIDAR CAMPOS OBRIGATÓRIOS PARA CHECK-IN
        required_fields = {
            'first_name': guest_data.first_name,
            'last_name': guest_data.last_name,
            'document_number': guest_data.document_number,
            'email': guest_data.email,
            'phone': guest_data.phone
        }
        
        missing_fields = []
        for field_name, field_value in required_fields.items():
            if not field_value or not field_value.strip():
                missing_fields.append(field_name)
        
        if missing_fields:
            field_names = {
                'first_name': 'Nome',
                'last_name': 'Sobrenome', 
                'document_number': 'CPF',
                'email': 'Email',
                'phone': 'Telefone'
            }
            missing_names = [field_names.get(field, field) for field in missing_fields]
            raise ValueError(f"Campos obrigatórios não preenchidos: {', '.join(missing_names)}")
        
        # ✅ PREPARAR DADOS PARA ATUALIZAÇÃO
        # Convertendo GuestCheckInData para GuestUpdate
        update_data = GuestUpdate(
            first_name=guest_data.first_name,
            last_name=guest_data.last_name,
            email=guest_data.email,
            phone=guest_data.phone,
            document_type='cpf',  # Assumindo CPF para check-in brasileiro
            document_number=guest_data.document_number,
            date_of_birth=guest_data.date_of_birth,
            gender=guest_data.gender,
            nationality=guest_data.country or 'Brasil',
            country=guest_data.country or 'Brasil',
            postal_code=guest_data.postal_code,
            state=guest_data.state,
            city=guest_data.city,
            address_line1=guest_data.address_line1,
            address_number=guest_data.address_number,
            address_line2=guest_data.address_line2,
            neighborhood=guest_data.neighborhood
        )
        
        # ✅ VERIFICAR SE REALMENTE PRECISA ATUALIZAR
        # Comparar dados atuais com novos dados
        needs_update = False
        current_data = {
            'first_name': guest.first_name,
            'last_name': guest.last_name,
            'email': guest.email,
            'phone': guest.phone,
            'document_number': guest.document_number,
            'date_of_birth': guest.date_of_birth,
            'gender': getattr(guest, 'gender', None),
            'country': guest.country,
            'postal_code': guest.postal_code,
            'state': guest.state,
            'city': guest.city,
            'address_line1': guest.address_line1,
            'address_number': getattr(guest, 'address_number', None),
            'address_line2': guest.address_line2,
            'neighborhood': getattr(guest, 'neighborhood', None)
        }
        
        new_data = update_data.dict(exclude_unset=True, exclude_none=True)
        
        for field, new_value in new_data.items():
            current_value = current_data.get(field)
            # Comparar valores considerando None e strings vazias como equivalentes
            if (new_value or '').strip() != (current_value or '').strip():
                needs_update = True
                break
        
        # ✅ ATUALIZAR APENAS SE NECESSÁRIO
        if needs_update:
            # ✅ USAR AUDITORIA MANUAL PARA DADOS DO HÓSPEDE
            with AuditContext(self.db, current_user, request) as audit:
                old_guest_data = _extract_model_data(guest)
                
                updated_guest = guest_service.update_guest(
                    guest_id=guest_id,
                    tenant_id=tenant_id,
                    guest_data=update_data,
                    current_user=current_user,
                    request=request
                )
                
                if not updated_guest:
                    raise ValueError("Falha ao atualizar dados do hóspede")
                
                new_guest_data = _extract_model_data(updated_guest)
                
                # Registrar auditoria específica para o check-in
                audit.log_update(
                    table_name="guests",
                    record_id=guest_id,
                    old_values=old_guest_data,
                    new_values=new_guest_data,
                    description="Dados do hóspede atualizados durante check-in"
                )
            
            return True
        
        return False

    # ✅ MÉTODO CHECK_OUT COM AUDITORIA AUTOMÁTICA
    @auto_audit_update("reservations", "Check-out realizado")
    def check_out_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        check_out_request: CheckOutRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """
        Realiza check-out da reserva.
        Auditoria automática vai capturar mudanças de status, datas e valores.
        """
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )

        if not reservation_obj.can_check_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-out não permitido para esta reserva"
            )

        # ✅ ALTERAÇÕES CAPTURADAS AUTOMATICAMENTE
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
            
            # ✅ AUDITORIA AUTOMÁTICA: "🚪 Check-out realizado"
            # Vai capturar: Status, checked_out_date, total_amount (se mudou), internal_notes
            
            return reservation_obj
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao realizar check-out"
            )

    # ✅ MÉTODO CANCEL_RESERVATION COM AUDITORIA AUTOMÁTICA
    @auto_audit_update("reservations", "Reserva cancelada")
    def cancel_reservation(
        self, 
        reservation_id: int, 
        tenant_id: int,
        cancel_request: CancelReservationRequest,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Reservation]:
        """
        Cancela uma reserva.
        Auditoria automática vai capturar cancelamento e motivos.
        """
        
        reservation_obj = self.get_reservation_by_id(reservation_id, tenant_id)
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )

        if not reservation_obj.can_cancel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta reserva não pode ser cancelada"
            )

        # ✅ ALTERAÇÕES CAPTURADAS AUTOMATICAMENTE
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
            
            # ✅ AUDITORIA AUTOMÁTICA: "❌ Reserva cancelada"
            # Vai capturar: Status, cancelled_date, cancellation_reason, paid_amount (se mudou)
            
            return reservation_obj
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao cancelar reserva"
            )

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
            Reservation.status.in_(['pending', 'confirmed', 'checked_in'])
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

    def get_reservation_detailed(self, reservation_id: int, tenant_id: int) -> Optional[Dict[str, Any]]:
        """
        Busca reserva com todos os detalhes para página individual
        Inclui dados expandidos do hóspede, propriedade, quartos, pagamentos e auditoria FORMATADA
        """
        # Buscar reserva com relacionamentos
        reservation = self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room),
            selectinload(Reservation.payments)
        ).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()
        
        if not reservation:
            return None
        
        # === 1. DADOS DO HÓSPEDE EXPANDIDOS ===
        guest_stats = self.db.query(
            func.count(Reservation.id).label('total_reservations'),
            func.sum(Reservation.total_amount).label('total_spent'),
            func.max(Reservation.check_out_date).label('last_stay_date')
        ).filter(
            Reservation.guest_id == reservation.guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()
        
        # Contar status específicos separadamente
        completed_stays = self.db.query(func.count(Reservation.id)).filter(
            Reservation.guest_id == reservation.guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.status == 'checked_out',
            Reservation.is_active == True
        ).scalar() or 0
        
        cancelled_reservations = self.db.query(func.count(Reservation.id)).filter(
            Reservation.guest_id == reservation.guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.status == 'cancelled',
            Reservation.is_active == True
        ).scalar() or 0
        
        # Calcular total de noites manualmente
        guest_reservations = self.db.query(Reservation.check_in_date, Reservation.check_out_date).filter(
            Reservation.guest_id == reservation.guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).all()
        
        total_nights = 0
        for res in guest_reservations:
            if res.check_in_date and res.check_out_date:
                total_nights += (res.check_out_date - res.check_in_date).days
        
        # Endereço completo do hóspede
        guest_address_parts = [
            reservation.guest.address_line1,
            reservation.guest.address_line2,
            reservation.guest.city,
            reservation.guest.state,
            reservation.guest.country
        ]
        guest_full_address = ', '.join([part for part in guest_address_parts if part])
        
        guest_data = {
            'id': reservation.guest.id,
            'first_name': reservation.guest.first_name,
            'last_name': reservation.guest.last_name,
            'full_name': reservation.guest.full_name,
            'email': reservation.guest.email,
            'phone': reservation.guest.phone,
            'document_type': reservation.guest.document_type,
            'document_number': reservation.guest.document_number,
            'date_of_birth': reservation.guest.date_of_birth,
            'nationality': reservation.guest.nationality,
            'address_line1': reservation.guest.address_line1,
            'address_line2': reservation.guest.address_line2,
            'city': reservation.guest.city,
            'state': reservation.guest.state,
            'country': reservation.guest.country,
            'postal_code': reservation.guest.postal_code,
            'full_address': guest_full_address if guest_full_address else None,
            'preferences': reservation.guest.preferences,
            'notes': reservation.guest.notes,
            'marketing_consent': reservation.guest.marketing_consent,
            'total_reservations': int(guest_stats.total_reservations or 0),
            'completed_stays': completed_stays,
            'cancelled_reservations': cancelled_reservations,
            'total_nights': total_nights,
            'last_stay_date': guest_stats.last_stay_date,
            'total_spent': guest_stats.total_spent or Decimal('0.00'),
            'created_at': reservation.guest.created_at,
            'updated_at': reservation.guest.updated_at,
            'is_active': reservation.guest.is_active,
        }
        
        # === 2. DADOS DA PROPRIEDADE EXPANDIDOS ===
        property_address_parts = [
            reservation.property_obj.address_line1,
            reservation.property_obj.address_line2,
            reservation.property_obj.city,
            reservation.property_obj.state,
            reservation.property_obj.country
        ]
        property_full_address = ', '.join([part for part in property_address_parts if part])
        
        property_stats = self.db.query(
            func.count(func.distinct(Room.id)).label('total_rooms'),
            func.count(Reservation.id).label('total_reservations')
        ).select_from(Property)\
         .outerjoin(Room, Property.id == Room.property_id)\
         .outerjoin(Reservation, Property.id == Reservation.property_id)\
         .filter(Property.id == reservation.property_id).first()
        
        property_data = {
            'id': reservation.property_obj.id,
            'name': reservation.property_obj.name,
            'description': reservation.property_obj.description,
            'property_type': reservation.property_obj.property_type,
            'address_line1': reservation.property_obj.address_line1,
            'address_line2': reservation.property_obj.address_line2,
            'city': reservation.property_obj.city,
            'state': reservation.property_obj.state,
            'country': reservation.property_obj.country,
            'postal_code': reservation.property_obj.postal_code,
            'full_address': property_full_address if property_full_address else None,
            'phone': reservation.property_obj.phone,
            'email': reservation.property_obj.email,
            'website': reservation.property_obj.website,
            'total_rooms': property_stats.total_rooms or 0,
            'total_reservations': property_stats.total_reservations or 0,
            'created_at': reservation.property_obj.created_at,
            'updated_at': reservation.property_obj.updated_at,
            'is_active': reservation.property_obj.is_active,
        }
        
        # === 3. DADOS DOS QUARTOS EXPANDIDOS ===
        rooms_data = []
        for res_room in reservation.reservation_rooms:
            room = res_room.room
            nights = (res_room.check_out_date - res_room.check_in_date).days
            
            room_type_name = None
            if room and hasattr(room, 'room_type') and room.room_type:
                room_type_name = room.room_type.name
            
            room_data = {
                'id': room.id if room else res_room.id,
                'room_number': room.room_number if room else f'Room #{res_room.id}',
                'name': getattr(room, 'name', None) if room else None,
                'room_type_id': room.room_type_id if room else None,
                'room_type_name': room_type_name,
                'max_occupancy': (getattr(room, 'max_occupancy', None) if room else None) or 2,
                'floor': getattr(room, 'floor', None) if room else None,
                'building': getattr(room, 'building', None) if room else None,
                'description': getattr(room, 'description', None) if room else None,
                'amenities': getattr(room, 'amenities', None) if room else None,
                'rate_per_night': float(res_room.rate_per_night) if res_room.rate_per_night else None,
                'total_nights': nights,
                'total_amount': float(res_room.total_amount) if res_room.total_amount else None,
                'status': res_room.status,
            }
            rooms_data.append(room_data)
        
        # === 4. DADOS DE PAGAMENTO EXPANDIDOS ===
        balance_due = reservation.balance_due
        deposit_amount = None
        if reservation.requires_deposit and reservation.total_amount:
            deposit_amount = reservation.total_amount * Decimal('0.30')
        
        payment_data = {
            'total_amount': float(reservation.total_amount or Decimal('0.00')),
            'paid_amount': float(reservation.total_paid),
            'balance_due': float(balance_due),
            'discount': float(reservation.discount),
            'taxes': float(reservation.taxes),
            'deposit_required': reservation.requires_deposit,
            'deposit_amount': float(deposit_amount) if deposit_amount else None,
            'deposit_paid': (reservation.total_paid >= deposit_amount) if deposit_amount else False,
            'last_payment_date': None,
            'payment_method_last': None,
            'total_payments': 1 if reservation.paid_amount > 0 else 0,
            'is_overdue': balance_due > 0 and reservation.check_in_date < date.today(),
            'payment_status': reservation.payment_status,
        }
        
        # === 5. AÇÕES CONTEXTUAIS ===
        today = date.today()
        current_status = reservation.status
        
        actions = {
            'can_edit': current_status in ['pending', 'confirmed'],
            'can_confirm': current_status == 'pending',
            'can_check_in': current_status == 'confirmed' and reservation.check_in_date <= today,
            'can_check_out': current_status == 'checked_in',
            'can_cancel': current_status in ['pending', 'confirmed'],
            'can_add_payment': balance_due > 0,
            'can_modify_rooms': current_status in ['pending', 'confirmed'],
            'can_send_confirmation': current_status in ['confirmed', 'pending'],
            'edit_blocked_reason': None if current_status in ['pending', 'confirmed'] else f'Não é possível editar reservas com status: {current_status}',
            'confirm_blocked_reason': None if current_status == 'pending' else f'Reserva já está {current_status}',
            'checkin_blocked_reason': None if (current_status == 'confirmed' and reservation.check_in_date <= today) else 'Check-in ainda não disponível',
            'checkout_blocked_reason': None if current_status == 'checked_in' else 'Hóspede ainda não fez check-in',
            'cancel_blocked_reason': None if current_status in ['pending', 'confirmed'] else f'Não é possível cancelar reservas com status: {current_status}',
        }
        
        # === 6. HISTÓRICO DE AUDITORIA MELHORADO ===
        # ✅ MODIFICADO: Usar o novo serviço de formatação
        payment_ids = [p.id for p in reservation.payments] if reservation.payments else []
        
        audit_logs = self.db.query(AuditLog).options(
            joinedload(AuditLog.user)
        ).filter(
            AuditLog.table_name.in_(['reservations', 'reservation_rooms', 'payments']),
            or_(
                and_(AuditLog.table_name == 'reservations', AuditLog.record_id == reservation.id),
                and_(AuditLog.table_name == 'reservation_rooms', AuditLog.record_id.in_([rr.id for rr in reservation.reservation_rooms])),
                and_(AuditLog.table_name == 'payments', AuditLog.record_id.in_(payment_ids))
            ),
            AuditLog.tenant_id == tenant_id
        ).order_by(desc(AuditLog.created_at)).limit(50).all()
        
        # ✅ NOVO: Usar o serviço de formatação para processar cada log
        audit_history = []
        for log in audit_logs:
            formatted_entry = self.audit_formatter.format_audit_entry(log)
            audit_history.append(formatted_entry)
        
        # === 7. CAMPOS COMPUTADOS ===
        nights = (reservation.check_out_date - reservation.check_in_date).days
        
        # Status display mais amigável
        status_map = {
            'pending': 'Pendente',
            'confirmed': 'Confirmada',
            'checked_in': 'Check-in Feito',
            'checked_out': 'Check-out Feito',
            'cancelled': 'Cancelada',
            'no_show': 'Não Compareceu'
        }
        
        # Calcular dias até check-in ou desde check-out
        days_until_checkin = None
        days_since_checkout = None
        
        if current_status in ['pending', 'confirmed']:
            days_until_checkin = (reservation.check_in_date - today).days
        elif current_status == 'checked_out':
            days_since_checkout = (today - reservation.check_out_date).days
        
        # === 8. MONTAR RESPOSTA FINAL ===
        detailed_response = {
            # Dados básicos
            'id': reservation.id,
            'reservation_number': reservation.reservation_number,
            'status': reservation.status,
            'created_date': reservation.created_date or reservation.created_at,
            'confirmed_date': reservation.confirmed_date,
            'checked_in_date': reservation.checked_in_date,
            'checked_out_date': reservation.checked_out_date,
            'cancelled_date': reservation.cancelled_date,
            'cancellation_reason': reservation.cancellation_reason,
            
            # Período e ocupação
            'check_in_date': reservation.check_in_date,
            'check_out_date': reservation.check_out_date,
            'nights': nights,
            'adults': reservation.adults,
            'children': reservation.children,
            'total_guests': reservation.total_guests,
            
            # Origem e observações
            'source': reservation.source,
            'source_reference': reservation.source_reference,
            'guest_requests': reservation.guest_requests,
            'internal_notes': reservation.internal_notes,
            
            # Flags
            'is_group_reservation': reservation.is_group_reservation,
            'requires_deposit': reservation.requires_deposit,
            
            # Dados relacionados
            'guest': guest_data,
            'property': property_data,
            'rooms': rooms_data,
            'payment': payment_data,
            'actions': actions,
            'audit_history': audit_history,  # ✅ AGORA COM FORMATAÇÃO RICA
            
            # Campos computados
            'status_display': status_map.get(reservation.status, reservation.status),
            'is_current': current_status == 'checked_in',
            'days_until_checkin': days_until_checkin,
            'days_since_checkout': days_since_checkout,
            
            # Metadados
            'created_at': reservation.created_at,
            'updated_at': reservation.updated_at,
            'tenant_id': reservation.tenant_id,
        }
        
        return detailed_response