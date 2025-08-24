# backend/app/api/v1/endpoints/reservations.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, date
import math

from app.core.database import get_db
from app.services.reservation_service import ReservationService
from app.schemas.reservation import (
    ReservationCreate, 
    ReservationUpdate, 
    ReservationResponse, 
    ReservationListResponse,
    ReservationFilters,
    ReservationWithDetails,
    CheckInRequest,
    CheckOutRequest,
    CancelReservationRequest,
    AvailabilityRequest,
    AvailabilityResponse
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=ReservationListResponse)
def list_reservations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    status: Optional[str] = Query(None, description="Filtrar por status"),
    source: Optional[str] = Query(None, description="Filtrar por canal"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    guest_id: Optional[int] = Query(None, description="Filtrar por hóspede"),
    check_in_from: Optional[date] = Query(None, description="Check-in a partir de"),
    check_in_to: Optional[date] = Query(None, description="Check-in até"),
    check_out_from: Optional[date] = Query(None, description="Check-out a partir de"),
    check_out_to: Optional[date] = Query(None, description="Check-out até"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista reservas do tenant com filtros e paginação"""
    reservation_service = ReservationService(db)
    
    # Construir filtros
    filters = ReservationFilters(
        status=status,
        source=source,
        property_id=property_id,
        guest_id=guest_id,
        check_in_from=check_in_from,
        check_in_to=check_in_to,
        check_out_from=check_out_from,
        check_out_to=check_out_to,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar reservas e total
    reservations = reservation_service.get_reservations(current_user.tenant_id, filters, skip, per_page)
    total = reservation_service.count_reservations(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    reservations_response = [ReservationResponse.model_validate(reservation) for reservation in reservations]
    
    return ReservationListResponse(
        reservations=reservations_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/today", response_model=Dict[str, Any])
def get_todays_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """Busca reservas de hoje (chegadas e saídas)"""
    reservation_service = ReservationService(db)
    today = date.today()
    
    # Chegadas hoje
    arrivals = reservation_service.get_reservations(
        current_user.tenant_id,
        ReservationFilters(
            check_in_from=today,
            check_in_to=today,
            property_id=property_id,
            status="confirmed"
        )
    )
    
    # Saídas hoje
    departures = reservation_service.get_reservations(
        current_user.tenant_id,
        ReservationFilters(
            check_out_from=today,
            check_out_to=today,
            property_id=property_id,
            status="checked_in"
        )
    )
    
    # Hóspedes atuais (checked_in)
    current_guests = reservation_service.get_reservations(
        current_user.tenant_id,
        ReservationFilters(status="checked_in", property_id=property_id)
    )
    
    return {
        "date": today,
        "arrivals": [ReservationResponse.model_validate(r) for r in arrivals],
        "departures": [ReservationResponse.model_validate(r) for r in departures],
        "current_guests": [ReservationResponse.model_validate(r) for r in current_guests],
        "arrivals_count": len(arrivals),
        "departures_count": len(departures),
        "current_guests_count": len(current_guests)
    }


@router.get("/{reservation_id}", response_model=ReservationResponse)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva específica do tenant"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
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
            status_code=status.HTTP_404_NOT_FOUND,
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
            status_code=status.HTTP_404_NOT_FOUND,
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
            status_code=status.HTTP_400_BAD_REQUEST,
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/check-availability", response_model=AvailabilityResponse)
def check_availability(
    availability_request: AvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica disponibilidade de quartos"""
    reservation_service = ReservationService(db)
    
    try:
        availability = reservation_service.check_availability(availability_request, current_user.tenant_id)
        return availability
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{reservation_id}/confirm", response_model=ReservationResponse)
def confirm_reservation(
    reservation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Confirma uma reserva pendente"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.confirm_reservation(
            reservation_id, 
            current_user.tenant_id,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{reservation_id}/check-in", response_model=ReservationResponse)
def check_in_reservation(
    reservation_id: int,
    check_in_data: CheckInRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-in da reserva"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.check_in_reservation(
            reservation_id, 
            current_user.tenant_id,
            check_in_data,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{reservation_id}/check-out", response_model=ReservationResponse)
def check_out_reservation(
    reservation_id: int,
    check_out_data: CheckOutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-out da reserva"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.check_out_reservation(
            reservation_id, 
            current_user.tenant_id,
            check_out_data,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
def cancel_reservation(
    reservation_id: int,
    cancel_data: CancelReservationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancela uma reserva"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.cancel_reservation(
            reservation_id, 
            current_user.tenant_id,
            cancel_data,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


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
    from datetime import date
    
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
            status_code=status.HTTP_400_BAD_REQUEST,
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
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica"),
    days_back: int = Query(30, ge=1, le=365, description="Dias para análise")
):
    """Obtém estatísticas para dashboard"""
    reservation_service = ReservationService(db)
    
    # Stats gerais
    general_stats = reservation_service.get_reservation_stats(current_user.tenant_id, property_id)
    
    # Stats dos últimos N dias
    from datetime import date, timedelta
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
        'average_daily_reservations': len(recent_reservations) / days_back if days_back > 0 else 0
    }


# Endpoint adicional para busca avançada
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


# Endpoints para análises específicas
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
            status_code=status.HTTP_400_BAD_REQUEST,
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