# backend/app/schemas/property.py

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class PropertyBase(BaseModel):
    """Schema base para Property"""
    name: str = Field(..., min_length=2, max_length=200, description="Nome da propriedade")
    slug: str = Field(..., min_length=2, max_length=100, description="Slug URL-friendly")
    description: Optional[str] = Field(None, max_length=2000, description="Descrição da propriedade")
    property_type: str = Field(..., description="Tipo: hotel, pousada, hostel, apartamento")
    
    # Endereço
    address_line1: str = Field(..., min_length=5, max_length=200, description="Endereço principal")
    address_line2: Optional[str] = Field(None, max_length=200, description="Complemento")
    city: str = Field(..., min_length=2, max_length=100, description="Cidade")
    state: str = Field(..., min_length=2, max_length=100, description="Estado/UF")
    postal_code: Optional[str] = Field(None, max_length=20, description="CEP")
    country: str = Field(default="Brasil", max_length=100, description="País")
    
    # Coordenadas
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90, description="Latitude")
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180, description="Longitude")
    
    # Contato
    phone: Optional[str] = Field(None, max_length=20, description="Telefone")
    email: Optional[str] = Field(None, max_length=255, description="Email")
    website: Optional[str] = Field(None, max_length=255, description="Website")
    
    # Horários
    check_in_time: str = Field(default="14:00", description="Horário check-in padrão")
    check_out_time: str = Field(default="12:00", description="Horário check-out padrão")
    
    # ✅ NOVO: Configurações de Estacionamento
    parking_enabled: bool = Field(default=False, description="Estacionamento disponível")
    parking_spots_total: Optional[int] = Field(None, ge=0, le=999, description="Número total de vagas de estacionamento")
    parking_policy: Optional[str] = Field(default="integral", description="Política de estacionamento: 'integral' ou 'flexible'")
    
    # Metadados
    amenities: Optional[List[str]] = Field(None, description="Lista de comodidades")
    policies: Optional[Dict[str, Any]] = Field(None, description="Políticas da propriedade")
    settings: Optional[Dict[str, Any]] = Field(None, description="Configurações específicas")
    
    # Status
    is_operational: bool = Field(default=True, description="Propriedade em funcionamento")


class PropertyCreate(PropertyBase):
    """Schema para criação de Property"""
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Slug deve conter apenas letras, números, hífens e underscores')
        return v.lower()
    
    @field_validator('property_type')
    @classmethod
    def validate_property_type(cls, v):
        allowed_types = ['hotel', 'pousada', 'hostel', 'apartamento', 'resort', 'flat', 'casa']
        if v.lower() not in allowed_types:
            raise ValueError(f'Tipo deve ser um de: {", ".join(allowed_types)}')
        return v.lower()
    
    @field_validator('check_in_time', 'check_out_time')
    @classmethod
    def validate_time_format(cls, v):
        if not v:
            return v
        try:
            # Validar formato HH:MM
            parts = v.split(':')
            if len(parts) != 2:
                raise ValueError
            hour, minute = int(parts[0]), int(parts[1])
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError
        except (ValueError, IndexError):
            raise ValueError('Horário deve estar no formato HH:MM (ex: 14:00)')
        return v
    
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
    
    @field_validator('amenities')
    @classmethod
    def validate_amenities(cls, v):
        if not v:
            return v
        if len(v) > 50:  # Limite razoável
            raise ValueError('Máximo 50 comodidades permitidas')
        # Converter para lowercase e remover duplicatas
        return list(set(item.lower().strip() for item in v if item.strip()))
    
    # ✅ NOVO: Validadores para Estacionamento
    @field_validator('parking_policy')
    @classmethod
    def validate_parking_policy(cls, v):
        if not v:
            return "integral"  # Padrão
        if v.lower() not in ["integral", "flexible"]:
            raise ValueError('Política deve ser "integral" ou "flexible"')
        return v.lower()
    
    @field_validator('parking_spots_total')
    @classmethod
    def validate_parking_spots(cls, v, info):
        parking_enabled = info.data.get('parking_enabled', False)
        
        # Se estacionamento está habilitado, deve ter pelo menos 1 vaga
        if parking_enabled and (not v or v <= 0):
            raise ValueError('Quando estacionamento está habilitado, deve ter pelo menos 1 vaga')
        
        # Se estacionamento não está habilitado, pode ser None ou 0
        if not parking_enabled and v:
            return 0  # Normalizar para 0 quando desabilitado
        
        return v


