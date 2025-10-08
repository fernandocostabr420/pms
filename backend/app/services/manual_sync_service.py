# backend/app/services/manual_sync_service.py

from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import uuid
import traceback

from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.property import Property
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_sync_log import WuBookSyncLog
from app.integrations.wubook.sync_service import WuBookSyncService  # 🔥 MUDANÇA: usar o funcional
from app.utils.decorators import AuditContext

logger = logging.getLogger(__name__)


class ManualSyncService:
    """Serviço para sincronização manual com WuBook"""
    
    def __init__(self, db: Session):
        self.db = db
        self.wubook_sync_service = WuBookSyncService(db)  # 🔥 MUDANÇA: usar o funcional
    
    def get_pending_count(
        self, 
        tenant_id: int, 
        property_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Retorna contagem detalhada de registros pendentes de sincronização
        
        Args:
            tenant_id: ID do tenant
            property_id: ID da propriedade (opcional)
            
        Returns:
            Dict com estatísticas de registros pendentes
        """
        try:
            # Query base para registros pendentes
            base_query = self.db.query(RoomAvailability).join(Room).join(Property).filter(
                Property.tenant_id == tenant_id,
                RoomAvailability.is_active == True,
                RoomAvailability.sync_pending == True
            )
            
            # Filtrar por propriedade se especificado
            if property_id:
                base_query = base_query.filter(Property.id == property_id)
            
            # Contagem total
            total_pending = base_query.count()
            
            # Contagem por propriedade
            by_property = {}
            if not property_id:
                property_counts = self.db.query(
                    Property.id,
                    Property.name,
                    func.count(RoomAvailability.id).label('count')
                ).select_from(Property).join(Room).join(RoomAvailability).filter(
                    Property.tenant_id == tenant_id,
                    RoomAvailability.is_active == True,
                    RoomAvailability.sync_pending == True
                ).group_by(Property.id, Property.name).all()
                
                by_property = {
                    f"{prop.name} (ID: {prop.id})": prop.count 
                    for prop in property_counts
                }
            
            # Contagem por período (próximos 7, 30, 90 dias)
            today = date.today()
            periods = {
                "próximos_7_dias": today + timedelta(days=7),
                "próximos_30_dias": today + timedelta(days=30),
                "próximos_90_dias": today + timedelta(days=90)
            }
            
            by_date_range = {}
            for period_name, end_date in periods.items():
                count = base_query.filter(
                    RoomAvailability.date >= today,
                    RoomAvailability.date <= end_date
                ).count()
                by_date_range[period_name] = count
            
            # Registro mais antigo pendente
            oldest_pending = None
            oldest_record = base_query.order_by(RoomAvailability.created_at).first()
            if oldest_record:
                oldest_pending = oldest_record.created_at
            
            # Contagem por tipo de alteração (baseado nos campos modificados)
            sync_types = {
                "availability_changes": base_query.filter(
                    or_(
                        RoomAvailability.is_available != RoomAvailability.is_blocked,
                        RoomAvailability.is_blocked == True
                    )
                ).count(),
                "price_changes": base_query.filter(
                    RoomAvailability.rate_override.isnot(None)
                ).count(),
                "restriction_changes": base_query.filter(
                    or_(
                        RoomAvailability.min_stay.isnot(None),
                        RoomAvailability.max_stay.isnot(None),
                        RoomAvailability.closed_to_arrival == True,
                        RoomAvailability.closed_to_departure == True
                    )
                ).count()
            }
            
            return {
                "total_pending": total_pending,
                "by_property": by_property,
                "by_date_range": by_date_range,
                "by_sync_type": sync_types,
                "oldest_pending": oldest_pending.isoformat() if oldest_pending else None,
                "has_pending": total_pending > 0,
                "last_check": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter contagem de registros pendentes: {str(e)}")
            logger.error(traceback.format_exc())
            
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
    
    def process_manual_sync(
        self, 
        tenant_id: int, 
        property_id: Optional[int] = None,
        force_all: bool = False,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Processa sincronização manual de todos os registros pendentes
        
        Args:
            tenant_id: ID do tenant
            property_id: ID da propriedade específica (opcional)
            force_all: Forçar sincronização de todos os registros (não apenas pendentes)
            batch_size: Tamanho do batch para processamento
            
        Returns:
            Dict com resultado detalhado da sincronização
        """
        sync_id = f"manual_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{tenant_id}"
        started_at = datetime.utcnow()
        
        logger.info(f"Iniciando sincronização manual {sync_id} para tenant {tenant_id}")
        
        try:
            # Buscar configuração WuBook ativa
            wubook_config = self._get_active_wubook_config(tenant_id, property_id)
            if not wubook_config:
                return self._create_error_result(
                    sync_id, started_at,
                    "Nenhuma configuração WuBook ativa encontrada"
                )
            
            # Buscar registros para sincronizar
            target_records = self._get_sync_target_records(
                tenant_id, property_id, force_all, batch_size
            )
            
            if not target_records:
                return self._create_success_result(
                    sync_id, started_at,
                    "Nenhum registro pendente de sincronização",
                    0, 0, 0, []
                )
            
            logger.info(f"Encontrados {len(target_records)} registros para sincronizar")
            
            # Processar sincronização em batches
            total_processed = 0
            total_successful = 0
            total_failed = 0
            errors = []
            
            # Agrupar por configuração se necessário
            configs_to_sync = [wubook_config] if property_id else self._get_all_active_configs(tenant_id)
            
            for config in configs_to_sync:
                try:
                    # Filtrar registros para esta configuração
                    config_records = self._filter_records_for_config(target_records, config)
                    if not config_records:
                        continue
                    
                    # Processar em batches
                    for i in range(0, len(config_records), batch_size):
                        batch = config_records[i:i + batch_size]
                        
                        batch_result = self._process_sync_batch(config, batch)
                        
                        total_processed += batch_result["processed"]
                        total_successful += batch_result["successful"]
                        total_failed += batch_result["failed"]
                        errors.extend(batch_result["errors"])
                        
                        logger.info(f"Batch {i//batch_size + 1}: "
                                  f"{batch_result['successful']}/{len(batch)} sucessos")
                
                except Exception as e:
                    error_msg = f"Erro na configuração {config.id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    total_failed += len(self._filter_records_for_config(target_records, config))
            
            # Resultado final
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            result = {
                "sync_id": sync_id,
                "status": "success" if total_failed == 0 else "partial_success" if total_successful > 0 else "error",
                "message": f"Sincronização concluída: {total_successful}/{total_processed} sucessos" if total_processed > 0 else "Nenhum registro processado",
                "total_pending": len(target_records),
                "processed": total_processed,
                "successful": total_successful,
                "failed": total_failed,
                "success_rate": (total_successful / total_processed * 100) if total_processed > 0 else 0,
                "errors": errors[:10],  # Limitar a 10 erros
                "error_count": len(errors),
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": round(duration, 2),
                "configurations_processed": len(configs_to_sync),
                "force_all_used": force_all
            }
            
            logger.info(f"Sincronização manual {sync_id} concluída: "
                       f"{total_successful}/{total_processed} sucessos")
            
            return result
            
        except Exception as e:
            logger.error(f"Erro crítico na sincronização manual {sync_id}: {str(e)}")
            logger.error(traceback.format_exc())
            
            return self._create_error_result(sync_id, started_at, str(e))
    
    def get_sync_status(self, tenant_id: int) -> Dict[str, Any]:
        """
        Retorna status atual da sincronização para o tenant
        
        Args:
            tenant_id: ID do tenant
            
        Returns:
            Dict com status de sincronização
        """
        try:
            # Verificar se há alguma sincronização em andamento
            # (Isso seria mais complexo com Celery tasks, por enquanto assumimos que não há)
            is_running = False
            current_sync_id = None
            
            # Buscar última sincronização
            last_sync_log = self.db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
                WuBookConfiguration.tenant_id == tenant_id
            ).order_by(desc(WuBookSyncLog.started_at)).first()
            
            last_sync_at = None
            last_sync_status = None
            if last_sync_log:
                last_sync_at = last_sync_log.started_at
                last_sync_status = last_sync_log.status
            
            # Contar registros pendentes
            pending_count_result = self.get_pending_count(tenant_id)
            pending_count = pending_count_result.get("total_pending", 0)
            
            # Verificar configurações ativas
            active_configs = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.tenant_id == tenant_id,
                WuBookConfiguration.is_active == True,
                WuBookConfiguration.is_connected == True
            ).count()
            
            return {
                "is_running": is_running,
                "current_sync_id": current_sync_id,
                "last_sync_at": last_sync_at if last_sync_at else None,  # 🔥 CORREÇÃO AQUI: removido .isoformat()
                "last_sync_status": last_sync_status,
                "pending_count": pending_count,
                "has_pending": pending_count > 0,
                "active_configurations": active_configs,
                "sync_available": active_configs > 0,
                "checked_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter status de sincronização: {str(e)}")
            
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
    
    # ============== MÉTODOS PRIVADOS ==============
    
    def _get_active_wubook_config(
        self, 
        tenant_id: int, 
        property_id: Optional[int] = None
    ) -> Optional[WuBookConfiguration]:
        """Busca configuração WuBook ativa"""
        query = self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == tenant_id,
            WuBookConfiguration.is_active == True,
            WuBookConfiguration.is_connected == True
        )
        
        if property_id:
            query = query.filter(WuBookConfiguration.property_id == property_id)
        
        return query.first()
    
    def _get_all_active_configs(self, tenant_id: int) -> List[WuBookConfiguration]:
        """Busca todas as configurações ativas do tenant"""
        return self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == tenant_id,
            WuBookConfiguration.is_active == True,
            WuBookConfiguration.is_connected == True
        ).all()
    
    def _get_sync_target_records(
        self, 
        tenant_id: int, 
        property_id: Optional[int], 
        force_all: bool, 
        limit: int
    ) -> List[RoomAvailability]:
        """Busca registros alvo para sincronização"""
        query = self.db.query(RoomAvailability).options(
            joinedload(RoomAvailability.room).joinedload(Room.property_obj)
        ).join(Room).join(Property).filter(
            Property.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        )
        
        # Filtrar por propriedade
        if property_id:
            query = query.filter(Property.id == property_id)
        
        # Filtrar por pendentes ou todos
        if not force_all:
            query = query.filter(RoomAvailability.sync_pending == True)
        
        # Ordenar por data e prioridade
        query = query.order_by(
            RoomAvailability.date,
            RoomAvailability.created_at
        )
        
        return query.limit(limit).all()
    
    def _filter_records_for_config(
        self, 
        records: List[RoomAvailability], 
        config: WuBookConfiguration
    ) -> List[RoomAvailability]:
        """Filtra registros para uma configuração específica"""
        if config.property_id:
            return [r for r in records if r.room.property_obj.id == config.property_id]
        return records
    
    def _process_sync_batch(
        self, 
        config: WuBookConfiguration, 
        batch: List[RoomAvailability]
    ) -> Dict[str, Any]:
        """Processa um batch de registros para sincronização"""
        try:
            # Agrupar por datas para otimizar chamadas API
            date_groups = {}
            for record in batch:
                date_key = record.date.strftime('%Y-%m-%d')
                if date_key not in date_groups:
                    date_groups[date_key] = []
                date_groups[date_key].append(record)
            
            # Processar cada grupo de data
            successful = 0
            failed = 0
            errors = []
            
            for date_str, records in date_groups.items():
                try:
                    # Usar o serviço de sincronização funcional
                    room_ids = [r.room_id for r in records]
                    
                    result = self.wubook_sync_service.sync_availability_to_wubook(
                        tenant_id=config.tenant_id,
                        configuration_id=config.id,
                        date_from=date.fromisoformat(date_str),
                        date_to=date.fromisoformat(date_str),
                        room_ids=room_ids
                    )
                    
                    if result.get("success"):
                        successful += len(records)
                        # Marcar como sincronizado
                        for record in records:
                            record.mark_sync_success()
                    else:
                        failed += len(records)
                        error_msg = result.get("message", "Erro desconhecido")
                        errors.append(f"Data {date_str}: {error_msg}")
                        
                        # Marcar erro nos registros
                        for record in records:
                            record.mark_sync_error(error_msg)
                
                except Exception as e:
                    failed += len(records)
                    error_msg = f"Data {date_str}: {str(e)}"
                    errors.append(error_msg)
                    
                    # Marcar erro nos registros
                    for record in records:
                        record.mark_sync_error(str(e))
            
            # Commit das alterações
            self.db.commit()
            
            return {
                "processed": len(batch),
                "successful": successful,
                "failed": failed,
                "errors": errors
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro no batch de sincronização: {str(e)}")
            
            return {
                "processed": len(batch),
                "successful": 0,
                "failed": len(batch),
                "errors": [str(e)]
            }
    
    def _create_success_result(
        self, 
        sync_id: str, 
        started_at: datetime, 
        message: str,
        total: int, 
        successful: int, 
        failed: int, 
        errors: List[str]
    ) -> Dict[str, Any]:
        """Cria resultado de sucesso padronizado"""
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        return {
            "sync_id": sync_id,
            "status": "success",
            "message": message,
            "total_pending": total,
            "processed": total,
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / total * 100) if total > 0 else 100,
            "errors": errors,
            "error_count": len(errors),
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "duration_seconds": round(duration, 2)
        }
    
    def _create_error_result(
        self, 
        sync_id: str, 
        started_at: datetime, 
        error_message: str
    ) -> Dict[str, Any]:
        """Cria resultado de erro padronizado"""
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        return {
            "sync_id": sync_id,
            "status": "error",
            "message": error_message,
            "total_pending": 0,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "success_rate": 0,
            "errors": [error_message],
            "error_count": 1,
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "duration_seconds": round(duration, 2)
        }