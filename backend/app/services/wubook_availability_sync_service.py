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
        """Converte disponibilidade PMS para formato WuBook - CORRIGIDO"""
        mapping_dict = {m.room_id: m for m in mappings}
        wubook_data = []
        
        for avail in availabilities:
            mapping = mapping_dict.get(avail.room_id)
            if not mapping:
                logger.debug(f"Mapeamento não encontrado para room_id: {avail.room_id}")
                continue
            
            # Formato correto para WuBook
            wb_data = {
                'room_id': mapping.wubook_room_id,  # ID do quarto no WuBook
                'date': avail.date,  # Será convertido pelo WuBookClient
                'available': 1 if avail.is_bookable else 0,  # Cliente converte para 'avail'
                'min_stay': avail.min_stay or 1
            }
            
            # Campos opcionais
            if avail.max_stay:
                wb_data['max_stay'] = avail.max_stay
            
            # Restrições de chegada/saída
            if avail.closed_to_arrival:
                wb_data['closed_to_arrival'] = 1
            
            if avail.closed_to_departure:
                wb_data['closed_to_departure'] = 1
            
            # Tarifa se disponível e sincronização habilitada
            if avail.rate_override and mapping.sync_rates:
                # Aplicar multiplicador se configurado
                rate = float(avail.rate_override)
                if mapping.rate_multiplier != 1.0:
                    rate = rate * float(mapping.rate_multiplier)
                wb_data['rate'] = rate
            
            wubook_data.append(wb_data)
        
        logger.debug(f"Convertidos {len(wubook_data)} itens de disponibilidade para WuBook")
        return wubook_data
    
    def _convert_wubook_to_pms_availability(
        self, 
        wubook_data: Any, 
        mappings: List[WuBookRoomMapping],
        tenant_id: int
    ) -> List[RoomAvailability]:
        """Converte disponibilidade WuBook para formato PMS - CORRIGIDO"""
        wubook_mapping_dict = {m.wubook_room_id: m for m in mappings}
        pms_availabilities = []
        
        try:
            # Log para debug - ver o que WuBook realmente retorna
            logger.debug(f"WuBook data type: {type(wubook_data)}")
            logger.debug(f"WuBook data sample: {str(wubook_data)[:500]}")
            
            # WuBook fetch_rooms_values retorna dict com room_id como chave
            if isinstance(wubook_data, dict):
                for room_id_str, daily_data in wubook_data.items():
                    mapping = wubook_mapping_dict.get(room_id_str)
                    if not mapping:
                        logger.debug(f"Mapeamento não encontrado para room_id: {room_id_str}")
                        continue
                    
                    # daily_data é uma lista de dados diários
                    if isinstance(daily_data, list):
                        for day_index, day_data in enumerate(daily_data):
                            try:
                                # Calcular data baseada no índice
                                base_date = date.today()  # Seria melhor ter a data base do request
                                avail_date = base_date + timedelta(days=day_index)
                                
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
                                
                                # Atualizar campos - day_data pode ser dict ou outro formato
                                if isinstance(day_data, dict):
                                    wb_available = day_data.get('avail', 0)
                                    pms_avail.is_available = wb_available > 0
                                    pms_avail.closed_to_arrival = bool(day_data.get('closed_arrival', 0))
                                    pms_avail.closed_to_departure = bool(day_data.get('closed_departure', 0))
                                    pms_avail.min_stay = day_data.get('min_stay', 1)
                                    
                                    if day_data.get('max_stay', 0) > 0:
                                        pms_avail.max_stay = day_data.get('max_stay')
                                    
                                    if day_data.get('price') and mapping.sync_rates:
                                        rate = Decimal(str(day_data['price']))
                                        # Aplicar divisor se há multiplicador
                                        if mapping.rate_multiplier != 1.0:
                                            rate = rate / Decimal(str(mapping.rate_multiplier))
                                        pms_avail.rate_override = rate
                                else:
                                    # Se não é dict, usar valores padrão
                                    pms_avail.is_available = True
                                    pms_avail.min_stay = 1
                                
                                # Marcar como sincronizado
                                pms_avail.mark_sync_success()
                                pms_avail.update_bookable_status()
                                
                                pms_availabilities.append(pms_avail)
                                
                            except Exception as e:
                                logger.error(f"Erro ao processar dia {day_index}: {str(e)}")
                                continue
                    else:
                        logger.warning(f"daily_data não é lista para room {room_id_str}: {type(daily_data)}")
            else:
                logger.warning(f"wubook_data não é dict: {type(wubook_data)}")
                
        except Exception as e:
            logger.error(f"Erro ao converter disponibilidade WuBook: {str(e)}")
        
        logger.debug(f"Convertidas {len(pms_availabilities)} disponibilidades do WuBook")
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
        """Sincroniza disponibilidade do PMS para WuBook - CORRIGIDO"""
        
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
            
            # CORREÇÃO PRINCIPAL: Tratamento robusto da resposta
            success_count = 0
            error_count = 0
            errors = []
            
            try:
                # Atualizar disponibilidade no WuBook
                result = client.update_availability(wubook_data)
                
                # IMPORTANTE: Verificar o tipo e conteúdo do resultado
                logger.debug(f"Resultado WuBook type: {type(result)}, content: {result}")
                
                if isinstance(result, dict):
                    # Resultado correto - é um dicionário
                    if result.get("success"):
                        # Sucesso
                        sync_timestamp = datetime.utcnow().isoformat()
                        for avail in availabilities:
                            avail.mark_sync_success()
                        
                        success_count = len(availabilities)
                        
                        # Atualizar configuração
                        config.last_sync_at = sync_timestamp
                        config.last_sync_status = "success"
                        config.error_count = 0
                        
                        logger.info(f"Sincronização bem-sucedida: {success_count} itens")
                        
                    else:
                        # Erro reportado pela WuBook
                        error_message = result.get("message", "Erro desconhecido no WuBook")
                        errors.append(error_message)
                        
                        # Marcar erro
                        for avail in availabilities:
                            avail.mark_sync_error(error_message)
                        
                        error_count = len(availabilities)
                        
                        # Atualizar configuração
                        config.last_error_at = datetime.utcnow().isoformat()
                        config.error_count += 1
                        
                        logger.error(f"Erro WuBook: {error_message}")
                        
                elif isinstance(result, str):
                    # Se result é string, houve erro na serialização/comunicação
                    error_message = f"Erro na comunicação com WuBook: {result}"
                    logger.error(error_message)
                    errors.append(error_message)
                    
                    # Marcar erro em todas as disponibilidades
                    for avail in availabilities:
                        avail.mark_sync_error(error_message)
                    
                    error_count = len(availabilities)
                    
                    # Atualizar configuração
                    config.last_error_at = datetime.utcnow().isoformat()
                    config.error_count += 1
                    
                else:
                    # Tipo inesperado
                    error_message = f"Tipo de resultado inesperado: {type(result)} - {result}"
                    logger.error(error_message)
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
    
    # ============== NOVOS MÉTODOS PARA SINCRONIZAÇÃO MANUAL ==============
    
    def get_pending_records_count(
        self, 
        tenant_id: int, 
        configuration_id: Optional[int] = None,
        property_id: Optional[int] = None
    ) -> int:
        """
        Retorna contagem de registros pendentes de sincronização
        
        Args:
            tenant_id: ID do tenant
            configuration_id: ID da configuração específica (opcional)
            property_id: ID da propriedade específica (opcional)
            
        Returns:
            Número de registros pendentes
        """
        try:
            # Query base para registros pendentes
            query = self.db.query(RoomAvailability).join(Room).join(Property).filter(
                Property.tenant_id == tenant_id,
                RoomAvailability.is_active == True,
                RoomAvailability.sync_pending == True
            )
            
            # Filtrar por propriedade se especificado
            if property_id:
                query = query.filter(Property.id == property_id)
            
            # Se configuration_id especificado, filtrar por quartos mapeados
            if configuration_id:
                mapped_room_ids = self.db.query(WuBookRoomMapping.room_id).filter(
                    WuBookRoomMapping.configuration_id == configuration_id,
                    WuBookRoomMapping.is_active == True
                ).subquery()
                
                query = query.filter(RoomAvailability.room_id.in_(mapped_room_ids))
            
            return query.count()
            
        except Exception as e:
            logger.error(f"Erro ao contar registros pendentes: {str(e)}")
            return 0
    
    def process_pending_sync_batch(
        self,
        tenant_id: int,
        configuration_id: int,
        batch_size: int = 100,
        max_days_range: int = 30
    ) -> Dict[str, Any]:
        """
        Processa um batch de registros pendentes para sincronização
        
        Args:
            tenant_id: ID do tenant
            configuration_id: ID da configuração WuBook
            batch_size: Tamanho máximo do batch
            max_days_range: Range máximo de dias para processar
            
        Returns:
            Dict com resultado do processamento
        """
        started_at = datetime.utcnow()
        
        try:
            # Buscar configuração
            config = self._get_wubook_configuration(tenant_id, configuration_id)
            if not config:
                return {
                    "success": False,
                    "message": "Configuração WuBook não encontrada ou inativa",
                    "processed": 0,
                    "successful": 0,
                    "failed": 0
                }
            
            # Buscar mapeamentos ativos
            mappings = self._get_room_mappings(configuration_id)
            if not mappings:
                return {
                    "success": False,
                    "message": "Nenhum mapeamento de quarto encontrado",
                    "processed": 0,
                    "successful": 0,
                    "failed": 0
                }
            
            # Buscar registros pendentes limitado por batch_size
            pms_room_ids = [m.room_id for m in mappings]
            pending_records = self.db.query(RoomAvailability).filter(
                RoomAvailability.room_id.in_(pms_room_ids),
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True
            ).order_by(
                RoomAvailability.date,
                RoomAvailability.updated_at
            ).limit(batch_size).all()
            
            if not pending_records:
                return {
                    "success": True,
                    "message": "Nenhum registro pendente encontrado",
                    "processed": 0,
                    "successful": 0,
                    "failed": 0
                }
            
            # Agrupar por datas contíguas para otimizar chamadas API
            date_groups = self._group_records_by_date_range(pending_records, max_days_range)
            
            total_processed = 0
            total_successful = 0
            total_failed = 0
            errors = []
            
            # Processar cada grupo de datas
            for date_range, records in date_groups.items():
                try:
                    # Extrair date_from e date_to do range
                    date_from_str, date_to_str = date_range.split("_to_")
                    date_from = date.fromisoformat(date_from_str)
                    date_to = date.fromisoformat(date_to_str)
                    
                    # Sincronizar este range
                    room_ids = list(set([r.room_id for r in records]))
                    
                    sync_result = self.sync_availability_to_wubook(
                        tenant_id=tenant_id,
                        configuration_id=configuration_id,
                        date_from=date_from,
                        date_to=date_to,
                        room_ids=room_ids,
                        force_sync_all=True
                    )
                    
                    if sync_result.get("success"):
                        # Marcar registros como sincronizados
                        for record in records:
                            record.mark_sync_success()
                        
                        total_successful += len(records)
                        logger.info(f"Batch sincronizado: {len(records)} registros de {date_from} a {date_to}")
                    else:
                        # Marcar erros
                        error_msg = sync_result.get("message", "Erro desconhecido")
                        for record in records:
                            record.mark_sync_error(error_msg)
                        
                        total_failed += len(records)
                        errors.append(f"Range {date_from} a {date_to}: {error_msg}")
                    
                    total_processed += len(records)
                
                except Exception as e:
                    # Erro no grupo específico
                    error_msg = f"Erro no range {date_range}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    
                    # Marcar registros com erro
                    for record in records:
                        record.mark_sync_error(str(e))
                    
                    total_failed += len(records)
                    total_processed += len(records)
            
            # Commit das alterações
            self.db.commit()
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            success_rate = (total_successful / total_processed * 100) if total_processed > 0 else 0
            
            return {
                "success": total_failed == 0,
                "message": f"Batch processado: {total_successful}/{total_processed} sucessos",
                "processed": total_processed,
                "successful": total_successful,
                "failed": total_failed,
                "success_rate": round(success_rate, 2),
                "errors": errors[:5],  # Limitar a 5 erros
                "error_count": len(errors),
                "duration_seconds": round(duration, 2),
                "date_groups_processed": len(date_groups)
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro no processamento de batch pendente: {str(e)}")
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            return {
                "success": False,
                "message": f"Erro crítico no batch: {str(e)}",
                "processed": 0,
                "successful": 0,
                "failed": 0,
                "success_rate": 0,
                "errors": [str(e)],
                "error_count": 1,
                "duration_seconds": round(duration, 2)
            }
    
    def _group_records_by_date_range(
        self, 
        records: List[RoomAvailability], 
        max_days_range: int = 30
    ) -> Dict[str, List[RoomAvailability]]:
        """
        Agrupa registros por ranges de datas contíguas para otimizar chamadas API
        
        Args:
            records: Lista de registros para agrupar
            max_days_range: Range máximo de dias por grupo
            
        Returns:
            Dict onde key é "date_from_to_date_to" e value é lista de records
        """
        # Ordenar por data
        sorted_records = sorted(records, key=lambda x: x.date)
        
        if not sorted_records:
            return {}
        
        groups = {}
        current_group = []
        current_start_date = None
        current_end_date = None
        
        for record in sorted_records:
            record_date = record.date
            
            if current_start_date is None:
                # Primeiro registro
                current_start_date = record_date
                current_end_date = record_date
                current_group = [record]
            elif record_date == current_end_date + timedelta(days=1):
                # Data contígua - verificar se não excede range máximo
                days_diff = (record_date - current_start_date).days + 1
                
                if days_diff <= max_days_range:
                    # Adicionar ao grupo atual
                    current_end_date = record_date
                    current_group.append(record)
                else:
                    # Finalizar grupo atual e iniciar novo
                    group_key = f"{current_start_date.isoformat()}_to_{current_end_date.isoformat()}"
                    groups[group_key] = current_group
                    
                    # Novo grupo
                    current_start_date = record_date
                    current_end_date = record_date
                    current_group = [record]
            else:
                # Data não contígua - finalizar grupo atual e iniciar novo
                group_key = f"{current_start_date.isoformat()}_to_{current_end_date.isoformat()}"
                groups[group_key] = current_group
                
                # Novo grupo
                current_start_date = record_date
                current_end_date = record_date
                current_group = [record]
        
        # Adicionar último grupo
        if current_group:
            group_key = f"{current_start_date.isoformat()}_to_{current_end_date.isoformat()}"
            groups[group_key] = current_group
        
        return groups
    
    def get_sync_statistics(
        self,
        tenant_id: int,
        configuration_id: Optional[int] = None,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Retorna estatísticas de sincronização para um período
        
        Args:
            tenant_id: ID do tenant
            configuration_id: ID da configuração específica (opcional)
            days_back: Quantos dias atrás buscar
            
        Returns:
            Dict com estatísticas de sincronização
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            
            # Query base para logs de sync
            sync_logs_query = self.db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
                WuBookConfiguration.tenant_id == tenant_id,
                WuBookSyncLog.started_at >= cutoff_date
            )
            
            if configuration_id:
                sync_logs_query = sync_logs_query.filter(
                    WuBookSyncLog.configuration_id == configuration_id
                )
            
            sync_logs = sync_logs_query.all()
            
            # Calcular estatísticas
            total_syncs = len(sync_logs)
            successful_syncs = len([log for log in sync_logs if log.status == "success"])
            failed_syncs = len([log for log in sync_logs if log.status == "error"])
            
            # Taxa de sucesso
            success_rate = (successful_syncs / total_syncs * 100) if total_syncs > 0 else 0
            
            # Tempo médio de sincronização
            completed_syncs = [log for log in sync_logs if log.completed_at]
            avg_duration = 0
            if completed_syncs:
                durations = []
                for log in completed_syncs:
                    try:
                        started = datetime.fromisoformat(log.started_at.replace('Z', '+00:00')) if isinstance(log.started_at, str) else log.started_at
                        completed = datetime.fromisoformat(log.completed_at.replace('Z', '+00:00')) if isinstance(log.completed_at, str) else log.completed_at
                        duration = (completed - started).total_seconds()
                        durations.append(duration)
                    except:
                        continue
                
                if durations:
                    avg_duration = sum(durations) / len(durations)
            
            # Registros processados
            total_processed = sum([log.total_items or 0 for log in sync_logs])
            total_successful_items = sum([log.success_items or 0 for log in sync_logs])
            total_error_items = sum([log.error_items or 0 for log in sync_logs])
            
            # Última sincronização
            last_sync = None
            if sync_logs:
                last_log = max(sync_logs, key=lambda x: x.started_at)
                last_sync = {
                    "sync_id": last_log.id,
                    "status": last_log.status,
                    "started_at": last_log.started_at,
                    "completed_at": last_log.completed_at,
                    "items_processed": last_log.total_items
                }
            
            return {
                "period_days": days_back,
                "total_syncs": total_syncs,
                "successful_syncs": successful_syncs,
                "failed_syncs": failed_syncs,
                "success_rate": round(success_rate, 2),
                "average_duration_seconds": round(avg_duration, 2),
                "total_items_processed": total_processed,
                "total_items_successful": total_successful_items,
                "total_items_failed": total_error_items,
                "last_sync": last_sync,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas de sincronização: {str(e)}")
            
            return {
                "period_days": days_back,
                "total_syncs": 0,
                "successful_syncs": 0,
                "failed_syncs": 0,
                "success_rate": 0,
                "average_duration_seconds": 0,
                "total_items_processed": 0,
                "total_items_successful": 0,
                "total_items_failed": 0,
                "last_sync": None,
                "error": str(e),
                "generated_at": datetime.utcnow().isoformat()
            }
    
    # ============== MÉTODOS ORIGINAIS (SEM MODIFICAÇÃO) ==============
    
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