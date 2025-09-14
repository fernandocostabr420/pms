# backend/app/schemas/wubook_mapping.py

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


# ============== ROOM MAPPING SCHEMAS ==============

class WuBookRoomMappingBase(BaseModel):
    """Schema base para mapeamento de quartos"""
    configuration_id: int = Field(..., gt=0, description="ID da configuração WuBook")
    room_id: int = Field(..., gt=0, description="ID do quarto no PMS")
    wubook_room_id: str = Field(..., min_length=1, max_length=50, description="ID do quarto no WuBook")
    wubook_room_name: Optional[str] = Field(None, max_length=200, description="Nome do quarto no WuBook")
    wubook_room_type: Optional[str] = Field(None, max_length=100, description="Tipo do quarto no WuBook")
    
    # Status
    is_active: bool = Field(True, description="Mapeamento ativo")
    is_syncing: bool = Field(True, description="Sincronização habilitada")
    
    # Configurações de sincronização
    sync_availability: bool = Field(True, description="Sincronizar disponibilidade")
    sync_rates: bool = Field(True, description="Sincronizar tarifas")
    sync_restrictions: bool = Field(True, description="Sincronizar restrições")
    
    # Ocupação
    max_occupancy: Optional[int] = Field(None, ge=1, le=20, description="Ocupação máxima")
    standard_occupancy: Optional[int] = Field(None, ge=1, le=20, description="Ocupação padrão")
    min_occupancy: int = Field(1, ge=1, le=20, description="Ocupação mínima")
    
    # Configurações de preço
    base_rate_override: Optional[Decimal] = Field(None, ge=0, description="Tarifa base sobrescrita")
    rate_multiplier: Decimal = Field(Decimal("1.000"), ge=0, le=10, description="Multiplicador de tarifa")
    
    # Dados adicionais
    wubook_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dados do WuBook")
    rate_plan_ids: Optional[List[int]] = Field(default_factory=list, description="IDs dos rate plans aplicáveis")
    room_settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Configurações específicas")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadados")


class WuBookRoomMappingCreate(WuBookRoomMappingBase):
    """Schema para criar mapeamento de quarto"""
    pass


class WuBookRoomMappingUpdate(BaseModel):
    """Schema para atualizar mapeamento de quarto"""
    wubook_room_name: Optional[str] = Field(None, max_length=200)
    wubook_room_type: Optional[str] = Field(None, max_length=100)
    
    is_active: Optional[bool] = None
    is_syncing: Optional[bool] = None
    
    sync_availability: Optional[bool] = None
    sync_rates: Optional[bool] = None
    sync_restrictions: Optional[bool] = None
    
    max_occupancy: Optional[int] = Field(None, ge=1, le=20)
    standard_occupancy: Optional[int] = Field(None, ge=1, le=20)
    min_occupancy: Optional[int] = Field(None, ge=1, le=20)
    
    base_rate_override: Optional[Decimal] = Field(None, ge=0)
    rate_multiplier: Optional[Decimal] = Field(None, ge=0, le=10)
    
    rate_plan_ids: Optional[List[int]] = None
    room_settings: Optional[Dict[str, Any]] = None
    metadata_json: Optional[Dict[str, Any]] = None


class WuBookRoomMappingResponse(WuBookRoomMappingBase):
    """Schema para resposta de mapeamento de quarto"""
    id: int
    tenant_id: int
    
    # Timestamps de sincronização
    last_availability_sync: Optional[str]
    last_rate_sync: Optional[str]
    last_restriction_sync: Optional[str]
    last_sync_error: Optional[str]
    sync_error_count: int
    
    # Timestamps do modelo
    created_at: datetime
    updated_at: datetime
    
    # Dados do quarto PMS (joins)
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    room_type_name: Optional[str] = None
    
    # Campos computados
    is_ready: Optional[bool] = None
    has_sync_errors: Optional[bool] = None
    needs_availability_sync: Optional[bool] = None
    needs_rate_sync: Optional[bool] = None
    effective_rate_multiplier: Optional[float] = None
    
    model_config = ConfigDict(from_attributes=True)


