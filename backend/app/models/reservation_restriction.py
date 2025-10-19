# backend/app/models/reservation_restriction.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Date, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import date, datetime
from typing import Dict, Any, Optional, List
from enum import Enum

from app.models.base import BaseModel, TenantMixin


class RestrictionType(str, Enum):
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


class ReservationRestriction(BaseModel, TenantMixin):
    """
    Modelo de Restrições de Reserva - controla restrições de estadia e vendas.
    Sistema hierárquico: Property > RoomType > Room (mais específico sobrescreve).
    Permite definir restrições por período e aplicá-las em massa.
    Multi-tenant: cada tenant mantém suas próprias restrições.
    
    ✅ COMPLETO: Sistema robusto de restrições para Channel Manager
    """
    __tablename__ = "reservation_restrictions"
    
    # ============== HIERARQUIA DE APLICAÇÃO ==============
    
    # Sempre obrigatório - define a propriedade
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    
    # Opcional - se NULL, aplica a todos os tipos de quarto da propriedade
    room_type_id = Column(Integer, ForeignKey('room_types.id'), nullable=True, index=True)
    
    # Opcional - se NULL, aplica a todos os quartos (do tipo ou da propriedade)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=True, index=True)
    
    # ============== PERÍODO DE VIGÊNCIA ==============
    
    date_from = Column(Date, nullable=False, index=True)
    date_to = Column(Date, nullable=False, index=True)
    
    # Dias da semana aplicáveis (JSON array com números 0-6, onde 0=segunda)
    # Se NULL, aplica a todos os dias da semana
    # Ex: [0, 1, 2, 3, 4] para apenas dias úteis
    days_of_week = Column(JSON, nullable=True, default=None)
    
    # ============== TIPO E VALOR DA RESTRIÇÃO ==============
    
    restriction_type = Column(String(30), nullable=False, index=True)
    # min_stay, max_stay, closed_to_arrival, closed_to_departure, stop_sell, etc.
    
    # Valor da restrição (usado para min_stay, max_stay, min_advance_booking, etc.)
    restriction_value = Column(Integer, nullable=True)
    
    # Para restrições booleanas (CTA, CTD, Stop-Sell)
    is_restricted = Column(Boolean, default=True, nullable=False)
    
    # ============== CONFIGURAÇÕES ADICIONAIS ==============
    
    # Nome/descrição da restrição
    name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    
    # Status da restrição
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Prioridade (para resolução de conflitos - maior número = maior prioridade)
    priority = Column(Integer, default=1, nullable=False, index=True)
    
    # ============== ORIGEM E SINCRONIZAÇÃO ==============
    
    # Origem da restrição
    source = Column(String(20), default="manual", nullable=False, index=True)
    # manual, channel_manager, yield_management, bulk_import
    
    # Para restrições vindas de Channel Manager
    channel_manager_id = Column(String(50), nullable=True, index=True)
    channel_name = Column(String(100), nullable=True)
    
    # Sincronização pendente com canais externos
    sync_pending = Column(Boolean, default=False, nullable=False, index=True)
    last_sync_at = Column(String(30), nullable=True)  # ISO timestamp
    sync_error = Column(Text, nullable=True)
    
    # ============== METADADOS ==============
    
    # Razão/motivo da restrição
    reason = Column(String(200), nullable=True)
    
    # Dados adicionais em JSON
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Configurações específicas do Channel Manager
    channel_settings = Column(JSON, nullable=True, default=dict)
    
    # ============== CONSTRAINTS E ÍNDICES ==============
    
    __table_args__ = (
        # Prevenir duplicatas na mesma hierarquia, período e tipo
        UniqueConstraint(
            'tenant_id', 'property_id', 'room_type_id', 'room_id', 
            'date_from', 'date_to', 'restriction_type',
            name='uq_restriction_scope_period_type'
        ),
        
        # Índices compostos para performance
        Index('idx_restrictions_property_dates', 'property_id', 'date_from', 'date_to'),
        Index('idx_restrictions_room_type_dates', 'room_type_id', 'date_from', 'date_to'),
        Index('idx_restrictions_room_dates', 'room_id', 'date_from', 'date_to'),
        Index('idx_restrictions_type_active', 'restriction_type', 'is_active'),
        Index('idx_restrictions_sync_pending', 'sync_pending', 'last_sync_at'),
        
        # Índice para consultas por período
        Index('idx_restrictions_date_range', 'date_from', 'date_to', 'is_active'),
    )
    
    # ============== RELACIONAMENTOS ==============
    
    property_obj = relationship("Property", backref="reservation_restrictions")
    room_type = relationship("RoomType", backref="reservation_restrictions")
    room = relationship("Room", backref="reservation_restrictions")
    
    # ============== MÉTODOS DE INSTÂNCIA ==============
    
    @property
    def scope_level(self) -> str:
        """Retorna o nível de aplicação da restrição"""
        if self.room_id:
            return "room"
        elif self.room_type_id:
            return "room_type"
        else:
            return "property"
    
    @property
    def scope_description(self) -> str:
        """Descrição legível do escopo"""
        if self.room_id:
            return f"Quarto específico (ID: {self.room_id})"
        elif self.room_type_id:
            return f"Tipo de quarto (ID: {self.room_type_id})"
        else:
            return f"Toda a propriedade (ID: {self.property_id})"
    
    @property
    def restriction_description(self) -> str:
        """Descrição legível da restrição"""
        if self.restriction_type == RestrictionType.MIN_STAY:
            return f"Estadia mínima: {self.restriction_value} noites"
        elif self.restriction_type == RestrictionType.MAX_STAY:
            return f"Estadia máxima: {self.restriction_value} noites"
        elif self.restriction_type == RestrictionType.CLOSED_TO_ARRIVAL:
            return "Fechado para chegada"
        elif self.restriction_type == RestrictionType.CLOSED_TO_DEPARTURE:
            return "Fechado para saída"
        elif self.restriction_type == RestrictionType.STOP_SELL:
            return "Vendas bloqueadas"
        elif self.restriction_type == RestrictionType.MIN_ADVANCE_BOOKING:
            return f"Antecedência mínima: {self.restriction_value} dias"
        elif self.restriction_type == RestrictionType.MAX_ADVANCE_BOOKING:
            return f"Antecedência máxima: {self.restriction_value} dias"
        else:
            return f"Restrição: {self.restriction_type}"
    
    def applies_to_date(self, check_date: date) -> bool:
        """Verifica se a restrição se aplica a uma data específica"""
        # Verificar se está no período
        if not (self.date_from <= check_date <= self.date_to):
            return False
        
        # Verificar dia da semana (se especificado)
        if self.days_of_week:
            # 0=segunda, 1=terça, ..., 6=domingo
            weekday = check_date.weekday()
            if weekday not in self.days_of_week:
                return False
        
        return self.is_active
    
    def applies_to_room(self, room_id: int, room_type_id: int, property_id: int) -> bool:
        """Verifica se a restrição se aplica a um quarto específico"""
        # Verificar se é a mesma propriedade
        if self.property_id != property_id:
            return False
        
        # Restrição específica de quarto
        if self.room_id:
            return self.room_id == room_id
        
        # Restrição de tipo de quarto
        if self.room_type_id:
            return self.room_type_id == room_type_id
        
        # Restrição de propriedade (aplica a todos)
        return True
    
    def __repr__(self):
        return f"<RestrictionRestriction(id={self.id}, type={self.restriction_type}, scope={self.scope_level}, period={self.date_from}-{self.date_to})>"