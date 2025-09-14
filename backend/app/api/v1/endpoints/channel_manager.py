# backend/app/api/v1/endpoints/channel_manager.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
import logging
import math

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.channel_manager import (
    ChannelManagerOverview,
    ChannelConfigurationCreate,
    ChannelConfigurationUpdate,
    ChannelConfigurationResponse,
    ChannelManagerListResponse,
    ChannelManagerFilters,
    SyncRequest,
    SyncResult,
    AvailabilityCalendarRequest,
    AvailabilityCalendarResponse,
    AvailabilityMappingView,
    BulkAvailabilityUpdate,
    BulkOperationResult,
    ChannelPerformanceStats,
    SyncHealthReport,
    ChannelSyncStatus,
    ChannelType,
    SyncDirection
)
from app.schemas.common import MessageResponse
from app.services.wubook_availability_sync_service import WuBookAvailabilitySyncService
from app.services.room_availability_service import RoomAvailabilityService
from app.tasks.availability_sync_job import AvailabilitySyncJob
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_sync_log import WuBookSyncLog
from app.models.room_availability import RoomAvailability
from app.models.room import Room

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
        # Definir período padrão (último mês)
        if not date_from:
            date_from = date.today() - timedelta(days=30)
        if not date_to:
            date_to = date.today() + timedelta(days=7)
        
        # Buscar configurações do tenant
        configurations = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        ).all()
        
        total_configurations = len(configurations)
        active_configurations = len([c for c in configurations if c.is_active])
        connected_channels = len([c for c in configurations if c.is_connected])
        
        # Status de sincronização
        sync_status = {
            "connected": connected_channels,
            "disconnected": total_configurations - connected_channels,
            "error": len([c for c in configurations if c.error_count > 0]),
            "syncing": 0  # Seria calculado baseado em jobs ativos
        }
        
        # Última sincronização
        last_sync = db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        ).order_by(WuBookSyncLog.created_at.desc()).first()
        
        # Estatísticas de disponibilidade
        availability_service = RoomAvailabilityService(db)
        availability_stats = availability_service.get_availability_stats(
            current_user.tenant_id,
            date_from=date_from,
            date_to=date_to,
            property_id=property_id
        )
        
        # Estatísticas de sincronização
        sync_stats = availability_service.get_channel_manager_overview(
            current_user.tenant_id,
            date_from=date_from,
            date_to=date_to
        )
        
        # Canais por tipo (simulado - seria baseado em configurações reais)
        channels_by_type = {
            "booking_com": len([c for c in configurations if "booking" in c.wubook_property_name.lower()]) if configurations else 0,
            "expedia": len([c for c in configurations if "expedia" in c.wubook_property_name.lower()]) if configurations else 0,
            "airbnb": len([c for c in configurations if "airbnb" in c.wubook_property_name.lower()]) if configurations else 0,
            "other": max(0, total_configurations - sum([
                len([c for c in configurations if keyword in c.wubook_property_name.lower()])
                for keyword in ["booking", "expedia", "airbnb"]
            ])) if configurations else 0
        }
        
        # Alertas (baseado em erros e problemas)
        alerts = []
        
        # Verificar configurações com erro
        error_configs = [c for c in configurations if c.error_count > 5]
        for config in error_configs:
            alerts.append({
                "type": "error",
                "severity": "high",
                "message": f"Configuração {config.wubook_property_name} com muitos erros",
                "configuration_id": config.id,
                "created_at": datetime.utcnow().isoformat()
            })
        
        # Verificar sincronizações antigas
        if last_sync and last_sync.completed_at:
            last_sync_dt = datetime.fromisoformat(last_sync.completed_at)
            if datetime.utcnow() - last_sync_dt > timedelta(hours=2):
                alerts.append({
                    "type": "warning",
                    "severity": "medium",
                    "message": "Última sincronização há mais de 2 horas",
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
        logger.error(f"Erro ao buscar overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== CONFIGURATIONS ==============

@router.get("/configurations", response_model=ChannelManagerListResponse)
def list_configurations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros
    channel_type: Optional[ChannelType] = Query(None, description="Tipo de canal"),
    status: Optional[ChannelSyncStatus] = Query(None, description="Status"),
    is_active: Optional[bool] = Query(None, description="Apenas ativos"),
    sync_enabled: Optional[bool] = Query(None, description="Sincronização habilitada"),
    has_errors: Optional[bool] = Query(None, description="Com erros"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista configurações de Channel Manager com filtros"""
    try:
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
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                WuBookConfiguration.wubook_property_name.ilike(search_term)
            )
        
        # Contar total
        total = query.count()
        
        # Paginação
        skip = (page - 1) * per_page
        configurations = query.offset(skip).limit(per_page).all()
        
        # Converter para response
        items = []
        for config in configurations:
            # Determinar status
            if not config.is_active:
                config_status = ChannelSyncStatus.DISCONNECTED
            elif config.error_count > 0:
                config_status = ChannelSyncStatus.ERROR
            elif config.is_connected:
                config_status = ChannelSyncStatus.CONNECTED
            else:
                config_status = ChannelSyncStatus.PENDING
            
            # Contar sincronizações
            total_syncs = db.query(WuBookSyncLog).filter(
                WuBookSyncLog.configuration_id == config.id
            ).count()
            
            successful_syncs = db.query(WuBookSyncLog).filter(
                WuBookSyncLog.configuration_id == config.id,
                WuBookSyncLog.status == "success"
            ).count()
            
            item = ChannelConfigurationResponse(
                id=config.id,
                wubook_configuration_id=config.id,
                tenant_id=config.tenant_id,
                channel_type=ChannelType.OTHER,  # Seria mapeado baseado na configuração
                channel_name=config.wubook_property_name or "Canal WuBook",
                sync_enabled=config.sync_enabled,
                sync_direction=SyncDirection.BIDIRECTIONAL,
                sync_frequency="every_15min",
                sync_availability=config.sync_availability,
                sync_rates=config.sync_rates,
                sync_restrictions=config.sync_restrictions,
                sync_bookings=config.sync_bookings,
                priority_level=1,
                is_active=config.is_active,
                channel_settings={},
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
        
        # Resumo
        summary = {
            "total_configurations": total,
            "active_configurations": len([i for i in items if i.is_active]),
            "connected_configurations": len([i for i in items if i.status == ChannelSyncStatus.CONNECTED]),
            "error_configurations": len([i for i in items if i.status == ChannelSyncStatus.ERROR])
        }
        
        return ChannelManagerListResponse(
            items=items,
            total=total,
            page=page,
            pages=math.ceil(total / per_page),
            per_page=per_page,
            summary=summary,
            filters_applied={
                "channel_type": channel_type,
                "status": status,
                "is_active": is_active,
                "sync_enabled": sync_enabled,
                "has_errors": has_errors,
                "search": search
            }
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar configurações: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/configurations/{configuration_id}", response_model=ChannelConfigurationResponse)
def get_configuration(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca configuração específica"""
    config = db.query(WuBookConfiguration).filter(
        WuBookConfiguration.id == configuration_id,
        WuBookConfiguration.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    # Determinar status (lógica similar ao list)
    if not config.is_active:
        config_status = ChannelSyncStatus.DISCONNECTED
    elif config.error_count > 0:
        config_status = ChannelSyncStatus.ERROR
    elif config.is_connected:
        config_status = ChannelSyncStatus.CONNECTED
    else:
        config_status = ChannelSyncStatus.PENDING
    
    # Estatísticas
    total_syncs = db.query(WuBookSyncLog).filter(
        WuBookSyncLog.configuration_id == config.id
    ).count()
    
    successful_syncs = db.query(WuBookSyncLog).filter(
        WuBookSyncLog.configuration_id == config.id,
        WuBookSyncLog.status == "success"
    ).count()
    
    return ChannelConfigurationResponse(
        id=config.id,
        wubook_configuration_id=config.id,
        tenant_id=config.tenant_id,
        channel_type=ChannelType.OTHER,
        channel_name=config.wubook_property_name or "Canal WuBook",
        sync_enabled=config.sync_enabled,
        sync_direction=SyncDirection.BIDIRECTIONAL,
        sync_frequency="every_15min",
        sync_availability=config.sync_availability,
        sync_rates=config.sync_rates,
        sync_restrictions=config.sync_restrictions,
        sync_bookings=config.sync_bookings,
        priority_level=1,
        is_active=config.is_active,
        channel_settings={},
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


# ============== SYNCHRONIZATION ==============

@router.post("/sync/manual", response_model=SyncResult)
def manual_sync(
    sync_request: SyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Executa sincronização manual"""
    try:
        sync_id = f"manual_sync_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
        
        # Validar configuração se especificada
        if sync_request.configuration_id:
            config = db.query(WuBookConfiguration).filter(
                WuBookConfiguration.id == sync_request.configuration_id,
                WuBookConfiguration.tenant_id == current_user.tenant_id
            ).first()
            
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Configuração não encontrada"
                )
        
        # Criar serviço de sincronização
        if sync_request.force_full_sync:
            # Sincronização completa
            with AvailabilitySyncJob(db) as job:
                result = job.run_full_sync(
                    tenant_id=current_user.tenant_id,
                    configuration_id=sync_request.configuration_id,
                    days_ahead=(sync_request.date_to - date.today()).days if sync_request.date_to else 30,
                    days_back=(date.today() - sync_request.date_from).days if sync_request.date_from else 1,
                    force_all=True
                )
        else:
            # Sincronização incremental
            with AvailabilitySyncJob(db) as job:
                result = job.run_incremental_sync(
                    tenant_id=current_user.tenant_id,
                    configuration_id=sync_request.configuration_id
                )
        
        # Converter resultado
        sync_result = SyncResult(
            sync_id=sync_id,
            configuration_id=sync_request.configuration_id,
            status=result.get("job_type", "manual"),
            success=result.get("success", False),
            started_at=datetime.fromisoformat(result.get("started_at", datetime.utcnow().isoformat())),
            completed_at=datetime.fromisoformat(result.get("completed_at", datetime.utcnow().isoformat())),
            total_items=result.get("total_synced", 0),
            successful_items=result.get("total_synced", 0),
            failed_items=result.get("total_errors", 0),
            changes_summary={"synced": result.get("total_synced", 0)},
            errors=result.get("errors", [])
        )
        
        return sync_result
        
    except Exception as e:
        logger.error(f"Erro na sincronização manual: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na sincronização: {str(e)}"
        )


@router.get("/sync/status/{configuration_id}")
def get_sync_status(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca status de sincronização de uma configuração"""
    try:
        # Verificar se configuração existe
        config = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.id == configuration_id,
            WuBookConfiguration.tenant_id == current_user.tenant_id
        ).first()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração não encontrada"
            )
        
        # Buscar status usando AvailabilitySyncJob
        with AvailabilitySyncJob(db) as job:
            health_status = job.get_sync_health_status(
                tenant_id=current_user.tenant_id,
                configuration_id=configuration_id
            )
        
        return health_status
        
    except Exception as e:
        logger.error(f"Erro ao buscar status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
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
        availability_service = RoomAvailabilityService(db)
        
        # Converter para request de calendário padrão
        from app.schemas.room_availability import CalendarAvailabilityRequest
        
        standard_request = CalendarAvailabilityRequest(
            date_from=calendar_request.date_from,
            date_to=calendar_request.date_to,
            room_ids=calendar_request.room_ids,
            room_type_id=calendar_request.room_type_id,
            property_id=calendar_request.property_id,
            include_reserved=True
        )
        
        # Buscar dados de disponibilidade
        calendar_data = availability_service.get_calendar_availability(
            standard_request,
            current_user.tenant_id
        )
        
        # Buscar mapeamentos WuBook para incluir status de canal
        mappings = db.query(WuBookRoomMapping).join(Room).filter(
            Room.tenant_id == current_user.tenant_id,
            WuBookRoomMapping.is_active == True
        ).all()
        
        mapping_dict = {m.room_id: m for m in mappings}
        
        # Enriquecer dados com informações de canal
        enriched_calendar = []
        
        for day_data in calendar_data:
            enriched_availabilities = []
            
            for availability in day_data['availabilities']:
                # Converter availability para dict se necessário
                if hasattr(availability, '__dict__'):
                    avail_dict = {
                        'id': availability.id,
                        'room_id': availability.room_id,
                        'date': availability.date,
                        'is_available': availability.is_available,
                        'is_bookable': availability.is_bookable,
                        'rate_override': availability.rate_override,
                        'min_stay': availability.min_stay,
                        'closed_to_arrival': availability.closed_to_arrival,
                        'closed_to_departure': availability.closed_to_departure,
                        'sync_pending': availability.sync_pending,
                        'wubook_synced': availability.wubook_synced,
                        'wubook_sync_error': availability.wubook_sync_error,
                        'last_wubook_sync': availability.last_wubook_sync
                    }
                    
                    # Adicionar info do quarto
                    if availability.room:
                        avail_dict['room_number'] = availability.room.room_number
                        avail_dict['room_name'] = availability.room.name
                else:
                    avail_dict = availability
                
                # Adicionar informações de canal
                mapping = mapping_dict.get(avail_dict['room_id'])
                if mapping:
                    avail_dict['channel_info'] = {
                        'wubook_room_id': mapping.wubook_room_id,
                        'sync_enabled': mapping.sync_availability,
                        'configuration_id': mapping.configuration_id
                    }
                else:
                    avail_dict['channel_info'] = None
                
                enriched_availabilities.append(avail_dict)
            
            enriched_calendar.append({
                'date': day_data['date'],
                'availabilities': enriched_availabilities,
                'summary': day_data['summary']
            })
        
        # Resumo por quarto
        rooms_summary = []
        if calendar_request.room_ids:
            for room_id in calendar_request.room_ids:
                room = db.query(Room).filter(
                    Room.id == room_id,
                    Room.tenant_id == current_user.tenant_id
                ).first()
                
                if room:
                    mapping = mapping_dict.get(room_id)
                    rooms_summary.append({
                        'room_id': room_id,
                        'room_number': room.room_number,
                        'room_name': room.name,
                        'has_channel_mapping': mapping is not None,
                        'sync_enabled': mapping.sync_availability if mapping else False
                    })
        
        # Resumo por canal (baseado em configurações)
        configs = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            WuBookConfiguration.is_active == True
        ).all()
        
        channels_summary = []
        for config in configs:
            mapped_rooms = len([m for m in mappings if m.configuration_id == config.id])
            
            channels_summary.append({
                'configuration_id': config.id,
                'channel_name': config.wubook_property_name,
                'mapped_rooms': mapped_rooms,
                'sync_enabled': config.sync_enabled,
                'last_sync': config.last_sync_at
            })
        
        # Estatísticas gerais
        total_days = (calendar_request.date_to - calendar_request.date_from).days + 1
        total_records = sum(len(day['availabilities']) for day in enriched_calendar)
        synced_records = sum(
            len([a for a in day['availabilities'] if a.get('wubook_synced', False)])
            for day in enriched_calendar
        )
        
        statistics = {
            'total_days': total_days,
            'total_records': total_records,
            'synced_records': synced_records,
            'sync_rate': (synced_records / total_records * 100) if total_records > 0 else 0,
            'pending_sync': sum(
                len([a for a in day['availabilities'] if a.get('sync_pending', False)])
                for day in enriched_calendar
            )
        }
        
        # Status de sincronização
        sync_status = {
            'healthy_configurations': len([c for c in configs if c.error_count == 0]),
            'error_configurations': len([c for c in configs if c.error_count > 0]),
            'last_global_sync': max([c.last_sync_at for c in configs if c.last_sync_at], default=None)
        }
        
        return AvailabilityCalendarResponse(
            date_from=calendar_request.date_from,
            date_to=calendar_request.date_to,
            total_days=total_days,
            calendar_data=enriched_calendar,
            rooms_summary=rooms_summary,
            channels_summary=channels_summary,
            statistics=statistics,
            sync_status=sync_status
        )
        
    except Exception as e:
        logger.error(f"Erro ao buscar calendário: {str(e)}")
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
    operation_id = f"bulk_update_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    started_at = datetime.utcnow()
    
    try:
        availability_service = RoomAvailabilityService(db)
        
        # Converter para formato padrão
        from app.schemas.room_availability import BulkAvailabilityUpdate as StandardBulkUpdate
        
        standard_bulk = StandardBulkUpdate(
            room_ids=bulk_request.room_ids,
            date_from=bulk_request.date_from,
            date_to=bulk_request.date_to,
            is_available=bulk_request.is_available,
            is_blocked=bulk_request.is_blocked,
            rate_override=bulk_request.rate_override,
            min_stay=bulk_request.min_stay,
            max_stay=bulk_request.max_stay,
            closed_to_arrival=bulk_request.closed_to_arrival,
            closed_to_departure=bulk_request.closed_to_departure,
            reason=bulk_request.reason
        )
        
        # Executar atualização em massa
        result = availability_service.bulk_update_availability(
            standard_bulk,
            current_user.tenant_id,
            mark_for_sync=bulk_request.sync_immediately
        )
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        # Sincronização automática se solicitada
        sync_result = None
        if bulk_request.sync_immediately and result.get("created", 0) + result.get("updated", 0) > 0:
            try:
                # Executar sincronização em background
                with AvailabilitySyncJob(db) as job:
                    sync_result = job.run_incremental_sync(
                        tenant_id=current_user.tenant_id
                    )
            except Exception as e:
                logger.warning(f"Erro na sincronização automática: {str(e)}")
        
        return BulkOperationResult(
            operation_id=operation_id,
            total_items=result.get("total_processed", 0),
            successful_items=result.get("created", 0) + result.get("updated", 0),
            failed_items=len(result.get("errors", [])),
            created_count=result.get("created", 0),
            updated_count=result.get("updated", 0),
            skipped_count=0,
            errors=result.get("errors", []),
            sync_triggered=bulk_request.sync_immediately,
            sync_result=None,  # Seria convertido de sync_result se necessário
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration
        )
        
    except Exception as e:
        logger.error(f"Erro na operação em massa: {str(e)}")
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        return BulkOperationResult(
            operation_id=operation_id,
            total_items=0,
            successful_items=0,
            failed_items=0,
            created_count=0,
            updated_count=0,
            skipped_count=0,
            errors=[str(e)],
            sync_triggered=False,
            sync_result=None,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration
        )


# ============== HEALTH AND MONITORING ==============

@router.get("/health", response_model=SyncHealthReport)
def get_sync_health(
    days_back: int = Query(7, ge=1, le=30, description="Dias para análise"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Relatório de saúde do Channel Manager"""
    try:
        with AvailabilitySyncJob(db) as job:
            health_status = job.get_sync_health_status(
                tenant_id=current_user.tenant_id
            )
        
        # Buscar configurações
        configurations = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        ).all()
        
        # Categorizar configurações
        healthy_configs = [c for c in configurations if c.is_active and c.error_count == 0]
        warning_configs = [c for c in configurations if c.is_active and 0 < c.error_count <= 5]
        critical_configs = [c for c in configurations if c.error_count > 5 or not c.is_connected]
        
        # Determinar saúde geral
        if len(critical_configs) > 0:
            overall_health = "critical"
            health_score = max(0, 100 - (len(critical_configs) * 30) - (len(warning_configs) * 10))
        elif len(warning_configs) > len(healthy_configs):
            overall_health = "warning"
            health_score = max(50, 100 - (len(warning_configs) * 15))
        else:
            overall_health = "healthy"
            health_score = min(100, 90 + len(healthy_configs))
        
        # Atividade recente
        recent_logs = db.query(WuBookSyncLog).join(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            WuBookSyncLog.created_at >= datetime.utcnow() - timedelta(days=1)
        ).all()
        
        recent_activity = {
            "total_syncs_24h": len(recent_logs),
            "successful_syncs_24h": len([log for log in recent_logs if log.status == "success"]),
            "failed_syncs_24h": len([log for log in recent_logs if log.status == "error"]),
            "average_duration": sum([log.duration_seconds or 0 for log in recent_logs]) / len(recent_logs) if recent_logs else 0
        }
        
        # Problemas identificados
        issues = []
        for config in critical_configs:
            issues.append({
                "type": "critical",
                "configuration_id": config.id,
                "description": f"Configuração {config.wubook_property_name} com {config.error_count} erros",
                "last_error": config.last_error_at
            })
        
        # Recomendações
        recommendations = health_status.get("recommendations", [])
        
        return SyncHealthReport(
            overall_health=overall_health,
            health_score=health_score,
            total_configurations=len(configurations),
            healthy_configurations=len(healthy_configs),
            warning_configurations=len(warning_configs),
            critical_configurations=len(critical_configs),
            sync_rate=health_status.get("sync_rate", 0),
            error_rate=health_status.get("error_rate", 0),
            pending_rate=health_status.get("pending_rate", 0),
            recent_activity=recent_activity,
            issues=issues,
            recommendations=recommendations,
            generated_at=datetime.utcnow(),
            period_analyzed=f"últimos {days_back} dias"
        )
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório de saúde: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


# ============== UTILITIES ==============

@router.post("/sync/reset-errors", response_model=MessageResponse)
def reset_sync_errors(
    configuration_id: Optional[int] = Query(None, description="Configuração específica"),
    room_ids: Optional[List[int]] = Query(None, description="Quartos específicos"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reset erros de sincronização"""
    try:
        query = db.query(RoomAvailability).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.wubook_sync_error.isnot(None),
            RoomAvailability.is_active == True
        )
        
        if room_ids:
            query = query.filter(RoomAvailability.room_id.in_(room_ids))
        
        if configuration_id:
            # Filtrar por configuração via mapeamentos
            query = query.join(Room).join(
                WuBookRoomMapping,
                WuBookRoomMapping.room_id == Room.id
            ).filter(
                WuBookRoomMapping.configuration_id == configuration_id,
                WuBookRoomMapping.is_active == True
            )
        
        # Reset erros
        count = query.update({
            RoomAvailability.wubook_sync_error: None,
            RoomAvailability.sync_pending: True
        }, synchronize_session=False)
        
        db.commit()
        
        return MessageResponse(
            message=f"Reset realizado em {count} registros de disponibilidade"
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao resetar erros: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )


@router.get("/statistics/performance")
def get_performance_statistics(
    days_back: int = Query(30, ge=1, le=90, description="Dias para análise"),
    configuration_id: Optional[int] = Query(None, description="Configuração específica"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Estatísticas de performance detalhadas"""
    try:
        # Período de análise
        date_from = datetime.utcnow() - timedelta(days=days_back)
        
        # Buscar configurações
        configs_query = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id
        )
        
        if configuration_id:
            configs_query = configs_query.filter(WuBookConfiguration.id == configuration_id)
        
        configurations = configs_query.all()
        
        stats = []
        
        for config in configurations:
            # Logs de sincronização
            logs = db.query(WuBookSyncLog).filter(
                WuBookSyncLog.configuration_id == config.id,
                WuBookSyncLog.created_at >= date_from
            ).all()
            
            total_syncs = len(logs)
            successful_syncs = len([log for log in logs if log.status == "success"])
            failed_syncs = len([log for log in logs if log.status == "error"])
            
            # Duração média
            durations = [log.duration_seconds for log in logs if log.duration_seconds]
            avg_duration = sum(durations) / len(durations) if durations else 0
            
            # Registros de disponibilidade
            mapped_rooms = db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.configuration_id == config.id,
                WuBookRoomMapping.is_active == True
            ).count()
            
            total_avail_records = db.query(RoomAvailability).join(Room).join(
                WuBookRoomMapping,
                WuBookRoomMapping.room_id == Room.id
            ).filter(
                WuBookRoomMapping.configuration_id == config.id,
                RoomAvailability.tenant_id == current_user.tenant_id,
                RoomAvailability.is_active == True,
                RoomAvailability.date >= date.today(),
                RoomAvailability.date <= date.today() + timedelta(days=30)
            ).count()
            
            synced_records = db.query(RoomAvailability).join(Room).join(
                WuBookRoomMapping,
                WuBookRoomMapping.room_id == Room.id
            ).filter(
                WuBookRoomMapping.configuration_id == config.id,
                RoomAvailability.tenant_id == current_user.tenant_id,
                RoomAvailability.wubook_synced == True,
                RoomAvailability.is_active == True,
                RoomAvailability.date >= date.today(),
                RoomAvailability.date <= date.today() + timedelta(days=30)
            ).count()
            
            stat = ChannelPerformanceStats(
                channel_id=str(config.id),
                channel_name=config.wubook_property_name or f"WuBook Config {config.id}",
                channel_type=ChannelType.OTHER,
                total_syncs=total_syncs,
                successful_syncs=successful_syncs,
                failed_syncs=failed_syncs,
                success_rate=(successful_syncs / total_syncs * 100) if total_syncs > 0 else 0,
                total_availability_records=total_avail_records,
                synchronized_records=synced_records,
                pending_sync_records=total_avail_records - synced_records,
                error_records=0,  # Seria calculado baseado em erros específicos
                average_sync_duration=avg_duration,
                last_sync_at=datetime.fromisoformat(config.last_sync_at) if config.last_sync_at else None,
                next_sync_at=None,  # Seria calculado baseado na programação
                commission_rate=None,
                estimated_monthly_revenue=None
            )
            
            stats.append(stat)
        
        return {
            "period_days": days_back,
            "configurations_analyzed": len(configurations),
            "performance_stats": stats,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao buscar estatísticas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno: {str(e)}"
        )