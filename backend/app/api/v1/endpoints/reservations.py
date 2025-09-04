from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi import status as http_status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_, func, text, desc, asc, not_  # ✅ ADICIONADO not_
from datetime import datetime, date, timedelta
from decimal import Decimal
import math
import logging

from app.core.database import get_db
from app.services.reservation_service import ReservationService
from app.schemas.reservation import (
    ReservationCreate, 
    ReservationUpdate, 
    ReservationResponse, 
    ReservationListResponse,
    ReservationFilters,
    ReservationWithDetails,
    ReservationResponseWithGuestDetails,
    ReservationListResponseWithDetails,
    ReservationExportFilters,
    ReservationExportResponse,
    CheckInRequest,
    CheckOutRequest,
    CancelReservationRequest,
    AvailabilityRequest,
    AvailabilityResponse,
    ReservationRoomResponse,
    ReservationDetailedResponse
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.property import Property
from app.models.room import Room
from app.models.room_type import RoomType
from sqlalchemy import case, distinct
from datetime import timezone

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== ENDPOINT PRINCIPAL =====

@router.get("/", response_model=ReservationListResponse)
def list_reservations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros básicos existentes
    status: Optional[str] = Query(None, description="Filtrar por status"),
    source: Optional[str] = Query(None, description="Filtrar por canal"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    guest_id: Optional[int] = Query(None, description="Filtrar por hóspede"),
    
    # Filtros de data existentes
    check_in_from: Optional[date] = Query(None, description="Check-in a partir de"),
    check_in_to: Optional[date] = Query(None, description="Check-in até"),
    check_out_from: Optional[date] = Query(None, description="Check-out a partir de"),
    check_out_to: Optional[date] = Query(None, description="Check-out até"),
    
    # Correção: Suportar datetime e date para created_from/to
    created_from: Optional[str] = Query(None, description="Criação a partir de (datetime ou date)"),
    created_to: Optional[str] = Query(None, description="Criação até (datetime ou date)"),
    
    # Filtros financeiros existentes
    min_amount: Optional[float] = Query(None, ge=0, description="Valor mínimo"),
    max_amount: Optional[float] = Query(None, ge=0, description="Valor máximo"),
    is_paid: Optional[bool] = Query(None, description="Filtrar por pago"),
    requires_deposit: Optional[bool] = Query(None, description="Exige depósito"),
    is_group_reservation: Optional[bool] = Query(None, description="Reserva em grupo"),
    
    # Busca textual - Principal correção
    search: Optional[str] = Query(None, description="Buscar por nome, email, número reserva"),
    
    # ===== FILTROS EXPANDIDOS =====
    
    # Filtros do hóspede
    guest_email: Optional[str] = Query(None, description="E-mail do hóspede"),
    guest_phone: Optional[str] = Query(None, description="Telefone do hóspede"),
    guest_document_type: Optional[str] = Query(None, description="Tipo de documento"),
    guest_nationality: Optional[str] = Query(None, description="Nacionalidade do hóspede"),
    guest_city: Optional[str] = Query(None, description="Cidade do hóspede"),
    guest_state: Optional[str] = Query(None, description="Estado do hóspede"),
    guest_country: Optional[str] = Query(None, description="País do hóspede"),
    
    # Filtros de data de cancelamento  
    cancelled_from: Optional[date] = Query(None, description="Cancelamento a partir de"),
    cancelled_to: Optional[date] = Query(None, description="Cancelamento até"),
    
    # Filtros de confirmação
    confirmed_from: Optional[datetime] = Query(None, description="Confirmação a partir de"),
    confirmed_to: Optional[datetime] = Query(None, description="Confirmação até"),
    
    # Filtros de check-in/out realizados
    actual_checkin_from: Optional[datetime] = Query(None, description="Check-in realizado a partir de"),
    actual_checkin_to: Optional[datetime] = Query(None, description="Check-in realizado até"),
    actual_checkout_from: Optional[datetime] = Query(None, description="Check-out realizado a partir de"), 
    actual_checkout_to: Optional[datetime] = Query(None, description="Check-out realizado até"),
    
    # Filtros por número de hóspedes e noites
    min_guests: Optional[int] = Query(None, ge=1, description="Número mínimo de hóspedes"),
    max_guests: Optional[int] = Query(None, ge=1, description="Número máximo de hóspedes"),
    min_nights: Optional[int] = Query(None, ge=1, description="Número mínimo de noites"),
    max_nights: Optional[int] = Query(None, ge=1, description="Número máximo de noites"),
    
    # Filtros de quarto
    room_type_id: Optional[int] = Query(None, description="ID do tipo de quarto"),
    room_number: Optional[str] = Query(None, description="Número do quarto"),
    
    # Filtros especiais
    has_special_requests: Optional[bool] = Query(None, description="Possui pedidos especiais"),
    has_internal_notes: Optional[bool] = Query(None, description="Possui notas internas"),
    deposit_paid: Optional[bool] = Query(None, description="Depósito pago"),
    
    # Filtros de pagamento
    payment_status: Optional[str] = Query(None, description="Status do pagamento"),
    
    # Parâmetros para incluir dados expandidos
    include_guest_details: bool = Query(True, description="Incluir dados do hóspede"),
    include_property_details: bool = Query(True, description="Incluir dados da propriedade"),
    include_room_details: Optional[bool] = Query(True, description="Incluir detalhes dos quartos"),
    include_payment_details: Optional[bool] = Query(False, description="Incluir detalhes de pagamento"),
):
    """
    Lista reservas do tenant com filtros avançados e paginação
    Versão corrigida - busca por nome funcional e quartos com schema correto
    """
    
    try:
        # Calcular offset
        skip = (page - 1) * per_page
        
        # Query base com joins explícitos
        query = db.query(Reservation).join(
            Guest, Reservation.guest_id == Guest.id
        ).join(
            Property, Reservation.property_id == Property.id  
        ).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            selectinload(Reservation.reservation_rooms)
                .joinedload(ReservationRoom.room)
                .joinedload(Room.room_type)
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        # ===== APLICAR FILTROS BÁSICOS =====
        
        if status:
            query = query.filter(Reservation.status == status)
        
        if source:
            query = query.filter(Reservation.source == source)
        
        if property_id:
            query = query.filter(Reservation.property_id == property_id)
        
        if guest_id:
            query = query.filter(Reservation.guest_id == guest_id)
        
        # Busca textual corrigida - com join explícito
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Guest.first_name.ilike(search_term),
                    Guest.last_name.ilike(search_term),
                    func.concat(Guest.first_name, ' ', Guest.last_name).ilike(search_term),
                    Guest.email.ilike(search_term),
                    Reservation.reservation_number.ilike(search_term)
                )
            )
        
        # ===== FILTROS DE DATA =====
        
        if check_in_from:
            query = query.filter(Reservation.check_in_date >= check_in_from)
        
        if check_in_to:
            query = query.filter(Reservation.check_in_date <= check_in_to)
        
        if check_out_from:
            query = query.filter(Reservation.check_out_date >= check_out_from)
        
        if check_out_to:
            query = query.filter(Reservation.check_out_date <= check_out_to)
        
        # Correção: Tratamento flexível de created_from/to (date ou datetime)
        if created_from:
            try:
                if 'T' in created_from:
                    # É datetime completo
                    start_datetime = datetime.fromisoformat(created_from.replace('Z', '+00:00'))
                else:
                    # É apenas date, converter para início do dia
                    date_obj = datetime.strptime(created_from, '%Y-%m-%d').date()
                    start_datetime = datetime.combine(date_obj, datetime.min.time())
                query = query.filter(Reservation.created_date >= start_datetime)
            except (ValueError, TypeError):
                logger.warning(f"Formato de data inválido para created_from: {created_from}")
                
        if created_to:
            try:
                if 'T' in created_to:
                    # É datetime completo
                    end_datetime = datetime.fromisoformat(created_to.replace('Z', '+00:00'))
                else:
                    # É apenas date, converter para final do dia
                    date_obj = datetime.strptime(created_to, '%Y-%m-%d').date()
                    end_datetime = datetime.combine(date_obj, datetime.max.time())
                query = query.filter(Reservation.created_date <= end_datetime)
            except (ValueError, TypeError):
                logger.warning(f"Formato de data inválido para created_to: {created_to}")
        
        # ===== FILTROS DO HÓSPEDE =====
        
        if guest_email:
            query = query.filter(Guest.email.ilike(f"%{guest_email}%"))
            
        if guest_phone:
            query = query.filter(Guest.phone.ilike(f"%{guest_phone}%"))
            
        if guest_document_type:
            query = query.filter(Guest.document_type == guest_document_type)
            
        if guest_nationality:
            query = query.filter(Guest.nationality == guest_nationality)
            
        if guest_city:
            query = query.filter(Guest.city.ilike(f"%{guest_city}%"))
            
        if guest_state:
            query = query.filter(Guest.state == guest_state)
            
        if guest_country:
            query = query.filter(Guest.country == guest_country)
        
        # ===== FILTROS DE DATA EXPANDIDOS =====
        
        if cancelled_from:
            query = query.filter(func.date(Reservation.cancelled_date) >= cancelled_from)
            
        if cancelled_to:
            query = query.filter(func.date(Reservation.cancelled_date) <= cancelled_to)
            
        if confirmed_from:
            query = query.filter(Reservation.confirmed_date >= confirmed_from)
            
        if confirmed_to:
            query = query.filter(Reservation.confirmed_date <= confirmed_to)
            
        if actual_checkin_from:
            query = query.filter(Reservation.checked_in_date >= actual_checkin_from)
            
        if actual_checkin_to:
            query = query.filter(Reservation.checked_in_date <= actual_checkin_to)
            
        if actual_checkout_from:
            query = query.filter(Reservation.checked_out_date >= actual_checkout_from)
            
        if actual_checkout_to:
            query = query.filter(Reservation.checked_out_date <= actual_checkout_to)
        
        # ===== FILTROS NUMÉRICOS =====
        
        if min_amount is not None:
            query = query.filter(Reservation.total_amount >= Decimal(str(min_amount)))
        
        if max_amount is not None:
            query = query.filter(Reservation.total_amount <= Decimal(str(max_amount)))
        
        if min_guests:
            query = query.filter(Reservation.total_guests >= min_guests)
            
        if max_guests:
            query = query.filter(Reservation.total_guests <= max_guests)
            
        if min_nights:
            query = query.filter(func.date_part('day', Reservation.check_out_date - Reservation.check_in_date) >= min_nights)
            
        if max_nights:
            query = query.filter(func.date_part('day', Reservation.check_out_date - Reservation.check_in_date) <= max_nights)
        
        # ===== FILTROS BOOLEAN =====
        
        if is_paid is not None:
            if is_paid:
                query = query.filter(Reservation.paid_amount >= Reservation.total_amount)
            else:
                query = query.filter(Reservation.paid_amount < Reservation.total_amount)
        
        if requires_deposit is not None:
            query = query.filter(Reservation.requires_deposit == requires_deposit)
        
        if is_group_reservation is not None:
            query = query.filter(Reservation.is_group_reservation == is_group_reservation)
            
        if deposit_paid is not None:
            query = query.filter(Reservation.deposit_paid == deposit_paid)
        
        # ===== FILTROS ESPECIAIS =====
        
        if has_special_requests is not None:
            if has_special_requests:
                query = query.filter(
                    and_(
                        Reservation.guest_requests.isnot(None),
                        Reservation.guest_requests != ''
                    )
                )
            else:
                query = query.filter(
                    or_(
                        Reservation.guest_requests.is_(None),
                        Reservation.guest_requests == ''
                    )
                )
                
        if has_internal_notes is not None:
            if has_internal_notes:
                query = query.filter(
                    and_(
                        Reservation.internal_notes.isnot(None),
                        Reservation.internal_notes != ''
                    )
                )
            else:
                query = query.filter(
                    or_(
                        Reservation.internal_notes.is_(None),
                        Reservation.internal_notes == ''
                    )
                )
        
        # ===== EXECUTAR QUERY =====
        
        # Contar total antes da paginação
        total = query.count()
        
        # Ordenação (mais recente primeiro)
        query = query.order_by(desc(Reservation.created_date))
        
        # Aplicar paginação
        reservations = query.offset(skip).limit(per_page).all()
        
        # ===== CONVERTER PARA RESPONSE =====
        
        reservations_response = []
        
        for reservation in reservations:
            # Criar response básico
            reservation_dict = {
                'id': reservation.id,
                'reservation_number': reservation.reservation_number,
                'property_id': reservation.property_id,
                'guest_id': reservation.guest_id,
                'check_in_date': reservation.check_in_date,
                'check_out_date': reservation.check_out_date,
                'status': reservation.status,
                'adults': reservation.adults,
                'children': reservation.children,
                'total_guests': reservation.total_guests,
                'room_rate': reservation.room_rate,
                'total_amount': reservation.total_amount,
                'paid_amount': reservation.paid_amount,
                'discount': reservation.discount,
                'taxes': reservation.taxes,
                'source': reservation.source,
                'source_reference': reservation.source_reference,
                'created_date': reservation.created_date,
                'confirmed_date': reservation.confirmed_date,
                'checked_in_date': reservation.checked_in_date,
                'checked_out_date': reservation.checked_out_date,
                'cancelled_date': reservation.cancelled_date,
                'guest_requests': reservation.guest_requests,
                'internal_notes': reservation.internal_notes,
                'cancellation_reason': reservation.cancellation_reason,
                'preferences': reservation.preferences,
                'extra_data': reservation.extra_data,
                'is_group_reservation': reservation.is_group_reservation,
                'requires_deposit': reservation.requires_deposit,
                'deposit_paid': reservation.deposit_paid,
                'tenant_id': reservation.tenant_id,
                'created_at': reservation.created_at,
                'updated_at': reservation.updated_at,
                'is_active': reservation.is_active,
            }
            
            # Campos computados - hóspede
            if reservation.guest:
                reservation_dict['guest_name'] = f"{reservation.guest.first_name} {reservation.guest.last_name}".strip()
                reservation_dict['guest_email'] = reservation.guest.email
            else:
                reservation_dict['guest_name'] = "Hóspede não encontrado"
                reservation_dict['guest_email'] = None
            
            # Campos computados - propriedade
            if reservation.property_obj:
                reservation_dict['property_name'] = reservation.property_obj.name
            else:
                reservation_dict['property_name'] = "Propriedade não encontrada"
            
            # Campos computados - pagamento
            total_amount = float(reservation.total_amount) if reservation.total_amount else 0
            paid_amount = float(reservation.paid_amount) if reservation.paid_amount else 0
            
            reservation_dict['is_paid'] = paid_amount >= total_amount if total_amount > 0 else True
            reservation_dict['balance'] = max(0, total_amount - paid_amount)
            
            # Campos computados - noites
            if reservation.check_in_date and reservation.check_out_date:
                reservation_dict['nights'] = (reservation.check_out_date - reservation.check_in_date).days
            else:
                reservation_dict['nights'] = 0
            
            # ===== CORREÇÃO: Campos computados - quartos =====
            if include_room_details and reservation.reservation_rooms:
                rooms_data = []
                for room_reservation in reservation.reservation_rooms:
                    if room_reservation.room:  # Verificar se o quarto existe
                        # Corrigir para atender ao schema ReservationRoomResponse
                        room_data = {
                            'id': room_reservation.id,  # ✅ ID da reservation_room, não do room
                            'reservation_id': room_reservation.reservation_id,  # ✅ Campo obrigatório
                            'room_id': room_reservation.room_id,  # ✅ Campo obrigatório
                            'check_in_date': room_reservation.check_in_date.isoformat() if room_reservation.check_in_date else reservation.check_in_date.isoformat(),  # ✅ Campo obrigatório
                            'check_out_date': room_reservation.check_out_date.isoformat() if room_reservation.check_out_date else reservation.check_out_date.isoformat(),  # ✅ Campo obrigatório
                            'rate_per_night': room_reservation.rate_per_night if hasattr(room_reservation, 'rate_per_night') else None,
                            'total_amount': room_reservation.total_amount if hasattr(room_reservation, 'total_amount') else None,  # ✅ Campo obrigatório
                            'status': room_reservation.status if hasattr(room_reservation, 'status') else 'confirmed',  # ✅ Campo obrigatório
                            'notes': room_reservation.notes if hasattr(room_reservation, 'notes') else None,
                            'room_number': room_reservation.room.room_number,
                            'room_name': room_reservation.room.name if hasattr(room_reservation.room, 'name') else None,
                            'room_type_name': room_reservation.room.room_type.name if room_reservation.room.room_type else None,
                            'guests': room_reservation.guests if hasattr(room_reservation, 'guests') else 1,
                            'rate_plan_name': None  # Pode ser implementado depois
                        }
                        rooms_data.append(room_data)
                
                reservation_dict['rooms'] = rooms_data
            else:
                reservation_dict['rooms'] = []
            
            # Criar objeto de resposta
            reservation_response = ReservationResponse(**reservation_dict)
            reservations_response.append(reservation_response)
        
        # Calcular páginas
        total_pages = math.ceil(total / per_page) if total > 0 else 0
        
        return ReservationListResponse(
            reservations=reservations_response,
            total=total,
            page=page,
            pages=total_pages,
            per_page=per_page
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar reservas: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno do servidor: {str(e)}"
        )


