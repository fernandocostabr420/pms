# backend/app/schemas/reservation_restriction.py

from pydantic import BaseModel, Field, validator, root_validator
from typing import Optional, List, Dict, Any, Union
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ============== ENUMS ==============

class RestrictionTypeEnum(str, Enum):
    """Enum para tipos de restrição"""
    MIN_STAY = "min_stay"
    MAX_STAY = "max_stay"
    CLOSED_TO_ARRIVAL = "closed_to_arrival"
    CLOSED_TO_DEPARTURE = "closed_to_departure"
    STOP_SELL = "stop_sell"
    MIN_ADVANCE_BOOKING = "min_advance_booking"
    MAX_ADVANCE_BOOKING = "max_advance_booking"
    CLOSED_TO_CHECKOUT = "closed_to_checkout"  # Alias para CTD
    NO_ARRIVAL = "no_arrival"  # Alias para CTA


class RestrictionScopeEnum(str, Enum):
    """Enum para escopo de aplicação"""
    PROPERTY = "property"
    ROOM_TYPE = "room_type"
    ROOM = "room"


class RestrictionSourceEnum(str, Enum):
    """Enum para origem da restrição"""
    MANUAL = "manual"
    CHANNEL_MANAGER = "channel_manager"
    YIELD_MANAGEMENT = "yield_management"
    BULK_IMPORT = "bulk_import"
    API = "api"


# ============== SCHEMAS BASE ==============

class ReservationRestrictionBase(BaseModel):
    """Schema base para restrições"""
    property_id: int = Field(..., gt=0, description="ID da propriedade")
    room_type_id: Optional[int] = Field(None, gt=0, description="ID do tipo de quarto (opcional)")
    room_id: Optional[int] = Field(None, gt=0, description="ID do quarto específico (opcional)")
    
    date_from: date = Field(..., description="Data de início da restrição")
    date_to: date = Field(..., description="Data de fim da restrição")
    days_of_week: Optional[List[int]] = Field(None, description="Dias da semana aplicáveis (0-6)")
    
    restriction_type: RestrictionTypeEnum = Field(..., description="Tipo da restrição")
    restriction_value: Optional[int] = Field(None, ge=0, description="Valor da restrição (para min/max stay)")
    is_restricted: bool = Field(True, description="Se a restrição está ativa")
    
    name: Optional[str] = Field(None, max_length=200, description="Nome da restrição")
    description: Optional[str] = Field(None, description="Descrição detalhada")
    reason: Optional[str] = Field(None, max_length=200, description="Motivo da restrição")
    
    is_active: bool = Field(True, description="Restrição ativa")
    priority: int = Field(1, ge=1, le=10, description="Prioridade (1-10)")
    
    @validator('days_of_week')
    def validate_days_of_week(cls, v):
        if v is not None:
            if not all(0 <= day <= 6 for day in v):
                raise ValueError('Dias da semana devem estar entre 0-6 (0=segunda, 6=domingo)')
            if len(set(v)) != len(v):
                raise ValueError('Dias da semana não podem estar duplicados')
        return v
    
    @validator('date_to')
    def validate_date_range(cls, v, values):
        if 'date_from' in values and v < values['date_from']:
            raise ValueError('Data final deve ser posterior à data inicial')
        return v
    
    @validator('restriction_value')
    def validate_restriction_value(cls, v, values):
        restriction_type = values.get('restriction_type')
        
        # Tipos que exigem valor
        value_required_types = [
            RestrictionTypeEnum.MIN_STAY,
            RestrictionTypeEnum.MAX_STAY,
            RestrictionTypeEnum.MIN_ADVANCE_BOOKING,
            RestrictionTypeEnum.MAX_ADVANCE_BOOKING
        ]
        
        if restriction_type in value_required_types and v is None:
            raise ValueError(f'Tipo {restriction_type} requer um valor')
        
        # Tipos que não devem ter valor
        if restriction_type not in value_required_types and v is not None:
            raise ValueError(f'Tipo {restriction_type} não deve ter valor')
        
        return v


# ============== SCHEMAS CRUD ==============

class ReservationRestrictionCreate(ReservationRestrictionBase):
    """Schema para criação de restrições"""
    source: RestrictionSourceEnum = Field(RestrictionSourceEnum.MANUAL, description="Origem da restrição")
    channel_manager_id: Optional[str] = Field(None, max_length=50, description="ID no Channel Manager")
    channel_name: Optional[str] = Field(None, max_length=100, description="Nome do canal")
    metadata_json: Optional[Dict[str, Any]] = Field(None, description="Metadados adicionais")


