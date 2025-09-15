# backend/app/models/room_availability.py

from sqlalchemy import Column, Integer, Date, Boolean, Numeric, String, Text, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from datetime import date, datetime
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class RoomAvailability(BaseModel, TenantMixin):
    """
    Modelo de Disponibilidade de Quarto - controla disponibilidade diária de cada quarto.
    Permite definir status de disponibilidade, preços específicos e restrições por data.
    Multi-tenant: cada tenant mantém suas próprias disponibilidades.
    
    ✅ ATUALIZADO: Inclui campos para sincronização com Channel Manager (WuBook)
    """
    __tablename__ = "room_availability"
    __table_args__ = (
        UniqueConstraint('room_id', 'date', name='unique_room_availability_per_date'),
    )
    
    # Relacionamentos obrigatórios
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    
    # Status de disponibilidade
    is_available = Column(Boolean, default=True, nullable=False, index=True)
    is_blocked = Column(Boolean, default=False, nullable=False)  # Bloqueado manualmente
    is_out_of_order = Column(Boolean, default=False, nullable=False)  # Fora de funcionamento
    is_maintenance = Column(Boolean, default=False, nullable=False)  # Em manutenção
    
    # Preço específico para esta data (sobrescreve rate plan)
    rate_override = Column(Numeric(10, 2), nullable=True)  # Preço específico
    min_stay = Column(Integer, default=1, nullable=False)  # Estadia mínima
    max_stay = Column(Integer, nullable=True)  # Estadia máxima
    
    # Restrições de check-in/check-out
    closed_to_arrival = Column(Boolean, default=False, nullable=False)  # Fechado para chegada
    closed_to_departure = Column(Boolean, default=False, nullable=False)  # Fechado para saída
    
    # Status de reserva
    is_reserved = Column(Boolean, default=False, nullable=False, index=True)  # Já reservado
    reservation_id = Column(Integer, ForeignKey('reservations.id'), nullable=True, index=True)
    
    # ✅ NOVOS CAMPOS: Sincronização com Channel Manager (WuBook)
    sync_pending = Column(Boolean, default=False, nullable=False, index=True)  # Pendente sincronização
    wubook_synced = Column(Boolean, default=False, nullable=False, index=True)  # Sincronizado com WuBook
    wubook_sync_error = Column(Text, nullable=True)  # Erro na sincronização
    last_wubook_sync = Column(DateTime, nullable=True, index=True)  # Última sincronização
    
    # Campo calculado para indicar se está disponível para reserva
    is_bookable = Column(Boolean, default=True, nullable=False, index=True)
    
    # Informações adicionais
    reason = Column(String(100), nullable=True)  # Motivo do bloqueio/indisponibilidade
    notes = Column(Text, nullable=True)  # Observações gerais
    
    # Metadados flexíveis
    metadata_json = Column(String(1000), nullable=True)  # JSON para dados extras
    
    # Relacionamentos
    room = relationship("Room", backref="availabilities")
    reservation = relationship("Reservation", backref="room_availabilities")
    
    @property
    def status(self) -> str:
        """Retorna status consolidado da disponibilidade"""
        if not self.is_available:
            return "unavailable"
        elif self.is_blocked:
            return "blocked"
        elif self.is_out_of_order:
            return "out_of_order"
        elif self.is_maintenance:
            return "maintenance"
        elif self.is_reserved:
            return "reserved"
        elif self.closed_to_arrival and self.closed_to_departure:
            return "closed"
        elif self.closed_to_arrival:
            return "closed_to_arrival"
        elif self.closed_to_departure:
            return "closed_to_departure"
        else:
            return "available"
    
    @property
    def can_be_booked(self) -> bool:
        """Retorna se o quarto pode ser reservado nesta data"""
        return (
            self.is_available and 
            not self.is_blocked and 
            not self.is_out_of_order and 
            not self.is_maintenance and 
            not self.is_reserved
        )
    
    # ✅ NOVOS MÉTODOS: Sincronização Channel Manager
    
    def mark_for_sync(self):
        """Marca registro para sincronização"""
        self.sync_pending = True
        self.wubook_sync_error = None
        # Atualiza is_bookable baseado no status atual
        self.update_bookable_status()
    
    def mark_sync_success(self):
        """Marca sincronização como bem-sucedida"""
        self.sync_pending = False
        self.wubook_synced = True
        self.wubook_sync_error = None
        self.last_wubook_sync = datetime.utcnow()
    
    def mark_sync_error(self, error_message: str):
        """Marca erro na sincronização"""
        self.sync_pending = True  # Mantém pendente para tentar novamente
        self.wubook_synced = False
        self.wubook_sync_error = error_message
        self.last_wubook_sync = datetime.utcnow()
    
    def update_bookable_status(self):
        """Atualiza status is_bookable baseado nas condições"""
        self.is_bookable = self.can_be_booked
    
    @property
    def sync_status(self) -> str:
        """Retorna status de sincronização legível"""
        if self.wubook_sync_error:
            return "error"
        elif self.sync_pending:
            return "pending"
        elif self.wubook_synced:
            return "synced"
        else:
            return "not_synced"
    
    @property
    def needs_sync(self) -> bool:
        """Verifica se precisa ser sincronizado"""
        return self.sync_pending or not self.wubook_synced
    
    def reset_sync_status(self):
        """Reset completo do status de sincronização"""
        self.sync_pending = True
        self.wubook_synced = False
        self.wubook_sync_error = None
        self.last_wubook_sync = None
    
    def to_wubook_format(self, wubook_room_id: str) -> dict:
        """Converte disponibilidade para formato WuBook - CORRIGIDO"""
        wb_data = {
            'room_id': wubook_room_id,  # ID do quarto no WuBook (string)
            'date': self.date,  # Será convertido pelo WuBookClient
            'available': 1 if self.is_bookable else 0,  # Cliente converte para 'avail'
            'min_stay': self.min_stay or 1
        }
        
        # Campos opcionais
        if self.max_stay:
            wb_data['max_stay'] = self.max_stay
        
        # Restrições - usando nomes que o cliente vai converter
        if self.closed_to_arrival:
            wb_data['closed_to_arrival'] = 1
        
        if self.closed_to_departure:
            wb_data['closed_to_departure'] = 1
        
        # Tarifa se disponível
        if self.rate_override:
            wb_data['rate'] = float(self.rate_override)
        
        return wb_data
    
    def update_from_wubook(self, wubook_data: dict):
        """Atualiza disponibilidade a partir de dados WuBook - CORRIGIDO"""
        # Atualizar disponibilidade - WuBook usa 'avail'
        wb_available = wubook_data.get('avail', 0)
        self.is_available = wb_available > 0
        
        # Atualizar restrições - WuBook usa nomes diferentes
        self.closed_to_arrival = bool(wubook_data.get('closed_arrival', 0))
        self.closed_to_departure = bool(wubook_data.get('closed_departure', 0))
        
        # Atualizar estadia
        self.min_stay = wubook_data.get('min_stay', 1)
        if wubook_data.get('max_stay', 0) > 0:
            self.max_stay = wubook_data.get('max_stay')
        
        # Atualizar tarifa se fornecida - WuBook pode usar 'price'
        if wubook_data.get('price'):
            self.rate_override = Decimal(str(wubook_data['price']))
        
        # Atualizar status de sincronização
        self.mark_sync_success()
        
        # Atualizar is_bookable
        self.update_bookable_status()
    
    def __repr__(self):
        return (
            f"<RoomAvailability(id={self.id}, room_id={self.room_id}, "
            f"date={self.date}, status='{self.status}', "
            f"sync_status='{self.sync_status}')>"
        )