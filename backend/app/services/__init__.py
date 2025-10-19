# backend/app/services/__init__.py

"""Business logic services for the application"""

# WuBook services
from .wubook_configuration_service import WuBookConfigurationService

__all__ = [
    "WuBookConfigurationService",
]