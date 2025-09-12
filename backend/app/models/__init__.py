# backend/app/models/__init__.py

# Importar todos os modelos para que sejam detectados pelo Alembic

from .tenant import Tenant
from .user import User
from .audit_log import AuditLog
from .property import Property
from .room_type import RoomType
from .room import Room
from .guest import Guest
from .reservation import Reservation, ReservationRoom
from .room_availability import RoomAvailability
from .payment import Payment
# ✅ NOVOS IMPORTS
from .payment_method import PaymentMethod
from .sales_channel import SalesChannel

__all__ = [
    "Tenant",
    "User", 
    "AuditLog",
    "Property",
    "RoomType",
    "Room",
    "Guest",
    "Reservation",
    "ReservationRoom",
    "RoomAvailability",
    "Payment",
    # ✅ NOVOS EXPORTS
    "PaymentMethod",
    "SalesChannel"
]