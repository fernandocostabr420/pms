# backend/app/api/v1/endpoints/sales_channels.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from decimal import Decimal
import logging

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.sales_channel import (
    SalesChannelCreate, SalesChannelUpdate, SalesChannelResponse,
    SalesChannelListResponse, SalesChannelFilters, SalesChannelBulkOperation,
    SalesChannelOrderUpdate, SalesChannelStats, SalesChannelUsage,
    SalesChannelCommission, SalesChannelTestConnection, SalesChannelTestResult,
    ChannelTypeEnum, CommissionTypeEnum
)
from app.services.sales_channel_service import SalesChannelService
from app.utils.pagination import get_pagination_params

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=SalesChannelListResponse)
def list_sales_channels(
    search: Optional[str] = Query(None, description="Buscar por nome ou código"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    is_external: Optional[bool] = Query(None, description="Filtrar canais externos/internos"),
    channel_type: Optional[ChannelTypeEnum] = Query(None, description="Filtrar por tipo de canal"),
    has_api_integration: Optional[bool] = Query(None, description="Filtrar canais com integração API"),
    requires_commission: Optional[bool] = Query(None, description="Filtrar canais com comissão"),
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista canais de venda com filtros e paginação.
    
    - **search**: Busca por nome ou código
    - **is_active**: Filtrar por canais ativos/inativos
    - **is_external**: Filtrar por canais externos (OTAs) ou internos
    - **channel_type**: Filtrar por tipo (direct, ota, phone, email, etc.)
    - **has_api_integration**: Filtrar canais com integração API
    - **requires_commission**: Filtrar canais que cobram comissão
    - **page**: Número da página (padrão: 1)
    - **per_page**: Itens por página (padrão: 20, máximo: 100)
    """
    try:
        sales_channel_service = SalesChannelService(db)
        
        # Criar filtros
        filters = SalesChannelFilters(
            search=search,
            is_active=is_active,
            is_external=is_external,
            channel_type=channel_type,
            has_api_integration=has_api_integration,
            requires_commission=requires_commission
        )
        
        # Buscar canais com paginação
        sales_channels, total = sales_channel_service.get_sales_channels(
            tenant_id=current_user.tenant_id,
            filters=filters,
            page=page,
            per_page=per_page
        )
        
        # Calcular páginas
        pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        
        # Converter para response
        sales_channel_responses = []
        for channel in sales_channels:
            channel_dict = SalesChannelResponse.model_validate(channel).model_dump()
            
            # Adicionar campos computados
            channel_dict["display_name"] = channel.display_name
            channel_dict["is_ota"] = channel.is_ota
            channel_dict["requires_commission"] = channel.requires_commission
            channel_dict["has_integration"] = channel.has_integration
            channel_dict["channel_type_display"] = channel.channel_type_display
            
            sales_channel_responses.append(SalesChannelResponse(**channel_dict))
        
        return SalesChannelListResponse(
            sales_channels=sales_channel_responses,
            total=total,
            page=page,
            pages=pages,
            per_page=per_page
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar canais de venda: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/active", response_model=List[SalesChannelResponse])
def list_active_sales_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista apenas canais de venda ativos, ordenados por display_order.
    Útil para dropdowns e seletores.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channels = sales_channel_service.get_active_sales_channels(current_user.tenant_id)
        
        # Converter para response
        sales_channel_responses = []
        for channel in sales_channels:
            channel_dict = SalesChannelResponse.model_validate(channel).model_dump()
            
            # Adicionar campos computados
            channel_dict["display_name"] = channel.display_name
            channel_dict["is_ota"] = channel.is_ota
            channel_dict["requires_commission"] = channel.requires_commission
            channel_dict["has_integration"] = channel.has_integration
            channel_dict["channel_type_display"] = channel.channel_type_display
            
            sales_channel_responses.append(SalesChannelResponse(**channel_dict))
        
        return sales_channel_responses
        
    except Exception as e:
        logger.error(f"Erro ao listar canais ativos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/external", response_model=List[SalesChannelResponse])
def list_external_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista apenas canais externos (OTAs) ativos.
    Útil para integrações e relatórios de comissão.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channels = sales_channel_service.get_external_channels(current_user.tenant_id)
        
        # Converter para response
        sales_channel_responses = []
        for channel in sales_channels:
            channel_dict = SalesChannelResponse.model_validate(channel).model_dump()
            
            # Adicionar campos computados
            channel_dict["display_name"] = channel.display_name
            channel_dict["is_ota"] = channel.is_ota
            channel_dict["requires_commission"] = channel.requires_commission
            channel_dict["has_integration"] = channel.has_integration
            channel_dict["channel_type_display"] = channel.channel_type_display
            
            sales_channel_responses.append(SalesChannelResponse(**channel_dict))
        
        return sales_channel_responses
        
    except Exception as e:
        logger.error(f"Erro ao listar canais externos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/stats", response_model=SalesChannelStats)
def get_sales_channel_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtém estatísticas dos canais de venda do tenant.
    
    Retorna informações sobre:
    - Total de canais configurados
    - Canais ativos/inativos/externos
    - Canais com integração e comissão
    - Estatísticas de uso (quando disponível)
    """
    try:
        sales_channel_service = SalesChannelService(db)
        stats = sales_channel_service.get_sales_channel_stats(current_user.tenant_id)
        return stats
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("", response_model=SalesChannelResponse, status_code=status.HTTP_201_CREATED)
def create_sales_channel(
    sales_channel_data: SalesChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria novo canal de venda.
    
    - **name**: Nome do canal (ex: "Booking.com", "Site Oficial")
    - **code**: Código único (ex: "booking", "direct")
    - **description**: Descrição opcional
    - **channel_type**: Tipo do canal (direct, ota, phone, email, etc.)
    - **is_external**: Se é canal externo (OTA)
    - **commission_rate**: Taxa de comissão em decimal (ex: 0.15 = 15%)
    - **commission_type**: Tipo de comissão (percentage, fixed, none)
    - **base_fee**: Taxa base fixa (opcional)
    - **has_api_integration**: Se tem integração via API
    - **webhook_url**: URL para webhooks (opcional)
    - **settings**: Configurações específicas (JSON)
    - **business_rules**: Regras de negócio (JSON)
    - **credentials**: Credenciais de integração (serão criptografadas)
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channel = sales_channel_service.create_sales_channel(
            sales_channel_data=sales_channel_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        channel_dict = SalesChannelResponse.model_validate(sales_channel).model_dump()
        channel_dict["display_name"] = sales_channel.display_name
        channel_dict["is_ota"] = sales_channel.is_ota
        channel_dict["requires_commission"] = sales_channel.requires_commission
        channel_dict["has_integration"] = sales_channel.has_integration
        channel_dict["channel_type_display"] = sales_channel.channel_type_display
        
        return SalesChannelResponse(**channel_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar canal de venda: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/{sales_channel_id}", response_model=SalesChannelResponse)
def get_sales_channel(
    sales_channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca canal de venda por ID.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channel = sales_channel_service.get_sales_channel_by_id(
            sales_channel_id=sales_channel_id,
            tenant_id=current_user.tenant_id
        )
        
        if not sales_channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Canal de venda não encontrado"
            )
        
        # Converter para response
        channel_dict = SalesChannelResponse.model_validate(sales_channel).model_dump()
        channel_dict["display_name"] = sales_channel.display_name
        channel_dict["is_ota"] = sales_channel.is_ota
        channel_dict["requires_commission"] = sales_channel.requires_commission
        channel_dict["has_integration"] = sales_channel.has_integration
        channel_dict["channel_type_display"] = sales_channel.channel_type_display
        
        return SalesChannelResponse(**channel_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar canal de venda: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.put("/{sales_channel_id}", response_model=SalesChannelResponse)
def update_sales_channel(
    sales_channel_id: int,
    sales_channel_data: SalesChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza canal de venda existente.
    
    Permite atualização parcial dos campos.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channel = sales_channel_service.update_sales_channel(
            sales_channel_id=sales_channel_id,
            sales_channel_data=sales_channel_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        channel_dict = SalesChannelResponse.model_validate(sales_channel).model_dump()
        channel_dict["display_name"] = sales_channel.display_name
        channel_dict["is_ota"] = sales_channel.is_ota
        channel_dict["requires_commission"] = sales_channel.requires_commission
        channel_dict["has_integration"] = sales_channel.has_integration
        channel_dict["channel_type_display"] = sales_channel.channel_type_display
        
        return SalesChannelResponse(**channel_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar canal de venda: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.delete("/{sales_channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_channel(
    sales_channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Exclui (desativa) canal de venda.
    
    Realiza soft delete, mantendo histórico mas marcando como inativo.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channel_service.delete_sales_channel(
            sales_channel_id=sales_channel_id,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir canal de venda: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/bulk-operation")
def bulk_operation(
    operation_data: SalesChannelBulkOperation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa operação em massa nos canais de venda.
    
    - **operation**: "activate", "deactivate" ou "delete"
    - **sales_channel_ids**: Lista de IDs dos canais
    
    Retorna resultado detalhado de cada operação.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        result = sales_channel_service.bulk_operation(
            operation_data=operation_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro em operação em massa: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.put("/update-order", response_model=List[SalesChannelResponse])
def update_display_order(
    order_data: SalesChannelOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza ordem de exibição dos canais de venda.
    
    - **sales_channel_orders**: Lista de objetos com id e display_order
    
    Exemplo:
    ```json
    {
        "sales_channel_orders": [
            {"id": 1, "display_order": 0},
            {"id": 2, "display_order": 1}
        ]
    }
    ```
    """
    try:
        sales_channel_service = SalesChannelService(db)
        updated_channels = sales_channel_service.update_display_order(
            order_data=order_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        sales_channel_responses = []
        for channel in updated_channels:
            channel_dict = SalesChannelResponse.model_validate(channel).model_dump()
            channel_dict["display_name"] = channel.display_name
            channel_dict["is_ota"] = channel.is_ota
            channel_dict["requires_commission"] = channel.requires_commission
            channel_dict["has_integration"] = channel.has_integration
            channel_dict["channel_type_display"] = channel.channel_type_display
            
            sales_channel_responses.append(SalesChannelResponse(**channel_dict))
        
        return sales_channel_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar ordem: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/code/{channel_code}", response_model=SalesChannelResponse)
def get_sales_channel_by_code(
    channel_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca canal de venda por código.
    
    Útil para integração com sistemas externos que usam códigos.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        sales_channel = sales_channel_service.get_sales_channel_by_code(
            code=channel_code,
            tenant_id=current_user.tenant_id
        )
        
        if not sales_channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Canal de venda com código '{channel_code}' não encontrado"
            )
        
        # Converter para response
        channel_dict = SalesChannelResponse.model_validate(sales_channel).model_dump()
        channel_dict["display_name"] = sales_channel.display_name
        channel_dict["is_ota"] = sales_channel.is_ota
        channel_dict["requires_commission"] = sales_channel.requires_commission
        channel_dict["has_integration"] = sales_channel.has_integration
        channel_dict["channel_type_display"] = sales_channel.channel_type_display
        
        return SalesChannelResponse(**channel_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar canal por código: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{sales_channel_id}/calculate-commission", response_model=SalesChannelCommission)
def calculate_commission(
    sales_channel_id: int,
    base_amount: Decimal = Query(..., description="Valor base para cálculo de comissão"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Calcula comissão para um valor específico.
    
    - **base_amount**: Valor base em decimal
    
    Retorna:
    - Valor da comissão calculada
    - Valor líquido após comissão
    - Detalhes do cálculo
    """
    try:
        sales_channel_service = SalesChannelService(db)
        commission = sales_channel_service.calculate_commission(
            sales_channel_id=sales_channel_id,
            tenant_id=current_user.tenant_id,
            base_amount=base_amount
        )
        
        return commission
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao calcular comissão: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{sales_channel_id}/test-connection", response_model=SalesChannelTestResult)
def test_channel_connection(
    sales_channel_id: int,
    test_type: str = Query(..., description="Tipo de teste: api, webhook, credentials"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Testa conectividade com canal externo.
    
    - **test_type**: "api", "webhook" ou "credentials"
    
    Retorna resultado do teste com detalhes de sucesso/erro.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        
        test_data = SalesChannelTestConnection(
            channel_id=sales_channel_id,
            test_type=test_type
        )
        
        result = sales_channel_service.test_channel_connection(
            test_data=test_data,
            tenant_id=current_user.tenant_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao testar conexão: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/setup-defaults", response_model=List[SalesChannelResponse])
def setup_default_sales_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria canais de venda padrão para o tenant.
    
    Útil para inicialização rápida com canais comuns:
    - Site Oficial
    - Booking.com
    - Telefone
    - Email
    - Walk-in
    - Airbnb
    - Expedia
    - Mapa de Quartos
    - Corporativo
    - Outro
    
    Só funciona se o tenant não tiver canais configurados.
    """
    try:
        sales_channel_service = SalesChannelService(db)
        default_channels = sales_channel_service.setup_default_sales_channels(
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        sales_channel_responses = []
        for channel in default_channels:
            channel_dict = SalesChannelResponse.model_validate(channel).model_dump()
            channel_dict["display_name"] = channel.display_name
            channel_dict["is_ota"] = channel.is_ota
            channel_dict["requires_commission"] = channel.requires_commission
            channel_dict["has_integration"] = channel.has_integration
            channel_dict["channel_type_display"] = channel.channel_type_display
            
            sales_channel_responses.append(SalesChannelResponse(**channel_dict))
        
        return sales_channel_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar canais padrão: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )