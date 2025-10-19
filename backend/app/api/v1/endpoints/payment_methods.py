# backend/app/api/v1/endpoints/payment_methods.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.payment_method import (
    PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodResponse,
    PaymentMethodListResponse, PaymentMethodFilters, PaymentMethodBulkOperation,
    PaymentMethodOrderUpdate, PaymentMethodStats, PaymentMethodUsage
)
from app.services.payment_method_service import PaymentMethodService
from app.utils.pagination import get_pagination_params

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=PaymentMethodListResponse)
def list_payment_methods(
    search: Optional[str] = Query(None, description="Buscar por nome ou código"),
    is_active: Optional[bool] = Query(None, description="Filtrar por status ativo/inativo"),
    has_fees: Optional[bool] = Query(None, description="Filtrar métodos com taxa"),
    requires_reference: Optional[bool] = Query(None, description="Filtrar métodos que requerem referência"),
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista métodos de pagamento com filtros e paginação.
    
    - **search**: Busca por nome ou código
    - **is_active**: Filtrar por métodos ativos/inativos  
    - **has_fees**: Filtrar métodos que têm taxas
    - **requires_reference**: Filtrar métodos que requerem número de referência
    - **page**: Número da página (padrão: 1)
    - **per_page**: Itens por página (padrão: 20, máximo: 100)
    """
    try:
        payment_method_service = PaymentMethodService(db)
        
        # Criar filtros
        filters = PaymentMethodFilters(
            search=search,
            is_active=is_active,
            has_fees=has_fees,
            requires_reference=requires_reference
        )
        
        # Buscar métodos com paginação
        payment_methods, total = payment_method_service.get_payment_methods(
            tenant_id=current_user.tenant_id,
            filters=filters,
            page=page,
            per_page=per_page
        )
        
        # Calcular páginas
        pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        
        # Converter para response
        payment_method_responses = []
        for method in payment_methods:
            method_dict = PaymentMethodResponse.model_validate(method).model_dump()
            
            # Adicionar campos computados
            method_dict["display_name"] = method.display_name
            method_dict["is_card_payment"] = method.is_card_payment
            method_dict["is_electronic_payment"] = method.is_electronic_payment
            method_dict["requires_external_validation"] = method.requires_external_validation
            
            payment_method_responses.append(PaymentMethodResponse(**method_dict))
        
        return PaymentMethodListResponse(
            payment_methods=payment_method_responses,
            total=total,
            page=page,
            pages=pages,
            per_page=per_page
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar métodos de pagamento: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/active", response_model=List[PaymentMethodResponse])
def list_active_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista apenas métodos de pagamento ativos, ordenados por display_order.
    Útil para dropdowns e seletores.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_methods = payment_method_service.get_active_payment_methods(current_user.tenant_id)
        
        # Converter para response
        payment_method_responses = []
        for method in payment_methods:
            method_dict = PaymentMethodResponse.model_validate(method).model_dump()
            
            # Adicionar campos computados
            method_dict["display_name"] = method.display_name
            method_dict["is_card_payment"] = method.is_card_payment
            method_dict["is_electronic_payment"] = method.is_electronic_payment
            method_dict["requires_external_validation"] = method.requires_external_validation
            
            payment_method_responses.append(PaymentMethodResponse(**method_dict))
        
        return payment_method_responses
        
    except Exception as e:
        logger.error(f"Erro ao listar métodos ativos: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/stats", response_model=PaymentMethodStats)
def get_payment_method_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtém estatísticas dos métodos de pagamento do tenant.
    
    Retorna informações sobre:
    - Total de métodos configurados
    - Métodos ativos/inativos
    - Métodos com taxas
    - Estatísticas de uso (quando disponível)
    """
    try:
        payment_method_service = PaymentMethodService(db)
        stats = payment_method_service.get_payment_method_stats(current_user.tenant_id)
        return stats
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
def create_payment_method(
    payment_method_data: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria novo método de pagamento.
    
    - **name**: Nome do método (ex: "PIX", "Cartão de Crédito")
    - **code**: Código único (ex: "pix", "credit_card")
    - **description**: Descrição opcional
    - **display_order**: Ordem de exibição (padrão: 0)
    - **icon**: Ícone para interface (opcional)
    - **color**: Cor para interface (opcional)
    - **requires_reference**: Se requer número de referência
    - **has_fees**: Se tem taxas associadas
    - **default_fee_rate**: Taxa padrão em decimal (ex: 0.035 = 3.5%)
    - **settings**: Configurações específicas (JSON)
    - **validation_rules**: Regras de validação (JSON)
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_method = payment_method_service.create_payment_method(
            payment_method_data=payment_method_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        method_dict = PaymentMethodResponse.model_validate(payment_method).model_dump()
        method_dict["display_name"] = payment_method.display_name
        method_dict["is_card_payment"] = payment_method.is_card_payment
        method_dict["is_electronic_payment"] = payment_method.is_electronic_payment
        method_dict["requires_external_validation"] = payment_method.requires_external_validation
        
        return PaymentMethodResponse(**method_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar método de pagamento: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/{payment_method_id}", response_model=PaymentMethodResponse)
def get_payment_method(
    payment_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca método de pagamento por ID.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_method = payment_method_service.get_payment_method_by_id(
            payment_method_id=payment_method_id,
            tenant_id=current_user.tenant_id
        )
        
        if not payment_method:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Método de pagamento não encontrado"
            )
        
        # Converter para response
        method_dict = PaymentMethodResponse.model_validate(payment_method).model_dump()
        method_dict["display_name"] = payment_method.display_name
        method_dict["is_card_payment"] = payment_method.is_card_payment
        method_dict["is_electronic_payment"] = payment_method.is_electronic_payment
        method_dict["requires_external_validation"] = payment_method.requires_external_validation
        
        return PaymentMethodResponse(**method_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar método de pagamento: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.put("/{payment_method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    payment_method_id: int,
    payment_method_data: PaymentMethodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza método de pagamento existente.
    
    Permite atualização parcial dos campos.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_method = payment_method_service.update_payment_method(
            payment_method_id=payment_method_id,
            payment_method_data=payment_method_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        method_dict = PaymentMethodResponse.model_validate(payment_method).model_dump()
        method_dict["display_name"] = payment_method.display_name
        method_dict["is_card_payment"] = payment_method.is_card_payment
        method_dict["is_electronic_payment"] = payment_method.is_electronic_payment
        method_dict["requires_external_validation"] = payment_method.requires_external_validation
        
        return PaymentMethodResponse(**method_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar método de pagamento: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.delete("/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(
    payment_method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Exclui (desativa) método de pagamento.
    
    Realiza soft delete, mantendo histórico mas marcando como inativo.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_method_service.delete_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir método de pagamento: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/bulk-operation")
def bulk_operation(
    operation_data: PaymentMethodBulkOperation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa operação em massa nos métodos de pagamento.
    
    - **operation**: "activate", "deactivate" ou "delete"
    - **payment_method_ids**: Lista de IDs dos métodos
    
    Retorna resultado detalhado de cada operação.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        result = payment_method_service.bulk_operation(
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


@router.put("/update-order", response_model=List[PaymentMethodResponse])
def update_display_order(
    order_data: PaymentMethodOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza ordem de exibição dos métodos de pagamento.
    
    - **payment_method_orders**: Lista de objetos com id e display_order
    
    Exemplo:
    ```json
    {
        "payment_method_orders": [
            {"id": 1, "display_order": 0},
            {"id": 2, "display_order": 1}
        ]
    }
    ```
    """
    try:
        payment_method_service = PaymentMethodService(db)
        updated_methods = payment_method_service.update_display_order(
            order_data=order_data,
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        payment_method_responses = []
        for method in updated_methods:
            method_dict = PaymentMethodResponse.model_validate(method).model_dump()
            method_dict["display_name"] = method.display_name
            method_dict["is_card_payment"] = method.is_card_payment
            method_dict["is_electronic_payment"] = method.is_electronic_payment
            method_dict["requires_external_validation"] = method.requires_external_validation
            
            payment_method_responses.append(PaymentMethodResponse(**method_dict))
        
        return payment_method_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar ordem: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.get("/code/{method_code}", response_model=PaymentMethodResponse)
def get_payment_method_by_code(
    method_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca método de pagamento por código.
    
    Útil para integração com sistemas externos que usam códigos.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        payment_method = payment_method_service.get_payment_method_by_code(
            code=method_code,
            tenant_id=current_user.tenant_id
        )
        
        if not payment_method:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Método de pagamento com código '{method_code}' não encontrado"
            )
        
        # Converter para response
        method_dict = PaymentMethodResponse.model_validate(payment_method).model_dump()
        method_dict["display_name"] = payment_method.display_name
        method_dict["is_card_payment"] = payment_method.is_card_payment
        method_dict["is_electronic_payment"] = payment_method.is_electronic_payment
        method_dict["requires_external_validation"] = payment_method.requires_external_validation
        
        return PaymentMethodResponse(**method_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar método por código: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/setup-defaults", response_model=List[PaymentMethodResponse])
def setup_default_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria métodos de pagamento padrão para o tenant.
    
    Útil para inicialização rápida com métodos comuns:
    - PIX
    - Cartão de Crédito  
    - Cartão de Débito
    - Transferência Bancária
    - Dinheiro
    - Cheque
    - Outro
    
    Só funciona se o tenant não tiver métodos configurados.
    """
    try:
        payment_method_service = PaymentMethodService(db)
        default_methods = payment_method_service.setup_default_payment_methods(
            tenant_id=current_user.tenant_id,
            current_user=current_user
        )
        
        # Converter para response
        payment_method_responses = []
        for method in default_methods:
            method_dict = PaymentMethodResponse.model_validate(method).model_dump()
            method_dict["display_name"] = method.display_name
            method_dict["is_card_payment"] = method.is_card_payment
            method_dict["is_electronic_payment"] = method.is_electronic_payment
            method_dict["requires_external_validation"] = method.requires_external_validation
            
            payment_method_responses.append(PaymentMethodResponse(**method_dict))
        
        return payment_method_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar métodos padrão: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )