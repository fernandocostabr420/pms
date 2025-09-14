# backend/app/services/wubook_availability_sync_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import json

from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.property import Property
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_sync_log import WuBookSyncLog
from app.integrations.wubook.wubook_client import WuBookClient
from app.services.room_availability_service import RoomAvailabilityService

logger = logging.getLogger(__name__)


class WuBookAvailabilitySyncService:
    """Serviço especializado para sincronização de disponibilidade com WuBook"""
    
    def __init__(self, db: Session):
        self.db = db
        self.availability_service = RoomAvailabilityService(db)
    
    def _get_wubook_configuration(
        self, 
        tenant_id: int, 
        configuration_id: Optional[int] = None
    ) -> Optional[WuBookConfiguration]:
        """Busca configuração WuBook ativa"""
        query = self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == tenant_id,
            WuBookConfiguration.is_active == True,
            WuBookConfiguration.is_connected == True
        )
        
        if configuration_id:
            query = query.filter(WuBookConfiguration.id == configuration_id)
        
        return query.first()
    
    def _get_room_mappings(
        self, 
        configuration_id: int, 
        room_ids: Optional[List[int]] = None
    ) -> List[WuBookRoomMapping]:
        """Busca mapeamentos de quartos para sincronização"""
        query = self.db.query(WuBookRoomMapping).options(
            joinedload(WuBookRoomMapping.room)
        ).filter(
            WuBookRoomMapping.configuration_id == configuration_id,
            WuBookRoomMapping.is_active == True,
            WuBookRoomMapping.sync_availability == True
        )
        
        if room_ids:
            query = query.filter(WuBookRoomMapping.room_id.in_(room_ids))
        
        return query.all()
    
    def _create_sync_log(
        self, 
        configuration_id: int, 
        sync_type: str, 
        sync_direction: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        room_ids: Optional[List[int]] = None
    ) -> WuBookSyncLog:
        """Cria log de sincronização"""
        sync_log = WuBookSyncLog(
            configuration_id=configuration_id,
            sync_type=sync_type,
            sync_direction=sync_direction,
            status="started",
            started_at=datetime.utcnow().isoformat(),
            date_from=date_from,
            date_to=date_to,
            room_ids=room_ids or [],
            tenant_id=self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.id == configuration_id
            ).first().tenant_id
        )
        
        self.db.add(sync_log)
        self.db.commit()
        self.db.refresh(sync_log)
        
        return sync_log
    
    def _update_sync_log(
        self, 
        sync_log: WuBookSyncLog, 
        status: str,
        total_items: int = 0,
        success_items: int = 0,
        error_items: int = 0,
        changes_made: Optional[Dict[str, int]] = None,
        error_message: Optional[str] = None,
        conflicts: Optional[List[Dict]] = None
    ):
        """Atualiza log de sincronização"""
        sync_log.status = status
        sync_log.completed_at = datetime.utcnow().isoformat()
        
        if sync_log.started_at:
            start_time = datetime.fromisoformat(sync_log.started_at)
            duration = datetime.utcnow() - start_time
            sync_log.duration_seconds = duration.total_seconds()
        
        sync_log.total_items = total_items
        sync_log.success_items = success_items
        sync_log.error_items = error_items
        sync_log.processed_items = success_items + error_items
        
        if changes_made:
            sync_log.changes_made = changes_made
        
        if error_message:
            sync_log.error_message = error_message
        
        if conflicts:
            sync_log.conflicts_found = conflicts
        
        self.db.commit()
    
    def _convert_pms_to_wubook_availability(
        self, 
        availabilities: List[RoomAvailability], 
        mappings: List[WuBookRoomMapping]
    ) -> List[Dict[str, Any]]:
        """Converte disponibilidade PMS para formato WuBook"""
        mapping_dict = {m.room_id: m for m in mappings}
        wubook_data = []
        
        for avail in availabilities:
            mapping = mapping_dict.get(avail.room_id)
            if not mapping:
                continue
            
            # Formato básico WuBook
            wb_data = {
                'room_id': mapping.wubook_room_id,
                'date': avail.date.strftime('%Y-%m-%d'),
                'available': 1 if avail.is_bookable else 0,
                'closed_to_arrival': 1 if avail.closed_to_arrival else 0,
                'closed_to_departure': 1 if avail.closed_to_departure else 0,
                'min_stay': avail.min_stay
            }
            
            # Campos opcionais
            if avail.max_stay:
                wb_data['max_stay'] = avail.max_stay
            
            if avail.rate_override and mapping.sync_rates:
                # Aplicar multiplicador se configurado
                rate = float(avail.rate_override)
                if mapping.rate_multiplier != 1.0:
                    rate = rate * float(mapping.rate_multiplier)
                wb_data['rate'] = rate
            
            wubook_data.append(wb_data)
        
        return wubook_data
    
    def _convert_wubook_to_pms_availability(
        self, 
        wubook_data: List[Dict[str, Any]], 
        mappings: List[WuBookRoomMapping],
        tenant_id: int
    ) -> List[RoomAvailability]:
        """Converte disponibilidade WuBook para formato PMS"""
        wubook_mapping_dict = {m.wubook_room_id: m for m in mappings}
        pms_availabilities = []
        
        for wb_data in wubook_data:
            mapping = wubook_mapping_dict.get(wb_data.get('room_id'))
            if not mapping:
                continue
            
            try:
                # Converter data
                avail_date = datetime.strptime(wb_data['date'], '%Y-%m-%d').date()
                
                # Buscar ou criar disponibilidade PMS
                pms_avail = self.db.query(RoomAvailability).filter(
                    RoomAvailability.room_id == mapping.room_id,
                    RoomAvailability.date == avail_date,
                    RoomAvailability.tenant_id == tenant_id
                ).first()
                
                if not pms_avail:
                    pms_avail = RoomAvailability(
                        tenant_id=tenant_id,
                        room_id=mapping.room_id,
                        date=avail_date
                    )
                    self.db.add(pms_avail)
                
                # Atualizar campos
                wb_available = wb_data.get('available', 0)
                pms_avail.is_available = wb_available > 0
                pms_avail.closed_to_arrival = bool(wb_data.get('closed_to_arrival', 0))
                pms_avail.closed_to_departure = bool(wb_data.get('closed_to_departure', 0))
                pms_avail.min_stay = wb_data.get('min_stay', 1)
                
                if 'max_stay' in wb_data:
                    pms_avail.max_stay = wb_data['max_stay']
                
                if 'rate' in wb_data and mapping.sync_rates:
                    rate = Decimal(str(wb_data['rate']))
                    # Aplicar divisor se há multiplicador
                    if mapping.rate_multiplier != 1.0:
                        rate = rate / Decimal(str(mapping.rate_multiplier))
                    pms_avail.rate_override = rate
                
                # Marcar como sincronizado
                pms_avail.mark_sync_success()
                
                pms_availabilities.append(pms_avail)
                
            except Exception as e:
                logger.error(f"Erro ao converter disponibilidade WuBook: {str(e)}")
                continue
        
        return pms_availabilities
    
    def sync_availability_to_wubook(
        self,
        tenant_id: int,
        configuration_id: Optional[int] = None,
        room_ids: Optional[List[int]] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        force_sync_all: bool = False
    ) -> Dict[str, Any]:
        """Sincroniza disponibilidade do PMS para WuBook"""
        
        try:
            # Buscar configuração
            config = self._get_wubook_configuration(tenant_id, configuration_id)
            if not config:
                return {
                    "success": False,
                    "message": "Configuração WuBook não encontrada ou inativa"
                }
            
            # Definir período padrão
            if not date_from:
                date_from = date.today()
            if not date_to:
                date_to = date_from + timedelta(days=30)
            
            # Criar log de sincronização
            sync_log = self._create_sync_log(
                config.id, 
                "availability", 
                "outbound",
                date_from.strftime('%Y-%m-%d'),
                date_to.strftime('%Y-%m-%d'),
                room_ids
            )
            
            # Buscar mapeamentos
            mappings = self._get_room_mappings(config.id, room_ids)
            if not mappings:
                self._update_sync_log(
                    sync_log, "success", 0, 0, 0,
                    error_message="Nenhum mapeamento de quarto encontrado"
                )
                return {
                    "success": True,
                    "message": "Nenhum mapeamento de quarto encontrado",
                    "sync_log_id": sync_log.id
                }
            
            # Buscar disponibilidades a sincronizar
            pms_room_ids = [m.room_id for m in mappings]
            query = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.room_id.in_(pms_room_ids),
                RoomAvailability.date >= date_from,
                RoomAvailability.date <= date_to,
                RoomAvailability.is_active == True
            )
            
            # Filtrar apenas pendentes se não for forçado
            if not force_sync_all:
                query = query.filter(RoomAvailability.sync_pending == True)
            
            availabilities = query.all()
            
            if not availabilities:
                self._update_sync_log(
                    sync_log, "success", 0, 0, 0,
                    changes_made={"synced": 0}
                )
                return {
                    "success": True,
                    "message": "Nenhuma disponibilidade pendente de sincronização",
                    "sync_log_id": sync_log.id
                }
            
            # Converter para formato WuBook
            wubook_data = self._convert_pms_to_wubook_availability(availabilities, mappings)
            
            if not wubook_data:
                self._update_sync_log(
                    sync_log, "success", len(availabilities), 0, len(availabilities),
                    error_message="Nenhum dado válido para sincronizar"
                )
                return {
                    "success": False,
                    "message": "Nenhum dado válido para sincronizar",
                    "sync_log_id": sync_log.id
                }
            
            # Criar cliente WuBook
            client = WuBookClient(config.wubook_token, config.wubook_lcode)
            
            # Enviar para WuBook
            success_count = 0
            error_count = 0
            errors = []
            
            try:
                # Atualizar disponibilidade no WuBook
                result = client.update_availability(wubook_data)
                
                if result.get("success"):
                    # Marcar como sincronizado
                    sync_timestamp = datetime.utcnow().isoformat()
                    for avail in availabilities:
                        avail.mark_sync_success(sync_timestamp)
                    
                    success_count = len(availabilities)
                    
                    # Atualizar configuração
                    config.last_sync_at = sync_timestamp
                    config.last_sync_status = "success"
                    config.error_count = 0
                    
                else:
                    error_message = result.get("message", "Erro desconhecido no WuBook")
                    errors.append(error_message)
                    
                    # Marcar erro
                    for avail in availabilities:
                        avail.mark_sync_error(error_message)
                    
                    error_count = len(availabilities)
                    
                    # Atualizar configuração
                    config.last_error_at = datetime.utcnow().isoformat()
                    config.error_count += 1
                
            except Exception as e:
                error_message = f"Erro de comunicação com WuBook: {str(e)}"
                logger.error(error_message)
                errors.append(error_message)
                
                # Marcar erro
                for avail in availabilities:
                    avail.mark_sync_error(error_message)
                
                error_count = len(availabilities)
                
                # Atualizar configuração
                config.last_error_at = datetime.utcnow().isoformat()
                config.error_count += 1
            
            # Commit das alterações
            self.db.commit()
            
            # Atualizar log
            final_status = "success" if success_count > 0 and error_count == 0 else \
                          "partial_success" if success_count > 0 else "error"
            
            self._update_sync_log(
                sync_log, final_status, 
                len(availabilities), success_count, error_count,
                changes_made={"synced_to_wubook": success_count},
                error_message="; ".join(errors) if errors else None
            )
            
            return {
                "success": success_count > 0,
                "message": f"Sincronização concluída: {success_count} sucessos, {error_count} erros",
                "synced_count": success_count,
                "error_count": error_count,
                "errors": errors,
                "sync_log_id": sync_log.id
            }
            
        except Exception as e:
            logger.error(f"Erro na sincronização para WuBook: {str(e)}")
            if 'sync_log' in locals():
                self._update_sync_log(
                    sync_log, "error", 0, 0, 0,
                    error_message=str(e)
                )
            raise
    
    def sync_availability_from_wubook(
        self,
        tenant_id: int,
        configuration_id: Optional[int] = None,
        room_ids: Optional[List[int]] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sincroniza disponibilidade do WuBook para PMS"""
        
        try:
            # Buscar configuração
            config = self._get_wubook_configuration(tenant_id, configuration_id)
            if not config:
                return {
                    "success": False,
                    "message": "Configuração WuBook não encontrada ou inativa"
                }
            
            # Definir período padrão
            if not date_from:
                date_from = date.today()
            if not date_to:
                date_to = date_from + timedelta(days=30)
            
            # Criar log de sincronização
            sync_log = self._create_sync_log(
                config.id, 
                "availability", 
                "inbound",
                date_from.strftime('%Y-%m-%d'),
                date_to.strftime('%Y-%m-%d'),
                room_ids
            )
            
            # Buscar mapeamentos
            mappings = self._get_room_mappings(config.id, room_ids)
            if not mappings:
                self._update_sync_log(
                    sync_log, "success", 0, 0, 0,
                    error_message="Nenhum mapeamento de quarto encontrado"
                )
                return {
                    "success": True,
                    "message": "Nenhum mapeamento de quarto encontrado",
                    "sync_log_id": sync_log.id
                }
            
            # Criar cliente WuBook
            client = WuBookClient(config.wubook_token, config.wubook_lcode)
            
            # Buscar disponibilidade do WuBook
            wubook_room_ids = [m.wubook_room_id for m in mappings]
            
            try:
                wubook_availability = client.fetch_availability(
                    date_from.strftime('%Y-%m-%d'),
                    date_to.strftime('%Y-%m-%d'),
                    wubook_room_ids
                )
                
                if not wubook_availability:
                    self._update_sync_log(
                        sync_log, "success", 0, 0, 0,
                        changes_made={"imported": 0}
                    )
                    return {
                        "success": True,
                        "message": "Nenhuma disponibilidade encontrada no WuBook",
                        "sync_log_id": sync_log.id
                    }
                
                # Converter para formato PMS
                pms_availabilities = self._convert_wubook_to_pms_availability(
                    wubook_availability, mappings, tenant_id
                )
                
                # Commit das alterações
                self.db.commit()
                
                # Atualizar configuração
                config.last_sync_at = datetime.utcnow().isoformat()
                config.last_sync_status = "success"
                config.error_count = 0
                self.db.commit()
                
                # Atualizar log
                self._update_sync_log(
                    sync_log, "success", 
                    len(wubook_availability), len(pms_availabilities), 0,
                    changes_made={"imported_from_wubook": len(pms_availabilities)}
                )
                
                return {
                    "success": True,
                    "message": f"Importação concluída: {len(pms_availabilities)} disponibilidades",
                    "imported_count": len(pms_availabilities),
                    "sync_log_id": sync_log.id
                }
                
            except Exception as e:
                error_message = f"Erro ao buscar dados do WuBook: {str(e)}"
                logger.error(error_message)
                
                # Atualizar configuração
                config.last_error_at = datetime.utcnow().isoformat()
                config.error_count += 1
                self.db.commit()
                
                # Atualizar log
                self._update_sync_log(
                    sync_log, "error", 0, 0, 0,
                    error_message=error_message
                )
                
                return {
                    "success": False,
                    "message": error_message,
                    "sync_log_id": sync_log.id
                }
            
        except Exception as e:
            logger.error(f"Erro na sincronização do WuBook: {str(e)}")
            if 'sync_log' in locals():
                self._update_sync_log(
                    sync_log, "error", 0, 0, 0,
                    error_message=str(e)
                )
            raise
    
    def sync_bidirectional_availability(
        self,
        tenant_id: int,
        configuration_id: Optional[int] = None,
        room_ids: Optional[List[int]] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sincronização bidirecional de disponibilidade"""
        
        results = {
            "success": True,
            "message": "Sincronização bidirecional concluída",
            "from_wubook": {},
            "to_wubook": {}
        }
        
        try:
            # Primeiro: sincronizar do WuBook para PMS
            results["from_wubook"] = self.sync_availability_from_wubook(
                tenant_id=tenant_id,
                configuration_id=configuration_id,
                room_ids=room_ids,
                date_from=date_from,
                date_to=date_to
            )
            
            # Segundo: sincronizar do PMS para WuBook
            results["to_wubook"] = self.sync_availability_to_wubook(
                tenant_id=tenant_id,
                configuration_id=configuration_id,
                room_ids=room_ids,
                date_from=date_from,
                date_to=date_to
            )
            
            # Verificar se houve algum erro
            if not results["from_wubook"]["success"] or not results["to_wubook"]["success"]:
                results["success"] = False
                results["message"] = "Sincronização bidirecional com erros"
            
            return results
            
        except Exception as e:
            logger.error(f"Erro na sincronização bidirecional: {str(e)}")
            results["success"] = False
            results["message"] = f"Erro na sincronização bidirecional: {str(e)}"
            return results
    
    def get_sync_statistics(
        self,
        tenant_id: int,
        configuration_id: Optional[int] = None,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """Estatísticas de sincronização"""
        
        try:
            # Período de análise
            date_from = date.today() - timedelta(days=days_back)
            
            # Query base para logs
            logs_query = self.db.query(WuBookSyncLog).filter(
                WuBookSyncLog.sync_type == "availability"
            )
            
            if configuration_id:
                logs_query = logs_query.filter(
                    WuBookSyncLog.configuration_id == configuration_id
                )
            else:
                # Filtrar por tenant via configuração
                logs_query = logs_query.join(WuBookConfiguration).filter(
                    WuBookConfiguration.tenant_id == tenant_id
                )
            
            # Logs recentes
            recent_logs = logs_query.filter(
                func.date(WuBookSyncLog.created_at) >= date_from
            ).all()
            
            # Contar por status
            status_counts = {}
            total_duration = 0
            total_items = 0
            
            for log in recent_logs:
                status = log.status
                status_counts[status] = status_counts.get(status, 0) + 1
                
                if log.duration_seconds:
                    total_duration += log.duration_seconds
                if log.total_items:
                    total_items += log.total_items
            
            # Disponibilidades pendentes
            pending_query = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True
            )
            
            if configuration_id:
                # Filtrar por mapeamentos da configuração
                pending_query = pending_query.join(Room).join(
                    WuBookRoomMapping,
                    WuBookRoomMapping.room_id == Room.id
                ).filter(
                    WuBookRoomMapping.configuration_id == configuration_id,
                    WuBookRoomMapping.is_active == True
                )
            
            pending_count = pending_query.count()
            
            # Disponibilidades com erro
            error_query = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.wubook_sync_error.isnot(None),
                RoomAvailability.is_active == True
            )
            
            if configuration_id:
                error_query = error_query.join(Room).join(
                    WuBookRoomMapping,
                    WuBookRoomMapping.room_id == Room.id
                ).filter(
                    WuBookRoomMapping.configuration_id == configuration_id,
                    WuBookRoomMapping.is_active == True
                )
            
            error_count = error_query.count()
            
            # Última sincronização
            last_sync = logs_query.order_by(
                WuBookSyncLog.created_at.desc()
            ).first()
            
            return {
                "period_days": days_back,
                "total_syncs": len(recent_logs),
                "status_breakdown": status_counts,
                "average_duration": total_duration / len(recent_logs) if recent_logs else 0,
                "total_items_processed": total_items,
                "pending_sync_count": pending_count,
                "error_count": error_count,
                "last_sync": {
                    "id": last_sync.id if last_sync else None,
                    "status": last_sync.status if last_sync else None,
                    "completed_at": last_sync.completed_at if last_sync else None,
                    "message": last_sync.error_message if last_sync and last_sync.error_message else None
                } if last_sync else None
            }
            
        except Exception as e:
            logger.error(f"Erro ao buscar estatísticas: {str(e)}")
            return {
                "error": str(e)
            }