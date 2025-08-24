# backend/app/models/room_type.py

from sqlalchemy import Column, String, Text, Integer, Numeric, JSON, Boolean
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class RoomType(BaseModel, TenantMixin):
    """
    Modelo de Tipo de Quarto - categorias como Standard, Deluxe, Suite, etc.
    Multi-tenant: cada tenant define seus próprios tipos de quarto.
    """
    __tablename__ = "room_types"
    
    # Informações básicas
    name = Column(String(100), nullable=False, index=True)  # "Standard Double"
    slug = Column(String(100), nullable=False, index=True)  # "standard-double"
    description = Column(Text, nullable=True)
    
    # Capacidade
    base_capacity = Column(Integer, default=2, nullable=False)  # Capacidade padrão
    max_capacity = Column(Integer, default=2, nullable=False)   # Capacidade máxima
    
    # Características físicas
    size_m2 = Column(Numeric(6, 2), nullable=True)  # Tamanho em metros quadrados
    bed_configuration = Column(JSON, nullable=True)  # {"single": 0, "double": 1, "queen": 0}
    
    # Comodidades padrão do tipo
    amenities = Column(JSON, nullable=True)  # ["ac", "tv", "minibar", "balcony"]
    
    # Configurações
    settings = Column(JSON, nullable=True)  # Configurações específicas
    
    # Status
    is_bookable = Column(Boolean, default=True, nullable=False)  # Se pode ser reservado
    
    # Relacionamentos
    rooms = relationship("Room", back_populates="room_type", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<RoomType(id={self.id}, name='{self.name}', tenant_id={self.tenant_id})>"
    
    @property
    def amenities_list(self):
        """Lista de comodidades"""
        return self.amenities if self.amenities else []
    
    @property
    def bed_info(self):
        """Informação formatada das camas"""
        if not self.bed_configuration:
            return f"{self.base_capacity} pessoas"
        
        beds = []
        config = self.bed_configuration
        
        if config.get("single", 0) > 0:
            beds.append(f"{config['single']} cama solteiro")
        if config.get("double", 0) > 0:
            beds.append(f"{config['double']} cama casal")
        if config.get("queen", 0) > 0:
            beds.append(f"{config['queen']} cama queen")
        if config.get("king", 0) > 0:
            beds.append(f"{config['king']} cama king")
            
        return ", ".join(beds) if beds else f"{self.base_capacity} pessoas"