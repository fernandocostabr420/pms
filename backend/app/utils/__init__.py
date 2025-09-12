# backend/app/utils/__init__.py

"""
Utilitários para a aplicação PMS.
"""

from .pagination import get_pagination_params, calculate_pagination_info

__all__ = [
    "get_pagination_params",
    "calculate_pagination_info"
]