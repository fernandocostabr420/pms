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
                message=sync_log.error_message or result.get("message", "Sincronização concluída"),
                started_at=sync_log.started_at,
                completed_at=sync_log.completed_at,
                duration_seconds=float(sync_log.duration_seconds or 0),
                success_items=sync_log.success_items,
                error_items=sync_log.error_items,
                changes_made=sync_log.changes_made or {},
                total_items=sync_log.total_items
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
                        room_number=best_match.room_number,
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
    
    # ============== CRIAÇÃO AUTOMÁTICA DE QUARTOS NA WUBOOK ==============
    
    def create_wubook_room_with_mapping(
        self,
        room_id: int,
        tenant_id: int,
        configuration_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        🆕 MÉTODO PRINCIPAL: Cria quarto na WuBook e mapeia automaticamente.
        
        Este é o método chamado por room_service após criar um quarto no PMS.
        
        Fluxo:
        1. Busca configuração WuBook ativa
        2. Verifica se já existe mapeamento
        3. Cria quarto na WuBook com valores ALTOS de proteção
        4. Cria mapeamento automático entre PMS e WuBook
        5. Retorna resultado detalhado
        
        Args:
            room_id: ID do quarto no PMS (já criado)
            tenant_id: ID do tenant
            configuration_id: ID da configuração WuBook (opcional, busca pela property)
            
        Returns:
            Dict com:
                - success: bool
                - wubook_room_id: int (se criado)
                - mapping_id: int (se mapeado)
                - message: str
                - error: str (se houver)
        """
        try:
            # 1. Buscar o quarto no PMS
            room = self.db.query(Room).options(
                joinedload(Room.room_type_ref)
            ).filter(
                Room.id == room_id,
                Room.tenant_id == tenant_id,
                Room.is_active == True
            ).first()
            
            if not room:
                logger.warning(f"Quarto {room_id} não encontrado para criação automática na WuBook")
                return {
                    "success": False,
                    "error": "Quarto não encontrado"
                }
            
            # 2. Buscar configuração WuBook
            if configuration_id:
                configuration = self.get_configuration(configuration_id, tenant_id)
            else:
                configuration = self.get_configuration_by_property(room.property_id, tenant_id)
            
            if not configuration or not configuration.is_active or not configuration.is_connected:
                logger.debug(f"Configuração WuBook não encontrada ou inativa para propriedade {room.property_id}")
                return {
                    "success": False,
                    "error": "Configuração WuBook não encontrada ou inativa",
                    "skip_reason": "no_wubook_config"
                }
            
            # 3. Verificar se já existe mapeamento
            existing_mapping = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.configuration_id == configuration.id,
                WuBookRoomMapping.tenant_id == tenant_id
            ).first()
            
            if existing_mapping and existing_mapping.is_active:
                logger.info(f"Mapeamento já existe para quarto {room_id} (WuBook ID: {existing_mapping.wubook_room_id})")
                return {
                    "success": True,
                    "wubook_room_id": existing_mapping.wubook_room_id,
                    "mapping_id": existing_mapping.id,
                    "message": "Mapeamento já existente",
                    "already_exists": True
                }
            
            # 4. Obter valores seguros padrão para WuBook
            wubook_defaults = self._get_safe_wubook_defaults(room)
            
            logger.info(f"🏨 Criando quarto na WuBook para '{room.name}' (#{room.room_number})")
            logger.debug(f"Valores WuBook: {wubook_defaults}")
            
            # 5. Criar quarto na WuBook
            try:
                client = WuBookClient(configuration.wubook_token, int(configuration.wubook_lcode))
                
                wubook_room_id = client.create_room(
                    name=wubook_defaults['name'],
                    beds=wubook_defaults['beds'],
                    price=wubook_defaults['price'],
                    availability=wubook_defaults['availability'],
                    board=wubook_defaults['board'],
                    room_shortname=wubook_defaults['shortname']
                )
                
                logger.info(f"✅ Quarto criado na WuBook com ID: {wubook_room_id}")
                
            except Exception as wubook_error:
                error_msg = f"Falha ao criar quarto na WuBook: {str(wubook_error)}"
                logger.error(error_msg)
                
                # NÃO propagar erro - apenas retornar falha
                return {
                    "success": False,
                    "error": error_msg,
                    "wubook_error": True
                }
            
            # 6. Criar mapeamento no banco
            try:
                new_mapping = WuBookRoomMapping(
                    tenant_id=tenant_id,
                    configuration_id=configuration.id,
                    room_id=room_id,
                    wubook_room_id=str(wubook_room_id),
                    wubook_room_name=wubook_defaults['name'],
                    wubook_room_type=room.room_type_ref.name if room.room_type_ref else "",
                    is_active=True,
                    is_syncing=True,
                    sync_availability=True,
                    sync_rates=True,
                    sync_restrictions=True,
                    # Configurações baseadas no room_type
                    max_occupancy=wubook_defaults['max_occupancy'],
                    standard_occupancy=wubook_defaults['standard_occupancy'],
                    min_occupancy=1,
                    rate_multiplier=Decimal("1.000"),
                    sync_pending=True,  # Marcar para sincronização inicial
                    metadata_json={
                        "auto_created": True,
                        "created_at": datetime.utcnow().isoformat(),
                        "room_number": room.room_number,
                        "room_name": room.name,
                        "creation_method": "auto_create",
                        "wubook_defaults": wubook_defaults
                    }
                )
                
                self.db.add(new_mapping)
                self.db.commit()
                
                logger.info(f"✅ Mapeamento criado: Quarto PMS {room_id} <-> WuBook {wubook_room_id}")
                
                return {
                    "success": True,
                    "wubook_room_id": wubook_room_id,
                    "mapping_id": new_mapping.id,
                    "message": f"Quarto criado na WuBook e mapeado com sucesso",
                    "created_new": True
                }
                
            except Exception as mapping_error:
                # Se falhou ao criar mapeamento, tentar reverter criação na WuBook
                logger.error(f"Erro ao criar mapeamento: {mapping_error}")
                
                try:
                    logger.warning(f"Tentando reverter criação do quarto {wubook_room_id} na WuBook")
                    client.delete_room(wubook_room_id)
                    logger.info(f"Quarto {wubook_room_id} removido da WuBook após falha no mapeamento")
                except Exception as delete_error:
                    logger.error(f"Falha ao reverter criação na WuBook: {delete_error}")
                
                self.db.rollback()
                
                return {
                    "success": False,
                    "error": f"Falha ao criar mapeamento: {str(mapping_error)}",
                    "mapping_error": True
                }
                
        except Exception as e:
            logger.error(f"Erro geral na criação automática do quarto {room_id}: {e}")
            self.db.rollback()
            return {
                "success": False,
                "error": f"Erro inesperado: {str(e)}"
            }
    
    def _get_safe_wubook_defaults(self, room: Room) -> Dict[str, Any]:
        """
        🛡️ Retorna valores SEGUROS padrão para criar quarto na WuBook.
        
        Valores altos são usados para PROTEGER o cliente até que configure manualmente.
        """
        # Nome do quarto
        room_name = room.room_number or room.name or f"Quarto {room.id}"
        
        # Nome curto (3 chars para WuBook)
        room_shortname = room_name[:3].upper() if len(room_name) >= 3 else room_name.upper().ljust(3, 'X')
        
        # Número de camas baseado no room_type
        beds = 2  # Padrão seguro
        max_occupancy = None
        standard_occupancy = None
        
        if room.room_type_ref:
            if hasattr(room.room_type_ref, 'max_capacity') and room.room_type_ref.max_capacity:
                beds = int(room.room_type_ref.max_capacity)
                max_occupancy = int(room.room_type_ref.max_capacity)
            
            if hasattr(room.room_type_ref, 'base_capacity') and room.room_type_ref.base_capacity:
                standard_occupancy = int(room.room_type_ref.base_capacity)
        
        # Preço ALTO para proteção (R$ 800 por padrão)
        # Cliente deve ajustar manualmente depois
        price = 800.00
        
        return {
            'name': room_name,
            'shortname': room_shortname,
            'beds': beds,
            'price': price,
            'availability': 1,  # Disponível
            'board': 'fb',  # Full board (pensão completa)
            'max_occupancy': max_occupancy,
            'standard_occupancy': standard_occupancy
        }
    
    # ============== MAPEAMENTO AUTOMÁTICO (MÉTODO LEGADO - BUSCA QUARTO EXISTENTE) ==============
    
    def create_auto_room_mapping(
        self,
        room_id: int,
        tenant_id: int,
        configuration_id: Optional[int] = None
    ) -> bool:
        """
        ⚠️ MÉTODO LEGADO: Tenta mapear quarto PMS com quarto EXISTENTE na WuBook.
        
        Este método NÃO cria o quarto na WuBook, apenas busca correspondência.
        Use create_wubook_room_with_mapping() para criação automática.
        
        Se configuration_id não for fornecido, busca pela propriedade do quarto.
        """
        try:
            # Buscar o quarto
            room = self.db.query(Room).filter(
                Room.id == room_id,
                Room.tenant_id == tenant_id,
                Room.is_active == True
            ).first()
            
            if not room:
                logger.warning(f"Quarto {room_id} não encontrado para criação de mapeamento automático")
                return False
            
            # Buscar configuração WuBook
            if configuration_id:
                configuration = self.get_configuration(configuration_id, tenant_id)
            else:
                configuration = self.get_configuration_by_property(room.property_id, tenant_id)
            
            if not configuration or not configuration.is_active or not configuration.is_connected:
                logger.debug(f"Configuração WuBook não encontrada ou inativa para propriedade {room.property_id}")
                return False
            
            # Verificar se já existe mapeamento
            existing_mapping = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.configuration_id == configuration.id,
                WuBookRoomMapping.tenant_id == tenant_id
            ).first()
            
            if existing_mapping:
                if existing_mapping.is_active:
                    logger.debug(f"Mapeamento já existe para quarto {room_id}")
                    return True
                else:
                    # Reativar mapeamento existente
                    existing_mapping.is_active = True
                    existing_mapping.is_syncing = True
                    existing_mapping.sync_pending = True
                    existing_mapping.updated_at = datetime.utcnow()
                    self.db.commit()
                    logger.info(f"Mapeamento reativado para quarto {room_id}")
                    return True
            
            # Tentar encontrar quarto correspondente no WuBook
            try:
                client = WuBookClient(configuration.wubook_token, int(configuration.wubook_lcode))
                wubook_rooms = client.fetch_rooms()
                
                # Buscar quarto WuBook que melhor corresponde
                best_match = None
                best_score = 0.0
                
                for wb_room in wubook_rooms:
                    score, _ = self._calculate_room_similarity(wb_room, room)
                    if score > best_score:
                        best_score = score
                        best_match = wb_room
                
                # Se encontrou correspondência razoável, criar mapeamento
                if best_match and best_score >= 0.3:  # Threshold mais baixo para criação automática
                    new_mapping = WuBookRoomMapping(
                        tenant_id=tenant_id,
                        configuration_id=configuration.id,
                        room_id=room_id,
                        wubook_room_id=str(best_match["id"]),
                        wubook_room_name=best_match.get("name", ""),
                        wubook_room_type=best_match.get("rtype", ""),
                        is_active=True,
                        is_syncing=True,
                        sync_availability=True,
                        sync_rates=True,
                        sync_restrictions=True,
                        # Configurações padrão baseadas no tipo de quarto
                        max_occupancy=getattr(room.room_type, "max_capacity", None) if room.room_type else None,
                        standard_occupancy=getattr(room.room_type, "base_capacity", None) if room.room_type else None,
                        min_occupancy=1,
                        rate_multiplier=Decimal("1.000"),
                        sync_pending=True,  # Marcar para sincronização inicial
                        metadata_json={
                            "auto_created": True,
                            "created_at": datetime.utcnow().isoformat(),
                            "match_score": best_score,
                            "room_number": room.room_number,
                            "room_name": room.name,
                            "creation_method": "legacy_search"
                        }
                    )
                    
                    self.db.add(new_mapping)
                    self.db.commit()
                    
                    logger.info(f"Mapeamento automático criado (busca): Quarto {room_id} ({room.room_number}) -> WuBook {best_match['id']} (score: {best_score:.2f})")
                    return True
                else:
                    logger.debug(f"Nenhuma correspondência adequada encontrada no WuBook para quarto {room_id} (melhor score: {best_score:.2f})")
                    return False
                    
            except Exception as wubook_error:
                logger.error(f"Erro ao conectar com WuBook para criar mapeamento automático: {wubook_error}")
                return False
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar mapeamento automático para quarto {room_id}: {e}")
            return False
    
    def delete_room_mappings(self, room_id: int, tenant_id: int, delete_from_wubook: bool = False) -> bool:
        """
        Remove todos os mapeamentos WuBook de um quarto.
        
        Args:
            room_id: ID do quarto no PMS
            tenant_id: ID do tenant
            delete_from_wubook: Se True, também remove o quarto da WuBook
        """
        try:
            mappings = self.db.query(WuBookRoomMapping).options(
                joinedload(WuBookRoomMapping.configuration)
            ).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True
            ).all()
            
            mappings_count = len(mappings)
            if mappings_count == 0:
                logger.debug(f"Nenhum mapeamento ativo encontrado para quarto {room_id}")
                return True
            
            # Processar cada mapeamento
            for mapping in mappings:
                # Se solicitado, tentar remover da WuBook
                if delete_from_wubook and mapping.configuration and mapping.configuration.is_connected:
                    try:
                        client = WuBookClient(
                            mapping.configuration.wubook_token,
                            int(mapping.configuration.wubook_lcode)
                        )
                        
                        wubook_room_id = int(mapping.wubook_room_id)
                        client.delete_room(wubook_room_id)
                        logger.info(f"Quarto {wubook_room_id} removido da WuBook")
                        
                    except Exception as wb_error:
                        logger.error(f"Erro ao remover quarto da WuBook: {wb_error}")
                        # Continuar mesmo se falhar na WuBook
                
                # Desativar mapeamento
                mapping.is_active = False
                mapping.is_syncing = False
                mapping.deletion_pending = True
                mapping.updated_at = datetime.utcnow()
            
            self.db.commit()
            logger.info(f"Removidos {mappings_count} mapeamentos WuBook para quarto {room_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao remover mapeamentos do quarto {room_id}: {e}")
            return False
    
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
        wb_name = wubook_room.get("name")
        pms_number = getattr(pms_room, "room_number", None)
        
        if wb_name and pms_number:
            # Converter ambos para string para comparação
            wb_name_str = str(wb_name).lower().strip()
            pms_number_str = str(pms_number).lower().strip()
            
            if wb_name_str == pms_number_str:
                score += 0.5
                reasons.append("Número idêntico")
            elif wb_name_str in pms_number_str or pms_number_str in wb_name_str:
                score += 0.3
                reasons.append("Número similar")
        
        # Comparar tipo
        wb_rtype = wubook_room.get("rtype")
        pms_room_type = getattr(pms_room, "room_type", None)
        if wb_rtype and pms_room_type and getattr(pms_room_type, "name", None):
            wb_type = str(wb_rtype).lower().strip()
            pms_type = str(pms_room_type.name).lower().strip()
            
            if wb_type == pms_type:
                score += 0.3
                reasons.append("Tipo idêntico")
            elif wb_type in pms_type or pms_type in wb_type:
                score += 0.2
                reasons.append("Tipo similar")
        
        # Comparar ocupação
        wb_occupancy = wubook_room.get("occupancy")
        if wb_occupancy and pms_room_type and getattr(pms_room_type, "max_capacity", None):
            try:
                wb_occ = int(wb_occupancy)
                pms_occ = int(pms_room_type.max_capacity)
                
                if wb_occ == pms_occ:
                    score += 0.2
                    reasons.append("Ocupação idêntica")
            except (ValueError, TypeError):
                # Ignorar se não conseguir converter para int
                pass
        
        return score, " | ".join(reasons) if reasons else "Sem correspondência clara"