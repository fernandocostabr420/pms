# backend/app/services/audit_service.py

from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import Request
import json
from datetime import datetime

from app.models.audit_log import AuditLog
from app.models.user import User


class AuditService:
    """Serviço para registro de logs de auditoria"""
    
    def __init__(self, db: Session):
        self.db = db

    def _get_request_info(self, request: Optional[Request]) -> Dict[str, str]:
        """Extrai informações do request HTTP"""
        if not request:
            return {"ip_address": None, "user_agent": None, "endpoint": None}
            
        return {
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "endpoint": f"{request.method} {request.url.path}"
        }

    def _serialize_values(self, values: Dict[str, Any]) -> Dict[str, Any]:
        """Serializa valores para JSON, lidando com tipos não serializáveis"""
        if not values:
            return None
            
        serialized = {}
        for key, value in values.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif hasattr(value, '__dict__'):  # Objetos SQLAlchemy
                continue  # Pular relacionamentos
            else:
                try:
                    json.dumps(value)  # Teste se é serializável
                    serialized[key] = value
                except (TypeError, ValueError):
                    serialized[key] = str(value)
        
        return serialized

    def _get_changed_fields(self, old_values: Dict, new_values: Dict) -> List[str]:
        """Identifica campos que mudaram"""
        if not old_values or not new_values:
            return []
            
        changed = []
        all_keys = set(old_values.keys()) | set(new_values.keys())
        
        for key in all_keys:
            old_val = old_values.get(key)
            new_val = new_values.get(key)
            if old_val != new_val:
                changed.append(key)
        
        return changed

    def log_create(
        self, 
        table_name: str, 
        record_id: int, 
        new_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> AuditLog:
        """Registra operação CREATE"""
        request_info = self._get_request_info(request)
        
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="CREATE",
            old_values=None,
            new_values=self._serialize_values(new_values),
            changed_fields=list(new_values.keys()) if new_values else [],
            user_id=user.id,
            tenant_id=user.tenant_id,
            description=description,
            **request_info
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log

    def log_update(
        self,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> AuditLog:
        """Registra operação UPDATE"""
        request_info = self._get_request_info(request)
        old_serialized = self._serialize_values(old_values)
        new_serialized = self._serialize_values(new_values)
        
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="UPDATE",
            old_values=old_serialized,
            new_values=new_serialized,
            changed_fields=self._get_changed_fields(old_serialized or {}, new_serialized or {}),
            user_id=user.id,
            tenant_id=user.tenant_id,
            description=description,
            **request_info
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log

    def log_delete(
        self,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> AuditLog:
        """Registra operação DELETE (ou soft delete)"""
        request_info = self._get_request_info(request)
        
        audit_log = AuditLog(
            table_name=table_name,
            record_id=record_id,
            action="DELETE",
            old_values=self._serialize_values(old_values),
            new_values=None,
            changed_fields=list(old_values.keys()) if old_values else [],
            user_id=user.id,
            tenant_id=user.tenant_id,
            description=description,
            **request_info
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log

    def get_audit_trail(
        self, 
        table_name: str, 
        record_id: int, 
        tenant_id: int,
        limit: int = 50
    ) -> List[AuditLog]:
        """Busca histórico de auditoria de um registro"""
        return self.db.query(AuditLog).filter(
            AuditLog.table_name == table_name,
            AuditLog.record_id == record_id,
            AuditLog.tenant_id == tenant_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_user_activity(
        self, 
        user_id: int, 
        tenant_id: int,
        limit: int = 100
    ) -> List[AuditLog]:
        """Busca atividade de um usuário"""
        return self.db.query(AuditLog).filter(
            AuditLog.user_id == user_id,
            AuditLog.tenant_id == tenant_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_recent_activity(
        self, 
        tenant_id: int, 
        limit: int = 50
    ) -> List[AuditLog]:
        """Busca atividade recente do tenant"""
        return self.db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()