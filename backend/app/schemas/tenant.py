# backend/app/schemas/tenant.py

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class TenantBase(BaseModel):
    """Schema base para Tenant"""
    name: str
    slug: str


class TenantCreate(TenantBase):
    """Schema para criação de Tenant"""
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Slug deve conter apenas letras, números, hífens e underscores')
        return v.lower()
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Nome deve ter pelo menos 2 caracteres')
        return v.strip()


class TenantUpdate(BaseModel):
    """Schema para atualização de Tenant"""
    name: Optional[str] = None
    is_active: Optional[bool] = None


class TenantResponse(TenantBase):
    """Schema para resposta de Tenant"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True