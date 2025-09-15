# backend/app/integrations/wubook/sync_service.py

from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from .wubook_client import WuBookClient
from app.core.config import settings
from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_sync_log import WuBookSyncLog

logger = logging.getLogger(__name__)


class WuBookSyncService:
    """Serviço de sincronização com WuBook - versão expandida"""
    
    def __init__(self, db: Session = None):
        self.db = db
        
        # Usar credenciais do settings como fallback
        if not settings.WUBOOK_TOKEN or not settings.WUBOOK_LCODE:
            logger.warning("WuBook credentials not configured in settings")
        
        self.default_token = settings.WUBOOK_TOKEN
        self.default_lcode = settings.WUBOOK_LCODE
    
    def get_client_for_configuration(self, configuration: WuBookConfiguration) -> WuBookClient:
        """Cria cliente WuBook para uma configuração específica"""
        return WuBookClient(
            token=configuration.wubook_token,
            lcode=configuration.wubook_lcode
        )
    
    def get_default_client(self) -> WuBookClient:
        """Cria cliente WuBook com credenciais padrão"""
        if not self.default_token or not self.default_lcode:
            raise ValueError("WuBook credentials not configured")
        
        return WuBookClient(
            token=self.default_token,
            lcode=self.default_lcode
        )
    
    def sync_rooms(self, configuration_id: Optional[int] = None) -> List[Dict]:
        """Sincronizar quartos do WuBook com PMS"""
        try:
            if configuration_id and self.db:
                config = self.db.query(WuBookConfiguration).filter(
                    WuBookConfiguration.id == configuration_id
                ).first()
                if not config:
                    raise ValueError(f"Configuração {configuration_id} não encontrada")
                client = self.get_client_for_configuration(config)
            else:
                client = self.get_default_client()
            
            wubook_rooms = client.fetch_rooms()
            logger.info(f"Sincronizando {len(wubook_rooms)} quartos do WuBook...")
            
            return wubook_rooms
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar quartos: {str(e)}")
            raise

    def sync_availability_from_wubook(
        self,
        tenant_id: int,
        configuration_id: int,
        start_date: str,
        end_date: str,
        room_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Sincronizar disponibilidade do WuBook para o PMS - CORRIGIDO"""
        
        if not self.db:
            raise ValueError("Database session required for availability sync")
        
        try:
            # Buscar configuração
            config = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.id == configuration_id,
                WuBookConfiguration.tenant_id == tenant_id
            ).first()
            
            if not config:
                raise ValueError(f"Configuração {configuration_id} não encontrada")
            
            # Criar cliente
            client = self.get_client_for_configuration(config)
            
            # Buscar mapeamentos de quartos
            mappings_query = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.configuration_id == configuration_id,
                WuBookRoomMapping.is_active == True,
                WuBookRoomMapping.sync_availability == True
            )
            
            if room_ids:
                mappings_query = mappings_query.filter(
                    WuBookRoomMapping.room_id.in_(room_ids)
                )
            
            mappings = mappings_query.all()
            
            if not mappings:
                return {
                    "success": True,
                    "message": "Nenhum mapeamento de quarto encontrado",
                    "synced_count": 0
                }
            
            # Buscar disponibilidade do WuBook
            wubook_room_ids = [m.wubook_room_id for m in mappings]
            wubook_availability = client.fetch_availability(
                start_date, end_date, wubook_room_ids
            )
            
            # CORREÇÃO PRINCIPAL: Verificar tipo e estrutura dos dados recebidos
            logger.debug(f"WuBook availability type: {type(wubook_availability)}")
            logger.debug(f"WuBook availability content: {wubook_availability}")
            
            if not wubook_availability:
                return {
                    "success": True,
                    "message": "Nenhuma disponibilidade encontrada no WuBook",
                    "synced_count": 0
                }
            
            # Criar mapa de mapeamentos
            mapping_dict = {m.wubook_room_id: m for m in mappings}
            
            synced_count = 0
            errors = []
            
            # CORREÇÃO: Processar dados baseado na estrutura real retornada pelo WuBook
            try:
                if isinstance(wubook_availability, dict):
                    # WuBook fetch_rooms_values retorna dict com room_id como chave
                    for room_id_str, daily_data in wubook_availability.items():
                        mapping = mapping_dict.get(room_id_str)
                        if not mapping:
                            logger.debug(f"Mapeamento não encontrado para room_id: {room_id_str}")
                            continue
                        
                        # daily_data é uma lista de dados diários
                        if isinstance(daily_data, list):
                            for day_index, day_data in enumerate(daily_data):
                                try:
                                    # Calcular data baseada no índice e data inicial
                                    base_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                                    avail_date = base_date + timedelta(days=day_index)
                                    
                                    # Buscar ou criar disponibilidade no PMS
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
                                    
                                    # Atualizar campos baseado na estrutura WuBook
                                    if isinstance(day_data, dict):
                                        wb_available = day_data.get('avail', 0)
                                        pms_avail.is_available = wb_available > 0
                                        pms_avail.closed_to_arrival = bool(day_data.get('closed_arrival', 0))
                                        pms_avail.closed_to_departure = bool(day_data.get('closed_departure', 0))
                                        pms_avail.min_stay = day_data.get('min_stay', 1)
                                        
                                        if day_data.get('max_stay', 0) > 0:
                                            pms_avail.max_stay = day_data.get('max_stay')
                                    else:
                                        # Se day_data não é dict, usar valores padrão
                                        pms_avail.is_available = True
                                        pms_avail.min_stay = 1
                                    
                                    pms_avail.mark_sync_success()
                                    pms_avail.update_bookable_status()
                                    synced_count += 1
                                    
                                except Exception as e:
                                    error_msg = f"Erro ao processar dia {day_index} do quarto {room_id_str}: {str(e)}"
                                    errors.append(error_msg)
                                    logger.error(error_msg)
                        else:
                            logger.warning(f"daily_data não é lista para room {room_id_str}: {type(daily_data)}")
                            
                elif isinstance(wubook_availability, list):
                    # Se for lista (formato antigo/alternativo)
                    for wb_avail in wubook_availability:
                        try:
                            if isinstance(wb_avail, dict):
                                room_id = wb_avail.get('room_id')
                                mapping = mapping_dict.get(room_id)
                                if not mapping:
                                    continue
                                
                                # Converter data
                                avail_date = datetime.strptime(wb_avail['date'], '%Y-%m-%d').date()
                                
                                # Buscar ou criar disponibilidade no PMS
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
                                
                                # Atualizar disponibilidade
                                wb_available = wb_avail.get('available', 0)
                                pms_avail.is_available = wb_available > 0
                                pms_avail.mark_sync_success()
                                
                                synced_count += 1
                            else:
                                errors.append(f"Item da lista não é dict: {type(wb_avail)}")
                                
                        except Exception as e:
                            error_msg = f"Erro ao processar item da lista: {str(e)}"
                            errors.append(error_msg)
                            logger.error(error_msg)
                else:
                    # Tipo inesperado
                    error_msg = f"Tipo inesperado de wubook_availability: {type(wubook_availability)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                    
            except Exception as e:
                error_msg = f"Erro ao processar dados do WuBook: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
            
            # Commit das alterações
            if synced_count > 0:
                self.db.commit()
            
            return {
                "success": synced_count > 0 or len(errors) == 0,
                "message": f"Sincronização concluída: {synced_count} sucessos, {len(errors)} erros",
                "synced_count": synced_count,
                "errors": errors[:5]  # Limitar para evitar logs excessivos
            }
            
        except Exception as e:
            if self.db:
                self.db.rollback()
            logger.error(f"Erro na sincronização de disponibilidade: {str(e)}")
            raise
    
    def sync_availability_to_wubook(
        self,
        tenant_id: int,
        configuration_id: int,
        room_ids: Optional[List[int]] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sincronizar disponibilidade do PMS para o WuBook - CORRIGIDO"""
        
        if not self.db:
            raise ValueError("Database session required for availability sync")
        
        try:
            # Buscar configuração
            config = self.db.query(WuBookConfiguration).filter(
                WuBookConfiguration.id == configuration_id,
                WuBookConfiguration.tenant_id == tenant_id
            ).first()
            
            if not config:
                raise ValueError(f"Configuração {configuration_id} não encontrada")
            
            # Criar cliente
            client = self.get_client_for_configuration(config)
            
            # Definir período padrão se não informado
            if not date_from:
                date_from = date.today()
            if not date_to:
                date_to = date_from + timedelta(days=30)
            
            # Buscar mapeamentos e disponibilidades
            mappings_query = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.configuration_id == configuration_id,
                WuBookRoomMapping.is_active == True,
                WuBookRoomMapping.sync_availability == True
            )
            
            if room_ids:
                mappings_query = mappings_query.filter(
                    WuBookRoomMapping.room_id.in_(room_ids)
                )
            
            mappings = mappings_query.all()
            
            if not mappings:
                return {
                    "success": True,
                    "message": "Nenhum mapeamento encontrado",
                    "synced_count": 0
                }
            
            # Buscar disponibilidades pendentes de sincronização
            pms_room_ids = [m.room_id for m in mappings]
            
            availabilities = self.db.query(RoomAvailability).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.room_id.in_(pms_room_ids),
                RoomAvailability.date >= date_from,
                RoomAvailability.date <= date_to,
                RoomAvailability.is_active == True
            ).all()
            
            # Criar mapa de mapeamentos
            room_mapping_dict = {m.room_id: m for m in mappings}
            
            # Preparar dados para WuBook
            wubook_updates = []
            
            for avail in availabilities:
                mapping = room_mapping_dict.get(avail.room_id)
                if not mapping:
                    continue
                
                # Converter para formato WuBook
                wubook_data = {
                    'room_id': mapping.wubook_room_id,
                    'date': avail.date.strftime('%Y-%m-%d'),
                    'available': 1 if avail.is_bookable else 0,
                    'closed_to_arrival': avail.closed_to_arrival,
                    'closed_to_departure': avail.closed_to_departure,
                    'min_stay': avail.min_stay
                }
                
                if avail.max_stay:
                    wubook_data['max_stay'] = avail.max_stay
                
                wubook_updates.append(wubook_data)
            
            # CORREÇÃO PRINCIPAL: Enviar para WuBook com tratamento robusto
            if wubook_updates:
                try:
                    result = client.update_availability(wubook_updates)
                    
                    # IMPORTANTE: Verificar o tipo do resultado
                    logger.debug(f"WuBook result type: {type(result)}, content: {result}")
                    
                    if isinstance(result, dict):
                        # Resultado é dicionário - verificar sucesso
                        if result.get("success"):
                            # Marcar como sincronizado
                            for avail in availabilities:
                                avail.mark_sync_success()
                            
                            self.db.commit()
                            
                            return {
                                "success": True,
                                "message": f"Sincronização para WuBook concluída",
                                "synced_count": len(wubook_updates),
                                "wubook_response": result
                            }
                        else:
                            # Erro reportado pelo WuBook
                            error_msg = result.get("message", "Erro desconhecido no WuBook")
                            logger.error(f"Erro WuBook: {error_msg}")
                            
                            return {
                                "success": False,
                                "message": f"Erro no WuBook: {error_msg}",
                                "synced_count": 0,
                                "wubook_response": result
                            }
                    
                    elif isinstance(result, str):
                        # Resultado é string - erro na comunicação
                        logger.error(f"Erro WuBook (string): {result}")
                        
                        return {
                            "success": False,
                            "message": f"Erro na comunicação: {result}",
                            "synced_count": 0
                        }
                    
                    else:
                        # Tipo inesperado
                        error_msg = f"Resposta inesperada do WuBook: {type(result)} - {result}"
                        logger.error(error_msg)
                        
                        return {
                            "success": False,
                            "message": error_msg,
                            "synced_count": 0
                        }
                
                except Exception as wubook_error:
                    error_msg = f"Erro ao comunicar com WuBook: {str(wubook_error)}"
                    logger.error(error_msg)
                    
                    return {
                        "success": False,
                        "message": error_msg,
                        "synced_count": 0
                    }
            else:
                return {
                    "success": True,
                    "message": "Nenhuma disponibilidade para sincronizar",
                    "synced_count": 0
                }
                
        except Exception as e:
            if self.db:
                self.db.rollback()
            logger.error(f"Erro ao sincronizar para WuBook: {str(e)}")
            raise
    
    def sync_bidirectional_availability(
        self,
        tenant_id: int,
        configuration_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sincronização bidirecional de disponibilidade - CORRIGIDO"""
        
        try:
            # Primeiro: sincronizar do WuBook para PMS
            try:
                from_wubook = self.sync_availability_from_wubook(
                    tenant_id=tenant_id,
                    configuration_id=configuration_id,
                    start_date=(date_from or date.today()).strftime('%Y-%m-%d'),
                    end_date=(date_to or date.today() + timedelta(days=30)).strftime('%Y-%m-%d')
                )
            except Exception as e:
                logger.error(f"Erro na sincronização FROM WuBook: {str(e)}")
                from_wubook = {
                    "success": False,
                    "message": f"Erro FROM WuBook: {str(e)}",
                    "synced_count": 0
                }
            
            # Segundo: sincronizar do PMS para WuBook
            try:
                to_wubook = self.sync_availability_to_wubook(
                    tenant_id=tenant_id,
                    configuration_id=configuration_id,
                    date_from=date_from,
                    date_to=date_to
                )
            except Exception as e:
                logger.error(f"Erro na sincronização TO WuBook: {str(e)}")
                to_wubook = {
                    "success": False,
                    "message": f"Erro TO WuBook: {str(e)}",
                    "synced_count": 0
                }
            
            # Verificar se ambas as sincronizações foram bem-sucedidas
            overall_success = from_wubook.get("success", False) and to_wubook.get("success", False)
            
            return {
                "success": overall_success,
                "message": "Sincronização bidirecional concluída" if overall_success else "Sincronização bidirecional com erros",
                "from_wubook": from_wubook,
                "to_wubook": to_wubook
            }
            
        except Exception as e:
            logger.error(f"Erro na sincronização bidirecional: {str(e)}")
            return {
                "success": False,
                "message": f"Erro na sincronização bidirecional: {str(e)}",
                "from_wubook": {"success": False, "message": "Não executado devido a erro"},
                "to_wubook": {"success": False, "message": "Não executado devido a erro"}
            }
    
    def get_sync_status(self, tenant_id: int, configuration_id: int) -> Dict[str, Any]:
        """Busca status da sincronização"""
        
        if not self.db:
            return {"error": "Database session required"}
        
        try:
            # Contar disponibilidades pendentes
            pending_count = self.db.query(RoomAvailability).join(Room).join(
                WuBookRoomMapping,
                and_(
                    WuBookRoomMapping.room_id == Room.id,
                    WuBookRoomMapping.configuration_id == configuration_id
                )
            ).filter(
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.sync_pending == True,
                RoomAvailability.is_active == True
            ).count()
            
            # Última sincronização
            last_sync = self.db.query(WuBookSyncLog).filter(
                WuBookSyncLog.configuration_id == configuration_id,
                WuBookSyncLog.sync_type == 'availability'
            ).order_by(WuBookSyncLog.created_at.desc()).first()
            
            return {
                "pending_sync_count": pending_count,
                "last_sync_at": last_sync.completed_at if last_sync else None,
                "last_sync_status": last_sync.status if last_sync else None,
                "last_sync_message": last_sync.error_message if last_sync else None
            }
            
        except Exception as e:
            logger.error(f"Erro ao buscar status: {str(e)}")
            return {"error": str(e)}
    
    def test_connection(self, configuration_id: Optional[int] = None) -> Dict[str, Any]:
        """Testa conexão com WuBook"""
        try:
            if configuration_id and self.db:
                config = self.db.query(WuBookConfiguration).filter(
                    WuBookConfiguration.id == configuration_id
                ).first()
                if not config:
                    return {
                        "success": False,
                        "message": f"Configuração {configuration_id} não encontrada"
                    }
                client = self.get_client_for_configuration(config)
            else:
                client = self.get_default_client()
            
            # Usar método de teste do cliente
            return client.test_connection()
            
        except Exception as e:
            logger.error(f"Erro ao testar conexão: {str(e)}")
            return {
                "success": False,
                "message": f"Erro na conexão: {str(e)}"
            }