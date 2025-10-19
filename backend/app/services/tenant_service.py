# backend/app/services/tenant_service.py

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate


class TenantService:
    """Serviço para operações com tenants"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_tenant_by_id(self, tenant_id: int) -> Optional[Tenant]:
        """Busca tenant por ID"""
        return self.db.query(Tenant).filter(
            Tenant.id == tenant_id,
            Tenant.is_active == True
        ).first()

    def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Busca tenant por slug"""
        return self.db.query(Tenant).filter(
            Tenant.slug == slug,
            Tenant.is_active == True
        ).first()

    def get_all_tenants(self, skip: int = 0, limit: int = 100) -> List[Tenant]:
        """Lista todos os tenants ativos"""
        return self.db.query(Tenant).filter(
            Tenant.is_active == True
        ).offset(skip).limit(limit).all()

    def create_tenant(self, tenant_data: TenantCreate) -> Tenant:
        """Cria novo tenant"""
        # Verificar se slug já existe
        existing_tenant = self.get_tenant_by_slug(tenant_data.slug)
        if existing_tenant:
            raise ValueError("Slug já está em uso")

        db_tenant = Tenant(
            name=tenant_data.name,
            slug=tenant_data.slug
        )

        try:
            self.db.add(db_tenant)
            self.db.commit()
            self.db.refresh(db_tenant)
            return db_tenant
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar tenant - dados duplicados")

    def update_tenant(self, tenant_id: int, tenant_data: TenantUpdate) -> Optional[Tenant]:
        """Atualiza dados do tenant"""
        tenant = self.get_tenant_by_id(tenant_id)
        if not tenant:
            return None

        for field, value in tenant_data.dict(exclude_unset=True).items():
            if hasattr(tenant, field):
                setattr(tenant, field, value)

        try:
            self.db.commit()
            self.db.refresh(tenant)
            return tenant
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar tenant")