class ReservationRestrictionUpdate(BaseModel):
    """Schema para atualização de restrições"""
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    days_of_week: Optional[List[int]] = None
    
    restriction_type: Optional[RestrictionTypeEnum] = None
    restriction_value: Optional[int] = Field(None, ge=0)
    is_restricted: Optional[bool] = None
    
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    reason: Optional[str] = Field(None, max_length=200)
    
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    
    metadata_json: Optional[Dict[str, Any]] = None
    
    @validator('days_of_week')
    def validate_days_of_week(cls, v):
        if v is not None:
            if not all(0 <= day <= 6 for day in v):
                raise ValueError('Dias da semana devem estar entre 0-6')
        return v


class ReservationRestrictionResponse(ReservationRestrictionBase):
    """Schema para resposta de restrições"""
    id: int
    tenant_id: int
    
    source: str
    channel_manager_id: Optional[str]
    channel_name: Optional[str]
    
    sync_pending: bool
    last_sync_at: Optional[str]
    sync_error: Optional[str]
    
    metadata_json: Optional[Dict[str, Any]]
    channel_settings: Optional[Dict[str, Any]]
    
    created_at: datetime
    updated_at: datetime
    
    # Campos computados
    scope_level: Optional[str] = None
    scope_description: Optional[str] = None
    restriction_description: Optional[str] = None
    
    # Dados relacionados
    property_name: Optional[str] = None
    room_type_name: Optional[str] = None
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============== SCHEMAS DE LISTAGEM ==============

class ReservationRestrictionListResponse(BaseModel):
    """Schema para lista de restrições"""
    restrictions: List[ReservationRestrictionResponse]
    total: int
    page: int
    pages: int
    per_page: int


class ReservationRestrictionFilters(BaseModel):
    """Schema para filtros de busca"""
    property_id: Optional[int] = None
    room_type_id: Optional[int] = None
    room_id: Optional[int] = None
    
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    
    restriction_type: Optional[RestrictionTypeEnum] = None
    restriction_types: Optional[List[RestrictionTypeEnum]] = None  # Múltiplos tipos
    
    is_active: Optional[bool] = None
    is_restricted: Optional[bool] = None
    
    source: Optional[RestrictionSourceEnum] = None
    channel_name: Optional[str] = None
    
    scope_level: Optional[RestrictionScopeEnum] = None
    
    sync_pending: Optional[bool] = None
    has_sync_error: Optional[bool] = None
    
    priority_min: Optional[int] = Field(None, ge=1, le=10)
    priority_max: Optional[int] = Field(None, ge=1, le=10)
    
    search: Optional[str] = Field(None, description="Buscar em nome, descrição ou motivo")


# ============== OPERAÇÕES EM MASSA ==============

class BulkRestrictionOperation(BaseModel):
    """Schema para operações em massa"""
    operation: str = Field(..., pattern="^(create|update|delete)$", description="Tipo de operação")
    
    # Escopo da operação
    property_ids: List[int] = Field(..., min_items=1, description="IDs das propriedades")
    room_type_ids: Optional[List[int]] = Field(None, description="IDs dos tipos de quarto")
    room_ids: Optional[List[int]] = Field(None, description="IDs dos quartos específicos")
    
    # Período
    date_from: date = Field(..., description="Data de início")
    date_to: date = Field(..., description="Data de fim")
    days_of_week: Optional[List[int]] = Field(None, description="Dias da semana (0-6)")
    
    # Configurações da restrição
    restriction_type: RestrictionTypeEnum = Field(..., description="Tipo da restrição")
    restriction_value: Optional[int] = Field(None, ge=0, description="Valor da restrição")
    is_restricted: bool = Field(True, description="Status da restrição")
    
    # Metadados
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    reason: Optional[str] = Field(None, max_length=200)
    priority: int = Field(1, ge=1, le=10)
    
    # Configurações da operação
    overwrite_existing: bool = Field(False, description="Sobrescrever restrições existentes")
    dry_run: bool = Field(False, description="Apenas simular a operação")
    
    @validator('room_type_ids')
    def validate_room_type_scope(cls, v, values):
        room_ids = values.get('room_ids')
        if v and room_ids:
            raise ValueError('Não é possível especificar room_type_ids e room_ids simultaneamente')
        return v


