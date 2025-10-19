# backend/app/models/wubook_sync_log.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class WuBookSyncLog(BaseModel, TenantMixin):
    """
    Modelo para registro de logs de sincronização com WuBook.
    Mantém histórico completo de todas as operações de sincronização.
    """
    __tablename__ = "wubook_sync_logs"
    
    # Configuração relacionada
    configuration_id = Column(Integer, ForeignKey('wubook_configurations.id'), nullable=False, index=True)
    
    # Tipo de sincronização
    sync_type = Column(String(50), nullable=False, index=True)
    # availability, rates, restrictions, bookings, rooms, rate_plans, full
    
    sync_direction = Column(String(20), nullable=False, index=True)
    # inbound (WuBook → PMS), outbound (PMS → WuBook), bidirectional
    
    # Status da sincronização
    status = Column(String(20), nullable=False, index=True)
    # started, in_progress, success, partial_success, error, timeout, cancelled
    
    # Timestamps
    started_at = Column(String(30), nullable=False)  # ISO timestamp
    completed_at = Column(String(30), nullable=True)
    duration_seconds = Column(Numeric(10, 3), nullable=True)
    
    # Escopo da sincronização
    date_from = Column(String(10), nullable=True)  # YYYY-MM-DD
    date_to = Column(String(10), nullable=True)
    room_ids = Column(JSON, nullable=True, default=list)  # Lista de room_ids sincronizados
    rate_plan_ids = Column(JSON, nullable=True, default=list)  # Lista de rate_plan_ids
    
    # Estatísticas da sincronização
    total_items = Column(Integer, default=0, nullable=False)
    processed_items = Column(Integer, default=0, nullable=False)
    success_items = Column(Integer, default=0, nullable=False)
    error_items = Column(Integer, default=0, nullable=False)
    skipped_items = Column(Integer, default=0, nullable=False)
    
    # Detalhes de alterações
    changes_made = Column(JSON, nullable=True, default=dict)
    # Ex: {"availability": 150, "rates": 75, "restrictions": 30}
    
    conflicts_found = Column(JSON, nullable=True, default=list)
    # Ex: [{"type": "availability", "room_id": 1, "date": "2024-01-01", "pms_value": 5, "wubook_value": 3}]
    
    # Informações de erro (se houver)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True, default=dict)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Dados da requisição/resposta
    request_data = Column(JSON, nullable=True)  # Dados enviados
    response_data = Column(JSON, nullable=True)  # Dados recebidos
    
    # Performance metrics
    api_calls_made = Column(Integer, default=0, nullable=False)
    data_transferred_kb = Column(Numeric(10, 2), nullable=True)
    
    # Auditoria
    triggered_by = Column(String(50), nullable=True)
    # manual, scheduled, webhook, cascade, auto
    
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    # Notas e observações
    notes = Column(Text, nullable=True)
    
    # Metadados adicionais
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Índices para performance
    __table_args__ = (
        Index('ix_wubook_sync_log_date', 'configuration_id', 'sync_type', 'started_at'),
        Index('ix_wubook_sync_log_status', 'configuration_id', 'status', 'started_at'),
    )
    
    # Relacionamentos
    configuration = relationship("WuBookConfiguration", back_populates="sync_logs")
    user_ref = relationship("User", backref="wubook_sync_logs")
    
    def __repr__(self):
        return (f"<WuBookSyncLog(id={self.id}, type='{self.sync_type}', "
                f"status='{self.status}', started='{self.started_at}')>")
    
    @property
    def is_success(self) -> bool:
        """Verifica se a sincronização foi bem-sucedida"""
        return self.status in ["success", "partial_success"]
    
    @property
    def is_error(self) -> bool:
        """Verifica se houve erro na sincronização"""
        return self.status in ["error", "timeout"]
    
    @property
    def is_complete(self) -> bool:
        """Verifica se a sincronização está completa"""
        return self.status not in ["started", "in_progress"]
    
    @property
    def success_rate(self) -> float:
        """Calcula taxa de sucesso da sincronização"""
        if self.total_items == 0:
            return 0.0
        return (self.success_items / self.total_items) * 100
    
    @property
    def has_conflicts(self) -> bool:
        """Verifica se foram encontrados conflitos"""
        return bool(self.conflicts_found and len(self.conflicts_found) > 0)
    
    @property
    def duration_formatted(self) -> str:
        """Retorna duração formatada"""
        if not self.duration_seconds:
            return "N/A"
        
        seconds = float(self.duration_seconds)
        if seconds < 60:
            return f"{seconds:.1f}s"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f}m"
        else:
            hours = seconds / 3600
            return f"{hours:.1f}h"
    
    def start_sync(self) -> None:
        """Marca início da sincronização"""
        self.started_at = datetime.utcnow().isoformat()
        self.status = "in_progress"
    
    def complete_sync(self, status: str = "success", error: str = None) -> None:
        """Marca fim da sincronização"""
        self.completed_at = datetime.utcnow().isoformat()
        self.status = status
        
        if error:
            self.error_message = error
        
        # Calcular duração
        if self.started_at:
            start = datetime.fromisoformat(self.started_at)
            end = datetime.fromisoformat(self.completed_at)
            self.duration_seconds = Decimal(str((end - start).total_seconds()))
    
    def add_item_result(self, success: bool = True, error: str = None) -> None:
        """Adiciona resultado de processamento de um item"""
        self.processed_items += 1
        
        if success:
            self.success_items += 1
        else:
            self.error_items += 1
            if error and not self.error_message:
                self.error_message = error
    
    def add_conflict(self, conflict_type: str, details: Dict[str, Any]) -> None:
        """Registra um conflito encontrado"""
        if not self.conflicts_found:
            self.conflicts_found = []
        
        conflict = {
            "type": conflict_type,
            "timestamp": datetime.utcnow().isoformat(),
            **details
        }
        self.conflicts_found.append(conflict)
    
    def add_change(self, change_type: str, count: int = 1) -> None:
        """Registra alterações feitas"""
        if not self.changes_made:
            self.changes_made = {}
        
        if change_type in self.changes_made:
            self.changes_made[change_type] += count
        else:
            self.changes_made[change_type] = count
    
    def increment_api_calls(self, count: int = 1) -> None:
        """Incrementa contador de chamadas API"""
        self.api_calls_made += count
    
    def set_scope(self, date_from: str = None, date_to: str = None, 
                  room_ids: list = None, rate_plan_ids: list = None) -> None:
        """Define escopo da sincronização"""
        if date_from:
            self.date_from = date_from
        if date_to:
            self.date_to = date_to
        if room_ids:
            self.room_ids = room_ids
        if rate_plan_ids:
            self.rate_plan_ids = rate_plan_ids
    
    @classmethod
    def create_log(cls, configuration_id: int, sync_type: str, 
                   sync_direction: str, triggered_by: str = "manual",
                   user_id: int = None, tenant_id: int = None) -> 'WuBookSyncLog':
        """Factory method para criar novo log"""
        log = cls(
            configuration_id=configuration_id,
            sync_type=sync_type,
            sync_direction=sync_direction,
            status="started",
            started_at=datetime.utcnow().isoformat(),
            triggered_by=triggered_by,
            user_id=user_id,
            tenant_id=tenant_id,
            total_items=0,
            processed_items=0,
            success_items=0,
            error_items=0,
            skipped_items=0,
            api_calls_made=0
        )
        return log
    
    def to_summary(self) -> Dict[str, Any]:
        """Retorna resumo do log para exibição"""
        return {
            "id": self.id,
            "sync_type": self.sync_type,
            "sync_direction": self.sync_direction,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration": self.duration_formatted,
            "total_items": self.total_items,
            "success_items": self.success_items,
            "error_items": self.error_items,
            "success_rate": f"{self.success_rate:.1f}%",
            "has_conflicts": self.has_conflicts,
            "error_message": self.error_message,
            "triggered_by": self.triggered_by
        }