# ===== LISTAGEM DETALHADA =====

@router.get("/detailed", response_model=ReservationListResponseWithDetails)
def get_reservations_detailed(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Todos os filtros suportados
    status: Optional[str] = Query(None, description="Status da reserva"),
    source: Optional[str] = Query(None, description="Origem da reserva"),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    guest_id: Optional[int] = Query(None, description="ID do hóspede"),
    search: Optional[str] = Query(None, description="Busca por nome, email ou número da reserva"),
    
    # Filtros de data
    check_in_from: Optional[date] = Query(None, description="Data de check-in a partir de"),
    check_in_to: Optional[date] = Query(None, description="Data de check-in até"),
    check_out_from: Optional[date] = Query(None, description="Data de check-out a partir de"),
    check_out_to: Optional[date] = Query(None, description="Data de check-out até"),
    created_from: Optional[datetime] = Query(None, description="Data de criação a partir de"),
    created_to: Optional[datetime] = Query(None, description="Data de criação até"),
    confirmed_from: Optional[datetime] = Query(None, description="Data de confirmação a partir de"),
    confirmed_to: Optional[datetime] = Query(None, description="Data de confirmação até"),
    cancelled_from: Optional[date] = Query(None, description="Data de cancelamento a partir de"),
    cancelled_to: Optional[date] = Query(None, description="Data de cancelamento até"),
    actual_checkin_from: Optional[datetime] = Query(None, description="Check-in realizado a partir de"),
    actual_checkin_to: Optional[datetime] = Query(None, description="Check-in realizado até"),
    actual_checkout_from: Optional[datetime] = Query(None, description="Check-out realizado a partir de"),
    actual_checkout_to: Optional[datetime] = Query(None, description="Check-out realizado até"),
    
    # Filtros do hóspede
    guest_email: Optional[str] = Query(None, description="Email do hóspede"),
    guest_phone: Optional[str] = Query(None, description="Telefone do hóspede"),
    guest_document_type: Optional[str] = Query(None, description="Tipo de documento do hóspede"),
    guest_nationality: Optional[str] = Query(None, description="Nacionalidade do hóspede"),
    guest_city: Optional[str] = Query(None, description="Cidade do hóspede"),
    guest_state: Optional[str] = Query(None, description="Estado do hóspede"),
    guest_country: Optional[str] = Query(None, description="País do hóspede"),
    
    # Filtros de valor e hóspedes
    min_amount: Optional[float] = Query(None, description="Valor mínimo"),
    max_amount: Optional[float] = Query(None, description="Valor máximo"),
    min_guests: Optional[int] = Query(None, ge=1, description="Número mínimo de hóspedes"),
    max_guests: Optional[int] = Query(None, le=20, description="Número máximo de hóspedes"),
    min_nights: Optional[int] = Query(None, ge=1, description="Número mínimo de noites"),
    max_nights: Optional[int] = Query(None, le=365, description="Número máximo de noites"),
    
    # Filtros de quarto
    room_type_id: Optional[int] = Query(None, description="ID do tipo de quarto"),
    room_number: Optional[str] = Query(None, description="Número do quarto"),
    
    # Filtros especiais
    has_special_requests: Optional[bool] = Query(None, description="Possui pedidos especiais"),
    has_internal_notes: Optional[bool] = Query(None, description="Possui notas internas"),
    deposit_paid: Optional[bool] = Query(None, description="Depósito pago"),
    payment_status: Optional[str] = Query(None, description="Status do pagamento"),
    is_paid: Optional[bool] = Query(None, description="Está pago"),
    requires_deposit: Optional[bool] = Query(None, description="Requer depósito"),
    is_group_reservation: Optional[bool] = Query(None, description="É reserva em grupo"),
    
    # Parâmetros de controle
    include_guest_details: bool = Query(True, description="Incluir detalhes do hóspede"),
    include_room_details: bool = Query(True, description="Incluir detalhes dos quartos"),
    include_payment_details: bool = Query(True, description="Incluir detalhes de pagamento"),
    include_property_details: bool = Query(False, description="Incluir detalhes da propriedade"),
):
    """Lista reservas com detalhes expandidos dos hóspedes e propriedades"""
    try:
        # Calcular offset
        skip = (page - 1) * per_page
        
        # Query direta com joinedload completo dos quartos
        query = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room).joinedload(Room.room_type)
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )

        # Aplicar filtros básicos
        if status:
            query = query.filter(Reservation.status == status)
        if source:
            query = query.filter(Reservation.source == source)
        if property_id:
            query = query.filter(Reservation.property_id == property_id)
        if guest_id:
            query = query.filter(Reservation.guest_id == guest_id)

        # Filtros de busca textual
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Guest.first_name.ilike(search_term),
                    Guest.last_name.ilike(search_term), 
                    Guest.email.ilike(search_term),
                    Reservation.reservation_number.ilike(search_term)
                )
            )

        # Filtros de data
        if check_in_from:
            query = query.filter(Reservation.check_in_date >= check_in_from)
        if check_in_to:
            query = query.filter(Reservation.check_in_date <= check_in_to)
        if check_out_from:
            query = query.filter(Reservation.check_out_date >= check_out_from)
        if check_out_to:
            query = query.filter(Reservation.check_out_date <= check_out_to)
        if created_from:
            query = query.filter(Reservation.created_date >= created_from)
        if created_to:
            query = query.filter(Reservation.created_date <= created_to)

        # Filtros do hóspede
        if guest_email:
            query = query.filter(Guest.email.ilike(f"%{guest_email}%"))
        if guest_phone:
            query = query.filter(Guest.phone.ilike(f"%{guest_phone}%"))
        if guest_nationality:
            query = query.filter(Guest.nationality == guest_nationality)
        if guest_city:
            query = query.filter(Guest.city.ilike(f"%{guest_city}%"))
        if guest_state:
            query = query.filter(Guest.state == guest_state)
        if guest_country:
            query = query.filter(Guest.country == guest_country)

        # Filtros financeiros
        if min_amount is not None:
            query = query.filter(Reservation.total_amount >= Decimal(str(min_amount)))
        if max_amount is not None:
            query = query.filter(Reservation.total_amount <= Decimal(str(max_amount)))
        if is_paid is not None:
            if is_paid:
                query = query.filter(Reservation.paid_amount >= Reservation.total_amount)
            else:
                query = query.filter(Reservation.paid_amount < Reservation.total_amount)

        # Filtros de hóspedes
        if min_guests:
            query = query.filter(Reservation.total_guests >= min_guests)
        if max_guests:
            query = query.filter(Reservation.total_guests <= max_guests)

        # Filtros especiais
        if deposit_paid is not None:
            query = query.filter(Reservation.deposit_paid == deposit_paid)
        if requires_deposit is not None:
            query = query.filter(Reservation.requires_deposit == requires_deposit)
        if is_group_reservation is not None:
            query = query.filter(Reservation.is_group_reservation == is_group_reservation)

        # Contar total antes da paginação
        total = query.count()

        # Ordenação (mais recente primeiro)
        query = query.order_by(desc(Reservation.created_date))

        # Aplicar paginação
        reservations = query.offset(skip).limit(per_page).all()
        
        # Converter para response expandido com guest_phone garantido
        detailed_reservations = []
        
        for reservation in reservations:
            try:
                # Base response sem conflitos
                base_data = ReservationResponse.model_validate(reservation)
                base_dict = base_data.model_dump()
                
                # Sempre popular campos básicos primeiro
                if reservation.guest:
                    base_dict['guest_name'] = reservation.guest.full_name
                    base_dict['guest_email'] = reservation.guest.email
                else:
                    base_dict['guest_name'] = "Hóspede não encontrado"
                    base_dict['guest_email'] = None
                    
                if reservation.property_obj:
                    base_dict['property_name'] = reservation.property_obj.name
                else:
                    base_dict['property_name'] = "Propriedade não encontrada"
                
                # Remover campos que conflitam (incluindo 'rooms')
                fields_to_override = [
                    'guest_phone', 'guest_document_type', 'guest_document_number',
                    'guest_nationality', 'guest_city', 'guest_state', 'guest_country',
                    'guest_address', 'guest_date_of_birth', 'property_address', 
                    'property_phone', 'property_city', 'deposit_paid', 
                    'is_group_reservation', 'requires_deposit', 'rooms'
                ]
                for field in fields_to_override:
                    base_dict.pop(field, None)

                # Criar response expandido mantendo a estrutura de rooms original
                detailed_reservation = ReservationResponseWithGuestDetails(
                    **base_dict,

                    # Dados do hóspede expandidos - sempre incluir
                    guest_phone=reservation.guest.phone if reservation.guest else None,
                    guest_document_type=reservation.guest.document_type if reservation.guest else None,
                    guest_document_number=reservation.guest.document_number if reservation.guest else None,
                    guest_nationality=reservation.guest.nationality if reservation.guest else None,
                    guest_city=reservation.guest.city if reservation.guest else None,
                    guest_state=reservation.guest.state if reservation.guest else None,
                    guest_country=reservation.guest.country if reservation.guest else None,
                    guest_address=reservation.guest.address_line1 if reservation.guest else None,
                    guest_date_of_birth=reservation.guest.date_of_birth if reservation.guest else None,

                    # Dados da propriedade expandidos
                    property_address=reservation.property_obj.address_line1 if reservation.property_obj else None,
                    property_phone=reservation.property_obj.phone if reservation.property_obj else None,
                    property_city=reservation.property_obj.city if reservation.property_obj else None,

                    # Manter estrutura original de quartos (que funcionava!)
                    rooms=[
                        ReservationRoomResponse(
                            id=room.id,
                            reservation_id=room.reservation_id,
                            room_id=room.room_id,
                            check_in_date=room.check_in_date.isoformat() if room.check_in_date else None,
                            check_out_date=room.check_out_date.isoformat() if room.check_out_date else None,
                            rate_per_night=float(room.rate_per_night) if room.rate_per_night else None,
                            total_amount=float(room.total_amount) if room.total_amount else None,
                            status=room.status,
                            notes=room.notes,
                            room_number=room.room.room_number if room.room else None,
                            room_name=room.room.name if room.room else None,
                            room_type_name=room.room.room_type.name if (room.room and room.room.room_type) else None,
                        )
                        for room in reservation.reservation_rooms if room.room
                    ] if reservation.reservation_rooms else [],

                    # Campos adicionais específicos para reservas
                    deposit_paid=reservation.deposit_paid,
                    is_group_reservation=reservation.is_group_reservation,
                    requires_deposit=reservation.requires_deposit,
                )
                
                detailed_reservations.append(detailed_reservation)
                
            except Exception as e:
                # Log individual para debug sem quebrar o endpoint
                logger.error(f"Erro ao processar reserva {reservation.id}: {str(e)}")
                logger.error(f"Guest exists: {reservation.guest is not None}")
                if reservation.guest:
                    logger.error(f"Guest phone: {reservation.guest.phone}")
                # Continuar processando as outras reservas
                continue
        
        # Calcular estatísticas da busca
        summary = None
        if total > 0 and reservations:
            # Calcular estatísticas básicas
            total_amount = sum(float(r.total_amount or 0) for r in reservations)
            total_paid = sum(float(r.paid_amount or 0) for r in reservations)
            total_pending = total_amount - total_paid
            
            # Distribuição por status
            status_counts = {}
            for r in reservations:
                status_counts[r.status] = status_counts.get(r.status, 0) + 1
            
            # Distribuição por fonte
            source_counts = {}
            for r in reservations:
                source_counts[r.source] = source_counts.get(r.source, 0) + 1
            
            # Médias
            avg_nights = sum((r.check_out_date - r.check_in_date).days for r in reservations) / len(reservations)
            avg_guests = sum(r.total_guests for r in reservations) / len(reservations)
            avg_amount = total_amount / len(reservations) if len(reservations) > 0 else 0
            
            summary = {
                "total_amount": total_amount,
                "total_paid": total_paid,
                "total_pending": total_pending,
                "status_counts": status_counts,
                "source_counts": source_counts,
                "avg_nights": round(avg_nights, 1),
                "avg_guests": round(avg_guests, 1),
                "avg_amount": round(avg_amount, 2)
            }
        
        # Calcular páginas
        pages = math.ceil(total / per_page) if total > 0 else 0
        
        return ReservationListResponseWithDetails(
            reservations=detailed_reservations,
            total=total,
            page=page,
            pages=pages,
            per_page=per_page,
            summary=summary
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar reservas detalhadas: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno do servidor: {str(e)}"
        )

