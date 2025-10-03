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

# ✅ NOVO: Rate Plan schemas
from .rate_plan import (
    RatePlanBase,
    RatePlanCreate,
    RatePlanUpdate,
    RatePlanResponse,
    RatePlanListResponse,
    RatePlanFilters,
    PricingRuleBase,
    PricingRuleCreate,
    PricingRuleUpdate,
    PricingRuleResponse,
    BulkPricingOperation,
    BulkPricingResult,
    RateCalculationRequest,
    RateCalculationResponse,
    RatePlanTypeEnum,
    PricingModeEnum
)

# ✅ WuBook schemas - APENAS OS QUE EXISTEM
from .wubook_configuration import (
    WuBookConfigurationBase,
    WuBookConfigurationCreate,
    WuBookConfigurationUpdate,
    WuBookConfigurationResponse,
    WuBookConfigurationListResponse,
    WuBookTestConnection,
    WuBookTestConnectionResult,
    WuBookConfigurationFilters,
    WuBookConfigurationStats,
    WuBookSyncRequest,
    WuBookSyncResult,
    WuBookChannelMapping,
    WuBookChannelMappingUpdate
)

from .wubook_mapping import (
    # Room Mapping
    WuBookRoomMappingBase,
    WuBookRoomMappingCreate,
    WuBookRoomMappingUpdate,
    WuBookRoomMappingResponse,
    WuBookRoomMappingBulkCreate,
    WuBookRoomSuggestion,
    # Rate Plan
    WuBookRatePlanBase,
    WuBookRatePlanCreate,
    WuBookRatePlanUpdate,
    WuBookRatePlanResponse,
    WuBookRatePlanListResponse,
    WuBookRateCalculation,
    WuBookRatePlanValidation
)

from .wubook_sync import (
    WuBookSyncLogBase,
    WuBookSyncLogCreate,
    WuBookSyncLogUpdate,
    WuBookSyncLogResponse,
    WuBookSyncLogListResponse,
    WuBookSyncLogFilters,
    WuBookSyncLogSummary,
    WuBookSyncConflict,
    WuBookSyncStats,
    WuBookSyncProgress,
    WuBookBulkSyncRequest,
    WuBookSyncSchedule,
    # Enums
    SyncTypeEnum,
    SyncDirectionEnum,
    SyncStatusEnum,
    SyncTriggerEnum
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
    # ✅ NOVO: Rate Plan
    "RatePlanBase",
    "RatePlanCreate",
    "RatePlanUpdate",
    "RatePlanResponse",
    "RatePlanListResponse",
    "RatePlanFilters",
    "PricingRuleBase",
    "PricingRuleCreate",
    "PricingRuleUpdate",
    "PricingRuleResponse",
    "BulkPricingOperation",
    "BulkPricingResult",
    "RateCalculationRequest",
    "RateCalculationResponse",
    "RatePlanTypeEnum",
    "PricingModeEnum",
    # ✅ WuBook Configuration - APENAS OS QUE EXISTEM
    "WuBookConfigurationBase",
    "WuBookConfigurationCreate",
    "WuBookConfigurationUpdate",
    "WuBookConfigurationResponse",
    "WuBookConfigurationListResponse",
    "WuBookTestConnection",
    "WuBookTestConnectionResult",
    "WuBookConfigurationFilters",
    "WuBookConfigurationStats",
    "WuBookSyncRequest",
    "WuBookSyncResult",
    "WuBookChannelMapping",
    "WuBookChannelMappingUpdate",
    # ✅ WuBook Mapping - APENAS OS QUE EXISTEM
    "WuBookRoomMappingBase",
    "WuBookRoomMappingCreate",
    "WuBookRoomMappingUpdate",
    "WuBookRoomMappingResponse",
    "WuBookRoomMappingBulkCreate",
    "WuBookRoomSuggestion",
    "WuBookRatePlanBase",
    "WuBookRatePlanCreate",
    "WuBookRatePlanUpdate",
    "WuBookRatePlanResponse",
    "WuBookRatePlanListResponse",
    "WuBookRateCalculation",
    "WuBookRatePlanValidation",
    # ✅ WuBook Sync - APENAS OS QUE EXISTEM
    "WuBookSyncLogBase",
    "WuBookSyncLogCreate",
    "WuBookSyncLogUpdate",
    "WuBookSyncLogResponse",
    "WuBookSyncLogListResponse",
    "WuBookSyncLogFilters",
    "WuBookSyncLogSummary",
    "WuBookSyncConflict",
    "WuBookSyncStats",
    "WuBookSyncProgress",
    "WuBookBulkSyncRequest",
    "WuBookSyncSchedule",
    "SyncTypeEnum",
    "SyncDirectionEnum",
    "SyncStatusEnum",
    "SyncTriggerEnum",
]