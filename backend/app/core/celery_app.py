# backend/app/core/celery_app.py

import os
import logging
from typing import Any, Dict, Optional
from celery import Celery, Task
from celery.schedules import crontab
from kombu import Queue
from datetime import timedelta

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """
    Base task que garante conexão com database.
    Usado para tasks que precisam acessar o banco de dados.
    """
    _db = None

    @property
    def db(self):
        if self._db is None:
            self._db = next(get_db())
        return self._db

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        """Limpa conexão após execução da task"""
        if self._db is not None:
            self._db.close()
            self._db = None


def create_celery_app() -> Celery:
    """Cria e configura aplicação Celery"""
    
    # Configuração do broker
    broker_url = getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0')
    result_backend = getattr(settings, 'CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
    
    # Criar app Celery
    celery_app = Celery(
        "pms_channel_manager",
        broker=broker_url,
        backend=result_backend,
        include=[
            'app.tasks.wubook_sync_tasks',
            'app.tasks.availability_sync_job',
            'app.core.celery_app'  # Para tasks definidas neste arquivo
        ]
    )
    
    # Configurações gerais
    celery_app.conf.update(
        # Timezone
        timezone='UTC',
        enable_utc=True,
        
        # Serialização
        task_serializer='json',
        result_serializer='json',
        accept_content=['json'],
        
        # Resultados
        result_expires=3600,  # 1 hora
        result_backend_transport_options={
            'master_name': 'mymaster',
            'visibility_timeout': 3600,
        },
        
        # Tasks
        task_track_started=True,
        task_time_limit=30 * 60,  # 30 minutos timeout máximo
        task_soft_time_limit=25 * 60,  # 25 minutos soft timeout
        worker_prefetch_multiplier=1,
        
        # Retry
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        task_default_retry_delay=60,  # 1 minuto
        task_max_retries=3,
        
        # Worker
        worker_max_tasks_per_child=1000,
        worker_disable_rate_limits=False,
        
        # Monitoring
        worker_send_task_events=True,
        task_send_sent_event=True,
        
        # Logs
        worker_log_format="[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
        worker_task_log_format="[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s",
        
        # Security
        worker_hijack_root_logger=False,
        worker_log_color=False,
    )
    
    # Configurar filas
    celery_app.conf.task_routes = {
        # Sync tasks - alta prioridade
        'sync_all_availability': {'queue': 'sync_priority'},
        'sync_specific_configuration': {'queue': 'sync_priority'},
        'sync_incremental_availability': {'queue': 'sync_priority'},
        
        # Background tasks - prioridade normal
        'cleanup_old_sync_logs': {'queue': 'background'},
        'health_check_configurations': {'queue': 'background'},
        'retry_failed_syncs': {'queue': 'background'},
        
        # Heavy tasks - prioridade baixa
        'full_sync_availability': {'queue': 'heavy'},
        'bulk_operations': {'queue': 'heavy'},
        
        # Monitoring tasks
        'monitor_sync_health': {'queue': 'monitoring'},
        'generate_reports': {'queue': 'monitoring'},
    }
    
    # Definir filas
    celery_app.conf.task_default_queue = 'default'
    celery_app.conf.task_queues = (
        Queue('default', routing_key='default'),
        Queue('sync_priority', routing_key='sync_priority'),
        Queue('background', routing_key='background'),
        Queue('heavy', routing_key='heavy'),
        Queue('monitoring', routing_key='monitoring'),
    )
    
    # Configurar beat schedule (tarefas agendadas)
    celery_app.conf.beat_schedule = {
        # Sincronização incremental a cada 15 minutos
        'sync-incremental-every-15min': {
            'task': 'sync_incremental_availability',
            'schedule': crontab(minute='*/15'),  # A cada 15 minutos
            'options': {'queue': 'sync_priority'},
            'kwargs': {
                'max_configurations': 10,
                'max_pending_items': 500
            }
        },
        
        # Sincronização completa diária às 2h
        'sync-full-daily': {
            'task': 'sync_full_availability',
            'schedule': crontab(hour=2, minute=0),  # 2:00 AM
            'options': {'queue': 'heavy'},
            'kwargs': {
                'days_ahead': 60,
                'days_back': 1,
                'force_all': False
            }
        },
        
        # Health check a cada 30 minutos
        'health-check-every-30min': {
            'task': 'health_check_configurations',
            'schedule': crontab(minute='*/30'),
            'options': {'queue': 'monitoring'}
        },
        
        # Retry de erros a cada 4 horas
        'retry-failed-every-4h': {
            'task': 'retry_failed_syncs',
            'schedule': crontab(minute=0, hour='*/4'),
            'options': {'queue': 'background'},
            'kwargs': {
                'max_retries': 3,
                'max_items': 200
            }
        },
        
        # Limpeza de logs antigos - diário às 3h
        'cleanup-logs-daily': {
            'task': 'cleanup_old_sync_logs',
            'schedule': crontab(hour=3, minute=0),  # 3:00 AM
            'options': {'queue': 'background'},
            'kwargs': {
                'days_to_keep': 90
            }
        },
        
        # Relatório de saúde semanal
        'weekly-health-report': {
            'task': 'generate_weekly_health_report',
            'schedule': crontab(hour=6, minute=0, day_of_week=1),  # Segunda 6h
            'options': {'queue': 'monitoring'}
        },
        
        # Verificação de configurações órfãs - diário
        'check-orphan-configurations': {
            'task': 'check_orphan_configurations',
            'schedule': crontab(hour=4, minute=30),  # 4:30 AM
            'options': {'queue': 'background'}
        }
    }
    
    return celery_app


# Criar instância global
celery_app = create_celery_app()


# ============== TASKS ESPECÍFICAS ==============

@celery_app.task(bind=True, base=DatabaseTask, name='sync_incremental_availability')
def sync_incremental_availability(
    self, 
    tenant_id: Optional[int] = None,
    configuration_id: Optional[int] = None,
    max_configurations: int = 10,
    max_pending_items: int = 500
):
    """Task para sincronização incremental"""
    try:
        from app.tasks.availability_sync_job import AvailabilitySyncJob
        
        logger.info(f"Iniciando sync incremental: tenant={tenant_id}, config={configuration_id}")
        
        with AvailabilitySyncJob(self.db) as job:
            result = job.run_incremental_sync(
                tenant_id=tenant_id,
                configuration_id=configuration_id,
                max_pending_items=max_pending_items
            )
        
        logger.info(f"Sync incremental concluída: {result.get('message', 'OK')}")
        return result
        
    except Exception as e:
        logger.error(f"Erro na sync incremental: {str(e)}")
        raise self.retry(countdown=60, max_retries=3, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='sync_full_availability')
def sync_full_availability(
    self,
    tenant_id: Optional[int] = None,
    configuration_id: Optional[int] = None,
    days_ahead: int = 30,
    days_back: int = 1,
    force_all: bool = False
):
    """Task para sincronização completa"""
    try:
        from app.tasks.availability_sync_job import AvailabilitySyncJob
        
        logger.info(f"Iniciando sync completa: tenant={tenant_id}, config={configuration_id}")
        
        with AvailabilitySyncJob(self.db) as job:
            result = job.run_full_sync(
                tenant_id=tenant_id,
                configuration_id=configuration_id,
                days_ahead=days_ahead,
                days_back=days_back,
                force_all=force_all
            )
        
        logger.info(f"Sync completa concluída: {result.get('message', 'OK')}")
        return result
        
    except Exception as e:
        logger.error(f"Erro na sync completa: {str(e)}")
        raise self.retry(countdown=180, max_retries=2, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='sync_specific_configuration')
def sync_specific_configuration(
    self,
    configuration_id: int,
    tenant_id: int,
    sync_direction: str = "bidirectional",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    room_ids: Optional[list] = None
):
    """Task para sincronização de configuração específica"""
    try:
        from app.tasks.wubook_sync_tasks import WuBookSyncTasks
        
        logger.info(f"Iniciando sync específica: config={configuration_id}")
        
        result = WuBookSyncTasks.sync_specific_configuration_task(
            configuration_id=configuration_id,
            tenant_id=tenant_id,
            sync_direction=sync_direction,
            date_from=date_from,
            date_to=date_to,
            room_ids=room_ids
        )
        
        logger.info(f"Sync específica concluída: {result.get('message', 'OK')}")
        return result
        
    except Exception as e:
        logger.error(f"Erro na sync específica: {str(e)}")
        raise self.retry(countdown=120, max_retries=3, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='health_check_configurations')
def health_check_configurations(self):
    """Task para verificação de saúde das configurações"""
    try:
        from app.tasks.wubook_sync_tasks import WuBookSyncTasks
        
        logger.info("Iniciando health check de configurações")
        
        result = WuBookSyncTasks.health_check_configurations_task()
        
        # Log resultados importantes
        total_configs = result.get('total_configurations', 0)
        healthy_configs = result.get('healthy_configurations', 0)
        health_rate = result.get('health_rate', 0)
        
        logger.info(f"Health check concluído: {healthy_configs}/{total_configs} saudáveis ({health_rate:.1f}%)")
        
        # Alertar se taxa de saúde muito baixa
        if health_rate < 50:
            logger.error(f"ALERTA: Taxa de saúde muito baixa: {health_rate:.1f}%")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro no health check: {str(e)}")
        raise self.retry(countdown=300, max_retries=2, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='retry_failed_syncs')
def retry_failed_syncs(self, max_retries: int = 3, max_items: int = 100):
    """Task para retentar sincronizações com falha"""
    try:
        from app.tasks.wubook_sync_tasks import WuBookSyncTasks
        
        logger.info(f"Iniciando retry de sync com falha: max_items={max_items}")
        
        result = WuBookSyncTasks.retry_failed_syncs_task(
            max_retries=max_retries,
            max_items=max_items
        )
        
        processed = result.get('items_processed', 0)
        success = result.get('items_success', 0)
        failed = result.get('items_failed', 0)
        
        logger.info(f"Retry concluído: {success}/{processed} sucessos, {failed} falhas")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro no retry: {str(e)}")
        raise self.retry(countdown=240, max_retries=2, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='cleanup_old_sync_logs')
def cleanup_old_sync_logs(self, days_to_keep: int = 90):
    """Task para limpeza de logs antigos"""
    try:
        from app.tasks.wubook_sync_tasks import WuBookSyncTasks
        
        logger.info(f"Iniciando limpeza de logs antigos: mantendo {days_to_keep} dias")
        
        result = WuBookSyncTasks.cleanup_old_sync_logs_task(days_to_keep)
        
        deleted_count = result.get('deleted_count', 0)
        logger.info(f"Limpeza concluída: {deleted_count} logs removidos")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro na limpeza: {str(e)}")
        raise self.retry(countdown=120, max_retries=2, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='generate_weekly_health_report')
def generate_weekly_health_report(self):
    """Task para gerar relatório semanal de saúde"""
    try:
        from app.tasks.availability_sync_job import AvailabilitySyncJob
        from datetime import datetime, timedelta
        
        logger.info("Gerando relatório semanal de saúde")
        
        # Buscar todos os tenants ativos
        from app.models.wubook_configuration import WuBookConfiguration
        
        tenants = self.db.query(WuBookConfiguration.tenant_id).distinct().all()
        
        reports = []
        
        for (tenant_id,) in tenants:
            try:
                with AvailabilitySyncJob(self.db) as job:
                    health_status = job.get_sync_health_status(tenant_id=tenant_id)
                
                reports.append({
                    'tenant_id': tenant_id,
                    'health_status': health_status.get('health_status', 'unknown'),
                    'sync_rate': health_status.get('sync_rate', 0),
                    'error_rate': health_status.get('error_rate', 0),
                    'recommendations': health_status.get('recommendations', [])
                })
                
            except Exception as e:
                logger.error(f"Erro ao gerar relatório para tenant {tenant_id}: {str(e)}")
                reports.append({
                    'tenant_id': tenant_id,
                    'error': str(e)
                })
        
        result = {
            'generated_at': datetime.utcnow().isoformat(),
            'total_tenants': len(tenants),
            'reports': reports,
            'summary': {
                'healthy_tenants': len([r for r in reports if r.get('health_status') == 'healthy']),
                'warning_tenants': len([r for r in reports if r.get('health_status') == 'warning']),
                'critical_tenants': len([r for r in reports if r.get('health_status') == 'critical']),
                'error_tenants': len([r for r in reports if 'error' in r])
            }
        }
        
        logger.info(f"Relatório semanal gerado para {len(tenants)} tenants")
        
        # Aqui poderia enviar por email, salvar em arquivo, etc.
        # Por enquanto só retorna o resultado
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório semanal: {str(e)}")
        raise self.retry(countdown=600, max_retries=1, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='check_orphan_configurations')
def check_orphan_configurations(self):
    """Task para verificar configurações órfãs (sem mapeamentos)"""
    try:
        from app.models.wubook_configuration import WuBookConfiguration
        from app.models.wubook_room_mapping import WuBookRoomMapping
        from sqlalchemy import and_
        
        logger.info("Verificando configurações órfãs")
        
        # Buscar configurações sem mapeamentos
        orphan_configs = self.db.query(WuBookConfiguration).outerjoin(
            WuBookRoomMapping,
            and_(
                WuBookRoomMapping.configuration_id == WuBookConfiguration.id,
                WuBookRoomMapping.is_active == True
            )
        ).filter(
            WuBookConfiguration.is_active == True,
            WuBookRoomMapping.id.is_(None)
        ).all()
        
        orphan_count = len(orphan_configs)
        
        # Log configurações órfãs
        for config in orphan_configs:
            logger.warning(
                f"Configuração órfã encontrada: ID={config.id}, "
                f"Property={config.wubook_property_name}, Tenant={config.tenant_id}"
            )
        
        result = {
            'orphan_configurations_count': orphan_count,
            'orphan_configurations': [
                {
                    'id': config.id,
                    'property_name': config.wubook_property_name,
                    'tenant_id': config.tenant_id,
                    'created_at': config.created_at.isoformat() if config.created_at else None
                }
                for config in orphan_configs
            ]
        }
        
        if orphan_count > 0:
            logger.warning(f"Encontradas {orphan_count} configurações órfãs")
        else:
            logger.info("Nenhuma configuração órfã encontrada")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao verificar configurações órfãs: {str(e)}")
        raise self.retry(countdown=300, max_retries=2, exc=e)


@celery_app.task(bind=True, base=DatabaseTask, name='bulk_availability_update')
def bulk_availability_update(
    self,
    tenant_id: int,
    room_ids: list,
    date_from: str,
    date_to: str,
    update_data: dict,
    sync_immediately: bool = True
):
    """Task para atualização em massa de disponibilidade"""
    try:
        from app.services.room_availability_service import RoomAvailabilityService
        from app.schemas.room_availability import BulkAvailabilityUpdate
        from datetime import datetime
        
        logger.info(f"Iniciando bulk update: {len(room_ids)} quartos, período {date_from} a {date_to}")
        
        # Converter datas
        date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
        date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
        
        # Criar request
        bulk_request = BulkAvailabilityUpdate(
            room_ids=room_ids,
            date_from=date_from_obj,
            date_to=date_to_obj,
            **update_data
        )
        
        # Executar atualização
        availability_service = RoomAvailabilityService(self.db)
        result = availability_service.bulk_update_availability(
            bulk_request,
            tenant_id,
            mark_for_sync=sync_immediately
        )
        
        # Sincronizar se solicitado
        if sync_immediately and result.get('created', 0) + result.get('updated', 0) > 0:
            try:
                # Executar sync incremental
                sync_result = sync_incremental_availability.delay(
                    tenant_id=tenant_id
                )
                result['sync_task_id'] = sync_result.id
            except Exception as e:
                logger.warning(f"Erro ao iniciar sync após bulk update: {str(e)}")
                result['sync_error'] = str(e)
        
        processed = result.get('total_processed', 0)
        logger.info(f"Bulk update concluído: {processed} itens processados")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro no bulk update: {str(e)}")
        raise self.retry(countdown=60, max_retries=2, exc=e)


# ============== MONITORING E CALLBACKS ==============

@celery_app.task(bind=True, name='monitor_sync_health')
def monitor_sync_health(self):
    """Task para monitorar saúde geral do sistema"""
    try:
        from app.tasks.availability_sync_job import AvailabilitySyncJob
        from app.models.wubook_configuration import WuBookConfiguration
        
        # Buscar todas as configurações ativas
        db = next(get_db())
        try:
            configs = db.query(WuBookConfiguration).filter(
                WuBookConfiguration.is_active == True
            ).all()
            
            if not configs:
                return {"message": "Nenhuma configuração ativa encontrada"}
            
            # Verificar saúde por tenant
            health_by_tenant = {}
            
            for config in configs:
                tenant_id = config.tenant_id
                
                if tenant_id not in health_by_tenant:
                    try:
                        with AvailabilitySyncJob(db) as job:
                            health = job.get_sync_health_status(tenant_id=tenant_id)
                        
                        health_by_tenant[tenant_id] = health
                        
                    except Exception as e:
                        logger.error(f"Erro ao verificar saúde do tenant {tenant_id}: {str(e)}")
                        health_by_tenant[tenant_id] = {"error": str(e)}
            
            # Calcular estatísticas globais
            total_tenants = len(health_by_tenant)
            healthy_tenants = len([h for h in health_by_tenant.values() if h.get('health_status') == 'healthy'])
            warning_tenants = len([h for h in health_by_tenant.values() if h.get('health_status') == 'warning'])
            critical_tenants = len([h for h in health_by_tenant.values() if h.get('health_status') == 'critical'])
            
            # Determinar status global
            if critical_tenants > 0:
                global_status = 'critical'
            elif warning_tenants > healthy_tenants:
                global_status = 'warning'
            else:
                global_status = 'healthy'
            
            result = {
                'global_status': global_status,
                'total_tenants': total_tenants,
                'healthy_tenants': healthy_tenants,
                'warning_tenants': warning_tenants,
                'critical_tenants': critical_tenants,
                'health_by_tenant': health_by_tenant,
                'checked_at': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Health check global: {global_status} - {healthy_tenants}/{total_tenants} saudáveis")
            
            return result
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Erro no monitor de saúde: {str(e)}")
        return {"error": str(e)}


# ============== CALLBACKS E SIGNALS ==============

@celery_app.task(bind=True)
def task_failure_handler(self, task_id, error, einfo):
    """Handler para falhas de tasks"""
    logger.error(f"Task {task_id} falhou: {error}")
    
    # Aqui poderia:
    # - Enviar notificação
    # - Salvar em log especial
    # - Alertar administradores
    # - Etc.


# Registrar handler de falha
@celery_app.signals.task_failure.connect
def task_failure_signal(sender=None, task_id=None, exception=None, einfo=None, **kwargs):
    """Signal para capturar falhas de tasks"""
    logger.error(f"Task failure signal: {task_id} - {exception}")


# ============== UTILITÁRIOS ==============

def get_celery_app() -> Celery:
    """Retorna instância do Celery app"""
    return celery_app


def create_periodic_task(name: str, task: str, schedule, **kwargs):
    """Cria task periódica dinamicamente"""
    celery_app.conf.beat_schedule[name] = {
        'task': task,
        'schedule': schedule,
        **kwargs
    }


def get_task_status(task_id: str) -> Dict[str, Any]:
    """Busca status de uma task"""
    result = celery_app.AsyncResult(task_id)
    
    return {
        'task_id': task_id,
        'status': result.status,
        'result': result.result,
        'traceback': result.traceback,
        'date_done': result.date_done,
        'successful': result.successful(),
        'failed': result.failed()
    }


def cancel_task(task_id: str) -> bool:
    """Cancela uma task"""
    try:
        celery_app.control.revoke(task_id, terminate=True)
        return True
    except Exception as e:
        logger.error(f"Erro ao cancelar task {task_id}: {str(e)}")
        return False


def get_active_tasks() -> List[Dict[str, Any]]:
    """Lista tasks ativas"""
    try:
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active()
        
        if not active_tasks:
            return []
        
        all_tasks = []
        for worker, tasks in active_tasks.items():
            for task in tasks:
                all_tasks.append({
                    'worker': worker,
                    'task_id': task['id'],
                    'task_name': task['name'],
                    'args': task['args'],
                    'kwargs': task['kwargs'],
                    'time_start': task['time_start']
                })
        
        return all_tasks
        
    except Exception as e:
        logger.error(f"Erro ao buscar tasks ativas: {str(e)}")
        return []


def get_queue_stats() -> Dict[str, Any]:
    """Estatísticas das filas"""
    try:
        inspect = celery_app.control.inspect()
        
        # Tasks ativas
        active = inspect.active()
        active_count = sum(len(tasks) for tasks in active.values()) if active else 0
        
        # Tasks agendadas
        scheduled = inspect.scheduled()
        scheduled_count = sum(len(tasks) for tasks in scheduled.values()) if scheduled else 0
        
        # Workers
        stats = inspect.stats()
        worker_count = len(stats) if stats else 0
        
        return {
            'active_tasks': active_count,
            'scheduled_tasks': scheduled_count,
            'workers': worker_count,
            'queues': list(celery_app.conf.task_queues),
            'beat_schedule_count': len(celery_app.conf.beat_schedule)
        }
        
    except Exception as e:
        logger.error(f"Erro ao buscar estatísticas: {str(e)}")
        return {"error": str(e)}


# Tornar funções disponíveis para import
__all__ = [
    'celery_app',
    'create_celery_app',
    'get_celery_app',
    'get_task_status',
    'cancel_task',
    'get_active_tasks',
    'get_queue_stats',
    'create_periodic_task'
]