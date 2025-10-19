# backend/app/models/base.py

from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Boolean
from sqlalchemy.ext.declarative import declared_attr

from app.core.database import Base


def now_sp():
    """
    Retorna datetime atual no timezone de São Paulo.
    Função temporária até criarmos o timezone.py completo.
    """
    import pytz
    sp_tz = pytz.timezone('America/Sao_Paulo')
    return datetime.now(sp_tz)


class BaseModel(Base):
    """
    Modelo base com campos comuns a todas as tabelas.
    Agora com timezone de São Paulo.
    """
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    
    # ✅ ALTERADO - Usar timezone de São Paulo ao invés de UTC
    created_at = Column(DateTime, default=now_sp, nullable=False)
    updated_at = Column(
        DateTime, 
        default=now_sp, 
        onupdate=now_sp, 
        nullable=False
    )
    is_active = Column(Boolean, default=True, nullable=False)
    
    @declared_attr
    def __tablename__(cls):
        """Gera o nome da tabela automaticamente baseado no nome da classe"""
        return cls.__name__.lower()
    
    def __repr__(self):
        return f"<{self.__class__.__name__}(id={self.id})>"


class TenantMixin:
    """
    Mixin para modelos que precisam de tenant_id (multi-tenant).
    """
    
    @declared_attr
    def tenant_id(cls):
        from sqlalchemy import Column, Integer, ForeignKey
        return Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)