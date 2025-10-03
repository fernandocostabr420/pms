# backend/app/api/v1/endpoints/restrictions.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
import logging
import math
from datetime import date

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.reservation_restriction import (
    ReservationRestrictionCreate, ReservationRestrictionUpdate, ReservationRestrictionResponse,
    ReservationRestrictionListResponse, ReservationRestrictionFilters,
    BulkRestrictionOperation, BulkRestrictionResult,
    RestrictionValidationRequest, RestrictionValidationResponse,
    CalendarRestrictionRequest, CalendarRestrictionResponse,
    RestrictionTypeEnum, RestrictionScopeEnum, RestrictionSourceEnum
)
from app.schemas.common import MessageResponse
from app.services.restriction_service import RestrictionService
from app.services.restriction_validation_service import RestrictionValidationService

logger = logging.getLogger(__name__)

router = APIRouter()

# ============== CRUD BÁSICO ==============

@router.get("", response_model=ReservationRestrictionListResponse)
def list_restrictions(
    # Filtros de escopo
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    room_type_id: Optional[int] = Query(None, description="Filtrar por tipo de quarto"),
    room_id: Optional[int] = Query(None, description="Filtrar por quarto específico"),
    
    # Filtros de período
    date_from: Optional[date] = Query(None, description="Data inicial do período"),
    date_to: Optional[date] = Query(None, description="Data final do período"),
    
    # Filtros de tipo de restrição
    restriction_type: Optional[RestrictionTypeEnum] = Query(None, description="Tipo específico de restrição"),
    restriction_types: Optional[str] = Query(None, description="Tipos múltiplos separados por vírgula"),
    
    # Filtros de status
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo"),
    is_restricted: Optional[bool] = Query(None, description="Filtrar se está restringindo"),
    
    # Filtros de origem
    source: Optional[RestrictionSourceEnum] = Query(None, description="Origem da restrição"),
    channel_name: Optional[str] = Query(None, description="Nome do canal"),
    
    # Filtros de escopo
    scope_level: Optional[RestrictionScopeEnum] = Query(None, description="Nível de aplicação"),
    
    # Filtros de sincronização
    sync_pending: Optional[bool] = Query(None, description="Pendente de sincronização"),
    has_sync_error: Optional[bool] = Query(None, description="Com erro de sincronização"),
    
    # Filtros de prioridade
    priority_min: Optional[int] = Query(None, ge=1, le=10, description="Prioridade mínima"),
    priority_max: Optional[int] = Query(None, ge=1, le=10, description="Prioridade máxima"),
    
    # Busca textual
    search: Optional[str] = Query(None, description="Buscar em nome, descrição ou motivo"),
    
    # Paginação
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Dependências
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista restrições de reserva com filtros avançados e paginação"""
    restriction_service = RestrictionService(db)
    
    # Processar tipos múltiplos
    restriction_types_list = None
    if restriction_types:
        try:
            restriction_types_list = [RestrictionTypeEnum(t.strip()) for t in restriction_types.split(',')]
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de restrição inválido: {str(e)}"
            )
    
    # Construir filtros
    filters = ReservationRestrictionFilters(
        property_id=property_id,
        room_type_id=room_type_id,
        room_id=room_id,
        date_from=date_from,
        date_to=date_to,
        restriction_type=restriction_type,
        restriction_types=restriction_types_list,
        is_active=is_active,
        is_restricted=is_restricted,
        source=source,
        channel_name=channel_name,
        scope_level=scope_level,
        sync_pending=sync_pending,
        has_sync_error=has_sync_error,
        priority_min=priority_min,
        priority_max=priority_max,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar restrições
    restrictions = restriction_service.get_restrictions(
        tenant_id=current_user.tenant_id,
        filters=filters,
        skip=skip,
        limit=per_page
    )
    
    # Contar total
    total = restriction_service.count_restrictions(
        tenant_id=current_user.tenant_id,
        filters=filters
    )
    
    # Enriquecer dados de resposta
    enriched_restrictions = []
    for restriction in restrictions:
        restriction_dict = ReservationRestrictionResponse.from_orm(restriction).dict()
        
        # Adicionar campos computados
        restriction_dict['scope_level'] = restriction.scope_level
        restriction_dict['scope_description'] = restriction.scope_description
        restriction_dict['restriction_description'] = restriction.restriction_description
        
        # Adicionar dados relacionados
        if restriction.property_obj:
            restriction_dict['property_name'] = restriction.property_obj.name
        if restriction.room_type:
            restriction_dict['room_type_name'] = restriction.room_type.name
        if restriction.room:
            restriction_dict['room_number'] = restriction.room.room_number
            restriction_dict['room_name'] = restriction.room.name
        
        enriched_restrictions.append(ReservationRestrictionResponse(**restriction_dict))
    
    # Calcular páginas
    pages = math.ceil(total / per_page) if total > 0 else 1
    
    return ReservationRestrictionListResponse(
        restrictions=enriched_restrictions,
        total=total,
        page=page,
        pages=pages,
        per_page=per_page
    )


@router.post("", response_model=ReservationRestrictionResponse, status_code=status.HTTP_201_CREATED)
def create_restriction(
    restriction_data: ReservationRestrictionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova restrição de reserva"""
    restriction_service = RestrictionService(db)
    
    restriction = restriction_service.create_restriction(
        restriction_data=restriction_data,
        tenant_id=current_user.tenant_id,
        user=current_user
    )
    
    # Enriquecer resposta
    response_dict = ReservationRestrictionResponse.from_orm(restriction).dict()
    response_dict['scope_level'] = restriction.scope_level
    response_dict['scope_description'] = restriction.scope_description
    response_dict['restriction_description'] = restriction.restriction_description
    
    if restriction.property_obj:
        response_dict['property_name'] = restriction.property_obj.name
    if restriction.room_type:
        response_dict['room_type_name'] = restriction.room_type.name
    if restriction.room:
        response_dict['room_number'] = restriction.room.room_number
        response_dict['room_name'] = restriction.room.name
    
    return ReservationRestrictionResponse(**response_dict)


@router.get("/{restriction_id}", response_model=ReservationRestrictionResponse)
def get_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca restrição por ID"""
    restriction_service = RestrictionService(db)
    
    restriction = restriction_service.get_restriction(restriction_id, current_user.tenant_id)
    if not restriction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restrição não encontrada"
        )
    
    # Enriquecer resposta
    response_dict = ReservationRestrictionResponse.from_orm(restriction).dict()
    response_dict['scope_level'] = restriction.scope_level
    response_dict['scope_description'] = restriction.scope_description
    response_dict['restriction_description'] = restriction.restriction_description
    
    if restriction.property_obj:
        response_dict['property_name'] = restriction.property_obj.name
    if restriction.room_type:
        response_dict['room_type_name'] = restriction.room_type.name
    if restriction.room:
        response_dict['room_number'] = restriction.room.room_number
        response_dict['room_name'] = restriction.room.name
    
    return ReservationRestrictionResponse(**response_dict)


@router.put("/{restriction_id}", response_model=ReservationRestrictionResponse)
def update_restriction(
    restriction_id: int,
    restriction_data: ReservationRestrictionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza restrição existente"""
    restriction_service = RestrictionService(db)
    
    restriction = restriction_service.update_restriction(
        restriction_id=restriction_id,
        restriction_data=restriction_data,
        tenant_id=current_user.tenant_id,
        user=current_user
    )
    
    # Enriquecer resposta
    response_dict = ReservationRestrictionResponse.from_orm(restriction).dict()
    response_dict['scope_level'] = restriction.scope_level
    response_dict['scope_description'] = restriction.scope_description
    response_dict['restriction_description'] = restriction.restriction_description
    
    return ReservationRestrictionResponse(**response_dict)


@router.delete("/{restriction_id}", response_model=MessageResponse)
def delete_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove restrição"""
    restriction_service = RestrictionService(db)
    
    success = restriction_service.delete_restriction(
        restriction_id=restriction_id,
        tenant_id=current_user.tenant_id,
        user=current_user
    )
    
    if success:
        return MessageResponse(message="Restrição removida com sucesso")
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao remover restrição"
        )


# ============== OPERAÇÕES EM MASSA ==============

@router.post("/bulk", response_model=BulkRestrictionResult)
def bulk_restriction_operation(
    operation_data: BulkRestrictionOperation,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Executa operação em massa com restrições"""
    restriction_service = RestrictionService(db)
    
    logger.info(f"Iniciando operação em massa: {operation_data.operation} por usuário {current_user.id}")
    
    # Validar escopo da operação
    if len(operation_data.property_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pelo menos uma propriedade deve ser especificada"
        )
    
    # Validar período
    if operation_data.date_to < operation_data.date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data final deve ser posterior à data inicial"
        )
    
    # Limitar período para performance
    days_diff = (operation_data.date_to - operation_data.date_from).days
    if days_diff > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período máximo de 365 dias para operações em massa"
        )
    
    # Executar operação
    result = restriction_service.bulk_restriction_operation(
        operation_data=operation_data,
        tenant_id=current_user.tenant_id,
        user=current_user
    )
    
    logger.info(f"Operação em massa concluída: {result.message}")
    return result


# ============== VALIDAÇÃO DE RESTRIÇÕES ==============

@router.post("/validate", response_model=RestrictionValidationResponse)
def validate_restrictions(
    validation_request: RestrictionValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Valida se uma reserva pode ser feita baseada nas restrições existentes"""
    validation_service = RestrictionValidationService(db)
    
    # Calcular days se não fornecido
    if not validation_request.nights:
        validation_request.nights = (
            validation_request.check_out_date - validation_request.check_in_date
        ).days
    
    # Calcular advance_days se não fornecido
    if not validation_request.advance_days:
        from datetime import datetime
        today = datetime.now().date()
        validation_request.advance_days = (validation_request.check_in_date - today).days
    
    result = validation_service.validate_reservation_restrictions(
        validation_request=validation_request,
        tenant_id=current_user.tenant_id
    )
    
    logger.info(f"Validação de restrições: {'✅ VÁLIDA' if result.is_valid else '❌ INVÁLIDA'} "
                f"({len(result.violations)} violações, {len(result.warnings)} avisos)")
    
    return result


# ============== CALENDAR GRID ==============

@router.post("/calendar", response_model=CalendarRestrictionResponse)
def get_restriction_calendar(
    calendar_request: CalendarRestrictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Gera calendário de restrições para visualização"""
    validation_service = RestrictionValidationService(db)
    
    # Validar período máximo para performance
    days_diff = (calendar_request.date_to - calendar_request.date_from).days
    if days_diff > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período máximo de 90 dias para calendário"
        )
    
    result = validation_service.get_restriction_calendar(
        calendar_request=calendar_request,
        tenant_id=current_user.tenant_id
    )
    
    logger.info(f"Calendário gerado: {result.total_days} dias, "
                f"{result.days_with_restrictions} com restrições, "
                f"{result.total_restrictions} restrições total")
    
    return result