# ===== RESERVAS DE HOJE ===== (DEVE VIR PRIMEIRO)

@router.get("/today", response_model=Dict[str, Any])
def get_todays_reservations_improved(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    include_details: bool = Query(True, description="Incluir detalhes dos hóspedes")
):
    """Obtém reservas do dia atual (melhorado)"""
    try:
        today = date.today()
        
        # Query base com joins
        base_query = db.query(Reservation)
        
        if include_details:
            base_query = base_query.options(
                joinedload(Reservation.guest),
                selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
            )
        
        base_query = base_query.filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Chegadas hoje (sem order_by por campos inexistentes)
        arrivals = base_query.filter(
            Reservation.check_in_date == today,
            Reservation.status.in_(['confirmed', 'pending'])
        ).order_by(asc(Reservation.id)).all()  # ✅ Ordenar por ID
        
        # Saídas hoje
        departures = base_query.filter(
            Reservation.check_out_date == today,
            Reservation.status == 'checked_in'
        ).order_by(asc(Reservation.id)).all()  # ✅ Ordenar por ID
        
        # Hóspedes atuais
        current_guests = base_query.filter(
            Reservation.status == 'checked_in',
            Reservation.check_in_date <= today,
            Reservation.check_out_date > today
        ).all()
        
        # Formatação da resposta
        response_data = {
            "date": today.isoformat(),
            "arrivals_count": len(arrivals),
            "departures_count": len(departures),
            "current_guests_count": len(current_guests),
        }
        
        if include_details:
            response_data.update({
                "arrivals": [
                    ReservationResponseWithGuestDetails.model_validate(r).model_dump()
                    for r in arrivals
                ],
                "departures": [
                    ReservationResponseWithGuestDetails.model_validate(r).model_dump()
                    for r in departures
                ],
                "current_guests": [
                    ReservationResponseWithGuestDetails.model_validate(r).model_dump()
                    for r in current_guests
                ]
            })
        else:
            response_data.update({
                "arrivals": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in arrivals],
                "departures": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in departures],
                "current_guests": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in current_guests]
            })
        
        return response_data
        
    except Exception as e:
        logger.error(f"Erro ao buscar reservas de hoje: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar reservas de hoje: {str(e)}"
        )

