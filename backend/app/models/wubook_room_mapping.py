# backend/app/models/wubook_room_mapping.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from typing import Optional, Dict, Any
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class WuBookRoomMapping(BaseModel, TenantMixin):
    """
    Modelo para mapeamento entre quartos do PMS e quartos do WuBook.
    Permite vincular um quarto local com seu correspondente no WuBook.
    """
    __tablename__ = "wubook_room_mappings"
    
    # Configuração à qual pertence este mapeamento
    configuration_id = Column(Integer, ForeignKey('wubook_configurations.id'), nullable=False, index=True)
    
    # Quarto no PMS
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False, index=True)
    
    # Quarto no WuBook
    wubook_room_id = Column(String(50), nullable=False, index=True)
    wubook_room_name = Column(String(200), nullable=True)
    wubook_room_type = Column(String(100), nullable=True)
    
    # Status do mapeamento
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_syncing = Column(Boolean, default=True, nullable=False)  # Se deve sincronizar
    
    # Configurações de sincronização
    sync_availability = Column(Boolean, default=True, nullable=False)
    sync_rates = Column(Boolean, default=True, nullable=False)
    sync_restrictions = Column(Boolean, default=True, nullable=False)
    
    # Mapeamento de ocupação (quantas pessoas)
    max_occupancy = Column(Integer, nullable=True)
    standard_occupancy = Column(Integer, nullable=True)
    min_occupancy = Column(Integer, default=1, nullable=False)
    
    # Configurações de preço base (se diferente do PMS)
    base_rate_override = Column(Numeric(10, 2), nullable=True)
    rate_multiplier = Column(Numeric(5, 3), default=1.000, nullable=False)  # Multiplicador de preço
    
    # Última sincronização
    last_availability_sync = Column(String(30), nullable=True)  # ISO timestamp
    last_rate_sync = Column(String(30), nullable=True)
    last_restriction_sync = Column(String(30), nullable=True)
    last_sync_error = Column(Text, nullable=True)
    sync_error_count = Column(Integer, default=0, nullable=False)
    
    # Dados adicionais do WuBook
    wubook_data = Column(JSON, nullable=True, default=dict)
    # Armazena dados extras como amenities, fotos, descrições, etc
    
    # Mapeamento de rate plans (quais rate plans este quarto aceita)
    rate_plan_ids = Column(JSON, nullable=True, default=list)
    # Ex: [1, 2, 3] - IDs dos rate plans aplicáveis
    
    # Configurações específicas
    room_settings = Column(JSON, nullable=True, default=dict)
    # Ex: {"min_stay": 2, "closed_to_arrival": ["2024-12-24"]}
    
    # Metadados
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'configuration_id', 'room_id', 
                         name='uq_wubook_mapping_room'),
        UniqueConstraint('tenant_id', 'configuration_id', 'wubook_room_id', 
                         name='uq_wubook_mapping_wubook_room'),
    )
    
    # Relacionamentos
    configuration = relationship("WuBookConfiguration", back_populates="room_mappings")
    room_ref = relationship("Room", backref="wubook_mappings")
    
    def __repr__(self):
        return (f"<WuBookRoomMapping(id={self.id}, room_id={self.room_id}, "
                f"wubook_room_id='{self.wubook_room_id}', active={self.is_active})>")
    
    @property
    def is_ready(self) -> bool:
        """Verifica se o mapeamento está pronto para sincronização"""
        return self.is_active and self.is_syncing
    
    @property
    def has_sync_errors(self) -> bool:
        """Verifica se tem erros de sincronização"""
        return self.sync_error_count > 0 or bool(self.last_sync_error)
    
    @property
    def needs_availability_sync(self) -> bool:
        """Verifica se precisa sincronizar disponibilidade"""
        if not self.sync_availability or not self.is_ready:
            return False
        return self.last_availability_sync is None
    
    @property
    def needs_rate_sync(self) -> bool:
        """Verifica se precisa sincronizar tarifas"""
        if not self.sync_rates or not self.is_ready:
            return False
        return self.last_rate_sync is None
    
    @property
    def effective_rate_multiplier(self) -> float:
        """Retorna o multiplicador de tarifa efetivo"""
        return float(self.rate_multiplier) if self.rate_multiplier else 1.0
    
    def calculate_wubook_rate(self, base_rate: Decimal) -> Decimal:
        """Calcula a tarifa para enviar ao WuBook"""
        if self.base_rate_override:
            rate = self.base_rate_override
        else:
            rate = base_rate
        
        return rate * Decimal(str(self.effective_rate_multiplier))
    
    def update_sync_timestamp(self, sync_type: str) -> None:
        """Atualiza timestamp de sincronização"""
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat()
        
        if sync_type == "availability":
            self.last_availability_sync = timestamp
        elif sync_type == "rate":
            self.last_rate_sync = timestamp
        elif sync_type == "restriction":
            self.last_restriction_sync = timestamp
    
    def record_sync_error(self, error_message: str) -> None:
        """Registra erro de sincronização"""
        from datetime import datetime
        self.last_sync_error = f"[{datetime.utcnow().isoformat()}] {error_message}"
        self.sync_error_count += 1
    
    def clear_sync_errors(self) -> None:
        """Limpa erros de sincronização"""
        self.last_sync_error = None
        self.sync_error_count = 0
    
    def is_rate_plan_enabled(self, rate_plan_id: int) -> bool:
        """Verifica se um rate plan está habilitado para este quarto"""
        if not self.rate_plan_ids:
            return True  # Se não há restrição, aceita todos
        return rate_plan_id in self.rate_plan_ids
    
    def add_rate_plan(self, rate_plan_id: int) -> None:
        """Adiciona um rate plan ao mapeamento"""
        if not self.rate_plan_ids:
            self.rate_plan_ids = []
        if rate_plan_id not in self.rate_plan_ids:
            self.rate_plan_ids.append(rate_plan_id)
    
    def remove_rate_plan(self, rate_plan_id: int) -> None:
        """Remove um rate plan do mapeamento"""
        if self.rate_plan_ids and rate_plan_id in self.rate_plan_ids:
            self.rate_plan_ids.remove(rate_plan_id)
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Obtém uma configuração específica do quarto"""
        if not self.room_settings:
            return default
        return self.room_settings.get(key, default)
    
    def set_setting(self, key: str, value: Any) -> None:
        """Define uma configuração específica do quarto"""
        if not self.room_settings:
            self.room_settings = {}
        self.room_settings[key] = value