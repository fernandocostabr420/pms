# backend/app/api/v1/endpoints/booking_engine.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.booking_engine_config import BookingEngineConfig
from app.schemas.common import MessageResponse

router = APIRouter()


@router.post("/properties/{property_id}/booking-engine")
def create_booking_engine_config(
    property_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria configuração do booking engine para uma propriedade"""
    
    # Verificar se já existe
    existing = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuração já existe para esta propriedade"
        )
    
    config = BookingEngineConfig(
        tenant_id=current_user.tenant_id,
        property_id=property_id,
        is_active=data.get("is_active", True),
        custom_slug=data.get("custom_slug"),
        primary_color=data.get("primary_color", "#2563eb"),
        welcome_text=data.get("welcome_text"),
        check_in_time=data.get("check_in_time", "14:00"),
        check_out_time=data.get("check_out_time", "12:00")
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return config


@router.get("/properties/{property_id}/booking-engine")
def get_booking_engine_config(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca configuração do booking engine"""
    
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    return config
