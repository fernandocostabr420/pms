# backend/app/tasks/__init__.py

"""
Módulo de tasks para background processing.
Inclui todas as tasks relacionadas ao Channel Manager, sincronização WuBook e operações assíncronas.
"""

import logging
from typing import Dict, Any, List, Optional

# Configurar logging para tasks
logger = logging.getLogger(__name__)

# ============== IMPORTS DAS TASKS ==============

try:
    # Tasks de sincronização WuBook
    from .wubook_sync_tasks import WuBookSyncTasks
    logger.info("WuBookSyncTasks importado com sucesso")
except ImportError as e:
    logger.error(f"Erro ao importar WuBookSyncTasks: {e}")
    WuBookSyncTasks = None

try:
    # Job específico de disponibilidade
    from .availability_sync_job import AvailabilitySyncJob, create_scheduled_jobs
    logger.info("AvailabilitySyncJob importado com sucesso")
except ImportError as e:
    logger.error(f"Erro ao importar AvailabilitySyncJob: {e}")
    AvailabilitySyncJob = None
    create_scheduled_jobs = None

# ============== FUNÇÕES PRINCIPAIS ==============

def get_available_tasks() -> Dict[str, Any]:
    """
    Retorna dicionário com todas as tasks disponíveis.
    Útil para verificar quais tasks estão carregadas.
    """
    tasks = {}
    
    # Tasks da classe WuBookSyncTasks
    if WuBookSyncTasks:
        tasks.update({
            "sync_all_availability": WuBookSyncTasks.sync_all_availability_task,
            "sync_specific_configuration": WuBookSyncTasks.sync_specific_configuration_task,
            "cleanup_old_sync_logs": WuBookSyncTasks.cleanup_old_sync_logs_task,
            "health_check_configurations": WuBookSyncTasks.health_check_configurations_task,
            "retry_failed_syncs": WuBookSyncTasks.retry_failed_syncs_task,
        })
    
    # Tasks do AvailabilitySyncJob (instanciadas dinamicamente)
    if AvailabilitySyncJob:
        tasks.update({
            "availability_sync_job": AvailabilitySyncJob,
            "run_incremental_sync": "AvailabilitySyncJob().run_incremental_sync",
            "run_full_sync": "AvailabilitySyncJob().run_full_sync",
            "run_room_specific_sync": "AvailabilitySyncJob().run_room_specific_sync",
            "run_error_recovery_sync": "AvailabilitySyncJob().run_error_recovery_sync",
            "get_sync_health_status": "AvailabilitySyncJob().get_sync_health_status",
        })
    
    return tasks


def get_scheduled_jobs_config() -> Dict[str, Any]:
    """
    Retorna configuração de jobs programados.
    """
    if create_scheduled_jobs:
        return create_scheduled_jobs()
    
    return {
        "error": "create_scheduled_jobs não está disponível",
        "available": False
    }


def validate_tasks_health() -> Dict[str, Any]:
    """
    Valida se todas as tasks estão funcionando corretamente.
    """
    health = {
        "status": "healthy",
        "tasks_available": True,
        "imports_successful": True,
        "errors": []
    }
    
    # Verificar imports
    if not WuBookSyncTasks:
        health["imports_successful"] = False
        health["errors"].append("WuBookSyncTasks não disponível")
    
    if not AvailabilitySyncJob:
        health["imports_successful"] = False
        health["errors"].append("AvailabilitySyncJob não disponível")
    
    # Verificar se pelo menos uma task está disponível
    available_tasks = get_available_tasks()
    if not available_tasks:
        health["tasks_available"] = False
        health["errors"].append("Nenhuma task disponível")
    
    # Determinar status geral
    if health["errors"]:
        health["status"] = "warning" if len(health["errors"]) < 3 else "critical"
    
    # Adicionar informações úteis
    health["total_tasks"] = len(available_tasks)
    health["wubook_tasks_available"] = WuBookSyncTasks is not None
    health["availability_job_available"] = AvailabilitySyncJob is not None
    
    return health


def get_task_documentation() -> Dict[str, str]:
    """
    Retorna documentação das tasks disponíveis.
    """
    docs = {}
    
    if WuBookSyncTasks:
        docs.update({
            "sync_all_availability": "Sincroniza disponibilidade de todas as configurações ativas",
            "sync_specific_configuration": "Sincroniza uma configuração específica",
            "cleanup_old_sync_logs": "Remove logs de sincronização antigos",
            "health_check_configurations": "Verifica saúde das configurações WuBook",
            "retry_failed_syncs": "Retenta sincronizações que falharam",
        })
    
    if AvailabilitySyncJob:
        docs.update({
            "run_incremental_sync": "Executa sincronização incremental (apenas pendências)",
            "run_full_sync": "Executa sincronização completa",
            "run_room_specific_sync": "Sincroniza quartos específicos",
            "run_error_recovery_sync": "Recupera erros de sincronização",
            "get_sync_health_status": "Retorna status de saúde da sincronização",
        })
    
    return docs


