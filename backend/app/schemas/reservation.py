# backend/app/schemas/reservation.py - ARQUIVO COMPLETO COM MODIFICAÇÕES PARA CHECK-OUTS PENDENTES

from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal

# ✅ NOVO IMPORT - Schema para dados do check-in
from app.schemas.guest import GuestCheckInData


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
    room_type_name: Optional[str] = None
    guests: Optional[int] = None
    rate_plan_name: Optional[str] = None
    
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
    discount: Decimal = Field(default=Decimal('0.00'), ge=0, description="Desconto")
    taxes: Decimal = Field(default=Decimal('0.00'), ge=0, description="Taxas")
    
    # Origem
    source: Optional[str] = Field(None, max_length=100, description="Canal de origem")
    source_reference: Optional[str] = Field(None, max_length=200, description="Referência no canal")
    
    # Observações
    guest_requests: Optional[str] = Field(None, max_length=1000, description="Pedidos do hóspede")
    internal_notes: Optional[str] = Field(None, max_length=1000, description="Notas internas")
    
    # Dados adicionais
    preferences: Optional[Dict[str, Any]] = Field(None, description="Preferências específicas")
    extra_data: Optional[Dict[str, Any]] = Field(None, description="Dados extras")
    
    # Flags
    is_group_reservation: bool = Field(default=False, description="É reserva em grupo")
    requires_deposit: bool = Field(default=False, description="Requer depósito")
    
    @field_validator('check_out_date')
    @classmethod
    def validate_checkout_date(cls, v, info):
        check_in = info.data.get('check_in_date')
        if check_in and v <= check_in:
            raise ValueError('Check-out deve ser posterior ao check-in')
        return v


class ReservationCreate(ReservationBase):
    """Schema para criação de Reservation"""
    rooms: List[ReservationRoomCreate] = Field(..., min_length=1, description="Quartos da reserva")


class ReservationUpdate(BaseModel):
    """Schema para atualização de Reservation"""
    # Período
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    
    # Hóspedes
    adults: Optional[int] = Field(None, ge=1, le=10)
    children: Optional[int] = Field(None, ge=0, le=10)
    
    # Valores
    room_rate: Optional[Decimal] = Field(None, ge=0)
    total_amount: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    taxes: Optional[Decimal] = Field(None, ge=0)
    
    # Observações
    guest_requests: Optional[str] = Field(None, max_length=1000)
    internal_notes: Optional[str] = Field(None, max_length=1000)
    
    # Dados adicionais
    preferences: Optional[Dict[str, Any]] = None
    extra_data: Optional[Dict[str, Any]] = None
    
    # Flags
    is_group_reservation: Optional[bool] = None
    requires_deposit: Optional[bool] = None
    
    # Quartos (opcional)
    rooms: Optional[List[ReservationRoomCreate]] = None
    
    @field_validator('check_out_date')
    @classmethod
    def validate_checkout_date(cls, v, info):
        check_in = info.data.get('check_in_date')
        if check_in and v and v <= check_in:
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


# ===== SCHEMAS PARA OPERAÇÕES ESPECÍFICAS =====

class CheckInRequest(BaseModel):
    """Schema para check-in - MODIFICADO PARA INCLUIR DADOS DO HÓSPEDE"""
    # Dados básicos do check-in (já existiam)
    actual_check_in_time: Optional[datetime] = Field(None, description="Hora real do check-in")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do check-in")
    room_assignments: Optional[Dict[int, int]] = Field(None, description="Atribuições de quartos {reservation_room_id: room_id}")
    
    # ✅ NOVO - Dados do hóspede para atualizar durante o check-in
    guest_data: Optional[GuestCheckInData] = Field(
        None, 
        description="Dados do hóspede para atualizar/validar durante o check-in"
    )


class CheckOutRequest(BaseModel):
    """Schema para check-out"""
    actual_check_out_time: Optional[datetime] = Field(None, description="Hora real do check-out")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do check-out")
    final_charges: Optional[Decimal] = Field(None, ge=0, description="Cobranças finais")


