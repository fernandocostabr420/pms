# backend/app/models/audit_log.py

from sqlalchemy import Column, String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, TenantMixin


class AuditLog(BaseModel, TenantMixin):
    """
    Modelo para logs de auditoria - rastreamento de todas as alterações no sistema.
    Registra quem, quando, o quê e como foi alterado.
    """
    __tablename__ = "audit_logs"
    
    # Identificação da operação
    table_name = Column(String(50), nullable=False, index=True)  # Tabela afetada
    record_id = Column(Integer, nullable=False, index=True)      # ID do registro
    action = Column(String(10), nullable=False, index=True)      # CREATE, UPDATE, DELETE
    
    # Dados da alteração
    old_values = Column(JSON, nullable=True)           # Valores antes da alteração
    new_values = Column(JSON, nullable=True)           # Valores após a alteração
    changed_fields = Column(JSON, nullable=True)       # Lista de campos alterados
    
    # Contexto da operação
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)     # IPv4/IPv6
    user_agent = Column(Text, nullable=True)           # Info do browser/client
    endpoint = Column(String(200), nullable=True)      # Endpoint da API chamado
    
    # Informações extras
    description = Column(String(500), nullable=True)   # Descrição customizada
    
    # Relacionamentos
    user = relationship("User", backref="audit_logs")
    
    def __repr__(self):
        return (f"<AuditLog(id={self.id}, table={self.table_name}, "
                f"record_id={self.record_id}, action={self.action})>")
    
    @property
    def summary(self):
        """Resumo da operação para exibição"""
        user_name = self.user.full_name if self.user else "Sistema"
        return f"{user_name} {self.action.lower()} {self.table_name}#{self.record_id}"