# backend/app/models/__init__.py
"""Database models"""

from .tenant import Tenant
from .user import User
from .audit_log import AuditLog
from .property import Property  # ← ADICIONAR ESTA LINHA

__all__ = ["Tenant", "User", "AuditLog", "Property"]  # ← ADICIONAR "Property"