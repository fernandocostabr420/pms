# backend/app/api/v1/endpoints/rooms.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
import math

from app.core.database import get_db
from app.services.room_service import RoomService
from app.schemas.room import (
    RoomCreate, 
    RoomUpdate, 
    RoomResponse, 
    RoomListResponse,
    RoomFilters,
    RoomWithDetails,
    RoomBulkUpdate,
    RoomStats
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=RoomListResponse)
def list_rooms(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    room_type_id: Optional[int] = Query(None, description="Filtrar por tipo de quarto"),
    floor: Optional[int] = Query(None, ge=0, le=50, description="Filtrar por andar"),
    building: Optional[str] = Query(None, description="Filtrar por edifício"),
    is_operational: Optional[bool] = Query(None, description="Filtrar por status operacional"),
    is_out_of_order: Optional[bool] = Query(None, description="Filtrar por fora de funcionamento"),
    is_available_for_booking: Optional[bool] = Query(None, description="Filtrar por disponível para reserva"),
    min_occupancy: Optional[int] = Query(None, ge=1, le=10, description="Capacidade mínima"),
    max_occupancy: Optional[int] = Query(None, ge=1, le=10, description="Capacidade máxima"),
    has_amenity: Optional[str] = Query(None, description="Filtrar por comodidade"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista quartos do tenant com filtros e paginação"""
    room_service = RoomService(db)
    
    # Construir filtros
    filters = RoomFilters(
        property_id=property_id,
        room_type_id=room_type_id,
        floor=floor,
        building=building,
        is_operational=is_operational,
        is_out_of_order=is_out_of_order,
        is_available_for_booking=is_available_for_booking,
        min_occupancy=min_occupancy,
        max_occupancy=max_occupancy,
        has_amenity=has_amenity,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar quartos e total
    rooms = room_service.get_rooms(current_user.tenant_id, filters, skip, per_page)
    total = room_service.count_rooms(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    rooms_response = [RoomResponse.model_validate(room) for room in rooms]
    
    return RoomListResponse(
        rooms=rooms_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca quarto específico do tenant"""
    room_service = RoomService(db)
    room_obj = room_service.get_room_by_id(room_id, current_user.tenant_id)
    
    if not room_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    return RoomResponse.model_validate(room_obj)


@router.get("/{room_id}/details", response_model=RoomWithDetails)
def get_room_with_details(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca quarto com detalhes de relacionamentos"""
    room_service = RoomService(db)
    room_obj = room_service.get_room_by_id(room_id, current_user.tenant_id)
    
    if not room_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    # Converter para response com detalhes
    room_response = RoomResponse.model_validate(room_obj)
    room_with_details = RoomWithDetails(
        **room_response.dict(),
        property_name=room_obj.property_obj.name if room_obj.property_obj else None,
        room_type_name=room_obj.room_type.name if room_obj.room_type else None
    )
    
    return room_with_details


@router.post("/", response_model=RoomResponse)
def create_room(
    room_data: RoomCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria novo quarto no tenant atual"""
    room_service = RoomService(db)
    
    try:
        room_obj = room_service.create_room(
            room_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return RoomResponse.model_validate(room_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    room_data: RoomUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza quarto"""
    room_service = RoomService(db)
    
    try:
        room_obj = room_service.update_room(
            room_id, 
            current_user.tenant_id, 
            room_data,
            current_user,
            request
        )
        if not room_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quarto não encontrado"
            )
        return RoomResponse.model_validate(room_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{room_id}", response_model=MessageResponse)
def delete_room(
    room_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Desativa quarto (soft delete)"""
    room_service = RoomService(db)
    
    success = room_service.delete_room(
        room_id, 
        current_user.tenant_id,
        current_user,
        request
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    return MessageResponse(message="Quarto desativado com sucesso")


@router.patch("/{room_id}/toggle-operational", response_model=RoomResponse)
def toggle_operational_status(
    room_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Alterna status operacional do quarto"""
    room_service = RoomService(db)
    
    room_obj = room_service.toggle_operational_status(
        room_id, 
        current_user.tenant_id,
        current_user,
        request
    )
    
    if not room_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    return RoomResponse.model_validate(room_obj)


@router.post("/bulk-update", response_model=Dict[str, Any])
def bulk_update_rooms(
    bulk_data: RoomBulkUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualização em lote de quartos"""
    room_service = RoomService(db)
    
    try:
        result = room_service.bulk_update_rooms(
            bulk_data,
            current_user.tenant_id,
            current_user,
            request
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/by-property/{property_id}", response_model=List[RoomResponse])
def get_rooms_by_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista quartos de uma propriedade específica"""
    room_service = RoomService(db)
    rooms = room_service.get_rooms_by_property(property_id, current_user.tenant_id)
    
    return [RoomResponse.model_validate(room) for room in rooms]


@router.get("/by-type/{room_type_id}", response_model=List[RoomResponse])
def get_rooms_by_type(
    room_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista quartos de um tipo específico"""
    room_service = RoomService(db)
    rooms = room_service.get_rooms_by_type(room_type_id, current_user.tenant_id)
    
    return [RoomResponse.model_validate(room) for room in rooms]


@router.get("/stats/general", response_model=RoomStats)
def get_room_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica")
):
    """Obtém estatísticas gerais dos quartos"""
    room_service = RoomService(db)
    stats = room_service.get_room_stats(current_user.tenant_id, property_id)
    
    return RoomStats(**stats)


# Endpoint adicional para busca avançada
@router.post("/search", response_model=RoomListResponse)
def advanced_search_rooms(
    filters: RoomFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST"""
    room_service = RoomService(db)
    
    skip = (page - 1) * per_page
    
    rooms = room_service.get_rooms(current_user.tenant_id, filters, skip, per_page)
    total = room_service.count_rooms(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    rooms_response = [RoomResponse.model_validate(room) for room in rooms]
    
    return RoomListResponse(
        rooms=rooms_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


# Endpoint para verificar disponibilidade de número de quarto
@router.get("/check-number/{room_number}", response_model=Dict[str, bool])
def check_room_number_availability(
    room_number: str,
    property_id: int = Query(..., description="ID da propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica se número do quarto está disponível na propriedade"""
    room_service = RoomService(db)
    
    existing_room = room_service.get_room_by_number(
        room_number, 
        property_id, 
        current_user.tenant_id
    )
    
    return {
        "available": existing_room is None
    }