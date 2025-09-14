# backend/app/tasks/availability_sync_job.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
import logging
import traceback
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.database import get_db
from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_sync_log import WuBookSyncLog
from app.services.wubook_availability_sync_service import WuBookAvailabilitySyncService
from app.services.room_availability_service import RoomAvailabilityService

logger = logging.getLogger(__name__)


class AvailabilitySyncJob:
    """
    Job especializado para sincronização de disponibilidade.
    Oferece controle granular e otimizações específicas para availability.
    """
    
    def __init__(self, db: Session = None):
        self.db = db or next(get_db())
        self.sync_service = WuBookAvailabilitySyncService(self.db)
        self.availability_service = RoomAvailabilityService(self.db)
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.db:
            self.db.close()
    
    def run_incremental_sync(
        self,
        tenant_id: Optional[int] = None,
        configuration_id: Optional[int] = None,
        max_pending_items: int = 500,
        batch_size: int = 50
    ) -> Dict[str, Any]:
        """
        Executa sincronização incremental baseada em itens pendentes.
        Ideal para execução frequente (a cada 5-15 minutos).
        """
        job_id = f"incremental_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            logger.info(f"Iniciando sync incremental: {job_id}")
            
            results = {
                "job_id": job_id,
                "job_type": "incremental",
                "started_at": datetime.utcnow().isoformat(),
                "tenant_id": tenant_id,
                "configuration_id": configuration_id,
                "batches_processed": 0,
                "total_synced": 0,
                "total_errors": 0,
                "configurations_processed": [],
                "errors": []
            }
            
            # Buscar configurações a processar
            configs_query = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.is_active == True,
                WuBookConfiguration.is_connected == True,
                WuBookConfiguration.sync_enabled == True
            )
            
            if tenant_id:
                configs_query = configs_query.filter(WuBookConfiguration.tenant_id == tenant_id)
            
            if configuration_id:
                configs_query = configs_query.filter(WuBookConfiguration.id == configuration_id)
            
            configurations = configs_query.all()
            
            if not configurations:
                results["message"] = "Nenhuma configuração ativa encontrada"
                return results
            
            # Processar cada configuração
            for config in configurations:
                config_result = self._process_configuration_incremental(
                    config, max_pending_items, batch_size
                )
                
                results["configurations_processed"].append({
                    "configuration_id": config.id,
                    "property_name": getattr(config, "wubook_property_name", "Unknown"),
                    "result": config_result
                })
                
                results["batches_processed"] += config_result.get("batches_processed", 0)
                results["total_synced"] += config_result.get("synced_count", 0)
                results["total_errors"] += config_result.get("error_count", 0)
                
                if not config_result["success"]:
                    results["errors"].extend(config_result.get("errors", []))
            
            results["completed_at"] = datetime.utcnow().isoformat()
            results["success"] = results["total_errors"] == 0
            results["message"] = f"Processadas {len(configurations)} configurações"
            
            logger.info(f"Sync incremental concluída: {job_id}")
            return results
            
        except Exception as e:
            error_msg = f"Erro no sync incremental: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "job_id": job_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    def _process_configuration_incremental(
        self,
        config: WuBookConfiguration,
        max_pending_items: int,
        batch_size: int
    ) -> Dict[str, Any]:
        """Processa sincronização incremental de uma configuração"""
        
        try:
            # Buscar itens pendentes de sincronização
            pending_query = self.db.query(RoomAvailability).join(Room).join(
                WuBookRoomMapping,
                and_(
                    WuBookRoomMapping.room_id == Room.id,
                    WuBookRoomMapping.configuration_id == config.id,
                    WuBookRoomMapping.is_active == True,
                    WuBookRoomMapping.sync_availability == True
                )
            ).filter(
                RoomAvailability.tenant_id == config.tenant_id,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True,
                RoomAvailability.date >= date.today() - timedelta(days=1),
                RoomAvailability.date <= date.today() + timedelta(days=60)
            ).order_by(RoomAvailability.date, RoomAvailability.room_id)
            
            pending_items = pending_query.limit(max_pending_items).all()
            
            if not pending_items:
                return {
                    "success": True,
                    "message": "Nenhum item pendente",
                    "synced_count": 0,
                    "error_count": 0,
                    "batches_processed": 0
                }
            
            # Processar em lotes
            total_synced = 0
            total_errors = 0
            batches_processed = 0
            errors = []
            
            for i in range(0, len(pending_items), batch_size):
                batch = pending_items[i:i + batch_size]
                
                try:
                    batch_result = self._sync_availability_batch(config, batch)
                    
                    total_synced += batch_result.get("synced_count", 0)
                    total_errors += batch_result.get("error_count", 0)
                    
                    if not batch_result["success"]:
                        errors.extend(batch_result.get("errors", []))
                    
                    batches_processed += 1
                    
                    # Pequena pausa entre lotes para não sobrecarregar
                    if i + batch_size < len(pending_items):
                        import time
                        time.sleep(0.5)
                        
                except Exception as e:
                    logger.error(f"Erro no lote {i//batch_size + 1}: {str(e)}")
                    errors.append(f"Lote {i//batch_size + 1}: {str(e)}")
                    total_errors += len(batch)
            
            return {
                "success": total_errors == 0,
                "message": f"Processados {len(pending_items)} itens em {batches_processed} lotes",
                "synced_count": total_synced,
                "error_count": total_errors,
                "batches_processed": batches_processed,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Erro ao processar configuração {config.id}: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "synced_count": 0,
                "error_count": 0,
                "batches_processed": 0,
                "errors": [str(e)]
            }
    
    def _sync_availability_batch(
        self,
        config: WuBookConfiguration,
        batch: List[RoomAvailability]
    ) -> Dict[str, Any]:
        """Sincroniza um lote de disponibilidades"""
        
        try:
            # Extrair room_ids únicos
            room_ids = list(set(avail.room_id for avail in batch))
            
            # Determinar período
            dates = [avail.date for avail in batch]
            date_from = min(dates)
            date_to = max(dates)
            
            # Executar sincronização
            result = self.sync_service.sync_availability_to_wubook(
                tenant_id=config.tenant_id,
                configuration_id=config.id,
                room_ids=room_ids,
                date_from=date_from,
                date_to=date_to
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar lote: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "synced_count": 0,
                "error_count": len(batch),
                "errors": [str(e)]
            }
    
    def run_full_sync(
        self,
        tenant_id: Optional[int] = None,
        configuration_id: Optional[int] = None,
        days_ahead: int = 30,
        days_back: int = 1,
        force_all: bool = False
    ) -> Dict[str, Any]:
        """
        Executa sincronização completa.
        Ideal para execução menos frequente (diária ou semanal).
        """
        job_id = f"full_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            logger.info(f"Iniciando sync completa: {job_id}")
            
            results = {
                "job_id": job_id,
                "job_type": "full",
                "started_at": datetime.utcnow().isoformat(),
                "tenant_id": tenant_id,
                "configuration_id": configuration_id,
                "days_ahead": days_ahead,
                "days_back": days_back,
                "force_all": force_all,
                "configurations_processed": [],
                "total_synced": 0,
                "total_imported": 0,
                "total_errors": 0,
                "errors": []
            }
            
            # Definir período
            date_from = date.today() - timedelta(days=days_back)
            date_to = date.today() + timedelta(days=days_ahead)
            
            # Buscar configurações
            configs_query = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.is_active == True,
                WuBookConfiguration.is_connected == True
            )
            
            if tenant_id:
                configs_query = configs_query.filter(WuBookConfiguration.tenant_id == tenant_id)
            
            if configuration_id:
                configs_query = configs_query.filter(WuBookConfiguration.id == configuration_id)
            
            configurations = configs_query.all()
            
            if not configurations:
                results["message"] = "Nenhuma configuração encontrada"
                return results
            
            # Processar cada configuração
            for config in configurations:
                config_result = self._process_configuration_full(
                    config, date_from, date_to, force_all
                )
                
                results["configurations_processed"].append({
                    "configuration_id": config.id,
                    "property_name": getattr(config, "wubook_property_name", "Unknown"),
                    "result": config_result
                })
                
                # Somar resultados
                if "from_wubook" in config_result:
                    results["total_imported"] += config_result["from_wubook"].get("imported_count", 0)
                
                if "to_wubook" in config_result:
                    results["total_synced"] += config_result["to_wubook"].get("synced_count", 0)
                
                if not config_result["success"]:
                    results["total_errors"] += 1
                    if "message" in config_result:
                        results["errors"].append({
                            "configuration_id": config.id,
                            "error": config_result["message"]
                        })
            
            results["completed_at"] = datetime.utcnow().isoformat()
            results["success"] = results["total_errors"] == 0
            results["message"] = f"Sync completa de {len(configurations)} configurações"
            
            logger.info(f"Sync completa concluída: {job_id}")
            return results
            
        except Exception as e:
            error_msg = f"Erro no sync completa: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "job_id": job_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    def _process_configuration_full(
        self,
        config: WuBookConfiguration,
        date_from: date,
        date_to: date,
        force_all: bool
    ) -> Dict[str, Any]:
        """Processa sincronização completa de uma configuração"""
        
        try:
            # Executar sincronização bidirecional
            result = self.sync_service.sync_bidirectional_availability(
                tenant_id=config.tenant_id,
                configuration_id=config.id,
                date_from=date_from,
                date_to=date_to
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Erro na sync completa config {config.id}: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def run_room_specific_sync(
        self,
        room_ids: List[int],
        tenant_id: int,
        configuration_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        sync_direction: str = "bidirectional"
    ) -> Dict[str, Any]:
        """
        Executa sincronização específica para quartos selecionados.
        Útil para sincronização sob demanda de quartos específicos.
        """
        job_id = f"room_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            logger.info(f"Iniciando sync específica de quartos: {job_id}")
            
            # Definir período padrão
            if not date_from:
                date_from = date.today()
            if not date_to:
                date_to = date_from + timedelta(days=7)
            
            # Verificar se quartos pertencem ao tenant
            valid_rooms = self.db.query(Room).filter(
                Room.id.in_(room_ids),
                Room.tenant_id == tenant_id,
                Room.is_active == True
            ).all()
            
            if not valid_rooms:
                return {
                    "job_id": job_id,
                    "success": False,
                    "message": "Nenhum quarto válido encontrado",
                    "completed_at": datetime.utcnow().isoformat()
                }
            
            valid_room_ids = [room.id for room in valid_rooms]
            
            # Buscar configurações aplicáveis
            configs_query = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.tenant_id == tenant_id,
                WuBookConfiguration.is_active == True,
                WuBookConfiguration.is_connected == True
            )
            
            if configuration_id:
                configs_query = configs_query.filter(WuBookConfiguration.id == configuration_id)
            
            configurations = configs_query.all()
            
            if not configurations:
                return {
                    "job_id": job_id,
                    "success": False,
                    "message": "Nenhuma configuração encontrada",
                    "completed_at": datetime.utcnow().isoformat()
                }
            
            results = {
                "job_id": job_id,
                "started_at": datetime.utcnow().isoformat(),
                "room_ids": valid_room_ids,
                "sync_direction": sync_direction,
                "configurations_processed": [],
                "total_synced": 0,
                "total_errors": 0
            }
            
            # Processar cada configuração
            for config in configurations:
                try:
                    if sync_direction == "inbound":
                        config_result = self.sync_service.sync_availability_from_wubook(
                            tenant_id=tenant_id,
                            configuration_id=config.id,
                            room_ids=valid_room_ids,
                            date_from=date_from,
                            date_to=date_to
                        )
                    elif sync_direction == "outbound":
                        config_result = self.sync_service.sync_availability_to_wubook(
                            tenant_id=tenant_id,
                            configuration_id=config.id,
                            room_ids=valid_room_ids,
                            date_from=date_from,
                            date_to=date_to
                        )
                    else:  # bidirectional
                        config_result = self.sync_service.sync_bidirectional_availability(
                            tenant_id=tenant_id,
                            configuration_id=config.id,
                            room_ids=valid_room_ids,
                            date_from=date_from,
                            date_to=date_to
                        )
                    
                    results["configurations_processed"].append({
                        "configuration_id": config.id,
                        "result": config_result
                    })
                    
                    if config_result["success"]:
                        results["total_synced"] += config_result.get("synced_count", 0)
                    else:
                        results["total_errors"] += 1
                    
                except Exception as e:
                    logger.error(f"Erro ao processar config {config.id}: {str(e)}")
                    results["total_errors"] += 1
                    results["configurations_processed"].append({
                        "configuration_id": config.id,
                        "error": str(e)
                    })
            
            results["completed_at"] = datetime.utcnow().isoformat()
            results["success"] = results["total_errors"] == 0
            results["message"] = f"Sync específica de {len(valid_room_ids)} quartos"
            
            logger.info(f"Sync específica concluída: {job_id}")
            return results
            
        except Exception as e:
            error_msg = f"Erro no sync específica: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "job_id": job_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    def run_error_recovery_sync(
        self,
        tenant_id: Optional[int] = None,
        configuration_id: Optional[int] = None,
        max_error_age_hours: int = 24,
        max_items: int = 200
    ) -> Dict[str, Any]:
        """
        Executa recuperação de erros de sincronização.
        Tenta novamente itens que falharam recentemente.
        """
        job_id = f"error_recovery_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            logger.info(f"Iniciando recuperação de erros: {job_id}")
            
            # Calcular data limite para erros
            error_cutoff = datetime.utcnow() - timedelta(hours=max_error_age_hours)
            
            # Buscar disponibilidades com erro recente
            error_query = self.db.query(RoomAvailability).filter(
                RoomAvailability.wubook_sync_error.isnot(None),
                RoomAvailability.is_active == True,
                RoomAvailability.updated_at >= error_cutoff,
                RoomAvailability.date >= date.today() - timedelta(days=1),
                RoomAvailability.date <= date.today() + timedelta(days=30)
            )
            
            if tenant_id:
                error_query = error_query.filter(RoomAvailability.tenant_id == tenant_id)
            
            error_items = error_query.limit(max_items).all()
            
            if not error_items:
                return {
                    "job_id": job_id,
                    "success": True,
                    "message": "Nenhum erro recente encontrado",
                    "recovered_count": 0,
                    "completed_at": datetime.utcnow().isoformat()
                }
            
            # Agrupar por configuração
            by_config = {}
            for item in error_items:
                # Buscar configuração via room mapping
                mapping = self.db.query(WuBookRoomMapping).filter(
                    WuBookRoomMapping.room_id == item.room_id,
                    WuBookRoomMapping.is_active == True
                ).first()
                
                if mapping:
                    config_id = mapping.configuration_id
                    if configuration_id and config_id != configuration_id:
                        continue
                    
                    if config_id not in by_config:
                        by_config[config_id] = []
                    by_config[config_id].append(item)
            
            results = {
                "job_id": job_id,
                "started_at": datetime.utcnow().isoformat(),
                "error_age_hours": max_error_age_hours,
                "configurations_processed": [],
                "recovered_count": 0,
                "failed_count": 0
            }
            
            # Processar cada configuração
            for config_id, items in by_config.items():
                try:
                    # Limpar erros e marcar como pendente
                    for item in items:
                        item.wubook_sync_error = None
                        item.sync_pending = True
                    
                    self.db.commit()
                    
                    # Buscar configuração
                    config = self.db.query(WuBookConfiguration).filter(
                        WuBookConfiguration.id == config_id
                    ).first()
                    
                    if not config:
                        continue
                    
                    # Executar sincronização
                    room_ids = [item.room_id for item in items]
                    dates = [item.date for item in items]
                    
                    result = self.sync_service.sync_availability_to_wubook(
                        tenant_id=config.tenant_id,
                        configuration_id=config_id,
                        room_ids=room_ids,
                        date_from=min(dates),
                        date_to=max(dates),
                        force_sync_all=True
                    )
                    
                    if result["success"]:
                        results["recovered_count"] += len(items)
                    else:
                        results["failed_count"] += len(items)
                    
                    results["configurations_processed"].append({
                        "configuration_id": config_id,
                        "items_count": len(items),
                        "result": result
                    })
                    
                except Exception as e:
                    logger.error(f"Erro ao recuperar config {config_id}: {str(e)}")
                    results["failed_count"] += len(items)
            
            results["completed_at"] = datetime.utcnow().isoformat()
            results["success"] = results["failed_count"] == 0
            results["message"] = f"Recuperação: {results['recovered_count']} sucessos, {results['failed_count']} falhas"
            
            logger.info(f"Recuperação de erros concluída: {job_id}")
            return results
            
        except Exception as e:
            error_msg = f"Erro na recuperação: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}")
            
            return {
                "job_id": job_id,
                "success": False,
                "error": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }
    
    def get_sync_health_status(
        self,
        tenant_id: Optional[int] = None,
        configuration_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Retorna status de saúde da sincronização.
        Usado para monitoramento e alertas.
        """
        try:
            # Filtros base
            filters = [RoomAvailability.is_active == True]
            
            if tenant_id:
                filters.append(RoomAvailability.tenant_id == tenant_id)
            
            # Query base para estatísticas
            base_query = self.db.query(RoomAvailability).filter(and_(*filters))
            
            if configuration_id:
                base_query = base_query.join(Room).join(
                    WuBookRoomMapping,
                    and_(
                        WuBookRoomMapping.room_id == Room.id,
                        WuBookRoomMapping.configuration_id == configuration_id,
                        WuBookRoomMapping.is_active == True
                    )
                )
            
            # Período de análise (próximos 30 dias)
            date_filter = and_(
                RoomAvailability.date >= date.today(),
                RoomAvailability.date <= date.today() + timedelta(days=30)
            )
            
            # Estatísticas gerais
            total_items = base_query.filter(date_filter).count()
            
            synced_items = base_query.filter(
                date_filter,
                RoomAvailability.wubook_synced == True
            ).count()
            
            pending_items = base_query.filter(
                date_filter,
                RoomAvailability.sync_pending == True
            ).count()
            
            error_items = base_query.filter(
                date_filter,
                RoomAvailability.wubook_sync_error.isnot(None)
            ).count()
            
            # Últimas sincronizações
            recent_logs = self.db.query(WuBookSyncLog).filter(
                WuBookSyncLog.sync_type == "availability",
                WuBookSyncLog.created_at >= datetime.utcnow() - timedelta(hours=24)
            )
            
            if configuration_id:
                recent_logs = recent_logs.filter(
                    WuBookSyncLog.configuration_id == configuration_id
                )
            
            recent_logs = recent_logs.order_by(WuBookSyncLog.created_at.desc()).limit(10).all()
            
            # Calcular métricas de saúde
            sync_rate = (synced_items / total_items * 100) if total_items > 0 else 0
            error_rate = (error_items / total_items * 100) if total_items > 0 else 0
            pending_rate = (pending_items / total_items * 100) if total_items > 0 else 0
            
            # Determinar status geral
            if error_rate > 10:
                health_status = "critical"
            elif error_rate > 5 or pending_rate > 20:
                health_status = "warning"
            elif sync_rate > 95:
                health_status = "healthy"
            else:
                health_status = "ok"
            
            return {
                "health_status": health_status,
                "sync_rate": round(sync_rate, 2),
                "error_rate": round(error_rate, 2),
                "pending_rate": round(pending_rate, 2),
                "statistics": {
                    "total_items": total_items,
                    "synced_items": synced_items,
                    "pending_items": pending_items,
                    "error_items": error_items
                },
                "recent_activity": {
                    "total_syncs_24h": len(recent_logs),
                    "successful_syncs_24h": len([log for log in recent_logs if log.status == "success"]),
                    "failed_syncs_24h": len([log for log in recent_logs if log.status == "error"]),
                    "last_sync": recent_logs[0].completed_at if recent_logs else None
                },
                "recommendations": self._get_health_recommendations(
                    health_status, error_rate, pending_rate, recent_logs
                ),
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao gerar status de saúde: {str(e)}")
            return {
                "health_status": "unknown",
                "error": str(e),
                "generated_at": datetime.utcnow().isoformat()
            }
    
    def _get_health_recommendations(
        self,
        health_status: str,
        error_rate: float,
        pending_rate: float,
        recent_logs: List[WuBookSyncLog]
    ) -> List[str]:
        """Gera recomendações baseadas no status de saúde"""
        
        recommendations = []
        
        if health_status == "critical":
            recommendations.append("Taxa de erro muito alta - verificar logs de sincronização")
            recommendations.append("Executar job de recuperação de erros")
            
        if error_rate > 5:
            recommendations.append("Verificar conectividade com WuBook")
            recommendations.append("Validar credenciais das configurações")
            
        if pending_rate > 15:
            recommendations.append("Muitos itens pendentes - considerar aumentar frequência de sincronização")
            recommendations.append("Executar sincronização manual para reduzir backlog")
            
        if len(recent_logs) == 0:
            recommendations.append("Nenhuma sincronização recente - verificar se jobs estão executando")
            
        if not recommendations:
            recommendations.append("Sistema funcionando normalmente")
            
        return recommendations


# Função utilitária para criar jobs programados
def create_scheduled_jobs():
    """Retorna configuração de jobs programados recomendada"""
    
    return {
        "incremental_sync": {
            "schedule": "*/15 * * * *",  # A cada 15 minutos
            "function": "AvailabilitySyncJob().run_incremental_sync",
            "description": "Sincronização incremental de disponibilidade",
            "enabled": True
        },
        "full_sync_daily": {
            "schedule": "0 2 * * *",  # 2h da manhã
            "function": "AvailabilitySyncJob().run_full_sync",
            "args": {"days_ahead": 60, "days_back": 1},
            "description": "Sincronização completa diária",
            "enabled": True
        },
        "error_recovery": {
            "schedule": "0 */4 * * *",  # A cada 4 horas
            "function": "AvailabilitySyncJob().run_error_recovery_sync",
            "args": {"max_error_age_hours": 12},
            "description": "Recuperação de erros de sincronização",
            "enabled": True
        },
        "health_check": {
            "schedule": "*/30 * * * *",  # A cada 30 minutos
            "function": "AvailabilitySyncJob().get_sync_health_status",
            "description": "Verificação de saúde da sincronização",
            "enabled": True
        }
    }