# backend/app/schemas/common.py

from pydantic import BaseModel
from typing import Optional, List, Any


class MessageResponse(BaseModel):
    """Schema para respostas simples com mensagem"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Schema para respostas de erro"""
    error: str
    details: Optional[str] = None
    success: bool = False


class PaginatedResponse(BaseModel):
    """Schema para respostas paginadas"""
    items: List[Any]
    total: int
    page: int
    pages: int
    per_page: int


class HealthCheck(BaseModel):
    """Schema para health check"""
    status: str
    database: str
    version: str
    environment: str