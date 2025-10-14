# backend/app/schemas/user.py

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """Schema base para User"""
    email: EmailStr
    full_name: str
    is_active: bool = True


class UserCreate(UserBase):
    """Schema para criação de User"""
    password: str
    tenant_id: int
    is_superuser: bool = False
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Senha deve ter pelo menos 6 caracteres')
        return v
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Nome deve ter pelo menos 2 caracteres')
        return v.strip()


class UserUpdate(BaseModel):
    """Schema para atualização de User"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if v and len(v.strip()) < 2:
            raise ValueError('Nome deve ter pelo menos 2 caracteres')
        return v.strip() if v else v


class UserChangePassword(BaseModel):
    """Schema para alteração de senha"""
    current_password: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Nova senha deve ter pelo menos 6 caracteres')
        return v


class AdminResetPassword(BaseModel):
    """Schema para admin resetar senha de usuário"""
    new_password: str
    must_change_password: bool = True
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Nova senha deve ter pelo menos 6 caracteres')
        return v


class UserResponse(UserBase):
    """Schema para resposta de User"""
    id: int
    tenant_id: int
    is_superuser: bool
    email_verified: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserWithTenant(UserResponse):
    """Schema de User com dados do Tenant"""
    tenant_name: str
    tenant_slug: str