class CancelReservationRequest(BaseModel):
    """Schema para cancelamento"""
    cancellation_reason: str = Field(..., max_length=500, description="Motivo do cancelamento")
    refund_amount: Optional[Decimal] = Field(None, ge=0, description="Valor a ser reembolsado")
    notes: Optional[str] = Field(None, max_length=500, description="Observações do cancelamento")


class AvailabilityRequest(BaseModel):
    """Schema para verificação de disponibilidade"""
    property_id: int
    check_in_date: date
    check_out_date: date
    adults: Optional[int] = Field(default=1, ge=1, le=10)
    children: Optional[int] = Field(default=0, ge=0, le=10)
    room_type_id: Optional[int] = None
    
    # ✅ NOVO CAMPO - Excluir reserva específica da verificação (para edições)
    exclude_reservation_id: Optional[int] = Field(
        None, 
        description="ID da reserva a ser excluída da verificação de conflitos (usado em edições)"
    )
    
    @field_validator('check_out_date')
    @classmethod
    def validate_checkout_date(cls, v, info):
        check_in = info.data.get('check_in_date')
        if check_in and v <= check_in:
            raise ValueError('Check-out deve ser posterior ao check-in')
        return v


class AvailableRoom(BaseModel):
    """Schema para quarto disponível"""
    id: int
    room_number: str
    name: Optional[str] = None
    room_type_id: int
    room_type_name: Optional[str] = None
    max_occupancy: int
    floor: Optional[int] = None
    building: Optional[str] = None
    
    # ✅ NOVO CAMPO - Taxa base do quarto
    rate_per_night: Optional[float] = Field(
        None, 
        description="Taxa base por noite do quarto"
    )


class AvailabilityResponse(BaseModel):
    """Schema para resposta de disponibilidade"""
    available: bool
    available_rooms: List[AvailableRoom]
    total_available_rooms: int
    conflicting_reservations: Optional[List[str]] = None


# ===== SCHEMAS PARA FILTROS =====

class ReservationFilters(BaseModel):
    """Schema para filtros de reserva"""
    # Filtros básicos
    status: Optional[str] = Field(None, description="Status da reserva")
    source: Optional[str] = Field(None, description="Canal de origem")
    property_id: Optional[int] = Field(None, description="ID da propriedade")
    guest_id: Optional[int] = Field(None, description="ID do hóspede")
    search: Optional[str] = Field(None, description="Busca geral")
    
    # Filtros de data
    check_in_from: Optional[date] = Field(None, description="Check-in a partir de")
    check_in_to: Optional[date] = Field(None, description="Check-in até")
    check_out_from: Optional[date] = Field(None, description="Check-out a partir de")
    check_out_to: Optional[date] = Field(None, description="Check-out até")
    created_from: Optional[datetime] = Field(None, description="Criação a partir de")
    created_to: Optional[datetime] = Field(None, description="Criação até")
    confirmed_from: Optional[datetime] = Field(None, description="Confirmação a partir de")
    confirmed_to: Optional[datetime] = Field(None, description="Confirmação até")
    cancelled_from: Optional[date] = Field(None, description="Cancelamento a partir de")
    cancelled_to: Optional[date] = Field(None, description="Cancelamento até")
    
    # Filtros do hóspede
    guest_email: Optional[str] = Field(None, description="Email do hóspede")
    guest_phone: Optional[str] = Field(None, description="Telefone do hóspede")
    guest_document_type: Optional[str] = Field(None, description="Tipo de documento")
    guest_nationality: Optional[str] = Field(None, description="Nacionalidade")
    guest_city: Optional[str] = Field(None, description="Cidade do hóspede")
    guest_state: Optional[str] = Field(None, description="Estado do hóspede")
    guest_country: Optional[str] = Field(None, description="País do hóspede")
    
    # Filtros de valores
    min_amount: Optional[Decimal] = Field(None, ge=0, description="Valor mínimo")
    max_amount: Optional[Decimal] = Field(None, ge=0, description="Valor máximo")
    min_guests: Optional[int] = Field(None, ge=1, description="Mínimo de hóspedes")
    max_guests: Optional[int] = Field(None, ge=1, description="Máximo de hóspedes")
    min_nights: Optional[int] = Field(None, ge=1, description="Mínimo de noites")
    max_nights: Optional[int] = Field(None, ge=1, description="Máximo de noites")
    
    # Filtros de quarto
    room_type_id: Optional[int] = Field(None, description="ID do tipo de quarto")
    room_number: Optional[str] = Field(None, description="Número do quarto")
    
    # Filtros especiais
    has_special_requests: Optional[bool] = Field(None, description="Possui pedidos especiais")
    has_internal_notes: Optional[bool] = Field(None, description="Possui notas internas")
    deposit_paid: Optional[bool] = Field(None, description="Depósito pago")
    payment_status: Optional[str] = Field(None, description="Status do pagamento")
    marketing_source: Optional[str] = Field(None, description="Origem do marketing")
    
    # Filtros por flags específicas
    is_current: Optional[bool] = Field(None, description="Reservas atuais (hóspede no hotel)")
    can_check_in: Optional[bool] = Field(None, description="Pode fazer check-in")
    can_check_out: Optional[bool] = Field(None, description="Pode fazer check-out")
    can_cancel: Optional[bool] = Field(None, description="Pode ser cancelada")
    is_paid: Optional[bool] = Field(None, description="Está pago")
    requires_deposit: Optional[bool] = Field(None, description="Requer depósito")
    is_group_reservation: Optional[bool] = Field(None, description="É reserva em grupo")


