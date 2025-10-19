# backend/app/models/property.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class Property(BaseModel, TenantMixin):
    """
    Modelo de Propriedade - representa hotéis, pousadas, hostels, etc.
    Multi-tenant: cada tenant pode ter múltiplas propriedades.
    """
    __tablename__ = "properties"
    
    # Informações básicas
    name = Column(String(200), nullable=False, index=True)
    slug = Column(String(100), nullable=False, index=True, unique=True)  # URL-friendly
    description = Column(Text, nullable=True)
    
    # Tipo de propriedade
    property_type = Column(String(50), nullable=False, index=True)  # hotel, pousada, hostel, apartamento
    
    # Endereço
    address = Column(String(200), nullable=False)  # ✅ Campo simplificado
    address_line1 = Column(String(200), nullable=True)  # Compatibilidade
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=False, default="Brasil")
    
    # Coordenadas geográficas (para mapas, proximidade)
    latitude = Column(Numeric(10, 8), nullable=True)   # Ex: -23.5489
    longitude = Column(Numeric(11, 8), nullable=True)  # Ex: -46.6388
    
    # Contato
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Configurações
    check_in_time = Column(String(10), default="14:00")   # Horário check-in padrão
    check_out_time = Column(String(10), default="12:00")  # Horário check-out padrão
    
    # ✅ Configurações de Estacionamento
    parking_enabled = Column(Boolean, default=False, nullable=False)  # Se estacionamento está disponível
    parking_spots_total = Column(Integer, nullable=True)  # Número total de vagas
    parking_policy = Column(String(20), default="integral", nullable=True)  # "integral" ou "flexible"
    
    # Metadados flexíveis (amenities, políticas, etc.)
    amenities = Column(JSON, nullable=True)        # ["wifi", "piscina", "cafe"]
    policies = Column(JSON, nullable=True)         # {"pets": true, "smoking": false}
    settings = Column(JSON, nullable=True)         # Configurações específicas
    
    # Status operacional
    is_operational = Column(Boolean, default=True, nullable=False)  # Propriedade em funcionamento
    
    # ============== RELACIONAMENTOS ==============
    
    # ✅ NOVO: Relacionamento com BookingEngineConfig
    booking_engine_config = relationship(
        "BookingEngineConfig",
        back_populates="property_obj",
        uselist=False,
        cascade="all, delete-orphan"
    )
    
    # Outros relacionamentos
    # rooms = relationship("Room", back_populates="property_obj")  # Removido - Room usa backref
    reservations = relationship("Reservation", back_populates="property_obj")
    
    # ============== MÉTODOS ==============
    
    def __repr__(self):
        return f"<Property(id={self.id}, name='{self.name}', type='{self.property_type}')>"
    
    @property
    def full_address(self):
        """Endereço completo formatado"""
        # Usar campo 'address' se disponível, senão construir
        if hasattr(self, 'address') and self.address:
            return self.address
        
        # Fallback para campos separados
        address = self.address_line1 or ""
        if self.address_line2:
            address += f", {self.address_line2}"
        address += f", {self.city}, {self.state}"
        if self.postal_code:
            address += f" - {self.postal_code}"
        return address
    
    @property
    def amenities_list(self):
        """Lista de amenities (comodidades)"""
        return self.amenities if self.amenities else []
    
    @property  
    def is_available_for_booking(self):
        """Verifica se propriedade está disponível para reservas"""
        return self.is_active and self.is_operational
    
    # ✅ Propriedades para Estacionamento
    @property
    def has_parking(self):
        """Verifica se a propriedade possui estacionamento configurado"""
        return self.parking_enabled and self.parking_spots_total and self.parking_spots_total > 0
    
    @property
    def parking_policy_display(self):
        """Política de estacionamento formatada para exibição"""
        if not self.has_parking:
            return "Indisponível"
        
        policy_map = {
            'integral': 'Política Integral - vagas devem estar disponíveis para toda a estadia',
            'flexible': 'Política Flexível - permite reservar mesmo sem vagas em todos os dias'
        }
        return policy_map.get(self.parking_policy, 'Não definida')
    
    def validate_parking_policy(self):
        """Valida se a política de estacionamento está correta"""
        if self.parking_enabled and not self.parking_policy:
            self.parking_policy = "integral"  # Padrão
        
        if self.parking_policy not in ["integral", "flexible"]:
            self.parking_policy = "integral"  # Fallback seguro
    
    # ✅ NOVOS MÉTODOS PARA BOOKING ENGINE
    
    @property
    def has_booking_engine(self):
        """Verifica se tem motor de reservas configurado"""
        return self.booking_engine_config is not None and self.booking_engine_config.is_active
    
    @property
    def booking_url(self):
        """Retorna URL do motor de reservas (se configurado)"""
        if not self.has_booking_engine:
            return None
        return self.booking_engine_config.booking_url
    
    def get_public_info(self) -> dict:
        """
        Retorna informações públicas da propriedade (seguras para expor).
        Usado pela API pública do booking engine.
        """
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "property_type": self.property_type,
            "address": {
                "full": self.full_address,
                "city": self.city,
                "state": self.state,
                "country": self.country,
                "postal_code": self.postal_code
            },
            "contact": {
                "phone": self.phone,
                "email": self.email,
                "website": self.website
            },
            "amenities": self.amenities_list,
            "check_in_time": self.check_in_time,
            "check_out_time": self.check_out_time,
            "has_parking": self.has_parking,
            "coordinates": {
                "latitude": float(self.latitude) if self.latitude else None,
                "longitude": float(self.longitude) if self.longitude else None
            } if self.latitude and self.longitude else None
        }