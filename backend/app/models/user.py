# backend/app/models/user.py

from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import BaseModel, TenantMixin


class User(BaseModel, TenantMixin):
    """
    Modelo de Usuário com autenticação e multi-tenant.
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint('email', 'tenant_id', name='unique_email_per_tenant'),
    )
    
    # Dados pessoais
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Controle de acesso
    is_superuser = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    
    # Controle de senha (NOVOS CAMPOS)
    must_change_password = Column(Boolean, default=False, nullable=False)
    password_changed_at = Column(DateTime, nullable=True)
    
    # Datas importantes
    last_login = Column(DateTime, nullable=True)
    
    # Relacionamentos
    tenant = relationship("Tenant", back_populates="users")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', tenant_id={self.tenant_id})>"