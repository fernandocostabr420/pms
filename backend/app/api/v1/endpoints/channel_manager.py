# backend/app/api/v1/endpoints/channel_manager.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case
from datetime import date, datetime, timedelta
import logging
import math
import asyncio

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User

# ✅ IMPORTS DE SCHEMAS
from app.schemas.channel_manager import (
    ChannelManagerOverview,
    ChannelConfigurationCreate,
    ChannelConfigurationUpdate,
    ChannelConfigurationResponse,
    ChannelManagerListResponse,
    SyncRequest,
    SyncResult,
    AvailabilityCalendarRequest,
    AvailabilityCalendarResponse,
    BulkAvailabilityUpdate,
    BulkOperationResult,
    ChannelPerformanceStats,
    SyncHealthReport,
    ChannelSyncStatus,
    ChannelType,
    SyncDirection,
    SimpleAvailabilityView
)
from app.schemas.common import MessageResponse

# ✅ IMPORTS DE MODELOS
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_sync_log import WuBookSyncLog
from app.models.room_availability import RoomAvailability
from app.models.room import Room
from app.models.property import Property
from app.models.room_type import RoomType

# ✅ IMPORTS DE SERVICES
from app.services.wubook_availability_sync_service import WuBookAvailabilitySyncService
from app.services.room_availability_service import RoomAvailabilityService
from app.services.wubook_configuration_service import WuBookConfigurationService

# ✅ IMPORTS PARA BULK EDIT
try:
    from app.schemas.bulk_edit import (
        BulkEditRequest, BulkEditResult, BulkEditValidationRequest, BulkEditValidationResult
    )
    from app.services.bulk_edit_service import BulkEditService
    BULK_EDIT_AVAILABLE = True
except ImportError:
    BULK_EDIT_AVAILABLE = False
    logger.warning("Bulk edit schemas/services not available")

# ✅ IMPORTS PARA SINCRONIZAÇÃO MANUAL
try:
    from app.schemas.manual_sync import (
        ManualSyncRequest, ManualSyncResult, SyncStatusResponse, 
        PendingCountResponse, SyncProgressResponse
    )
    from app.services.manual_sync_service import ManualSyncService
    MANUAL_SYNC_AVAILABLE = True
except ImportError:
    MANUAL_SYNC_AVAILABLE = False
    logger.warning("Manual sync schemas/services not available")

router = APIRouter()
logger = logging.getLogger(__name__)


# ============== DASHBOARD AND OVERVIEW ==============

