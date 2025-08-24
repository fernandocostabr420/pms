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
]