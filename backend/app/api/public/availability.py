# backend/app/api/public/availability.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal
import logging

from app.core.database import get_db
from app.models.property import Property
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.room_availability import RoomAvailability
from app.models.wubook_rate_plan import WuBookRatePlan
from app.services.room_availability_service import RoomAvailabilityService
from app.api.public.middleware import verify_public_access

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/search")
def search_availability(
    slug: str = Query(..., description="Slug da propriedade"),
    check_in: date = Query(..., description="Data de check-in"),
    check_out: date = Query(..., description="Data de check-out"),
    adults: int = Query(2, ge=1, le=10, description="Número de adultos"),
    children: int = Query(0, ge=0, le=10, description="Número de crianças"),
    room_type_id: Optional[int] = Query(None, description="Filtrar por tipo de quarto"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Busca disponibilidade de quartos para datas específicas.
    Retorna quartos disponíveis com tarifas calculadas.
    
    Endpoint público - não requer autenticação.
    """
    try:
        # Validações básicas
        if check_out <= check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data de check-out deve ser posterior ao check-in"
            )
        
        nights = (check_out - check_in).days
        
        if nights > 90:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período máximo de reserva é 90 dias"
            )
        
        total_guests = adults + children
        
        # Buscar propriedade
        property_obj = db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        # Buscar quartos disponíveis
        availability_service = RoomAvailabilityService(db)
        
        # Query base de quartos
        rooms_query = db.query(Room).join(RoomType).filter(
            Room.tenant_id == property_obj.tenant_id,
            Room.is_active == True,
            Room.is_operational == True,
            RoomType.is_bookable == True
        )
        
        # Filtrar por tipo se especificado
        if room_type_id:
            rooms_query = rooms_query.filter(Room.room_type_id == room_type_id)
        
        # Filtrar por capacidade
        rooms_query = rooms_query.filter(
            Room.max_occupancy >= total_guests
        )
        
        available_rooms = rooms_query.all()
        
        if not available_rooms:
            return {
                "property_name": property_obj.name,
                "check_in": check_in.isoformat(),
                "check_out": check_out.isoformat(),
                "nights": nights,
                "adults": adults,
                "children": children,
                "available_rooms": [],
                "message": "Nenhum quarto disponível para o período e capacidade solicitados"
            }
        
        # Verificar disponibilidade real de cada quarto
        results = []
        
        for room in available_rooms:
            # Verificar se está disponível em todas as noites
            availability_check = availability_service.check_room_availability(
                room.id,
                check_in,
                check_out,
                property_obj.tenant_id,
                validate_restrictions=False
            )
            
            if not availability_check['available']:
                continue
            
            # Calcular tarifa total
            total_rate = availability_check.get('total_rate', 0)
            
            # Buscar rate plan padrão para o quarto
            default_rate_plan = db.query(WuBookRatePlan).filter(
                WuBookRatePlan.room_type_id == room.room_type_id,
                WuBookRatePlan.is_active == True,
                WuBookRatePlan.is_default == True
            ).first()
            
            rate_plan_info = None
            if default_rate_plan:
                rate_plan_info = {
                    "id": default_rate_plan.id,
                    "name": default_rate_plan.name,
                    "description": default_rate_plan.description,
                    "cancellation_policy": default_rate_plan.cancellation_policy
                }
            
            # Montar informações do quarto
            room_info = {
                "room_id": room.id,
                "room_number": room.room_number,
                "room_name": room.name,
                "room_type": {
                    "id": room.room_type.id,
                    "name": room.room_type.name,
                    "slug": room.room_type.slug,
                    "description": room.room_type.description,
                    "base_capacity": room.room_type.base_capacity,
                    "max_capacity": room.room_type.max_capacity,
                    "size_m2": float(room.room_type.size_m2) if room.room_type.size_m2 else None,
                    "bed_configuration": room.room_type.bed_configuration,
                    "amenities": room.room_type.amenities or []
                },
                "max_occupancy": room.max_occupancy,
                "additional_amenities": room.additional_amenities or [],
                "pricing": {
                    "total_amount": float(total_rate) if total_rate else 0.0,
                    "nights": nights,
                    "average_per_night": float(total_rate / nights) if total_rate and nights > 0 else 0.0,
                    "currency": "BRL"
                },
                "rate_plan": rate_plan_info,
                "availability": {
                    "is_available": True,
                    "check_in": check_in.isoformat(),
                    "check_out": check_out.isoformat()
                }
            }
            
            results.append(room_info)
        
        # Ordenar por preço (menor para maior)
        results.sort(key=lambda x: x["pricing"]["total_amount"])
        
        logger.info(f"Busca pública: {slug} | {check_in} a {check_out} | {len(results)} quartos disponíveis")
        
        return {
            "property_name": property_obj.name,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "nights": nights,
            "adults": adults,
            "children": children,
            "total_guests": total_guests,
            "available_rooms": results,
            "total_results": len(results)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na busca de disponibilidade pública: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar disponibilidade"
        )


@router.get("/room/{room_id}/calendar")
def get_room_calendar(
    room_id: int,
    date_from: date = Query(..., description="Data inicial"),
    date_to: date = Query(..., description="Data final"),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Retorna calendário de disponibilidade de um quarto específico.
    Útil para exibir calendário visual no frontend.
    
    Endpoint público.
    """
    try:
        # Validar período
        if date_to <= date_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data final deve ser posterior à data inicial"
            )
        
        days = (date_to - date_from).days
        if days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período máximo é 365 dias"
            )
        
        # Buscar quarto
        room = db.query(Room).filter(
            Room.id == room_id,
            Room.is_active == True
        ).first()
        
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quarto não encontrado"
            )
        
        # Buscar disponibilidade do período
        availabilities = db.query(RoomAvailability).filter(
            RoomAvailability.room_id == room_id,
            RoomAvailability.date >= date_from,
            RoomAvailability.date <= date_to
        ).order_by(RoomAvailability.date).all()
        
        # Montar calendário
        calendar = []
        current_date = date_from
        
        while current_date <= date_to:
            # Buscar disponibilidade do dia
            day_availability = next(
                (a for a in availabilities if a.date == current_date),
                None
            )
            
            if day_availability:
                calendar.append({
                    "date": current_date.isoformat(),
                    "is_available": day_availability.is_available,
                    "is_bookable": day_availability.is_bookable,
                    "rate": float(day_availability.rate_override) if day_availability.rate_override else None,
                    "min_stay": day_availability.min_stay or 1,
                    "closed_to_arrival": day_availability.closed_to_arrival,
                    "closed_to_departure": day_availability.closed_to_departure
                })
            else:
                # Dia sem configuração = disponível
                calendar.append({
                    "date": current_date.isoformat(),
                    "is_available": True,
                    "is_bookable": True,
                    "rate": None,
                    "min_stay": 1,
                    "closed_to_arrival": False,
                    "closed_to_departure": False
                })
            
            current_date += timedelta(days=1)
        
        return {
            "room_id": room.id,
            "room_number": room.room_number,
            "room_name": room.name,
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "total_days": len(calendar),
            "calendar": calendar
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar calendário do quarto: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar calendário"
        )