# ===== NOVOS SCHEMAS PARA FUNCIONALIDADES EXPANDIDAS =====

class ReservationResponseWithGuestDetails(ReservationResponse):
    """Schema de Reservation com detalhes completos do hóspede"""
    
    # Dados do hóspede expandidos
    guest_phone: Optional[str] = None
    guest_document_type: Optional[str] = None
    guest_document_number: Optional[str] = None
    guest_nationality: Optional[str] = None
    guest_city: Optional[str] = None
    guest_state: Optional[str] = None
    guest_country: Optional[str] = None
    guest_address: Optional[str] = None
    guest_date_of_birth: Optional[date] = None
    guest_preferences: Optional[Dict[str, Any]] = None
    guest_notes: Optional[str] = None
    
    # Dados da propriedade expandidos
    property_address: Optional[str] = None
    property_phone: Optional[str] = None
    property_city: Optional[str] = None
    property_state: Optional[str] = None
    property_country: Optional[str] = None
    
    # Estatísticas do hóspede
    guest_total_reservations: Optional[int] = None
    guest_completed_stays: Optional[int] = None
    guest_cancelled_reservations: Optional[int] = None
    guest_total_nights: Optional[int] = None
    guest_last_stay_date: Optional[date] = None
    
    # Dados de pagamento expandidos
    last_payment_date: Optional[datetime] = None
    payment_method_last: Optional[str] = None
    total_payments: Optional[int] = None
    
    # Informações dos quartos com mais detalhes
    room_details: Optional[List[Dict[str, Any]]] = None
    
    # Campos adicionais específicos para reservas
    deposit_paid: Optional[bool] = None


class ReservationListResponseWithDetails(BaseModel):
    """Schema para lista de reservas com detalhes expandidos"""
    reservations: List[ReservationResponseWithGuestDetails]
    total: int
    page: int
    pages: int
    per_page: int
    
    # Estatísticas da busca
    summary: Optional[Dict[str, Any]] = None


# ===== SCHEMAS PARA EXPORTAÇÃO =====

class ReservationExportFilters(ReservationFilters):
    """Schema para filtros de exportação de reservas"""
    
    # Campos específicos para exportação
    include_guest_details: bool = Field(True, description="Incluir detalhes do hóspede")
    include_room_details: bool = Field(True, description="Incluir detalhes dos quartos")
    include_payment_details: bool = Field(True, description="Incluir detalhes de pagamento")
    include_property_details: bool = Field(False, description="Incluir detalhes da propriedade")
    
    # Formato da exportação
    date_format: str = Field("dd/mm/yyyy", description="Formato das datas")
    currency_format: str = Field("pt-BR", description="Formato da moeda")
    
    # Campos customizados para incluir
    custom_fields: Optional[List[str]] = Field(None, description="Campos customizados para incluir")


