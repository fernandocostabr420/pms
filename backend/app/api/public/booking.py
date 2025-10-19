# backend/app/api/public/booking.py

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
import secrets
import logging

from app.core.database import get_db
from app.schemas.public_booking import PublicBookingCreate, PublicBookingResponse
from app.services.public_booking_service import PublicBookingService
from app.api.public.middleware import verify_public_access

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/create", response_model=PublicBookingResponse, status_code=status.HTTP_201_CREATED)
def create_public_booking(
    booking_data: PublicBookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Cria uma nova reserva através do motor de reservas público.
    
    Fluxo:
    1. Valida dados do hóspede e disponibilidade
    2. Calcula valores totais
    3. Cria reserva com status 'pending_confirmation'
    4. Gera token único para acompanhamento
    5. Envia notificações (background)
    
    Endpoint público - não requer autenticação.
    """
    try:
        booking_service = PublicBookingService(db)
        
        # Criar reserva
        reservation = booking_service.create_booking(booking_data)
        
        # Agendar envio de notificações em background
        background_tasks.add_task(
            booking_service.send_booking_notifications,
            reservation.id,
            reservation.tenant_id
        )
        
        logger.info(f"Reserva pública criada: ID {reservation.id} | Token {reservation.public_token}")
        
        # Retornar resposta
        return PublicBookingResponse(
            reservation_id=reservation.id,
            reservation_number=reservation.reservation_number,
            public_token=reservation.public_token,
            status=reservation.status,
            guest_name=reservation.guest_name,
            guest_email=reservation.guest_email,
            guest_phone=reservation.guest_phone,
            check_in_date=reservation.check_in_date,
            check_out_date=reservation.check_out_date,
            nights=reservation.nights,
            adults=reservation.adults,
            children=reservation.children,
            room_info={
                "room_id": reservation.room_id,
                "room_number": reservation.room.room_number if reservation.room else None,
                "room_name": reservation.room.name if reservation.room else None,
                "room_type": reservation.room.room_type.name if reservation.room and reservation.room.room_type else None
            },
            pricing={
                "total_amount": float(reservation.total_amount),
                "nights": reservation.nights,
                "currency": "BRL"
            },
            payment_method=reservation.payment_method,
            special_requests=reservation.special_requests,
            created_at=reservation.created_at,
            message="Reserva criada com sucesso! Você receberá um e-mail de confirmação em breve.",
            tracking_url=f"/booking/track/{reservation.public_token}"
        )
        
    except ValueError as e:
        # Erros de validação de negócio
        logger.warning(f"Erro de validação na criação de reserva pública: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar reserva pública: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar reserva. Tente novamente."
        )


@router.get("/track/{token}", response_model=Dict[str, Any])
def track_booking(
    token: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Permite acompanhar o status de uma reserva usando o token público.
    
    Endpoint público - não requer autenticação.
    """
    try:
        booking_service = PublicBookingService(db)
        reservation = booking_service.get_booking_by_token(token)
        
        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        return {
            "reservation_number": reservation.reservation_number,
            "status": reservation.status,
            "guest_name": reservation.guest_name,
            "check_in_date": reservation.check_in_date.isoformat(),
            "check_out_date": reservation.check_out_date.isoformat(),
            "nights": reservation.nights,
            "adults": reservation.adults,
            "children": reservation.children,
            "room_info": {
                "room_number": reservation.room.room_number if reservation.room else None,
                "room_name": reservation.room.name if reservation.room else None,
                "room_type": reservation.room.room_type.name if reservation.room and reservation.room.room_type else None
            },
            "total_amount": float(reservation.total_amount),
            "payment_method": reservation.payment_method,
            "special_requests": reservation.special_requests,
            "created_at": reservation.created_at.isoformat(),
            "property_info": {
                "name": reservation.property_obj.name if reservation.property_obj else None,
                "phone": reservation.property_obj.phone if reservation.property_obj else None,
                "email": reservation.property_obj.email if reservation.property_obj else None
            },
            "status_messages": {
                "pending_confirmation": "Aguardando confirmação da propriedade",
                "confirmed": "Reserva confirmada! Aguardamos você.",
                "checked_in": "Check-in realizado",
                "checked_out": "Check-out realizado",
                "cancelled": "Reserva cancelada"
            }.get(reservation.status, "Status desconhecido")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar reserva por token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar informações da reserva"
        )


@router.post("/calculate-price")
def calculate_booking_price(
    slug: str,
    room_id: int,
    check_in: str,
    check_out: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Calcula o preço total de uma reserva antes de confirmar.
    Útil para exibir valores no checkout antes do usuário finalizar.
    
    Endpoint público.
    """
    try:
        from datetime import date
        from app.models.property import Property
        from app.services.room_availability_service import RoomAvailabilityService
        
        # Parse dates
        check_in_date = date.fromisoformat(check_in)
        check_out_date = date.fromisoformat(check_out)
        
        # Validações
        if check_out_date <= check_in_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data de check-out deve ser posterior ao check-in"
            )
        
        nights = (check_out_date - check_in_date).days
        
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
        
        # Calcular tarifa
        availability_service = RoomAvailabilityService(db)
        availability_check = availability_service.check_room_availability(
            room_id,
            check_in_date,
            check_out_date,
            property_obj.tenant_id,
            validate_restrictions=False
        )
        
        total_rate = availability_check.get('total_rate', 0)
        
        if not total_rate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível calcular o valor da reserva"
            )
        
        return {
            "check_in": check_in,
            "check_out": check_out,
            "nights": nights,
            "subtotal": float(total_rate),
            "taxes": 0.0,  # Implementar cálculo de taxas se necessário
            "service_fee": 0.0,  # Implementar taxa de serviço se necessário
            "total_amount": float(total_rate),
            "average_per_night": float(total_rate / nights) if nights > 0 else 0.0,
            "currency": "BRL",
            "breakdown": [
                {
                    "description": f"Diária x {nights} noite(s)",
                    "amount": float(total_rate)
                }
            ]
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de data inválido: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao calcular preço: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao calcular preço da reserva"
        )


@router.get("/payment-methods/{slug}")
def get_available_payment_methods(
    slug: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_public_access)
):
    """
    Retorna métodos de pagamento disponíveis para a propriedade.
    
    Endpoint público.
    """
    try:
        from app.models.property import Property
        from app.models.payment_method import PaymentMethod
        
        property_obj = db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Propriedade não encontrada"
            )
        
        # Buscar métodos de pagamento ativos do tenant, ordenados
        payment_methods = db.query(PaymentMethod).filter(
            PaymentMethod.tenant_id == property_obj.tenant_id,
            PaymentMethod.is_active == True
        ).order_by(PaymentMethod.display_order, PaymentMethod.name).all()
        
        return {
            "property_name": property_obj.name,
            "property_slug": slug,
            "payment_methods": [
                {
                    "id": pm.id,
                    "name": pm.name,
                    "code": pm.code,  # ✅ CORRIGIDO: usar 'code' ao invés de 'payment_type'
                    "description": pm.description,
                    "icon": pm.icon if pm.icon else (pm.settings.get("icon") if pm.settings else None),
                    "color": pm.color if pm.color else (pm.settings.get("color") if pm.settings else None),
                    "requires_reference": pm.requires_reference,
                    "has_fees": pm.has_fees,
                    "display_order": pm.display_order
                }
                for pm in payment_methods
            ],
            "total": len(payment_methods)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar métodos de pagamento: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar métodos de pagamento"
        )