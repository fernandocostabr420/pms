# backend/app/schemas/wubook_configuration.py

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ConnectionStatusEnum(str, Enum):
    """Enum para status de conexão"""
    PENDING = "pending"
    CONNECTED = "connected"
    ERROR = "error"
    SUSPENDED = "suspended"


class SyncDirectionEnum(str, Enum):
    """Enum para direção de sincronização"""
    INBOUND_ONLY = "inbound_only"
    OUTBOUND_ONLY = "outbound_only"
    BIDIRECTIONAL = "bidirectional"


class SyncStatusEnum(str, Enum):
    """Enum para status de sincronização"""
    SUCCESS = "success"
    PARTIAL = "partial"
    ERROR = "error"
    IN_PROGRESS = "in_progress"


class WuBookConfigurationBase(BaseModel):
    """Schema base para configuração WuBook"""
    property_id: int = Field(..., gt=0, description="ID da propriedade")
    wubook_token: str = Field(..., min_length=1, max_length=255, description="Token de acesso WuBook")
    wubook_lcode: str = Field(..., min_length=1, max_length=20, description="Código da propriedade no WuBook")
    wubook_property_name: Optional[str] = Field(None, max_length=200, description="Nome da propriedade no WuBook")
    
    # Configurações de sincronização
    sync_enabled: bool = Field(True, description="Sincronização habilitada")
    sync_interval_minutes: int = Field(15, ge=5, le=1440, description="Intervalo de sincronização em minutos")
    sync_direction: SyncDirectionEnum = Field(SyncDirectionEnum.BIDIRECTIONAL, description="Direção da sincronização")
    
    # Features
    sync_availability: bool = Field(True, description="Sincronizar disponibilidade")
    sync_rates: bool = Field(True, description="Sincronizar tarifas")
    sync_restrictions: bool = Field(True, description="Sincronizar restrições")
    sync_bookings: bool = Field(True, description="Sincronizar reservas")
    auto_confirm_bookings: bool = Field(False, description="Confirmar reservas automaticamente")
    
    # Configurações avançadas
    channel_mappings: Optional[Dict[str, int]] = Field(default_factory=dict, description="Mapeamento de canais")
    rate_multiplier: Optional[Dict[str, float]] = Field(default_factory=dict, description="Multiplicador de tarifas")
    default_restrictions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Restrições padrão")
    api_settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Configurações da API")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadados adicionais")
    
    @field_validator('wubook_token')
    @classmethod
    def validate_token(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Token WuBook é obrigatório')
        return v.strip()
    
    @field_validator('wubook_lcode')
    @classmethod
    def validate_lcode(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Código da propriedade é obrigatório')
        # Validar formato se necessário
        return v.strip()


class WuBookConfigurationCreate(WuBookConfigurationBase):
    """Schema para criar configuração WuBook"""
    pass


class WuBookConfigurationUpdate(BaseModel):
    """Schema para atualizar configuração WuBook"""
    wubook_token: Optional[str] = Field(None, min_length=1, max_length=255)
    wubook_lcode: Optional[str] = Field(None, min_length=1, max_length=20)
    wubook_property_name: Optional[str] = Field(None, max_length=200)
    
    sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = Field(None, ge=5, le=1440)
    sync_direction: Optional[SyncDirectionEnum] = None
    
    sync_availability: Optional[bool] = None
    sync_rates: Optional[bool] = None
    sync_restrictions: Optional[bool] = None
    sync_bookings: Optional[bool] = None
    auto_confirm_bookings: Optional[bool] = None
    
    channel_mappings: Optional[Dict[str, int]] = None
    rate_multiplier: Optional[Dict[str, float]] = None
    default_restrictions: Optional[Dict[str, Any]] = None
    api_settings: Optional[Dict[str, Any]] = None
    metadata_json: Optional[Dict[str, Any]] = None


class WuBookConfigurationResponse(WuBookConfigurationBase):
    """Schema para resposta de configuração WuBook"""
    id: int
    tenant_id: int
    
    # Status
    is_active: bool
    is_connected: bool
    connection_status: ConnectionStatusEnum
    
    # Timestamps de sincronização
    last_sync_at: Optional[str]
    last_sync_status: Optional[SyncStatusEnum]
    last_sync_message: Optional[str]
    last_error_at: Optional[str]
    error_count: int
    
    # Timestamps do modelo
    created_at: datetime
    updated_at: datetime
    
    # Campos computados
    is_ready: Optional[bool] = None
    needs_sync: Optional[bool] = None
    has_errors: Optional[bool] = None
    
    model_config = ConfigDict(from_attributes=True)


class WuBookTestConnection(BaseModel):
    """Schema para testar conexão com WuBook"""
    wubook_token: str = Field(..., min_length=1, description="Token de acesso")
    wubook_lcode: str = Field(..., min_length=1, description="Código da propriedade")


class WuBookTestConnectionResult(BaseModel):
    """Schema para resultado do teste de conexão"""
    success: bool
    message: str
    property_name: Optional[str] = None
    rooms_count: Optional[int] = None
    rate_plans_count: Optional[int] = None
    error_details: Optional[str] = None


class WuBookSyncRequest(BaseModel):
    """Schema para solicitar sincronização manual"""
    sync_type: str = Field(..., description="Tipo de sincronização: availability, rates, restrictions, bookings, full")
    date_from: Optional[str] = Field(None, description="Data inicial (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="Data final (YYYY-MM-DD)")
    room_ids: Optional[List[int]] = Field(None, description="IDs dos quartos para sincronizar")
    force: bool = Field(False, description="Forçar sincronização mesmo se recente")
    
    @field_validator('sync_type')
    @classmethod
    def validate_sync_type(cls, v):
        valid_types = ['availability', 'rates', 'restrictions', 'bookings', 'rooms', 'rate_plans', 'full']
        if v not in valid_types:
            raise ValueError(f'Tipo de sincronização deve ser um de: {", ".join(valid_types)}')
        return v
    
    @field_validator('date_from', 'date_to')
    @classmethod
    def validate_dates(cls, v):
        if v:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Data deve estar no formato YYYY-MM-DD')
        return v


class WuBookSyncResult(BaseModel):
    """Schema para resultado de sincronização"""
    sync_log_id: int
    status: str
    message: str
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    total_items: int
    success_items: int
    error_items: int
    changes_made: Dict[str, int]
    errors: Optional[List[str]] = None


class WuBookConfigurationStats(BaseModel):
    """Schema para estatísticas de configuração"""
    configuration_id: int
    property_name: str
    is_connected: bool
    last_sync_at: Optional[str]
    total_syncs_today: int
    total_syncs_week: int
    total_syncs_month: int
    success_rate: float
    average_sync_duration: float
    total_bookings_imported: int
    total_rooms_mapped: int
    total_rate_plans: int
    last_error: Optional[str]


class WuBookChannelMapping(BaseModel):
    """Schema para mapeamento de canal"""
    wubook_channel_id: str = Field(..., description="ID do canal no WuBook")
    wubook_channel_name: str = Field(..., description="Nome do canal no WuBook")
    sales_channel_id: Optional[int] = Field(None, description="ID do canal de vendas no PMS")
    sales_channel_name: Optional[str] = Field(None, description="Nome do canal no PMS")
    is_mapped: bool = Field(False, description="Se está mapeado")
    commission_rate: Optional[float] = Field(None, ge=0, le=1, description="Taxa de comissão")


class WuBookChannelMappingUpdate(BaseModel):
    """Schema para atualizar mapeamento de canal"""
    wubook_channel_id: str = Field(..., description="ID do canal no WuBook")
    sales_channel_id: int = Field(..., gt=0, description="ID do canal de vendas no PMS")


class WuBookConfigurationListResponse(BaseModel):
    """Schema para lista de configurações"""
    configurations: List[WuBookConfigurationResponse]
    total: int


class WuBookConfigurationFilters(BaseModel):
    """Schema para filtros de busca"""
    property_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_connected: Optional[bool] = None
    connection_status: Optional[ConnectionStatusEnum] = None
    sync_enabled: Optional[bool] = None
    has_errors: Optional[bool] = None