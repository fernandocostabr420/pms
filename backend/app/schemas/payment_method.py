# backend/app/schemas/payment_method.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class PaymentMethodBase(BaseModel):
    """Schema base para PaymentMethod"""
    name: str = Field(..., min_length=1, max_length=100, description="Nome do método de pagamento")
    code: str = Field(..., min_length=1, max_length=50, description="Código único do método")
    description: Optional[str] = Field(None, max_length=1000, description="Descrição detalhada")
    display_order: int = Field(0, ge=0, le=999, description="Ordem de exibição")
    icon: Optional[str] = Field(None, max_length=50, description="Ícone para interface")
    color: Optional[str] = Field(None, max_length=20, description="Cor para interface")
    requires_reference: bool = Field(False, description="Requer número de referência")
    has_fees: bool = Field(False, description="Tem taxas associadas")
    default_fee_rate: Optional[Decimal] = Field(None, ge=0, le=1, description="Taxa padrão (decimal)")
    settings: Optional[Dict[str, Any]] = Field(None, description="Configurações específicas")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="Regras de validação")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v:
            raise ValueError('Código é obrigatório')
        # Permitir apenas letras, números e underscore
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Código deve conter apenas letras, números, underscore ou hífen')
        return v.lower().strip()
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Nome é obrigatório')
        return v.strip()
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v):
        if v is None:
            return v
        v = v.strip()
        # Aceitar hex colors ou nomes de cores CSS básicas
        if v.startswith('#'):
            if len(v) not in [4, 7]:  # #RGB ou #RRGGBB
                raise ValueError('Cor hex deve ter formato #RGB ou #RRGGBB')
        return v


class PaymentMethodCreate(PaymentMethodBase):
    """Schema para criação de PaymentMethod"""
    pass


class PaymentMethodUpdate(BaseModel):
    """Schema para atualização de PaymentMethod"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    display_order: Optional[int] = Field(None, ge=0, le=999)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    requires_reference: Optional[bool] = None
    has_fees: Optional[bool] = None
    default_fee_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    settings: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v is not None:
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError('Código deve conter apenas letras, números, underscore ou hífen')
            return v.lower().strip()
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Nome não pode ser vazio')
            return v.strip()
        return v
    
    @field_validator('color')
    @classmethod
    def validate_color(cls, v):
        if v is not None:
            v = v.strip()
            if v.startswith('#'):
                if len(v) not in [4, 7]:
                    raise ValueError('Cor hex deve ter formato #RGB ou #RRGGBB')
        return v


class PaymentMethodResponse(PaymentMethodBase):
    """Schema para resposta de PaymentMethod"""
    id: int
    tenant_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    # Campos computados
    display_name: str = Field(..., description="Nome formatado para exibição")
    is_card_payment: bool = Field(..., description="Se é pagamento com cartão")
    is_electronic_payment: bool = Field(..., description="Se é pagamento eletrônico")
    requires_external_validation: bool = Field(..., description="Se requer validação externa")
    
    class Config:
        from_attributes = True


class PaymentMethodListResponse(BaseModel):
    """Schema para lista paginada de métodos de pagamento"""
    payment_methods: List[PaymentMethodResponse]
    total: int
    page: int
    pages: int
    per_page: int


class PaymentMethodBulkOperation(BaseModel):
    """Schema para operações em massa"""
    payment_method_ids: List[int] = Field(..., min_length=1, description="IDs dos métodos")
    operation: str = Field(..., description="Operação: activate, deactivate, delete")
    
    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v):
        valid_operations = ['activate', 'deactivate', 'delete']
        if v not in valid_operations:
            raise ValueError(f'Operação deve ser uma de: {", ".join(valid_operations)}')
        return v


class PaymentMethodFilters(BaseModel):
    """Schema para filtros de busca"""
    search: Optional[str] = Field(None, description="Busca por nome ou código")
    is_active: Optional[bool] = Field(None, description="Filtrar por ativo/inativo")
    has_fees: Optional[bool] = Field(None, description="Filtrar por métodos com taxa")
    requires_reference: Optional[bool] = Field(None, description="Filtrar por métodos que requerem referência")
    code_list: Optional[List[str]] = Field(None, description="Lista de códigos específicos")


class PaymentMethodStats(BaseModel):
    """Schema para estatísticas de métodos de pagamento"""
    total_methods: int
    active_methods: int
    inactive_methods: int
    methods_with_fees: int
    most_used_method: Optional[str]
    total_transactions: int
    total_volume: Decimal
    
    class Config:
        from_attributes = True


class PaymentMethodUsage(BaseModel):
    """Schema para uso de método de pagamento"""
    method_id: int
    method_name: str
    method_code: str
    transaction_count: int
    total_amount: Decimal
    percentage_usage: float
    
    class Config:
        from_attributes = True


class PaymentMethodOrderUpdate(BaseModel):
    """Schema para atualização da ordem de exibição"""
    payment_method_orders: List[Dict[str, int]] = Field(
        ..., 
        description="Lista de {'id': int, 'display_order': int}"
    )
    
    @field_validator('payment_method_orders')
    @classmethod
    def validate_orders(cls, v):
        if not v:
            raise ValueError('Lista não pode ser vazia')
        
        for item in v:
            if not isinstance(item, dict):
                raise ValueError('Cada item deve ser um dicionário')
            if 'id' not in item or 'display_order' not in item:
                raise ValueError('Cada item deve ter "id" e "display_order"')
            if not isinstance(item['id'], int) or not isinstance(item['display_order'], int):
                raise ValueError('ID e display_order devem ser inteiros')
            if item['display_order'] < 0:
                raise ValueError('display_order deve ser >= 0')
        
        return v