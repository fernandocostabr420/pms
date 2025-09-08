# backend/app/utils/decorators.py

from functools import wraps
from typing import Callable, Any, Dict, Optional, Union
from sqlalchemy.orm import Session
from fastapi import Request
from decimal import Decimal
from datetime import datetime, date, time
import inspect
import logging

from app.services.audit_service import AuditService
from app.models.user import User

logger = logging.getLogger(__name__)


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
            # Capturar dados antes da execução (para UPDATE)
            old_values = {}
            if action.upper() == "UPDATE":
                old_values = kwargs.get('_old_values', {})
                
                # Se não foi passado _old_values, tentar capturar automaticamente
                if not old_values:
                    try:
                        # Tentar extrair do primeiro argumento ou de kwargs
                        service_instance = args[0] if args else None
                        record_id = kwargs.get('record_id') or kwargs.get('id')
                        
                        if service_instance and hasattr(service_instance, 'db') and record_id:
                            # Buscar registro atual antes da alteração
                            model_class = _get_model_class_from_table(table_name)
                            if model_class:
                                current_record = service_instance.db.query(model_class).filter(
                                    model_class.id == record_id
                                ).first()
                                if current_record:
                                    old_values = _extract_model_data(current_record)
                    except Exception as e:
                        logger.warning(f"Não foi possível capturar valores antigos: {e}")
            
            # Executar o método original
            result = func(*args, **kwargs)
            
            try:
                # Extrair informações do contexto
                service_instance = args[0] if args else None
                db_session = None
                current_user = None
                request = None
                
                # Encontrar sessão do banco nos argumentos
                for arg in list(args) + list(kwargs.values()):
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
                    logger.debug("Auditoria pulada - informações insuficientes")
                    return result
                
                audit_service = AuditService(db_session)
                
                # Extrair ID do resultado (assumindo que tem atributo 'id')
                record_id = None
                if result and hasattr(result, 'id'):
                    record_id = result.id
                elif isinstance(result, dict) and 'id' in result:
                    record_id = result['id']
                elif action.upper() in ["UPDATE", "DELETE"]:
                    # Para UPDATE/DELETE, tentar pegar ID dos argumentos
                    record_id = kwargs.get('record_id') or kwargs.get('id')
                    if not record_id and args and len(args) > 1:
                        # Tentar segundo argumento como ID
                        try:
                            record_id = int(args[1])
                        except (ValueError, TypeError, IndexError):
                            pass
                
                if not record_id:
                    logger.warning(f"ID do registro não encontrado para auditoria de {action}")
                    return result
                
                # Preparar dados para auditoria baseado na ação
                if action.upper() == "CREATE":
                    new_values = _extract_model_data(result) if result else {}
                    audit_service.log_create(
                        table_name=table_name,
                        record_id=record_id,
                        new_values=new_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                    
                elif action.upper() == "UPDATE":
                    new_values = _extract_model_data(result) if result else {}
                    
                    # Se ainda não temos old_values, tentar do resultado alterado
                    if not old_values and result:
                        # Para alguns casos, o resultado pode conter os valores antigos
                        old_values = kwargs.get('original_data', {})
                    
                    audit_service.log_update(
                        table_name=table_name,
                        record_id=record_id,
                        old_values=old_values,
                        new_values=new_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                    
                elif action.upper() == "DELETE":
                    # Para DELETE, old_values são os dados que foram removidos
                    delete_values = old_values or _extract_model_data(result) if result else {}
                    audit_service.log_delete(
                        table_name=table_name,
                        record_id=record_id,
                        old_values=delete_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                
                logger.debug(f"Auditoria registrada: {action} em {table_name}#{record_id}")
                
            except Exception as e:
                # Não falhar o método principal se auditoria falhar
                logger.error(f"Erro na auditoria para {action} em {table_name}: {e}")
            
            return result
        
        return wrapper
    return decorator


def _get_model_class_from_table(table_name: str):
    """Tenta mapear nome da tabela para classe do modelo"""
    # Mapeamento manual - pode ser expandido conforme necessário
    table_to_model = {
        'reservations': 'Reservation',
        'payments': 'Payment',
        'users': 'User',
        'guests': 'Guest',
        'properties': 'Property',
        'rooms': 'Room',
        'room_types': 'RoomType',
        'reservation_rooms': 'ReservationRoom',
    }
    
    model_name = table_to_model.get(table_name)
    if model_name:
        try:
            # Importação dinâmica baseada no nome
            if model_name == 'Reservation':
                from app.models.reservation import Reservation
                return Reservation
            elif model_name == 'Payment':
                from app.models.payment import Payment
                return Payment
            elif model_name == 'User':
                from app.models.user import User
                return User
            elif model_name == 'Guest':
                from app.models.guest import Guest
                return Guest
            # Adicionar outros modelos conforme necessário
        except ImportError:
            logger.warning(f"Não foi possível importar modelo para {table_name}")
    
    return None


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
    
    try:
        # Se é um dicionário, retornar como está
        if isinstance(model_instance, dict):
            return {k: _serialize_value(v) for k, v in model_instance.items()}
        
        # Pegar colunas da tabela SQLAlchemy
        if hasattr(model_instance, '__table__'):
            for column in model_instance.__table__.columns:
                column_name = column.name
                try:
                    value = getattr(model_instance, column_name, None)
                    data[column_name] = _serialize_value(value)
                except Exception as e:
                    logger.debug(f"Erro ao extrair campo {column_name}: {e}")
                    continue
        else:
            # Se não é um modelo SQLAlchemy, tentar extrair atributos públicos
            for attr_name in dir(model_instance):
                if not attr_name.startswith('_') and not callable(getattr(model_instance, attr_name)):
                    try:
                        value = getattr(model_instance, attr_name)
                        data[attr_name] = _serialize_value(value)
                    except:
                        continue
    
    except Exception as e:
        logger.error(f"Erro ao extrair dados do modelo: {e}")
        return {}
    
    return data


def _serialize_value(value: Any) -> Any:
    """Serializa um valor individual para JSON"""
    if value is None:
        return None
    elif isinstance(value, (datetime, date, time)):
        return value.isoformat()
    elif isinstance(value, Decimal):
        return float(value)
    elif isinstance(value, (str, int, float, bool)):
        return value
    elif isinstance(value, (list, tuple)):
        return [_serialize_value(item) for item in value]
    elif isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    else:
        # Para objetos complexos, converter para string
        try:
            # Tentar JSON dump para verificar se é serializável
            import json
            json.dumps(value)
            return value
        except (TypeError, ValueError):
            return str(value)


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
        # Cleanup se necessário
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
    
    action_upper = action.upper()
    if action_upper == "CREATE":
        return audit_service.log_create(table_name, record_id, new_values or {}, user, request, description)
    elif action_upper == "UPDATE":
        return audit_service.log_update(table_name, record_id, old_values or {}, new_values or {}, user, request, description)
    elif action_upper == "DELETE":
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
        logger.debug(f"[AUDIT] Executando {func.__name__}")
        result = func(*args, **kwargs)
        logger.debug(f"[AUDIT] {func.__name__} executado com sucesso")
        return result
    return wrapper


# Funções auxiliares para o sistema de auditoria
def should_audit_field(field_name: str, old_value: Any, new_value: Any) -> bool:
    """Determina se um campo deve ser auditado"""
    # Ignorar campos de sistema
    if field_name in ['updated_at', 'created_at', 'id']:
        return False
    
    # Auditar apenas se houve mudança
    return old_value != new_value


def format_audit_description(action: str, table_name: str, changes: Dict[str, Any]) -> str:
    """Formata descrição da auditoria"""
    action_upper = action.upper()
    if action_upper == "CREATE":
        return f"Criado novo registro em {table_name}"
    elif action_upper == "UPDATE":
        changed_fields = list(changes.keys())
        return f"Atualizado {table_name}: {', '.join(changed_fields)}"
    elif action_upper == "DELETE":
        return f"Removido registro de {table_name}"
    else:
        return f"Ação {action} em {table_name}"


# Decorator especializado para captura automática em updates
def auto_audit_update(table_name: str, description: Optional[str] = None):
    """
    Decorador especializado para operações UPDATE que captura automaticamente
    os valores antigos antes da execução.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Capturar valores antigos antes da execução
            old_values = {}
            try:
                service_instance = args[0] if args else None
                
                # Tentar extrair record_id de diferentes maneiras
                record_id = None
                if len(args) > 1:
                    # Segundo argumento pode ser record_id
                    try:
                        record_id = int(args[1])
                    except (ValueError, TypeError):
                        pass
                
                if not record_id:
                    # Tentar dos kwargs
                    record_id = kwargs.get('record_id') or kwargs.get('reservation_id') or kwargs.get('payment_id') or kwargs.get('id')
                
                if record_id and service_instance and hasattr(service_instance, 'db'):
                    model_class = _get_model_class_from_table(table_name)
                    if model_class:
                        current_record = service_instance.db.query(model_class).filter(
                            model_class.id == record_id
                        ).first()
                        if current_record:
                            old_values = _extract_model_data(current_record)
            except Exception as e:
                logger.warning(f"Erro ao capturar valores antigos: {e}")
            
            # Executar o método original
            result = func(*args, **kwargs)
            
            # Registrar auditoria após a execução
            try:
                # Extrair informações do contexto
                db_session = None
                current_user = None
                request = None
                
                # Encontrar sessão do banco nos argumentos
                for arg in list(args) + list(kwargs.values()):
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
                
                if db_session and current_user and record_id:
                    audit_service = AuditService(db_session)
                    
                    # Capturar novos valores do resultado
                    new_values = _extract_model_data(result) if result else {}
                    
                    # Registrar auditoria
                    audit_service.log_update(
                        table_name=table_name,
                        record_id=record_id,
                        old_values=old_values,
                        new_values=new_values,
                        user=current_user,
                        request=request,
                        description=description
                    )
                    
                    logger.debug(f"Auditoria automática registrada: UPDATE em {table_name}#{record_id}")
                
            except Exception as e:
                logger.error(f"Erro na auditoria automática para UPDATE em {table_name}: {e}")
            
            return result
        
        return wrapper
    return decorator