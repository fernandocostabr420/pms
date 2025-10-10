# backend/app/models/room.py

from sqlalchemy import Column, String, Text, Integer, Boolean, JSON, ForeignKey, Index, text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class Room(BaseModel, TenantMixin):
    """
    Modelo de Quarto - quartos específicos dentro de uma propriedade.
    Vinculado a uma propriedade e tipo de quarto.
    ✅ ATUALIZADO: Inclui relacionamentos com CASCADE DELETE para limpeza automática
    ✅ CORRIGIDO: Índice único parcial para permitir soft-delete e reuso de números
    """
    __tablename__ = "rooms"
    __table_args__ = (
        # ✅ CORRIGIDO: Índice único parcial - só impede duplicação em quartos ATIVOS
        # Permite reutilizar números de quartos excluídos (is_active = false)
        Index(
            'uq_active_room_per_property',
            'tenant_id', 'property_id', 'room_number',
            unique=True,
            postgresql_where=text('is_active = true')
        ),
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
    
    # ✅ RELACIONAMENTOS PRINCIPAIS (usando nomes que não conflitam com palavras reservadas)
    property_obj = relationship("Property", backref="rooms")
    room_type = relationship("RoomType", back_populates="rooms")
    
    # ✅ RELACIONAMENTOS COM CASCADE DELETE PARA LIMPEZA AUTOMÁTICA
    # Quando um quarto for excluído, automaticamente remove:
    
    # 1. Disponibilidades relacionadas
    availabilities = relationship(
        "RoomAvailability", 
        back_populates="room",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="dynamic"
    )
    
    # 2. Mapeamentos WuBook relacionados
    wubook_mappings = relationship(
        "WuBookRoomMapping", 
        back_populates="room_ref",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="dynamic"
    )
    
    # ✅ RELACIONAMENTOS FUTUROS (quando implementados)
    # reservations = relationship(
    #     "Reservation", 
    #     back_populates="room",
    #     cascade="all, delete-orphan",
    #     passive_deletes=True
    # )
    
    # reservation_rooms = relationship(
    #     "ReservationRoom", 
    #     back_populates="room",
    #     cascade="all, delete-orphan",
    #     passive_deletes=True
    # )
    
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
    
    # ✅ MÉTODOS PARA LIMPEZA E GERENCIAMENTO
    
    def get_active_availabilities_count(self):
        """Retorna quantidade de disponibilidades ativas"""
        return self.availabilities.filter_by(is_active=True).count()
    
    def get_active_wubook_mappings_count(self):
        """Retorna quantidade de mapeamentos WuBook ativos"""
        return self.wubook_mappings.filter_by(is_active=True).count()
    
    def has_future_availabilities(self):
        """Verifica se tem disponibilidades futuras"""
        from datetime import date
        return self.availabilities.filter(
            self.availabilities.property.mapper.class_.date >= date.today(),
            self.availabilities.property.mapper.class_.is_active == True
        ).count() > 0
    
    def has_active_wubook_mappings(self):
        """Verifica se tem mapeamentos WuBook ativos"""
        return self.wubook_mappings.filter_by(is_active=True).count() > 0
    
    def deactivate_related_data(self):
        """
        Desativa dados relacionados ao invés de deletar.
        Útil para soft delete manual sem CASCADE.
        """
        from datetime import datetime, date
        
        # Desativar disponibilidades futuras
        future_availabilities = self.availabilities.filter(
            self.availabilities.property.mapper.class_.date >= date.today(),
            self.availabilities.property.mapper.class_.is_active == True
        ).all()
        
        for availability in future_availabilities:
            availability.is_active = False
            availability.sync_pending = True
            availability.updated_at = datetime.utcnow()
        
        # Desativar mapeamentos WuBook
        active_mappings = self.wubook_mappings.filter_by(is_active=True).all()
        
        for mapping in active_mappings:
            mapping.is_active = False
            mapping.is_syncing = False
            mapping.sync_pending = True
            mapping.updated_at = datetime.utcnow()
        
        return {
            "deactivated_availabilities": len(future_availabilities),
            "deactivated_mappings": len(active_mappings)
        }
    
    @classmethod
    def cleanup_orphaned_data(cls, session, tenant_id: int):
        """
        Limpa dados órfãos de quartos excluídos.
        Método utilitário para limpeza de dados inconsistentes.
        """
        from app.models.room_availability import RoomAvailability
        from app.models.wubook_room_mapping import WuBookRoomMapping
        
        # Buscar quartos inativos
        inactive_rooms = session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.is_active == False
        ).all()
        
        cleanup_stats = {
            "inactive_rooms_found": len(inactive_rooms),
            "availabilities_cleaned": 0,
            "mappings_cleaned": 0
        }
        
        for room in inactive_rooms:
            # Limpar disponibilidades órfãs
            orphaned_availabilities = session.query(RoomAvailability).filter(
                RoomAvailability.room_id == room.id,
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.is_active == True
            ).all()
            
            for availability in orphaned_availabilities:
                availability.is_active = False
                availability.sync_pending = True
                cleanup_stats["availabilities_cleaned"] += 1
            
            # Limpar mapeamentos órfãos
            orphaned_mappings = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room.id,
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True
            ).all()
            
            for mapping in orphaned_mappings:
                mapping.is_active = False
                mapping.is_syncing = False
                mapping.sync_pending = True
                cleanup_stats["mappings_cleaned"] += 1
        
        session.commit()
        return cleanup_stats