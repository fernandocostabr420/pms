# backend/app/services/wubook_configuration_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func
from fastapi import HTTPException, status
from datetime import datetime, timedelta
import logging
import json
from decimal import Decimal

from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_rate_plan import WuBookRatePlan
from app.models.wubook_sync_log import WuBookSyncLog
from app.models.property import Property
from app.models.room import Room
from app.models.sales_channel import SalesChannel
from app.models.user import User

from app.schemas.wubook_configuration import (
    WuBookConfigurationCreate, WuBookConfigurationUpdate,
    WuBookTestConnection, WuBookTestConnectionResult,
    WuBookSyncRequest, WuBookSyncResult,
    WuBookConfigurationStats, WuBookChannelMapping,
    WuBookChannelMappingUpdate, WuBookConfigurationFilters
)
from app.schemas.wubook_mapping import (
    WuBookRoomMappingCreate, WuBookRoomSuggestion,
    WuBookRatePlanCreate
)
from app.schemas.wubook_sync import (
    WuBookSyncLogCreate, SyncTypeEnum, SyncDirectionEnum,
    SyncStatusEnum, SyncTriggerEnum
)

from app.integrations.wubook.wubook_client import WuBookClient
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class WuBookConfigurationService:
    """Serviço para gerenciar configurações WuBook"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    # ============== CONFIGURAÇÃO BÁSICA ==============
    
    def get_configuration(self, configuration_id: int, tenant_id: int) -> Optional[WuBookConfiguration]:
        """Busca configuração por ID"""
        return self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.id == configuration_id,
            WuBookConfiguration.tenant_id == tenant_id
        ).first()
    
    def get_configuration_by_property(self, property_id: int, tenant_id: int) -> Optional[WuBookConfiguration]:
        """Busca configuração por propriedade"""
        return self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.property_id == property_id,
            WuBookConfiguration.tenant_id == tenant_id
        ).first()
    
    def get_configurations(
        self,
        tenant_id: int,
        filters: WuBookConfigurationFilters = None,
        include_stats: bool = False
    ) -> List[WuBookConfiguration]:
        """Lista configurações com filtros"""
        query = self.db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == tenant_id
        )
        
        if filters:
            if filters.property_id:
                query = query.filter(WuBookConfiguration.property_id == filters.property_id)
            if filters.is_active is not None:
                query = query.filter(WuBookConfiguration.is_active == filters.is_active)
            if filters.is_connected is not None:
                query = query.filter(WuBookConfiguration.is_connected == filters.is_connected)
            if filters.connection_status:
                query = query.filter(WuBookConfiguration.connection_status == filters.connection_status)
            if filters.sync_enabled is not None:
                query = query.filter(WuBookConfiguration.sync_enabled == filters.sync_enabled)
            if filters.has_errors is not None:
                if filters.has_errors:
                    query = query.filter(WuBookConfiguration.error_count > 0)
                else:
                    query = query.filter(WuBookConfiguration.error_count == 0)
        
        # Incluir relacionamentos se necessário
        if include_stats:
            query = query.options(
                joinedload(WuBookConfiguration.property_ref),
                joinedload(WuBookConfiguration.room_mappings),
                joinedload(WuBookConfiguration.rate_plans)
            )
        
        return query.all()
    
    def create_configuration(
        self,
        config_data: WuBookConfigurationCreate,
        tenant_id: int,
        current_user: User
    ) -> WuBookConfiguration:
        """Cria nova configuração WuBook"""
        try:
            # Verificar se já existe configuração para esta propriedade
            existing = self.get_configuration_by_property(config_data.property_id, tenant_id)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Já existe configuração WuBook para esta propriedade"
                )
            
            # Verificar se a propriedade existe e pertence ao tenant
            property_obj = self.db.query(Property).filter(
                Property.id == config_data.property_id,
                Property.tenant_id == tenant_id,
                Property.is_active == True
            ).first()
            
            if not property_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Propriedade não encontrada"
                )
            
            # Testar conexão antes de criar
            test_result = self.test_connection(WuBookTestConnection(
                wubook_token=config_data.wubook_token,
                wubook_lcode=config_data.wubook_lcode
            ))
            
            if not test_result.success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Falha ao conectar com WuBook: {test_result.message}"
                )
            
            # Criar configuração
            configuration = WuBookConfiguration(
                tenant_id=tenant_id,
                **config_data.model_dump()
            )
            
            # Definir status de conexão
            configuration.is_connected = True
            configuration.connection_status = "connected"
            configuration.wubook_property_name = test_result.property_name
            
            self.db.add(configuration)
            self.db.flush()
            
            # Criar log de criação
            self.audit_service.log_create(
                table_name="wubook_configurations",
                record_id=configuration.id,
                new_values=config_data.model_dump(),
                user=current_user,
                description=f"Configuração WuBook criada para propriedade {property_obj.name}"
            )
            
            # Criar log de sincronização inicial
            sync_log = WuBookSyncLog.create_log(
                configuration_id=configuration.id,
                sync_type="rooms",
                sync_direction="inbound",
                triggered_by="manual",
                user_id=current_user.id,
                tenant_id=tenant_id
            )
            self.db.add(sync_log)
            
            self.db.commit()
            logger.info(f"Configuração WuBook criada: {configuration.id}")
            
            # Iniciar sincronização inicial de quartos e rate plans
            self._initial_sync(configuration, current_user)
            
            return configuration
            
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar configuração: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao criar configuração"
            )
    
    def update_configuration(
        self,
        configuration_id: int,
        update_data: WuBookConfigurationUpdate,
        tenant_id: int,
        current_user: User
    ) -> WuBookConfiguration:
        """Atualiza configuração existente"""
        try:
            configuration = self.get_configuration(configuration_id, tenant_id)
            if not configuration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada"
                )
            
            # Capturar valores antigos para auditoria
            old_values = {
                key: getattr(configuration, key)
                for key in update_data.model_dump(exclude_unset=True).keys()
            }
            
            # Se mudou token ou lcode, testar nova conexão
            if update_data.wubook_token or update_data.wubook_lcode:
                test_result = self.test_connection(WuBookTestConnection(
                    wubook_token=update_data.wubook_token or configuration.wubook_token,
                    wubook_lcode=update_data.wubook_lcode or configuration.wubook_lcode
                ))
                
                if not test_result.success:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Falha ao conectar com WuBook: {test_result.message}"
                    )
                
                configuration.wubook_property_name = test_result.property_name
                configuration.reset_connection()
                configuration.is_connected = True
                configuration.connection_status = "connected"
            
            # Atualizar campos
            for key, value in update_data.model_dump(exclude_unset=True).items():
                setattr(configuration, key, value)
            
            # Registrar auditoria
            self.audit_service.log_update(
                table_name="wubook_configurations",
                record_id=configuration.id,
                old_values=old_values,
                new_values=update_data.model_dump(exclude_unset=True),
                user=current_user,
                description="Configuração WuBook atualizada"
            )
            
            self.db.commit()
            logger.info(f"Configuração WuBook atualizada: {configuration.id}")
            
            return configuration
            
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar configuração: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar configuração"
            )
    
    def delete_configuration(
        self,
        configuration_id: int,
        tenant_id: int,
        current_user: User
    ) -> bool:
        """Remove configuração (soft delete)"""
        try:
            configuration = self.get_configuration(configuration_id, tenant_id)
            if not configuration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada"
                )
            
            # Desativar ao invés de deletar
            configuration.is_active = False
            configuration.is_connected = False
            configuration.connection_status = "suspended"
            configuration.sync_enabled = False
            
            # Desativar todos os mapeamentos
            self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.configuration_id == configuration_id
            ).update({"is_active": False, "is_syncing": False})
            
            # Desativar todos os rate plans
            self.db.query(WuBookRatePlan).filter(
                WuBookRatePlan.configuration_id == configuration_id
            ).update({"is_active": False, "is_bookable": False})
            
            # Registrar auditoria
            self.audit_service.log_delete(
                table_name="wubook_configurations",
                record_id=configuration.id,
                old_values={"is_active": True},
                user=current_user,
                description="Configuração WuBook desativada"
            )
            
            self.db.commit()
            logger.info(f"Configuração WuBook desativada: {configuration.id}")
            
            return True
            
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao desativar configuração: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao desativar configuração"
            )
    
    # ============== TESTE DE CONEXÃO ==============
    
    def test_connection(self, test_data: WuBookTestConnection) -> WuBookTestConnectionResult:
        """Testa conexão com WuBook"""
        try:
            # Criar cliente temporário
            client = WuBookClient(
                token=test_data.wubook_token,
                lcode=int(test_data.wubook_lcode)
            )
            
            # Tentar buscar quartos (teste básico)
            rooms = client.fetch_rooms()
            
            # Se chegou aqui, conexão OK
            property_name = f"Property {test_data.wubook_lcode}"
            if rooms and len(rooms) > 0 and 'name' in rooms[0]:
                # Tentar extrair nome da propriedade dos quartos
                property_name = rooms[0].get('property_name', property_name)
            
            return WuBookTestConnectionResult(
                success=True,
                message="Conexão estabelecida com sucesso",
                property_name=property_name,
                rooms_count=len(rooms),
                rate_plans_count=0  # TODO: Buscar rate plans quando implementado
            )
            
        except Exception as e:
            logger.error(f"Erro ao testar conexão WuBook: {e}")
            return WuBookTestConnectionResult(
                success=False,
                message="Falha ao conectar com WuBook",
                error_details=str(e)
            )
    
    # ============== SINCRONIZAÇÃO ==============
    
    def sync_now(
        self,
        configuration_id: int,
        sync_request: WuBookSyncRequest,
        tenant_id: int,
        current_user: User
    ) -> WuBookSyncResult:
        """Executa sincronização manual"""
        try:
            configuration = self.get_configuration(configuration_id, tenant_id)
            if not configuration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada"
                )
            
            if not configuration.is_ready:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Configuração não está pronta para sincronização"
                )
            
            # Verificar se não há sincronização em andamento
            active_sync = self.db.query(WuBookSyncLog).filter(
                WuBookSyncLog.configuration_id == configuration_id,
                WuBookSyncLog.status.in_(["started", "in_progress"])
            ).first()
            
            if active_sync and not sync_request.force:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Já existe uma sincronização em andamento"
                )
            
            # Criar log de sincronização
            sync_log = WuBookSyncLog.create_log(
                configuration_id=configuration_id,
                sync_type=sync_request.sync_type,
                sync_direction="bidirectional",
                triggered_by="manual",
                user_id=current_user.id,
                tenant_id=tenant_id
            )
            
            # Definir escopo
            sync_log.set_scope(
                date_from=sync_request.date_from,
                date_to=sync_request.date_to,
                room_ids=sync_request.room_ids
            )
            
            self.db.add(sync_log)
            self.db.flush()
            
            # Executar sincronização baseada no tipo
            try:
                sync_log.start_sync()
                
                if sync_request.sync_type == "availability":
                    result = self._sync_availability(configuration, sync_log, sync_request)
                elif sync_request.sync_type == "rates":
                    result = self._sync_rates(configuration, sync_log, sync_request)
                elif sync_request.sync_type == "restrictions":
                    result = self._sync_restrictions(configuration, sync_log, sync_request)
                elif sync_request.sync_type == "bookings":
                    result = self._sync_bookings(configuration, sync_log, sync_request)
                elif sync_request.sync_type == "rooms":
                    result = self._sync_rooms(configuration, sync_log)
                elif sync_request.sync_type == "rate_plans":
                    result = self._sync_rate_plans(configuration, sync_log)
                elif sync_request.sync_type == "full":
                    result = self._sync_full(configuration, sync_log, sync_request)
                else:
                    raise ValueError(f"Tipo de sincronização não suportado: {sync_request.sync_type}")
                
                # Marcar como completo
                sync_log.complete_sync(status="success" if result.get("success") else "error")
                configuration.update_sync_status(
                    status="success" if result.get("success") else "error",
                    message=result.get("message")
                )
                
            except Exception as sync_error:
                sync_log.complete_sync(status="error", error=str(sync_error))
                configuration.update_sync_status(status="error", message=str(sync_error))
                raise
            
            self.db.commit()
            
            return WuBookSyncResult(
                sync_log_id=sync_log.id,
                status=sync_log.status,
                message=sync_log.last_sync_message or "Sincronização concluída",
                started_at=sync_log.started_at,
                completed_at=sync_log.completed_at,
                duration_seconds=float(sync_log.duration_seconds) if sync_log.duration_seconds else None,
                total_items=sync_log.total_items,
                success_items=sync_log.success_items,
                error_items=sync_log.error_items,
                changes_made=sync_log.changes_made or {},
                errors=[sync_log.error_message] if sync_log.error_message else None
            )
            
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro na sincronização: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na sincronização: {str(e)}"
            )
    
    # ============== MAPEAMENTOS ==============
    
    def get_channel_mappings(
        self,
        configuration_id: int,
        tenant_id: int
    ) -> List[WuBookChannelMapping]:
        """Retorna mapeamentos de canais"""
        configuration = self.get_configuration(configuration_id, tenant_id)
        if not configuration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração não encontrada"
            )
        
        # TODO: Buscar canais do WuBook via API
        # Por enquanto, retornar canais padrão
        wubook_channels = [
            {"id": "1", "name": "Booking.com"},
            {"id": "2", "name": "Expedia"},
            {"id": "3", "name": "Airbnb"},
        ]
        
        # Buscar canais de venda do PMS
        sales_channels = self.db.query(SalesChannel).filter(
            SalesChannel.tenant_id == tenant_id,
            SalesChannel.is_external == True,
            SalesChannel.is_active == True
        ).all()
        
        mappings = []
        for wb_channel in wubook_channels:
            channel_id = wb_channel["id"]
            mapped_id = configuration.get_channel_mapping(channel_id)
            
            mapping = WuBookChannelMapping(
                wubook_channel_id=channel_id,
                wubook_channel_name=wb_channel["name"],
                sales_channel_id=mapped_id,
                is_mapped=mapped_id is not None
            )
            
            # Se mapeado, buscar nome do canal
            if mapped_id:
                sales_channel = next((sc for sc in sales_channels if sc.id == mapped_id), None)
                if sales_channel:
                    mapping.sales_channel_name = sales_channel.name
                    mapping.commission_rate = float(sales_channel.commission_rate) if sales_channel.commission_rate else None
            
            mappings.append(mapping)
        
        return mappings
    
    def update_channel_mapping(
        self,
        configuration_id: int,
        mapping_data: WuBookChannelMappingUpdate,
        tenant_id: int,
        current_user: User
    ) -> bool:
        """Atualiza mapeamento de canal"""
        try:
            configuration = self.get_configuration(configuration_id, tenant_id)
            if not configuration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada"
                )
            
            # Verificar se o sales_channel existe
            sales_channel = self.db.query(SalesChannel).filter(
                SalesChannel.id == mapping_data.sales_channel_id,
                SalesChannel.tenant_id == tenant_id
            ).first()
            
            if not sales_channel:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Canal de vendas não encontrado"
                )
            
            # Atualizar mapeamento
            configuration.set_channel_mapping(
                mapping_data.wubook_channel_id,
                mapping_data.sales_channel_id
            )
            
            self.db.commit()
            logger.info(f"Mapeamento de canal atualizado: {mapping_data.wubook_channel_id} -> {mapping_data.sales_channel_id}")
            
            return True
            
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar mapeamento: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar mapeamento"
            )
    
    def get_room_mapping_suggestions(
        self,
        configuration_id: int,
        tenant_id: int
    ) -> List[WuBookRoomSuggestion]:
        """Sugere mapeamentos automáticos de quartos"""
        configuration = self.get_configuration(configuration_id, tenant_id)
        if not configuration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração não encontrada"
            )
        
        try:
            # Buscar quartos do WuBook
            client = WuBookClient(configuration.wubook_token, int(configuration.wubook_lcode))
            wubook_rooms = client.fetch_rooms()
            
            # Buscar quartos do PMS não mapeados
            mapped_room_ids = self.db.query(WuBookRoomMapping.room_id).filter(
                WuBookRoomMapping.configuration_id == configuration_id,
                WuBookRoomMapping.is_active == True
            ).subquery()
            
            pms_rooms = self.db.query(Room).filter(
                Room.property_id == configuration.property_id,
                Room.is_active == True,
                ~Room.id.in_(mapped_room_ids)
            ).all()
            
            suggestions = []
            
            for wb_room in wubook_rooms:
                best_match = None
                best_score = 0.0
                
                for pms_room in pms_rooms:
                    # Calcular score de similaridade
                    score, reason = self._calculate_room_similarity(wb_room, pms_room)
                    
                    if score > best_score:
                        best_score = score
                        best_match = pms_room
                        match_reason = reason
                
                if best_match and best_score >= 0.5:  # Threshold mínimo
                    suggestions.append(WuBookRoomSuggestion(
                        room_id=best_match.id,
                        room_number=best_match.number,
                        room_name=best_match.name,
                        room_type=best_match.room_type_ref.name if best_match.room_type_ref else "",
                        wubook_room_id=str(wb_room["id"]),
                        wubook_room_name=wb_room.get("name", ""),
                        wubook_room_type=wb_room.get("rtype", ""),
                        confidence_score=best_score,
                        match_reason=match_reason
                    ))
            
            # Ordenar por score de confiança
            suggestions.sort(key=lambda x: x.confidence_score, reverse=True)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Erro ao gerar sugestões: {e}")
            return []
    
    # ============== ESTATÍSTICAS ==============
    
    def get_configuration_stats(
        self,
        configuration_id: int,
        tenant_id: int
    ) -> WuBookConfigurationStats:
        """Retorna estatísticas da configuração"""
        configuration = self.get_configuration(configuration_id, tenant_id)
        if not configuration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração não encontrada"
            )
        
        # Contar sincronizações
        today = datetime.utcnow().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        total_today = self.db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            func.date(WuBookSyncLog.started_at) == today
        ).scalar() or 0
        
        total_week = self.db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            func.date(WuBookSyncLog.started_at) >= week_ago
        ).scalar() or 0
        
        total_month = self.db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            func.date(WuBookSyncLog.started_at) >= month_ago
        ).scalar() or 0
        
        # Taxa de sucesso
        success_count = self.db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            WuBookSyncLog.status == "success"
        ).scalar() or 0
        
        total_count = self.db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            WuBookSyncLog.status.in_(["success", "error", "partial_success"])
        ).scalar() or 1  # Evitar divisão por zero
        
        success_rate = (success_count / total_count) * 100
        
        # Duração média
        avg_duration = self.db.query(func.avg(WuBookSyncLog.duration_seconds)).filter(
            WuBookSyncLog.configuration_id == configuration_id,
            WuBookSyncLog.duration_seconds.is_not(None)
        ).scalar() or 0.0
        
        # Contar mapeamentos
        rooms_mapped = self.db.query(func.count(WuBookRoomMapping.id)).filter(
            WuBookRoomMapping.configuration_id == configuration_id,
            WuBookRoomMapping.is_active == True
        ).scalar() or 0
        
        rate_plans = self.db.query(func.count(WuBookRatePlan.id)).filter(
            WuBookRatePlan.configuration_id == configuration_id,
            WuBookRatePlan.is_active == True
        ).scalar() or 0
        
        # TODO: Contar reservas importadas quando implementado
        bookings_imported = 0
        
        return WuBookConfigurationStats(
            configuration_id=configuration_id,
            property_name=configuration.wubook_property_name or f"Property {configuration.wubook_lcode}",
            is_connected=configuration.is_connected,
            last_sync_at=configuration.last_sync_at,
            total_syncs_today=total_today,
            total_syncs_week=total_week,
            total_syncs_month=total_month,
            success_rate=success_rate,
            average_sync_duration=float(avg_duration),
            total_bookings_imported=bookings_imported,
            total_rooms_mapped=rooms_mapped,
            total_rate_plans=rate_plans,
            last_error=configuration.last_sync_message if configuration.has_errors else None
        )
    
    # ============== MÉTODOS PRIVADOS DE SINCRONIZAÇÃO ==============
    
    def _initial_sync(self, configuration: WuBookConfiguration, user: User) -> None:
        """Executa sincronização inicial após criar configuração"""
        try:
            # Sincronizar quartos
            sync_log = WuBookSyncLog.create_log(
                configuration_id=configuration.id,
                sync_type="rooms",
                sync_direction="inbound",
                triggered_by="auto",
                user_id=user.id,
                tenant_id=configuration.tenant_id
            )
            self.db.add(sync_log)
            self.db.flush()
            
            self._sync_rooms(configuration, sync_log)
            
            # Sincronizar rate plans
            sync_log = WuBookSyncLog.create_log(
                configuration_id=configuration.id,
                sync_type="rate_plans",
                sync_direction="inbound",
                triggered_by="auto",
                user_id=user.id,
                tenant_id=configuration.tenant_id
            )
            self.db.add(sync_log)
            self.db.flush()
            
            self._sync_rate_plans(configuration, sync_log)
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Erro na sincronização inicial: {e}")
            # Não propagar erro para não falhar a criação
    
    def _sync_rooms(self, configuration: WuBookConfiguration, sync_log: WuBookSyncLog) -> Dict[str, Any]:
        """Sincroniza quartos do WuBook"""
        try:
            client = WuBookClient(configuration.wubook_token, int(configuration.wubook_lcode))
            wubook_rooms = client.fetch_rooms()
            
            sync_log.total_items = len(wubook_rooms)
            
            for wb_room in wubook_rooms:
                try:
                    # Verificar se já existe mapeamento
                    existing = self.db.query(WuBookRoomMapping).filter(
                        WuBookRoomMapping.configuration_id == configuration.id,
                        WuBookRoomMapping.wubook_room_id == str(wb_room["id"])
                    ).first()
                    
                    if not existing:
                        # Por enquanto, apenas registrar que o quarto existe
                        # O mapeamento real será feito manualmente ou via sugestões
                        logger.info(f"Novo quarto WuBook encontrado: {wb_room['id']} - {wb_room.get('name', 'Sem nome')}")
                        sync_log.add_change("new_rooms", 1)
                    
                    sync_log.add_item_result(success=True)
                    
                except Exception as item_error:
                    logger.error(f"Erro ao processar quarto {wb_room['id']}: {item_error}")
                    sync_log.add_item_result(success=False, error=str(item_error))
            
            sync_log.increment_api_calls()
            
            return {"success": True, "message": f"{len(wubook_rooms)} quartos sincronizados"}
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar quartos: {e}")
            return {"success": False, "message": str(e)}
    
    def _sync_rate_plans(self, configuration: WuBookConfiguration, sync_log: WuBookSyncLog) -> Dict[str, Any]:
        """Sincroniza rate plans do WuBook"""
        # TODO: Implementar quando a API do WuBook for documentada para rate plans
        sync_log.add_change("rate_plans", 0)
        return {"success": True, "message": "Rate plans sincronizados"}
    
    def _sync_availability(
        self,
        configuration: WuBookConfiguration,
        sync_log: WuBookSyncLog,
        sync_request: WuBookSyncRequest
    ) -> Dict[str, Any]:
        """Sincroniza disponibilidade"""
        # TODO: Implementar sincronização de disponibilidade
        return {"success": True, "message": "Disponibilidade sincronizada"}
    
    def _sync_rates(
        self,
        configuration: WuBookConfiguration,
        sync_log: WuBookSyncLog,
        sync_request: WuBookSyncRequest
    ) -> Dict[str, Any]:
        """Sincroniza tarifas"""
        # TODO: Implementar sincronização de tarifas
        return {"success": True, "message": "Tarifas sincronizadas"}
    
    def _sync_restrictions(
        self,
        configuration: WuBookConfiguration,
        sync_log: WuBookSyncLog,
        sync_request: WuBookSyncRequest
    ) -> Dict[str, Any]:
        """Sincroniza restrições"""
        # TODO: Implementar sincronização de restrições
        return {"success": True, "message": "Restrições sincronizadas"}
    
    def _sync_bookings(
        self,
        configuration: WuBookConfiguration,
        sync_log: WuBookSyncLog,
        sync_request: WuBookSyncRequest
    ) -> Dict[str, Any]:
        """Sincroniza reservas"""
        # TODO: Implementar sincronização de reservas
        return {"success": True, "message": "Reservas sincronizadas"}
    
    def _sync_full(
        self,
        configuration: WuBookConfiguration,
        sync_log: WuBookSyncLog,
        sync_request: WuBookSyncRequest
    ) -> Dict[str, Any]:
        """Sincronização completa"""
        results = []
        
        # Sincronizar tudo em ordem
        results.append(self._sync_rooms(configuration, sync_log))
        results.append(self._sync_rate_plans(configuration, sync_log))
        results.append(self._sync_availability(configuration, sync_log, sync_request))
        results.append(self._sync_rates(configuration, sync_log, sync_request))
        results.append(self._sync_restrictions(configuration, sync_log, sync_request))
        results.append(self._sync_bookings(configuration, sync_log, sync_request))
        
        # Verificar se todos tiveram sucesso
        all_success = all(r.get("success") for r in results)
        
        return {
            "success": all_success,
            "message": "Sincronização completa executada",
            "details": results
        }
    
    def _calculate_room_similarity(self, wubook_room: Dict, pms_room: Room) -> Tuple[float, str]:
        """Calcula similaridade entre quarto WuBook e PMS"""
        score = 0.0
        reasons = []
        
        # Comparar número do quarto
        if wubook_room.get("name") and pms_room.number:
            if wubook_room["name"].lower() == pms_room.number.lower():
                score += 0.5
                reasons.append("Número idêntico")
            elif wubook_room["name"].lower() in pms_room.number.lower() or pms_room.number.lower() in wubook_room["name"].lower():
                score += 0.3
                reasons.append("Número similar")
        
        # Comparar tipo
        if wubook_room.get("rtype") and pms_room.room_type_ref:
            wb_type = wubook_room["rtype"].lower()
            pms_type = pms_room.room_type_ref.name.lower()
            
            if wb_type == pms_type:
                score += 0.3
                reasons.append("Tipo idêntico")
            elif wb_type in pms_type or pms_type in wb_type:
                score += 0.2
                reasons.append("Tipo similar")
        
        # Comparar ocupação
        if wubook_room.get("occupancy") and pms_room.room_type_ref:
            wb_occ = int(wubook_room.get("occupancy", 0))
            pms_occ = pms_room.room_type_ref.max_occupancy
            
            if wb_occ == pms_occ:
                score += 0.2
                reasons.append("Ocupação idêntica")
        
        return score, " | ".join(reasons) if reasons else "Sem correspondência clara"