@router.get("/overview", response_model=ChannelManagerOverview)
def get_channel_manager_overview(
    date_from: Optional[date] = Query(None, description="Data inicial para análise"),
    date_to: Optional[date] = Query(None, description="Data final para análise"),
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Visão geral do Channel Manager com estatísticas e status.
    Dashboard principal do sistema.
    """
    try:
        # Definir período padrão
        if not date_from:
            date_from = date.today() - timedelta(days=30)
        if not date_to:
            date_to = date.today() + timedelta(days=7)
        
        logger.info(f"Buscando overview Channel Manager - User: {current_user.id}, "
                   f"Period: {date_from} to {date_to}, Property: {property_id}")
        
        # Buscar configurações do tenant
        config_query = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        if property_id:
            config_query = config_query.filter(WuBookConfiguration.property_id == property_id)
        
        configurations = config_query.all()
        
        # Estatísticas básicas de configurações
        total_configurations = len(configurations)
        active_configurations = len([c for c in configurations if c.is_active])
        connected_channels = len([c for c in configurations if c.is_connected])
        error_configurations = len([c for c in configurations if c.error_count > 0])
        
        # Status de sincronização
        sync_status = {
            "connected": connected_channels,
            "disconnected": total_configurations - connected_channels,
            "error": error_configurations,
            "syncing": 0  # Seria calculado baseado em jobs ativos
        }
        
        # Última sincronização
        last_sync_query = db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        if property_id:
            last_sync_query = last_sync_query.filter(WuBookConfiguration.property_id == property_id)
        
        last_sync = last_sync_query.order_by(WuBookSyncLog.created_at.desc()).first()
        
        # Estatísticas de disponibilidade (reais baseadas no período)
        avail_query = db.query(RoomAvailability).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.date >= date_from,
            RoomAvailability.date <= date_to,
            RoomAvailability.is_active == True,
            Room.is_active == True  # ✅ FILTRO PARA QUARTOS ATIVOS
        )
        
        if property_id:
            avail_query = avail_query.filter(Room.property_id == property_id)
        
        # Contar estatísticas de disponibilidade
        avail_stats = avail_query.with_entities(
            func.count(RoomAvailability.id).label('total'),
            func.sum(case((RoomAvailability.is_available == True, 1), else_=0)).label('available'),
            func.sum(case((RoomAvailability.is_blocked == True, 1), else_=0)).label('blocked'),
            func.sum(case((RoomAvailability.wubook_synced == True, 1), else_=0)).label('synced'),
            func.sum(case((RoomAvailability.sync_pending == True, 1), else_=0)).label('pending_sync')
        ).first()
        
        availability_stats = {
            "total_rooms": avail_stats.total or 0,
            "available_rooms": avail_stats.available or 0,
            "blocked_rooms": avail_stats.blocked or 0,
            "sync_rate": round((avail_stats.synced or 0) / max(avail_stats.total or 1, 1) * 100, 2)
        }
        
        # Estatísticas de sincronização (baseadas em logs reais)
        sync_logs_today = db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            func.date(WuBookSyncLog.created_at) == date.today()
        )
        
        if property_id:
            sync_logs_today = sync_logs_today.filter(WuBookConfiguration.property_id == property_id)
        
        sync_logs_today = sync_logs_today.all()
        
        successful_syncs = len([log for log in sync_logs_today if log.status == "success"])
        failed_syncs = len([log for log in sync_logs_today if log.status == "error"])
        
        sync_stats = {
            "total_syncs_today": len(sync_logs_today),
            "successful_syncs": successful_syncs,
            "failed_syncs": failed_syncs,
            "average_duration": round(
                sum([log.duration_seconds or 0 for log in sync_logs_today]) / max(len(sync_logs_today), 1), 2
            )
        }
        
        # Canais por tipo (analisando nome da propriedade)
        channels_by_type = {
            "booking_com": len([c for c in configurations if "booking" in (c.wubook_property_name or "").lower()]),
            "expedia": len([c for c in configurations if "expedia" in (c.wubook_property_name or "").lower()]),
            "airbnb": len([c for c in configurations if "airbnb" in (c.wubook_property_name or "").lower()]),
            "other": 0
        }
        channels_by_type["other"] = total_configurations - sum([
            channels_by_type["booking_com"],
            channels_by_type["expedia"], 
            channels_by_type["airbnb"]
        ])
        
        # Alertas baseados em condições reais
        alerts = []
        
        # Alertas por configurações com muitos erros
        for config in configurations:
            if config.error_count > 5:
                alerts.append({
                    "type": "error",
                    "severity": "high",
                    "message": f"Configuração '{config.wubook_property_name}' com {config.error_count} erros",
                    "configuration_id": config.id,
                    "created_at": datetime.utcnow().isoformat()
                })
        
        # Alerta por sincronização antiga
        if last_sync and last_sync.completed_at:
            try:
                last_sync_dt = datetime.fromisoformat(last_sync.completed_at)
                hours_since_sync = (datetime.utcnow() - last_sync_dt).total_seconds() / 3600
                
                if hours_since_sync > 2:
                    alerts.append({
                        "type": "warning",
                        "severity": "medium",
                        "message": f"Última sincronização há {round(hours_since_sync, 1)} horas",
                        "created_at": datetime.utcnow().isoformat()
                    })
            except (ValueError, TypeError):
                logger.warning("Erro ao processar data da última sincronização")
        
        # Alerta por muitos registros pendentes
        pending_sync_count = avail_stats.pending_sync or 0
        if pending_sync_count > 100:
            alerts.append({
                "type": "warning",
                "severity": "medium",
                "message": f"{pending_sync_count} registros pendentes de sincronização",
                "created_at": datetime.utcnow().isoformat()
            })
        
        return ChannelManagerOverview(
            total_configurations=total_configurations,
            active_configurations=active_configurations,
            connected_channels=connected_channels,
            sync_status=sync_status,
            last_sync_at=datetime.fromisoformat(last_sync.completed_at) if last_sync and last_sync.completed_at else None,
            availability_stats=availability_stats,
            sync_stats=sync_stats,
            channels_by_type=channels_by_type,
            alerts=alerts,
            period={
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Erro ao buscar overview Channel Manager: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== CONFIGURATIONS MANAGEMENT ==============

@router.get("/configurations", response_model=ChannelManagerListResponse)
def list_channel_configurations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    
    # Paginação
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros
    channel_type: Optional[ChannelType] = Query(None, description="Tipo de canal"),
    status: Optional[ChannelSyncStatus] = Query(None, description="Status"),
    is_active: Optional[bool] = Query(None, description="Apenas ativos"),
    sync_enabled: Optional[bool] = Query(None, description="Sincronização habilitada"),
    has_errors: Optional[bool] = Query(None, description="Com erros"),
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista configurações de Channel Manager com filtros avançados"""
    try:
        logger.info(f"Listando configurações Channel Manager - User: {current_user.id}, "
                   f"Filters: active={is_active}, sync={sync_enabled}, errors={has_errors}")
        
        # Query base
        query = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        # Aplicar filtros
        if is_active is not None:
            query = query.filter(WuBookConfiguration.is_active == is_active)
        
        if sync_enabled is not None:
            query = query.filter(WuBookConfiguration.sync_enabled == sync_enabled)
        
        if has_errors is not None:
            if has_errors:
                query = query.filter(WuBookConfiguration.error_count > 0)
            else:
                query = query.filter(WuBookConfiguration.error_count == 0)
        
        if property_id:
            query = query.filter(WuBookConfiguration.property_id == property_id)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    WuBookConfiguration.wubook_property_name.ilike(search_term),
                    WuBookConfiguration.wubook_lcode.ilike(search_term)
                )
            )
        
        if status:
            # Filtrar por status específico
            if status == ChannelSyncStatus.CONNECTED:
                query = query.filter(
                    WuBookConfiguration.is_active == True,
                    WuBookConfiguration.is_connected == True,
                    WuBookConfiguration.error_count == 0
                )
            elif status == ChannelSyncStatus.ERROR:
                query = query.filter(WuBookConfiguration.error_count > 0)
            elif status == ChannelSyncStatus.DISCONNECTED:
                query = query.filter(
                    or_(
                        WuBookConfiguration.is_active == False,
                        WuBookConfiguration.is_connected == False
                    )
                )
        
        # Contar total antes da paginação
        total = query.count()
        
        # Aplicar paginação
        skip = (page - 1) * per_page
        configurations = query.offset(skip).limit(per_page).all()
        
        # Converter para response
        items = []
        for config in configurations:
            # Determinar status real da configuração
            if not config.is_active:
                config_status = ChannelSyncStatus.DISCONNECTED
            elif config.error_count > 0:
                config_status = ChannelSyncStatus.ERROR
            elif config.is_connected:
                config_status = ChannelSyncStatus.CONNECTED
            else:
                config_status = ChannelSyncStatus.PENDING
            
            # Buscar estatísticas de sincronização
            total_syncs = db.query(func.count(WuBookSyncLog.id)).filter(
                WuBookSyncLog.configuration_id == config.id
            ).scalar() or 0
            
            successful_syncs = db.query(func.count(WuBookSyncLog.id)).filter(
                WuBookSyncLog.configuration_id == config.id,
                WuBookSyncLog.status == "success"
            ).scalar() or 0
            
            # Determinar tipo de canal baseado no nome
            channel_type_detected = ChannelType.OTHER
            if config.wubook_property_name:
                prop_name = config.wubook_property_name.lower()
                if "booking" in prop_name:
                    channel_type_detected = ChannelType.BOOKING_COM
                elif "expedia" in prop_name:
                    channel_type_detected = ChannelType.EXPEDIA
                elif "airbnb" in prop_name:
                    channel_type_detected = ChannelType.AIRBNB
            
            item = ChannelConfigurationResponse(
                id=config.id,
                wubook_configuration_id=config.id,
                tenant_id=config.tenant_id,
                channel_type=channel_type_detected,
                channel_name=config.wubook_property_name or f"WuBook {config.wubook_lcode}",
                sync_enabled=config.sync_enabled,
                sync_direction=SyncDirection.BIDIRECTIONAL,
                sync_frequency="every_15min",  # Padrão
                sync_availability=config.sync_availability,
                sync_rates=config.sync_rates,
                sync_restrictions=config.sync_restrictions,
                sync_bookings=config.sync_bookings,
                priority_level=1,
                is_active=config.is_active,
                channel_settings={
                    "wubook_lcode": config.wubook_lcode,
                    "property_id": config.property_id
                },
                status=config_status,
                last_sync_at=datetime.fromisoformat(config.last_sync_at) if config.last_sync_at else None,
                last_error=config.last_error_at,
                error_count=config.error_count,
                total_syncs=total_syncs,
                successful_syncs=successful_syncs,
                created_at=config.created_at,
                updated_at=config.updated_at,
                wubook_property_name=config.wubook_property_name
            )
            
            items.append(item)
        
        # Calcular resumo
        summary = {
            "total_configurations": total,
            "active_configurations": len([i for i in items if i.is_active]),
            "connected_configurations": len([i for i in items if i.status == ChannelSyncStatus.CONNECTED]),
            "error_configurations": len([i for i in items if i.status == ChannelSyncStatus.ERROR]),
            "sync_enabled_configurations": len([i for i in items if i.sync_enabled])
        }
        
        return ChannelManagerListResponse(
            items=items,
            total=total,
            page=page,
            pages=math.ceil(total / per_page) if total > 0 else 0,
            per_page=per_page,
            summary=summary,
            filters_applied={
                "channel_type": channel_type,
                "status": status,
                "is_active": is_active,
                "sync_enabled": sync_enabled,
                "has_errors": has_errors,
                "property_id": property_id,
                "search": search
            }
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar configurações: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/configurations/{configuration_id}", response_model=ChannelConfigurationResponse)
def get_channel_configuration(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca configuração específica do Channel Manager"""
    try:
        logger.info(f"Buscando configuração {configuration_id} - User: {current_user.id}")
        
        config = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.id == configuration_id,
            WuBookConfiguration.tenant_id == current_user.tenant_id
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração não encontrada"
            )
        
        # Determinar status
        if not config.is_active:
            config_status = ChannelSyncStatus.DISCONNECTED
        elif config.error_count > 0:
            config_status = ChannelSyncStatus.ERROR
        elif config.is_connected:
            config_status = ChannelSyncStatus.CONNECTED
        else:
            config_status = ChannelSyncStatus.PENDING
        
        # Estatísticas detalhadas
        total_syncs = db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == config.id
        ).scalar() or 0
        
        successful_syncs = db.query(func.count(WuBookSyncLog.id)).filter(
            WuBookSyncLog.configuration_id == config.id,
            WuBookSyncLog.status == "success"
        ).scalar() or 0
        
        # Contar mapeamentos de quartos
        room_mappings_count = db.query(func.count(WuBookRoomMapping.id)).filter(
            WuBookRoomMapping.configuration_id == config.id,
            WuBookRoomMapping.is_active == True
        ).scalar() or 0
        
        # Determinar tipo de canal
        channel_type_detected = ChannelType.OTHER
        if config.wubook_property_name:
            prop_name = config.wubook_property_name.lower()
            if "booking" in prop_name:
                channel_type_detected = ChannelType.BOOKING_COM
            elif "expedia" in prop_name:
                channel_type_detected = ChannelType.EXPEDIA
            elif "airbnb" in prop_name:
                channel_type_detected = ChannelType.AIRBNB
        
        return ChannelConfigurationResponse(
            id=config.id,
            wubook_configuration_id=config.id,
            tenant_id=config.tenant_id,
            channel_type=channel_type_detected,
            channel_name=config.wubook_property_name or f"WuBook {config.wubook_lcode}",
            sync_enabled=config.sync_enabled,
            sync_direction=SyncDirection.BIDIRECTIONAL,
            sync_frequency="every_15min",
            sync_availability=config.sync_availability,
            sync_rates=config.sync_rates,
            sync_restrictions=config.sync_restrictions,
            sync_bookings=config.sync_bookings,
            priority_level=1,
            is_active=config.is_active,
            channel_settings={
                "wubook_lcode": config.wubook_lcode,
                "property_id": config.property_id,
                "room_mappings_count": room_mappings_count,
                "sync_interval_minutes": config.sync_interval_minutes
            },
            status=config_status,
            last_sync_at=datetime.fromisoformat(config.last_sync_at) if config.last_sync_at else None,
            last_error=config.last_error_at,
            error_count=config.error_count,
            total_syncs=total_syncs,
            successful_syncs=successful_syncs,
            created_at=config.created_at,
            updated_at=config.updated_at,
            wubook_property_name=config.wubook_property_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar configuração {configuration_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== MANUAL SYNCHRONIZATION ==============

if MANUAL_SYNC_AVAILABLE:
    @router.post("/sync/manual", response_model=ManualSyncResult)
    def execute_manual_sync(
        sync_request: ManualSyncRequest,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ):
        """
        Executa sincronização manual de registros pendentes com WuBook
        """
        try:
            logger.info(f"Sincronização manual iniciada - User: {current_user.id}, "
                       f"Property: {sync_request.property_id}, Force: {sync_request.force_all}")
            
            manual_sync_service = ManualSyncService(db)
            
            # Verificar se sincronização está disponível
            sync_status = manual_sync_service.get_sync_status(current_user.tenant_id)
            
            if not sync_status.get("sync_available"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nenhuma configuração WuBook ativa encontrada"
                )
            
            # Verificar conflitos de sincronização
            if sync_status.get("is_running") and not sync_request.force_all:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Já existe uma sincronização em andamento"
                )
            
            started_at = datetime.utcnow()
            
            # Decidir processamento baseado na carga
            estimated_items = manual_sync_service.estimate_sync_load(
                current_user.tenant_id,
                sync_request.property_id,
                sync_request.force_all
            )
            
            # Processamento assíncrono para cargas grandes ou quando solicitado
            if sync_request.async_processing or estimated_items > 500:
                # Iniciar em background
                task_id = f"manual_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
                
                background_tasks.add_task(
                    manual_sync_service.process_manual_sync,
                    tenant_id=current_user.tenant_id,
                    property_id=sync_request.property_id,
                    force_all=sync_request.force_all,
                    batch_size=sync_request.batch_size,
                    task_id=task_id
                )
                
                return ManualSyncResult(
                    sync_id=task_id,
                    status="running",
                    message="Sincronização iniciada em background",
                    total_pending=estimated_items,
                    processed=0,
                    successful=0,
                    failed=0,
                    success_rate=0.0,
                    errors=[],
                    error_count=0,
                    started_at=started_at,
                    completed_at=None,
                    duration_seconds=0.0,
                    configurations_processed=sync_status.get("active_configurations", 0),
                    force_all_used=sync_request.force_all
                )
            
            else:
                # Processamento síncrono
                result = manual_sync_service.process_manual_sync(
                    tenant_id=current_user.tenant_id,
                    property_id=sync_request.property_id,
                    force_all=sync_request.force_all,
                    batch_size=sync_request.batch_size
                )
                
                logger.info(f"Sincronização manual concluída - "
                           f"Processed: {result.get('processed', 0)}, "
                           f"Successful: {result.get('successful', 0)}")
                
                return ManualSyncResult(**result)
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro na sincronização manual: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno na sincronização: {str(e)}"
            )

    @router.get("/sync/status", response_model=SyncStatusResponse)
    def get_manual_sync_status(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ):
        """Retorna status atual da sincronização para o tenant"""
        try:
            manual_sync_service = ManualSyncService(db)
            result = manual_sync_service.get_sync_status(current_user.tenant_id)
            return SyncStatusResponse(**result)
        
        except Exception as e:
            logger.error(f"Erro ao obter status de sincronização: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao obter status: {str(e)}"
            )

    @router.get("/sync/pending-count", response_model=PendingCountResponse)
    def get_pending_sync_count(
        property_id: Optional[int] = Query(None, description="ID da propriedade específica"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ):
        """Retorna contagem detalhada de registros pendentes de sincronização"""
        try:
            manual_sync_service = ManualSyncService(db)
            result = manual_sync_service.get_pending_count(
                tenant_id=current_user.tenant_id,
                property_id=property_id
            )
            return PendingCountResponse(**result)
        
        except Exception as e:
            logger.error(f"Erro ao obter contagem pendente: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao obter contagem: {str(e)}"
            )

else:
    # Fallback quando manual sync não está disponível
    @router.post("/sync/manual")
    def execute_manual_sync_fallback():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Manual sync service not available"
        )


# ============== LEGACY SYNC ENDPOINTS ==============

@router.post("/sync/legacy", response_model=SyncResult)
def manual_sync_legacy(
    sync_request: SyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Executa sincronização manual (endpoint legacy para compatibilidade)"""
    try:
        logger.info(f"Sincronização legacy iniciada - User: {current_user.id}, "
                   f"Config: {sync_request.configuration_id}, Force: {sync_request.force_full_sync}")
        
        sync_id = f"legacy_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
        started_at = datetime.utcnow()
        
        # Validar configuração se especificada
        if sync_request.configuration_id:
            config = db.query(WuBookConfiguration).filter(
                WuBookConfiguration.id == sync_request.configuration_id,
                WuBookConfiguration.tenant_id == current_user.tenant_id,
                WuBookConfiguration.is_active == True
            ).first()
            
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada ou inativa"
                )
        
        try:
            # Usar serviço de sincronização diretamente
            sync_service = WuBookAvailabilitySyncService(db)
            
            if sync_request.force_full_sync:
                # Sincronização completa
                result = sync_service.sync_availability_to_wubook(
                    tenant_id=current_user.tenant_id,
                    configuration_id=sync_request.configuration_id,
                    room_ids=sync_request.room_ids,
                    date_from=sync_request.date_from or date.today(),
                    date_to=sync_request.date_to or (date.today() + timedelta(days=30)),
                    force_sync_all=True
                )
            else:
                # Sincronização incremental (apenas pendentes)
                result = sync_service.sync_availability_to_wubook(
                    tenant_id=current_user.tenant_id,
                    configuration_id=sync_request.configuration_id,
                    room_ids=sync_request.room_ids,
                    force_sync_all=False
                )
            
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            # Converter resultado para SyncResult
            success = result.get("success", False)
            synced_count = result.get("synced_count", 0)
            error_count = result.get("error_count", 0)
            
            return SyncResult(
                sync_id=sync_id,
                configuration_id=sync_request.configuration_id,
                status="completed" if success else "error",
                success=success,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
                total_items=synced_count + error_count,
                successful_items=synced_count,
                failed_items=error_count,
                changes_summary={"synced": synced_count},
                errors=result.get("errors", [])
            )
            
        except Exception as sync_error:
            logger.error(f"Erro durante sincronização: {sync_error}")
            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()
            
            return SyncResult(
                sync_id=sync_id,
                configuration_id=sync_request.configuration_id,
                status="error",
                success=False,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
                total_items=0,
                successful_items=0,
                failed_items=0,
                changes_summary={},
                errors=[str(sync_error)]
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na sincronização legacy: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na sincronização: {str(e)}"
        )


# ============== AVAILABILITY CALENDAR ==============

@router.post("/availability/calendar", response_model=AvailabilityCalendarResponse)
def get_availability_calendar(
    calendar_request: AvailabilityCalendarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca calendário de disponibilidade com status de sincronização"""
    try:
        logger.info(f"Buscando calendário - User: {current_user.id}, "
                   f"Period: {calendar_request.date_from} to {calendar_request.date_to}, "
                   f"Rooms: {calendar_request.room_ids}, Property: {calendar_request.property_id}")
        
        # Validar período
        days_diff = (calendar_request.date_to - calendar_request.date_from).days
        if days_diff > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período não pode exceder 365 dias"
            )
        
        # ✅ BUSCAR DISPONIBILIDADES (COM FILTRO DE QUARTOS ATIVOS)
        availability_query = db.query(RoomAvailability).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.date >= calendar_request.date_from,
            RoomAvailability.date <= calendar_request.date_to,
            RoomAvailability.is_active == True,
            Room.is_active == True  # ✅ FILTRO CRUCIAL PARA QUARTOS ATIVOS
        )
        
        if calendar_request.room_ids:
            availability_query = availability_query.filter(
                RoomAvailability.room_id.in_(calendar_request.room_ids)
            )
        
        if calendar_request.property_id:
            availability_query = availability_query.filter(
                Room.property_id == calendar_request.property_id
            )
        
        availabilities = availability_query.all()
        
        # ✅ BUSCAR INFORMAÇÕES DE QUARTOS (APENAS ATIVOS)
        rooms_query = db.query(Room).filter(
            Room.tenant_id == current_user.tenant_id,
            Room.is_active == True  # ✅ FILTRO CRUCIAL PARA QUARTOS ATIVOS
        )
        
        if calendar_request.room_ids:
            rooms_query = rooms_query.filter(Room.id.in_(calendar_request.room_ids))
        
        if calendar_request.property_id:
            rooms_query = rooms_query.filter(Room.property_id == calendar_request.property_id)
        
        rooms = {room.id: room for room in rooms_query.all()}
        
        # Buscar mapeamentos WuBook ativos
        room_ids = list(rooms.keys())
        mappings = []
        if room_ids:
            mappings = db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id.in_(room_ids),
                WuBookRoomMapping.is_active == True
            ).all()
        
        mapping_dict = {m.room_id: m for m in mappings}
        
        # Organizar dados por data
        calendar_data = {}
        
        for avail in availabilities:
            date_str = avail.date.isoformat()
            if date_str not in calendar_data:
                calendar_data[date_str] = []
            
            room = rooms.get(avail.room_id)
            mapping = mapping_dict.get(avail.room_id)
            
            # Pular se o quarto não foi encontrado (não deveria acontecer com o JOIN)
            if not room:
                logger.warning(f"Quarto {avail.room_id} não encontrado para disponibilidade {avail.id}")
                continue
            
            # Criar view simplificada
            avail_view = SimpleAvailabilityView(
                date=avail.date,
                room_id=avail.room_id,
                room_number=room.room_number,
                room_name=room.name,
                is_available=avail.is_available,
                is_bookable=avail.is_bookable,
                rate=avail.rate_override,
                min_stay=avail.min_stay,
                max_stay=avail.max_stay,
                closed_to_arrival=avail.closed_to_arrival,
                closed_to_departure=avail.closed_to_departure,
                sync_status="synced" if avail.wubook_synced else "pending",
                last_sync=avail.last_wubook_sync.isoformat() if avail.last_wubook_sync else None,
                sync_pending=avail.sync_pending,
                sync_error=avail.wubook_sync_error,
                mapped_channels=[f"wubook_{mapping.configuration_id}"] if mapping else [],
                sync_enabled_channels=[f"wubook_{mapping.configuration_id}"] if mapping and mapping.sync_availability else []
            )
            
            calendar_data[date_str].append(avail_view.model_dump())
        
        # Converter para lista ordenada por data
        sorted_calendar = []
        current_date = calendar_request.date_from
        
        while current_date <= calendar_request.date_to:
            date_str = current_date.isoformat()
            day_availabilities = calendar_data.get(date_str, [])
            
            day_data = {
                "date": date_str,
                "availabilities": day_availabilities,
                "summary": {
                    "total_rooms": len(day_availabilities),
                    "available_rooms": len([a for a in day_availabilities if a["is_available"]]),
                    "blocked_rooms": len([a for a in day_availabilities if not a["is_available"]]),
                    "pending_sync": len([a for a in day_availabilities if a["sync_pending"]])
                }
            }
            sorted_calendar.append(day_data)
            current_date += timedelta(days=1)
        
        # Resumo por quarto
        rooms_summary = []
        for room_id, room in rooms.items():
            mapping = mapping_dict.get(room_id)
            
            # Contar disponibilidades para este quarto
            room_availabilities = [a for a in availabilities if a.room_id == room_id]
            
            rooms_summary.append({
                "room_id": room_id,
                "room_number": room.room_number,
                "room_name": room.name,
                "room_type_name": room.room_type.name if room.room_type else None,
                "has_channel_mapping": mapping is not None,
                "sync_enabled": mapping.sync_availability if mapping else False,
                "total_days": len(room_availabilities),
                "synced_days": len([a for a in room_availabilities if a.wubook_synced]),
                "pending_days": len([a for a in room_availabilities if a.sync_pending])
            })
        
        # Resumo por canal
        configs = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            WuBookConfiguration.is_active == True
        ).all()
        
        channels_summary = []
        for config in configs:
            config_mappings = [m for m in mappings if m.configuration_id == config.id]
            mapped_rooms = len(config_mappings)
            
            channels_summary.append({
                "configuration_id": config.id,
                "channel_name": config.wubook_property_name or f"WuBook {config.wubook_lcode}",
                "mapped_rooms": mapped_rooms,
                "sync_enabled": config.sync_enabled,
                "last_sync": config.last_sync_at,
                "error_count": config.error_count
            })
        
        # Estatísticas gerais
        total_days = (calendar_request.date_to - calendar_request.date_from).days + 1
        total_records = len(availabilities)
        synced_records = len([a for a in availabilities if a.wubook_synced])
        pending_records = len([a for a in availabilities if a.sync_pending])
        
        statistics = {
            "total_days": total_days,
            "total_records": total_records,
            "synced_records": synced_records,
            "pending_records": pending_records,
            "sync_rate": round((synced_records / total_records * 100), 2) if total_records > 0 else 0,
            "total_rooms": len(rooms),
            "mapped_rooms": len([r for r in rooms.values() if r.id in mapping_dict])
        }
        
        # Status de sincronização
        sync_status = {
            "healthy_configurations": len([c for c in configs if c.error_count == 0]),
            "error_configurations": len([c for c in configs if c.error_count > 0]),
            "total_configurations": len(configs),
            "last_global_sync": max([c.last_sync_at for c in configs if c.last_sync_at], default=None)
        }
        
        return AvailabilityCalendarResponse(
            date_from=calendar_request.date_from,
            date_to=calendar_request.date_to,
            total_days=total_days,
            calendar_data=sorted_calendar,
            rooms_summary=rooms_summary,
            channels_summary=channels_summary,
            statistics=statistics,
            sync_status=sync_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar calendário: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== BULK OPERATIONS ==============

@router.post("/availability/bulk-update", response_model=BulkOperationResult)
def bulk_update_availability(
    bulk_request: BulkAvailabilityUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualização em massa de disponibilidade com sincronização automática"""
    operation_id = f"bulk_update_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
    started_at = datetime.utcnow()
    
    try:
        logger.info(f"Bulk update iniciado - {operation_id}, "
                   f"Rooms: {len(bulk_request.room_ids)}, "
                   f"Period: {bulk_request.date_from} to {bulk_request.date_to}")
        
        # Validar período
        days_diff = (bulk_request.date_to - bulk_request.date_from).days
        if days_diff > 366:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período não pode exceder 366 dias"
            )
        
        # ✅ VERIFICAR SE QUARTOS EXISTEM E ESTÃO ATIVOS
        valid_rooms = db.query(Room.id).filter(
            Room.id.in_(bulk_request.room_ids),
            Room.tenant_id == current_user.tenant_id,
            Room.is_active == True  # ✅ APENAS QUARTOS ATIVOS
        ).all()
        
        valid_room_ids = [room.id for room in valid_rooms]
        if not valid_room_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum quarto válido encontrado"
            )
        
        # Aviso se alguns quartos foram filtrados
        invalid_count = len(bulk_request.room_ids) - len(valid_room_ids)
        if invalid_count > 0:
            logger.warning(f"Bulk update: {invalid_count} quartos inválidos ou inativos filtrados")
        
        # Buscar registros existentes no período
        existing_query = db.query(RoomAvailability).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.room_id.in_(valid_room_ids),
            RoomAvailability.date >= bulk_request.date_from,
            RoomAvailability.date <= bulk_request.date_to,
            RoomAvailability.is_active == True
        )
        
        # Preparar updates
        updates = {}
        
        if bulk_request.is_available is not None:
            updates[RoomAvailability.is_available] = bulk_request.is_available
        
        if bulk_request.is_blocked is not None:
            updates[RoomAvailability.is_blocked] = bulk_request.is_blocked
        
        if bulk_request.rate_override is not None:
            updates[RoomAvailability.rate_override] = bulk_request.rate_override
        
        if bulk_request.min_stay is not None:
            updates[RoomAvailability.min_stay] = bulk_request.min_stay
        
        if bulk_request.max_stay is not None:
            updates[RoomAvailability.max_stay] = bulk_request.max_stay
        
        if bulk_request.closed_to_arrival is not None:
            updates[RoomAvailability.closed_to_arrival] = bulk_request.closed_to_arrival
        
        if bulk_request.closed_to_departure is not None:
            updates[RoomAvailability.closed_to_departure] = bulk_request.closed_to_departure
        
        if bulk_request.reason:
            updates[RoomAvailability.reason] = bulk_request.reason
        
        # Sempre marcar timestamp de atualização
        updates[RoomAvailability.updated_at] = datetime.utcnow()
        
        # Marcar para sincronização se solicitado
        if bulk_request.sync_immediately:
            updates[RoomAvailability.sync_pending] = True
        
        # Executar update
        updated_count = existing_query.update(updates, synchronize_session=False)
        db.commit()
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        # Log resultado
        logger.info(f"Bulk update concluído - {operation_id}, "
                   f"Updated: {updated_count}, Duration: {duration:.2f}s")
        
        # Se sync foi solicitado, iniciar em background
        sync_result = None
        if bulk_request.sync_immediately and updated_count > 0:
            try:
                sync_service = WuBookAvailabilitySyncService(db)
                sync_result = sync_service.sync_availability_to_wubook(
                    tenant_id=current_user.tenant_id,
                    room_ids=valid_room_ids,
                    date_from=bulk_request.date_from,
                    date_to=bulk_request.date_to,
                    force_sync_all=False
                )
                logger.info(f"Sync após bulk update: {sync_result.get('synced_count', 0)} registros")
            except Exception as sync_error:
                logger.error(f"Erro na sincronização após bulk update: {sync_error}")
                sync_result = {"error": str(sync_error)}
        
        return BulkOperationResult(
            operation_id=operation_id,
            total_items=updated_count,
            successful_items=updated_count,
            failed_items=0,
            created_count=0,
            updated_count=updated_count,
            skipped_count=invalid_count,
            errors=[] if invalid_count == 0 else [f"{invalid_count} quartos inválidos/inativos ignorados"],
            sync_triggered=bulk_request.sync_immediately,
            sync_result=sync_result,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro na operação bulk: {str(e)}", exc_info=True)
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        return BulkOperationResult(
            operation_id=operation_id,
            total_items=0,
            successful_items=0,
            failed_items=1,
            created_count=0,
            updated_count=0,
            skipped_count=0,
            errors=[f"Erro interno: {str(e)}"],
            sync_triggered=False,
            sync_result=None,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration
        )


# ============== ADVANCED BULK EDIT ==============

if BULK_EDIT_AVAILABLE:
    @router.post("/bulk-edit", response_model=BulkEditResult)
    def execute_bulk_edit(
        bulk_request: BulkEditRequest,
        background_tasks: BackgroundTasks,
        async_processing: bool = Query(False, description="Processar de forma assíncrona"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ):
        """Executa operação avançada de bulk edit no Channel Manager"""
        try:
            logger.info(f"Bulk edit avançado - User: {current_user.id}, "
                       f"Scope: {bulk_request.scope}, Operations: {len(bulk_request.operations)}")
            
            # Validação básica
            days_diff = (bulk_request.date_to - bulk_request.date_from).days
            if days_diff > 366:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Período não pode exceder 366 dias"
                )
            
            service = BulkEditService(db)
            
            # Estimativa de carga
            estimated_items = service.estimate_bulk_edit_load(bulk_request, current_user.tenant_id)
            
            # Processamento assíncrono para operações grandes
            if async_processing or estimated_items > 1000 or len(bulk_request.operations) > 5:
                # Executar em background usando Celery ou similar
                task_id = f"bulk_edit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
                
                # Simular execução assíncrona (implementar com Celery na produção)
                background_tasks.add_task(
                    service.execute_bulk_edit_async,
                    bulk_request,
                    current_user.tenant_id,
                    current_user.id,
                    task_id
                )
                
                return BulkEditResult(
                    operation_id=task_id,
                    tenant_id=current_user.tenant_id,
                    user_id=current_user.id,
                    total_items_targeted=estimated_items,
                    total_operations_executed=0,
                    successful_operations=0,
                    failed_operations=0,
                    skipped_operations=0,
                    started_at=datetime.utcnow(),
                    completed_at=None,
                    duration_seconds=0.0,
                    dry_run=bulk_request.dry_run,
                    processing_errors=[],
                    request_summary={
                        "async_task_id": task_id,
                        "estimated_items": estimated_items,
                        "status": "running"
                    }
                )
            
            else:
                # Processamento síncrono
                result = service.execute_bulk_edit(
                    bulk_request, 
                    current_user.tenant_id, 
                    current_user
                )
                
                logger.info(f"Bulk edit concluído - {result.operation_id}")
                return result
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro em bulk edit: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno: {str(e)}"
            )

    @router.post("/bulk-edit/validate", response_model=BulkEditValidationResult)
    def validate_bulk_edit(
        validation_request: BulkEditValidationRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ):
        """Valida operação de bulk edit antes da execução"""
        try:
            service = BulkEditService(db)
            
            # Forçar dry_run na validação
            bulk_request = validation_request.bulk_edit_request
            bulk_request.dry_run = True
            
            # Executar validação
            result = service.validate_bulk_edit(bulk_request, current_user.tenant_id)
            
            return BulkEditValidationResult(**result)
            
        except Exception as e:
            logger.error(f"Erro na validação de bulk edit: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro na validação: {str(e)}"
            )

