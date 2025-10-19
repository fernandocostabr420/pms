# backend/app/schemas/channel_manager.py

from pydantic import BaseModel, Field, field_validator, ConfigDict, model_validator
from typing import Optional, List, Dict, Any, Union
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ============== ENUMS ==============

class ChannelSyncStatus(str, Enum):
    """Status de sincronização de canal"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    SYNCING = "syncing"
    PENDING = "pending"


class SyncDirection(str, Enum):
    """Direção de sincronização"""
    INBOUND = "inbound"         # WuBook -> PMS
    OUTBOUND = "outbound"       # PMS -> WuBook
    BIDIRECTIONAL = "bidirectional"  # Ambos


class SyncFrequency(str, Enum):
    """Frequência de sincronização"""
    REAL_TIME = "real_time"     # Tempo real
    EVERY_5MIN = "every_5min"   # A cada 5 minutos
    EVERY_15MIN = "every_15min" # A cada 15 minutos
    EVERY_30MIN = "every_30min" # A cada 30 minutos
    HOURLY = "hourly"           # A cada hora
    DAILY = "daily"             # Diário
    MANUAL = "manual"           # Apenas manual


class ChannelType(str, Enum):
    """Tipos de canal de venda"""
    BOOKING_COM = "booking_com"
    EXPEDIA = "expedia"
    AIRBNB = "airbnb"
    HOTELS_COM = "hotels_com"
    AGODA = "agoda"
    DESPEGAR = "despegar"
    TRIVAGO = "trivago"
    GOOGLE_HOTEL_ADS = "google_hotel_ads"
    OTHER = "other"


# ============== CHANNEL MANAGER OVERVIEW ==============

class ChannelManagerOverview(BaseModel):
    """Schema para visão geral do Channel Manager"""
    model_config = ConfigDict(from_attributes=True)
    
    # Informações gerais
    total_configurations: int = Field(..., description="Total de configurações")
    active_configurations: int = Field(..., description="Configurações ativas")
    connected_channels: int = Field(..., description="Canais conectados")
    
    # Status de sincronização
    sync_status: Dict[str, int] = Field(..., description="Contadores por status")
    last_sync_at: Optional[datetime] = Field(None, description="Última sincronização")
    
    # Estatísticas de disponibilidade
    availability_stats: Dict[str, Any] = Field(..., description="Estatísticas de disponibilidade")
    
    # Estatísticas de sincronização
    sync_stats: Dict[str, Any] = Field(..., description="Estatísticas de sincronização")
    
    # Canais por tipo
    channels_by_type: Dict[str, int] = Field(..., description="Canais por tipo")
    
    # Alertas e notificações
    alerts: List[Dict[str, Any]] = Field(default_factory=list, description="Alertas ativos")
    
    # Período de análise
    period: Dict[str, str] = Field(..., description="Período analisado")


# ============== CHANNEL CONFIGURATION ==============

class ChannelConfigurationBase(BaseModel):
    """Base para configuração de canal"""
    channel_type: ChannelType = Field(..., description="Tipo do canal")
    channel_name: str = Field(..., min_length=1, max_length=100, description="Nome do canal")
    
    # Configurações de sincronização
    sync_enabled: bool = Field(True, description="Sincronização habilitada")
    sync_direction: SyncDirection = Field(SyncDirection.BIDIRECTIONAL, description="Direção da sincronização")
    sync_frequency: SyncFrequency = Field(SyncFrequency.EVERY_15MIN, description="Frequência de sincronização")
    
    # Configurações específicas
    sync_availability: bool = Field(True, description="Sincronizar disponibilidade")
    sync_rates: bool = Field(True, description="Sincronizar tarifas")
    sync_restrictions: bool = Field(True, description="Sincronizar restrições")
    sync_bookings: bool = Field(True, description="Sincronizar reservas")
    
    # Comissões e markup
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=1, description="Taxa de comissão")
    markup_percentage: Optional[Decimal] = Field(None, ge=0, le=100, description="Markup percentual")
    
    # Configurações adicionais
    priority_level: int = Field(1, ge=1, le=10, description="Nível de prioridade")
    is_active: bool = Field(True, description="Canal ativo")
    
    # Metadados
    channel_settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Configurações específicas do canal")


class ChannelConfigurationCreate(ChannelConfigurationBase):
    """Schema para criar configuração de canal"""
    wubook_configuration_id: int = Field(..., gt=0, description="ID da configuração WuBook")


class ChannelConfigurationUpdate(BaseModel):
    """Schema para atualizar configuração de canal"""
    channel_name: Optional[str] = Field(None, min_length=1, max_length=100)
    sync_enabled: Optional[bool] = None
    sync_direction: Optional[SyncDirection] = None
    sync_frequency: Optional[SyncFrequency] = None
    sync_availability: Optional[bool] = None
    sync_rates: Optional[bool] = None
    sync_restrictions: Optional[bool] = None
    sync_bookings: Optional[bool] = None
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    markup_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    priority_level: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None
    channel_settings: Optional[Dict[str, Any]] = None


class ChannelConfigurationResponse(ChannelConfigurationBase):
    """Schema para resposta de configuração de canal"""
    id: int
    wubook_configuration_id: int
    tenant_id: int
    
    # Status
    status: ChannelSyncStatus = Field(..., description="Status atual")
    last_sync_at: Optional[datetime] = Field(None, description="Última sincronização")
    last_error: Optional[str] = Field(None, description="Último erro")
    error_count: int = Field(0, description="Contador de erros")
    
    # Estatísticas
    total_syncs: int = Field(0, description="Total de sincronizações")
    successful_syncs: int = Field(0, description="Sincronizações bem-sucedidas")
    
    # Metadados
    created_at: datetime
    updated_at: datetime
    
    # Dados relacionados
    wubook_property_name: Optional[str] = Field(None, description="Nome da propriedade no WuBook")


# ============== SYNC OPERATIONS ==============

class SyncRequest(BaseModel):
    """Schema para requisição de sincronização"""
    configuration_id: Optional[int] = Field(None, description="ID da configuração específica")
    channel_ids: Optional[List[str]] = Field(None, description="IDs de canais específicos")
    room_ids: Optional[List[int]] = Field(None, description="IDs de quartos específicos")
    
    # Período
    date_from: Optional[date] = Field(None, description="Data inicial")
    date_to: Optional[date] = Field(None, description="Data final")
    
    # Opções
    sync_direction: SyncDirection = Field(SyncDirection.BIDIRECTIONAL, description="Direção da sincronização")
    force_full_sync: bool = Field(False, description="Forçar sincronização completa")
    sync_types: List[str] = Field(default_factory=lambda: ["availability"], description="Tipos de dados a sincronizar")
    
    # Configurações avançadas
    batch_size: int = Field(50, ge=1, le=500, description="Tamanho do lote")
    max_retries: int = Field(3, ge=0, le=10, description="Máximo de tentativas")


class SyncResult(BaseModel):
    """Schema para resultado de sincronização"""
    model_config = ConfigDict(from_attributes=True)
    
    # Identificação
    sync_id: str = Field(..., description="ID único da sincronização")
    configuration_id: Optional[int] = Field(None, description="ID da configuração")
    
    # Status
    status: str = Field(..., description="Status da sincronização")
    success: bool = Field(..., description="Se foi bem-sucedida")
    
    # Timestamps
    started_at: datetime = Field(..., description="Início da sincronização")
    completed_at: Optional[datetime] = Field(None, description="Fim da sincronização")
    duration_seconds: Optional[float] = Field(None, description="Duração em segundos")
    
    # Resultados
    total_items: int = Field(0, description="Total de itens processados")
    successful_items: int = Field(0, description="Itens processados com sucesso")
    failed_items: int = Field(0, description="Itens com falha")
    
    # Erros e conflitos
    errors: List[str] = Field(default_factory=list, description="Lista de erros")
    
    # Alterações realizadas
    changes_summary: Dict[str, int] = Field(default_factory=dict, description="Resumo das alterações")


# ============== AVAILABILITY CALENDAR ==============

class AvailabilityCalendarRequest(BaseModel):
    """Schema para requisição de calendário de disponibilidade"""
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Filtros
    room_ids: Optional[List[int]] = Field(None, description="IDs de quartos específicos")
    room_type_id: Optional[int] = Field(None, description="ID do tipo de quarto")
    property_id: Optional[int] = Field(None, description="ID da propriedade")
    
    # Opções de visualização
    include_rates: bool = Field(True, description="Incluir tarifas")
    include_restrictions: bool = Field(True, description="Incluir restrições")
    include_sync_status: bool = Field(True, description="Incluir status de sincronização")
    group_by_room_type: bool = Field(False, description="Agrupar por tipo de quarto")
    
    @field_validator('date_to')
    @classmethod
    def validate_date_range(cls, v, info):
        if 'date_from' in info.data and v <= info.data['date_from']:
            raise ValueError('date_to deve ser posterior a date_from')
        
        if 'date_from' in info.data and (v - info.data['date_from']).days > 365:
            raise ValueError('Período não pode exceder 365 dias')
        
        return v


class AvailabilityCalendarResponse(BaseModel):
    """Schema para resposta de calendário de disponibilidade"""
    model_config = ConfigDict(from_attributes=True)
    
    # Período
    date_from: date
    date_to: date
    total_days: int
    
    # Dados do calendário
    calendar_data: List[Dict[str, Any]] = Field(..., description="Dados por data")
    
    # Resumo por quarto
    rooms_summary: List[Dict[str, Any]] = Field(..., description="Resumo por quarto")
    
    # Resumo por canal
    channels_summary: List[Dict[str, Any]] = Field(..., description="Resumo por canal")
    
    # Estatísticas gerais
    statistics: Dict[str, Any] = Field(..., description="Estatísticas do período")
    
    # Status de sincronização
    sync_status: Dict[str, Any] = Field(..., description="Status geral de sincronização")


# ============== BULK OPERATIONS ==============

class BulkAvailabilityUpdate(BaseModel):
    """Schema para atualização em massa de disponibilidade"""
    room_ids: List[int] = Field(..., min_length=1, max_length=100, description="IDs dos quartos")
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Campos para atualizar
    is_available: Optional[bool] = Field(None, description="Disponibilidade")
    is_blocked: Optional[bool] = Field(None, description="Bloqueado")
    rate_override: Optional[Decimal] = Field(None, ge=0, description="Sobrescrever tarifa")
    min_stay: Optional[int] = Field(None, ge=1, le=30, description="Estadia mínima")
    max_stay: Optional[int] = Field(None, ge=1, le=365, description="Estadia máxima")
    closed_to_arrival: Optional[bool] = Field(None, description="Fechado para chegada")
    closed_to_departure: Optional[bool] = Field(None, description="Fechado para saída")
    
    # Opções
    reason: Optional[str] = Field(None, max_length=100, description="Motivo da alteração")
    sync_immediately: bool = Field(True, description="Sincronizar imediatamente")
    
    @field_validator('date_to')
    @classmethod
    def validate_date_range(cls, v, info):
        if 'date_from' in info.data and v <= info.data['date_from']:
            raise ValueError('date_to deve ser posterior a date_from')
        
        if 'date_from' in info.data and (v - info.data['date_from']).days > 366:
            raise ValueError('Período não pode exceder 366 dias')
        
        return v


class BulkOperationResult(BaseModel):
    """Schema para resultado de operação em massa"""
    operation_id: str = Field(..., description="ID da operação")
    
    # Contadores
    total_items: int = Field(..., description="Total de itens")
    successful_items: int = Field(..., description="Itens processados com sucesso")
    failed_items: int = Field(..., description="Itens com falha")
    
    # Resultados detalhados
    created_count: int = Field(0, description="Itens criados")
    updated_count: int = Field(0, description="Itens atualizados")
    skipped_count: int = Field(0, description="Itens ignorados")
    
    # Errors
    errors: List[str] = Field(default_factory=list, description="Lista de erros")
    
    # Sincronização
    sync_triggered: bool = Field(False, description="Se a sincronização foi acionada")
    sync_result: Optional[SyncResult] = Field(None, description="Resultado da sincronização")
    
    # Timestamps
    started_at: datetime = Field(..., description="Início da operação")
    completed_at: datetime = Field(..., description="Fim da operação")
    duration_seconds: float = Field(..., description="Duração em segundos")


# ============== STATISTICS AND REPORTS ==============

class ChannelPerformanceStats(BaseModel):
    """Schema para estatísticas de performance de canal"""
    channel_id: str = Field(..., description="ID do canal")
    channel_name: str = Field(..., description="Nome do canal")
    channel_type: ChannelType = Field(..., description="Tipo do canal")
    
    # Estatísticas de sincronização
    total_syncs: int = Field(0, description="Total de sincronizações")
    successful_syncs: int = Field(0, description="Sincronizações bem-sucedidas")
    failed_syncs: int = Field(0, description="Sincronizações com falha")
    success_rate: float = Field(0.0, description="Taxa de sucesso")
    
    # Disponibilidade
    total_availability_records: int = Field(0, description="Total de registros de disponibilidade")
    synchronized_records: int = Field(0, description="Registros sincronizados")
    pending_sync_records: int = Field(0, description="Registros pendentes")
    error_records: int = Field(0, description="Registros com erro")
    
    # Performance
    average_sync_duration: float = Field(0.0, description="Duração média de sincronização")
    last_sync_at: Optional[datetime] = Field(None, description="Última sincronização")
    next_sync_at: Optional[datetime] = Field(None, description="Próxima sincronização")
    
    # Comissões e receita
    commission_rate: Optional[float] = Field(None, description="Taxa de comissão")
    estimated_monthly_revenue: Optional[Decimal] = Field(None, description="Receita estimada mensal")


class SyncHealthReport(BaseModel):
    """Schema para relatório de saúde de sincronização"""
    overall_health: str = Field(..., description="Saúde geral: healthy, warning, critical")
    health_score: float = Field(..., ge=0, le=100, description="Pontuação de saúde (0-100)")
    
    # Métricas gerais
    total_configurations: int = Field(..., description="Total de configurações")
    healthy_configurations: int = Field(..., description="Configurações saudáveis")
    warning_configurations: int = Field(..., description="Configurações com aviso")
    critical_configurations: int = Field(..., description="Configurações críticas")
    
    # Sync status
    sync_rate: float = Field(..., description="Taxa de sincronização")
    error_rate: float = Field(..., description="Taxa de erro")
    pending_rate: float = Field(..., description="Taxa de pendências")
    
    # Atividade recente
    recent_activity: Dict[str, Any] = Field(..., description="Atividade das últimas 24h")
    
    # Problemas identificados
    issues: List[Dict[str, Any]] = Field(default_factory=list, description="Problemas identificados")
    
    # Recomendações
    recommendations: List[str] = Field(default_factory=list, description="Recomendações de melhoria")
    
    # Timestamp
    generated_at: datetime = Field(..., description="Timestamp de geração")
    period_analyzed: str = Field(..., description="Período analisado")


# ============== FILTERS AND PAGINATION ==============

class ChannelManagerFilters(BaseModel):
    """Schema para filtros do Channel Manager"""
    # Filtros de configuração
    configuration_id: Optional[int] = None
    tenant_id: Optional[int] = None
    channel_type: Optional[ChannelType] = None
    status: Optional[ChannelSyncStatus] = None
    is_active: Optional[bool] = None
    
    # Filtros de sincronização
    sync_enabled: Optional[bool] = None
    has_errors: Optional[bool] = None
    last_sync_after: Optional[datetime] = None
    last_sync_before: Optional[datetime] = None
    
    # Filtros de performance
    min_success_rate: Optional[float] = Field(None, ge=0, le=100)
    max_error_count: Optional[int] = Field(None, ge=0)
    
    # Busca textual
    search: Optional[str] = Field(None, max_length=100, description="Busca em nomes e descrições")


class ChannelManagerListResponse(BaseModel):
    """Schema para resposta de lista do Channel Manager"""
    items: List[ChannelConfigurationResponse] = Field(..., description="Lista de itens")
    total: int = Field(..., description="Total de itens")
    page: int = Field(..., description="Página atual")
    pages: int = Field(..., description="Total de páginas")
    per_page: int = Field(..., description="Itens por página")
    
    # Agregações
    summary: Dict[str, Any] = Field(..., description="Resumo dos dados")
    filters_applied: Dict[str, Any] = Field(..., description="Filtros aplicados")


# ============== SIMPLE MAPPING VIEWS (SEM RECURSÃO) ==============

class SimpleChannelInfo(BaseModel):
    """Informações simples de canal para evitar recursão"""
    channel_id: str
    channel_name: str
    sync_status: str
    last_sync: Optional[str] = None


class SimpleAvailabilityView(BaseModel):
    """Visão simplificada de disponibilidade sem recursão"""
    date: date
    room_id: int
    room_number: str
    room_name: Optional[str] = None
    
    # Status PMS
    is_available: bool
    is_bookable: bool
    rate: Optional[Decimal] = None
    min_stay: int = 1
    closed_to_arrival: bool = False
    closed_to_departure: bool = False
    
    # Informações de sincronização simples
    sync_status: str = "unknown"
    last_sync: Optional[str] = None
    sync_pending: bool = False
    sync_error: Optional[str] = None
    
    # Canais (informação simples)
    mapped_channels: List[str] = Field(default_factory=list)
    sync_enabled_channels: List[str] = Field(default_factory=list)


# ============== BULK EDIT INTEGRATION ==============

class BulkAvailabilityUpdateExtended(BulkAvailabilityUpdate):
    """Versão estendida do BulkAvailabilityUpdate com mais opções"""
    
    # Campos adicionais para bulk edit avançado
    rate_override: Optional[Decimal] = Field(None, ge=0, description="Preço override")
    min_stay: Optional[int] = Field(None, ge=1, le=30, description="Estadia mínima")
    max_stay: Optional[int] = Field(None, ge=1, le=30, description="Estadia máxima")
    closed_to_arrival: Optional[bool] = Field(None, description="Fechado para chegada")
    closed_to_departure: Optional[bool] = Field(None, description="Fechado para saída")
    
    # Operações matemáticas
    price_operation: Optional[str] = Field(None, description="Operação de preço: set, increase_amount, increase_percent, etc")
    price_value: Optional[Decimal] = Field(None, description="Valor para operação de preço")
    
    # Filtros adicionais
    days_of_week: Optional[List[int]] = Field(None, description="Dias da semana específicos (0-6)")
    overwrite_existing: bool = Field(True, description="Sobrescrever valores existentes")
    
    @field_validator('days_of_week')
    @classmethod
    def validate_days_of_week(cls, v):
        if v:
            for day in v:
                if day < 0 or day > 6:
                    raise ValueError("Dias da semana devem estar entre 0 (Domingo) e 6 (Sábado)")
        return v
    
    @field_validator('price_operation')
    @classmethod
    def validate_price_operation(cls, v):
        if v:
            valid_operations = ['set', 'increase_amount', 'increase_percent', 'decrease_amount', 'decrease_percent']
            if v not in valid_operations:
                raise ValueError(f"Operação deve ser uma de: {', '.join(valid_operations)}")
        return v


class BulkOperationResultExtended(BulkOperationResult):
    """Versão estendida do resultado de operação em massa"""
    
    # Breakdown detalhado por tipo de operação
    price_updates: int = Field(0, description="Atualizações de preço")
    availability_updates: int = Field(0, description="Atualizações de disponibilidade")
    restriction_updates: int = Field(0, description="Atualizações de restrições")
    
    # Estatísticas por quarto
    rooms_affected: List[Dict[str, Any]] = Field(default_factory=list, description="Quartos afetados")
    
    # Preview dos resultados (para dry-run)
    sample_changes: List[Dict[str, Any]] = Field(default_factory=list, description="Amostra das mudanças")
    
    # Task assíncrona (se aplicável)
    async_task_id: Optional[str] = Field(None, description="ID da task assíncrona")
    is_async: bool = Field(False, description="Se está sendo processado assincronamente")


class BulkEditScope(BaseModel):
    """Schema para definir escopo de bulk edit"""
    scope_type: str = Field(..., description="Tipo do escopo: property, room_type, specific_rooms")
    property_id: int = Field(..., gt=0, description="ID da propriedade")
    room_type_id: Optional[int] = Field(None, gt=0, description="ID do tipo de quarto")
    room_ids: Optional[List[int]] = Field(None, description="IDs específicos dos quartos")
    
    @field_validator('scope_type')
    @classmethod
    def validate_scope_type(cls, v):
        valid_scopes = ['property', 'room_type', 'specific_rooms']
        if v not in valid_scopes:
            raise ValueError(f"Escopo deve ser um de: {', '.join(valid_scopes)}")
        return v
    
    @model_validator(mode='after')
    def validate_scope_requirements(self):
        if self.scope_type == 'room_type' and not self.room_type_id:
            raise ValueError("room_type_id é obrigatório para escopo room_type")
        
        if self.scope_type == 'specific_rooms' and not self.room_ids:
            raise ValueError("room_ids é obrigatório para escopo specific_rooms")
        
        return self


class BulkEditPreview(BaseModel):
    """Schema para preview de bulk edit"""
    scope: BulkEditScope = Field(..., description="Escopo da operação")
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Estimativas
    estimated_rooms_affected: int = Field(0, description="Quartos que serão afetados")
    estimated_dates_affected: int = Field(0, description="Datas que serão afetadas")
    estimated_records_to_process: int = Field(0, description="Registros a serem processados")
    estimated_processing_time_seconds: float = Field(0.0, description="Tempo estimado de processamento")
    
    # Validações
    validation_errors: List[str] = Field(default_factory=list, description="Erros de validação")
    validation_warnings: List[str] = Field(default_factory=list, description="Avisos")
    
    # Amostra dos dados
    sample_affected_rooms: List[Dict[str, Any]] = Field(default_factory=list, description="Amostra dos quartos afetados")


# ============== INTEGRATION WITH EXISTING SCHEMAS ==============

class AvailabilityCalendarResponseExtended(AvailabilityCalendarResponse):
    """Versão estendida do calendário com suporte a bulk edit"""
    
    # Metadados para bulk edit
    bulk_edit_metadata: Optional[Dict[str, Any]] = Field(None, description="Metadados para bulk edit")
    
    # Estatísticas adicionais
    rooms_with_restrictions: int = Field(0, description="Quartos com restrições ativas")
    rooms_with_custom_pricing: int = Field(0, description="Quartos com preço customizado")
    average_occupancy_rate: float = Field(0.0, description="Taxa média de ocupação")


class ChannelManagerOverviewExtended(ChannelManagerOverview):
    """Versão estendida do overview com estatísticas de bulk edit"""
    
    # Estatísticas de bulk operations
    bulk_operations_last_30_days: int = Field(0, description="Operações em massa nos últimos 30 dias")
    last_bulk_operation_date: Optional[datetime] = Field(None, description="Data da última operação em massa")
    
    # Status de tasks assíncronas
    active_bulk_tasks: int = Field(0, description="Tasks de bulk edit ativas")
    failed_bulk_tasks_today: int = Field(0, description="Tasks falharam hoje")


# ============== HELPER SCHEMAS ==============

class BulkEditOperationLog(BaseModel):
    """Schema para log de operações de bulk edit"""
    operation_id: str = Field(..., description="ID da operação")
    user_id: int = Field(..., description="ID do usuário")
    user_name: Optional[str] = Field(None, description="Nome do usuário")
    
    # Detalhes da operação
    operation_type: str = Field(..., description="Tipo da operação")
    scope_summary: Dict[str, Any] = Field(..., description="Resumo do escopo")
    
    # Resultados
    items_processed: int = Field(0, description="Itens processados")
    items_successful: int = Field(0, description="Itens bem-sucedidos")
    items_failed: int = Field(0, description="Itens com falha")
    
    # Timing
    started_at: datetime = Field(..., description="Início")
    completed_at: Optional[datetime] = Field(None, description="Fim")
    duration_seconds: Optional[float] = Field(None, description="Duração")
    
    # Status
    status: str = Field(..., description="Status: completed, failed, in_progress")
    error_message: Optional[str] = Field(None, description="Mensagem de erro se houver")


class BulkEditStats(BaseModel):
    """Schema para estatísticas de bulk edit"""
    
    # Contadores gerais
    total_operations_all_time: int = Field(0, description="Total de operações")
    total_operations_last_30_days: int = Field(0, description="Operações nos últimos 30 dias")
    total_operations_today: int = Field(0, description="Operações hoje")
    
    # Por tipo de operação
    operations_by_type: Dict[str, int] = Field(default_factory=dict, description="Operações por tipo")
    
    # Performance
    average_processing_time_seconds: float = Field(0.0, description="Tempo médio de processamento")
    largest_operation_items: int = Field(0, description="Maior operação (itens processados)")
    
    # Success rate
    success_rate_percentage: float = Field(0.0, description="Taxa de sucesso (%)")
    
    # Usuários mais ativos
    top_users: List[Dict[str, Any]] = Field(default_factory=list, description="Usuários mais ativos")
    
    # Período da análise
    period_start: datetime = Field(..., description="Início do período")
    period_end: datetime = Field(..., description="Fim do período")