# backend/app/schemas/guest.py

from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class GuestBase(BaseModel):
    """Schema base para Guest"""
    first_name: str = Field(..., min_length=2, max_length=100, description="Primeiro nome")
    last_name: str = Field(..., min_length=2, max_length=100, description="Sobrenome")
    email: Optional[EmailStr] = Field(None, description="Email do hóspede")
    phone: Optional[str] = Field(None, max_length=20, description="Telefone")
    
    # Documento
    document_type: Optional[str] = Field(None, description="Tipo do documento")
    document_number: Optional[str] = Field(None, max_length=50, description="Número do documento")
    
    # Dados pessoais
    date_of_birth: Optional[date] = Field(None, description="Data de nascimento")
    nationality: str = Field(default="Brasil", max_length=100, description="Nacionalidade")
    
    # Endereço
    address_line1: Optional[str] = Field(None, max_length=200, description="Endereço")
    address_line2: Optional[str] = Field(None, max_length=200, description="Complemento")
    city: Optional[str] = Field(None, max_length=100, description="Cidade")
    state: Optional[str] = Field(None, max_length=100, description="Estado")
    postal_code: Optional[str] = Field(None, max_length=20, description="CEP")
    country: str = Field(default="Brasil", max_length=100, description="País")
    
    # Preferências
    preferences: Optional[Dict[str, Any]] = Field(None, description="Preferências")
    notes: Optional[str] = Field(None, max_length=2000, description="Observações")
    marketing_consent: str = Field(default="not_asked", description="Consentimento marketing")


class GuestCreate(GuestBase):
    """Schema para criação de Guest"""
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v):
        v = v.strip()
        if not v.replace(' ', '').replace('-', '').replace("'", '').isalpha():
            raise ValueError('Nome deve conter apenas letras, espaços, hífens e apostrofes')
        return v.title()
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not v:
            return v
        # Remover caracteres não numéricos para validação
        numbers_only = ''.join(filter(str.isdigit, v))
        if len(numbers_only) < 10:
            raise ValueError('Telefone deve ter pelo menos 10 dígitos')
        return v
    
    @field_validator('document_type')
    @classmethod
    def validate_document_type(cls, v):
        if not v:
            return v
        allowed_types = ['cpf', 'passport', 'rg', 'cnh', 'other']
        if v.lower() not in allowed_types:
            raise ValueError(f'Tipo de documento deve ser: {", ".join(allowed_types)}')
        return v.lower()
    
    @field_validator('document_number')
    @classmethod
    def validate_document_number(cls, v):
        if not v:
            return v
        # Remover caracteres especiais comuns
        cleaned = v.replace('.', '').replace('-', '').replace('/', '').replace(' ', '')
        if len(cleaned) < 5:
            raise ValueError('Número do documento deve ter pelo menos 5 caracteres')
        return cleaned.upper()
    
    @field_validator('date_of_birth')
    @classmethod
    def validate_birth_date(cls, v):
        if not v:
            return v
        today = date.today()
        if v >= today:
            raise ValueError('Data de nascimento deve ser no passado')
        # Verificar idade mínima (digamos 16 anos) e máxima (150 anos)
        age = (today - v).days / 365.25
        if age < 16:
            raise ValueError('Hóspede deve ter pelo menos 16 anos')
        if age > 150:
            raise ValueError('Data de nascimento inválida')
        return v
    
    @field_validator('marketing_consent')
    @classmethod
    def validate_marketing_consent(cls, v):
        allowed_values = ['yes', 'no', 'not_asked']
        if v not in allowed_values:
            raise ValueError(f'Consentimento deve ser: {", ".join(allowed_values)}')
        return v


class GuestUpdate(BaseModel):
    """Schema para atualização de Guest"""
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    
    document_type: Optional[str] = None
    document_number: Optional[str] = Field(None, max_length=50)
    
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = Field(None, max_length=100)
    
    address_line1: Optional[str] = Field(None, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    
    preferences: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=2000)
    marketing_consent: Optional[str] = None
    is_active: Optional[bool] = None
    
    # Aplicar mesmas validações do Create quando fornecidos
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v):
        if not v:
            return v
        v = v.strip()
        if not v.replace(' ', '').replace('-', '').replace("'", '').isalpha():
            raise ValueError('Nome deve conter apenas letras, espaços, hífens e apostrofes')
        return v.title()
    
    @field_validator('document_type')
    @classmethod
    def validate_document_type(cls, v):
        if not v:
            return v
        allowed_types = ['cpf', 'passport', 'rg', 'cnh', 'other']
        if v.lower() not in allowed_types:
            raise ValueError(f'Tipo de documento deve ser: {", ".join(allowed_types)}')
        return v.lower()


class GuestResponse(GuestBase):
    """Schema para resposta de Guest"""
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    full_name: Optional[str] = None
    display_document: Optional[str] = None
    full_address: Optional[str] = None
    
    class Config:
        from_attributes = True


class GuestWithStats(GuestResponse):
    """Schema de Guest com estatísticas"""
    total_reservations: int = 0
    completed_stays: int = 0
    cancelled_reservations: int = 0
    total_nights: int = 0
    last_stay_date: Optional[date] = None


class GuestListResponse(BaseModel):
    """Schema para lista de hóspedes"""
    guests: List[GuestResponse]
    total: int
    page: int
    pages: int
    per_page: int


# Schema para filtros
class GuestFilters(BaseModel):
    """Schema para filtros de busca de hóspedes"""
    has_email: Optional[bool] = None
    has_document: Optional[bool] = None
    nationality: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    marketing_consent: Optional[str] = None
    search: Optional[str] = None  # Busca em nome/email/documento