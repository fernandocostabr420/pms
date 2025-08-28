# backend/app/models/room_availability.py

from sqlalchemy import Column, Integer, Date, Boolean, Numeric, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import date
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class RoomAvailability(BaseModel, TenantMixin):
    """
    Modelo de Disponibilidade de Quarto - controla disponibilidade diária de cada quarto.
    Permite definir status de disponibilidade, preços específicos e restrições por data.
    Multi-tenant: cada tenant mantém suas próprias disponibilidades.
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
    def is_bookable(self) -> bool:
        """Retorna se o quarto pode ser reservado nesta data"""
        return (
            self.is_available and 
            not self.is_blocked and 
            not self.is_out_of_order and 
            not self.is_maintenance and 
            not self.is_reserved
        )
    
    def __repr__(self):
        return f"<RoomAvailability(room_id={self.room_id}, date={self.date}, status={self.status})>"