class ReservationExportResponse(BaseModel):
    """Schema para resposta da exportação"""
    file_url: str
    file_name: str
    total_records: int
    generated_at: datetime
    expires_at: datetime


# ===== SCHEMAS PARA ESTATÍSTICAS EXPANDIDAS =====

class ReservationSummary(BaseModel):
    """Schema para resumo de reservas"""
    total_reservations: int
    total_revenue: Decimal
    total_paid: Decimal
    total_pending: Decimal
    avg_nights: float
    avg_guests: float
    avg_amount: Decimal
    
    # Distribuições
    status_counts: Dict[str, int]
    source_counts: Dict[str, int]
    property_counts: Optional[Dict[str, int]] = None
    
    # Tendências
    cancellation_rate: float
    occupancy_rate: float
    revenue_per_night: Decimal


# ===== ✅ SCHEMAS MODIFICADOS PARA DASHBOARD COM CHECK-OUTS PENDENTES =====

class DashboardSummaryResponse(BaseModel):
    """Schema para resumo do dashboard - ATUALIZADO"""
    total_reservations: int
    todays_checkins: int
    pending_checkouts: int  # ✅ ALTERADO: era todays_checkouts
    current_guests: int
    total_revenue: Decimal
    paid_revenue: Decimal
    pending_revenue: Decimal
    checked_in_with_pending_payment: int
    summary_date: str
    property_id: Optional[int] = None


class TodaysReservationsResponse(BaseModel):
    """Schema para reservas de hoje - ATUALIZADO"""
    date: str
    arrivals_count: int
    pending_checkouts_count: int  # ✅ ALTERADO: era departures_count
    current_guests_count: int
    
    # Dados detalhados (quando include_details=True)
    arrivals: Optional[List[Dict[str, Any]]] = None
    pending_checkouts: Optional[List[Dict[str, Any]]] = None  # ✅ ALTERADO: era departures
    current_guests: Optional[List[Dict[str, Any]]] = None


class DashboardStatsResponse(BaseModel):
    """Schema para estatísticas do dashboard - ATUALIZADO"""
    # Estatísticas gerais
    total_reservations: int
    total_revenue: Decimal
    occupancy_rate: float
    avg_daily_rate: Decimal
    
    # Estatísticas hoje
    today_arrivals: int
    pending_checkouts: int  # ✅ ALTERADO: era today_departures
    current_guests: int
    available_rooms_today: int
    
    # Pendências
    pending_checkins: int
    overdue_payments: int
    
    # Médias
    avg_nights: float
    avg_guests: float
    
    # Distribuições
    status_distribution: Dict[str, int]
    source_distribution: Dict[str, int]
    
    # Tendências (últimos 7 dias)
    revenue_trend: List[Dict[str, Any]]
    
    # Top performers
    top_sources: List[Dict[str, Any]]
    
    # Alertas
    alerts: List[Dict[str, Any]]


class ReservationReportFilters(BaseModel):
    """Schema para filtros de relatórios"""
    start_date: date
    end_date: date
    property_ids: Optional[List[int]] = None
    status_list: Optional[List[str]] = None
    source_list: Optional[List[str]] = None
    include_cancelled: bool = False
    group_by: Optional[str] = Field(None, description="Agrupar por: daily, monthly, yearly, status, source")


# ===== SCHEMAS NOVOS PARA PÁGINA DE DETALHES =====

class AuditUser(BaseModel):
    """Schema para usuário no histórico de auditoria"""
    id: int
    name: str
    email: Optional[str] = None
    role: Optional[str] = None


class AuditEntry(BaseModel):
    """Schema para entrada de auditoria"""
    id: int
    timestamp: datetime
    user: Optional[AuditUser] = None
    action: str  # reservation_created, payment_added, check_in_completed, etc.
    description: str  # Descrição legível da ação
    table_name: str
    record_id: int
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    class Config:
        from_attributes = True


