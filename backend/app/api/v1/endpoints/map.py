# backend/app/api/v1/endpoints/map.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Body
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import math

from app.core.database import get_db
from app.services.map_service import MapService
from app.schemas.map import (
    MapDataRequest, MapResponse, MapStatsResponse, 
    MapBulkOperation, MapQuickBooking
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/data", response_model=MapResponse)
def get_map_data(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    room_type_ids: Optional[str] = Query(None, description="IDs dos tipos de quarto separados por vírgula"),
    include_out_of_order: bool = Query(True, description="Incluir quartos fora de funcionamento"),
    include_cancelled: bool = Query(False, description="Incluir reservas canceladas"),
    status_filter: Optional[str] = Query(None, description="Status das reservas separados por vírgula")
):
    """
    Busca dados completos para o mapa de quartos
    """
    map_service = MapService(db)
    
    # Validar período máximo
    if (end_date - start_date).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 90 dias"
        )
    
    # Processar filtros
    room_type_ids_list = None
    if room_type_ids:
        try:
            room_type_ids_list = [int(x.strip()) for x in room_type_ids.split(',') if x.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IDs de tipos de quarto inválidos"
            )
    
    status_filter_list = None
    if status_filter:
        status_filter_list = [x.strip() for x in status_filter.split(',') if x.strip()]
    
    # Construir requisição
    map_request = MapDataRequest(
        start_date=start_date,
        end_date=end_date,
        property_id=property_id,
        room_type_ids=room_type_ids_list,
        include_out_of_order=include_out_of_order,
        include_cancelled=include_cancelled,
        status_filter=status_filter_list
    )
    
    try:
        return map_service.get_map_data(current_user.tenant_id, map_request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/stats", response_model=MapStatsResponse)
def get_map_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """
    Busca estatísticas do mapa para um período
    """
    map_service = MapService(db)
    
    # Validar período máximo
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    try:
        return map_service.get_map_stats(
            current_user.tenant_id, 
            start_date, 
            end_date, 
            property_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.post("/bulk-operation", response_model=Dict[str, Any])
def execute_bulk_operation(
    operation: MapBulkOperation,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa operação em lote no mapa (bloquear/desbloquear quartos, manutenção, etc.)
    """
    map_service = MapService(db)
    
    # Validar período máximo para operação
    if (operation.date_to - operation.date_from).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período da operação não pode exceder 365 dias"
        )
    
    # Validar tipo de operação
    valid_operations = ["block", "unblock", "maintenance", "clean"]
    if operation.operation_type not in valid_operations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de operação deve ser um de: {', '.join(valid_operations)}"
        )
    
    # Validar limite de quartos
    if len(operation.room_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operação limitada a 50 quartos por vez"
        )
    
    # Verificar se todos os quartos pertencem ao tenant
    from app.models.room import Room
    room_count = db.query(Room).filter(
        Room.id.in_(operation.room_ids),
        Room.tenant_id == current_user.tenant_id,
        Room.is_active == True
    ).count()
    
    if room_count != len(operation.room_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Um ou mais quartos não foram encontrados"
        )
    
    try:
        result = map_service.execute_bulk_operation(
            current_user.tenant_id,
            operation,
            current_user.id
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na operação: {str(e)}"
        )


@router.post("/quick-booking", response_model=Dict[str, Any])
def create_quick_booking(
    booking: MapQuickBooking,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria uma reserva rápida através do mapa
    """
    map_service = MapService(db)
    
    # Validar datas
    if booking.check_in_date >= booking.check_out_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de check-out deve ser posterior ao check-in"
        )
    
    if booking.check_in_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de check-in não pode ser no passado"
        )
    
    # Validar período máximo
    nights = (booking.check_out_date - booking.check_in_date).days
    if nights > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período da reserva não pode exceder 365 dias"
        )
    
    # Verificar se o quarto existe e pertence ao tenant
    from app.models.room import Room
    room = db.query(Room).filter(
        Room.id == booking.room_id,
        Room.tenant_id == current_user.tenant_id,
        Room.is_active == True
    ).first()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    if not room.is_operational:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quarto não está operacional"
        )
    
    # Validar capacidade
    max_guests = booking.adults + booking.children
    room_capacity = room.max_occupancy or room.room_type.max_capacity
    if max_guests > room_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Número de hóspedes ({max_guests}) excede capacidade do quarto ({room_capacity})"
        )
    
    try:
        result = map_service.create_quick_booking(
            current_user.tenant_id,
            room.property_id,
            booking,
            current_user.id
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar reserva: {str(e)}"
        )