@router.get("/recent", response_model=List[Dict[str, Any]])
def get_recent_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(5, ge=1, le=20, description="Número de reservas recentes"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """Obtém as reservas mais recentes"""
    try:
        base_query = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        recent_reservations = base_query.order_by(
            desc(Reservation.created_at)
        ).limit(limit).all()
        
        # ✅ CONSTRUIR DICT MANUAL (mesmo padrão do checked-in-pending-payment)
        reservations_list = []
        for reservation in recent_reservations:
            nights = (reservation.check_out_date - reservation.check_in_date).days
            
            reservations_list.append({
                "id": reservation.id,
                "reservation_number": reservation.reservation_number,
                "guest_name": reservation.guest.full_name if reservation.guest else "Sem nome",  # ✅ ACESSO DIRETO
                "guest_email": reservation.guest.email if reservation.guest else None,
                "property_name": reservation.property_obj.name if reservation.property_obj else None,
                "check_in_date": reservation.check_in_date.isoformat(),
                "check_out_date": reservation.check_out_date.isoformat(),
                "status": reservation.status,
                "total_amount": float(reservation.total_amount),
                "paid_amount": float(reservation.paid_amount),
                "balance_due": float(reservation.total_amount - reservation.paid_amount),
                "nights": nights,
                "created_at": reservation.created_at.isoformat() if reservation.created_at else None
            })
        
        return reservations_list
        
    except Exception as e:
        logger.error(f"Erro ao buscar reservas recentes: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar reservas recentes: {str(e)}"
        )
        
@router.get("/checked-in-pending-payment", response_model=List[Dict[str, Any]])
def get_checked_in_pending_payment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    limit: int = Query(10, ge=1, le=50, description="Número máximo de resultados")
):
    """Obtém reservas com check-in feito e saldo pendente"""
    try:
        # Query mais simples para isolar o problema
        base_query = db.query(Reservation).options(
            joinedload(Reservation.guest),
            selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status == 'checked_in',
            Reservation.total_amount > Reservation.paid_amount  # Tem saldo pendente
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        reservations = base_query.order_by(
            asc(Reservation.check_in_date)  # Mais antigos primeiro (mais urgente)
        ).limit(limit).all()
        
        pending_payments = []
        for reservation in reservations:
            days_since_checkin = (date.today() - reservation.check_in_date).days
            
            # Pegar número do quarto da primeira reservation_room
            room_number = None
            if reservation.reservation_rooms and reservation.reservation_rooms[0].room:
                room_number = reservation.reservation_rooms[0].room.room_number
            
            pending_amount = float(reservation.total_amount - reservation.paid_amount)
            
            pending_payments.append({
                "reservation_id": reservation.id,
                "guest_name": reservation.guest.full_name if reservation.guest else "N/A",
                "room_number": room_number or "N/A",
                "check_in_date": reservation.check_in_date.isoformat(),
                "pending_amount": pending_amount,
                "days_since_checkin": days_since_checkin,
                "total_amount": float(reservation.total_amount),
                "paid_amount": float(reservation.paid_amount),
                "payment_status": "overdue" if days_since_checkin > 3 else "pending"
            })
        
        return pending_payments
        
    except Exception as e:
        logger.error(f"Erro ao buscar check-ins com saldo pendente: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar check-ins com saldo pendente: {str(e)}"
        )
        
@router.get("/dashboard-summary", response_model=Dict[str, Any])
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """Obtém resumo consolidado para o dashboard"""
    try:
        today = date.today()
        
        # Query base
        base_query = db.query(Reservation).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Estatísticas básicas
        total_reservations = base_query.count()
        
        # Check-ins de hoje
        todays_checkins = base_query.filter(
            Reservation.check_in_date == today,
            Reservation.status.in_(['confirmed', 'pending'])
        ).count()
        
        # Check-outs de hoje  
        todays_checkouts = base_query.filter(
            Reservation.check_out_date == today,
            Reservation.status == 'checked_in'
        ).count()
        
        # Hóspedes atuais (checked-in)
        current_guests = base_query.filter(
            Reservation.status == 'checked_in'
        ).count()
        
        # Receita total e pendente
        revenue_data = base_query.with_entities(
            func.sum(Reservation.total_amount).label('total_revenue'),
            func.sum(Reservation.paid_amount).label('paid_revenue')
        ).first()
        
        total_revenue = float(revenue_data.total_revenue or 0)
        paid_revenue = float(revenue_data.paid_revenue or 0)
        pending_revenue = total_revenue - paid_revenue
        
        # Saldo pendente de check-ins
        checked_in_pending = base_query.filter(
            Reservation.status == 'checked_in',
            Reservation.total_amount > Reservation.paid_amount
        ).count()
        
        return {
            "total_reservations": total_reservations,
            "todays_checkins": todays_checkins,
            "todays_checkouts": todays_checkouts,
            "current_guests": current_guests,
            "total_revenue": total_revenue,
            "paid_revenue": paid_revenue,
            "pending_revenue": pending_revenue,
            "checked_in_with_pending_payment": checked_in_pending,
            "summary_date": today.isoformat(),
            "property_id": property_id
        }
        
    except Exception as e:
        logger.error(f"Erro ao buscar resumo do dashboard: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar resumo do dashboard: {str(e)}"
        )

# ===== CRUD BÁSICO ===== (ENDPOINT GENÉRICO POR ÚLTIMO)

@router.get("/{reservation_id}", response_model=ReservationResponse)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva específica do tenant - VERSÃO CORRIGIDA COM QUARTOS"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    # ✅ CONVERSÃO MANUAL PARA INCLUIR QUARTOS (mesmo padrão de outros endpoints)
    try:
        # Usar model_validate para os campos básicos
        base_response = ReservationResponse.model_validate(reservation_obj)
        base_dict = base_response.model_dump()
        
        # ✅ ADICIONAR QUARTOS MANUALMENTE
        if reservation_obj.reservation_rooms:
            rooms_data = []
            for room_reservation in reservation_obj.reservation_rooms:
                if room_reservation.room:  # Verificar se o quarto existe
                    room_data = {
                        'id': room_reservation.id,
                        'reservation_id': room_reservation.reservation_id,
                        'room_id': room_reservation.room_id,
                        'check_in_date': room_reservation.check_in_date.isoformat() if room_reservation.check_in_date else reservation_obj.check_in_date.isoformat(),
                        'check_out_date': room_reservation.check_out_date.isoformat() if room_reservation.check_out_date else reservation_obj.check_out_date.isoformat(),
                        'rate_per_night': float(room_reservation.rate_per_night) if room_reservation.rate_per_night else None,
                        'total_amount': float(room_reservation.total_amount) if room_reservation.total_amount else None,
                        'status': getattr(room_reservation, 'status', 'confirmed'),
                        'notes': getattr(room_reservation, 'notes', None),
                        'room_number': room_reservation.room.room_number,
                        'room_name': getattr(room_reservation.room, 'name', None),
                        'room_type_name': room_reservation.room.room_type.name if room_reservation.room.room_type else None,
                        'guests': getattr(room_reservation, 'guests', 1),
                        'rate_plan_name': None  # Pode ser implementado depois
                    }
                    rooms_data.append(room_data)
            
            base_dict['rooms'] = rooms_data
        else:
            base_dict['rooms'] = []
        
        # ✅ ADICIONAR CAMPOS COMPUTADOS BÁSICOS
        if reservation_obj.guest:
            base_dict['guest_name'] = f"{reservation_obj.guest.first_name} {reservation_obj.guest.last_name}".strip()
            base_dict['guest_email'] = reservation_obj.guest.email
        else:
            base_dict['guest_name'] = "Hóspede não encontrado"
            base_dict['guest_email'] = None
        
        if reservation_obj.property_obj:
            base_dict['property_name'] = reservation_obj.property_obj.name
        else:
            base_dict['property_name'] = "Propriedade não encontrada"
        
        # Campos computados - noites
        if reservation_obj.check_in_date and reservation_obj.check_out_date:
            base_dict['nights'] = (reservation_obj.check_out_date - reservation_obj.check_in_date).days
        else:
            base_dict['nights'] = 0
        
        # Campos computados - pagamento
        total_amount = float(reservation_obj.total_amount) if reservation_obj.total_amount else 0
        paid_amount = float(reservation_obj.paid_amount) if reservation_obj.paid_amount else 0
        
        base_dict['is_paid'] = paid_amount >= total_amount if total_amount > 0 else True
        base_dict['balance_due'] = max(0, total_amount - paid_amount)
        
        # ✅ RETORNAR RESERVA COM QUARTOS INCLUÍDOS
        return ReservationResponse(**base_dict)
        
    except Exception as e:
        logger.error(f"Erro ao processar reserva {reservation_id}: {str(e)}")
        # Fallback para versão básica sem quartos
        return ReservationResponse.model_validate(reservation_obj)


@router.get("/{reservation_id}/details", response_model=ReservationWithDetails)
def get_reservation_with_details(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva com todos os detalhes"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    # Converter para response com detalhes
    reservation_response = ReservationResponse.model_validate(reservation_obj)
    
    guest_data = None
    if reservation_obj.guest:
        guest_data = {
            'id': reservation_obj.guest.id,
            'full_name': reservation_obj.guest.full_name,
            'email': reservation_obj.guest.email,
            'phone': reservation_obj.guest.phone,
            'document_type': reservation_obj.guest.document_type,
            'document_number': reservation_obj.guest.document_number
        }
    
    property_data = None
    if reservation_obj.property_obj:
        property_data = {
            'id': reservation_obj.property_obj.id,
            'name': reservation_obj.property_obj.name,
            'property_type': reservation_obj.property_obj.property_type,
            'city': reservation_obj.property_obj.city,
            'phone': reservation_obj.property_obj.phone
        }
    
    return ReservationWithDetails(
        **reservation_response.dict(),
        guest=guest_data,
        property=property_data
    )


@router.get("/{reservation_id}/detailed", response_model=ReservationDetailedResponse)
def get_reservation_detailed(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca reserva com todos os detalhes para página individual
    Inclui dados completos do hóspede, propriedade, quartos, pagamentos e histórico
    """
    try:
        reservation_service = ReservationService(db)
        detailed_data = reservation_service.get_reservation_detailed(
            reservation_id, 
            current_user.tenant_id
        )
        
        if not detailed_data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Converter datetime para string onde necessário
        if detailed_data.get('created_date') and hasattr(detailed_data['created_date'], 'isoformat'):
            detailed_data['created_date'] = detailed_data['created_date'].isoformat()
        if detailed_data.get('confirmed_date') and hasattr(detailed_data['confirmed_date'], 'isoformat'):
            detailed_data['confirmed_date'] = detailed_data['confirmed_date'].isoformat()
        if detailed_data.get('checked_in_date') and hasattr(detailed_data['checked_in_date'], 'isoformat'):
            detailed_data['checked_in_date'] = detailed_data['checked_in_date'].isoformat()
        if detailed_data.get('checked_out_date') and hasattr(detailed_data['checked_out_date'], 'isoformat'):
            detailed_data['checked_out_date'] = detailed_data['checked_out_date'].isoformat()
        if detailed_data.get('cancelled_date') and hasattr(detailed_data['cancelled_date'], 'isoformat'):
            detailed_data['cancelled_date'] = detailed_data['cancelled_date'].isoformat()
        
        # Converter datas nos dados do hóspede
        guest_data = detailed_data.get('guest', {})
        if guest_data.get('date_of_birth') and hasattr(guest_data['date_of_birth'], 'isoformat'):
            guest_data['date_of_birth'] = guest_data['date_of_birth'].isoformat()
        if guest_data.get('last_stay_date') and hasattr(guest_data['last_stay_date'], 'isoformat'):
            guest_data['last_stay_date'] = guest_data['last_stay_date'].isoformat()
        if guest_data.get('created_at') and hasattr(guest_data['created_at'], 'isoformat'):
            guest_data['created_at'] = guest_data['created_at'].isoformat()
        if guest_data.get('updated_at') and hasattr(guest_data['updated_at'], 'isoformat'):
            guest_data['updated_at'] = guest_data['updated_at'].isoformat()
        
        # Converter datas nos dados da propriedade
        property_data = detailed_data.get('property', {})
        if property_data.get('created_at') and hasattr(property_data['created_at'], 'isoformat'):
            property_data['created_at'] = property_data['created_at'].isoformat()
        if property_data.get('updated_at') and hasattr(property_data['updated_at'], 'isoformat'):
            property_data['updated_at'] = property_data['updated_at'].isoformat()
        
        # Converter timestamps no histórico de auditoria
        for entry in detailed_data.get('audit_history', []):
            if entry.get('timestamp') and hasattr(entry['timestamp'], 'isoformat'):
                entry['timestamp'] = entry['timestamp'].isoformat()
        
        # Converter datas principais
        if detailed_data.get('check_in_date') and hasattr(detailed_data['check_in_date'], 'isoformat'):
            detailed_data['check_in_date'] = detailed_data['check_in_date'].isoformat()
        if detailed_data.get('check_out_date') and hasattr(detailed_data['check_out_date'], 'isoformat'):
            detailed_data['check_out_date'] = detailed_data['check_out_date'].isoformat()
        if detailed_data.get('created_at') and hasattr(detailed_data['created_at'], 'isoformat'):
            detailed_data['created_at'] = detailed_data['created_at'].isoformat()
        if detailed_data.get('updated_at') and hasattr(detailed_data['updated_at'], 'isoformat'):
            detailed_data['updated_at'] = detailed_data['updated_at'].isoformat()
        
        return ReservationDetailedResponse(**detailed_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar detalhes da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/number/{reservation_number}", response_model=ReservationResponse)
def get_reservation_by_number(
    reservation_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva por número"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_number(reservation_number, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    return ReservationResponse.model_validate(reservation_obj)


@router.post("/", response_model=ReservationResponse)
def create_reservation(
    reservation_data: ReservationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova reserva no tenant atual"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.create_reservation(
            reservation_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza reserva"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.update_reservation(
            reservation_id, 
            current_user.tenant_id, 
            reservation_data,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ===== AÇÕES DAS RESERVAS =====

@router.patch("/{reservation_id}/confirm", response_model=ReservationResponseWithGuestDetails)
def confirm_reservation_expanded(
    reservation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Confirma uma reserva e retorna dados expandidos"""
    try:
        reservation_service = ReservationService(db)
        
        # Buscar reserva com relacionamentos carregados
        reservation = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj)
        ).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Confirmar reserva
        reservation.status = 'confirmed'
        reservation.confirmed_date = datetime.utcnow()
        db.commit()
        
        # Retornar response expandido
        base_data = ReservationResponse.model_validate(reservation)
        
        return ReservationResponseWithGuestDetails(
            **base_data.model_dump(),
            guest_phone=reservation.guest.phone if reservation.guest else None,
            guest_document_type=reservation.guest.document_type if reservation.guest else None,
            property_address=reservation.property_obj.address_line1 if reservation.property_obj else None,
            property_phone=reservation.property_obj.phone if reservation.property_obj else None,
            deposit_paid=reservation.deposit_paid,
            is_group_reservation=reservation.is_group_reservation,
            requires_deposit=reservation.requires_deposit,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao confirmar reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao confirmar reserva: {str(e)}"
        )


@router.post("/{reservation_id}/check-in", response_model=ReservationResponse)  # ✅ MUDANÇA
def check_in_reservation_expanded(
    reservation_id: int,
    check_in_data: CheckInRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-in - VERSÃO CORRIGIDA"""
    try:
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        if not reservation.can_check_in:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Check-in não permitido para esta reserva"
            )
        
        # Usar o serviço
        reservation_service = ReservationService(db)
        
        checked_in_reservation = reservation_service.check_in_reservation(
            reservation_id=reservation_id,
            tenant_id=current_user.tenant_id,
            check_in_request=check_in_data,
            current_user=current_user,
            request=request
        )
        
        if not checked_in_reservation:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível realizar o check-in"
            )
        
        return ReservationResponse.model_validate(checked_in_reservation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao fazer check-in da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{reservation_id}/check-out", response_model=ReservationResponse)  # ✅ MUDANÇA
def check_out_reservation_expanded(
    reservation_id: int,
    check_out_data: CheckOutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-out - VERSÃO CORRIGIDA"""
    try:
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        if not reservation.can_check_out:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Check-out não permitido para esta reserva"
            )
        
        # Usar o serviço
        reservation_service = ReservationService(db)
        
        checked_out_reservation = reservation_service.check_out_reservation(
            reservation_id=reservation_id,
            tenant_id=current_user.tenant_id,
            check_out_request=check_out_data,
            current_user=current_user,
            request=request
        )
        
        if not checked_out_reservation:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível realizar o check-out"
            )
        
        return ReservationResponse.model_validate(checked_out_reservation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao fazer check-out da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)  # ✅ MUDANÇA: ReservationResponse em vez de ReservationResponseWithGuestDetails
