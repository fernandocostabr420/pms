# backend/app/tasks/wubook_sync_tasks.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import logging
import traceback

from app.core.database import get_db
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.room_availability import RoomAvailability
from app.services.wubook_availability_sync_service import WuBookAvailabilitySyncService
from app.integrations.wubook.sync_service import WuBookSyncService

logger = logging.getLogger(__name__)


class WuBookSyncTasks:
    """
    Classe para tarefas de sincronização automática com WuBook.
    Pode ser usada com Celery ou outras soluções de background tasks.
    """
    
    @staticmethod
    def sync_all_availability_task(
        max_configurations: int = 10,
        max_days_ahead: int = 30,
        max_days_back: int = 1
    ) -> Dict[str, Any]:
        """
        Task para sincronizar disponibilidade de todas as configurações ativas.
        Executa periodicamente (ex: a cada 15 minutos).
        """
        task_id = f"sync_all_availability_{datetime.utcnow().isoformat()}"
        
        try:
            logger.info(f"Iniciando task de sincronização geral: {task_id}")
            
            results = {
                "task_id": task_id,
                "started_at": datetime.utcnow().isoformat(),
                "configurations_processed": 0,
                "configurations_success": 0,
                "configurations_error": 0,
                "total_synced": 0,
                "errors": []
            }
            
            # Buscar configurações ativas
            db = next(get_db())
            try:
                configurations = db.query(WuBookConfiguration).filter(
                    WuBookConfiguration.is_active == True,
                    WuBookConfiguration.is_connected == True,
                    WuBookConfiguration.sync_enabled == True
                ).limit(max_configurations).all()
                
                if not configurations:
                    results["message"] = "Nenhuma configuração ativa encontrada"
                    return results
                
                # Definir período de sincronização
                date_from = date.today() - timedelta(days=max_days_back)
                date_to = date.today() + timedelta(days=max_days_ahead)
                
                # Processar cada configuração
                for config in configurations:
                    config_result = WuBookSyncTasks._sync_configuration_availability(
                        db, config, date_from, date_to
                    )
                    
                    results["configurations_processed"] += 1
                    
                    if config_result["success"]:
                        results["configurations_success"] += 1
                        results["total_synced"] += config_result.get("synced_count", 0)
                    else:
                        results["configurations_error"] += 1
                        results["errors"].append({
                            "configuration_id": config.id,
                            "property_name": getattr(config, "wubook_property_name", "Unknown"),
                            "error": config_result.get("message", "Erro desconhecido")
                        })
                
                results["completed_at"] = datetime.utcnow().isoformat()
                results["success"] = results["configurations_error"] == 0
                results["message"] = f"Processadas {results['configurations_processed']} configurações"
                
                logger.info(f"Task concluída: {task_id} - {results['message']}")
                
                return results
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Erro na task de sincronização geral: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "task_id": task_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    def _sync_configuration_availability(
        db: Session,
        config: WuBookConfiguration,
        date_from: date,
        date_to: date
    ) -> Dict[str, Any]:
        """Sincroniza disponibilidade de uma configuração específica"""
        
        try:
            sync_service = WuBookAvailabilitySyncService(db)
            
            # Verificar se há disponibilidades pendentes
            pending_count = db.query(RoomAvailability).join(
                WuBookRoomMapping,
                RoomAvailability.room_id == WuBookRoomMapping.room_id
            ).filter(
                WuBookRoomMapping.configuration_id == config.id,
                WuBookRoomMapping.is_active == True,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True,
                RoomAvailability.date >= date_from,
                RoomAvailability.date <= date_to
            ).count()
            
            # Se não há pendências, fazer sync bidirecional leve
            if pending_count == 0:
                result = sync_service.sync_availability_from_wubook(
                    tenant_id=config.tenant_id,
                    configuration_id=config.id,
                    date_from=date_from,
                    date_to=date_to
                )
            else:
                # Se há pendências, fazer sync completo
                result = sync_service.sync_bidirectional_availability(
                    tenant_id=config.tenant_id,
                    configuration_id=config.id,
                    date_from=date_from,
                    date_to=date_to
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar configuração {config.id}: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "synced_count": 0
            }
    
    @staticmethod
    def sync_specific_configuration_task(
        configuration_id: int,
        tenant_id: int,
        sync_direction: str = "bidirectional",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        room_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Task para sincronizar uma configuração específica.
        Usado para sincronização manual ou sob demanda.
        """
        task_id = f"sync_config_{configuration_id}_{datetime.utcnow().isoformat()}"
        
        try:
            logger.info(f"Iniciando sync específica: {task_id}")
            
            # Converter datas se fornecidas
            date_from_obj = None
            date_to_obj = None
            
            if date_from:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
            if date_to:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
            
            db = next(get_db())
            try:
                sync_service = WuBookAvailabilitySyncService(db)
                
                # Executar sincronização baseada na direção
                if sync_direction == "inbound":
                    result = sync_service.sync_availability_from_wubook(
                        tenant_id=tenant_id,
                        configuration_id=configuration_id,
                        room_ids=room_ids,
                        date_from=date_from_obj,
                        date_to=date_to_obj
                    )
                    
                elif sync_direction == "outbound":
                    result = sync_service.sync_availability_to_wubook(
                        tenant_id=tenant_id,
                        configuration_id=configuration_id,
                        room_ids=room_ids,
                        date_from=date_from_obj,
                        date_to=date_to_obj
                    )
                    
                else:  # bidirectional
                    result = sync_service.sync_bidirectional_availability(
                        tenant_id=tenant_id,
                        configuration_id=configuration_id,
                        room_ids=room_ids,
                        date_from=date_from_obj,
                        date_to=date_to_obj
                    )
                
                result["task_id"] = task_id
                result["completed_at"] = datetime.utcnow().isoformat()
                
                logger.info(f"Sync específica concluída: {task_id}")
                
                return result
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Erro na sync específica {configuration_id}: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "task_id": task_id,
                "success": False,
                "error": error_msg,
                "configuration_id": configuration_id,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    def cleanup_old_sync_logs_task(days_to_keep: int = 90) -> Dict[str, Any]:
        """Task para limpeza de logs antigos de sincronização"""
        
        task_id = f"cleanup_logs_{datetime.utcnow().isoformat()}"
        
        try:
            logger.info(f"Iniciando limpeza de logs: {task_id}")
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            db = next(get_db())
            try:
                from app.models.wubook_sync_log import WuBookSyncLog
                
                # Contar logs a serem removidos
                count_query = db.query(WuBookSyncLog).filter(
                    WuBookSyncLog.created_at < cutoff_date
                )
                total_count = count_query.count()
                
                # Remover logs antigos
                deleted_count = count_query.delete(synchronize_session=False)
                db.commit()
                
                result = {
                    "task_id": task_id,
                    "success": True,
                    "deleted_count": deleted_count,
                    "cutoff_date": cutoff_date.isoformat(),
                    "days_kept": days_to_keep,
                    "completed_at": datetime.utcnow().isoformat()
                }
                
                logger.info(f"Limpeza concluída: {deleted_count} logs removidos")
                
                return result
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Erro na limpeza de logs: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "task_id": task_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    def health_check_configurations_task() -> Dict[str, Any]:
        """Task para verificar saúde das configurações WuBook"""
        
        task_id = f"health_check_{datetime.utcnow().isoformat()}"
        
        try:
            logger.info(f"Iniciando health check: {task_id}")
            
            db = next(get_db())
            try:
                results = {
                    "task_id": task_id,
                    "started_at": datetime.utcnow().isoformat(),
                    "total_configurations": 0,
                    "healthy_configurations": 0,
                    "unhealthy_configurations": 0,
                    "issues": []
                }
                
                # Buscar todas as configurações ativas
                configurations = db.query(WuBookConfiguration).filter(
                    WuBookConfiguration.is_active == True
                ).all()
                
                results["total_configurations"] = len(configurations)
                
                for config in configurations:
                    try:
                        # Testar conexão básica
                        sync_service = WuBookSyncService(db)
                        client = sync_service.get_client_for_configuration(config)
                        
                        # Teste simples: buscar quartos
                        rooms = client.fetch_rooms()
                        
                        if rooms:
                            results["healthy_configurations"] += 1
                            
                            # Atualizar status da configuração
                            config.is_connected = True
                            config.connection_status = "connected"
                        else:
                            results["unhealthy_configurations"] += 1
                            results["issues"].append({
                                "configuration_id": config.id,
                                "property_name": getattr(config, "wubook_property_name", "Unknown"),
                                "issue": "No rooms returned from WuBook"
                            })
                            
                            # Atualizar status da configuração
                            config.is_connected = False
                            config.connection_status = "error"
                            config.last_error_at = datetime.utcnow().isoformat()
                            
                    except Exception as e:
                        results["unhealthy_configurations"] += 1
                        results["issues"].append({
                            "configuration_id": config.id,
                            "property_name": getattr(config, "wubook_property_name", "Unknown"),
                            "issue": str(e)
                        })
                        
                        # Atualizar status da configuração
                        config.is_connected = False
                        config.connection_status = "error"
                        config.last_error_at = datetime.utcnow().isoformat()
                        config.error_count += 1
                
                # Commit das atualizações
                db.commit()
                
                results["completed_at"] = datetime.utcnow().isoformat()
                results["success"] = True
                results["health_rate"] = (
                    results["healthy_configurations"] / results["total_configurations"] * 100
                    if results["total_configurations"] > 0 else 0
                )
                
                logger.info(f"Health check concluído: {results['health_rate']:.1f}% saudáveis")
                
                return results
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Erro no health check: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "task_id": task_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    def retry_failed_syncs_task(
        max_retries: int = 3,
        max_items: int = 100
    ) -> Dict[str, Any]:
        """Task para retentar sincronizações com erro"""
        
        task_id = f"retry_failed_{datetime.utcnow().isoformat()}"
        
        try:
            logger.info(f"Iniciando retry de syncs com erro: {task_id}")
            
            db = next(get_db())
            try:
                results = {
                    "task_id": task_id,
                    "started_at": datetime.utcnow().isoformat(),
                    "items_processed": 0,
                    "items_success": 0,
                    "items_failed": 0,
                    "errors": []
                }
                
                # Buscar disponibilidades com erro de sync
                error_availabilities = db.query(RoomAvailability).filter(
                    RoomAvailability.wubook_sync_error.isnot(None),
                    RoomAvailability.is_active == True,
                    RoomAvailability.date >= date.today() - timedelta(days=1),
                    RoomAvailability.date <= date.today() + timedelta(days=30)
                ).limit(max_items).all()
                
                if not error_availabilities:
                    results["message"] = "Nenhuma disponibilidade com erro encontrada"
                    return results
                
                # Agrupar por configuração
                by_config = {}
                for avail in error_availabilities:
                    # Buscar configuração via room mapping
                    mapping = db.query(WuBookRoomMapping).filter(
                        WuBookRoomMapping.room_id == avail.room_id,
                        WuBookRoomMapping.is_active == True
                    ).first()
                    
                    if mapping:
                        config_id = mapping.configuration_id
                        if config_id not in by_config:
                            by_config[config_id] = []
                        by_config[config_id].append(avail)
                
                # Processar por configuração
                sync_service = WuBookAvailabilitySyncService(db)
                
                for config_id, availabilities in by_config.items():
                    try:
                        # Limpar erros e marcar como pendente
                        for avail in availabilities:
                            avail.wubook_sync_error = None
                            avail.sync_pending = True
                        
                        db.commit()
                        
                        # Buscar tenant_id da configuração
                        config = db.query(WuBookConfiguration).filter(
                            WuBookConfiguration.id == config_id
                        ).first()
                        
                        if not config:
                            continue
                        
                        # Tentar sincronizar
                        room_ids = [a.room_id for a in availabilities]
                        
                        result = sync_service.sync_availability_to_wubook(
                            tenant_id=config.tenant_id,
                            configuration_id=config_id,
                            room_ids=room_ids,
                            force_sync_all=True
                        )
                        
                        if result["success"]:
                            results["items_success"] += len(availabilities)
                        else:
                            results["items_failed"] += len(availabilities)
                            results["errors"].append({
                                "configuration_id": config_id,
                                "error": result.get("message", "Unknown error")
                            })
                        
                        results["items_processed"] += len(availabilities)
                        
                    except Exception as e:
                        logger.error(f"Erro ao retentar config {config_id}: {str(e)}")
                        results["items_failed"] += len(availabilities)
                        results["errors"].append({
                            "configuration_id": config_id,
                            "error": str(e)
                        })
                
                results["completed_at"] = datetime.utcnow().isoformat()
                results["success"] = results["items_failed"] == 0
                results["message"] = f"Processados {results['items_processed']} itens"
                
                logger.info(f"Retry concluído: {results['message']}")
                
                return results
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Erro no retry de syncs: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "task_id": task_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }


# Funções para integração com Celery (se usado)
def create_celery_tasks(celery_app):
    """Cria tasks Celery baseadas nas funções estáticas"""
    
    @celery_app.task(name="sync_all_availability")
    def sync_all_availability_celery(max_configurations=10, max_days_ahead=30, max_days_back=1):
        return WuBookSyncTasks.sync_all_availability_task(
            max_configurations, max_days_ahead, max_days_back
        )
    
    @celery_app.task(name="sync_specific_configuration")
    def sync_specific_configuration_celery(
        configuration_id, tenant_id, sync_direction="bidirectional",
        date_from=None, date_to=None, room_ids=None
    ):
        return WuBookSyncTasks.sync_specific_configuration_task(
            configuration_id, tenant_id, sync_direction, date_from, date_to, room_ids
        )
    
    @celery_app.task(name="cleanup_old_sync_logs")
    def cleanup_old_sync_logs_celery(days_to_keep=90):
        return WuBookSyncTasks.cleanup_old_sync_logs_task(days_to_keep)
    
    @celery_app.task(name="health_check_configurations")
    def health_check_configurations_celery():
        return WuBookSyncTasks.health_check_configurations_task()
    
    @celery_app.task(name="retry_failed_syncs")
    def retry_failed_syncs_celery(max_retries=3, max_items=100):
        return WuBookSyncTasks.retry_failed_syncs_task(max_retries, max_items)
    
    return {
        "sync_all_availability": sync_all_availability_celery,
        "sync_specific_configuration": sync_specific_configuration_celery,
        "cleanup_old_sync_logs": cleanup_old_sync_logs_celery,
        "health_check_configurations": health_check_configurations_celery,
        "retry_failed_syncs": retry_failed_syncs_celery
    }