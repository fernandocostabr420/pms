# backend/app/schemas/sales_channel.py

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum


class ChannelTypeEnum(str, Enum):
    """Enum para tipos de canal"""
    DIRECT = "direct"
    OTA = "ota"
    PHONE = "phone"
    EMAIL = "email"
    WALK_IN = "walk_in"
    CORPORATE = "corporate"
    AGENT = "agent"
    OTHER = "other"


class CommissionTypeEnum(str, Enum):
    """Enum para tipos de comissão"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"
    NONE = "none"


class SalesChannelBase(BaseModel):
    """Schema base para SalesChannel"""
    name: str = Field(..., min_length=1, max_length=100, description="Nome do canal")
    code: str = Field(..., min_length=1, max_length=50, description="Código único do canal")
    description: Optional[str] = Field(None, max_length=1000, description="Descrição detalhada")
    display_order: int = Field(0, ge=0, le=999, description="Ordem de exibição")
    icon: Optional[str] = Field(None, max_length=50, description="Ícone para interface")
    color: Optional[str] = Field(None, max_length=20, description="Cor para interface")
    channel_type: ChannelTypeEnum = Field(ChannelTypeEnum.DIRECT, description="Tipo do canal")
    is_external: bool = Field(False, description="Se é canal externo")
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=1, description="Taxa de comissão")
    commission_type: CommissionTypeEnum = Field(CommissionTypeEnum.NONE, description="Tipo de comissão")
    base_fee: Optional[Decimal] = Field(None, ge=0, description="Taxa base fixa")
    has_api_integration: bool = Field(False, description="Tem integração via API")
    webhook_url: Optional[str] = Field(None, max_length=500, description="URL para webhooks")
    settings: Optional[Dict[str, Any]] = Field(None, description="Configurações específicas")
    business_rules: Optional[Dict[str, Any]] = Field(None, description="Regras de negócio")
    external_id: Optional[str] = Field(None, max_length=100, description="ID no sistema externo")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v:
            raise ValueError('Código é obrigatório')
        # Permitir apenas letras, números e underscore
        if not v.replace('_', '').replace('-', '').replace('.', '').isalnum():
            raise ValueError('Código deve conter apenas letras, números, underscore, hífen ou ponto')
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
        if v.startswith('#'):
            if len(v) not in [4, 7]:  # #RGB ou #RRGGBB
                raise ValueError('Cor hex deve ter formato #RGB ou #RRGGBB')
        return v
    
    @field_validator('webhook_url')
    @classmethod
    def validate_webhook_url(cls, v):
        if v is None:
            return v
        v = v.strip()
        if v and not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('URL do webhook deve começar com http:// ou https://')
        return v


class SalesChannelCreate(SalesChannelBase):
    """Schema para criação de SalesChannel"""
    # Credenciais opcionais para criação (serão criptografadas)
    credentials: Optional[Dict[str, str]] = Field(None, description="Credenciais de integração")


class SalesChannelUpdate(BaseModel):
    """Schema para atualização de SalesChannel"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    display_order: Optional[int] = Field(None, ge=0, le=999)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    channel_type: Optional[ChannelTypeEnum] = None
    is_external: Optional[bool] = None
    is_active: Optional[bool] = None
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    commission_type: Optional[CommissionTypeEnum] = None
    base_fee: Optional[Decimal] = Field(None, ge=0)
    has_api_integration: Optional[bool] = None
    webhook_url: Optional[str] = Field(None, max_length=500)
    settings: Optional[Dict[str, Any]] = None
    business_rules: Optional[Dict[str, Any]] = None
    external_id: Optional[str] = Field(None, max_length=100)
    credentials: Optional[Dict[str, str]] = Field(None, description="Credenciais de integração")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v is not None:
            if not v.replace('_', '').replace('-', '').replace('.', '').isalnum():
                raise ValueError('Código deve conter apenas letras, números, underscore, hífen ou ponto')
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
    
    @field_validator('webhook_url')
    @classmethod
    def validate_webhook_url(cls, v):
        if v is not None:
            v = v.strip()
            if v and not (v.startswith('http://') or v.startswith('https://')):
                raise ValueError('URL do webhook deve começar com http:// ou https://')
        return v