@router.get("/room-availability/{room_id}")
def get_room_availability(
    room_id: int,
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca disponibilidade detalhada de um quarto específico
    """
    # Validar período
    if (end_date - start_date).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 90 dias"
        )
    
    # Verificar se o quarto existe e pertence ao tenant
    from app.models.room import Room
    room = db.query(Room).filter(
        Room.id == room_id,
        Room.tenant_id == current_user.tenant_id,
        Room.is_active == True
    ).first()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quarto não encontrado"
        )
    
    # Buscar reservas do quarto no período
    from app.models.reservation import Reservation, ReservationRoom
    from sqlalchemy import and_, or_
    
    reservations = db.query(Reservation).join(
        ReservationRoom, Reservation.id == ReservationRoom.reservation_id
    ).filter(
        ReservationRoom.room_id == room_id,
        Reservation.tenant_id == current_user.tenant_id,
        Reservation.is_active == True,
        Reservation.status != 'cancelled',
        or_(
            and_(Reservation.check_in_date >= start_date, Reservation.check_in_date < end_date),
            and_(Reservation.check_out_date > start_date, Reservation.check_out_date <= end_date),
            and_(Reservation.check_in_date < start_date, Reservation.check_out_date > end_date)
        )
    ).all()
    
    # Buscar disponibilidade manual
    from app.models.room_availability import RoomAvailability
    
    availability_records = db.query(RoomAvailability).filter(
        RoomAvailability.room_id == room_id,
        RoomAvailability.tenant_id == current_user.tenant_id,
        RoomAvailability.date >= start_date,
        RoomAvailability.date < end_date,
        RoomAvailability.is_active == True
    ).all()
    
    # Construir disponibilidade dia a dia
    availability_calendar = []
    current_date = start_date
    
    while current_date < end_date:
        # Verificar se há reserva nesta data
        has_reservation = any(
            r.check_in_date <= current_date < r.check_out_date
            for r in reservations
        )
        
        # Verificar configuração manual de disponibilidade
        availability_record = next(
            (a for a in availability_records if a.date == current_date),
            None
        )
        
        is_blocked = availability_record.is_blocked if availability_record else False
        is_maintenance = availability_record.is_maintenance if availability_record else room.is_out_of_order
        
        availability_calendar.append({
            "date": current_date.isoformat(),
            "is_available": not (has_reservation or is_blocked or is_maintenance),
            "is_reserved": has_reservation,
            "is_blocked": is_blocked,
            "is_maintenance": is_maintenance,
            "reservation_id": next(
                (r.id for r in reservations if r.check_in_date <= current_date < r.check_out_date),
                None
            ),
            "notes": availability_record.notes if availability_record else None
        })
        
        current_date += timedelta(days=1)
    
    return {
        "room": {
            "id": room.id,
            "room_number": room.room_number,
            "name": room.name,
            "room_type": room.room_type.name,
            "is_operational": room.is_operational,
            "is_out_of_order": room.is_out_of_order
        },
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_days": (end_date - start_date).days
        },
        "availability": availability_calendar,
        "summary": {
            "available_days": sum(1 for day in availability_calendar if day["is_available"]),
            "reserved_days": sum(1 for day in availability_calendar if day["is_reserved"]),
            "blocked_days": sum(1 for day in availability_calendar if day["is_blocked"]),
            "maintenance_days": sum(1 for day in availability_calendar if day["is_maintenance"])
        }
    }


@router.get("/category-summary")
def get_category_summary(
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca resumo das categorias de quartos para o período
    """
    # Validar período
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    from app.models.room_type import RoomType
    from app.models.room import Room
    from app.models.reservation import Reservation, ReservationRoom
    from sqlalchemy import func, case, and_, or_
    
    # Query base para tipos de quarto
    query = db.query(
        RoomType.id,
        RoomType.name,
        RoomType.slug,
        RoomType.base_capacity,
        RoomType.max_capacity,
        func.count(Room.id).label('total_rooms'),
        func.sum(case(
            (Room.is_operational == True, 1),
            else_=0
        )).label('operational_rooms'),
        func.sum(case(
            (Room.is_out_of_order == True, 1),
            else_=0
        )).label('out_of_order_rooms')
    ).outerjoin(Room, RoomType.id == Room.room_type_id).filter(
        RoomType.tenant_id == current_user.tenant_id,
        RoomType.is_active == True
    )
    
    if property_id:
        query = query.filter(Room.property_id == property_id)
    
    categories = query.group_by(
        RoomType.id, RoomType.name, RoomType.slug, 
        RoomType.base_capacity, RoomType.max_capacity
    ).all()
    
    result = []
    for category in categories:
        # Buscar reservas da categoria no período
        reservations_query = db.query(Reservation).join(
            ReservationRoom, Reservation.id == ReservationRoom.reservation_id
        ).join(Room, ReservationRoom.room_id == Room.id).filter(
            Room.room_type_id == category.id,
            Room.tenant_id == current_user.tenant_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status != 'cancelled',
            or_(
                and_(Reservation.check_in_date >= start_date, Reservation.check_in_date < end_date),
                and_(Reservation.check_out_date > start_date, Reservation.check_out_date <= end_date),
                and_(Reservation.check_in_date < start_date, Reservation.check_out_date > end_date)
            )
        )
        
        if property_id:
            reservations_query = reservations_query.filter(Reservation.property_id == property_id)
        
        reservations = reservations_query.all()
        
        total_revenue = sum(r.total_amount for r in reservations)
        total_nights = sum(r.nights for r in reservations)
        
        # Calcular ocupação
        total_days = (end_date - start_date).days
        total_room_nights = (category.operational_rooms or 0) * total_days
        occupied_nights = 0
        
        for reservation in reservations:
            res_start = max(reservation.check_in_date, start_date)
            res_end = min(reservation.check_out_date, end_date)
            if res_start < res_end:
                occupied_nights += (res_end - res_start).days
        
        occupancy_rate = (occupied_nights / total_room_nights * 100) if total_room_nights > 0 else 0
        
        result.append({
            "room_type_id": category.id,
            "room_type_name": category.name,
            "room_type_slug": category.slug,
            "base_capacity": category.base_capacity,
            "max_capacity": category.max_capacity,
            "total_rooms": category.total_rooms or 0,
            "operational_rooms": category.operational_rooms or 0,
            "out_of_order_rooms": category.out_of_order_rooms or 0,
            "total_reservations": len(reservations),
            "total_revenue": float(total_revenue),
            "total_nights": total_nights,
            "occupancy_rate": round(occupancy_rate, 2),
            "average_daily_rate": float(total_revenue / occupied_nights) if occupied_nights > 0 else 0
        })
    
    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_days": (end_date - start_date).days
        },
        "property_id": property_id,
        "categories": result,
        "summary": {
            "total_categories": len(result),
            "total_rooms": sum(c["total_rooms"] for c in result),
            "total_operational_rooms": sum(c["operational_rooms"] for c in result),
            "total_reservations": sum(c["total_reservations"] for c in result),
            "total_revenue": sum(c["total_revenue"] for c in result),
            "overall_occupancy_rate": round(
                sum(c["occupancy_rate"] * c["operational_rooms"] for c in result) / 
                max(sum(c["operational_rooms"] for c in result), 1), 2
            )
        }
    }