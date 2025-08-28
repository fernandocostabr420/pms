# backend/app/schemas/room_availability.py

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date as Date  # ← CORRIGIDO: Alias para evitar conflito
from decimal import Decimal


class RoomAvailabilityBase(BaseModel):
    """Schema base para RoomAvailability"""
    room_id: int = Field(..., description="ID do quarto")
    date: Date = Field(..., description="Data da disponibilidade")  # ← CORRIGIDO: Usando alias
    
    # Status de disponibilidade
    is_available: bool = Field(default=True, description="Disponível para reserva")
    is_blocked: bool = Field(default=False, description="Bloqueado manualmente")
    is_out_of_order: bool = Field(default=False, description="Fora de funcionamento")
    is_maintenance: bool = Field(default=False, description="Em manutenção")
    
    # Preço e restrições
    rate_override: Optional[Decimal] = Field(None, ge=0, description="Preço específico para esta data")
    min_stay: int = Field(default=1, ge=1, le=30, description="Estadia mínima")
    max_stay: Optional[int] = Field(None, ge=1, le=365, description="Estadia máxima")
    
    # Restrições de check-in/check-out
    closed_to_arrival: bool = Field(default=False, description="Fechado para chegada")
    closed_to_departure: bool = Field(default=False, description="Fechado para saída")
    
    # Informações adicionais
    reason: Optional[str] = Field(None, max_length=100, description="Motivo do bloqueio")
    notes: Optional[str] = Field(None, max_length=1000, description="Observações")
    metadata_json: Optional[str] = Field(None, max_length=1000, description="Metadados JSON")


class RoomAvailabilityCreate(RoomAvailabilityBase):
    """Schema para criação de RoomAvailability"""
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v):
        from datetime import date as today_date  # Import local para evitar conflito
        if v < today_date.today():
            raise ValueError('Data não pode ser no passado')
        return v
    
    # REMOVIDO: validator problemático do max_stay
    # Validação será feita no service layer ao invés do schema


class RoomAvailabilityUpdate(BaseModel):
    """Schema para atualização de RoomAvailability"""
    is_available: Optional[bool] = None
    is_blocked: Optional[bool] = None
    is_out_of_order: Optional[bool] = None
    is_maintenance: Optional[bool] = None
    
    rate_override: Optional[Decimal] = Field(None, ge=0)
    min_stay: Optional[int] = Field(None, ge=1, le=30)
    max_stay: Optional[int] = Field(None, ge=1, le=365)
    
    closed_to_arrival: Optional[bool] = None
    closed_to_departure: Optional[bool] = None
    
    reason: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    metadata_json: Optional[str] = Field(None, max_length=1000)
    
    # REMOVIDO: validator problemático que causava recursão
    # Validação será feita no service layer


class RoomAvailabilityResponse(RoomAvailabilityBase):
    """Schema para resposta de RoomAvailability"""
    id: int
    tenant_id: int
    
    # Status de reserva
    is_reserved: bool
    reservation_id: Optional[int]
    
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    status: Optional[str] = None
    is_bookable: Optional[bool] = None
    
    # Dados relacionados
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    room_type_name: Optional[str] = None
    property_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class RoomAvailabilityListResponse(BaseModel):
    """Schema para lista de disponibilidades"""
    availabilities: List[RoomAvailabilityResponse]
    total: int
    page: int
    pages: int
    per_page: int


class RoomAvailabilityFilters(BaseModel):
    """Schema para filtros de busca"""
    room_id: Optional[int] = None
    property_id: Optional[int] = None
    room_type_id: Optional[int] = None
    
    date_from: Optional[Date] = None
    date_to: Optional[Date] = None
    
    is_available: Optional[bool] = None
    is_blocked: Optional[bool] = None
    is_out_of_order: Optional[bool] = None
    is_maintenance: Optional[bool] = None
    is_reserved: Optional[bool] = None
    is_bookable: Optional[bool] = None
    
    closed_to_arrival: Optional[bool] = None
    closed_to_departure: Optional[bool] = None
    
    has_rate_override: Optional[bool] = None
    min_rate: Optional[Decimal] = Field(None, ge=0)
    max_rate: Optional[Decimal] = Field(None, ge=0)
    
    search: Optional[str] = None


# Schemas para operações específicas
class BulkAvailabilityUpdate(BaseModel):
    """Schema para atualização em massa"""
    room_ids: List[int] = Field(..., min_length=1, max_length=100)
    date_from: Date = Field(..., description="Data inicial")
    date_to: Date = Field(..., description="Data final")
    
    # Campos para atualizar
    is_available: Optional[bool] = None
    is_blocked: Optional[bool] = None
    is_out_of_order: Optional[bool] = None
    is_maintenance: Optional[bool] = None
    
    rate_override: Optional[Decimal] = Field(None, ge=0)
    min_stay: Optional[int] = Field(None, ge=1, le=30)
    max_stay: Optional[int] = Field(None, ge=1, le=365)
    
    closed_to_arrival: Optional[bool] = None
    closed_to_departure: Optional[bool] = None
    
    reason: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    
    # REMOVIDO: validator problemático que causava recursão
    # Validação será feita no service layer


class CalendarAvailabilityRequest(BaseModel):
    """Schema para buscar disponibilidade do calendário"""
    room_ids: Optional[List[int]] = None
    property_id: Optional[int] = None
    room_type_id: Optional[int] = None
    date_from: Date = Field(..., description="Data inicial")
    date_to: Date = Field(..., description="Data final")
    include_reserved: bool = Field(default=True, description="Incluir quartos reservados")


class CalendarAvailabilityResponse(BaseModel):
    """Schema para resposta do calendário"""
    date: Date
    availabilities: List[RoomAvailabilityResponse]
    summary: Dict[str, int]  # available, blocked, reserved, etc.


class AvailabilityStatsResponse(BaseModel):
    """Schema para estatísticas de disponibilidade"""
    total_rooms: int = 0
    available_rooms: int = 0
    blocked_rooms: int = 0
    reserved_rooms: int = 0
    maintenance_rooms: int = 0
    out_of_order_rooms: int = 0
    occupancy_rate: float = 0.0
    availability_rate: float = 0.0