# backend/app/services/auth_service.py

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import timedelta

from app.services.user_service import UserService
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import LoginRequest, RegisterRequest, Token
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.core.config import settings


class AuthService:
    """Serviço de autenticação"""
    
    def __init__(self, db: Session):
        self.db = db
        self.user_service = UserService(db)

    def authenticate_user(self, login_data: LoginRequest, tenant_slug: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Autentica usuário por email e senha
        """
        tenant_id = None
        
        # Se fornecido tenant_slug, buscar o tenant
        if tenant_slug:
            tenant = self.db.query(Tenant).filter(
                Tenant.slug == tenant_slug,
                Tenant.is_active == True
            ).first()
            
            if not tenant:
                return None
            
            tenant_id = tenant.id

        # Autenticar usuário
        user = self.user_service.authenticate_user(
            email=login_data.email,
            password=login_data.password,
            tenant_id=tenant_id
        )
        
        if not user:
            return None

        # Buscar dados do tenant do usuário
        tenant = self.db.query(Tenant).filter(
            Tenant.id == user.tenant_id,
            Tenant.is_active == True
        ).first()
        
        if not tenant:
            return None

        # Atualizar último login
        self.user_service.update_last_login(user.id)

        return {
            "user": user,
            "tenant": tenant
        }

    def create_tokens(self, user: User, tenant: Tenant) -> Token:
        """
        Cria tokens de acesso e refresh para o usuário
        """
        # Dados para incluir no token
        token_data = {
            "sub": str(user.id),  # subject - ID do usuário
            "email": user.email,
            "tenant_id": tenant.id,
            "tenant_slug": tenant.slug,
            "is_superuser": user.is_superuser
        }

        # Criar tokens
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id), "tenant_id": tenant.id})

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Em segundos
        )

    def refresh_access_token(self, refresh_token: str) -> Optional[Token]:
        """
        Gera novo access token usando refresh token
        """
        # Verificar refresh token
        payload = verify_token(refresh_token, expected_type="refresh")
        if not payload:
            return None

        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        
        if not user_id or not tenant_id:
            return None

        # Buscar usuário e tenant atuais
        user = self.user_service.get_user_by_id(int(user_id), tenant_id)
        if not user:
            return None

        tenant = self.db.query(Tenant).filter(
            Tenant.id == tenant_id,
            Tenant.is_active == True
        ).first()
        
        if not tenant:
            return None

        # Gerar novos tokens
        return self.create_tokens(user, tenant)

    def get_current_user_from_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Obtém usuário atual a partir do token
        """
        payload = verify_token(token, expected_type="access")
        if not payload:
            return None

        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        
        if not user_id or not tenant_id:
            return None

        # Buscar usuário com dados do tenant
        user_data = self.user_service.get_user_with_tenant(int(user_id))
        
        if not user_data:
            return None

        # Verificar se o tenant do token bate com o do usuário
        if user_data["tenant"].id != tenant_id:
            return None

        return user_data

    def login(self, login_data: LoginRequest, tenant_slug: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Processo completo de login
        """
        # Autenticar usuário
        auth_result = self.authenticate_user(login_data, tenant_slug)
        if not auth_result:
            return None

        user = auth_result["user"]
        tenant = auth_result["tenant"]

        # Criar tokens
        tokens = self.create_tokens(user, tenant)

        return {
            "user": user,
            "tenant": tenant,
            "tokens": tokens
        }