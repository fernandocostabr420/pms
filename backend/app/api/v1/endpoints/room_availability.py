# backend/app/api/v1/endpoints/room_availability.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import date, timedelta
import math

from app.core.database import get_db
from app.services.room_availability_service import RoomAvailabilityService
from app.schemas.room_availability import (
    RoomAvailabilityCreate,
    RoomAvailabilityUpdate,
    RoomAvailabilityResponse,
    RoomAvailabilityListResponse,
    RoomAvailabilityFilters,
    BulkAvailabilityUpdate,
    CalendarAvailabilityRequest,
    CalendarAvailabilityResponse,
    AvailabilityStatsResponse
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=RoomAvailabilityListResponse)
def list_availabilities(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros básicos
    room_id: Optional[int] = Query(None, description="Filtrar por quarto"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    room_type_id: Optional[int] = Query(None, description="Filtrar por tipo de quarto"),
    
    # Filtros de data
    date_from: Optional[date] = Query(None, description="Data inicial"),
    date_to: Optional[date] = Query(None, description="Data final"),
    
    # Filtros de status
    is_available: Optional[bool] = Query(None, description="Disponível"),
    is_blocked: Optional[bool] = Query(None, description="Bloqueado"),
    is_out_of_order: Optional[bool] = Query(None, description="Fora de funcionamento"),
    is_maintenance: Optional[bool] = Query(None, description="Em manutenção"),
    is_reserved: Optional[bool] = Query(None, description="Reservado"),
    is_bookable: Optional[bool] = Query(None, description="Pode ser reservado"),
    
    # Filtros de restrições
    closed_to_arrival: Optional[bool] = Query(None, description="Fechado para chegada"),
    closed_to_departure: Optional[bool] = Query(None, description="Fechado para saída"),
    
    # Filtros de preço
    has_rate_override: Optional[bool] = Query(None, description="Tem preço específico"),
    min_rate: Optional[float] = Query(None, ge=0, description="Preço mínimo"),
    max_rate: Optional[float] = Query(None, ge=0, description="Preço máximo"),
    
    # Busca textual
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista disponibilidades com filtros e paginação"""
    availability_service = RoomAvailabilityService(db)
    
    # Construir filtros
    filters = RoomAvailabilityFilters(
        room_id=room_id,
        property_id=property_id,
        room_type_id=room_type_id,
        date_from=date_from,
        date_to=date_to,
        is_available=is_available,
        is_blocked=is_blocked,
        is_out_of_order=is_out_of_order,
        is_maintenance=is_maintenance,
        is_reserved=is_reserved,
        closed_to_arrival=closed_to_arrival,
        closed_to_departure=closed_to_departure,
        has_rate_override=has_rate_override,
        min_rate=min_rate,
        max_rate=max_rate,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar disponibilidades e total
    availabilities = availability_service.get_availabilities(
        current_user.tenant_id, filters, skip, per_page
    )
    total = availability_service.count_availabilities(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    availabilities_response = []
    for availability in availabilities:
        response_data = RoomAvailabilityResponse.model_validate(availability)
        
        # Adicionar dados relacionados
        if availability.room:
            response_data.room_number = availability.room.room_number
            response_data.room_name = availability.room.name
            if availability.room.room_type:
                response_data.room_type_name = availability.room.room_type.name
            if availability.room.property_obj:
                response_data.property_name = availability.room.property_obj.name
        
        # Adicionar campos computados
        response_data.status = availability.status
        response_data.is_bookable = availability.is_bookable
        
        availabilities_response.append(response_data)
    
    return RoomAvailabilityListResponse(
        availabilities=availabilities_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/{availability_id}", response_model=RoomAvailabilityResponse)
def get_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca disponibilidade específica"""
    availability_service = RoomAvailabilityService(db)
    availability = availability_service.get_availability_by_id(availability_id, current_user.tenant_id)
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disponibilidade não encontrada"
        )
    
    response_data = RoomAvailabilityResponse.model_validate(availability)
    
    # Adicionar dados relacionados
    if availability.room:
        response_data.room_number = availability.room.room_number
        response_data.room_name = availability.room.name
        if availability.room.room_type:
            response_data.room_type_name = availability.room.room_type.name
        if availability.room.property_obj:
            response_data.property_name = availability.room.property_obj.name
    
    # Adicionar campos computados
    response_data.status = availability.status
    response_data.is_bookable = availability.is_bookable
    
    return response_data


@router.post("/", response_model=RoomAvailabilityResponse)
def create_availability(
    availability_data: RoomAvailabilityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova disponibilidade"""
    availability_service = RoomAvailabilityService(db)
    
    try:
        availability = availability_service.create_availability(
            availability_data, 
            current_user.tenant_id
        )
        
        response_data = RoomAvailabilityResponse.model_validate(availability)
        response_data.status = availability.status
        response_data.is_bookable = availability.is_bookable
        
        return response_data
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{availability_id}", response_model=RoomAvailabilityResponse)
def update_availability(
    availability_id: int,
    availability_data: RoomAvailabilityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza disponibilidade existente"""
    availability_service = RoomAvailabilityService(db)
    
    try:
        availability = availability_service.update_availability(
            availability_id, 
            availability_data, 
            current_user.tenant_id
        )
        
        if not availability:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Disponibilidade não encontrada"
            )
        
        response_data = RoomAvailabilityResponse.model_validate(availability)
        response_data.status = availability.status
        response_data.is_bookable = availability.is_bookable
        
        return response_data
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{availability_id}", response_model=MessageResponse)
def delete_availability(
    availability_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove disponibilidade"""
    availability_service = RoomAvailabilityService(db)
    
    success = availability_service.delete_availability(availability_id, current_user.tenant_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disponibilidade não encontrada"
        )
    
    return MessageResponse(message="Disponibilidade removida com sucesso")


@router.post("/bulk-update", response_model=Dict[str, Any])
def bulk_update_availability(
    bulk_data: BulkAvailabilityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualização em massa de disponibilidades"""
    availability_service = RoomAvailabilityService(db)
    
    try:
        result = availability_service.bulk_update_availability(bulk_data, current_user.tenant_id)
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/room/{room_id}/calendar", response_model=List[RoomAvailabilityResponse])
def get_room_calendar(
    room_id: int,
    date_from: date = Query(..., description="Data inicial"),
    date_to: date = Query(..., description="Data final"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Calendário de disponibilidade de um quarto específico"""
    availability_service = RoomAvailabilityService(db)
    
    # Validar período (máximo 1 ano)
    if (date_to - date_from).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    # Usar filtros para buscar apenas este quarto
    filters = RoomAvailabilityFilters(
        room_id=room_id,
        date_from=date_from,
        date_to=date_to
    )
    
    availabilities = availability_service.get_availabilities(
        current_user.tenant_id, filters, 0, 1000
    )
    
    # Converter para response
    result = []
    for availability in availabilities:
        response_data = RoomAvailabilityResponse.model_validate(availability)
        response_data.status = availability.status
        response_data.is_bookable = availability.is_bookable
        
        if availability.room:
            response_data.room_number = availability.room.room_number
            response_data.room_name = availability.room.name
        
        result.append(response_data)
    
    return result


@router.post("/calendar/range", response_model=List[CalendarAvailabilityResponse])
def get_calendar_range(
    calendar_request: CalendarAvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Calendário de disponibilidade por período"""
    availability_service = RoomAvailabilityService(db)
    
    # Validar período (máximo 1 ano)
    if (calendar_request.date_to - calendar_request.date_from).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    calendar_data = availability_service.get_calendar_availability(
        calendar_request, current_user.tenant_id
    )
    
    # Converter para response
    result = []
    for day_data in calendar_data:
        availabilities_response = []
        for availability in day_data['availabilities']:
            response_data = RoomAvailabilityResponse.model_validate(availability)
            response_data.status = availability.status
            response_data.is_bookable = availability.is_bookable
            
            if availability.room:
                response_data.room_number = availability.room.room_number
                response_data.room_name = availability.room.name
                if availability.room.room_type:
                    response_data.room_type_name = availability.room.room_type.name
                if availability.room.property_obj:
                    response_data.property_name = availability.room.property_obj.name
            
            availabilities_response.append(response_data)
        
        result.append(CalendarAvailabilityResponse(
            date=day_data['date'],
            availabilities=availabilities_response,
            summary=day_data['summary']
        ))
    
    return result


@router.get("/check/{room_id}", response_model=Dict[str, Any])
def check_room_availability(
    room_id: int,
    check_in_date: date = Query(..., description="Data de check-in"),
    check_out_date: date = Query(..., description="Data de check-out"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica disponibilidade de um quarto em período específico"""
    availability_service = RoomAvailabilityService(db)
    
    # Validações
    if check_out_date <= check_in_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de check-out deve ser posterior ao check-in"
        )
    
    if (check_out_date - check_in_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    result = availability_service.check_room_availability(
        room_id, check_in_date, check_out_date, current_user.tenant_id
    )
    
    return result


@router.get("/stats/general", response_model=AvailabilityStatsResponse)
def get_availability_stats(
    date_from: Optional[date] = Query(None, description="Data inicial"),
    date_to: Optional[date] = Query(None, description="Data final"),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Estatísticas gerais de disponibilidade"""
    availability_service = RoomAvailabilityService(db)
    
    stats = availability_service.get_availability_stats(
        current_user.tenant_id,
        date_from=date_from,
        date_to=date_to,
        property_id=property_id
    )
    
    return AvailabilityStatsResponse(**stats)


@router.get("/room/{room_id}/date/{target_date}", response_model=RoomAvailabilityResponse)
def get_room_availability_by_date(
    room_id: int,
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca disponibilidade específica de um quarto em uma data"""
    availability_service = RoomAvailabilityService(db)
    
    availability = availability_service.get_availability_by_room_date(
        room_id, target_date, current_user.tenant_id
    )
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disponibilidade não encontrada para esta data"
        )
    
    response_data = RoomAvailabilityResponse.model_validate(availability)
    response_data.status = availability.status
    response_data.is_bookable = availability.is_bookable
    
    if availability.room:
        response_data.room_number = availability.room.room_number
        response_data.room_name = availability.room.name
        if availability.room.room_type:
            response_data.room_type_name = availability.room.room_type.name
        if availability.room.property_obj:
            response_data.property_name = availability.room.property_obj.name
    
    return response_data