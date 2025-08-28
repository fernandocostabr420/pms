# backend/app/utils/decorators.py

from functools import wraps
from typing import Callable, Any, Dict, Optional
from sqlalchemy.orm import Session
from fastapi import Request
import inspect

from app.services.audit_service import AuditService
from app.models.user import User


def audit_operation(table_name: str, action: str, description: Optional[str] = None):
    """
    Decorador para automaticamente registrar operações de auditoria.
    
    Args:
        table_name: Nome da tabela sendo alterada
        action: Tipo de operação (CREATE, UPDATE, DELETE)
        description: Descrição customizada da operação
    
    Uso:
        @audit_operation("users", "CREATE", "Criação de usuário")
        def create_user(self, user_data, current_user):
            # lógica do método
            return user
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Executar o método original primeiro
            result = func(*args, **kwargs)
            
            try:
                # Tentar extrair informações do contexto
                service_instance = args[0] if args else None
                db_session = None
                current_user = None
                request = None
                
                # Encontrar sessão do banco nos argumentos
                for arg in args + tuple(kwargs.values()):
                    if isinstance(arg, Session):
                        db_session = arg
                        break
                    elif isinstance(arg, User):
                        current_user = arg
                    elif isinstance(arg, Request):
                        request = arg
                
                # Tentar pegar do service instance
                if not db_session and hasattr(service_instance, 'db'):
                    db_session = service_instance.db
                
                # Se não encontrou user nos args, tentar nos kwargs
                if not current_user:
                    current_user = kwargs.get('current_user') or kwargs.get('user')
                
                # Se não encontrou request nos args, tentar nos kwargs
                if not request:
                    request = kwargs.get('request')
                
                if not db_session or not current_user:
                    # Se não conseguiu extrair informações necessárias, apenas retornar
                    return result
                
                audit_service = AuditService(db_session)
                
                # Extrair ID do resultado (assumindo que tem atributo 'id')
                record_id = getattr(result, 'id', None) if result else None
                
                if not record_id:
                    return result
                
                # Preparar dados para auditoria baseado na ação
                if action == "CREATE":
                    new_values = _extract_model_data(result)
                    audit_service.log_create(
                        table_name=table_name,
                        record_id=record_id,
                        new_values=new_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                elif action == "UPDATE":
                    # Para UPDATE, precisamos dos valores antigos
                    # Isso requer modificação no service para passar old_values
                    old_values = kwargs.get('_old_values', {})
                    new_values = _extract_model_data(result)
                    audit_service.log_update(
                        table_name=table_name,
                        record_id=record_id,
                        old_values=old_values,
                        new_values=new_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                elif action == "DELETE":
                    old_values = _extract_model_data(result)
                    audit_service.log_delete(
                        table_name=table_name,
                        record_id=record_id,
                        old_values=old_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                
            except Exception as e:
                # Não falhar o método principal se auditoria falhar
                print(f"Erro na auditoria: {e}")
                pass
            
            return result
        
        return wrapper
    return decorator


# Alias para compatibilidade com novos módulos que usam @audit_action
def audit_action(action: str, table_name: str, description: Optional[str] = None):
    """
    Alias para audit_operation com ordem diferente dos parâmetros.
    Mantém compatibilidade com código que usa @audit_action("CREATE", "table_name")
    """
    return audit_operation(table_name, action, description)


def _extract_model_data(model_instance) -> Dict[str, Any]:
    """
    Extrai dados de um modelo SQLAlchemy para auditoria.
    Remove relacionamentos e dados não serializáveis.
    """
    if not model_instance:
        return {}
    
    data = {}
    
    # Pegar colunas da tabela
    if hasattr(model_instance, '__table__'):
        for column in model_instance.__table__.columns:
            column_name = column.name
            value = getattr(model_instance, column_name, None)
            
            # Converter tipos especiais para JSON serializable
            if hasattr(value, 'isoformat'):  # datetime, date, time
                data[column_name] = value.isoformat()
            elif hasattr(value, '__float__'):  # Decimal
                data[column_name] = float(value)
            elif value is None:
                data[column_name] = None
            else:
                # Tentar converter para tipos básicos
                try:
                    data[column_name] = value
                except:
                    data[column_name] = str(value)
    
    return data


def audit_method(func: Callable) -> Callable:
    """
    Decorador mais simples que apenas marca métodos para auditoria manual.
    Útil quando você quer controle total sobre quando e como auditar.
    """
    func._audit_enabled = True
    return func


# Context manager para auditoria manual
class AuditContext:
    """
    Context manager para auditoria manual em operações complexas.
    
    Uso:
        with AuditContext(db, user, request) as audit:
            # operações
            user = create_user(...)
            audit.log_create("users", user.id, extract_data(user))
    """
    
    def __init__(self, db: Session, user: User, request: Optional[Request] = None):
        self.audit_service = AuditService(db)
        self.user = user
        self.request = request
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Poderia fazer cleanup aqui se necessário
        pass
    
    def log_create(self, table_name: str, record_id: int, new_values: Dict[str, Any], description: Optional[str] = None):
        """Registra operação CREATE"""
        return self.audit_service.log_create(
            table_name=table_name,
            record_id=record_id,
            new_values=new_values,
            user=self.user,
            request=self.request,
            description=description
        )
    
    def log_update(self, table_name: str, record_id: int, old_values: Dict[str, Any], new_values: Dict[str, Any], description: Optional[str] = None):
        """Registra operação UPDATE"""
        return self.audit_service.log_update(
            table_name=table_name,
            record_id=record_id,
            old_values=old_values,
            new_values=new_values,
            user=self.user,
            request=self.request,
            description=description
        )
    
    def log_delete(self, table_name: str, record_id: int, old_values: Dict[str, Any], description: Optional[str] = None):
        """Registra operação DELETE"""
        return self.audit_service.log_delete(
            table_name=table_name,
            record_id=record_id,
            old_values=old_values,
            user=self.user,
            request=self.request,
            description=description
        )


# Função auxiliar para uso direto
def create_audit_log(db: Session, user: User, table_name: str, record_id: int, action: str, 
                    old_values: Optional[Dict[str, Any]] = None, new_values: Optional[Dict[str, Any]] = None,
                    request: Optional[Request] = None, description: Optional[str] = None):
    """
    Função auxiliar para criar log de auditoria diretamente.
    Útil para casos onde não queremos usar context manager ou decorador.
    """
    audit_service = AuditService(db)
    
    if action.upper() == "CREATE":
        return audit_service.log_create(table_name, record_id, new_values or {}, user, request, description)
    elif action.upper() == "UPDATE":
        return audit_service.log_update(table_name, record_id, old_values or {}, new_values or {}, user, request, description)
    elif action.upper() == "DELETE":
        return audit_service.log_delete(table_name, record_id, old_values or {}, user, request, description)
    else:
        raise ValueError(f"Ação inválida: {action}. Use CREATE, UPDATE ou DELETE.")


# Decorador simplificado para métodos que já têm controle manual
def with_audit_logging(func: Callable) -> Callable:
    """
    Decorador que apenas adiciona logging de debug para auditoria.
    Não executa auditoria automaticamente, apenas facilita debug.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"[AUDIT] Executando {func.__name__}")
        result = func(*args, **kwargs)
        print(f"[AUDIT] {func.__name__} executado com sucesso")
        return result
    return wrapper


# Funções auxiliares adicionais para o sistema RoomAvailability
def should_audit_field(field_name: str, old_value: Any, new_value: Any) -> bool:
    """Determina se um campo deve ser auditado"""
    # Ignorar campos de sistema
    if field_name in ['updated_at', 'created_at']:
        return False
    
    # Auditar apenas se houve mudança
    return old_value != new_value


def format_audit_description(action: str, table_name: str, changes: Dict[str, Any]) -> str:
    """Formata descrição da auditoria"""
    if action == "CREATE":
        return f"Criado novo registro em {table_name}"
    elif action == "UPDATE":
        changed_fields = list(changes.keys())
        return f"Atualizado {table_name}: {', '.join(changed_fields)}"
    elif action == "DELETE":
        return f"Removido registro de {table_name}"
    else:
        return f"Ação {action} em {table_name}"