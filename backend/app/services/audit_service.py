# backend/app/services/audit_service.py

from typing import Optional, Dict, Any, List, Union
from sqlalchemy.orm import Session
from fastapi import Request
import json
import logging
from datetime import datetime, date, time
from decimal import Decimal

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    """Serviço para registro de logs de auditoria"""
    
    def __init__(self, db: Session):
        self.db = db

    def _get_request_info(self, request: Optional[Request]) -> Dict[str, Optional[str]]:
        """Extrai informações do request HTTP"""
        if not request:
            return {"ip_address": None, "user_agent": None, "endpoint": None}
        
        try:
            ip_address = None
            if request.client:
                ip_address = request.client.host
            
            # Verificar se há headers de proxy para IP real
            if not ip_address or ip_address in ['127.0.0.1', 'localhost']:
                forwarded_for = request.headers.get('x-forwarded-for')
                if forwarded_for:
                    # Pegar o primeiro IP da lista (cliente original)
                    ip_address = forwarded_for.split(',')[0].strip()
                else:
                    real_ip = request.headers.get('x-real-ip')
                    if real_ip:
                        ip_address = real_ip
            
            return {
                "ip_address": ip_address,
                "user_agent": request.headers.get("user-agent"),
                "endpoint": f"{request.method} {request.url.path}" if request.url else None
            }
        except Exception as e:
            logger.warning(f"Erro ao extrair informações do request: {e}")
            return {"ip_address": None, "user_agent": None, "endpoint": None}

    def _serialize_values(self, values: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Serializa valores para JSON, lidando com tipos não serializáveis.
        Melhoria: tratamento mais robusto de diferentes tipos de dados.
        """
        if not values:
            return None
        
        if not isinstance(values, dict):
            logger.warning(f"Valores para serialização não são um dict: {type(values)}")
            return None
            
        serialized = {}
        for key, value in values.items():
            try:
                serialized[key] = self._serialize_single_value(value)
            except Exception as e:
                logger.debug(f"Erro ao serializar campo {key}: {e}")
                # Em caso de erro, converter para string
                serialized[key] = str(value) if value is not None else None
        
        return serialized

    def _serialize_single_value(self, value: Any) -> Any:
        """Serializa um único valor para JSON"""
        if value is None:
            return None
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, datetime):
            return value.isoformat()
        elif isinstance(value, date):
            return value.isoformat()
        elif isinstance(value, time):
            return value.isoformat()
        elif isinstance(value, Decimal):
            return float(value)
        elif isinstance(value, (list, tuple)):
            return [self._serialize_single_value(item) for item in value]
        elif isinstance(value, dict):
            return {k: self._serialize_single_value(v) for k, v in value.items()}
        elif hasattr(value, '__dict__'):
            # Objeto SQLAlchemy ou similar - evitar relacionamentos
            if hasattr(value, '__table__'):
                # É um modelo SQLAlchemy, extrair apenas as colunas
                return f"<{value.__class__.__name__}(id={getattr(value, 'id', 'unknown')})>"
            else:
                # Outro tipo de objeto
                return str(value)
        else:
            # Tentar JSON dumps para verificar se é serializável
            try:
                json.dumps(value)
                return value
            except (TypeError, ValueError):
                return str(value)

    def _get_changed_fields(self, old_values: Optional[Dict], new_values: Optional[Dict]) -> List[str]:
        """
        Identifica campos que mudaram.
        Melhoria: comparação mais robusta considerando tipos diferentes.
        """
        if not old_values or not new_values:
            return []
            
        changed = []
        all_keys = set(old_values.keys()) | set(new_values.keys())
        
        for key in all_keys:
            old_val = old_values.get(key)
            new_val = new_values.get(key)
            
            # Comparação mais robusta
            if self._values_are_different(old_val, new_val):
                changed.append(key)
        
        return changed

    def _values_are_different(self, old_val: Any, new_val: Any) -> bool:
        """
        Compara dois valores considerando diferentes tipos e representações.
        """
        if old_val is None and new_val is None:
            return False
        
        if old_val is None or new_val is None:
            return True
        
        # Converter para tipos comparáveis
        old_normalized = self._normalize_for_comparison(old_val)
        new_normalized = self._normalize_for_comparison(new_val)
        
        return old_normalized != new_normalized

    def _normalize_for_comparison(self, value: Any) -> Any:
        """Normaliza valor para comparação"""
        if value is None:
            return None
        elif isinstance(value, Decimal):
            return float(value)
        elif isinstance(value, (datetime, date, time)):
            return value.isoformat()
        elif isinstance(value, str):
            return value.strip()  # Remove espaços em branco
        else:
            return value

    def _validate_audit_params(self, table_name: str, record_id: int, user: User) -> bool:
        """Valida parâmetros básicos de auditoria"""
        if not table_name or not isinstance(table_name, str):
            logger.error("Nome da tabela inválido para auditoria")
            return False
        
        if not record_id or not isinstance(record_id, int):
            logger.error("ID do registro inválido para auditoria")
            return False
        
        if not user or not hasattr(user, 'id') or not hasattr(user, 'tenant_id'):
            logger.error("Usuário inválido para auditoria")
            return False
        
        return True

    def log_create(
        self, 
        table_name: str, 
        record_id: int, 
        new_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> Optional[AuditLog]:
        """
        Registra operação CREATE.
        Melhoria: validação mais robusta e tratamento de erros.
        """
        try:
            if not self._validate_audit_params(table_name, record_id, user):
                return None
            
            request_info = self._get_request_info(request)
            serialized_new_values = self._serialize_values(new_values)
            
            audit_log = AuditLog(
                table_name=table_name,
                record_id=record_id,
                action="CREATE",
                old_values=None,
                new_values=serialized_new_values,
                changed_fields=list(new_values.keys()) if new_values else [],
                user_id=user.id,
                tenant_id=user.tenant_id,
                description=description,
                **request_info
            )
            
            self.db.add(audit_log)
            self.db.commit()
            self.db.refresh(audit_log)
            
            logger.debug(f"Auditoria CREATE registrada: {table_name}#{record_id}")
            return audit_log
            
        except Exception as e:
            logger.error(f"Erro ao registrar auditoria CREATE: {e}")
            self.db.rollback()
            return None

    def log_update(
        self,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> Optional[AuditLog]:
        """
        Registra operação UPDATE.
        Melhoria: melhor detecção de mudanças e validação.
        """
        try:
            if not self._validate_audit_params(table_name, record_id, user):
                return None
            
            request_info = self._get_request_info(request)
            old_serialized = self._serialize_values(old_values)
            new_serialized = self._serialize_values(new_values)
            
            changed_fields = self._get_changed_fields(old_serialized, new_serialized)
            
            # Só registrar se houveram mudanças reais
            if not changed_fields:
                logger.debug(f"Nenhuma mudança detectada para {table_name}#{record_id}")
                return None
            
            audit_log = AuditLog(
                table_name=table_name,
                record_id=record_id,
                action="UPDATE",
                old_values=old_serialized,
                new_values=new_serialized,
                changed_fields=changed_fields,
                user_id=user.id,
                tenant_id=user.tenant_id,
                description=description,
                **request_info
            )
            
            self.db.add(audit_log)
            self.db.commit()
            self.db.refresh(audit_log)
            
            logger.debug(f"Auditoria UPDATE registrada: {table_name}#{record_id}, campos: {changed_fields}")
            return audit_log
            
        except Exception as e:
            logger.error(f"Erro ao registrar auditoria UPDATE: {e}")
            self.db.rollback()
            return None

    def log_delete(
        self,
        table_name: str,
        record_id: int,
        old_values: Dict[str, Any],
        user: User,
        request: Optional[Request] = None,
        description: Optional[str] = None
    ) -> Optional[AuditLog]:
        """
        Registra operação DELETE (ou soft delete).
        Melhoria: melhor tratamento de valores deletados.
        """
        try:
            if not self._validate_audit_params(table_name, record_id, user):
                return None
            
            request_info = self._get_request_info(request)
            old_serialized = self._serialize_values(old_values)
            
            audit_log = AuditLog(
                table_name=table_name,
                record_id=record_id,
                action="DELETE",
                old_values=old_serialized,
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
            
            logger.debug(f"Auditoria DELETE registrada: {table_name}#{record_id}")
            return audit_log
            
        except Exception as e:
            logger.error(f"Erro ao registrar auditoria DELETE: {e}")
            self.db.rollback()
            return None

    def get_audit_trail(
        self, 
        table_name: str, 
        record_id: int, 
        tenant_id: int,
        limit: int = 50
    ) -> List[AuditLog]:
        """
        Busca histórico de auditoria de um registro.
        Melhoria: validação de parâmetros e tratamento de erros.
        """
        try:
            if limit > 200:  # Limite máximo para evitar consultas muito pesadas
                limit = 200
            
            logs = self.db.query(AuditLog).filter(
                AuditLog.table_name == table_name,
                AuditLog.record_id == record_id,
                AuditLog.tenant_id == tenant_id
            ).order_by(AuditLog.created_at.desc()).limit(limit).all()
            
            return logs
            
        except Exception as e:
            logger.error(f"Erro ao buscar histórico de auditoria: {e}")
            return []

    def get_user_activity(
        self, 
        user_id: int, 
        tenant_id: int,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Busca atividade de um usuário.
        Melhoria: validação e limite.
        """
        try:
            if limit > 500:  # Limite máximo
                limit = 500
            
            logs = self.db.query(AuditLog).filter(
                AuditLog.user_id == user_id,
                AuditLog.tenant_id == tenant_id
            ).order_by(AuditLog.created_at.desc()).limit(limit).all()
            
            return logs
            
        except Exception as e:
            logger.error(f"Erro ao buscar atividade do usuário: {e}")
            return []

    def get_recent_activity(
        self, 
        tenant_id: int, 
        limit: int = 50,
        table_names: Optional[List[str]] = None
    ) -> List[AuditLog]:
        """
        Busca atividade recente do tenant.
        Melhoria: filtro opcional por tabelas.
        """
        try:
            if limit > 200:  # Limite máximo
                limit = 200
            
            query = self.db.query(AuditLog).filter(
                AuditLog.tenant_id == tenant_id
            )
            
            if table_names:
                query = query.filter(AuditLog.table_name.in_(table_names))
            
            logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
            
            return logs
            
        except Exception as e:
            logger.error(f"Erro ao buscar atividade recente: {e}")
            return []

    def get_audit_summary(
        self,
        tenant_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Gera resumo de atividade de auditoria.
        Nova funcionalidade para estatísticas.
        """
        try:
            from datetime import datetime, timedelta
            from sqlalchemy import func
            
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # Total de operações
            total_ops = self.db.query(func.count(AuditLog.id)).filter(
                AuditLog.tenant_id == tenant_id,
                AuditLog.created_at >= start_date
            ).scalar() or 0
            
            # Por ação
            ops_by_action = self.db.query(
                AuditLog.action,
                func.count(AuditLog.id)
            ).filter(
                AuditLog.tenant_id == tenant_id,
                AuditLog.created_at >= start_date
            ).group_by(AuditLog.action).all()
            
            # Por tabela
            ops_by_table = self.db.query(
                AuditLog.table_name,
                func.count(AuditLog.id)
            ).filter(
                AuditLog.tenant_id == tenant_id,
                AuditLog.created_at >= start_date
            ).group_by(AuditLog.table_name).all()
            
            return {
                'total_operations': total_ops,
                'operations_by_action': dict(ops_by_action),
                'operations_by_table': dict(ops_by_table),
                'period_days': days,
                'start_date': start_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao gerar resumo de auditoria: {e}")
            return {
                'total_operations': 0,
                'operations_by_action': {},
                'operations_by_table': {},
                'period_days': days,
                'error': str(e)
            }

    def cleanup_old_logs(
        self,
        tenant_id: int,
        days_to_keep: int = 365
    ) -> int:
        """
        Remove logs antigos para otimização.
        Nova funcionalidade para limpeza de dados antigos.
        """
        try:
            from datetime import datetime, timedelta
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            deleted_count = self.db.query(AuditLog).filter(
                AuditLog.tenant_id == tenant_id,
                AuditLog.created_at < cutoff_date
            ).delete()
            
            self.db.commit()
            
            logger.info(f"Removidos {deleted_count} logs antigos para tenant {tenant_id}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Erro ao limpar logs antigos: {e}")
            self.db.rollback()
            return 0