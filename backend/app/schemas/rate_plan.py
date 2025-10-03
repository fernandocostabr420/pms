# backend/app/schemas/rate_plan.py

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ============== ENUMS ==============

class RatePlanTypeEnum(str, Enum):
    """Tipos de plano de tarifa"""
    STANDARD = "standard"
    PROMOTIONAL = "promotional"
    SEASONAL = "seasonal"
    PACKAGE = "package"
    CORPORATE = "corporate"


class PricingModeEnum(str, Enum):
    """Modo de precificação"""
    PER_ROOM = "per_room"
    PER_PERSON = "per_person"
    FLAT_RATE = "flat_rate"


# ============== BASE SCHEMAS ==============

class RatePlanBase(BaseModel):
    """Schema base para planos de tarifa"""
    name: str = Field(..., min_length=1, max_length=200, description="Nome do plano")
    code: str = Field(..., min_length=1, max_length=50, description="Código único")
    description: Optional[str] = Field(None, max_length=500, description="Descrição")
    
    # Relacionamentos
    room_type_id: Optional[int] = Field(None, description="Tipo de quarto (None = todos)")
    property_id: Optional[int] = Field(None, description="Propriedade específica")
    
    # Configurações básicas
    rate_plan_type: RatePlanTypeEnum = Field(RatePlanTypeEnum.STANDARD, description="Tipo do plano")
    pricing_mode: PricingModeEnum = Field(PricingModeEnum.PER_ROOM, description="Modo de precificação")
    
    # Status
    is_active: bool = Field(True, description="Plano ativo")
    is_default: bool = Field(False, description="Plano padrão")
    
    # Período de validade
    valid_from: Optional[date] = Field(None, description="Válido a partir de")
    valid_to: Optional[date] = Field(None, description="Válido até")
    
    # Preços base por ocupação
    base_rate_single: Optional[Decimal] = Field(None, ge=0, description="Preço para 1 pessoa")
    base_rate_double: Optional[Decimal] = Field(None, ge=0, description="Preço para 2 pessoas")
    base_rate_triple: Optional[Decimal] = Field(None, ge=0, description="Preço para 3 pessoas")
    base_rate_quad: Optional[Decimal] = Field(None, ge=0, description="Preço para 4 pessoas")
    
    # Preços extras
    extra_adult_rate: Optional[Decimal] = Field(None, ge=0, description="Preço por adulto adicional")
    extra_child_rate: Optional[Decimal] = Field(None, ge=0, description="Preço por criança adicional")
    
    # Restrições
    min_stay: int = Field(1, ge=1, le=30, description="Estadia mínima")
    max_stay: Optional[int] = Field(None, ge=1, le=365, description="Estadia máxima")
    min_advance_days: int = Field(0, ge=0, description="Antecedência mínima em dias")
    max_advance_days: Optional[int] = Field(None, ge=0, description="Antecedência máxima em dias")
    
    # Configurações adicionais
    inclusions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Inclusões")
    restrictions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Restrições específicas")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Código deve conter apenas letras, números, _ e -')
        return v.upper()


class RatePlanCreate(RatePlanBase):
    """Schema para criar plano de tarifa"""
    pass