# ============== ENDPOINTS AUXILIARES ==============

@router.get("/types", response_model=Dict[str, str])
def get_restriction_types():
    """Lista tipos de restrição disponíveis"""
    return {
        RestrictionTypeEnum.MIN_STAY: "Estadia mínima",
        RestrictionTypeEnum.MAX_STAY: "Estadia máxima", 
        RestrictionTypeEnum.CLOSED_TO_ARRIVAL: "Fechado para chegada",
        RestrictionTypeEnum.CLOSED_TO_DEPARTURE: "Fechado para saída",
        RestrictionTypeEnum.STOP_SELL: "Vendas bloqueadas",
        RestrictionTypeEnum.MIN_ADVANCE_BOOKING: "Antecedência mínima",
        RestrictionTypeEnum.MAX_ADVANCE_BOOKING: "Antecedência máxima"
    }


@router.get("/scopes", response_model=Dict[str, str])
def get_restriction_scopes():
    """Lista escopos de aplicação disponíveis"""
    return {
        RestrictionScopeEnum.PROPERTY: "Toda a propriedade",
        RestrictionScopeEnum.ROOM_TYPE: "Tipo de quarto específico",
        RestrictionScopeEnum.ROOM: "Quarto específico"
    }


@router.get("/sources", response_model=Dict[str, str])
def get_restriction_sources():
    """Lista origens de restrição disponíveis"""
    return {
        RestrictionSourceEnum.MANUAL: "Criação manual",
        RestrictionSourceEnum.CHANNEL_MANAGER: "Channel Manager",
        RestrictionSourceEnum.YIELD_MANAGEMENT: "Yield Management",
        RestrictionSourceEnum.BULK_IMPORT: "Importação em massa",
        RestrictionSourceEnum.API: "API externa"
    }


@router.get("/stats", response_model=Dict[str, Any])
def get_restriction_stats(
    property_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Estatísticas de restrições"""
    from sqlalchemy import func, case
    
    query = db.query(
        func.count(ReservationRestriction.id).label('total_restrictions'),
        func.count(case([(ReservationRestriction.is_active == True, 1)])).label('active_restrictions'),
        func.count(case([(ReservationRestriction.sync_pending == True, 1)])).label('pending_sync'),
        func.count(case([(ReservationRestriction.sync_error.isnot(None), 1)])).label('sync_errors')
    ).filter(
        ReservationRestriction.tenant_id == current_user.tenant_id
    )
    
    if property_id:
        query = query.filter(ReservationRestriction.property_id == property_id)
    
    if date_from:
        query = query.filter(ReservationRestriction.date_to >= date_from)
    
    if date_to:
        query = query.filter(ReservationRestriction.date_from <= date_to)
    
    stats = query.first()
    
    # Estatísticas por tipo
    type_stats = db.query(
        ReservationRestriction.restriction_type,
        func.count(ReservationRestriction.id).label('count')
    ).filter(
        ReservationRestriction.tenant_id == current_user.tenant_id,
        ReservationRestriction.is_active == True
    ).group_by(ReservationRestriction.restriction_type).all()
    
    return {
        "total_restrictions": stats.total_restrictions or 0,
        "active_restrictions": stats.active_restrictions or 0,
        "pending_sync": stats.pending_sync or 0,
        "sync_errors": stats.sync_errors or 0,
        "by_type": {stat.restriction_type: stat.count for stat in type_stats}
    }


# ============== ENDPOINTS DE SINCRONIZAÇÃO ==============

@router.post("/{restriction_id}/sync", response_model=MessageResponse)
def mark_restriction_for_sync(
    restriction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Marca restrição para sincronização com Channel Manager"""
    restriction_service = RestrictionService(db)
    
    restriction = restriction_service.get_restriction(restriction_id, current_user.tenant_id)
    if not restriction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restrição não encontrada"
        )
    
    try:
        restriction.sync_pending = True
        restriction.sync_error = None
        db.commit()
        
        logger.info(f"Restrição {restriction_id} marcada para sincronização")
        return MessageResponse(message="Restrição marcada para sincronização")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao marcar restrição para sync: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/sync/pending", response_model=ReservationRestrictionListResponse)
def list_pending_sync_restrictions(
    property_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista restrições pendentes de sincronização"""
    restriction_service = RestrictionService(db)
    
    filters = ReservationRestrictionFilters(
        property_id=property_id,
        sync_pending=True,
        is_active=True
    )
    
    skip = (page - 1) * per_page
    
    restrictions = restriction_service.get_restrictions(
        tenant_id=current_user.tenant_id,
        filters=filters,
        skip=skip,
        limit=per_page
    )
    
    total = restriction_service.count_restrictions(
        tenant_id=current_user.tenant_id,
        filters=filters
    )
    
    pages = math.ceil(total / per_page) if total > 0 else 1
    
    return ReservationRestrictionListResponse(
        restrictions=[ReservationRestrictionResponse.from_orm(r) for r in restrictions],
        total=total,
        page=page,
        pages=pages,
        per_page=per_page
    )