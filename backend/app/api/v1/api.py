# backend/app/api/v1/api.py

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, users, tenants, audit, properties, 
    room_types, rooms, guests, reservations,
    room_availability, map, payments,
    payment_methods, sales_channels, channel_manager,
    rate_plans,
    restrictions,
    sse,
    booking_engine
)

api_router = APIRouter()

# WuBook integration
from app.api.v1.endpoints import wubook
api_router.include_router(wubook.router, prefix="/wubook", tags=["wubook"])

# Incluir rotas de autenticação
api_router.include_router(
    auth.router, 
    prefix="/auth", 
    tags=["Autenticação"]
)

# Incluir rotas de usuários
api_router.include_router(
    users.router,
    prefix="/users", 
    tags=["Usuários"]
)

# Incluir rotas de tenants
api_router.include_router(
    tenants.router,
    prefix="/tenants", 
    tags=["Tenants"]
)

# Incluir rotas de auditoria
api_router.include_router(
    audit.router,
    prefix="/audit", 
    tags=["Auditoria"]
)

# Incluir rotas de propriedades
api_router.include_router(
    properties.router, 
    prefix="/properties", 
    tags=["Propriedades"]
)

# Incluir rotas de tipos de quarto
api_router.include_router(
    room_types.router,
    prefix="/room-types", 
    tags=["Tipos de Quarto"]
)

# Incluir rotas de quartos
api_router.include_router(
    rooms.router,
    prefix="/rooms", 
    tags=["Quartos"]
)

# Incluir rotas de disponibilidade de quartos
api_router.include_router(
    room_availability.router,
    prefix="/room-availability", 
    tags=["Disponibilidade de Quartos"]
)

# Incluir rotas do mapa de quartos
api_router.include_router(
    map.router,
    prefix="/map", 
    tags=["Mapa de Quartos"]
)

# Incluir rotas de hóspedes
api_router.include_router(
    guests.router,
    prefix="/guests", 
    tags=["Hóspedes"]
)

# Incluir rotas de reservas
api_router.include_router(
    reservations.router,
    prefix="/reservations", 
    tags=["Reservas"]
)

# Incluir rotas de pagamentos
api_router.include_router(
    payments.router,
    prefix="/payments", 
    tags=["Pagamentos"]
)

# Incluir rotas de métodos de pagamento
api_router.include_router(
    payment_methods.router,
    prefix="/payment-methods", 
    tags=["Métodos de Pagamento"]
)

# Incluir rotas de canais de venda
api_router.include_router(
    sales_channels.router,
    prefix="/sales-channels", 
    tags=["Canais de Venda"]
)

# Incluir rotas de planos de tarifa
api_router.include_router(
    rate_plans.router,
    prefix="/rate-plans", 
    tags=["Planos de Tarifa"]
)

# Incluir rotas de restrições de reserva
api_router.include_router(
    restrictions.router,
    prefix="/restrictions", 
    tags=["Restrições de Reserva"]
)

# Channel Manager Integration
api_router.include_router(
    channel_manager.router,
    prefix="/channel-manager", 
    tags=["Channel Manager"]
)

# SSE: Incluir rotas de Server-Sent Events (notificações em tempo real)
api_router.include_router(
    sse.router,
    prefix="/sse", 
    tags=["SSE - Notificações em Tempo Real"]
)

# ✅ NOVO: Booking Engine Configuration
api_router.include_router(
    booking_engine.router,
    tags=["Booking Engine Config"]
)