class RatePlanUpdate(BaseModel):
    """Schema para atualizar plano de tarifa"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    
    # Status
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    
    # Período
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    
    # Preços base
    base_rate_single: Optional[Decimal] = Field(None, ge=0)
    base_rate_double: Optional[Decimal] = Field(None, ge=0)
    base_rate_triple: Optional[Decimal] = Field(None, ge=0)
    base_rate_quad: Optional[Decimal] = Field(None, ge=0)
    
    # Preços extras
    extra_adult_rate: Optional[Decimal] = Field(None, ge=0)
    extra_child_rate: Optional[Decimal] = Field(None, ge=0)
    
    # Restrições
    min_stay: Optional[int] = Field(None, ge=1, le=30)
    max_stay: Optional[int] = Field(None, ge=1, le=365)
    min_advance_days: Optional[int] = Field(None, ge=0)
    max_advance_days: Optional[int] = Field(None, ge=0)
    
    # Configurações
    inclusions: Optional[Dict[str, Any]] = None
    restrictions: Optional[Dict[str, Any]] = None


class RatePlanResponse(RatePlanBase):
    """Schema para resposta de plano de tarifa"""
    id: int
    tenant_id: int
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Dados relacionados
    room_type_name: Optional[str] = None
    property_name: Optional[str] = None
    
    # Estatísticas computadas
    total_rooms_applicable: Optional[int] = None
    active_pricing_rules: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class RatePlanListResponse(BaseModel):
    """Schema para lista de planos de tarifa"""
    rate_plans: List[RatePlanResponse]
    total: int
    page: int
    pages: int
    per_page: int


# ============== PRICING SCHEMAS ==============

class PricingRuleBase(BaseModel):
    """Schema base para regras de preço específicas"""
    rate_plan_id: int = Field(..., description="ID do plano de tarifa")
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Preços específicos
    rate_single: Optional[Decimal] = Field(None, ge=0, description="Preço para 1 pessoa")
    rate_double: Optional[Decimal] = Field(None, ge=0, description="Preço para 2 pessoas")
    rate_triple: Optional[Decimal] = Field(None, ge=0, description="Preço para 3 pessoas")
    rate_quad: Optional[Decimal] = Field(None, ge=0, description="Preço para 4 pessoas")
    
    # Multiplicadores (alternativos aos preços fixos)
    rate_multiplier: Optional[Decimal] = Field(None, ge=0, le=10, description="Multiplicador do preço base")
    
    # Restrições específicas para este período
    min_stay_override: Optional[int] = Field(None, ge=1, le=30)
    max_stay_override: Optional[int] = Field(None, ge=1, le=365)
    closed_to_arrival: bool = Field(False, description="Fechado para chegada")
    closed_to_departure: bool = Field(False, description="Fechado para partida")
    
    # Status
    is_active: bool = Field(True, description="Regra ativa")


class PricingRuleCreate(PricingRuleBase):
    """Schema para criar regra de preço"""
    pass


class PricingRuleUpdate(BaseModel):
    """Schema para atualizar regra de preço"""
    rate_single: Optional[Decimal] = Field(None, ge=0)
    rate_double: Optional[Decimal] = Field(None, ge=0)
    rate_triple: Optional[Decimal] = Field(None, ge=0)
    rate_quad: Optional[Decimal] = Field(None, ge=0)
    rate_multiplier: Optional[Decimal] = Field(None, ge=0, le=10)
    
    min_stay_override: Optional[int] = Field(None, ge=1, le=30)
    max_stay_override: Optional[int] = Field(None, ge=1, le=365)
    closed_to_arrival: Optional[bool] = None
    closed_to_departure: Optional[bool] = None
    is_active: Optional[bool] = None


class PricingRuleResponse(PricingRuleBase):
    """Schema para resposta de regra de preço"""
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    
    # Dados relacionados
    rate_plan_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============== BULK OPERATIONS ==============

class BulkPricingOperation(BaseModel):
    """Schema para operações em massa de preços"""
    rate_plan_ids: List[int] = Field(..., description="IDs dos planos de tarifa")
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Operação a realizar
    operation_type: str = Field(..., description="Tipo: set, multiply, add")
    
    # Valores para a operação
    values: Dict[str, Any] = Field(..., description="Valores para aplicar")
    # Ex: {"rate_double": 200.00} ou {"multiplier": 1.1}
    
    # Opções
    overwrite_existing: bool = Field(False, description="Sobrescrever regras existentes")
    apply_to_weekends_only: bool = Field(False, description="Aplicar apenas fins de semana")
    apply_to_weekdays_only: bool = Field(False, description="Aplicar apenas dias úteis")


class BulkPricingResult(BaseModel):
    """Schema para resultado de operação em massa"""
    success: bool
    message: str
    total_rules_created: int
    total_rules_updated: int
    total_days_affected: int
    errors: Optional[List[str]] = None


# ============== CALCULATION SCHEMAS ==============

class RateCalculationRequest(BaseModel):
    """Schema para solicitar cálculo de tarifa"""
    rate_plan_id: int
    checkin_date: date
    checkout_date: date
    occupancy: int = Field(..., ge=1, le=10, description="Número de pessoas")
    room_id: Optional[int] = None
    
    # Opções de cálculo
    include_taxes: bool = Field(True, description="Incluir impostos")
    apply_promotions: bool = Field(True, description="Aplicar promoções")


class RateCalculationResponse(BaseModel):
    """Schema para resposta de cálculo de tarifa"""
    rate_plan_id: int
    rate_plan_name: str
    
    checkin_date: date
    checkout_date: date
    total_nights: int
    occupancy: int
    
    # Detalhamento dos preços
    base_rate_per_night: Decimal
    total_base_amount: Decimal
    extra_person_charges: Optional[Decimal] = None
    
    # Modificadores aplicados
    seasonal_adjustment: Optional[Decimal] = None
    promotional_discount: Optional[Decimal] = None
    
    # Total final
    subtotal: Decimal
    taxes: Optional[Decimal] = None
    total_amount: Decimal
    
    # Validações
    is_valid: bool
    validation_errors: Optional[List[str]] = None


# ============== FILTERS ==============

class RatePlanFilters(BaseModel):
    """Schema para filtros de busca"""
    search: Optional[str] = Field(None, description="Busca por nome ou código")
    rate_plan_type: Optional[RatePlanTypeEnum] = None
    room_type_id: Optional[int] = None
    property_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    valid_on_date: Optional[date] = Field(None, description="Válido em data específica")