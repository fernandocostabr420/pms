# backend/app/api/v1/endpoints/properties.py - COM ENDPOINTS DE ESTACIONAMENTO

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
    PropertyWithStats,
    ParkingConfigUpdate,  # ✅ NOVO
    ParkingConfigResponse  # ✅ NOVO
)
from app.schemas.reservation import (
    ParkingAvailabilityRequest,  # ✅ NOVO
    ParkingAvailabilityResponse  # ✅ NOVO
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
    has_parking: Optional[bool] = Query(None, description="Filtrar por estacionamento"),  # ✅ NOVO
    parking_policy: Optional[str] = Query(None, description="Filtrar por política de estacionamento"),  # ✅ NOVO
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
        has_parking=has_parking,  # ✅ NOVO
        parking_policy=parking_policy,  # ✅ NOVO
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


# ===== NOVOS ENDPOINTS PARA ESTACIONAMENTO =====

@router.get("/{property_id}/parking", response_model=ParkingConfigResponse)
def get_parking_config(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca configuração de estacionamento da propriedade"""
    property_service = PropertyService(db)
    property_obj = property_service.get_property_by_id(property_id, current_user.tenant_id)
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    return ParkingConfigResponse(
        property_id=property_obj.id,
        property_name=property_obj.name,
        parking_enabled=getattr(property_obj, 'parking_enabled', False),
        parking_spots_total=getattr(property_obj, 'parking_spots_total', 0),
        parking_policy=getattr(property_obj, 'parking_policy', 'integral'),
        parking_policy_display=property_obj.parking_policy_display if hasattr(property_obj, 'parking_policy_display') else 'Não configurado',
        has_parking=property_obj.has_parking if hasattr(property_obj, 'has_parking') else False,
        updated_at=property_obj.updated_at
    )


@router.put("/{property_id}/parking", response_model=ParkingConfigResponse)
def update_parking_config(
    property_id: int,
    parking_config: ParkingConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza configuração de estacionamento da propriedade"""
    property_service = PropertyService(db)
    
    try:
        property_obj = property_service.update_parking_config(
            property_id,
            current_user.tenant_id,
            parking_config,
            current_user,
            request
        )
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        return ParkingConfigResponse(
            property_id=property_obj.id,
            property_name=property_obj.name,
            parking_enabled=property_obj.parking_enabled,
            parking_spots_total=property_obj.parking_spots_total or 0,
            parking_policy=property_obj.parking_policy or 'integral',
            parking_policy_display=property_obj.parking_policy_display,
            has_parking=property_obj.has_parking,
            updated_at=property_obj.updated_at
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{property_id}/parking/check-availability", response_model=ParkingAvailabilityResponse)
def check_parking_availability(
    property_id: int,
    availability_request: ParkingAvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica disponibilidade de estacionamento para um período"""
    
    # Verificar se a propriedade existe no tenant
    property_service = PropertyService(db)
    property_obj = property_service.get_property_by_id(property_id, current_user.tenant_id)
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    # Verificar se o property_id da requisição bate com o do endpoint
    if availability_request.property_id != property_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property ID na URL deve coincidir com o da requisição"
        )
    
    try:
        from app.services.parking_service import ParkingService
        
        parking_service = ParkingService(db)
        availability_response = parking_service.check_parking_availability(
            availability_request, 
            current_user.tenant_id
        )
        
        return availability_response
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao verificar disponibilidade de estacionamento: {str(e)}"
        )


@router.get("/{property_id}/parking/occupancy", response_model=dict)
def get_parking_occupancy(
    property_id: int,
    date_from: str = Query(..., description="Data inicial (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Data final (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca ocupação do estacionamento por período"""
    
    from datetime import datetime, date as date_type
    
    try:
        # Converter strings para datas
        start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data inicial deve ser anterior à data final"
            )
        
        # Verificar se a propriedade existe no tenant
        property_service = PropertyService(db)
        property_obj = property_service.get_property_by_id(property_id, current_user.tenant_id)
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        from app.services.parking_service import ParkingService
        
        parking_service = ParkingService(db)
        occupancy_data = parking_service.get_parking_occupancy(
            property_id,
            start_date,
            end_date,
            current_user.tenant_id
        )
        
        return occupancy_data
        
    except ValueError as ve:
        if "time data" in str(ve):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de data inválido. Use YYYY-MM-DD"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar ocupação do estacionamento: {str(e)}"
        )


# ===== ENDPOINTS EXISTENTES (MANTIDOS) =====

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
    
    # ✅ IMPLEMENTAR ESTATÍSTICAS COM ESTACIONAMENTO
    from app.schemas.property import PropertyStats
    
    try:
        # Buscar estatísticas básicas
        from app.models.room import Room
        from app.models.reservation import Reservation
        from sqlalchemy import func
        
        # Contar quartos
        total_rooms = db.query(func.count(Room.id)).filter(
            Room.property_id == property_id,
            Room.tenant_id == current_user.tenant_id,
            Room.is_active == True
        ).scalar() or 0
        
        # Contar reservas ativas
        active_reservations = db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),
            Reservation.is_active == True
        ).scalar() or 0
        
        # Contar reservas totais
        total_reservations = db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        ).scalar() or 0
        
        # ✅ NOVO: Estatísticas de estacionamento
        parking_requests = db.query(func.count(Reservation.id)).filter(
            Reservation.property_id == property_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.parking_requested == True,
            Reservation.is_active == True
        ).scalar() or 0
        
        # Calcular disponibilidade de estacionamento hoje
        today = datetime.now().date()
        parking_spots_total = getattr(property_obj, 'parking_spots_total', 0)
        parking_availability = 0.0
        
        if parking_spots_total > 0:
            occupied_spots_today = db.query(func.count(Reservation.id)).filter(
                Reservation.property_id == property_id,
                Reservation.tenant_id == current_user.tenant_id,
                Reservation.parking_requested == True,
                Reservation.status.in_(['confirmed', 'checked_in']),
                Reservation.check_in_date <= today,
                Reservation.check_out_date > today,
                Reservation.is_active == True
            ).scalar() or 0
            
            available_spots = parking_spots_total - occupied_spots_today
            parking_availability = (available_spots / parking_spots_total) * 100 if parking_spots_total > 0 else 0
        
        stats = PropertyStats(
            total_rooms=total_rooms,
            occupied_rooms=0,  # TODO: Implementar lógica de quartos ocupados
            available_rooms=total_rooms,  # TODO: Implementar lógica de quartos disponíveis
            occupancy_rate=0.0,  # TODO: Implementar cálculo de ocupação
            total_reservations=total_reservations,
            active_reservations=active_reservations,
            parking_requests=parking_requests,
            parking_availability=parking_availability
        )
        
        property_response = PropertyResponse.model_validate(property_obj)
        
        return PropertyWithStats(**property_response.dict(), stats=stats)
        
    except Exception as e:
        # Se der erro nas estatísticas, retornar stats zeradas
        property_response = PropertyResponse.model_validate(property_obj)
        
        stats = PropertyStats(
            total_rooms=0,
            occupied_rooms=0,
            available_rooms=0,
            occupancy_rate=0.0,
            total_reservations=0,
            active_reservations=0,
            parking_requests=0,
            parking_availability=0.0
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