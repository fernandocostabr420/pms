# backend/app/schemas/__init__.py

"""Pydantic schemas for API serialization and validation"""

# Tenant schemas
from .tenant import (
    TenantBase,
    TenantCreate,
    TenantUpdate,
    TenantResponse
)

# User schemas  
from .user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserChangePassword,
    UserResponse,
    UserWithTenant
)

# Auth schemas
from .auth import (
    LoginRequest,
    Token,
    TokenRefresh,
    TokenData,
    RegisterRequest,
    AuthResponse
)

# Common schemas
from .common import (
    MessageResponse,
    ErrorResponse,
    PaginatedResponse,
    HealthCheck
)

# Audit schemas
from .audit import (
    AuditLogResponse,
    AuditLogWithUser,
    AuditTrailResponse,
    AuditSummary,
    AuditFilters
)

# Property schemas
from .property import (
    PropertyBase,
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    PropertyListResponse,
    PropertyStats,
    PropertyWithStats,
    PropertyFilters
)

# Room Type schemas
from .room_type import (
    RoomTypeBase,
    RoomTypeCreate,
    RoomTypeUpdate,
    RoomTypeResponse,
    RoomTypeListResponse,
    RoomTypeWithStats,
    RoomTypeFilters
)

# Room schemas
from .room import (
    RoomBase,
    RoomCreate,
    RoomUpdate,
    RoomResponse,
    RoomListResponse,
    RoomWithDetails,
    RoomBulkUpdate,
    RoomFilters,
    RoomStats
)

# Guest schemas
from .guest import (
    GuestBase,
    GuestCreate,
    GuestUpdate,
    GuestResponse,
    GuestListResponse,
    GuestWithStats,
    GuestFilters
)

# Reservation schemas
from .reservation import (
    ReservationBase,
    ReservationCreate,
    ReservationUpdate,
    ReservationResponse,
    ReservationListResponse,
    ReservationWithDetails,
    ReservationRoomBase,
    ReservationRoomCreate,
    ReservationRoomResponse,
    CheckInRequest,
    CheckOutRequest,
    CancelReservationRequest,
    AvailabilityRequest,
    AvailabilityResponse,
    ReservationFilters
)

__all__ = [
    # Tenant
    "TenantBase",
    "TenantCreate", 
    "TenantUpdate",
    "TenantResponse",
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate", 
    "UserChangePassword",
    "UserResponse",
    "UserWithTenant",
    # Auth
    "LoginRequest",
    "Token",
    "TokenRefresh",
    "TokenData", 
    "RegisterRequest",
    "AuthResponse",
    # Common
    "MessageResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "HealthCheck",
    # Audit
    "AuditLogResponse",
    "AuditLogWithUser",
    "AuditTrailResponse",
    "AuditSummary",
    "AuditFilters",
    # Property
    "PropertyBase",
    "PropertyCreate",
    "PropertyUpdate", 
    "PropertyResponse",
    "PropertyListResponse",
    "PropertyStats",
    "PropertyWithStats",
    "PropertyFilters",
    # Room Type
    "RoomTypeBase",
    "RoomTypeCreate",
    "RoomTypeUpdate",
    "RoomTypeResponse",
    "RoomTypeListResponse",
    "RoomTypeWithStats",
    "RoomTypeFilters",
    # Room
    "RoomBase",
    "RoomCreate",
    "RoomUpdate",
    "RoomResponse",
    "RoomListResponse",
    "RoomWithDetails",
    "RoomBulkUpdate",
    "RoomFilters",
    "RoomStats",
    # Guest
    "GuestBase",
    "GuestCreate",
    "GuestUpdate",
    "GuestResponse",
    "GuestListResponse",
    "GuestWithStats",
    "GuestFilters",
    # Reservation
    "ReservationBase",
    "ReservationCreate",
    "ReservationUpdate",
    "ReservationResponse",
    "ReservationListResponse",
    "ReservationWithDetails",
    "ReservationRoomBase",
    "ReservationRoomCreate",
    "ReservationRoomResponse",
    "CheckInRequest",
    "CheckOutRequest",
    "CancelReservationRequest",
    "AvailabilityRequest",
    "AvailabilityResponse",
    "ReservationFilters",
]