def cancel_reservation_expanded(
    reservation_id: int,
    cancel_data: CancelReservationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancela uma reserva - VERSÃO CORRIGIDA"""
    try:
        # ✅ CORREÇÃO: Query mais simples sem relacionamentos complexos
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Verificar se pode cancelar usando a propriedade do modelo
        if not reservation.can_cancel:  # ✅ CORREÇÃO: Usar a propriedade do modelo
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Reserva não pode ser cancelada no status atual"
            )
        
        # ✅ CORREÇÃO: Usar o serviço em vez de manipular diretamente
        reservation_service = ReservationService(db)
        
        try:
            # Cancelar usando o serviço que já tem toda a lógica
            cancelled_reservation = reservation_service.cancel_reservation(
                reservation_id=reservation_id,
                tenant_id=current_user.tenant_id,
                cancel_request=cancel_data,
                current_user=current_user,
                request=request
            )
            
            if not cancelled_reservation:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Não foi possível cancelar a reserva"
                )
            
            # ✅ CORREÇÃO: Retorno simples que sempre funciona
            return ReservationResponse.model_validate(cancelled_reservation)
            
        except ValueError as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cancelar reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


# ===== DISPONIBILIDADE E BUSCA =====

# backend/app/api/v1/endpoints/reservations.py - ENDPOINT CORRIGIDO

# ===== IMPORTS CORRIGIDOS =====
from sqlalchemy import and_, or_, func, text, desc, asc, not_  # ✅ ADICIONAR not_

# ===== ENDPOINT FUNCIONAL CORRIGIDO =====

@router.post("/check-availability", response_model=AvailabilityResponse)
def check_availability(
    availability_request: AvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica disponibilidade de quartos"""
    reservation_service = ReservationService(db)
    
    try:
        # ✅ USAR O MÉTODO DO SERVICE QUE JÁ FUNCIONA
        available_rooms = reservation_service.get_available_rooms(
            property_id=availability_request.property_id,
            check_in_date=availability_request.check_in_date,
            check_out_date=availability_request.check_out_date,
            tenant_id=current_user.tenant_id,
            room_type_id=availability_request.room_type_id,
            exclude_reservation_id=availability_request.exclude_reservation_id  # ✅ NOVO PARÂMETRO
        )
        
        # ✅ BUSCAR CONFLITOS COM SINTAXE CORRIGIDA
        conflicts_query = db.query(Reservation.reservation_number).join(ReservationRoom).filter(
            Reservation.property_id == availability_request.property_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),
            # ✅ USAR not_ IMPORTADO CORRETAMENTE
            not_(
                or_(
                    ReservationRoom.check_out_date <= availability_request.check_in_date,
                    ReservationRoom.check_in_date >= availability_request.check_out_date
                )
            )
        )
        
        # ✅ EXCLUIR RESERVA ESPECÍFICA DOS CONFLITOS
        if availability_request.exclude_reservation_id:
            conflicts_query = conflicts_query.filter(
                Reservation.id != availability_request.exclude_reservation_id
            )
        
        conflicting_reservations = [r[0] for r in conflicts_query.distinct().all()]
        
        # ✅ PREPARAR DADOS DOS QUARTOS SEM ACESSAR CAMPOS INEXISTENTES
        rooms_data = []
        for room in available_rooms:
            room_data = {
                'id': room.id,
                'room_number': room.room_number,
                'name': getattr(room, 'name', None),  # Uso seguro
                'room_type_id': room.room_type_id,
                'room_type_name': room.room_type.name if room.room_type else None,
                'max_occupancy': getattr(room, 'max_occupancy', 2),  # Padrão seguro
                'floor': getattr(room, 'floor', None),
                'building': getattr(room, 'building', None),
                # ✅ REMOVER REFERÊNCIA A base_rate QUE NÃO EXISTE
                'rate_per_night': 0.0  # Valor padrão - será sobrescrito pelo frontend se necessário
            }
            rooms_data.append(room_data)
        
        return AvailabilityResponse(
            available=len(available_rooms) > 0,
            available_rooms=rooms_data,
            total_available_rooms=len(available_rooms),
            conflicting_reservations=conflicting_reservations if conflicting_reservations else None
        )
        
    except ValueError as e:
        logger.error(f"ValueError em check_availability: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # ✅ LOG DETALHADO PARA DEBUG
        logger.error(f"Erro em check_availability: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/advanced-search", response_model=ReservationListResponse)
def advanced_search_reservations(
    filters: ReservationFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST"""
    reservation_service = ReservationService(db)
    
    skip = (page - 1) * per_page
    
    reservations = reservation_service.get_reservations(current_user.tenant_id, filters, skip, per_page)
    total = reservation_service.count_reservations(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    reservations_response = [ReservationResponse.model_validate(reservation) for reservation in reservations]
    
    return ReservationListResponse(
        reservations=reservations_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


# ===== CALENDÁRIO =====

@router.get("/calendar/month", response_model=List[ReservationResponse])
def get_calendar_month(
    year: int = Query(..., ge=2020, le=2030, description="Ano"),
    month: int = Query(..., ge=1, le=12, description="Mês"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reservas de um mês específico para o calendário"""
    from calendar import monthrange
    
    reservation_service = ReservationService(db)
    
    # Primeiro e último dia do mês
    start_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_date = date(year, month, last_day)
    
    # Buscar reservas do período
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=['confirmed', 'checked_in', 'checked_out']
    )
    
    return [ReservationResponse.model_validate(reservation) for reservation in reservations]


@router.get("/calendar/range", response_model=List[ReservationResponse])
def get_calendar_range(
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    status: Optional[str] = Query(None, description="Filtrar por status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reservas em um período específico para o calendário"""
    reservation_service = ReservationService(db)
    
    # Validar período (máximo 1 ano)
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    status_filter = [status] if status else ['confirmed', 'checked_in', 'checked_out']
    
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=status_filter
    )
    
    return [ReservationResponse.model_validate(reservation) for reservation in reservations]

# ===== ESTATÍSTICAS =====

@router.get("/stats/general", response_model=Dict[str, Any])
def get_reservation_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica")
):
    """Obtém estatísticas gerais das reservas"""
    reservation_service = ReservationService(db)
    stats = reservation_service.get_reservation_stats(current_user.tenant_id, property_id)
    
    return stats


@router.get("/stats/dashboard", response_model=Dict[str, Any])
def get_dashboard_stats_original(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica"),
    days_back: int = Query(30, ge=1, le=365, description="Dias para análise")
):
    """Obtém estatísticas para dashboard (versão original)"""
    reservation_service = ReservationService(db)
    
    # Stats gerais
    general_stats = reservation_service.get_reservation_stats(current_user.tenant_id, property_id)
    
    # Stats dos últimos N dias
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    recent_reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id
    )
    
    # Análise por período
    reservations_by_day = {}
    for reservation in recent_reservations:
        day_key = reservation.created_at.date().isoformat()
        if day_key not in reservations_by_day:
            reservations_by_day[day_key] = 0
        reservations_by_day[day_key] += 1
    
    return {
        **general_stats,
        'period_days': days_back,
        'reservations_in_period': len(recent_reservations),
        'reservations_by_day': reservations_by_day,
        'average_daily_reservations': len(recent_reservations) / days_back if days_back > 0 else 0,
        # Adicionar campos esperados pelo frontend
        'total_reservations': general_stats.get('total_reservations', 0),
        'total_revenue': general_stats.get('total_revenue', 0),
        'occupancy_rate': general_stats.get('occupancy_rate', 0),
        'pending_checkins': 0,  # Será calculado quando necessário
        'pending_checkouts': 0, # Será calculado quando necessário
        'overdue_payments': 0   # Será calculado quando necessário
    }


