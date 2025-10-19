# backend/app/api/v1/endpoints/audit.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse, 
    AuditTrailResponse, 
    AuditSummary,
    AuditLogWithUser
)
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter()


@router.get("/trail/{table_name}/{record_id}", response_model=AuditTrailResponse)
def get_audit_trail(
    table_name: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(50, le=200)
):
    """Busca histórico completo de alterações de um registro"""
    audit_service = AuditService(db)
    logs = audit_service.get_audit_trail(table_name, record_id, current_user.tenant_id, limit)
    
    # Adicionar nome do usuário
    logs_with_user = []
    for log in logs:
        log_dict = AuditLogResponse.model_validate(log).dict()
        log_dict["user_name"] = log.user.full_name if log.user else "Sistema"
        logs_with_user.append(AuditLogResponse(**log_dict))
    
    return AuditTrailResponse(
        table_name=table_name,
        record_id=record_id,
        total_changes=len(logs_with_user),
        logs=logs_with_user
    )


@router.get("/user/{user_id}", response_model=List[AuditLogResponse])
def get_user_activity(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(100, le=500)
):
    """Busca atividade de um usuário específico"""
    # Verificar se é o próprio usuário ou superuser
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para ver atividade de outros usuários"
        )
    
    audit_service = AuditService(db)
    logs = audit_service.get_user_activity(user_id, current_user.tenant_id, limit)
    
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/recent", response_model=List[AuditLogWithUser])
def get_recent_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(50, le=200)
):
    """Busca atividade recente do tenant"""
    # Query com join para pegar dados do usuário
    logs_query = db.query(AuditLog).join(User).filter(
        AuditLog.tenant_id == current_user.tenant_id
    ).order_by(desc(AuditLog.created_at)).limit(limit)
    
    logs = logs_query.all()
    
    # Converter para response com dados do usuário
    logs_with_user = []
    for log in logs:
        log_dict = AuditLogResponse.model_validate(log).dict()
        log_dict.update({
            "user_email": log.user.email,
            "user_full_name": log.user.full_name
        })
        logs_with_user.append(AuditLogWithUser(**log_dict))
    
    return logs_with_user


@router.get("/summary", response_model=AuditSummary)
def get_audit_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    days: int = Query(30, ge=1, le=365)
):
    """Resumo de auditoria dos últimos N dias (apenas superuser)"""
    from datetime import datetime, timedelta
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Total de operações
    total_ops = db.query(func.count(AuditLog.id)).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.created_at >= start_date
    ).scalar()
    
    # Por ação
    ops_by_action = db.query(
        AuditLog.action, 
        func.count(AuditLog.id)
    ).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.action).all()
    
    ops_by_action_dict = {action: count for action, count in ops_by_action}
    
    # Por tabela
    ops_by_table = db.query(
        AuditLog.table_name, 
        func.count(AuditLog.id)
    ).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.table_name).all()
    
    ops_by_table_dict = {table: count for table, count in ops_by_table}
    
    # Usuários mais ativos
    most_active = db.query(
        User.full_name, 
        func.count(AuditLog.id).label('count')
    ).join(AuditLog).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.created_at >= start_date
    ).group_by(User.id, User.full_name).order_by(desc('count')).limit(10).all()
    
    most_active_users = [
        {"user": name, "count": count} 
        for name, count in most_active
    ]
    
    # Atividade recente
    recent_logs = db.query(AuditLog).filter(
        AuditLog.tenant_id == current_user.tenant_id
    ).order_by(desc(AuditLog.created_at)).limit(10).all()
    
    recent_activity = [AuditLogResponse.model_validate(log) for log in recent_logs]
    
    return AuditSummary(
        total_operations=total_ops,
        operations_by_action=ops_by_action_dict,
        operations_by_table=ops_by_table_dict,
        most_active_users=most_active_users,
        recent_activity=recent_activity
    )


@router.get("/search", response_model=List[AuditLogWithUser])
def search_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    table_name: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500)
):
    """Busca logs de auditoria com filtros"""
    query = db.query(AuditLog).join(User).filter(
        AuditLog.tenant_id == current_user.tenant_id
    )
    
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    
    if action:
        query = query.filter(AuditLog.action == action)
        
    if user_id:
        # Verificar permissão para ver outros usuários
        if user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para filtrar por outros usuários"
            )
        query = query.filter(AuditLog.user_id == user_id)
    
    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    
    # Converter com dados do usuário
    logs_with_user = []
    for log in logs:
        log_dict = AuditLogResponse.model_validate(log).dict()
        log_dict.update({
            "user_email": log.user.email,
            "user_full_name": log.user.full_name
        })
        logs_with_user.append(AuditLogWithUser(**log_dict))
    
    return logs_with_user