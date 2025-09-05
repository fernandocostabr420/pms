# app/schemas/payment.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class PaymentMethodEnum(str, Enum):
    """Enum para métodos de pagamento"""
    PIX = "pix"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHECK = "check"
    OTHER = "other"


class PaymentStatusEnum(str, Enum):
    """Enum para status de pagamento"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    FAILED = "failed"


# Schemas para requisições
class PaymentCreate(BaseModel):
    """Schema para criação de pagamento - STATUS REMOVIDO (sempre confirmado)"""
    reservation_id: int = Field(..., description="ID da reserva")
    amount: Decimal = Field(..., gt=0, description="Valor do pagamento")
    payment_method: PaymentMethodEnum = Field(..., description="Método de pagamento")
    payment_date: datetime = Field(..., description="Data e hora do pagamento")
    reference_number: Optional[str] = Field(None, max_length=100, description="Número de referência")
    notes: Optional[str] = Field(None, max_length=1000, description="Observações")
    internal_notes: Optional[str] = Field(None, max_length=1000, description="Notas internas")
    fee_amount: Optional[Decimal] = Field(None, ge=0, description="Taxa cobrada")
    is_partial: bool = Field(default=False, description="Pagamento parcial")
    # ✅ REMOVIDO: status (sempre será "confirmed" automaticamente)


class PaymentUpdate(BaseModel):
    """Schema para atualização de pagamento"""
    amount: Optional[Decimal] = Field(None, gt=0, description="Valor do pagamento")
    payment_method: Optional[PaymentMethodEnum] = None
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    internal_notes: Optional[str] = Field(None, max_length=1000)
    fee_amount: Optional[Decimal] = Field(None, ge=0, description="Taxa cobrada")
    is_partial: Optional[bool] = None
    # ✅ NOVO: Campo opcional para justificativa quando editando pagamentos confirmados
    admin_reason: Optional[str] = Field(None, max_length=500, description="Justificativa para edição de pagamento confirmado")


class PaymentConfirmedUpdate(BaseModel):
    """Schema específico para atualização de pagamentos confirmados - JUSTIFICATIVA OBRIGATÓRIA"""
    amount: Optional[Decimal] = Field(None, gt=0, description="Valor do pagamento")
    payment_method: Optional[PaymentMethodEnum] = None
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    fee_amount: Optional[Decimal] = Field(None, ge=0, description="Taxa cobrada")
    is_partial: Optional[bool] = None
    # ✅ OBRIGATÓRIO: Justificativa para edição de pagamento confirmado
    admin_reason: str = Field(..., min_length=10, max_length=500, description="Justificativa obrigatória para edição de pagamento confirmado")

    @field_validator('admin_reason')
    @classmethod
    def validate_admin_reason(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Justificativa deve ter pelo menos 10 caracteres')
        return v.strip()


class PaymentDeleteConfirmed(BaseModel):
    """Schema para exclusão de pagamentos confirmados"""
    admin_reason: str = Field(..., min_length=10, max_length=500, description="Justificativa obrigatória para exclusão de pagamento confirmado")

    @field_validator('admin_reason')
    @classmethod
    def validate_admin_reason(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Justificativa deve ter pelo menos 10 caracteres')
        return v.strip()


class PaymentStatusUpdate(BaseModel):
    """Schema para atualização de status"""
    status: PaymentStatusEnum = Field(..., description="Novo status")
    confirmed_date: Optional[datetime] = Field(None, description="Data de confirmação")
    notes: Optional[str] = Field(None, max_length=500, description="Observações sobre a mudança de status")


# Schemas para respostas
class PaymentResponse(BaseModel):
    """Schema para resposta de Payment"""
    id: int
    payment_number: str
    reservation_id: int
    tenant_id: int
    
    # Dados financeiros
    amount: Decimal
    currency: str
    fee_amount: Optional[Decimal]
    net_amount: Optional[Decimal]
    
    # Identificação e método
    payment_method: str
    reference_number: Optional[str]
    
    # Datas
    payment_date: datetime
    confirmed_date: Optional[datetime]
    
    # Status e flags
    status: str
    is_partial: bool
    is_refund: bool
    
    # Observações
    notes: Optional[str]
    internal_notes: Optional[str]
    
    # Metadados
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Campos computados
    status_display: Optional[str] = None
    payment_method_display: Optional[str] = None
    
    # ✅ NOVO: Indicadores de operações administrativas
    has_admin_changes: Optional[bool] = Field(default=False, description="Indica se o pagamento teve alterações administrativas")
    last_admin_action: Optional[str] = Field(None, description="Última ação administrativa realizada")
    
    class Config:
        from_attributes = True


class PaymentWithReservation(PaymentResponse):
    """Schema de Payment com dados da reserva"""
    reservation_number: Optional[str] = None
    guest_name: Optional[str] = None
    property_name: Optional[str] = None
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None


class PaymentListResponse(BaseModel):
    """Schema para lista de pagamentos"""
    payments: List[PaymentResponse]
    total: int
    page: int
    pages: int
    per_page: int


# Schemas para relatórios
class ReservationPaymentSummary(BaseModel):
    """Schema para resumo de pagamentos de uma reserva"""
    reservation_id: int
    reservation_number: str
    total_amount: Decimal
    total_paid: Decimal
    total_refunded: Decimal
    balance_due: Decimal
    payment_count: int
    last_payment_date: Optional[datetime]
    payments: List[PaymentResponse]


class PaymentReport(BaseModel):
    """Schema para relatório de pagamentos por período"""
    period_start: date
    period_end: date
    total_received: Decimal
    total_refunded: Decimal
    net_received: Decimal
    payment_count: int
    refund_count: int
    payments_by_method: Dict[str, Dict[str, Any]]  # {method: {count: X, amount: Y}}
    payments_by_status: Dict[str, Dict[str, Any]]  # {status: {count: X, amount: Y}}
    daily_totals: List[Dict[str, Any]]  # [{date: X, amount: Y, count: Z}]


# Schemas para filtros
class PaymentFilters(BaseModel):
    """Schema para filtros de busca de pagamentos"""
    reservation_id: Optional[int] = None
    status: Optional[PaymentStatusEnum] = None
    payment_method: Optional[PaymentMethodEnum] = None
    
    # Filtros de data
    payment_date_from: Optional[date] = None
    payment_date_to: Optional[date] = None
    confirmed_date_from: Optional[date] = None
    confirmed_date_to: Optional[date] = None
    created_from: Optional[datetime] = None
    created_to: Optional[datetime] = None
    
    # Filtros de valor
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = Field(None, ge=0)
    
    # Filtros booleanos
    is_partial: Optional[bool] = None
    is_refund: Optional[bool] = None
    
    # ✅ NOVO: Filtro para pagamentos com alterações administrativas
    has_admin_changes: Optional[bool] = None
    
    # Busca textual
    search: Optional[str] = Field(None, max_length=100, description="Busca em payment_number, reference_number, notes")
    
    # Temporariamente removido para debug
    # @field_validator('payment_date_to')
    # @classmethod  
    # def validate_date_range(cls, v, info):
    #     if v and info.data.get('payment_date_from') and v < info.data.get('payment_date_from'):
    #         raise ValueError('Data final deve ser maior que data inicial')
    #     return v


class PaymentBulkOperation(BaseModel):
    """Schema para operações em lote"""
    payment_ids: List[int] = Field(..., min_length=1, max_length=50)
    operation: str = Field(..., description="Operação: confirm, cancel, refund")
    notes: Optional[str] = Field(None, max_length=500, description="Observações da operação")
    # ✅ NOVO: Justificativa para operações em lote em pagamentos confirmados
    admin_reason: Optional[str] = Field(None, max_length=500, description="Justificativa para operações administrativas")
    
    # Temporariamente removido para debug
    # @field_validator('operation')
    # @classmethod
    # def validate_operation(cls, v):
    #     allowed_operations = ['confirm', 'cancel', 'refund']
    #     if v not in allowed_operations:
    #         raise ValueError(f'Operação deve ser uma de: {allowed_operations}')
    #     return v


# ✅ NOVOS SCHEMAS PARA AUDITORIA E CONTROLE

class PaymentAuditLog(BaseModel):
    """Schema para logs de auditoria de pagamentos"""
    payment_id: int
    payment_number: str
    action: str  # CREATE, UPDATE, DELETE, STATUS_CHANGE
    user_id: int
    user_email: str
    timestamp: datetime
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class PaymentPermissions(BaseModel):
    """Schema para verificação de permissões de pagamento"""
    can_view: bool = True
    can_create: bool = True
    can_edit: bool = True
    can_edit_confirmed: bool = False
    can_delete: bool = True
    can_delete_confirmed: bool = False
    can_bulk_operations: bool = False
    is_admin: bool = False
    
    restrictions: List[str] = Field(default_factory=list, description="Lista de restrições aplicáveis")


class PaymentSecurityWarning(BaseModel):
    """Schema para avisos de segurança em operações sensíveis"""
    operation: str  # edit_confirmed, delete_confirmed
    payment_id: int
    payment_number: str
    current_status: str
    warning_message: str
    requires_admin: bool = True
    requires_reason: bool = True
    impact_level: str = Field(..., description="low, medium, high, critical")


# ✅ SCHEMAS PARA ESTATÍSTICAS E RELATÓRIOS ADMINISTRATIVOS

class PaymentAdminStats(BaseModel):
    """Schema para estatísticas administrativas de pagamentos"""
    total_payments: int
    confirmed_payments: int
    pending_payments: int
    cancelled_payments: int
    refunded_payments: int
    
    # Estatísticas de operações administrativas
    admin_edited_count: int
    admin_deleted_count: int
    admin_operations_last_30_days: int
    
    # Valores
    total_amount: Decimal
    total_confirmed_amount: Decimal
    total_refunded_amount: Decimal
    
    # Por período
    period_start: date
    period_end: date


class PaymentRiskAnalysis(BaseModel):
    """Schema para análise de risco de operações em pagamentos"""
    payment_id: int
    payment_number: str
    risk_level: str  # low, medium, high, critical
    risk_factors: List[str]
    recommended_action: str
    requires_approval: bool = False
    approval_level: str = Field(default="manager", description="manager, admin, super_admin")