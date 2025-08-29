# backend/app/schemas/map.py

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal


class MapReservationResponse(BaseModel):
    """Schema para reserva no contexto do mapa"""
    id: int
    reservation_number: str
    status: str
    guest_name: str
    guest_email: Optional[str] = None
    check_in_date: date
    check_out_date: date
    nights: int
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    total_guests: int
    source: Optional[str] = None
    notes: Optional[str] = None
    
    # Status indicators
    is_arrival: bool = False
    is_departure: bool = False
    is_current: bool = False
    
    class Config:
        from_attributes = True


class MapRoomData(BaseModel):
    """Schema para dados de quarto no mapa"""
    id: int
    room_number: str
    name: str
    floor: Optional[int] = None
    building: Optional[str] = None
    max_occupancy: int
    
    # Status operacional
    is_operational: bool
    is_out_of_order: bool
    maintenance_notes: Optional[str] = None
    housekeeping_notes: Optional[str] = None
    
    # Reservas do quarto no período
    reservations: List[MapReservationResponse] = []
    
    # Status calculado para o período
    occupancy_days: int = 0
    total_days_in_period: int = 0
    occupancy_rate: float = 0.0
    
    class Config:
        from_attributes = True


class MapCategoryData(BaseModel):
    """Schema para categoria de quartos no mapa"""
    room_type_id: int
    room_type_name: str
    room_type_slug: str
    room_type_description: Optional[str] = None
    base_capacity: int
    max_capacity: int
    
    # Quartos desta categoria
    rooms: List[MapRoomData] = []
    
    # Estatísticas da categoria
    total_rooms: int = 0
    operational_rooms: int = 0
    out_of_order_rooms: int = 0
    occupied_rooms: int = 0
    available_rooms: int = 0
    
    # Ocupação da categoria
    total_reservations: int = 0
    total_revenue: Decimal = Decimal('0.00')
    average_occupancy_rate: float = 0.0
    
    class Config:
        from_attributes = True


class MapDataRequest(BaseModel):
    """Schema para requisição de dados do mapa"""
    start_date: date = Field(..., description="Data inicial")
    end_date: date = Field(..., description="Data final")
    property_id: Optional[int] = Field(None, description="Filtrar por propriedade")
    room_type_ids: Optional[List[int]] = Field(None, description="Filtrar por tipos de quarto")
    include_out_of_order: bool = Field(default=True, description="Incluir quartos fora de funcionamento")
    include_cancelled: bool = Field(default=False, description="Incluir reservas canceladas")
    status_filter: Optional[List[str]] = Field(None, description="Filtrar por status de reserva")
    
    @classmethod
    def validate_date_range(cls, v, values):
        """Valida período máximo de 90 dias"""
        if 'start_date' in values and v:
            if (v - values['start_date']).days > 90:
                raise ValueError('Período não pode exceder 90 dias')
        return v


class MapResponse(BaseModel):
    """Schema para resposta completa do mapa"""
    start_date: date
    end_date: date
    total_days: int
    property_id: Optional[int] = None
    property_name: Optional[str] = None
    
    # Categorias com quartos e reservas
    categories: List[MapCategoryData] = []
    
    # Estatísticas gerais
    total_rooms: int = 0
    total_operational_rooms: int = 0
    total_reservations: int = 0
    total_revenue: Decimal = Decimal('0.00')
    overall_occupancy_rate: float = 0.0
    
    # Contadores por status
    status_counts: Dict[str, int] = {}
    
    # Dados para construir timeline
    date_headers: List[date] = []
    
    class Config:
        from_attributes = True


class MapStatsResponse(BaseModel):
    """Schema para estatísticas do mapa"""
    period_start: date
    period_end: date
    total_days: int
    
    # Room statistics
    total_rooms: int = 0
    operational_rooms: int = 0
    out_of_order_rooms: int = 0
    maintenance_rooms: int = 0
    
    # Occupancy statistics
    total_room_nights: int = 0
    occupied_room_nights: int = 0
    available_room_nights: int = 0
    occupancy_rate: float = 0.0
    
    # Revenue statistics
    total_revenue: Decimal = Decimal('0.00')
    confirmed_revenue: Decimal = Decimal('0.00')
    pending_revenue: Decimal = Decimal('0.00')
    average_daily_rate: Decimal = Decimal('0.00')
    revenue_per_available_room: Decimal = Decimal('0.00')
    
    # Reservation statistics
    total_reservations: int = 0
    arrivals: int = 0
    departures: int = 0
    stayovers: int = 0
    
    # Status breakdown
    confirmed_reservations: int = 0
    checked_in_reservations: int = 0
    checked_out_reservations: int = 0
    cancelled_reservations: int = 0
    pending_reservations: int = 0
    
    # Category breakdown
    category_stats: List[Dict[str, Any]] = []


class MapAvailabilityCheck(BaseModel):
    """Schema para verificar disponibilidade no mapa"""
    room_id: int
    date: date
    is_available: bool
    is_blocked: bool
    is_reserved: bool
    reservation_id: Optional[int] = None
    rate_override: Optional[Decimal] = None
    notes: Optional[str] = None


class MapBulkOperation(BaseModel):
    """Schema para operações em lote no mapa"""
    operation_type: str = Field(..., description="Tipo de operação: block, unblock, maintenance, clean")
    room_ids: List[int] = Field(..., min_items=1, max_items=50, description="IDs dos quartos")
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    reason: Optional[str] = Field(None, max_length=200, description="Motivo da operação")
    notes: Optional[str] = Field(None, max_length=1000, description="Observações")
    
    # Campos específicos para algumas operações
    rate_override: Optional[Decimal] = Field(None, ge=0, description="Taxa especial")
    closed_to_arrival: Optional[bool] = None
    closed_to_departure: Optional[bool] = None


class MapQuickBooking(BaseModel):
    """Schema para reserva rápida pelo mapa"""
    room_id: int
    check_in_date: date
    check_out_date: date
    guest_name: str = Field(..., min_length=2, max_length=100)
    guest_email: Optional[str] = Field(None, description="Email do hóspede")
    guest_phone: Optional[str] = Field(None, description="Telefone do hóspede")
    adults: int = Field(default=1, ge=1, le=10)
    children: int = Field(default=0, ge=0, le=10)
    rate: Optional[Decimal] = Field(None, ge=0, description="Tarifa por noite")
    total_amount: Optional[Decimal] = Field(None, ge=0, description="Valor total")
    notes: Optional[str] = Field(None, max_length=500, description="Observações")
    source: str = Field(default="map_booking", description="Canal de origem")