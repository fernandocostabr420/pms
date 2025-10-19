# backend/app/schemas/room.py

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class RoomBase(BaseModel):
    """Schema base para Room"""
    name: str = Field(..., min_length=2, max_length=100, description="Nome do quarto")
    room_number: str = Field(..., min_length=1, max_length=20, description="Número do quarto")
    
    # Relacionamentos
    property_id: int = Field(..., description="ID da propriedade")
    room_type_id: int = Field(..., description="ID do tipo de quarto")
    
    # Localização
    floor: Optional[int] = Field(None, ge=0, le=50, description="Andar")
    building: Optional[str] = Field(None, max_length=50, description="Edifício/Bloco")
    
    # Capacidade específica
    max_occupancy: Optional[int] = Field(None, ge=1, le=10, description="Capacidade máxima específica")
    
    # Configurações específicas
    bed_configuration: Optional[Dict[str, int]] = Field(None, description="Config específica de camas")
    additional_amenities: Optional[List[str]] = Field(None, description="Comodidades extras")
    removed_amenities: Optional[List[str]] = Field(None, description="Comodidades removidas")
    
    # Status
    is_operational: bool = Field(default=True, description="Operacional")
    is_out_of_order: bool = Field(default=False, description="Fora de funcionamento")
    
    # Observações
    notes: Optional[str] = Field(None, max_length=1000, description="Observações gerais")
    maintenance_notes: Optional[str] = Field(None, max_length=1000, description="Notas de manutenção")
    housekeeping_notes: Optional[str] = Field(None, max_length=1000, description="Notas da governança")
    
    # Configurações
    settings: Optional[Dict[str, Any]] = Field(None, description="Configurações específicas")


class RoomCreate(RoomBase):
    """Schema para criação de Room"""
    
    @field_validator('room_number')
    @classmethod
    def validate_room_number(cls, v):
        # Permitir números, letras e alguns caracteres especiais
        if not v.replace('-', '').replace('_', '').replace(' ', '').isalnum():
            raise ValueError('Número do quarto deve conter apenas letras, números, hífens, underscores e espaços')
        return v.strip().upper()
    
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
    
    @field_validator('additional_amenities', 'removed_amenities')
    @classmethod
    def validate_amenities_lists(cls, v):
        if not v:
            return v
        if len(v) > 20:
            raise ValueError('Máximo 20 comodidades por lista')
        # Normalizar
        return list(set(item.lower().strip() for item in v if item.strip()))
    
    @field_validator('building')
    @classmethod
    def validate_building(cls, v):
        if not v:
            return v
        return v.strip().title()


class RoomUpdate(BaseModel):
    """Schema para atualização de Room"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    room_number: Optional[str] = Field(None, min_length=1, max_length=20)
    room_type_id: Optional[int] = None
    
    floor: Optional[int] = Field(None, ge=0, le=50)
    building: Optional[str] = Field(None, max_length=50)
    max_occupancy: Optional[int] = Field(None, ge=1, le=10)
    
    bed_configuration: Optional[Dict[str, int]] = None
    additional_amenities: Optional[List[str]] = None
    removed_amenities: Optional[List[str]] = None
    
    is_operational: Optional[bool] = None
    is_out_of_order: Optional[bool] = None
    is_active: Optional[bool] = None
    
    notes: Optional[str] = Field(None, max_length=1000)
    maintenance_notes: Optional[str] = Field(None, max_length=1000)
    housekeeping_notes: Optional[str] = Field(None, max_length=1000)
    
    settings: Optional[Dict[str, Any]] = None
    
    # Aplicar mesmas validações do Create
    @field_validator('room_number')
    @classmethod
    def validate_room_number(cls, v):
        if not v:
            return v
        if not v.replace('-', '').replace('_', '').replace(' ', '').isalnum():
            raise ValueError('Número do quarto deve conter apenas letras, números, hífens, underscores e espaços')
        return v.strip().upper()
    
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
                raise ValueError(f'Quantidade de {bed_type} deve ser não negativa')
        return v


class RoomResponse(RoomBase):
    """Schema para resposta de Room"""
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    full_name: Optional[str] = None
    effective_max_occupancy: Optional[int] = None
    effective_amenities: Optional[List[str]] = None
    is_available_for_booking: Optional[bool] = None
    status_display: Optional[str] = None
    
    class Config:
        from_attributes = True


class RoomWithDetails(RoomResponse):
    """Schema de Room com detalhes de relacionamentos"""
    property_name: Optional[str] = None
    room_type_name: Optional[str] = None


class RoomListResponse(BaseModel):
    """Schema para lista de quartos"""
    rooms: List[RoomResponse]
    total: int
    page: int
    pages: int
    per_page: int


# Schema para filtros
class RoomFilters(BaseModel):
    """Schema para filtros de busca de quartos"""
    property_id: Optional[int] = None
    room_type_id: Optional[int] = None
    floor: Optional[int] = Field(None, ge=0, le=50)
    building: Optional[str] = None
    
    is_operational: Optional[bool] = None
    is_out_of_order: Optional[bool] = None
    is_available_for_booking: Optional[bool] = None
    
    min_occupancy: Optional[int] = Field(None, ge=1, le=10)
    max_occupancy: Optional[int] = Field(None, ge=1, le=10)
    
    has_amenity: Optional[str] = None
    search: Optional[str] = None  # Busca em nome/room_number/notes


# Schema para operações em lote
class RoomBulkUpdate(BaseModel):
    """Schema para atualização em lote de quartos"""
    room_ids: List[int] = Field(..., min_items=1, max_items=50)
    updates: Dict[str, Any] = Field(..., min_items=1)
    
    @field_validator('updates')
    @classmethod
    def validate_updates(cls, v):
        # Apenas campos permitidos para bulk update
        allowed_fields = {
            'is_operational', 'is_out_of_order', 'maintenance_notes', 
            'housekeeping_notes', 'room_type_id', 'floor'
        }
        for field in v.keys():
            if field not in allowed_fields:
                raise ValueError(f'Campo {field} não permitido em atualização em lote')
        return v


class RoomStats(BaseModel):
    """Schema para estatísticas de quartos"""
    total_rooms: int = 0
    operational_rooms: int = 0
    out_of_order_rooms: int = 0
    maintenance_rooms: int = 0
    occupancy_rate: float = 0.0