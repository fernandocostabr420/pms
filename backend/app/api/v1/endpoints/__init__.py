# app/api/v1/endpoints/__init__.py

"""API v1 endpoints"""

from . import (
    auth,
    users, 
    tenants,
    audit,
    properties,
    room_types,
    rooms,
    room_availability,
    map,
    guests,
    reservations,
    payments  # ✅ NOVO MÓDULO
)

__all__ = [
    "auth",
    "users", 
    "tenants",
    "audit",
    "properties",
    "room_types",
    "rooms", 
    "room_availability",
    "map",
    "guests",
    "reservations",
    "payments"  # ✅ ADICIONADO
]