class WuBookRoomMappingBulkCreate(BaseModel):
    """Schema para criar múltiplos mapeamentos"""
    configuration_id: int = Field(..., gt=0, description="ID da configuração")
    mappings: List[Dict[str, Any]] = Field(..., description="Lista de mapeamentos")
    
    @field_validator('mappings')
    @classmethod
    def validate_mappings(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Pelo menos um mapeamento é necessário')
        for mapping in v:
            if 'room_id' not in mapping or 'wubook_room_id' not in mapping:
                raise ValueError('Cada mapeamento deve ter room_id e wubook_room_id')
        return v


class WuBookRoomSuggestion(BaseModel):
    """Schema para sugestão de mapeamento"""
    room_id: int
    room_number: str
    room_name: str
    room_type: str
    wubook_room_id: str
    wubook_room_name: str
    wubook_room_type: str
    confidence_score: float = Field(..., ge=0, le=1, description="Score de confiança da sugestão")
    match_reason: str = Field(..., description="Motivo da sugestão")


# ============== RATE PLAN SCHEMAS ==============

class RatePlanTypeEnum(str, Enum):
    """Enum para tipos de rate plan"""
    STANDARD = "standard"
    NON_REFUNDABLE = "non_refundable"
    PACKAGE = "package"
    CORPORATE = "corporate"
    LONG_STAY = "long_stay"
    EARLY_BOOKING = "early_booking"
    LAST_MINUTE = "last_minute"


class DerivationTypeEnum(str, Enum):
    """Enum para tipos de derivação"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class WuBookRatePlanBase(BaseModel):
    """Schema base para rate plan"""
    configuration_id: int = Field(..., gt=0, description="ID da configuração")
    wubook_rate_plan_id: str = Field(..., min_length=1, max_length=50, description="ID do rate plan no WuBook")
    name: str = Field(..., min_length=1, max_length=200, description="Nome do rate plan")
    code: str = Field(..., min_length=1, max_length=50, description="Código do rate plan")
    description: Optional[str] = Field(None, description="Descrição")
    
    # Tipo e status
    plan_type: RatePlanTypeEnum = Field(RatePlanTypeEnum.STANDARD, description="Tipo do rate plan")
    is_active: bool = Field(True, description="Rate plan ativo")
    is_visible: bool = Field(True, description="Visível nos canais")
    is_bookable: bool = Field(True, description="Pode receber reservas")
    
    # Derivação
    parent_rate_plan_id: Optional[int] = Field(None, gt=0, description="ID do rate plan pai")
    is_derived: bool = Field(False, description="É derivado")
    derivation_type: Optional[DerivationTypeEnum] = None
    derivation_value: Optional[Decimal] = Field(None, description="Valor da derivação")
    
    # Validade
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    applicable_days: Optional[List[int]] = Field(default_factory=list, description="Dias da semana (0-6)")
    available_channels: Optional[List[str]] = Field(default_factory=list, description="Canais disponíveis")
    
    # Regras de estadia
    min_stay: int = Field(1, ge=1, le=365, description="Estadia mínima")
    max_stay: Optional[int] = Field(None, ge=1, le=365, description="Estadia máxima")
    min_advance_days: int = Field(0, ge=0, le=365, description="Antecedência mínima")
    max_advance_days: Optional[int] = Field(None, ge=0, le=365, description="Antecedência máxima")
    
    # Tarifas base
    base_rate_single: Optional[Decimal] = Field(None, ge=0, description="Tarifa single")
    base_rate_double: Optional[Decimal] = Field(None, ge=0, description="Tarifa double")
    base_rate_triple: Optional[Decimal] = Field(None, ge=0, description="Tarifa triple")
    base_rate_quad: Optional[Decimal] = Field(None, ge=0, description="Tarifa quad")
    
    # Tarifas extras
    extra_adult_rate: Optional[Decimal] = Field(None, ge=0, description="Tarifa por adulto extra")
    extra_child_rate: Optional[Decimal] = Field(None, ge=0, description="Tarifa por criança extra")
    
    # Políticas
    cancellation_policy: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Política de cancelamento")
    payment_policy: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Política de pagamento")
    inclusions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Inclusões")
    restrictions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Restrições")
    
    # Yield Management
    yield_enabled: bool = Field(False, description="Yield management habilitado")
    yield_rules: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Regras de yield")
    
    # Dados adicionais
    wubook_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dados do WuBook")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadados")
    
    @field_validator('applicable_days')
    @classmethod
    def validate_applicable_days(cls, v):
        if v:
            for day in v:
                if not 0 <= day <= 6:
                    raise ValueError('Dias devem estar entre 0 (segunda) e 6 (domingo)')
        return v


class WuBookRatePlanCreate(WuBookRatePlanBase):
    """Schema para criar rate plan"""
    pass


class WuBookRatePlanUpdate(BaseModel):
    """Schema para atualizar rate plan"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    
    plan_type: Optional[RatePlanTypeEnum] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_bookable: Optional[bool] = None
    
    derivation_type: Optional[DerivationTypeEnum] = None
    derivation_value: Optional[Decimal] = None
    
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    applicable_days: Optional[List[int]] = None
    available_channels: Optional[List[str]] = None
    
    min_stay: Optional[int] = Field(None, ge=1, le=365)
    max_stay: Optional[int] = Field(None, ge=1, le=365)
    min_advance_days: Optional[int] = Field(None, ge=0, le=365)
    max_advance_days: Optional[int] = Field(None, ge=0, le=365)
    
    base_rate_single: Optional[Decimal] = Field(None, ge=0)
    base_rate_double: Optional[Decimal] = Field(None, ge=0)
    base_rate_triple: Optional[Decimal] = Field(None, ge=0)
    base_rate_quad: Optional[Decimal] = Field(None, ge=0)
    
    extra_adult_rate: Optional[Decimal] = Field(None, ge=0)
    extra_child_rate: Optional[Decimal] = Field(None, ge=0)
    
    cancellation_policy: Optional[Dict[str, Any]] = None
    payment_policy: Optional[Dict[str, Any]] = None
    inclusions: Optional[Dict[str, Any]] = None
    restrictions: Optional[Dict[str, Any]] = None
    
    yield_enabled: Optional[bool] = None
    yield_rules: Optional[Dict[str, Any]] = None


class WuBookRatePlanResponse(WuBookRatePlanBase):
    """Schema para resposta de rate plan"""
    id: int
    tenant_id: int
    
    # Timestamps
    last_sync_at: Optional[str]
    last_rate_update: Optional[str]
    sync_error: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    
    # Dados relacionados
    parent_plan_name: Optional[str] = None
    derived_plans_count: Optional[int] = None
    
    # Campos computados
    is_valid: Optional[bool] = None
    is_available_today: Optional[bool] = None
    
    model_config = ConfigDict(from_attributes=True)


class WuBookRatePlanListResponse(BaseModel):
    """Schema para lista de rate plans"""
    rate_plans: List[WuBookRatePlanResponse]
    total: int


class WuBookRateCalculation(BaseModel):
    """Schema para cálculo de tarifa"""
    rate_plan_id: int
    occupancy: int = Field(..., ge=1, le=10, description="Número de ocupantes")
    checkin_date: date
    checkout_date: date
    
    # Resultado
    base_rate: Decimal
    derivation_applied: Optional[Decimal] = None
    yield_applied: Optional[Decimal] = None
    final_rate: Decimal
    total_nights: int
    total_amount: Decimal


class WuBookRatePlanValidation(BaseModel):
    """Schema para validação de reserva com rate plan"""
    rate_plan_id: int
    checkin_date: date
    checkout_date: date
    advance_days: Optional[int] = None
    
    # Resultado
    is_valid: bool
    error_message: Optional[str] = None
    nights: int
    min_stay_ok: bool
    max_stay_ok: bool
    advance_ok: bool
    dates_ok: bool