else:
    # Fallback quando bulk edit não está disponível
    @router.post("/bulk-edit")
    def execute_bulk_edit_fallback():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Advanced bulk edit service not available"
        )


# ============== HEALTH AND MONITORING ==============

@router.get("/health", response_model=SyncHealthReport)
def get_sync_health(
    days_back: int = Query(7, ge=1, le=30, description="Dias para análise"),
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Relatório de saúde do Channel Manager"""
    try:
        logger.info(f"Gerando relatório de saúde - User: {current_user.id}, "
                   f"Days: {days_back}, Property: {property_id}")
        
        # Buscar configurações
        config_query = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        if property_id:
            config_query = config_query.filter(WuBookConfiguration.property_id == property_id)
        
        configurations = config_query.all()
        
        # Categorizar configurações por saúde
        healthy_configs = [
            c for c in configurations 
            if c.is_active and c.is_connected and c.error_count == 0
        ]
        
        warning_configs = [
            c for c in configurations 
            if c.is_active and c.is_connected and 0 < c.error_count <= 5
        ]
        
        critical_configs = [
            c for c in configurations 
            if not c.is_active or not c.is_connected or c.error_count > 5
        ]
        
        # Calcular score de saúde
        total_configs = len(configurations)
        if total_configs == 0:
            health_score = 0.0
            overall_health = "unknown"
        else:
            health_score = (
                len(healthy_configs) * 100 + 
                len(warning_configs) * 70 + 
                len(critical_configs) * 0
            ) / total_configs
            
            if health_score >= 80:
                overall_health = "healthy"
            elif health_score >= 60:
                overall_health = "warning"
            else:
                overall_health = "critical"
        
        # Atividade recente de sincronização
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        recent_logs_query = db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            WuBookSyncLog.created_at >= cutoff_date
        )
        
        if property_id:
            recent_logs_query = recent_logs_query.filter(
                WuBookConfiguration.property_id == property_id
            )
        
        recent_logs = recent_logs_query.all()
        
        # Calcular métricas de atividade
        total_syncs = len(recent_logs)
        successful_syncs = len([log for log in recent_logs if log.status == "success"])
        failed_syncs = len([log for log in recent_logs if log.status == "error"])
        
        sync_rate = (successful_syncs / total_syncs * 100) if total_syncs > 0 else 0
        error_rate = (failed_syncs / total_syncs * 100) if total_syncs > 0 else 0
        
        # Duração média
        durations = [log.duration_seconds for log in recent_logs if log.duration_seconds]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Atividade nas últimas 24h
        last_24h = datetime.utcnow() - timedelta(hours=24)
        recent_24h = [log for log in recent_logs if log.created_at >= last_24h]
        
        recent_activity = {
            "total_syncs_24h": len(recent_24h),
            "successful_syncs_24h": len([log for log in recent_24h if log.status == "success"]),
            "failed_syncs_24h": len([log for log in recent_24h if log.status == "error"]),
            "average_duration": avg_duration
        }
        
        # Identificar problemas específicos
        issues = []
        
        for config in critical_configs:
            issue_type = "critical"
            if not config.is_active:
                description = f"Configuração '{config.wubook_property_name}' está inativa"
            elif not config.is_connected:
                description = f"Configuração '{config.wubook_property_name}' está desconectada"
            else:
                description = f"Configuração '{config.wubook_property_name}' com {config.error_count} erros"
            
            issues.append({
                "type": issue_type,
                "configuration_id": config.id,
                "description": description,
                "last_error": config.last_error_at,
                "error_count": config.error_count
            })
        
        for config in warning_configs:
            issues.append({
                "type": "warning",
                "configuration_id": config.id,
                "description": f"Configuração '{config.wubook_property_name}' com {config.error_count} erros menores",
                "last_error": config.last_error_at,
                "error_count": config.error_count
            })
        
        # Gerar recomendações
        recommendations = []
        
        if len(critical_configs) > 0:
            recommendations.append("Verificar e corrigir configurações críticas imediatamente")
        
        if len(warning_configs) > 0:
            recommendations.append("Monitorar configurações com avisos")
        
        if error_rate > 10:
            recommendations.append("Taxa de erro alta - verificar conectividade e configurações")
        
        if avg_duration > 60:
            recommendations.append("Sincronizações muito lentas - otimizar processo")
        
        if total_syncs == 0:
            recommendations.append("Nenhuma sincronização recente - verificar funcionamento")
        
        # Calcular taxa de registros pendentes
        pending_count = db.query(func.count(RoomAvailability.id)).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.sync_pending == True,
            RoomAvailability.is_active == True,
            Room.is_active == True
        )
        
        if property_id:
            pending_count = pending_count.filter(Room.property_id == property_id)
        
        pending_count = pending_count.scalar() or 0
        
        total_availability_records = db.query(func.count(RoomAvailability.id)).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.is_active == True,
            Room.is_active == True,
            RoomAvailability.date >= date.today()
        )
        
        if property_id:
            total_availability_records = total_availability_records.filter(Room.property_id == property_id)
        
        total_availability_records = total_availability_records.scalar() or 1
        
        pending_rate = (pending_count / total_availability_records * 100)
        
        return SyncHealthReport(
            overall_health=overall_health,
            health_score=round(health_score, 1),
            total_configurations=total_configs,
            healthy_configurations=len(healthy_configs),
            warning_configurations=len(warning_configs),
            critical_configurations=len(critical_configs),
            sync_rate=round(sync_rate, 1),
            error_rate=round(error_rate, 1),
            pending_rate=round(pending_rate, 1),
            recent_activity=recent_activity,
            issues=issues,
            recommendations=recommendations,
            generated_at=datetime.utcnow(),
            period_analyzed=f"últimos {days_back} dias"
        )
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório de saúde: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== UTILITY ENDPOINTS ==============

@router.post("/sync/reset-errors", response_model=MessageResponse)
def reset_sync_errors(
    configuration_id: Optional[int] = Query(None, description="Configuração específica"),
    room_ids: Optional[List[int]] = Query(None, description="Quartos específicos"),
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reset erros de sincronização em registros de disponibilidade"""
    try:
        logger.info(f"Reset de erros - User: {current_user.id}, "
                   f"Config: {configuration_id}, Rooms: {room_ids}, Property: {property_id}")
        
        # Query base para availabilities com erro
        query = db.query(RoomAvailability).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.wubook_sync_error.isnot(None),
            RoomAvailability.is_active == True,
            Room.is_active == True  # ✅ APENAS QUARTOS ATIVOS
        )
        
        # Aplicar filtros
        if room_ids:
            query = query.filter(RoomAvailability.room_id.in_(room_ids))
        
        if property_id:
            query = query.filter(Room.property_id == property_id)
        
        if configuration_id:
            # Filtrar por configuração via mapeamentos
            query = query.join(
                WuBookRoomMapping,
                and_(
                    WuBookRoomMapping.room_id == Room.id,
                    WuBookRoomMapping.configuration_id == configuration_id,
                    WuBookRoomMapping.is_active == True
                )
            )
        
        # Executar reset
        count = query.update({
            RoomAvailability.wubook_sync_error: None,
            RoomAvailability.sync_pending: True,
            RoomAvailability.updated_at: datetime.utcnow()
        }, synchronize_session=False)
        
        db.commit()
        
        logger.info(f"Reset de erros concluído - {count} registros resetados")
        
        return MessageResponse(
            message=f"Reset realizado em {count} registros de disponibilidade",
            success=True
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao resetar erros: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.post("/sync/force-pending", response_model=MessageResponse)
def force_mark_pending(
    room_ids: Optional[List[int]] = Query(None, description="Quartos específicos"),
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    date_from: Optional[date] = Query(None, description="Data inicial"),
    date_to: Optional[date] = Query(None, description="Data final"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Força marcação de registros como pendentes para nova sincronização"""
    try:
        logger.info(f"Forçando marcação pendente - User: {current_user.id}, "
                   f"Rooms: {room_ids}, Property: {property_id}")
        
        # Definir período padrão
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date_from + timedelta(days=30)
        
        # Query base
        query = db.query(RoomAvailability).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.date >= date_from,
            RoomAvailability.date <= date_to,
            RoomAvailability.is_active == True,
            Room.is_active == True  # ✅ APENAS QUARTOS ATIVOS
        )
        
        # Aplicar filtros
        if room_ids:
            query = query.filter(RoomAvailability.room_id.in_(room_ids))
        
        if property_id:
            query = query.filter(Room.property_id == property_id)
        
        # Marcar como pendente
        count = query.update({
            RoomAvailability.sync_pending: True,
            RoomAvailability.wubook_synced: False,
            RoomAvailability.updated_at: datetime.utcnow()
        }, synchronize_session=False)
        
        db.commit()
        
        logger.info(f"Marcação pendente concluída - {count} registros marcados")
        
        return MessageResponse(
            message=f"{count} registros marcados como pendentes para sincronização",
            success=True
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao marcar como pendente: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/stats/overview")
def get_channel_manager_stats(
    property_id: Optional[int] = Query(None, description="Propriedade específica"),
    days_back: int = Query(30, ge=1, le=90, description="Dias para análise"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Estatísticas gerais do Channel Manager"""
    try:
        cutoff_date = date.today() - timedelta(days=days_back)
        
        # Base query com filtro de quartos ativos
        base_query = db.query(RoomAvailability).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.date >= cutoff_date,
            RoomAvailability.is_active == True,
            Room.is_active == True  # ✅ APENAS QUARTOS ATIVOS
        )
        
        if property_id:
            base_query = base_query.filter(Room.property_id == property_id)
        
        # Estatísticas de disponibilidade
        availability_stats = base_query.with_entities(
            func.count(RoomAvailability.id).label('total'),
            func.sum(case((RoomAvailability.is_available == True, 1), else_=0)).label('available'),
            func.sum(case((RoomAvailability.is_blocked == True, 1), else_=0)).label('blocked'),
            func.sum(case((RoomAvailability.wubook_synced == True, 1), else_=0)).label('synced'),
            func.sum(case((RoomAvailability.sync_pending == True, 1), else_=0)).label('pending')
        ).first()
        
        # Estatísticas de configurações
        config_query = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        if property_id:
            config_query = config_query.filter(WuBookConfiguration.property_id == property_id)
        
        config_stats = config_query.with_entities(
            func.count(WuBookConfiguration.id).label('total'),
            func.sum(case((WuBookConfiguration.is_active == True, 1), else_=0)).label('active'),
            func.sum(case((WuBookConfiguration.is_connected == True, 1), else_=0)).label('connected'),
            func.sum(case((WuBookConfiguration.error_count > 0, 1), else_=0)).label('with_errors')
        ).first()
        
        # Estatísticas de mapeamentos
        mapping_stats = db.query(WuBookRoomMapping).join(Room).filter(
            WuBookRoomMapping.tenant_id == current_user.tenant_id,
            WuBookRoomMapping.is_active == True,
            Room.is_active == True  # ✅ APENAS QUARTOS ATIVOS
        )
        
        if property_id:
            mapping_stats = mapping_stats.join(
                WuBookConfiguration,
                WuBookConfiguration.id == WuBookRoomMapping.configuration_id
            ).filter(WuBookConfiguration.property_id == property_id)
        
        mapping_count = mapping_stats.count()
        
        return {
            "period": {
                "date_from": cutoff_date.isoformat(),
                "date_to": date.today().isoformat(),
                "days_analyzed": days_back
            },
            "availability": {
                "total_records": availability_stats.total or 0,
                "available_records": availability_stats.available or 0,
                "blocked_records": availability_stats.blocked or 0,
                "synced_records": availability_stats.synced or 0,
                "pending_records": availability_stats.pending or 0,
                "sync_rate": round(
                    (availability_stats.synced or 0) / max(availability_stats.total or 1, 1) * 100, 2
                )
            },
            "configurations": {
                "total": config_stats.total or 0,
                "active": config_stats.active or 0,
                "connected": config_stats.connected or 0,
                "with_errors": config_stats.with_errors or 0
            },
            "mappings": {
                "total_room_mappings": mapping_count
            },
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao gerar estatísticas: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/debug/room-filter-test")
def debug_room_filter(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Endpoint de debug para testar filtros de quartos ativos"""
    try:
        # Contar todos os quartos
        all_rooms = db.query(func.count(Room.id)).filter(
            Room.tenant_id == current_user.tenant_id
        ).scalar() or 0
        
        # Contar quartos ativos
        active_rooms = db.query(func.count(Room.id)).filter(
            Room.tenant_id == current_user.tenant_id,
            Room.is_active == True
        ).scalar() or 0
        
        # Contar quartos inativos
        inactive_rooms = db.query(func.count(Room.id)).filter(
            Room.tenant_id == current_user.tenant_id,
            Room.is_active == False
        ).scalar() or 0
        
        # Contar disponibilidades com quartos ativos vs todos
        avail_all = db.query(func.count(RoomAvailability.id)).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.is_active == True
        ).scalar() or 0
        
        avail_active_rooms = db.query(func.count(RoomAvailability.id)).join(Room).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.is_active == True,
            Room.is_active == True
        ).scalar() or 0
        
        return {
            "rooms": {
                "total": all_rooms,
                "active": active_rooms,
                "inactive": inactive_rooms
            },
            "availabilities": {
                "total_with_any_room": avail_all,
                "total_with_active_rooms_only": avail_active_rooms,
                "filtered_out": avail_all - avail_active_rooms
            },
            "filter_working": active_rooms < all_rooms and avail_active_rooms <= avail_all,
            "message": "✅ Filtro funcionando" if (active_rooms < all_rooms and avail_active_rooms <= avail_all) else "❌ Filtro pode não estar funcionando"
        }
        
    except Exception as e:
        logger.error(f"Erro no debug: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )