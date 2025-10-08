# backend/app/schemas/manual_sync.py

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class SyncStatusEnum(str, Enum):
    """Status da sincronização"""
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    ERROR = "error"
    CANCELLED = "cancelled"


class SyncTypeEnum(str, Enum):
    """Tipos de sincronização"""
    MANUAL = "manual"
    BULK_EDIT = "bulk_edit"
    SCHEDULED = "scheduled"
    AUTOMATIC = "automatic"


class ManualSyncRequest(BaseModel):
    """Requisição para sincronização manual"""
    property_id: Optional[int] = Field(
        None, 
        gt=0, 
        description="ID da propriedade específica (opcional - se não informado, sincroniza todas)"
    )
    force_all: bool = Field(
        False, 
        description="Forçar sincronização de todos os registros (não apenas pendentes)"
    )
    batch_size: int = Field(
        100, 
        ge=10, 
        le=500, 
        description="Tamanho do batch para processamento (10-500)"
    )
    async_processing: bool = Field(
        False, 
        description="Processar de forma assíncrona (recomendado para grandes volumes)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "property_id": None,
                "force_all": False,
                "batch_size": 100,
                "async_processing": False
            }
        }


class ManualSyncResult(BaseModel):
    """Resultado da sincronização manual"""
    sync_id: str = Field(..., description="ID único da sincronização")
    status: SyncStatusEnum = Field(..., description="Status da sincronização")
    message: str = Field(..., description="Mensagem descritiva do resultado")
    
    # Estatísticas de processamento
    total_pending: int = Field(..., ge=0, description="Total de registros encontrados")
    processed: int = Field(..., ge=0, description="Registros processados")
    successful: int = Field(..., ge=0, description="Registros sincronizados com sucesso")
    failed: int = Field(..., ge=0, description="Registros que falharam")
    success_rate: float = Field(..., ge=0, le=100, description="Taxa de sucesso (percentual)")
    
    # Detalhes de erros
    errors: List[str] = Field(default_factory=list, description="Lista de erros encontrados")
    error_count: int = Field(..., ge=0, description="Número total de erros")
    
    # Timestamps
    started_at: datetime = Field(..., description="Início da sincronização")
    completed_at: datetime = Field(..., description="Fim da sincronização")
    duration_seconds: float = Field(..., ge=0, description="Duração em segundos")
    
    # Informações adicionais
    configurations_processed: Optional[int] = Field(None, description="Configurações WuBook processadas")
    force_all_used: bool = Field(False, description="Se foi usado force_all")
    
    @validator('success_rate')
    def validate_success_rate(cls, v):
        return round(v, 2)
    
    @validator('duration_seconds')
    def validate_duration(cls, v):
        return round(v, 2)
    
    class Config:
        json_schema_extra = {
            "example": {
                "sync_id": "manual_20241008_143022_123",
                "status": "success",
                "message": "Sincronização concluída com sucesso",
                "total_pending": 150,
                "processed": 150,
                "successful": 145,
                "failed": 5,
                "success_rate": 96.67,
                "errors": ["Quarto 101: Erro de conexão", "Quarto 205: Rate limit exceeded"],
                "error_count": 2,
                "started_at": "2024-10-08T14:30:22.123456",
                "completed_at": "2024-10-08T14:32:15.654321",
                "duration_seconds": 113.53,
                "configurations_processed": 2,
                "force_all_used": False
            }
        }


class SyncStatusResponse(BaseModel):
    """Status atual da sincronização"""
    is_running: bool = Field(..., description="Se sincronização está em andamento")
    current_sync_id: Optional[str] = Field(None, description="ID da sincronização atual (se em andamento)")
    
    # Última sincronização
    last_sync_at: Optional[datetime] = Field(None, description="Data/hora da última sincronização")
    last_sync_status: Optional[SyncStatusEnum] = Field(None, description="Status da última sincronização")
    
    # Situação atual
    pending_count: int = Field(..., ge=0, description="Registros pendentes de sincronização")
    has_pending: bool = Field(..., description="Se existem registros pendentes")
    
    # Configuração
    active_configurations: int = Field(..., ge=0, description="Configurações WuBook ativas")
    sync_available: bool = Field(..., description="Se sincronização está disponível")
    
    # Timestamp
    checked_at: datetime = Field(..., description="Momento da verificação")
    
    # Erro (se houver)
    error: Optional[str] = Field(None, description="Erro na verificação do status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_running": False,
                "current_sync_id": None,
                "last_sync_at": "2024-10-08T14:32:15.654321",
                "last_sync_status": "success",
                "pending_count": 25,
                "has_pending": True,
                "active_configurations": 1,
                "sync_available": True,
                "checked_at": "2024-10-08T15:45:30.123456",
                "error": None
            }
        }


class PendingCountResponse(BaseModel):
    """Contagem detalhada de registros pendentes"""
    total_pending: int = Field(..., ge=0, description="Total de registros pendentes")
    
    # Agrupamentos
    by_property: Dict[str, int] = Field(
        default_factory=dict, 
        description="Contagem por propriedade (nome: quantidade)"
    )
    by_date_range: Dict[str, int] = Field(
        default_factory=dict, 
        description="Contagem por período futuro"
    )
    by_sync_type: Dict[str, int] = Field(
        default_factory=dict, 
        description="Contagem por tipo de alteração"
    )
    
    # Informações adicionais
    oldest_pending: Optional[datetime] = Field(None, description="Registro mais antigo pendente")
    has_pending: bool = Field(..., description="Se existem registros pendentes")
    last_check: datetime = Field(..., description="Momento da última verificação")
    
    # Erro (se houver)
    error: Optional[str] = Field(None, description="Erro na contagem")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_pending": 85,
                "by_property": {
                    "Pousada Bicho Preguiça (ID: 4)": 85
                },
                "by_date_range": {
                    "próximos_7_dias": 25,
                    "próximos_30_dias": 65,
                    "próximos_90_dias": 85
                },
                "by_sync_type": {
                    "availability_changes": 40,
                    "price_changes": 25,
                    "restriction_changes": 20
                },
                "oldest_pending": "2024-10-08T10:15:30.123456",
                "has_pending": True,
                "last_check": "2024-10-08T15:45:30.123456",
                "error": None
            }
        }


class SyncProgressResponse(BaseModel):
    """Progresso de sincronização assíncrona"""
    sync_id: str = Field(..., description="ID da sincronização")
    status: SyncStatusEnum = Field(..., description="Status atual")
    progress_percentage: float = Field(..., ge=0, le=100, description="Progresso em percentual")
    
    # Estatísticas atuais
    current_step: str = Field(..., description="Passo atual da sincronização")
    items_processed: int = Field(..., ge=0, description="Itens já processados")
    items_total: int = Field(..., ge=0, description="Total de itens")
    items_successful: int = Field(..., ge=0, description="Itens sincronizados com sucesso")
    items_failed: int = Field(..., ge=0, description="Itens que falharam")
    
    # Tempo
    started_at: datetime = Field(..., description="Início da sincronização")
    estimated_completion: Optional[datetime] = Field(None, description="Estimativa de conclusão")
    
    # Erros recentes
    recent_errors: List[str] = Field(default_factory=list, description="Últimos erros encontrados")
    
    @validator('progress_percentage')
    def validate_progress(cls, v):
        return round(v, 2)
    
    class Config:
        json_schema_extra = {
            "example": {
                "sync_id": "manual_20241008_143022_123",
                "status": "running",
                "progress_percentage": 65.5,
                "current_step": "Processando registros - Batch 3/5",
                "items_processed": 131,
                "items_total": 200,
                "items_successful": 125,
                "items_failed": 6,
                "started_at": "2024-10-08T14:30:22.123456",
                "estimated_completion": "2024-10-08T14:35:45.000000",
                "recent_errors": ["Quarto 301: Timeout", "Quarto 405: Rate limit"]
            }
        }


class SyncConfigurationStatus(BaseModel):
    """Status de configurações de sincronização"""
    configuration_id: int = Field(..., description="ID da configuração WuBook")
    property_name: str = Field(..., description="Nome da propriedade")
    
    # Status da configuração
    is_active: bool = Field(..., description="Se a configuração está ativa")
    is_connected: bool = Field(..., description="Se está conectada ao WuBook")
    connection_status: str = Field(..., description="Status da conexão")
    
    # Última sincronização
    last_sync_at: Optional[datetime] = Field(None, description="Última sincronização")
    last_sync_status: Optional[str] = Field(None, description="Status da última sincronização")
    
    # Estatísticas
    pending_count: int = Field(..., ge=0, description="Registros pendentes desta configuração")
    room_mappings_count: int = Field(..., ge=0, description="Quartos mapeados")
    
    # Saúde
    health_score: float = Field(..., ge=0, le=100, description="Score de saúde (0-100)")
    issues: List[str] = Field(default_factory=list, description="Problemas identificados")
    
    class Config:
        json_schema_extra = {
            "example": {
                "configuration_id": 1,
                "property_name": "Pousada Bicho Preguiça",
                "is_active": True,
                "is_connected": True,
                "connection_status": "connected",
                "last_sync_at": "2024-10-08T14:32:15.654321",
                "last_sync_status": "success",
                "pending_count": 25,
                "room_mappings_count": 9,
                "health_score": 95.5,
                "issues": []
            }
        }


class SyncHealthReport(BaseModel):
    """Relatório de saúde geral da sincronização"""
    overall_status: str = Field(..., description="Status geral (healthy/warning/critical)")
    total_configurations: int = Field(..., ge=0, description="Total de configurações")
    active_configurations: int = Field(..., ge=0, description="Configurações ativas")
    connected_configurations: int = Field(..., ge=0, description="Configurações conectadas")
    
    # Estatísticas gerais
    total_pending: int = Field(..., ge=0, description="Total de registros pendentes")
    total_errors_24h: int = Field(..., ge=0, description="Erros nas últimas 24h")
    average_sync_duration: float = Field(..., ge=0, description="Duração média de sincronização")
    success_rate_24h: float = Field(..., ge=0, le=100, description="Taxa de sucesso nas últimas 24h")
    
    # Detalhes por configuração
    configurations: List[SyncConfigurationStatus] = Field(
        default_factory=list, 
        description="Status de cada configuração"
    )
    
    # Alertas
    alerts: List[str] = Field(default_factory=list, description="Alertas do sistema")
    recommendations: List[str] = Field(default_factory=list, description="Recomendações")
    
    # Timestamp
    generated_at: datetime = Field(..., description="Momento da geração do relatório")
    
    class Config:
        json_schema_extra = {
            "example": {
                "overall_status": "healthy",
                "total_configurations": 2,
                "active_configurations": 2,
                "connected_configurations": 1,
                "total_pending": 45,
                "total_errors_24h": 3,
                "average_sync_duration": 85.6,
                "success_rate_24h": 97.8,
                "configurations": [],
                "alerts": [],
                "recommendations": ["Execute sincronização manual para reduzir pendências"],
                "generated_at": "2024-10-08T15:45:30.123456"
            }
        }