class GuestDetailsExpanded(BaseModel):
    """Schema expandido para dados do hóspede"""
    id: int
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: str
    
    # Endereço completo
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str
    postal_code: Optional[str] = None
    full_address: Optional[str] = None
    
    # Preferências e observações
    preferences: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    marketing_consent: str
    
    # Estatísticas do hóspede
    total_reservations: int = 0
    completed_stays: int = 0
    cancelled_reservations: int = 0
    total_nights: int = 0
    last_stay_date: Optional[date] = None
    total_spent: Decimal = Decimal('0.00')
    
    # Metadados
    created_at: datetime
    updated_at: datetime
    is_active: bool


class PropertyDetailsExpanded(BaseModel):
    """Schema expandido para dados da propriedade"""
    id: int
    name: str
    description: Optional[str] = None
    property_type: str
    
    # Endereço completo
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    full_address: Optional[str] = None
    
    # Contatos
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    
    # Estatísticas
    total_rooms: int = 0
    total_reservations: int = 0
    
    # Metadados
    created_at: datetime
    updated_at: datetime
    is_active: bool


class RoomDetailsExpanded(BaseModel):
    """Schema expandido para dados do quarto"""
    id: int
    room_number: str
    name: Optional[str] = None
    room_type_id: int
    room_type_name: Optional[str] = None
    max_occupancy: int
    floor: Optional[int] = None
    building: Optional[str] = None
    description: Optional[str] = None
    amenities: Optional[List[str]] = None
    rate_per_night: Optional[Decimal] = None
    total_nights: int = 0
    total_amount: Optional[Decimal] = None
    status: str = "active"


class PaymentDetailsExpanded(BaseModel):
    """Schema expandido para dados de pagamento"""
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    discount: Decimal
    taxes: Decimal
    deposit_required: bool = False
    deposit_amount: Optional[Decimal] = None
    deposit_paid: bool = False
    last_payment_date: Optional[datetime] = None
    payment_method_last: Optional[str] = None
    total_payments: int = 0
    is_overdue: bool = False
    payment_status: str = "pending"


class ContextualActions(BaseModel):
    """Schema para ações contextuais disponíveis"""
    can_edit: bool = False
    can_confirm: bool = False
    can_check_in: bool = False
    can_check_out: bool = False
    can_cancel: bool = False
    can_add_payment: bool = False
    can_modify_rooms: bool = False
    can_send_confirmation: bool = False
    
    # Razões para ações bloqueadas
    edit_blocked_reason: Optional[str] = None
    confirm_blocked_reason: Optional[str] = None
    checkin_blocked_reason: Optional[str] = None
    checkout_blocked_reason: Optional[str] = None
    cancel_blocked_reason: Optional[str] = None


class ReservationDetailedResponse(BaseModel):
    """Schema completo para página de detalhes da reserva"""
    # Dados básicos da reserva
    id: int
    reservation_number: str
    status: str
    created_date: datetime
    confirmed_date: Optional[datetime] = None
    checked_in_date: Optional[datetime] = None
    checked_out_date: Optional[datetime] = None
    cancelled_date: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    
    # Período e ocupação
    check_in_date: date
    check_out_date: date
    nights: int
    adults: int
    children: int
    total_guests: int
    
    # Origem e observações
    source: Optional[str] = None
    source_reference: Optional[str] = None
    guest_requests: Optional[str] = None
    internal_notes: Optional[str] = None
    
    # Flags especiais
    is_group_reservation: bool = False
    requires_deposit: bool = False
    
    # Dados relacionados expandidos
    guest: GuestDetailsExpanded
    property: PropertyDetailsExpanded
    rooms: List[RoomDetailsExpanded]
    payment: PaymentDetailsExpanded
    
    # Ações disponíveis
    actions: ContextualActions
    
    # Histórico de auditoria
    audit_history: List[AuditEntry]
    
    # Campos computados
    status_display: str
    is_current: bool = False
    days_until_checkin: Optional[int] = None
    days_since_checkout: Optional[int] = None
    
    # Metadados
    created_at: datetime
    updated_at: datetime
    tenant_id: int