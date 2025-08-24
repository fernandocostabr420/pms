# backend/app/schemas/reservation.py

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


class ReservationRoomBase(BaseModel):
    """Schema base para ReservationRoom"""
    room_id: int = Field(..., description="ID do quarto")
    check_in_date: date = Field(..., description="Data check-in do quarto")
    check_out_date: date = Field(..., description="Data check-out do quarto") 
    rate_per_night: Optional[Decimal] = Field(None, ge=0, description="Diária do quarto")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do quarto")


class ReservationRoomCreate(ReservationRoomBase):
    """Schema para criação de ReservationRoom"""
    
    @field_validator('check_out_date')
    @classmethod
    def validate_dates(cls, v, info):
        check_in = info.data.get('check_in_date')
        if check_in and v <= check_in:
            raise ValueError('Check-out deve ser posterior ao check-in')
        return v


class ReservationRoomResponse(ReservationRoomBase):
    """Schema para resposta de ReservationRoom"""
    id: int
    reservation_id: int
    status: str
    total_amount: Optional[Decimal]
    nights: Optional[int] = None
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ReservationBase(BaseModel):
    """Schema base para Reservation"""
    guest_id: int = Field(..., description="ID do hóspede")
    property_id: int = Field(..., description="ID da propriedade")
    
    # Período
    check_in_date: date = Field(..., description="Data de check-in")
    check_out_date: date = Field(..., description="Data de check-out")
    
    # Hóspedes
    adults: int = Field(default=1, ge=1, le=10, description="Número de adultos")
    children: int = Field(default=0, ge=0, le=10, description="Número de crianças")
    
    # Valores
    room_rate: Optional[Decimal] = Field(None, ge=0, description="Diária base")
    total_amount: Optional[Decimal] = Field(None, ge=0, description="Valor total")
    discount: Decimal = Field(default=0, ge=0, description="Desconto")
    taxes: Decimal = Field(default=0, ge=0, description="Impostos/taxas")
    
    # Origem
    source: Optional[str] = Field(None, max_length=50, description="Canal de reserva")
    source_reference: Optional[str] = Field(None, max_length=100, description="Referência externa")
    
    # Observações
    guest_requests: Optional[str] = Field(None, max_length=2000, description="Pedidos do hóspede")
    internal_notes: Optional[str] = Field(None, max_length=2000, description="Notas internas")
    
    # Metadados
    preferences: Optional[Dict[str, Any]] = Field(None, description="Preferências")
    extra_data: Optional[Dict[str, Any]] = Field(None, description="Dados extras")
    
    # Flags
    is_group_reservation: bool = Field(default=False, description="Reserva em grupo")
    requires_deposit: bool = Field(default=False, description="Exige depósito")


class ReservationCreate(ReservationBase):
    """Schema para criação de Reservation"""
    rooms: List[ReservationRoomCreate] = Field(..., min_items=1, max_items=10, description="Quartos da reserva")
    
    @field_validator('check_out_date')
    @classmethod
    def validate_dates(cls, v, info):
        check_in = info.data.get('check_in_date')
        if check_in and v <= check_in:
            raise ValueError('Check-out deve ser posterior ao check-in')
        
        # Validar período máximo (ex: 1 ano)
        if check_in and (v - check_in).days > 365:
            raise ValueError('Período de reserva não pode exceder 365 dias')
        
        return v
    
    @field_validator('source')
    @classmethod
    def validate_source(cls, v):
        if not v:
            return v
        allowed_sources = [
            'direct', 'phone', 'email', 'walk_in',
            'booking.com', 'expedia', 'airbnb', 'agoda',
            'website', 'app', 'other'
        ]
        if v.lower() not in allowed_sources:
            raise ValueError(f'Canal deve ser um de: {", ".join(allowed_sources)}')
        return v.lower()
    
    @field_validator('rooms')
    @classmethod
    def validate_rooms(cls, v, info):
        check_in = info.data.get('check_in_date')
        check_out = info.data.get('check_out_date')
        
        if check_in and check_out:
            for room in v:
                # Verificar se as datas dos quartos estão dentro do período da reserva
                if room.check_in_date < check_in or room.check_out_date > check_out:
                    raise ValueError('Datas dos quartos devem estar dentro do período da reserva')
        
        # Verificar quartos duplicados
        room_ids = [room.room_id for room in v]
        if len(room_ids) != len(set(room_ids)):
            raise ValueError('Não é possível reservar o mesmo quarto múltiplas vezes')
        
        return v


