# backend/app/schemas/auth.py

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class LoginRequest(BaseModel):
    """Schema para requisição de login"""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Schema para resposta de token JWT"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    """Schema para refresh token"""
    refresh_token: str


class TokenData(BaseModel):
    """Schema para dados do token (payload JWT)"""
    user_id: Optional[int] = None
    tenant_id: Optional[int] = None
    email: Optional[str] = None


class RegisterRequest(BaseModel):
    """Schema para registro de novo usuário"""
    email: EmailStr
    password: str
    full_name: str
    tenant_slug: str  # Tenant onde o usuário será criado
    
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


class AuthResponse(BaseModel):
    """Schema para resposta de autenticação"""
    user: dict
    tenant: dict
    token: Token