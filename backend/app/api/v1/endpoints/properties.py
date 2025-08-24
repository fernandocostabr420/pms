# backend/app/api/v1/endpoints/properties.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
import math

from app.core.database import get_db
from app.services.property_service import PropertyService
from app.schemas.property import (
    PropertyCreate, 
    PropertyUpdate, 
    PropertyResponse, 
    PropertyListResponse,
    PropertyFilters,
    PropertyWithStats
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=PropertyListResponse)
def list_properties(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    property_type: Optional[str] = Query(None, description="Filtrar por tipo"),
    city: Optional[str] = Query(None, description="Filtrar por cidade"),
    state: Optional[str] = Query(None, description="Filtrar por estado"),
    is_operational: Optional[bool] = Query(None, description="Filtrar por status operacional"),
    has_amenity: Optional[str] = Query(None, description="Filtrar por comodidade"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista propriedades do tenant com filtros e paginação"""
    property_service = PropertyService(db)
    
    # Construir filtros
    filters = PropertyFilters(
        property_type=property_type,
        city=city,
        state=state,
        is_operational=is_operational,
        has_amenity=has_amenity,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar propriedades e total
    properties = property_service.get_properties(current_user.tenant_id, filters, skip, per_page)
    total = property_service.count_properties(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    properties_response = [PropertyResponse.model_validate(prop) for prop in properties]
    
    return PropertyListResponse(
        properties=properties_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca propriedade específica do tenant"""
    property_service = PropertyService(db)
    property_obj = property_service.get_property_by_id(property_id, current_user.tenant_id)
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    return PropertyResponse.model_validate(property_obj)


@router.get("/slug/{slug}", response_model=PropertyResponse)
def get_property_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca propriedade por slug"""
    property_service = PropertyService(db)
    property_obj = property_service.get_property_by_slug(slug, current_user.tenant_id)
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    return PropertyResponse.model_validate(property_obj)


@router.post("/", response_model=PropertyResponse)
def create_property(
    property_data: PropertyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova propriedade no tenant atual"""
    property_service = PropertyService(db)
    
    try:
        property_obj = property_service.create_property(
            property_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return PropertyResponse.model_validate(property_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: int,
    property_data: PropertyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza propriedade"""
    property_service = PropertyService(db)
    
    try:
        property_obj = property_service.update_property(
            property_id, 
            current_user.tenant_id, 
            property_data,
            current_user,
            request
        )
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        return PropertyResponse.model_validate(property_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{property_id}", response_model=MessageResponse)
def delete_property(
    property_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Desativa propriedade (soft delete)"""
    property_service = PropertyService(db)
    
    success = property_service.delete_property(
        property_id, 
        current_user.tenant_id,
        current_user,
        request
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    return MessageResponse(message="Propriedade desativada com sucesso")


@router.patch("/{property_id}/toggle-operational", response_model=PropertyResponse)
def toggle_operational_status(
    property_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Alterna status operacional da propriedade"""
    property_service = PropertyService(db)
    
    property_obj = property_service.toggle_operational_status(
        property_id, 
        current_user.tenant_id,
        current_user,
        request
    )
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    return PropertyResponse.model_validate(property_obj)


@router.get("/meta/types", response_model=List[str])
def get_property_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista tipos de propriedades usados no tenant"""
    property_service = PropertyService(db)
    return property_service.get_property_types(current_user.tenant_id)


@router.get("/meta/cities", response_model=List[str])
def get_cities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista cidades onde o tenant tem propriedades"""
    property_service = PropertyService(db)
    return property_service.get_cities(current_user.tenant_id)


@router.get("/search/location", response_model=List[PropertyResponse])
def search_by_location(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius: float = Query(10, ge=0.1, le=100, description="Raio em km"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca propriedades próximas a uma coordenada"""
    property_service = PropertyService(db)
    
    properties = property_service.search_by_location(
        current_user.tenant_id, 
        latitude, 
        longitude, 
        radius
    )
    
    return [PropertyResponse.model_validate(prop) for prop in properties]


# Endpoint para estatísticas (futuro, quando implementarmos rooms/reservations)
@router.get("/{property_id}/stats", response_model=PropertyWithStats)
def get_property_stats(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca propriedade com estatísticas"""
    property_service = PropertyService(db)
    property_obj = property_service.get_property_by_id(property_id, current_user.tenant_id)
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    # Por enquanto, retornar stats zeradas
    # TODO: Implementar quando tivermos rooms/reservations
    property_response = PropertyResponse.model_validate(property_obj)
    
    from app.schemas.property import PropertyStats
    stats = PropertyStats(
        total_rooms=0,
        occupied_rooms=0,
        available_rooms=0,
        occupancy_rate=0.0,
        total_reservations=0,
        active_reservations=0
    )
    
    return PropertyWithStats(**property_response.dict(), stats=stats)


# Endpoint adicional para busca avançada
@router.post("/search", response_model=PropertyListResponse)
def advanced_search(
    filters: PropertyFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST"""
    property_service = PropertyService(db)
    
    skip = (page - 1) * per_page
    
    properties = property_service.get_properties(current_user.tenant_id, filters, skip, per_page)
    total = property_service.count_properties(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    properties_response = [PropertyResponse.model_validate(prop) for prop in properties]
    
    return PropertyListResponse(
        properties=properties_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )