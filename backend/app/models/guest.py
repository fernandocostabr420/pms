# backend/app/models/guest.py

from sqlalchemy import Column, String, Date, JSON, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class Guest(BaseModel, TenantMixin):
    """
    Modelo de Hóspede - dados dos clientes que fazem reservas.
    Multi-tenant: cada tenant mantém seus próprios hóspedes.
    """
    __tablename__ = "guests"
    
    # Dados pessoais básicos
    first_name = Column(String(100), nullable=False, index=True)
    last_name = Column(String(100), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    
    # Documento de identificação
    document_type = Column(String(20), nullable=True)  # cpf, passport, rg
    document_number = Column(String(50), nullable=True, index=True)
    
    # Dados pessoais complementares
    date_of_birth = Column(Date, nullable=True)
    nationality = Column(String(100), nullable=True, default="Brasil")
    
    # Endereço
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True, default="Brasil")
    
    # Preferências e observações
    preferences = Column(JSON, nullable=True)  # {"room_floor": "high", "dietary": ["vegetarian"]}
    notes = Column(Text, nullable=True)  # Observações internas
    
    # Marketing
    marketing_consent = Column(String(20), default="not_asked")  # yes, no, not_asked
    
    # Relacionamentos
    reservations = relationship("Reservation", back_populates="guest")
    
    def __repr__(self):
        return f"<Guest(id={self.id}, name='{self.full_name}', tenant_id={self.tenant_id})>"
    
    @property
    def full_name(self):
        """Nome completo do hóspede"""
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def display_document(self):
        """Documento formatado para exibição"""
        if not self.document_number:
            return None
        return f"{self.document_type or 'DOC'}: {self.document_number}"
    
    @property
    def full_address(self):
        """Endereço completo formatado"""
        if not self.address_line1:
            return None
        
        address = self.address_line1
        if self.address_line2:
            address += f", {self.address_line2}"
        if self.city:
            address += f", {self.city}"
        if self.state:
            address += f", {self.state}"
        if self.postal_code:
            address += f" - {self.postal_code}"
        
        return address