# backend/app/api/public/__init__.py

from fastapi import APIRouter

# Router principal da API pública
public_router = APIRouter()

# Importar routers após criar o public_router para evitar import circular
try:
    from app.api.public import properties, availability, booking
    
    # Registrar sub-routers
    public_router.include_router(
        properties.router,
        prefix="/properties",
        tags=["Public - Properties"]
    )
    
    public_router.include_router(
        availability.router,
        prefix="/availability",
        tags=["Public - Availability"]
    )
    
    public_router.include_router(
        booking.router,
        prefix="/booking",
        tags=["Public - Booking"]
    )
except ImportError as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Erro ao importar routers públicos: {e}")

__all__ = ["public_router"]