# backend/app/models/room.py

from sqlalchemy import Column, String, Text, Integer, Boolean, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class Room(BaseModel, TenantMixin):
    """
    Modelo de Quarto - quartos específicos dentro de uma propriedade.
    Vinculado a uma propriedade e tipo de quarto.
    """
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint('property_id', 'room_number', name='unique_room_per_property'),
    )
    
    # Identificação
    name = Column(String(100), nullable=False, index=True)  # "Standard 101"
    room_number = Column(String(20), nullable=False, index=True)  # "101"
    
    # Relacionamentos obrigatórios
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    room_type_id = Column(Integer, ForeignKey('room_types.id'), nullable=False, index=True)
    
    # Localização física
    floor = Column(Integer, nullable=True, index=True)  # Andar
    building = Column(String(50), nullable=True)  # Edifício/Bloco (para resorts)
    
    # Capacidade específica (pode diferir do room_type)
    max_occupancy = Column(Integer, nullable=True)  # Se null, usa do room_type
    
    # Configuração específica das camas (se diferir do tipo)
    bed_configuration = Column(JSON, nullable=True)
    
    # Comodidades específicas (adiciona/remove do tipo base)
    additional_amenities = Column(JSON, nullable=True)  # Comodidades extras
    removed_amenities = Column(JSON, nullable=True)     # Comodidades removidas
    
    # Status operacional
    is_operational = Column(Boolean, default=True, nullable=False, index=True)
    is_out_of_order = Column(Boolean, default=False, nullable=False)  # Fora de funcionamento
    maintenance_notes = Column(Text, nullable=True)  # Notas de manutenção
    
    # Observações
    notes = Column(Text, nullable=True)  # Observações gerais
    housekeeping_notes = Column(Text, nullable=True)  # Notas da governança
    
    # Configurações específicas
    settings = Column(JSON, nullable=True)
    
    # Relacionamentos (usando nomes que não conflitam com palavras reservadas)
    property_obj = relationship("Property", backref="rooms")
    room_type = relationship("RoomType", back_populates="rooms")
    
    # Futuros relacionamentos (reservations, etc.)
    # reservations = relationship("Reservation", back_populates="room")
    
    def __repr__(self):
        return f"<Room(id={self.id}, number='{self.room_number}', property_id={self.property_id})>"
    
    @property
    def full_name(self):
        """Nome completo do quarto"""
        return f"{self.room_type.name} {self.room_number}" if self.room_type else self.name
    
    @property
    def effective_max_occupancy(self):
        """Capacidade máxima efetiva (do quarto ou do tipo)"""
        return self.max_occupancy or (self.room_type.max_capacity if self.room_type else 2)
    
    @property
    def effective_amenities(self):
        """Lista de comodidades efetivas"""
        # Começar com as do tipo
        base_amenities = set(self.room_type.amenities_list if self.room_type else [])
        
        # Adicionar as extras específicas do quarto
        if self.additional_amenities:
            base_amenities.update(self.additional_amenities)
        
        # Remover as que foram removidas
        if self.removed_amenities:
            base_amenities.difference_update(self.removed_amenities)
        
        return sorted(list(base_amenities))
    
    @property
    def is_available_for_booking(self):
        """Verifica se quarto está disponível para reservas"""
        return (
            self.is_active and 
            self.is_operational and 
            not self.is_out_of_order and
            self.room_type and self.room_type.is_bookable
        )
    
    @property
    def status_display(self):
        """Status formatado para exibição"""
        if not self.is_active:
            return "Inativo"
        elif self.is_out_of_order:
            return "Fora de funcionamento"
        elif not self.is_operational:
            return "Não operacional"
        else:
            return "Operacional"