@router.get("/dashboard/stats", response_model=dict)
def get_dashboard_stats_expanded(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    days_back: Optional[int] = Query(30, description="Número de dias para análise")
):
    """Obtém estatísticas expandidas do dashboard"""
    try:
        reservation_service = ReservationService(db)
        
        # Query base
        base_query = db.query(Reservation).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Estatísticas básicas
        total_reservations = base_query.count()
        
        # Reservas por status
        pending_checkins = base_query.filter(
            Reservation.status == 'confirmed',
            Reservation.check_in_date == date.today()
        ).count()
        
        pending_checkouts = base_query.filter(
            Reservation.status == 'checked_in',
            Reservation.check_out_date == date.today()
        ).count()
        
        # Receita total
        total_revenue_query = base_query.with_entities(
            func.sum(Reservation.total_amount)
        ).scalar() or 0
        
        # Pagamentos em atraso (mock - seria necessário integrar com sistema de pagamentos)
        overdue_payments = 0
        
        # Taxa de ocupação (mock - seria necessário calcular baseado em disponibilidade)
        occupancy_rate = 75.0
        
        # Estatísticas adicionais
        avg_nights = 2.5  # Mock
        avg_guests = 2.0  # Mock
        avg_amount = float(total_revenue_query) / total_reservations if total_reservations > 0 else 0
        
        # Distribuições por status e fonte
        status_distribution = {}
        source_distribution = {}
        
        for reservation in base_query.limit(1000):  # Limitar para performance
            status_distribution[reservation.status] = status_distribution.get(reservation.status, 0) + 1
            source_distribution[reservation.source] = source_distribution.get(reservation.source, 0) + 1
        
        return {
            "total_reservations": total_reservations,
            "total_revenue": float(total_revenue_query),
            "occupancy_rate": occupancy_rate,
            "pending_checkins": pending_checkins,
            "pending_checkouts": pending_checkouts,
            "overdue_payments": overdue_payments,
            "avg_nights": avg_nights,
            "avg_guests": avg_guests,
            "avg_amount": round(avg_amount, 2),
            "this_month_reservations": total_reservations,  # Mock
            "this_month_revenue": float(total_revenue_query),  # Mock
            "last_month_reservations": total_reservations,  # Mock
            "last_month_revenue": float(total_revenue_query),  # Mock
            "status_distribution": status_distribution,
            "source_distribution": source_distribution,
            "recent_activity": []  # Mock - seria populado com atividades recentes
        }
        
    except Exception as e:
        logger.error(f"Erro ao carregar estatísticas do dashboard: {str(e)}")
        # Retornar dados padrão em caso de erro para não quebrar o frontend
        return {
            "total_reservations": 0,
            "total_revenue": 0,
            "occupancy_rate": 0,
            "pending_checkins": 0,
            "pending_checkouts": 0,
            "overdue_payments": 0,
            "avg_nights": 0,
            "avg_guests": 0,
            "avg_amount": 0,
            "this_month_reservations": 0,
            "this_month_revenue": 0,
            "last_month_reservations": 0,
            "last_month_revenue": 0,
            "status_distribution": {},
            "source_distribution": {},
            "recent_activity": []
        }


