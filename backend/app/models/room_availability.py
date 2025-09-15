# backend/app/models/room_availability.py

from sqlalchemy import Column, Integer, Date, Boolean, Numeric, String, Text, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any, Optional, List

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
    
    # ✅ CAMPOS DE SINCRONIZAÇÃO: Channel Manager (WuBook)
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
    
    # ===== MÉTODOS DE SINCRONIZAÇÃO COM CHANNEL MANAGER =====
    
    def mark_for_sync(self) -> None:
        """Marca registro para sincronização"""
        self.sync_pending = True
        self.wubook_sync_error = None
        # Atualiza is_bookable baseado no status atual
        self.update_bookable_status()
    
    def mark_sync_success(self) -> None:
        """Marca sincronização como bem-sucedida"""
        self.sync_pending = False
        self.wubook_synced = True
        self.wubook_sync_error = None
        self.last_wubook_sync = datetime.utcnow()
    
    def mark_sync_error(self, error_message: str) -> None:
        """Marca erro na sincronização"""
        self.sync_pending = True  # Mantém pendente para tentar novamente
        self.wubook_synced = False
        self.wubook_sync_error = error_message
        self.last_wubook_sync = datetime.utcnow()
    
    def update_bookable_status(self) -> None:
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
    
    def reset_sync_status(self) -> None:
        """Reset completo do status de sincronização"""
        self.sync_pending = True
        self.wubook_synced = False
        self.wubook_sync_error = None
        self.last_wubook_sync = None
    
    # ===== CONVERSÃO PARA/DE WUBOOK =====
    
    def to_wubook_format(self, wubook_room_id: str) -> Dict[str, Any]:
        """
        Converte disponibilidade para formato WuBook - CORRIGIDO
        
        Args:
            wubook_room_id: ID do quarto no sistema WuBook
            
        Returns:
            Dict com dados formatados para API WuBook
        """
        wb_data = {
            'room_id': wubook_room_id,  # ID do quarto no WuBook (string)
            'date': self.date,  # Será convertido pelo WuBookClient
            'available': 1 if self.is_bookable else 0,  # WuBook converte para 'avail'
            'min_stay': self.min_stay or 1
        }
        
        # Campos opcionais
        if self.max_stay:
            wb_data['max_stay'] = self.max_stay
        
        # Restrições - usando nomes que o cliente converte para formato WuBook
        if self.closed_to_arrival:
            wb_data['closed_to_arrival'] = 1
        
        if self.closed_to_departure:
            wb_data['closed_to_departure'] = 1
        
        # Tarifa se disponível
        if self.rate_override:
            wb_data['rate'] = float(self.rate_override)
        
        return wb_data
    
    def update_from_wubook(self, wubook_data: Dict[str, Any]) -> None:
        """
        Atualiza disponibilidade a partir de dados WuBook - CORRIGIDO
        
        Args:
            wubook_data: Dados recebidos da API WuBook
        """
        try:
            # Atualizar disponibilidade - WuBook usa 'avail'
            wb_available = wubook_data.get('avail', 0)
            self.is_available = wb_available > 0
            
            # Atualizar restrições - WuBook usa nomes diferentes
            self.closed_to_arrival = bool(wubook_data.get('closed_arrival', 0))
            self.closed_to_departure = bool(wubook_data.get('closed_departure', 0))
            
            # Atualizar estadia
            self.min_stay = wubook_data.get('min_stay', 1)
            max_stay_value = wubook_data.get('max_stay', 0)
            if max_stay_value > 0:
                self.max_stay = max_stay_value
            else:
                self.max_stay = None
            
            # Atualizar tarifa se fornecida - WuBook pode usar 'price'
            if wubook_data.get('price'):
                try:
                    self.rate_override = Decimal(str(wubook_data['price']))
                except (ValueError, TypeError):
                    # Se não conseguir converter, manter valor atual
                    pass
            
            # Atualizar status de sincronização
            self.mark_sync_success()
            
            # Atualizar is_bookable
            self.update_bookable_status()
            
        except Exception as e:
            # Se houver erro na atualização, marcar como erro de sync
            self.mark_sync_error(f"Erro ao atualizar a partir do WuBook: {str(e)}")
    
    def get_sync_info(self) -> Dict[str, Any]:
        """Retorna informações de sincronização para debug/monitoring"""
        return {
            "sync_status": self.sync_status,
            "sync_pending": self.sync_pending,
            "wubook_synced": self.wubook_synced,
            "last_sync": self.last_wubook_sync.isoformat() if self.last_wubook_sync else None,
            "sync_error": self.wubook_sync_error,
            "needs_sync": self.needs_sync
        }
    
    # ===== MÉTODOS DE UTILIDADE =====
    
    def apply_changes(self, **kwargs) -> None:
        """
        Aplica alterações e marca para sincronização se necessário
        
        Args:
            **kwargs: Campos a serem atualizados
        """
        sync_required_fields = {
            'is_available', 'is_blocked', 'is_out_of_order', 'is_maintenance',
            'rate_override', 'min_stay', 'max_stay', 
            'closed_to_arrival', 'closed_to_departure'
        }
        
        needs_sync = False
        
        for field, value in kwargs.items():
            if hasattr(self, field):
                setattr(self, field, value)
                if field in sync_required_fields:
                    needs_sync = True
        
        # Atualizar status is_bookable
        self.update_bookable_status()
        
        # Marcar para sincronização se houve mudanças relevantes
        if needs_sync:
            self.mark_for_sync()
    
    def clone_for_date(self, new_date: date, **overrides) -> 'RoomAvailability':
        """
        Cria uma nova disponibilidade baseada nesta para outra data
        
        Args:
            new_date: Nova data
            **overrides: Campos a sobrescrever
            
        Returns:
            Nova instância de RoomAvailability
        """
        new_availability = RoomAvailability(
            tenant_id=self.tenant_id,
            room_id=self.room_id,
            date=new_date,
            is_available=self.is_available,
            is_blocked=self.is_blocked,
            is_out_of_order=self.is_out_of_order,
            is_maintenance=self.is_maintenance,
            rate_override=self.rate_override,
            min_stay=self.min_stay,
            max_stay=self.max_stay,
            closed_to_arrival=self.closed_to_arrival,
            closed_to_departure=self.closed_to_departure,
            reason=self.reason,
            notes=self.notes,
            metadata_json=self.metadata_json
        )
        
        # Aplicar overrides
        for field, value in overrides.items():
            if hasattr(new_availability, field):
                setattr(new_availability, field, value)
        
        # Nova disponibilidade sempre precisa ser sincronizada
        new_availability.mark_for_sync()
        
        return new_availability
    
    def validate_business_rules(self) -> List[str]:
        """
        Valida regras de negócio e retorna lista de erros
        
        Returns:
            Lista de mensagens de erro (vazia se válido)
        """
        errors = []
        
        # Validar estadia mínima/máxima
        if self.min_stay < 1:
            errors.append("Estadia mínima deve ser pelo menos 1 dia")
        
        if self.max_stay and self.max_stay < self.min_stay:
            errors.append("Estadia máxima não pode ser menor que a mínima")
        
        # Validar tarifa
        if self.rate_override and self.rate_override <= 0:
            errors.append("Tarifa deve ser positiva")
        
        # Validar disponibilidade vs restrições
        if not self.is_available and (self.closed_to_arrival or self.closed_to_departure):
            errors.append("Quarto indisponível não deveria ter restrições de chegada/saída")
        
        return errors
    
    def is_valid(self) -> bool:
        """Verifica se a disponibilidade está válida"""
        return len(self.validate_business_rules()) == 0
    
    def __repr__(self):
        return (
            f"<RoomAvailability(id={self.id}, room_id={self.room_id}, "
            f"date={self.date}, status='{self.status}', "
            f"sync_status='{self.sync_status}', bookable={self.is_bookable})>"
        )
    
    def __str__(self):
        return f"Room {self.room_id} on {self.date} - {self.status}"