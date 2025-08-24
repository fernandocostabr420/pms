# backend/app/models/__init__.py

"""Database models"""

# Importar todos os modelos para registro no SQLAlchemy
from .tenant import Tenant
from .user import User

# Depois de criar outros modelos, adicionar aqui:
# from .property import Property  
# from .room import Room
# from .reservation import Reservation
# from .audit_log import AuditLog

__all__ = ["Tenant", "User"]