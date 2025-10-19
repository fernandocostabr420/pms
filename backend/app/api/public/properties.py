# backend/app/api/public/properties.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging

from app.core.database import get_db
from app.models.property import Property
from app.models.booking_engine_config import BookingEngineConfig
from app.models.room_type import RoomType
from app.api.public.middleware import verify_public_access

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{slug}", response_model=Dict[str, Any])
def get_property_public_info(
    slug: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Retorna informações públicas de uma propriedade pelo slug.
    Endpoint público - não requer autenticação.
    
    Args:
        slug: Slug único da propriedade
        
    Returns:
        Dados completos da propriedade para exibição no booking engine
    """
    try:
        # Buscar propriedade pelo slug
        property_obj = db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        # Buscar configuração do booking engine
        booking_config = db.query(BookingEngineConfig).filter(
            BookingEngineConfig.property_id == property_obj.id,
            BookingEngineConfig.is_active == True
        ).first()
        
        if not booking_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Motor de reservas não configurado para esta propriedade"
            )
        
        # Buscar tipos de quarto disponíveis
        room_types = db.query(RoomType).filter(
            RoomType.tenant_id == property_obj.tenant_id,
            RoomType.is_active == True,
            RoomType.is_bookable == True
        ).all()
        
        # Construir resposta
        response = {
            "property": {
                "id": property_obj.id,
                "name": property_obj.name,
                "slug": property_obj.slug,
                "description": property_obj.description,
                "address": {
                    "street": property_obj.address,
                    "city": property_obj.city,
                    "state": property_obj.state,
                    "country": property_obj.country,
                    "postal_code": property_obj.postal_code,
                    "full_address": f"{property_obj.address}, {property_obj.city} - {property_obj.state}, {property_obj.postal_code}"
                },
                "contact": {
                    "phone": property_obj.phone,
                    "email": property_obj.email,
                    "website": property_obj.website
                },
                "settings": property_obj.settings or {}
            },
            "booking_engine": {
                "logo_url": booking_config.logo_url,
                "primary_color": booking_config.primary_color,
                "welcome_text": booking_config.welcome_text,
                "gallery_photos": booking_config.gallery_photos or [],
                "testimonials": booking_config.testimonials or [],
                "social_links": booking_config.social_links or {},
                "cancellation_policy": booking_config.cancellation_policy,
                "house_rules": booking_config.house_rules,
                "check_in_time": booking_config.check_in_time,
                "check_out_time": booking_config.check_out_time
            },
            "room_types": [
                {
                    "id": rt.id,
                    "name": rt.name,
                    "slug": rt.slug,
                    "description": rt.description,
                    "base_capacity": rt.base_capacity,
                    "max_capacity": rt.max_capacity,
                    "size_m2": float(rt.size_m2) if rt.size_m2 else None,
                    "bed_configuration": rt.bed_configuration,
                    "amenities": rt.amenities or []
                }
                for rt in room_types
            ],
            "amenities": property_obj.settings.get("amenities", []) if property_obj.settings else [],
            "policies": {
                "cancellation": booking_config.cancellation_policy,
                "house_rules": booking_config.house_rules,
                "check_in": booking_config.check_in_time,
                "check_out": booking_config.check_out_time
            }
        }
        
        logger.info(f"Propriedade pública acessada: {slug}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar propriedade pública {slug}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar informações da propriedade"
        )


@router.get("/{slug}/amenities")
def get_property_amenities(
    slug: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Retorna lista de comodidades da propriedade.
    Endpoint público.
    """
    try:
        property_obj = db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        amenities = property_obj.settings.get("amenities", []) if property_obj.settings else []
        
        return {
            "property_name": property_obj.name,
            "amenities": amenities,
            "total": len(amenities)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar comodidades: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar comodidades"
        )


@router.get("/{slug}/policies")
def get_property_policies(
    slug: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Retorna políticas da propriedade (cancelamento, regras da casa).
    Endpoint público.
    """
    try:
        property_obj = db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        booking_config = db.query(BookingEngineConfig).filter(
            BookingEngineConfig.property_id == property_obj.id,
            BookingEngineConfig.is_active == True
        ).first()
        
        if not booking_config:
            return {
                "property_name": property_obj.name,
                "cancellation_policy": "Política de cancelamento não configurada",
                "house_rules": "Regras da casa não configuradas",
                "check_in_time": "14:00",
                "check_out_time": "12:00"
            }
        
        return {
            "property_name": property_obj.name,
            "cancellation_policy": booking_config.cancellation_policy,
            "house_rules": booking_config.house_rules,
            "check_in_time": booking_config.check_in_time,
            "check_out_time": booking_config.check_out_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar políticas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar políticas"
        )