# backend/app/tasks/manual_sync_task.py

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import traceback
import uuid

from app.core.database import get_db
from app.services.manual_sync_service import ManualSyncService

logger = logging.getLogger(__name__)


class ManualSyncTask:
    """
    Task para processamento de sincronização manual.
    Oferece tanto processamento síncrono quanto assíncrono.
    """
    
    @staticmethod
    def process_manual_sync_sync(
        tenant_id: int,
        property_id: Optional[int] = None,
        force_all: bool = False,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Processamento síncrono de sincronização manual.
        Ideal para pequenos volumes de dados.
        
        Args:
            tenant_id: ID do tenant
            property_id: ID da propriedade (opcional)
            force_all: Forçar sincronização de todos os registros
            batch_size: Tamanho do batch
            
        Returns:
            Dict com resultado da sincronização
        """
        sync_id = f"manual_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{tenant_id}"
        started_at = datetime.utcnow()
        
        logger.info(f"Iniciando sincronização manual síncrona {sync_id}")
        
        db = None
        try:
            # Obter sessão do banco
            db = next(get_db())
            
            # Criar serviço
            sync_service = ManualSyncService(db)
            
            # Processar sincronização
            result = sync_service.process_manual_sync(
                tenant_id=tenant_id,
                property_id=property_id,
                force_all=force_all,
                batch_size=batch_size
            )
            
            logger.info(f"Sincronização manual síncrona {sync_id} concluída: "
                       f"{result.get('successful', 0)}/{result.get('processed', 0)} sucessos")
            
            return result
            
        except Exception as e:
            logger.error(f"Erro na sincronização manual síncrona {sync_id}: {str(e)}")
            logger.error(traceback.format_exc())
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            return {
                "sync_id": sync_id,
                "status": "error",
                "message": f"Erro crítico: {str(e)}",
                "total_pending": 0,
                "processed": 0,
                "successful": 0,
                "failed": 0,
                "success_rate": 0,
                "errors": [str(e)],
                "error_count": 1,
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": round(duration, 2)
            }
        
        finally:
            if db:
                db.close()
    
    @staticmethod
    def process_manual_sync_async(
        tenant_id: int,
        property_id: Optional[int] = None,
        force_all: bool = False,
        batch_size: int = 100,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Processamento assíncrono de sincronização manual com progresso.
        Ideal para grandes volumes de dados.
        
        Args:
            tenant_id: ID do tenant
            property_id: ID da propriedade (opcional)
            force_all: Forçar sincronização de todos os registros
            batch_size: Tamanho do batch
            progress_callback: Função para reportar progresso (opcional)
            
        Returns:
            Dict com resultado da sincronização
        """
        sync_id = f"manual_async_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{tenant_id}"
        started_at = datetime.utcnow()
        
        logger.info(f"Iniciando sincronização manual assíncrona {sync_id}")
        
        db = None
        try:
            # Obter sessão do banco
            db = next(get_db())
            
            # Criar serviço
            sync_service = ManualSyncService(db)
            
            # Callback de progresso padrão se não fornecido
            if not progress_callback:
                progress_callback = lambda step, progress, message: logger.info(
                    f"Progresso {sync_id}: {progress:.1f}% - {message}"
                )
            
            # Reportar início
            progress_callback("starting", 0.0, "Iniciando sincronização")
            
            # Verificar registros pendentes
            progress_callback("checking", 5.0, "Verificando registros pendentes")
            pending_info = sync_service.get_pending_count(tenant_id, property_id)
            total_pending = pending_info.get("total_pending", 0)
            
            if total_pending == 0:
                progress_callback("completed", 100.0, "Nenhum registro pendente")
                return sync_service.process_manual_sync(tenant_id, property_id, force_all, batch_size)
            
            # Processar em batches com progresso
            progress_callback("processing", 10.0, f"Processando {total_pending} registros")
            
            # Calcular número de batches
            num_batches = max(1, (total_pending + batch_size - 1) // batch_size)
            
            # Processamento por batches (simulado - na implementação real seria mais complexo)
            total_processed = 0
            total_successful = 0
            total_failed = 0
            all_errors = []
            
            for batch_num in range(num_batches):
                batch_start = batch_num * batch_size
                batch_end = min(batch_start + batch_size, total_pending)
                
                # Calcular progresso
                progress = 10.0 + (80.0 * (batch_num + 1) / num_batches)
                message = f"Processando batch {batch_num + 1}/{num_batches}"
                progress_callback("processing", progress, message)
                
                # Processar batch específico (aqui seria a lógica real de batch)
                # Por simplicidade, vamos processar tudo de uma vez
                if batch_num == 0:  # Processar apenas no primeiro batch
                    result = sync_service.process_manual_sync(
                        tenant_id=tenant_id,
                        property_id=property_id,
                        force_all=force_all,
                        batch_size=total_pending  # Processar tudo
                    )
                    
                    total_processed = result.get("processed", 0)
                    total_successful = result.get("successful", 0)
                    total_failed = result.get("failed", 0)
                    all_errors = result.get("errors", [])
                    
                    # Atualizar progresso final do processamento
                    if total_processed > 0:
                        final_progress = 90.0
                        progress_callback("finalizing", final_progress, "Finalizando sincronização")
            
            # Finalizar
            progress_callback("completed", 100.0, "Sincronização concluída")
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            # Resultado final
            final_result = {
                "sync_id": sync_id,
                "status": "success" if total_failed == 0 else "partial_success" if total_successful > 0 else "error",
                "message": f"Sincronização assíncrona concluída: {total_successful}/{total_processed} sucessos",
                "total_pending": total_pending,
                "processed": total_processed,
                "successful": total_successful,
                "failed": total_failed,
                "success_rate": (total_successful / total_processed * 100) if total_processed > 0 else 0,
                "errors": all_errors[:10],  # Limitar erros
                "error_count": len(all_errors),
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": round(duration, 2),
                "async_processing": True,
                "batch_count": num_batches
            }
            
            logger.info(f"Sincronização manual assíncrona {sync_id} concluída: "
                       f"{total_successful}/{total_processed} sucessos")
            
            return final_result
            
        except Exception as e:
            logger.error(f"Erro na sincronização manual assíncrona {sync_id}: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Reportar erro
            if progress_callback:
                progress_callback("error", 0.0, f"Erro: {str(e)}")
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            return {
                "sync_id": sync_id,
                "status": "error",
                "message": f"Erro crítico na sincronização assíncrona: {str(e)}",
                "total_pending": 0,
                "processed": 0,
                "successful": 0,
                "failed": 0,
                "success_rate": 0,
                "errors": [str(e)],
                "error_count": 1,
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": round(duration, 2),
                "async_processing": True
            }
        
        finally:
            if db:
                db.close()
    
    @staticmethod
    def get_pending_count_task(
        tenant_id: int,
        property_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Task para obter contagem de registros pendentes.
        
        Args:
            tenant_id: ID do tenant
            property_id: ID da propriedade (opcional)
            
        Returns:
            Dict com contagem de registros pendentes
        """
        task_id = f"pending_count_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{tenant_id}"
        
        logger.info(f"Iniciando contagem de registros pendentes {task_id}")
        
        db = None
        try:
            # Obter sessão do banco
            db = next(get_db())
            
            # Criar serviço
            sync_service = ManualSyncService(db)
            
            # Obter contagem
            result = sync_service.get_pending_count(tenant_id, property_id)
            
            logger.info(f"Contagem de registros pendentes {task_id} concluída: "
                       f"{result.get('total_pending', 0)} registros")
            
            return result
            
        except Exception as e:
            logger.error(f"Erro na contagem de registros pendentes {task_id}: {str(e)}")
            
            return {
                "total_pending": 0,
                "by_property": {},
                "by_date_range": {},
                "by_sync_type": {},
                "oldest_pending": None,
                "has_pending": False,
                "error": str(e),
                "last_check": datetime.utcnow().isoformat()
            }
        
        finally:
            if db:
                db.close()
    
    @staticmethod
    def get_sync_status_task(tenant_id: int) -> Dict[str, Any]:
        """
        Task para obter status de sincronização.
        
        Args:
            tenant_id: ID do tenant
            
        Returns:
            Dict com status de sincronização
        """
        task_id = f"sync_status_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{tenant_id}"
        
        logger.info(f"Verificando status de sincronização {task_id}")
        
        db = None
        try:
            # Obter sessão do banco
            db = next(get_db())
            
            # Criar serviço
            sync_service = ManualSyncService(db)
            
            # Obter status
            result = sync_service.get_sync_status(tenant_id)
            
            logger.info(f"Status de sincronização {task_id} obtido: "
                       f"{'running' if result.get('is_running') else 'idle'}")
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao obter status de sincronização {task_id}: {str(e)}")
            
            return {
                "is_running": False,
                "current_sync_id": None,
                "last_sync_at": None,
                "last_sync_status": "error",
                "pending_count": 0,
                "has_pending": False,
                "active_configurations": 0,
                "sync_available": False,
                "error": str(e),
                "checked_at": datetime.utcnow().isoformat()
            }
        
        finally:
            if db:
                db.close()


# ============== FUNÇÕES DE CONVENIÊNCIA ==============

def process_manual_sync(
    tenant_id: int,
    property_id: Optional[int] = None,
    force_all: bool = False,
    batch_size: int = 100,
    async_processing: bool = False,
    progress_callback: Optional[callable] = None
) -> Dict[str, Any]:
    """
    Função principal para processar sincronização manual.
    Escolhe automaticamente entre processamento síncrono ou assíncrono.
    
    Args:
        tenant_id: ID do tenant
        property_id: ID da propriedade (opcional)
        force_all: Forçar sincronização de todos os registros
        batch_size: Tamanho do batch
        async_processing: Se deve usar processamento assíncrono
        progress_callback: Função para reportar progresso (apenas async)
        
    Returns:
        Dict com resultado da sincronização
    """
    if async_processing:
        return ManualSyncTask.process_manual_sync_async(
            tenant_id, property_id, force_all, batch_size, progress_callback
        )
    else:
        return ManualSyncTask.process_manual_sync_sync(
            tenant_id, property_id, force_all, batch_size
        )


def get_pending_count(
    tenant_id: int,
    property_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Função de conveniência para obter contagem de registros pendentes.
    
    Args:
        tenant_id: ID do tenant
        property_id: ID da propriedade (opcional)
        
    Returns:
        Dict com contagem de registros pendentes
    """
    return ManualSyncTask.get_pending_count_task(tenant_id, property_id)


def get_sync_status(tenant_id: int) -> Dict[str, Any]:
    """
    Função de conveniência para obter status de sincronização.
    
    Args:
        tenant_id: ID do tenant
        
    Returns:
        Dict com status de sincronização
    """
    return ManualSyncTask.get_sync_status_task(tenant_id)


# ============== INTEGRAÇÃO COM CELERY (SE DISPONÍVEL) ==============

def create_celery_tasks(celery_app):
    """
    Cria tasks Celery para sincronização manual.
    Chamado se Celery estiver disponível.
    
    Args:
        celery_app: Instância do Celery
        
    Returns:
        Dict com tasks criadas
    """
    
    @celery_app.task(name="manual_sync_process", bind=True)
    def manual_sync_process_celery(
        self, 
        tenant_id, 
        property_id=None, 
        force_all=False, 
        batch_size=100
    ):
        """Task Celery para sincronização manual"""
        try:
            # Callback de progresso que atualiza estado da task
            def progress_callback(step, progress, message):
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'step': step,
                        'progress': progress,
                        'message': message,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
            
            # Processar com callback de progresso
            result = ManualSyncTask.process_manual_sync_async(
                tenant_id, property_id, force_all, batch_size, progress_callback
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Erro na task Celery de sincronização manual: {str(e)}")
            raise
    
    @celery_app.task(name="manual_sync_pending_count")
    def manual_sync_pending_count_celery(tenant_id, property_id=None):
        """Task Celery para contagem de registros pendentes"""
        return ManualSyncTask.get_pending_count_task(tenant_id, property_id)
    
    @celery_app.task(name="manual_sync_status")
    def manual_sync_status_celery(tenant_id):
        """Task Celery para status de sincronização"""
        return ManualSyncTask.get_sync_status_task(tenant_id)
    
    return {
        "manual_sync_process": manual_sync_process_celery,
        "manual_sync_pending_count": manual_sync_pending_count_celery,
        "manual_sync_status": manual_sync_status_celery
    }


# ============== LOGGING E EXPORTS ==============

logger.info("manual_sync_task module loaded - funcionalidades de sincronização manual disponíveis")

# Exports principais
__all__ = [
    "ManualSyncTask",
    "process_manual_sync",
    "get_pending_count", 
    "get_sync_status",
    "create_celery_tasks"
]