class BulkRestrictionResult(BaseModel):
    """Schema para resultado de operações em massa"""
    success: bool
    operation: str
    message: str
    
    total_restrictions_processed: int = 0
    total_restrictions_created: int = 0
    total_restrictions_updated: int = 0
    total_restrictions_deleted: int = 0
    total_days_affected: int = 0
    
    conflicts_found: List[Dict[str, Any]] = []
    errors: Optional[List[str]] = None
    
    # Detalhamento por escopo
    properties_affected: List[int] = []
    room_types_affected: List[int] = []
    rooms_affected: List[int] = []
    
    # Para dry run
    would_create: int = 0
    would_update: int = 0
    would_delete: int = 0


# ============== VALIDAÇÃO DE RESTRIÇÕES ==============

class RestrictionValidationRequest(BaseModel):
    """Schema para validação de restrições"""
    property_id: int = Field(..., gt=0)
    room_id: Optional[int] = Field(None, gt=0)
    room_type_id: Optional[int] = Field(None, gt=0)
    
    check_in_date: date
    check_out_date: date
    nights: Optional[int] = Field(None, ge=1)
    
    advance_days: Optional[int] = Field(None, ge=0, description="Dias de antecedência da reserva")
    
    @validator('check_out_date')
    def validate_dates(cls, v, values):
        if 'check_in_date' in values and v <= values['check_in_date']:
            raise ValueError('Data de check-out deve ser posterior ao check-in')
        return v
    
    @validator('nights')
    def validate_nights(cls, v, values):
        if v is not None and 'check_in_date' in values and 'check_out_date' in values:
            calculated_nights = (values['check_out_date'] - values['check_in_date']).days
            if v != calculated_nights:
                raise ValueError('Número de noites não confere com as datas')
        return v


class RestrictionViolation(BaseModel):
    """Schema para violação de restrição"""
    restriction_id: int
    restriction_type: str
    restriction_description: str
    violation_message: str
    scope_level: str
    scope_description: str
    date_affected: Optional[date] = None
    can_override: bool = False


class RestrictionValidationResponse(BaseModel):
    """Schema para resposta de validação"""
    is_valid: bool
    violations: List[RestrictionViolation] = []
    warnings: List[str] = []
    
    # Detalhes da validação
    property_id: int
    room_id: Optional[int]
    room_type_id: Optional[int]
    check_in_date: date
    check_out_date: date
    nights: int
    
    # Restrições aplicáveis encontradas
    applicable_restrictions: List[ReservationRestrictionResponse] = []


# ============== CALENDAR GRID ==============

class CalendarRestrictionRequest(BaseModel):
    """Schema para requisição de calendário de restrições"""
    property_id: int = Field(..., gt=0)
    room_type_id: Optional[int] = Field(None, gt=0)
    room_id: Optional[int] = Field(None, gt=0)
    
    date_from: date
    date_to: date
    
    restriction_types: Optional[List[RestrictionTypeEnum]] = Field(None, description="Filtrar tipos específicos")
    include_inactive: bool = Field(False, description="Incluir restrições inativas")
    
    @validator('date_to')
    def validate_date_range(cls, v, values):
        if 'date_from' in values:
            if v < values['date_from']:
                raise ValueError('Data final deve ser posterior à inicial')
            # Limitar a 3 meses para performance
            days_diff = (v - values['date_from']).days
            if days_diff > 90:
                raise ValueError('Período máximo de 90 dias')
        return v


class CalendarDayRestriction(BaseModel):
    """Schema para restrições em um dia específico"""
    date: date
    restrictions: List[ReservationRestrictionResponse]
    
    # Status consolidado do dia
    has_min_stay: bool = False
    has_max_stay: bool = False
    is_closed_to_arrival: bool = False
    is_closed_to_departure: bool = False
    is_stop_sell: bool = False
    
    min_stay_value: Optional[int] = None
    max_stay_value: Optional[int] = None
    
    # Nível de restrição (para cores no frontend)
    restriction_level: str = "none"  # none, low, medium, high, blocked


class CalendarRestrictionResponse(BaseModel):
    """Schema para resposta de calendário"""
    property_id: int
    room_type_id: Optional[int]
    room_id: Optional[int]
    
    date_from: date
    date_to: date
    
    days: List[CalendarDayRestriction]
    
    # Estatísticas
    total_days: int
    days_with_restrictions: int
    total_restrictions: int
    
    # Resumo por tipo
    restriction_summary: Dict[str, int]  # {"min_stay": 5, "cta": 3, ...}