# backend/app/api/v1/endpoints/rate_plans.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
import logging
import math

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.rate_plan import (
    RatePlanCreate, RatePlanUpdate, RatePlanResponse, RatePlanListResponse,
    RatePlanFilters, BulkPricingOperation, BulkPricingResult,
    RateCalculationRequest, RateCalculationResponse
)
from app.schemas.common import MessageResponse
from app.services.rate_plan_service import RatePlanService
from app.services.pricing_service import PricingService

logger = logging.getLogger(__name__)

router = APIRouter()

# ============== CRUD BÁSICO ==============

@router.get("", response_model=RatePlanListResponse)
def list_rate_plans(
    # Filtros básicos
    search: Optional[str] = Query(None, description="Buscar por nome ou código"),
    rate_plan_type: Optional[str] = Query(None, description="Filtrar por tipo"),
    room_type_id: Optional[int] = Query(None, description="Filtrar por tipo de quarto"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo"),
    is_default: Optional[bool] = Query(None, description="Filtrar planos padrão"),
    
    # Paginação
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Dependências
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista planos de tarifa com filtros e paginação"""
    rate_plan_service = RatePlanService(db)
    
    # Construir filtros
    filters = RatePlanFilters(
        search=search,
        rate_plan_type=rate_plan_type,
        room_type_id=room_type_id,
        property_id=property_id,
        is_active=is_active,
        is_default=is_default
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar rate plans e total
    rate_plans = rate_plan_service.get_rate_plans(
        current_user.tenant_id, filters, skip, per_page
    )
    total = rate_plan_service.count_rate_plans(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    rate_plans_response = []
    for rate_plan in rate_plans:
        response_data = RatePlanResponse.model_validate(rate_plan)
        
        # Adicionar dados relacionados
        if rate_plan.room_type:
            response_data.room_type_name = rate_plan.room_type.name
        if rate_plan.property_obj:
            response_data.property_name = rate_plan.property_obj.name
        
        rate_plans_response.append(response_data)
    
    return RatePlanListResponse(
        rate_plans=rate_plans_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/{rate_plan_id}", response_model=RatePlanResponse)
def get_rate_plan(
    rate_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca plano de tarifa por ID"""
    rate_plan_service = RatePlanService(db)
    
    rate_plan = rate_plan_service.get_rate_plan(rate_plan_id, current_user.tenant_id)
    if not rate_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plano de tarifa não encontrado"
        )
    
    response_data = RatePlanResponse.model_validate(rate_plan)
    
    # Adicionar dados relacionados
    if rate_plan.room_type:
        response_data.room_type_name = rate_plan.room_type.name
    if rate_plan.property_obj:
        response_data.property_name = rate_plan.property_obj.name
    
    return response_data


@router.post("", response_model=RatePlanResponse, status_code=status.HTTP_201_CREATED)
def create_rate_plan(
    rate_plan_data: RatePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria novo plano de tarifa"""
    rate_plan_service = RatePlanService(db)
    
    rate_plan = rate_plan_service.create_rate_plan(
        rate_plan_data, current_user.tenant_id, current_user.id
    )
    
    response_data = RatePlanResponse.model_validate(rate_plan)
    
    # Adicionar dados relacionados
    if rate_plan.room_type:
        response_data.room_type_name = rate_plan.room_type.name
    if rate_plan.property_obj:
        response_data.property_name = rate_plan.property_obj.name
    
    logger.info(f"Plano de tarifa criado: {rate_plan.name} por usuário {current_user.id}")
    return response_data


@router.put("/{rate_plan_id}", response_model=RatePlanResponse)
def update_rate_plan(
    rate_plan_id: int,
    rate_plan_data: RatePlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza plano de tarifa"""
    rate_plan_service = RatePlanService(db)
    
    rate_plan = rate_plan_service.update_rate_plan(
        rate_plan_id, rate_plan_data, current_user.tenant_id, current_user.id
    )
    
    response_data = RatePlanResponse.model_validate(rate_plan)
    
    # Adicionar dados relacionados
    if rate_plan.room_type:
        response_data.room_type_name = rate_plan.room_type.name
    if rate_plan.property_obj:
        response_data.property_name = rate_plan.property_obj.name
    
    logger.info(f"Plano de tarifa atualizado: {rate_plan.name} por usuário {current_user.id}")
    return response_data


@router.delete("/{rate_plan_id}", response_model=MessageResponse)
def delete_rate_plan(
    rate_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Exclui plano de tarifa (soft delete)"""
    rate_plan_service = RatePlanService(db)
    
    success = rate_plan_service.delete_rate_plan(
        rate_plan_id, current_user.tenant_id, current_user.id
    )
    
    if success:
        logger.info(f"Plano de tarifa excluído: ID {rate_plan_id} por usuário {current_user.id}")
        return MessageResponse(message="Plano de tarifa excluído com sucesso")
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao excluir plano de tarifa"
        )


# ============== OPERAÇÕES EM MASSA ==============

@router.post("/bulk-pricing", response_model=BulkPricingResult)
def bulk_update_pricing(
    operation: BulkPricingOperation,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualização em massa de preços"""
    rate_plan_service = RatePlanService(db)
    
    # Validações básicas
    if not operation.rate_plan_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lista de planos de tarifa é obrigatória"
        )
    
    if operation.date_from > operation.date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data inicial deve ser anterior à data final"
        )
    
    if operation.operation_type not in ["set", "multiply", "add"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de operação deve ser: set, multiply ou add"
        )
    
    # Executar operação
    result = rate_plan_service.bulk_update_pricing(
        operation, current_user.tenant_id, current_user.id
    )
    
    logger.info(f"Operação em massa executada por usuário {current_user.id}: {result.message}")
    return result


@router.post("/copy-pricing", response_model=MessageResponse)
def copy_pricing_between_periods(
    source_date_from: str = Query(..., description="Data inicial origem"),
    source_date_to: str = Query(..., description="Data final origem"),
    target_date_from: str = Query(..., description="Data inicial destino"),
    target_date_to: str = Query(..., description="Data final destino"),
    rate_plan_ids: List[int] = Query(..., description="IDs dos planos"),
    overwrite_existing: bool = Query(False, description="Sobrescrever existentes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Copia preços entre períodos"""
    # Esta funcionalidade pode ser implementada posteriormente
    # quando criarmos a tabela de pricing_rules
    
    return MessageResponse(
        message="Funcionalidade de cópia de preços será implementada em breve"
    )


# ============== CÁLCULOS DE PREÇOS ==============

@router.post("/calculate-rate", response_model=RateCalculationResponse)
def calculate_rate(
    request: RateCalculationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Calcula tarifa para uma estadia específica"""
    pricing_service = PricingService(db)
    
    # Validações básicas
    if request.checkin_date >= request.checkout_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de checkout deve ser posterior ao checkin"
        )
    
    if request.occupancy < 1 or request.occupancy > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ocupação deve ser entre 1 e 10 pessoas"
        )
    
    # Calcular tarifa
    calculation = pricing_service.calculate_rate(request, current_user.tenant_id)
    
    return calculation


@router.get("/best-rate/{room_type_id}", response_model=RateCalculationResponse)
def get_best_available_rate(
    room_type_id: int,
    checkin_date: str = Query(..., description="Data checkin (YYYY-MM-DD)"),
    checkout_date: str = Query(..., description="Data checkout (YYYY-MM-DD)"),
    occupancy: int = Query(..., ge=1, le=10, description="Número de pessoas"),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Encontra a melhor tarifa disponível para critérios específicos"""
    pricing_service = PricingService(db)
    
    try:
        from datetime import datetime
        checkin = datetime.fromisoformat(checkin_date).date()
        checkout = datetime.fromisoformat(checkout_date).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use YYYY-MM-DD"
        )
    
    if checkin >= checkout:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data de checkout deve ser posterior ao checkin"
        )
    
    # Buscar melhor tarifa
    best_rate = pricing_service.get_best_available_rate(
        room_type_id, checkin, checkout, occupancy, 
        current_user.tenant_id, property_id
    )
    
    if not best_rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma tarifa disponível para os critérios especificados"
        )
    
    return best_rate


# ============== YIELD MANAGEMENT ==============

@router.get("/yield-analysis/{rate_plan_id}")
def get_yield_analysis(
    rate_plan_id: int,
    target_date: str = Query(..., description="Data alvo (YYYY-MM-DD)"),
    occupancy_threshold: float = Query(0.8, ge=0.0, le=1.0, description="Limite de ocupação"),
    price_increase: float = Query(0.1, ge=0.0, le=1.0, description="% de aumento"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Análise de yield management para um plano específico"""
    pricing_service = PricingService(db)
    
    try:
        from datetime import datetime
        target = datetime.fromisoformat(target_date).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use YYYY-MM-DD"
        )
    
    analysis = pricing_service.calculate_occupancy_based_pricing(
        rate_plan_id, target, current_user.tenant_id,
        occupancy_threshold, price_increase
    )
    
    if analysis.get('error'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=analysis['error']
        )
    
    return analysis


@router.get("/pricing-recommendations")
def get_pricing_recommendations(
    date_from: str = Query(..., description="Data inicial (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Data final (YYYY-MM-DD)"),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Gera recomendações de preços baseadas em análise de demanda"""
    pricing_service = PricingService(db)
    
    try:
        from datetime import datetime
        date_from_obj = datetime.fromisoformat(date_from).date()
        date_to_obj = datetime.fromisoformat(date_to).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use YYYY-MM-DD"
        )
    
    if date_from_obj > date_to_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data inicial deve ser anterior à data final"
        )
    
    # Limitar período máximo
    days_diff = (date_to_obj - date_from_obj).days
    if days_diff > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período máximo permitido: 90 dias"
        )
    
    recommendations = pricing_service.get_pricing_recommendations(
        current_user.tenant_id, date_from_obj, date_to_obj, property_id
    )
    
    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_recommendations": len(recommendations),
        "recommendations": recommendations
    }


