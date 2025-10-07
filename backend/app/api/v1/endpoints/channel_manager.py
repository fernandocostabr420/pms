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

# ✅ IMPORTS CORRETOS SEM RECURSÃO
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
from app.services.wubook_availability_sync_service import WuBookAvailabilitySyncService
from app.services.room_availability_service import RoomAvailabilityService
from app.tasks.availability_sync_job import AvailabilitySyncJob

# ✅ IMPORTS DE MODELOS ESPECÍFICOS
from app.models.wubook_configuration import WuBookConfiguration
from app.models.wubook_room_mapping import WuBookRoomMapping
from app.models.wubook_sync_log import WuBookSyncLog
from app.models.room_availability import RoomAvailability
from app.models.room import Room

# ✅ IMPORTS PARA BULK EDIT
from app.schemas.bulk_edit import (
    BulkEditRequest, BulkEditResult, BulkEditValidationRequest, BulkEditValidationResult
)
from app.services.bulk_edit_service import BulkEditService
from app.tasks.bulk_edit_job import (
    bulk_edit_async, bulk_edit_with_progress, bulk_edit_validation_async,
    get_bulk_edit_progress, cancel_bulk_edit_task
)

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
        
        # Estatísticas de disponibilidade (mock para evitar recursão)
        availability_stats = {
            "total_rooms": 10,
            "available_rooms": 8,
            "blocked_rooms": 2,
            "sync_rate": 95.5
        }
        
        # Estatísticas de sincronização (mock)
        sync_stats = {
            "total_syncs_today": 24,
            "successful_syncs": 23,
            "failed_syncs": 1,
            "average_duration": 15.3
        }
        
        # Canais por tipo (simulado)
        channels_by_type = {
            "booking_com": len([c for c in configurations if "booking" in (c.wubook_property_name or "").lower()]),
            "expedia": len([c for c in configurations if "expedia" in (c.wubook_property_name or "").lower()]),
            "airbnb": len([c for c in configurations if "airbnb" in (c.wubook_property_name or "").lower()]),
            "other": max(0, total_configurations - sum([
                len([c for c in configurations if keyword in (c.wubook_property_name or "").lower()])
                for keyword in ["booking", "expedia", "airbnb"]
            ]))
        }
        
        # Alertas baseados em erros
        alerts = []
        
        error_configs = [c for c in configurations if c.error_count > 5]
        for config in error_configs:
            alerts.append({
                "type": "error",
                "severity": "high",
                "message": f"Configuração {config.wubook_property_name} com muitos erros",
                "configuration_id": config.id,
                "created_at": datetime.utcnow().isoformat()
            })
        
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
    
    # Determinar status
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


# ============== AVAILABILITY CALENDAR ==============

@router.post("/availability/calendar", response_model=AvailabilityCalendarResponse)
def get_availability_calendar(
    calendar_request: AvailabilityCalendarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca calendário de disponibilidade com status de sincronização"""
    try:
        # ✅ IMPLEMENTAÇÃO SIMPLIFICADA PARA EVITAR RECURSÃO
        
        # Buscar disponibilidades do período
        query = db.query(RoomAvailability).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.date >= calendar_request.date_from,
            RoomAvailability.date <= calendar_request.date_to,
            RoomAvailability.is_active == True
        )
        
        if calendar_request.room_ids:
            query = query.filter(RoomAvailability.room_id.in_(calendar_request.room_ids))
        
        if calendar_request.property_id:
            query = query.join(Room).filter(Room.property_id == calendar_request.property_id)
        
        availabilities = query.all()
        
        # Buscar informações de quartos
        rooms_query = db.query(Room).filter(
            Room.tenant_id == current_user.tenant_id
        )
        
        if calendar_request.room_ids:
            rooms_query = rooms_query.filter(Room.id.in_(calendar_request.room_ids))
        
        if calendar_request.property_id:
            rooms_query = rooms_query.filter(Room.property_id == calendar_request.property_id)
        
        rooms = {room.id: room for room in rooms_query.all()}
        
        # Buscar mapeamentos WuBook
        mappings = db.query(WuBookRoomMapping).filter(
            WuBookRoomMapping.room_id.in_(list(rooms.keys())),
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
            
            # Criar view simplificada
            avail_view = SimpleAvailabilityView(
                date=avail.date,
                room_id=avail.room_id,
                room_number=room.room_number if room else f"Room {avail.room_id}",
                room_name=room.name if room else None,
                is_available=avail.is_available,
                is_bookable=avail.is_bookable,
                rate=avail.rate_override,
                min_stay=avail.min_stay,
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
        
        # Converter para lista ordenada
        sorted_calendar = []
        current_date = calendar_request.date_from
        
        while current_date <= calendar_request.date_to:
            date_str = current_date.isoformat()
            day_data = {
                "date": date_str,
                "availabilities": calendar_data.get(date_str, []),
                "summary": {
                    "total_rooms": len(calendar_data.get(date_str, [])),
                    "available_rooms": len([a for a in calendar_data.get(date_str, []) if a["is_available"]]),
                    "blocked_rooms": len([a for a in calendar_data.get(date_str, []) if not a["is_available"]])
                }
            }
            sorted_calendar.append(day_data)
            current_date += timedelta(days=1)
        
        # Resumo por quarto
        rooms_summary = []
        for room_id, room in rooms.items():
            mapping = mapping_dict.get(room_id)
            rooms_summary.append({
                "room_id": room_id,
                "room_number": room.room_number,
                "room_name": room.name,
                "has_channel_mapping": mapping is not None,
                "sync_enabled": mapping.sync_availability if mapping else False
            })
        
        # Resumo por canal
        configs = db.query(WuBookConfiguration).filter(
            WuBookConfiguration.tenant_id == current_user.tenant_id,
            WuBookConfiguration.is_active == True
        ).all()
        
        channels_summary = []
        for config in configs:
            mapped_rooms = len([m for m in mappings if m.configuration_id == config.id])
            channels_summary.append({
                "configuration_id": config.id,
                "channel_name": config.wubook_property_name,
                "mapped_rooms": mapped_rooms,
                "sync_enabled": config.sync_enabled,
                "last_sync": config.last_sync_at
            })
        
        # Estatísticas
        total_days = (calendar_request.date_to - calendar_request.date_from).days + 1
        total_records = len(availabilities)
        synced_records = len([a for a in availabilities if a.wubook_synced])
        
        statistics = {
            "total_days": total_days,
            "total_records": total_records,
            "synced_records": synced_records,
            "sync_rate": (synced_records / total_records * 100) if total_records > 0 else 0,
            "pending_sync": len([a for a in availabilities if a.sync_pending])
        }
        
        # Status de sincronização
        sync_status = {
            "healthy_configurations": len([c for c in configs if c.error_count == 0]),
            "error_configurations": len([c for c in configs if c.error_count > 0]),
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
        # ✅ IMPLEMENTAÇÃO SIMPLIFICADA SEM DEPENDÊNCIAS CIRCULARES
        
        # Buscar registros existentes
        existing_query = db.query(RoomAvailability).filter(
            RoomAvailability.tenant_id == current_user.tenant_id,
            RoomAvailability.room_id.in_(bulk_request.room_ids),
            RoomAvailability.date >= bulk_request.date_from,
            RoomAvailability.date <= bulk_request.date_to,
            RoomAvailability.is_active == True
        )
        
        existing_records = existing_query.all()
        
        # Aplicar atualizações
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
        
        # Marcar para sincronização se solicitado
        if bulk_request.sync_immediately:
            updates[RoomAvailability.sync_pending] = True
        
        # Atualizar registros
        updated_count = existing_query.update(updates, synchronize_session=False)
        db.commit()
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        return BulkOperationResult(
            operation_id=operation_id,
            total_items=updated_count,
            successful_items=updated_count,
            failed_items=0,
            created_count=0,
            updated_count=updated_count,
            skipped_count=0,
            errors=[],
            sync_triggered=bulk_request.sync_immediately,
            sync_result=None,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration
        )
        
    except Exception as e:
        db.rollback()
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


# ============== BULK EDIT ENDPOINTS ==============

@router.post("/bulk-edit", response_model=BulkEditResult)
def execute_bulk_edit(
    bulk_request: BulkEditRequest,
    background_tasks: BackgroundTasks,
    async_processing: bool = Query(False, description="Processar de forma assíncrona"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa operação de bulk edit no Channel Manager
    
    Permite alterar em massa:
    - Preços (rate_override)
    - Disponibilidade (is_available, is_blocked)
    - Restrições (min_stay, max_stay, closed_to_arrival, closed_to_departure)
    - Stop-sell
    
    Suporta escopo por:
    - Toda a propriedade
    - Tipo de quarto específico
    - Quartos específicos
    """
    try:
        logger.info(f"Bulk edit solicitado - User: {current_user.id}, "
                   f"Escopo: {bulk_request.scope}, "
                   f"Operações: {len(bulk_request.operations)}, "
                   f"Async: {async_processing}")
        
        # Validação rápida do período
        days_diff = (bulk_request.date_to - bulk_request.date_from).days
        if days_diff > 366:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Período não pode exceder 366 dias"
            )
        
        # Se async ou muitas operações, processar em background
        if async_processing or days_diff > 90 or len(bulk_request.operations) > 5:
            # Executar assincronamente
            task = bulk_edit_with_progress.delay(
                bulk_edit_data=bulk_request.dict(),
                tenant_id=current_user.tenant_id,
                user_id=current_user.id
            )
            
            logger.info(f"Bulk edit executando assincronamente - Task ID: {task.id}")
            
            # Retornar resultado parcial com task ID
            return BulkEditResult(
                operation_id=f"async_{task.id}",
                tenant_id=current_user.tenant_id,
                user_id=current_user.id,
                total_items_targeted=0,
                total_operations_executed=0,
                successful_operations=0,
                failed_operations=0,
                skipped_operations=0,
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
                duration_seconds=0.0,
                dry_run=bulk_request.dry_run,
                processing_errors=[f"Processamento assíncrono iniciado - Task ID: {task.id}"],
                request_summary={"async_task_id": task.id}
            )
        
        else:
            # Executar sincronamente
            service = BulkEditService(db)
            result = service.execute_bulk_edit(
                bulk_request, 
                current_user.tenant_id, 
                current_user
            )
            
            logger.info(f"Bulk edit síncrono concluído - {result.operation_id}")
            return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro em bulk edit: {str(e)}")
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
    """
    Valida operação de bulk edit antes da execução
    
    Retorna:
    - Estimativas de processamento
    - Conflitos potenciais
    - Avisos e erros
    - Quartos e datas afetados
    """
    try:
        service = BulkEditService(db)
        
        # Forçar dry_run na validação
        bulk_request = validation_request.bulk_edit_request
        bulk_request.dry_run = True
        
        # Executar dry-run para obter detalhes
        result = service.execute_bulk_edit(
            bulk_request,
            current_user.tenant_id,
            current_user
        )
        
        # Converter para ValidationResult
        validation_result = BulkEditValidationResult(
            is_valid=len(result.validation_errors) == 0,
            estimated_items_to_process=result.total_items_targeted,
            estimated_duration_seconds=max(result.total_items_targeted * 0.01, 1.0),  # Estimativa
            validation_errors=result.validation_errors,
            validation_warnings=[],
            affected_rooms=[],
            recommendations=[]
        )
        
        # Adicionar detalhes se disponível
        if result.detailed_results:
            # Agrupar por quarto
            rooms_data = {}
            for item in result.detailed_results[:100]:  # Limitar para não sobrecarregar
                room_key = item.room_id
                if room_key not in rooms_data:
                    rooms_data[room_key] = {
                        "room_id": item.room_id,
                        "operations_count": 0,
                        "dates_affected": set()
                    }
                rooms_data[room_key]["operations_count"] += 1
                rooms_data[room_key]["dates_affected"].add(str(item.date))
            
            validation_result.affected_rooms = [
                {
                    "room_id": data["room_id"],
                    "operations_count": data["operations_count"],
                    "dates_count": len(data["dates_affected"])
                }
                for data in rooms_data.values()
            ]
        
        # Adicionar recomendações
        if result.total_items_targeted > 1000:
            validation_result.recommendations.append(
                "Operação grande detectada. Recomendamos processamento assíncrono."
            )
        
        if bulk_request.sync_immediately and result.total_items_targeted > 500:
            validation_result.recommendations.append(
                "Sincronização imediata em operação grande pode ser lenta. "
                "Considere sync_immediately=false."
            )
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Erro na validação de bulk edit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na validação: {str(e)}"
        )


@router.get("/bulk-edit/progress/{task_id}")
def get_bulk_edit_task_progress(
    task_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtém progresso de uma task assíncrona de bulk edit
    
    Args:
        task_id: ID da task Celery
        
    Returns:
        Informações de progresso em tempo real
    """
    try:
        progress = get_bulk_edit_progress(task_id)
        
        if progress is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task não encontrada"
            )
        
        return progress
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter progresso da task {task_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter progresso"
        )


@router.delete("/bulk-edit/cancel/{task_id}")
def cancel_bulk_edit_task_endpoint(
    task_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancela uma task assíncrona de bulk edit
    
    Args:
        task_id: ID da task Celery
        
    Returns:
        Confirmação de cancelamento
    """
    try:
        success = cancel_bulk_edit_task(task_id)
        
        if success:
            logger.info(f"Task {task_id} cancelada pelo usuário {current_user.id}")
            return MessageResponse(
                message=f"Task {task_id} cancelada com sucesso",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível cancelar a task"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cancelar task {task_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao cancelar task"
        )


@router.post("/bulk-edit/dry-run", response_model=BulkEditResult)
def bulk_edit_dry_run(
    bulk_request: BulkEditRequest,
    detailed_results: bool = Query(True, description="Incluir resultados detalhados"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa simulação de bulk edit (dry-run)
    
    Mostra exatamente o que seria alterado sem aplicar as mudanças.
    Útil para preview antes da execução real.
    """
    try:
        # Forçar dry_run
        bulk_request.dry_run = True
        
        service = BulkEditService(db)
        result = service.execute_bulk_edit(
            bulk_request,
            current_user.tenant_id,
            current_user
        )
        
        # Limitar detalhes se muitos resultados
        if result.detailed_results and len(result.detailed_results) > 1000:
            if not detailed_results:
                result.detailed_results = None
            else:
                # Manter apenas os primeiros 1000
                result.detailed_results = result.detailed_results[:1000]
                result.processing_errors.append(
                    f"Resultados limitados a 1000 itens (total: {result.total_items_targeted})"
                )
        
        logger.info(f"Dry-run concluído - {result.operation_id}, "
                   f"{result.total_items_targeted} itens analisados")
        
        return result
        
    except Exception as e:
        logger.error(f"Erro em dry-run: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro no dry-run: {str(e)}"
        )


@router.get("/bulk-edit/templates")
def get_bulk_edit_templates(
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna templates pré-definidos para operações comuns de bulk edit
    """
    templates = {
        "stop_sell_weekend": {
            "name": "Stop Sell - Finais de Semana",
            "description": "Bloquear vendas nos finais de semana",
            "operations": [
                {
                    "target": "stop_sell",
                    "operation": "set_value",
                    "value": True
                }
            ],
            "days_of_week": [5, 6],  # Sábado e Domingo
            "suggested_scope": "property"
        },
        "high_season_pricing": {
            "name": "Preços Alta Temporada",
            "description": "Aumentar preços em 25% para alta temporada",
            "operations": [
                {
                    "target": "price",
                    "operation": "increase_percent",
                    "value": 25.0
                }
            ],
            "suggested_scope": "property"
        },
        "minimum_stay_peak": {
            "name": "Estadia Mínima - Período de Pico",
            "description": "Definir estadia mínima de 3 noites",
            "operations": [
                {
                    "target": "min_stay",
                    "operation": "set_value",
                    "value": 3
                }
            ],
            "suggested_scope": "property"
        },
        "closed_to_arrival_sunday": {
            "name": "CTA - Domingos",
            "description": "Fechar chegadas aos domingos",
            "operations": [
                {
                    "target": "closed_to_arrival",
                    "operation": "set_value",
                    "value": True
                }
            ],
            "days_of_week": [6],  # Domingo
            "suggested_scope": "property"
        },
        "open_all_restrictions": {
            "name": "Abrir Todas as Restrições",
            "description": "Remove todas as restrições e abre vendas",
            "operations": [
                {
                    "target": "availability",
                    "operation": "set_value",
                    "value": True
                },
                {
                    "target": "blocked",
                    "operation": "set_value",
                    "value": False
                },
                {
                    "target": "min_stay",
                    "operation": "set_value",
                    "value": 1
                },
                {
                    "target": "closed_to_arrival",
                    "operation": "set_value",
                    "value": False
                },
                {
                    "target": "closed_to_departure",
                    "operation": "set_value",
                    "value": False
                }
            ],
            "suggested_scope": "property"
        }
    }
    
    return {
        "templates": templates,
        "total_templates": len(templates),
        "usage_notes": [
            "Templates são pontos de partida - ajuste conforme necessário",
            "Sempre execute dry-run antes de aplicar mudanças",
            "Templates com days_of_week aplicam apenas aos dias especificados"
        ]
    }


# ============== HEALTH AND MONITORING ==============

@router.get("/health", response_model=SyncHealthReport)
def get_sync_health(
    days_back: int = Query(7, ge=1, le=30, description="Dias para análise"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Relatório de saúde do Channel Manager"""
    try:
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
        
        # Recomendações básicas
        recommendations = []
        if len(critical_configs) > 0:
            recommendations.append("Verificar configurações com erro crítico")
        if len(warning_configs) > 0:
            recommendations.append("Monitorar configurações com avisos")
        
        return SyncHealthReport(
            overall_health=overall_health,
            health_score=health_score,
            total_configurations=len(configurations),
            healthy_configurations=len(healthy_configs),
            warning_configurations=len(warning_configs),
            critical_configurations=len(critical_configs),
            sync_rate=85.5,  # Mock
            error_rate=5.2,   # Mock
            pending_rate=9.3, # Mock
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