# ============== UTILITÁRIOS PARA CELERY ==============

def register_celery_tasks(celery_app):
    """
    Registra todas as tasks no app Celery.
    Chamado pela configuração do Celery.
    """
    registered_tasks = []
    
    try:
        # Registrar tasks estáticas do WuBookSyncTasks
        if WuBookSyncTasks:
            from app.core.celery_app import create_celery_tasks
            tasks_dict = create_celery_tasks(celery_app)
            registered_tasks.extend(tasks_dict.keys())
            logger.info(f"Tasks WuBook registradas: {list(tasks_dict.keys())}")
        
        # As tasks do AvailabilitySyncJob são instanciadas dinamicamente
        # e já estão registradas no celery_app.py
        
        logger.info(f"Total de tasks registradas: {len(registered_tasks)}")
        return registered_tasks
        
    except Exception as e:
        logger.error(f"Erro ao registrar tasks Celery: {e}")
        return []


def create_task_shortcuts():
    """
    Cria atalhos para facilitar execução de tasks comuns.
    """
    shortcuts = {}
    
    if WuBookSyncTasks:
        shortcuts.update({
            # Atalhos para tasks mais comuns
            "quick_sync": WuBookSyncTasks.sync_all_availability_task,
            "health_check": WuBookSyncTasks.health_check_configurations_task,
            "cleanup": WuBookSyncTasks.cleanup_old_sync_logs_task,
        })
    
    return shortcuts


# ============== CONFIGURAÇÃO DE LOGGING ==============

def setup_task_logging():
    """
    Configura logging específico para tasks.
    """
    # Configurar handler específico para tasks se necessário
    task_logger = logging.getLogger('app.tasks')
    
    if not task_logger.handlers:
        # Criar handler console se não existir
        console_handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [TASK] %(message)s'
        )
        console_handler.setFormatter(formatter)
        task_logger.addHandler(console_handler)
        task_logger.setLevel(logging.INFO)
    
    return task_logger


# ============== EXPORTS ==============

# Classes principais
__all__ = [
    # Classes
    "WuBookSyncTasks",
    "AvailabilitySyncJob",
    
    # Funções de configuração
    "get_available_tasks",
    "get_scheduled_jobs_config", 
    "validate_tasks_health",
    "get_task_documentation",
    
    # Utilitários Celery
    "register_celery_tasks",
    "create_task_shortcuts",
    
    # Logging
    "setup_task_logging",
    
    # Configuração de jobs programados
    "create_scheduled_jobs",
]

# ============== INICIALIZAÇÃO DO MÓDULO ==============

# Setup automático de logging quando módulo é importado
task_logger = setup_task_logging()

# Log de inicialização
task_logger.info("Módulo app.tasks inicializado")

# Validar saúde das tasks na inicialização
health_status = validate_tasks_health()
if health_status["status"] != "healthy":
    task_logger.warning(f"Tasks com problemas: {health_status['errors']}")
else:
    task_logger.info(f"Tasks saudáveis: {health_status['total_tasks']} disponíveis")

# Mostrar tasks disponíveis
available_tasks = get_available_tasks()
task_logger.info(f"Tasks carregadas: {list(available_tasks.keys())}")


# ============== FUNÇÕES DE CONVENIÊNCIA ==============

def run_health_check():
    """Executa verificação de saúde das tasks"""
    return validate_tasks_health()


def list_available_tasks():
    """Lista todas as tasks disponíveis com documentação"""
    tasks = get_available_tasks()
    docs = get_task_documentation()
    
    result = {}
    for task_name in tasks.keys():
        result[task_name] = {
            "function": tasks[task_name],
            "description": docs.get(task_name, "Sem documentação disponível")
        }
    
    return result


def get_module_info():
    """Retorna informações completas do módulo"""
    return {
        "module": "app.tasks",
        "health": validate_tasks_health(),
        "available_tasks": list(get_available_tasks().keys()),
        "scheduled_jobs": get_scheduled_jobs_config(),
        "documentation": get_task_documentation()
    }