class ReservationUpdate(BaseModel):
    """Schema para atualização de Reservation"""
    guest_id: Optional[int] = None
    
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    
    adults: Optional[int] = Field(None, ge=1, le=10)
    children: Optional[int] = Field(None, ge=0, le=10)
    
    room_rate: Optional[Decimal] = Field(None, ge=0)
    total_amount: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    taxes: Optional[Decimal] = Field(None, ge=0)
    paid_amount: Optional[Decimal] = Field(None, ge=0)
    
    source: Optional[str] = Field(None, max_length=50)
    source_reference: Optional[str] = Field(None, max_length=100)
    
    guest_requests: Optional[str] = Field(None, max_length=2000)
    internal_notes: Optional[str] = Field(None, max_length=2000)
    
    preferences: Optional[Dict[str, Any]] = None
    extra_data: Optional[Dict[str, Any]] = None
    
    is_group_reservation: Optional[bool] = None
    requires_deposit: Optional[bool] = None
    deposit_paid: Optional[bool] = None
    
    # Validações similares ao Create
    @field_validator('check_out_date')
    @classmethod
    def validate_dates(cls, v, info):
        if not v:
            return v
        check_in = info.data.get('check_in_date')
        if check_in and v <= check_in:
            raise ValueError('Check-out deve ser posterior ao check-in')
        return v


class ReservationResponse(ReservationBase):
    """Schema para resposta de Reservation"""
    id: int
    reservation_number: str
    tenant_id: int
    
    status: str
    total_guests: int
    paid_amount: Decimal
    
    # Datas importantes
    created_date: datetime
    confirmed_date: Optional[datetime]
    checked_in_date: Optional[datetime]
    checked_out_date: Optional[datetime]
    cancelled_date: Optional[datetime]
    cancellation_reason: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Relacionamentos
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    property_name: Optional[str] = None
    
    # Campos computados
    nights: Optional[int] = None
    balance_due: Optional[Decimal] = None
    status_display: Optional[str] = None
    is_paid: Optional[bool] = None
    can_check_in: Optional[bool] = None
    can_check_out: Optional[bool] = None
    can_cancel: Optional[bool] = None
    is_current: Optional[bool] = None
    
    # Quartos
    rooms: Optional[List[ReservationRoomResponse]] = None
    
    class Config:
        from_attributes = True


class ReservationWithDetails(ReservationResponse):
    """Schema de Reservation com todos os detalhes"""
    guest: Optional[Dict[str, Any]] = None
    property: Optional[Dict[str, Any]] = None


class ReservationListResponse(BaseModel):
    """Schema para lista de reservas"""
    reservations: List[ReservationResponse]
    total: int
    page: int
    pages: int
    per_page: int


# Schema para operações específicas
class CheckInRequest(BaseModel):
    """Schema para check-in"""
    actual_check_in_time: Optional[datetime] = Field(None, description="Hora real do check-in")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do check-in")
    room_assignments: Optional[Dict[int, int]] = Field(None, description="Atribuições de quartos {reservation_room_id: room_id}")


class CheckOutRequest(BaseModel):
    """Schema para check-out"""
    actual_check_out_time: Optional[datetime] = Field(None, description="Hora real do check-out")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do check-out")
    final_charges: Optional[Decimal] = Field(None, ge=0, description="Taxas finais")


class CancelReservationRequest(BaseModel):
    """Schema para cancelamento"""
    cancellation_reason: str = Field(..., min_length=3, max_length=500, description="Motivo do cancelamento")
    refund_amount: Optional[Decimal] = Field(None, ge=0, description="Valor a ser reembolsado")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do cancelamento")


class AvailabilityRequest(BaseModel):
    """Schema para verificar disponibilidade"""
    property_id: int = Field(..., description="ID da propriedade")
    check_in_date: date = Field(..., description="Data de check-in")
    check_out_date: date = Field(..., description="Data de check-out")
    adults: int = Field(default=1, ge=1, le=10, description="Número de adultos")
    children: int = Field(default=0, ge=0, le=10, description="Número de crianças")
    room_type_id: Optional[int] = Field(None, description="Filtrar por tipo de quarto")


class AvailabilityResponse(BaseModel):
    """Schema para resposta de disponibilidade"""
    available: bool
    available_rooms: List[Dict[str, Any]]
    total_available_rooms: int
    conflicting_reservations: Optional[List[str]] = None  # Números das reservas em conflito


# Schema para filtros
class ReservationFilters(BaseModel):
    """Schema para filtros de busca de reservas"""
    status: Optional[str] = None
    source: Optional[str] = None
    property_id: Optional[int] = None
    guest_id: Optional[int] = None
    
    check_in_from: Optional[date] = None
    check_in_to: Optional[date] = None
    check_out_from: Optional[date] = None
    check_out_to: Optional[date] = None
    
    created_from: Optional[datetime] = None
    created_to: Optional[datetime] = None
    
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = Field(None, ge=0)
    
    is_paid: Optional[bool] = None
    requires_deposit: Optional[bool] = None
    is_group_reservation: Optional[bool] = None
    
    search: Optional[str] = None  # Busca em reservation_number, guest name, etc.