# backend/app/models/__init__.py

"""
Importar todos os modelos para que sejam detectados pelo Alembic
e possam ser utilizados em toda a aplicação.
"""

# Core models
from .tenant import Tenant
from .user import User
from .audit_log import AuditLog

# Property & Room models
from .property import Property
from .room_type import RoomType
from .room import Room
from .room_availability import RoomAvailability

# Guest & Reservation models
from .guest import Guest
from .reservation import Reservation, ReservationRoom

# Payment models
from .payment import Payment
from .payment_method import PaymentMethod

# Sales & Channel models
from .sales_channel import SalesChannel

# Restrictions
from .reservation_restriction import ReservationRestriction

# WuBook Integration models
from .wubook_configuration import WuBookConfiguration
from .wubook_room_mapping import WuBookRoomMapping
from .wubook_rate_plan import WuBookRatePlan
from .wubook_sync_log import WuBookSyncLog

# ✅ NOVO: Public Booking Engine
from .booking_engine_config import BookingEngineConfig


# Exportar todos os modelos
__all__ = [
    # Core
    "Tenant",
    "User",
    "AuditLog",
    
    # Property & Rooms
    "Property",
    "RoomType",
    "Room",
    "RoomAvailability",
    
    # Guest & Reservations
    "Guest",
    "Reservation",
    "ReservationRoom",
    
    # Payments
    "Payment",
    "PaymentMethod",
    
    # Sales
    "SalesChannel",
    
    # Restrictions
    "ReservationRestriction",
    
    # WuBook Integration
    "WuBookConfiguration",
    "WuBookRoomMapping",
    "WuBookRatePlan",
    "WuBookSyncLog",
    
    # ✅ NOVO: Public Booking Engine
    "BookingEngineConfig",
]