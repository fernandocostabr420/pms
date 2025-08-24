# backend/app/models/tenant.py

from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Tenant(BaseModel):
    """
    Modelo de Tenant - para multi-tenant desde o início.
    Cada tenant representa uma empresa/organização.
    """
    __tablename__ = "tenants"
    
    name = Column(String(100), nullable=False, index=True)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    
    # Relacionamentos
    users = relationship("User", back_populates="tenant")
    # properties = relationship("Property", back_populates="tenant")  # Futuro
    
    def __repr__(self):
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"