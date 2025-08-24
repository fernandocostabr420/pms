# backend/app/api/v1/endpoints/tenants.py

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.tenant_service import TenantService
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.schemas.common import MessageResponse
from app.api.deps import get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[TenantResponse])
def list_tenants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    skip: int = 0,
    limit: int = 100
):
    """Lista todos os tenants (apenas superuser)"""
    tenant_service = TenantService(db)
    tenants = tenant_service.get_all_tenants(skip=skip, limit=limit)
    
    return [TenantResponse.model_validate(tenant) for tenant in tenants]


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Busca tenant específico (apenas superuser)"""
    tenant_service = TenantService(db)
    tenant = tenant_service.get_tenant_by_id(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant não encontrado"
        )
    
    return TenantResponse.model_validate(tenant)


@router.post("/", response_model=TenantResponse)
def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Cria novo tenant (apenas superuser)"""
    tenant_service = TenantService(db)
    
    try:
        tenant = tenant_service.create_tenant(tenant_data)
        return TenantResponse.model_validate(tenant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    tenant_data: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Atualiza tenant (apenas superuser)"""
    tenant_service = TenantService(db)
    
    try:
        tenant = tenant_service.update_tenant(tenant_id, tenant_data)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant não encontrado"
            )
        return TenantResponse.model_validate(tenant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{tenant_id}", response_model=MessageResponse)
def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Desativa tenant (soft delete, apenas superuser)"""
    tenant_service = TenantService(db)
    tenant = tenant_service.get_tenant_by_id(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant não encontrado"
        )
    
    # Não permitir desativar o próprio tenant
    if tenant.id == current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível desativar seu próprio tenant"
        )
    
    # Soft delete
    tenant.is_active = False
    db.commit()
    
    return MessageResponse(message="Tenant desativado com sucesso")