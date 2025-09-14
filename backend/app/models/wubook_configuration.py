# backend/app/models/wubook_configuration.py

from sqlalchemy import Column, String, Text, Boolean, Integer, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from typing import Optional, Dict, Any
from datetime import datetime

from app.models.base import BaseModel, TenantMixin


class WuBookConfiguration(BaseModel, TenantMixin):
    """
    Modelo para configuração da integração WuBook por propriedade.
    Armazena credenciais, configurações e preferências de sincronização.
    """
    __tablename__ = "wubook_configurations"
    
    # Relacionamento com Property (evitando conflito com @property)
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    
    # Credenciais WuBook (criptografadas em produção)
    wubook_token = Column(String(255), nullable=False)
    wubook_lcode = Column(String(20), nullable=False)  # Property ID no WuBook
    wubook_property_name = Column(String(200), nullable=True)  # Nome da propriedade no WuBook
    
    # Status da integração
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_connected = Column(Boolean, default=False, nullable=False)
    connection_status = Column(String(50), default="pending", nullable=False)
    # pending, connected, error, suspended
    
    # Configurações de sincronização
    sync_enabled = Column(Boolean, default=True, nullable=False)
    sync_interval_minutes = Column(Integer, default=15, nullable=False)  # Intervalo de sync
    sync_direction = Column(String(20), default="bidirectional", nullable=False)
    # inbound_only, outbound_only, bidirectional
    
    # Controle de última sincronização
    last_sync_at = Column(String(30), nullable=True)  # ISO timestamp
    last_sync_status = Column(String(20), nullable=True)  # success, partial, error
    last_sync_message = Column(Text, nullable=True)
    last_error_at = Column(String(30), nullable=True)
    error_count = Column(Integer, default=0, nullable=False)
    
    # Configurações de features
    sync_availability = Column(Boolean, default=True, nullable=False)
    sync_rates = Column(Boolean, default=True, nullable=False)
    sync_restrictions = Column(Boolean, default=True, nullable=False)
    sync_bookings = Column(Boolean, default=True, nullable=False)
    auto_confirm_bookings = Column(Boolean, default=False, nullable=False)
    
    # Mapeamento de canais (qual canal WuBook mapeia para qual SalesChannel)
    channel_mappings = Column(JSON, nullable=True, default=dict)
    # Ex: {"1": 2, "2": 3} onde "1" é o ID do canal no WuBook e 2 é o sales_channel_id
    
    # Configurações avançadas
    rate_multiplier = Column(JSON, nullable=True, default=dict)
    # Ex: {"1": 1.1} aplica 10% de aumento no canal 1
    
    default_restrictions = Column(JSON, nullable=True, default=dict)
    # Ex: {"min_stay": 2, "max_stay": 30}
    
    api_settings = Column(JSON, nullable=True, default=dict)
    # Configurações específicas da API (timeout, retry, etc)
    
    # Metadados
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'property_id', name='uq_wubook_config_property'),
        UniqueConstraint('tenant_id', 'wubook_lcode', name='uq_wubook_config_lcode'),
    )
    
    # Relacionamentos (usando nomes diferentes para evitar conflito com @property)
    property_ref = relationship("Property", backref="wubook_config")
    room_mappings = relationship("WuBookRoomMapping", back_populates="configuration", cascade="all, delete-orphan")
    rate_plans = relationship("WuBookRatePlan", back_populates="configuration", cascade="all, delete-orphan")
    sync_logs = relationship("WuBookSyncLog", back_populates="configuration", cascade="all, delete-orphan")
    
    def __repr__(self):
        return (f"<WuBookConfiguration(id={self.id}, property_id={self.property_id}, "
                f"lcode='{self.wubook_lcode}', active={self.is_active}, "
                f"connected={self.is_connected})>")
    
    @property
    def is_ready(self) -> bool:
        """Verifica se a configuração está pronta para uso"""
        return (
            self.is_active and 
            self.is_connected and 
            self.connection_status == "connected" and
            bool(self.wubook_token) and 
            bool(self.wubook_lcode)
        )
    
    @property
    def needs_sync(self) -> bool:
        """Verifica se precisa sincronizar"""
        if not self.is_ready or not self.sync_enabled:
            return False
        
        if not self.last_sync_at:
            return True
        
        try:
            last_sync = datetime.fromisoformat(self.last_sync_at)
            elapsed_minutes = (datetime.utcnow() - last_sync).total_seconds() / 60
            return elapsed_minutes >= self.sync_interval_minutes
        except:
            return True
    
    @property
    def has_errors(self) -> bool:
        """Verifica se tem erros recentes"""
        return self.error_count > 0 or self.last_sync_status == "error"
    
    def get_channel_mapping(self, wubook_channel_id: str) -> Optional[int]:
        """Retorna o sales_channel_id mapeado para um canal WuBook"""
        if not self.channel_mappings:
            return None
        return self.channel_mappings.get(str(wubook_channel_id))
    
    def set_channel_mapping(self, wubook_channel_id: str, sales_channel_id: int) -> None:
        """Define mapeamento de canal"""
        if not self.channel_mappings:
            self.channel_mappings = {}
        self.channel_mappings[str(wubook_channel_id)] = sales_channel_id
    
    def get_rate_multiplier(self, channel_id: str) -> float:
        """Retorna multiplicador de tarifa para um canal"""
        if not self.rate_multiplier:
            return 1.0
        return self.rate_multiplier.get(str(channel_id), 1.0)
    
    def update_sync_status(self, status: str, message: str = None) -> None:
        """Atualiza status da última sincronização"""
        self.last_sync_at = datetime.utcnow().isoformat()
        self.last_sync_status = status
        self.last_sync_message = message
        
        if status == "error":
            self.error_count += 1
            self.last_error_at = datetime.utcnow().isoformat()
        elif status == "success":
            self.error_count = 0
    
    def reset_connection(self) -> None:
        """Reseta status de conexão"""
        self.is_connected = False
        self.connection_status = "pending"
        self.last_sync_at = None
        self.last_sync_status = None
        self.error_count = 0