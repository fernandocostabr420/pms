# backend/app/api/v1/endpoints/room_types.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
import math

from app.core.database import get_db
from app.services.room_type_service import RoomTypeService
from app.schemas.room_type import (
    RoomTypeCreate, 
    RoomTypeUpdate, 
    RoomTypeResponse, 
    RoomTypeListResponse,
    RoomTypeFilters,
    RoomTypeWithStats
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=RoomTypeListResponse)
def list_room_types(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    is_bookable: Optional[bool] = Query(None, description="Filtrar por status de reserva"),
    min_capacity: Optional[int] = Query(None, ge=1, le=10, description="Capacidade mínima"),
    max_capacity: Optional[int] = Query(None, ge=1, le=10, description="Capacidade máxima"),
    has_amenity: Optional[str] = Query(None, description="Filtrar por comodidade"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista tipos de quarto do tenant com filtros e paginação"""
    room_type_service = RoomTypeService(db)
    
    # Construir filtros
    filters = RoomTypeFilters(
        is_bookable=is_bookable,
        min_capacity=min_capacity,
        max_capacity=max_capacity,
        has_amenity=has_amenity,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar tipos de quarto e total
    room_types = room_type_service.get_room_types(current_user.tenant_id, filters, skip, per_page)
    total = room_type_service.count_room_types(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    room_types_response = [RoomTypeResponse.model_validate(rt) for rt in room_types]
    
    return RoomTypeListResponse(
        room_types=room_types_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/{room_type_id}", response_model=RoomTypeResponse)
def get_room_type(
    room_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca tipo de quarto específico do tenant"""
    room_type_service = RoomTypeService(db)
    room_type_obj = room_type_service.get_room_type_by_id(room_type_id, current_user.tenant_id)
    
    if not room_type_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de quarto não encontrado"
        )
    
    return RoomTypeResponse.model_validate(room_type_obj)


@router.get("/slug/{slug}", response_model=RoomTypeResponse)
def get_room_type_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca tipo de quarto por slug"""
    room_type_service = RoomTypeService(db)
    room_type_obj = room_type_service.get_room_type_by_slug(slug, current_user.tenant_id)
    
    if not room_type_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de quarto não encontrado"
        )
    
    return RoomTypeResponse.model_validate(room_type_obj)


@router.post("/", response_model=RoomTypeResponse)
def create_room_type(
    room_type_data: RoomTypeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria novo tipo de quarto no tenant atual"""
    room_type_service = RoomTypeService(db)
    
    try:
        room_type_obj = room_type_service.create_room_type(
            room_type_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return RoomTypeResponse.model_validate(room_type_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{room_type_id}", response_model=RoomTypeResponse)
def update_room_type(
    room_type_id: int,
    room_type_data: RoomTypeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza tipo de quarto"""
    room_type_service = RoomTypeService(db)
    
    try:
        room_type_obj = room_type_service.update_room_type(
            room_type_id, 
            current_user.tenant_id, 
            room_type_data,
            current_user,
            request
        )
        if not room_type_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tipo de quarto não encontrado"
            )
        return RoomTypeResponse.model_validate(room_type_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{room_type_id}", response_model=MessageResponse)
def delete_room_type(
    room_type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    force: bool = Query(False, description="Forçar exclusão mesmo com quartos vinculados")
):
    """Desativa tipo de quarto (soft delete)"""
    room_type_service = RoomTypeService(db)
    
    try:
        success = room_type_service.delete_room_type(
            room_type_id, 
            current_user.tenant_id,
            current_user,
            request,
            force
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tipo de quarto não encontrado"
            )
        
        return MessageResponse(message="Tipo de quarto desativado com sucesso")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{room_type_id}/toggle-bookable", response_model=RoomTypeResponse)
def toggle_bookable_status(
    room_type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Alterna status de reserva do tipo de quarto"""
    room_type_service = RoomTypeService(db)
    
    room_type_obj = room_type_service.toggle_bookable_status(
        room_type_id, 
        current_user.tenant_id,
        current_user,
        request
    )
    
    if not room_type_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de quarto não encontrado"
        )
    
    return RoomTypeResponse.model_validate(room_type_obj)


@router.get("/{room_type_id}/stats", response_model=RoomTypeWithStats)
def get_room_type_stats(
    room_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca tipo de quarto com estatísticas"""
    room_type_service = RoomTypeService(db)
    room_type_obj = room_type_service.get_room_type_by_id(room_type_id, current_user.tenant_id)
    
    if not room_type_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de quarto não encontrado"
        )
    
    # Buscar estatísticas
    stats = room_type_service.get_room_type_stats(room_type_id, current_user.tenant_id)
    
    # Converter para response
    room_type_response = RoomTypeResponse.model_validate(room_type_obj)
    
    return RoomTypeWithStats(
        **room_type_response.dict(),
        **stats
    )


@router.get("/meta/amenities", response_model=List[str])
def get_available_amenities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista todas as comodidades usadas nos tipos do tenant"""
    room_type_service = RoomTypeService(db)
    return room_type_service.get_available_amenities(current_user.tenant_id)


# Endpoint adicional para busca avançada
@router.post("/search", response_model=RoomTypeListResponse)
def advanced_search_room_types(
    filters: RoomTypeFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST"""
    room_type_service = RoomTypeService(db)
    
    skip = (page - 1) * per_page
    
    room_types = room_type_service.get_room_types(current_user.tenant_id, filters, skip, per_page)
    total = room_type_service.count_room_types(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    room_types_response = [RoomTypeResponse.model_validate(rt) for rt in room_types]
    
    return RoomTypeListResponse(
        room_types=room_types_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )