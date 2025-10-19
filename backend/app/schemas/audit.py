# backend/app/schemas/audit.py

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditLogResponse(BaseModel):
    """Schema para resposta de log de auditoria"""
    id: int
    table_name: str
    record_id: int
    action: str
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    changed_fields: Optional[List[str]]
    user_id: int
    ip_address: Optional[str]
    user_agent: Optional[str]
    endpoint: Optional[str]
    description: Optional[str]
    created_at: datetime
    
    # Dados do usuário (via relationship)
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class AuditLogWithUser(AuditLogResponse):
    """Schema com dados completos do usuário"""
    user_email: str
    user_full_name: str


class AuditTrailResponse(BaseModel):
    """Schema para histórico completo de um registro"""
    table_name: str
    record_id: int
    total_changes: int
    logs: List[AuditLogResponse]


class AuditSummary(BaseModel):
    """Schema para resumo de auditoria"""
    total_operations: int
    operations_by_action: Dict[str, int]  # {"CREATE": 10, "UPDATE": 5, "DELETE": 2}
    operations_by_table: Dict[str, int]   # {"users": 8, "properties": 9}
    most_active_users: List[Dict[str, Any]]  # [{"user": "João", "count": 15}]
    recent_activity: List[AuditLogResponse]


class AuditFilters(BaseModel):
    """Schema para filtros de busca de auditoria"""
    table_name: Optional[str] = None
    action: Optional[str] = None  # CREATE, UPDATE, DELETE
    user_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search_text: Optional[str] = None  # Busca na descrição