class PropertyUpdate(BaseModel):
    """Schema para atualização de Property"""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    property_type: Optional[str] = None
    
    address_line1: Optional[str] = Field(None, min_length=5, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    
    # ✅ NOVO: Campos de Estacionamento para Atualização
    parking_enabled: Optional[bool] = None
    parking_spots_total: Optional[int] = Field(None, ge=0, le=999)
    parking_policy: Optional[str] = None
    
    amenities: Optional[List[str]] = None
    policies: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    
    is_operational: Optional[bool] = None
    is_active: Optional[bool] = None
    
    # Aplicar mesmas validações do Create quando campos são fornecidos
    @field_validator('property_type')
    @classmethod
    def validate_property_type(cls, v):
        if v is None:
            return v
        allowed_types = ['hotel', 'pousada', 'hostel', 'apartamento', 'resort', 'flat', 'casa']
        if v.lower() not in allowed_types:
            raise ValueError(f'Tipo deve ser um de: {", ".join(allowed_types)}')
        return v.lower()
    
    @field_validator('check_in_time', 'check_out_time')
    @classmethod
    def validate_time_format(cls, v):
        if not v:
            return v
        try:
            parts = v.split(':')
            if len(parts) != 2:
                raise ValueError
            hour, minute = int(parts[0]), int(parts[1])
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError
        except (ValueError, IndexError):
            raise ValueError('Horário deve estar no formato HH:MM (ex: 14:00)')
        return v
    
    # ✅ NOVO: Validadores para Estacionamento (Update)
    @field_validator('parking_policy')
    @classmethod
    def validate_parking_policy(cls, v):
        if v is None:
            return None
        if v.lower() not in ["integral", "flexible"]:
            raise ValueError('Política deve ser "integral" ou "flexible"')
        return v.lower()


class PropertyResponse(PropertyBase):
    """Schema para resposta de Property"""
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    full_address: Optional[str] = None
    is_available_for_booking: Optional[bool] = None
    
    # ✅ NOVO: Campos computados para Estacionamento
    has_parking: Optional[bool] = None
    parking_policy_display: Optional[str] = None
    
    class Config:
        from_attributes = True


class PropertyListResponse(BaseModel):
    """Schema para lista de propriedades com metadados"""
    properties: List[PropertyResponse]
    total: int
    page: int
    pages: int
    per_page: int


class PropertyStats(BaseModel):
    """Schema para estatísticas da propriedade"""
    total_rooms: int = 0
    occupied_rooms: int = 0  
    available_rooms: int = 0
    occupancy_rate: float = 0.0  # Percentual
    total_reservations: int = 0
    active_reservations: int = 0
    
    # ✅ NOVO: Estatísticas de Estacionamento
    parking_requests: int = 0
    parking_availability: float = 0.0  # Percentual disponível hoje


class PropertyWithStats(PropertyResponse):
    """Schema de propriedade com estatísticas"""
    stats: Optional[PropertyStats] = None


# ✅ NOVO: Schema específico para configuração de estacionamento
class ParkingConfigUpdate(BaseModel):
    """Schema para atualização apenas das configurações de estacionamento"""
    parking_enabled: bool
    parking_spots_total: Optional[int] = Field(None, ge=0, le=999)
    parking_policy: str = Field(default="integral")
    
    @field_validator('parking_policy')
    @classmethod
    def validate_parking_policy(cls, v):
        if v.lower() not in ["integral", "flexible"]:
            raise ValueError('Política deve ser "integral" ou "flexible"')
        return v.lower()
    
    @field_validator('parking_spots_total')
    @classmethod
    def validate_parking_spots(cls, v, info):
        parking_enabled = info.data.get('parking_enabled', False)
        
        if parking_enabled and (not v or v <= 0):
            raise ValueError('Quando estacionamento está habilitado, deve ter pelo menos 1 vaga')
        
        if not parking_enabled:
            return 0  # Forçar 0 quando desabilitado
        
        return v


class ParkingConfigResponse(BaseModel):
    """Schema para resposta de configuração de estacionamento"""
    property_id: int
    property_name: str
    parking_enabled: bool
    parking_spots_total: Optional[int] = 0
    parking_policy: str
    parking_policy_display: str
    has_parking: bool
    updated_at: datetime


# Schemas para filtros e busca
class PropertyFilters(BaseModel):
    """Schema para filtros de busca de propriedades"""
    property_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_operational: Optional[bool] = None
    has_amenity: Optional[str] = None  # Buscar por comodidade específica
    search: Optional[str] = None  # Busca textual em nome/descrição
    
    # ✅ NOVO: Filtros para Estacionamento
    has_parking: Optional[bool] = None  # Filtrar propriedades com estacionamento
    parking_policy: Optional[str] = None  # Filtrar por política específica