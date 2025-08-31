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
    """Schema para criação de pagamento"""
    reservation_id: int = Field(..., description="ID da reserva")
    amount: Decimal = Field(..., gt=0, description="Valor do pagamento")
    payment_method: PaymentMethodEnum = Field(..., description="Método de pagamento")
    payment_date: datetime = Field(..., description="Data e hora do pagamento")
    reference_number: Optional[str] = Field(None, max_length=100, description="Número de referência")
    notes: Optional[str] = Field(None, max_length=1000, description="Observações")
    internal_notes: Optional[str] = Field(None, max_length=1000, description="Notas internas")
    fee_amount: Optional[Decimal] = Field(None, ge=0, description="Taxa cobrada")
    is_partial: bool = Field(default=False, description="Pagamento parcial")


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
    
    # Temporariamente removido para debug
    # @field_validator('operation')
    # @classmethod
    # def validate_operation(cls, v):
    #     allowed_operations = ['confirm', 'cancel', 'refund']
    #     if v not in allowed_operations:
    #         raise ValueError(f'Operação deve ser uma de: {allowed_operations}')
    #     return v