# ============== UTILITÁRIOS ==============

@router.get("/applicable/{room_type_id}")
def get_applicable_rate_plans(
    room_type_id: int,
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    check_date: Optional[str] = Query(None, description="Data para validar (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca planos de tarifa aplicáveis a um tipo de quarto"""
    rate_plan_service = RatePlanService(db)
    
    check_date_obj = None
    if check_date:
        try:
            from datetime import datetime
            check_date_obj = datetime.fromisoformat(check_date).date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de data inválido. Use YYYY-MM-DD"
            )
    
    rate_plans = rate_plan_service.get_applicable_rate_plans(
        current_user.tenant_id, room_type_id, property_id, check_date_obj
    )
    
    response_data = []
    for rate_plan in rate_plans:
        plan_data = RatePlanResponse.model_validate(rate_plan)
        
        # Adicionar dados relacionados
        if rate_plan.room_type:
            plan_data.room_type_name = rate_plan.room_type.name
        if rate_plan.property_obj:
            plan_data.property_name = rate_plan.property_obj.name
        
        response_data.append(plan_data)
    
    return {
        "room_type_id": room_type_id,
        "property_id": property_id,
        "check_date": check_date,
        "total_applicable_plans": len(response_data),
        "rate_plans": response_data
    }


@router.get("/stats/summary")
def get_rate_plans_summary(
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Estatísticas resumidas dos planos de tarifa"""
    rate_plan_service = RatePlanService(db)
    
    # Buscar todos os planos
    filters = RatePlanFilters(property_id=property_id)
    all_plans = rate_plan_service.get_rate_plans(current_user.tenant_id, filters, 0, 1000)
    
    # Calcular estatísticas
    total_plans = len(all_plans)
    active_plans = len([p for p in all_plans if p.is_active])
    default_plans = len([p for p in all_plans if p.is_default])
    
    # Contar por tipo
    types_count = {}
    for plan in all_plans:
        plan_type = plan.rate_plan_type or "standard"
        types_count[plan_type] = types_count.get(plan_type, 0) + 1
    
    # Preços médios
    prices = [p.base_rate_double for p in all_plans if p.base_rate_double and p.is_active]
    avg_price = sum(prices) / len(prices) if prices else 0
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    
    return {
        "total_plans": total_plans,
        "active_plans": active_plans,
        "inactive_plans": total_plans - active_plans,
        "default_plans": default_plans,
        "types_distribution": types_count,
        "pricing_stats": {
            "average_rate": round(float(avg_price), 2),
            "min_rate": float(min_price),
            "max_rate": float(max_price),
            "total_plans_with_pricing": len(prices)
        }
    }