# backend/app/services/user_service.py

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import create_password_hash, verify_password


class UserService:
    """Serviço para operações com usuários"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_id(self, user_id: int, tenant_id: int) -> Optional[User]:
        """Busca usuário por ID dentro do tenant"""
        return self.db.query(User).filter(
            User.id == user_id,
            User.tenant_id == tenant_id,
            User.is_active == True
        ).first()

    def get_user_by_email(self, email: str, tenant_id: Optional[int] = None) -> Optional[User]:
        """Busca usuário por email"""
        query = self.db.query(User).filter(User.email == email, User.is_active == True)
        
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
        
        return query.first()

    def get_user_with_tenant(self, user_id: int) -> Optional[dict]:
        """Busca usuário com dados do tenant"""
        result = self.db.query(User, Tenant).join(
            Tenant, User.tenant_id == Tenant.id
        ).filter(
            User.id == user_id,
            User.is_active == True,
            Tenant.is_active == True
        ).first()
        
        if result:
            user, tenant = result
            return {
                "user": user,
                "tenant": tenant
            }
        return None

    def create_user(self, user_data: UserCreate) -> User:
        """Cria novo usuário"""
        # Verificar se tenant existe e está ativo
        tenant = self.db.query(Tenant).filter(
            Tenant.id == user_data.tenant_id,
            Tenant.is_active == True
        ).first()
        
        if not tenant:
            raise ValueError("Tenant não encontrado ou inativo")

        # Verificar se email já existe no tenant
        existing_user = self.get_user_by_email(user_data.email, user_data.tenant_id)
        if existing_user:
            raise ValueError("Email já cadastrado neste tenant")

        # Criar hash da senha
        hashed_password = create_password_hash(user_data.password)

        # Criar usuário
        db_user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            tenant_id=user_data.tenant_id,
            is_superuser=user_data.is_superuser,
            is_active=user_data.is_active
        )

        try:
            self.db.add(db_user)
            self.db.commit()
            self.db.refresh(db_user)
            return db_user
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar usuário - dados duplicados")

    def update_user(self, user_id: int, tenant_id: int, user_data: UserUpdate) -> Optional[User]:
        """Atualiza dados do usuário"""
        user = self.get_user_by_id(user_id, tenant_id)
        if not user:
            return None

        # Atualizar apenas campos fornecidos
        for field, value in user_data.dict(exclude_unset=True).items():
            if hasattr(user, field):
                setattr(user, field, value)

        try:
            self.db.commit()
            self.db.refresh(user)
            return user
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar usuário")

    def authenticate_user(self, email: str, password: str, tenant_id: Optional[int] = None) -> Optional[User]:
        """Autentica usuário por email e senha"""
        user = self.get_user_by_email(email, tenant_id)
        
        if not user:
            return None
            
        if not verify_password(password, user.hashed_password):
            return None
            
        return user

    def update_last_login(self, user_id: int) -> None:
        """Atualiza último login do usuário"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_login = datetime.utcnow()
            self.db.commit()