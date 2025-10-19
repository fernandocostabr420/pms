# backend/app/schemas/room_type.py

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class RoomTypeBase(BaseModel):
    """Schema base para RoomType"""
    name: str = Field(..., min_length=2, max_length=100, description="Nome do tipo de quarto")
    slug: str = Field(..., min_length=2, max_length=100, description="Slug URL-friendly")
    description: Optional[str] = Field(None, max_length=1000, description="Descrição do tipo")
    
    # Capacidade
    base_capacity: int = Field(default=2, ge=1, le=10, description="Capacidade base")
    max_capacity: int = Field(default=2, ge=1, le=10, description="Capacidade máxima")
    
    # Características
    size_m2: Optional[Decimal] = Field(None, ge=5, le=500, description="Tamanho em m²")
    bed_configuration: Optional[Dict[str, int]] = Field(None, description="Configuração de camas")
    
    # Comodidades e configurações
    amenities: Optional[List[str]] = Field(None, description="Lista de comodidades")
    settings: Optional[Dict[str, Any]] = Field(None, description="Configurações específicas")
    
    # Status
    is_bookable: bool = Field(default=True, description="Disponível para reserva")


class RoomTypeCreate(RoomTypeBase):
    """Schema para criação de RoomType"""
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Slug deve conter apenas letras, números, hífens e underscores')
        return v.lower()
    
    @field_validator('max_capacity')
    @classmethod
    def validate_max_capacity(cls, v, info):
        base_capacity = info.data.get('base_capacity', 2)
        if v < base_capacity:
            raise ValueError('Capacidade máxima não pode ser menor que a capacidade base')
        return v
    
    @field_validator('bed_configuration')
    @classmethod
    def validate_bed_configuration(cls, v):
        if not v:
            return v
        
        valid_bed_types = ['single', 'double', 'queen', 'king', 'bunk', 'sofa_bed']
        for bed_type, count in v.items():
            if bed_type not in valid_bed_types:
                raise ValueError(f'Tipo de cama inválido: {bed_type}. Use: {", ".join(valid_bed_types)}')
            if not isinstance(count, int) or count < 0:
                raise ValueError(f'Quantidade de {bed_type} deve ser um número inteiro não negativo')
        
        return v
    
    @field_validator('amenities')
    @classmethod
    def validate_amenities(cls, v):
        if not v:
            return v
        if len(v) > 30:
            raise ValueError('Máximo 30 comodidades permitidas')
        # Remover duplicatas e normalizar
        return list(set(item.lower().strip() for item in v if item.strip()))


class RoomTypeUpdate(BaseModel):
    """Schema para atualização de RoomType"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    base_capacity: Optional[int] = Field(None, ge=1, le=10)
    max_capacity: Optional[int] = Field(None, ge=1, le=10)
    size_m2: Optional[Decimal] = Field(None, ge=5, le=500)
    bed_configuration: Optional[Dict[str, int]] = None
    amenities: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    is_bookable: Optional[bool] = None
    is_active: Optional[bool] = None
    
    # Aplicar mesmas validações do Create quando campos são fornecidos
    @field_validator('max_capacity')
    @classmethod
    def validate_max_capacity(cls, v, info):
        if v is None:
            return v
        base_capacity = info.data.get('base_capacity')
        if base_capacity and v < base_capacity:
            raise ValueError('Capacidade máxima não pode ser menor que a capacidade base')
        return v
    
    @field_validator('bed_configuration')
    @classmethod
    def validate_bed_configuration(cls, v):
        if not v:
            return v
        valid_bed_types = ['single', 'double', 'queen', 'king', 'bunk', 'sofa_bed']
        for bed_type, count in v.items():
            if bed_type not in valid_bed_types:
                raise ValueError(f'Tipo de cama inválido: {bed_type}')
            if not isinstance(count, int) or count < 0:
                raise ValueError(f'Quantidade de {bed_type} deve ser um número inteiro não negativo')
        return v
    
    @field_validator('amenities')
    @classmethod
    def validate_amenities(cls, v):
        if not v:
            return v
        if len(v) > 30:
            raise ValueError('Máximo 30 comodidades permitidas')
        return list(set(item.lower().strip() for item in v if item.strip()))


class RoomTypeResponse(RoomTypeBase):
    """Schema para resposta de RoomType"""
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    amenities_list: Optional[List[str]] = None
    bed_info: Optional[str] = None
    
    class Config:
        from_attributes = True


class RoomTypeWithStats(RoomTypeResponse):
    """Schema de RoomType com estatísticas"""
    total_rooms: int = 0
    operational_rooms: int = 0
    out_of_order_rooms: int = 0


class RoomTypeListResponse(BaseModel):
    """Schema para lista de tipos de quarto"""
    room_types: List[RoomTypeResponse]
    total: int
    page: int
    pages: int
    per_page: int


# Schema para filtros
class RoomTypeFilters(BaseModel):
    """Schema para filtros de busca de tipos de quarto"""
    is_bookable: Optional[bool] = None
    min_capacity: Optional[int] = Field(None, ge=1, le=10)
    max_capacity: Optional[int] = Field(None, ge=1, le=10)
    has_amenity: Optional[str] = None
    search: Optional[str] = None  # Busca em nome/descrição