# backend/app/schemas/wubook_sync.py

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
from enum import Enum


class SyncTypeEnum(str, Enum):
    """Enum para tipos de sincronização"""
    AVAILABILITY = "availability"
    RATES = "rates"
    RESTRICTIONS = "restrictions"
    BOOKINGS = "bookings"
    ROOMS = "rooms"
    RATE_PLANS = "rate_plans"
    FULL = "full"


class SyncDirectionEnum(str, Enum):
    """Enum para direção de sincronização"""
    INBOUND = "inbound"  # WuBook → PMS
    OUTBOUND = "outbound"  # PMS → WuBook
    BIDIRECTIONAL = "bidirectional"


class SyncStatusEnum(str, Enum):
    """Enum para status de sincronização"""
    STARTED = "started"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class SyncTriggerEnum(str, Enum):
    """Enum para gatilho de sincronização"""
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    WEBHOOK = "webhook"
    CASCADE = "cascade"
    AUTO = "auto"


class WuBookSyncLogBase(BaseModel):
    """Schema base para log de sincronização"""
    configuration_id: int = Field(..., gt=0, description="ID da configuração WuBook")
    sync_type: SyncTypeEnum = Field(..., description="Tipo de sincronização")
    sync_direction: SyncDirectionEnum = Field(..., description="Direção da sincronização")
    
    # Escopo
    date_from: Optional[str] = Field(None, description="Data inicial (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="Data final (YYYY-MM-DD)")
    room_ids: Optional[List[int]] = Field(default_factory=list, description="IDs dos quartos")
    rate_plan_ids: Optional[List[int]] = Field(default_factory=list, description="IDs dos rate plans")
    
    # Auditoria
    triggered_by: SyncTriggerEnum = Field(SyncTriggerEnum.MANUAL, description="Gatilho da sincronização")
    user_id: Optional[int] = Field(None, gt=0, description="ID do usuário que iniciou")
    ip_address: Optional[str] = Field(None, max_length=45, description="IP do cliente")
    user_agent: Optional[str] = Field(None, max_length=255, description="User agent")
    notes: Optional[str] = Field(None, description="Observações")
    
    @field_validator('date_from', 'date_to')
    @classmethod
    def validate_dates(cls, v):
        if v:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Data deve estar no formato YYYY-MM-DD')
        return v


class WuBookSyncLogCreate(WuBookSyncLogBase):
    """Schema para criar log de sincronização"""
    pass


class WuBookSyncLogUpdate(BaseModel):
    """Schema para atualizar log de sincronização"""
    status: Optional[SyncStatusEnum] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[Decimal] = None
    
    # Estatísticas
    total_items: Optional[int] = Field(None, ge=0)
    processed_items: Optional[int] = Field(None, ge=0)
    success_items: Optional[int] = Field(None, ge=0)
    error_items: Optional[int] = Field(None, ge=0)
    skipped_items: Optional[int] = Field(None, ge=0)
    
    # Detalhes
    changes_made: Optional[Dict[str, int]] = None
    conflicts_found: Optional[List[Dict[str, Any]]] = None
    
    # Erro
    error_code: Optional[str] = Field(None, max_length=50)
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    
    # Performance
    api_calls_made: Optional[int] = Field(None, ge=0)
    data_transferred_kb: Optional[Decimal] = Field(None, ge=0)
    
    notes: Optional[str] = None


class WuBookSyncLogResponse(WuBookSyncLogBase):
    """Schema para resposta de log de sincronização"""
    id: int
    tenant_id: int
    
    # Status
    status: SyncStatusEnum
    
    # Timestamps
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[Decimal]
    
    # Estatísticas
    total_items: int
    processed_items: int
    success_items: int
    error_items: int
    skipped_items: int
    
    # Detalhes
    changes_made: Dict[str, int]
    conflicts_found: List[Dict[str, Any]]
    
    # Erro
    error_code: Optional[str]
    error_message: Optional[str]
    error_details: Dict[str, Any]
    retry_count: int
    
    # Dados da requisição/resposta
    request_data: Optional[Dict[str, Any]]
    response_data: Optional[Dict[str, Any]]
    
    # Performance
    api_calls_made: int
    data_transferred_kb: Optional[Decimal]
    
    # Metadados
    metadata_json: Dict[str, Any]
    
    # Timestamps do modelo
    created_at: datetime
    updated_at: datetime
    
    # Campos computados
    is_success: Optional[bool] = None
    is_error: Optional[bool] = None
    is_complete: Optional[bool] = None
    success_rate: Optional[float] = None
    has_conflicts: Optional[bool] = None
    duration_formatted: Optional[str] = None
    
    # Dados relacionados
    configuration_name: Optional[str] = None
    user_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class WuBookSyncLogListResponse(BaseModel):
    """Schema para lista de logs"""
    logs: List[WuBookSyncLogResponse]
    total: int
    page: int
    pages: int
    per_page: int


class WuBookSyncLogFilters(BaseModel):
    """Schema para filtros de busca de logs"""
    configuration_id: Optional[int] = Field(None, gt=0)
    sync_type: Optional[SyncTypeEnum] = None
    sync_direction: Optional[SyncDirectionEnum] = None
    status: Optional[SyncStatusEnum] = None
    triggered_by: Optional[SyncTriggerEnum] = None
    user_id: Optional[int] = Field(None, gt=0)
    
    # Período
    started_from: Optional[datetime] = None
    started_to: Optional[datetime] = None
    completed_from: Optional[datetime] = None
    completed_to: Optional[datetime] = None
    
    # Filtros específicos
    has_errors: Optional[bool] = None
    has_conflicts: Optional[bool] = None
    min_duration_seconds: Optional[float] = Field(None, ge=0)
    max_duration_seconds: Optional[float] = Field(None, ge=0)
    
    # Ordenação
    order_by: Optional[str] = Field("started_at", description="Campo para ordenação")
    order_desc: bool = Field(True, description="Ordem decrescente")


class WuBookSyncLogSummary(BaseModel):
    """Schema para resumo de log"""
    id: int
    sync_type: str
    sync_direction: str
    status: str
    started_at: str
    completed_at: Optional[str]
    duration: str
    total_items: int
    success_items: int
    error_items: int
    success_rate: str
    has_conflicts: bool
    error_message: Optional[str]
    triggered_by: str


class WuBookSyncConflict(BaseModel):
    """Schema para conflito de sincronização"""
    conflict_type: str = Field(..., description="Tipo do conflito")
    entity_type: str = Field(..., description="Tipo da entidade (room, rate, etc)")
    entity_id: str = Field(..., description="ID da entidade")
    date: Optional[str] = Field(None, description="Data do conflito")
    pms_value: Any = Field(..., description="Valor no PMS")
    wubook_value: Any = Field(..., description="Valor no WuBook")
    resolution: Optional[str] = Field(None, description="Como foi resolvido")
    timestamp: str = Field(..., description="Timestamp do conflito")


class WuBookSyncStats(BaseModel):
    """Schema para estatísticas de sincronização"""
    configuration_id: int
    period: str = Field(..., description="Período: today, week, month, year")
    
    # Totais
    total_syncs: int
    successful_syncs: int
    failed_syncs: int
    partial_syncs: int
    
    # Por tipo
    syncs_by_type: Dict[str, int]
    
    # Performance
    average_duration_seconds: float
    total_api_calls: int
    total_data_transferred_mb: float
    
    # Itens
    total_items_processed: int
    total_items_success: int
    total_items_error: int
    average_success_rate: float
    
    # Conflitos
    total_conflicts: int
    conflicts_by_type: Dict[str, int]
    
    # Erros
    total_errors: int
    errors_by_code: Dict[str, int]
    most_common_error: Optional[str]


class WuBookSyncProgress(BaseModel):
    """Schema para progresso de sincronização em tempo real"""
    sync_log_id: int
    status: str
    started_at: str
    elapsed_seconds: float
    estimated_remaining_seconds: Optional[float]
    
    # Progresso
    total_items: int
    processed_items: int
    percent_complete: float
    current_operation: str
    
    # Status
    success_items: int
    error_items: int
    current_error: Optional[str]
    
    # Performance
    items_per_second: float
    api_calls_made: int


class WuBookBulkSyncRequest(BaseModel):
    """Schema para sincronização em massa"""
    sync_types: List[SyncTypeEnum] = Field(..., min_length=1, description="Tipos de sincronização")
    date_from: Optional[str] = Field(None, description="Data inicial (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="Data final (YYYY-MM-DD)")
    configurations: Optional[List[int]] = Field(None, description="IDs das configurações (None = todas)")
    force: bool = Field(False, description="Forçar mesmo se sincronizado recentemente")
    priority: str = Field("normal", description="Prioridade: low, normal, high")
    
    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        valid_priorities = ['low', 'normal', 'high']
        if v not in valid_priorities:
            raise ValueError(f'Prioridade deve ser uma de: {", ".join(valid_priorities)}')
        return v


class WuBookSyncSchedule(BaseModel):
    """Schema para agendamento de sincronização"""
    configuration_id: int = Field(..., gt=0)
    sync_type: SyncTypeEnum
    
    # Agendamento
    is_active: bool = Field(True, description="Agendamento ativo")
    frequency: str = Field(..., description="Frequência: minutes, hourly, daily, weekly")
    interval_value: int = Field(..., ge=1, description="Intervalo (ex: 15 para cada 15 minutos)")
    
    # Horário específico (opcional)
    time_of_day: Optional[str] = Field(None, description="Horário (HH:MM) para daily/weekly")
    days_of_week: Optional[List[int]] = Field(None, description="Dias da semana (0-6) para weekly")
    
    # Configurações
    date_range_days: int = Field(30, ge=1, le=365, description="Dias para frente para sincronizar")
    retry_on_error: bool = Field(True, description="Tentar novamente em caso de erro")
    max_retries: int = Field(3, ge=0, le=10, description="Máximo de tentativas")
    
    # Última execução
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    last_status: Optional[str] = None
    
    @field_validator('frequency')
    @classmethod
    def validate_frequency(cls, v):
        valid_frequencies = ['minutes', 'hourly', 'daily', 'weekly']
        if v not in valid_frequencies:
            raise ValueError(f'Frequência deve ser uma de: {", ".join(valid_frequencies)}')
        return v
    
    @field_validator('time_of_day')
    @classmethod
    def validate_time(cls, v):
        if v:
            try:
                datetime.strptime(v, '%H:%M')
            except ValueError:
                raise ValueError('Horário deve estar no formato HH:MM')
        return v