class SalesChannelResponse(SalesChannelBase):
    """Schema para resposta de SalesChannel"""
    id: int
    tenant_id: int
    is_active: bool
    api_config: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    # Campos computados (não incluir credenciais por segurança)
    display_name: str = Field(..., description="Nome formatado para exibição")
    is_ota: bool = Field(..., description="Se é uma OTA")
    requires_commission: bool = Field(..., description="Se cobra comissão")
    has_integration: bool = Field(..., description="Se tem integração técnica")
    channel_type_display: str = Field(..., description="Tipo do canal formatado")
    
    class Config:
        from_attributes = True


class SalesChannelListResponse(BaseModel):
    """Schema para lista paginada de canais de venda"""
    sales_channels: List[SalesChannelResponse]
    total: int
    page: int
    pages: int
    per_page: int


class SalesChannelBulkOperation(BaseModel):
    """Schema para operações em massa"""
    sales_channel_ids: List[int] = Field(..., min_length=1, description="IDs dos canais")
    operation: str = Field(..., description="Operação: activate, deactivate, delete")
    
    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v):
        valid_operations = ['activate', 'deactivate', 'delete']
        if v not in valid_operations:
            raise ValueError(f'Operação deve ser uma de: {", ".join(valid_operations)}')
        return v


class SalesChannelFilters(BaseModel):
    """Schema para filtros de busca"""
    search: Optional[str] = Field(None, description="Busca por nome ou código")
    is_active: Optional[bool] = Field(None, description="Filtrar por ativo/inativo")
    is_external: Optional[bool] = Field(None, description="Filtrar por canais externos")
    channel_type: Optional[ChannelTypeEnum] = Field(None, description="Filtrar por tipo")
    has_api_integration: Optional[bool] = Field(None, description="Filtrar por integração API")
    requires_commission: Optional[bool] = Field(None, description="Filtrar por comissão")
    code_list: Optional[List[str]] = Field(None, description="Lista de códigos específicos")


class SalesChannelStats(BaseModel):
    """Schema para estatísticas de canais de venda"""
    total_channels: int
    active_channels: int
    inactive_channels: int
    external_channels: int
    channels_with_integration: int
    channels_with_commission: int
    most_used_channel: Optional[str]
    total_reservations: int
    total_revenue: Decimal
    average_commission_rate: Optional[Decimal]
    
    class Config:
        from_attributes = True


class SalesChannelUsage(BaseModel):
    """Schema para uso de canal de venda"""
    channel_id: int
    channel_name: str
    channel_code: str
    channel_type: str
    reservation_count: int
    total_revenue: Decimal
    commission_amount: Decimal
    percentage_usage: float
    
    class Config:
        from_attributes = True


class SalesChannelCommission(BaseModel):
    """Schema para cálculo de comissão"""
    channel_id: int
    channel_name: str
    base_amount: Decimal
    commission_rate: Optional[Decimal]
    commission_type: str
    base_fee: Optional[Decimal]
    calculated_commission: Decimal
    net_amount: Decimal
    
    class Config:
        from_attributes = True


class SalesChannelOrderUpdate(BaseModel):
    """Schema para atualização da ordem de exibição"""
    sales_channel_orders: List[Dict[str, int]] = Field(
        ..., 
        description="Lista de {'id': int, 'display_order': int}"
    )
    
    @field_validator('sales_channel_orders')
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


class SalesChannelTestConnection(BaseModel):
    """Schema para testar conexão com canal externo"""
    channel_id: int
    test_type: str = Field(..., description="Tipo de teste: api, webhook, credentials")
    
    @field_validator('test_type')
    @classmethod
    def validate_test_type(cls, v):
        valid_types = ['api', 'webhook', 'credentials']
        if v not in valid_types:
            raise ValueError(f'Tipo de teste deve ser um de: {", ".join(valid_types)}')
        return v


class SalesChannelTestResult(BaseModel):
    """Schema para resultado do teste de conexão"""
    channel_id: int
    channel_name: str
    test_type: str
    success: bool
    message: str
    response_time: Optional[float] = None
    error_details: Optional[Dict[str, Any]] = None
    tested_at: datetime
    
    class Config:
        from_attributes = True