# ===== ANÁLISES =====

@router.get("/analysis/occupancy", response_model=Dict[str, Any])
def get_occupancy_analysis(
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Análise de ocupação em um período"""
    reservation_service = ReservationService(db)
    
    # Validar período
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    # Buscar reservas do período
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=['checked_in', 'checked_out']
    )
    
    # Calcular métricas
    total_days = (end_date - start_date).days
    total_room_nights = 0
    occupied_room_nights = 0
    
    # TODO: Implementar cálculo real de ocupação baseado nos quartos disponíveis
    # Por enquanto, retornar dados básicos
    
    return {
        'period': {
            'start_date': start_date,
            'end_date': end_date,
            'total_days': total_days
        },
        'reservations_count': len(reservations),
        'total_room_nights': total_room_nights,
        'occupied_room_nights': occupied_room_nights,
        'occupancy_rate': 0.0,  # Será calculado quando tivermos dados de quartos
        'average_stay_length': sum(r.nights for r in reservations) / len(reservations) if reservations else 0
    }


# ===== EXPORTAÇÃO =====

@router.get("/export", response_model=dict)
def export_reservations(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    format: str = Query("xlsx", description="Formato de exportação (xlsx, csv)"),
    
    # Reutilizar os mesmos filtros do endpoint detailed
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    property_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    check_in_from: Optional[date] = Query(None),
    check_in_to: Optional[date] = Query(None),
    check_out_from: Optional[date] = Query(None),
    check_out_to: Optional[date] = Query(None),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    guest_email: Optional[str] = Query(None),
    guest_phone: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    min_guests: Optional[int] = Query(None),
    max_guests: Optional[int] = Query(None),
    is_paid: Optional[bool] = Query(None),
    requires_deposit: Optional[bool] = Query(None),
    is_group_reservation: Optional[bool] = Query(None),
    
    # Parâmetros específicos da exportação
    include_guest_details: bool = Query(True),
    include_room_details: bool = Query(True),
    include_payment_details: bool = Query(True),
    include_property_details: bool = Query(False),
):
    """Exporta reservas com filtros personalizados"""
    try:
        # Por ora, retornar uma resposta mock para não quebrar o frontend
        # TODO: Implementar exportação real usando pandas ou similar
        
        return {
            "message": "Exportação em desenvolvimento",
            "filters_applied": {
                "status": status,
                "source": source,
                "property_id": property_id,
                "format": format,
                "timestamp": datetime.utcnow().isoformat()
            },
            "file_url": "/tmp/reservations_export.xlsx",  # URL mockada
            "file_name": f"reservas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}",
            "total_records": 0,
            "generated_at": datetime.utcnow().isoformat(),
            "expires_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao exportar reservas: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar reservas: {str(e)}"
        )


@router.post("/export", response_model=ReservationExportResponse)
def export_reservations_post(
    export_filters: ReservationExportFilters,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Exporta reservas para CSV com filtros personalizados via POST"""
    
    # Por enquanto, retornar dados simulados até implementar no service
    return ReservationExportResponse(
        file_url="http://exemplo.com/export.csv",
        file_name="reservations_export.csv",
        total_records=0,
        generated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )