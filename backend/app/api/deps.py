# backend/app/api/deps.py

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.services.auth_service import AuthService
from app.models.user import User
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# Esquema de autenticação Bearer
security = HTTPBearer()


def get_current_user_data(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Dependency para obter dados do usuário atual a partir do token JWT.
    
    Returns:
        Dict contendo 'user' e 'tenant' do usuário autenticado
        
    Raises:
        HTTPException: Se token ausente, inválido ou expirado
    """
    if not credentials:
        logger.warning("Tentativa de acesso sem token de autenticação")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso requerido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        auth_service = AuthService(db)
        user_data = auth_service.get_current_user_from_token(credentials.credentials)
        
        if not user_data:
            logger.warning("Token inválido ou expirado fornecido")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido ou expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Log de acesso bem-sucedido (sem dados sensíveis)
        user = user_data.get("user")
        if user:
            logger.debug(f"Usuário autenticado: {user.id} (tenant: {user.tenant_id})")
        
        return user_data
        
    except HTTPException:
        # Re-raise HTTPExceptions (já logadas acima)
        raise
    except Exception as e:
        logger.error(f"Erro na autenticação: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erro interno de autenticação",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
) -> User:
    """
    Dependency para obter o usuário atual.
    
    Returns:
        User: Instância do usuário autenticado
    """
    user = user_data.get("user")
    if not user:
        logger.error("Dados de usuário não encontrados nos dados de autenticação")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno: dados do usuário não encontrados"
        )
    return user


def get_current_tenant(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
) -> Tenant:
    """
    Dependency para obter o tenant atual.
    
    Returns:
        Tenant: Instância do tenant do usuário autenticado
    """
    tenant = user_data.get("tenant")
    if not tenant:
        logger.error("Dados de tenant não encontrados nos dados de autenticação")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno: dados do tenant não encontrados"
        )
    return tenant


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency para obter usuário ativo atual.
    
    Returns:
        User: Usuário ativo autenticado
        
    Raises:
        HTTPException: Se usuário estiver inativo
    """
    if not current_user.is_active:
        logger.warning(f"Tentativa de acesso com usuário inativo: {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    return current_user


def get_current_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency para verificar se usuário é superuser.
    
    Returns:
        User: Usuário superuser ativo
        
    Raises:
        HTTPException: Se usuário não for superuser
    """
    if not current_user.is_superuser:
        logger.warning(f"Tentativa de acesso privilegiado por usuário não-superuser: {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Privilégios insuficientes"
        )
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """
    Dependency para obter usuário atual de forma opcional (pode ser None).
    Útil para endpoints que funcionam tanto com usuário logado quanto anônimo.
    
    Returns:
        Optional[User]: Usuário autenticado ou None se não autenticado
    """
    if not credentials:
        return None

    try:
        auth_service = AuthService(db)
        user_data = auth_service.get_current_user_from_token(credentials.credentials)
        
        if not user_data:
            return None

        return user_data.get("user")
        
    except Exception as e:
        # Log mas não raise exception - é opcional
        logger.debug(f"Falha na autenticação opcional: {e}")
        return None


def get_current_user_with_permissions(
    required_permissions: list = None
) -> User:
    """
    Factory para criar dependency que verifica permissões específicas.
    
    Args:
        required_permissions: Lista de permissões necessárias
        
    Returns:
        Função dependency que verifica permissões
        
    Example:
        @router.get("/admin-only")
        def admin_endpoint(
            user: User = Depends(get_current_user_with_permissions(["admin_access"]))
        ):
            pass
    """
    def _get_user_with_permissions(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if required_permissions:
            # TODO: Implementar sistema de permissões quando necessário
            # Por enquanto, apenas superuser tem acesso a tudo
            if not current_user.is_superuser:
                logger.warning(
                    f"Usuário {current_user.id} tentou acessar recurso que requer permissões: {required_permissions}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permissões insuficientes"
                )
        return current_user
    
    return _get_user_with_permissions


# Aliases para compatibilidade com código existente
get_current_active_superuser = get_current_superuser


def verify_tenant_access(
    resource_tenant_id: int,
    current_user: User = Depends(get_current_active_user)
) -> bool:
    """
    Verifica se o usuário atual tem acesso a um recurso de determinado tenant.
    
    Args:
        resource_tenant_id: ID do tenant do recurso
        current_user: Usuário atual
        
    Returns:
        bool: True se tem acesso
        
    Raises:
        HTTPException: Se não tem acesso ao tenant
    """
    # Superuser tem acesso a todos os tenants
    if current_user.is_superuser:
        return True
    
    # Usuario normal só tem acesso ao próprio tenant
    if current_user.tenant_id != resource_tenant_id:
        logger.warning(
            f"Usuário {current_user.id} (tenant {current_user.tenant_id}) "
            f"tentou acessar recurso do tenant {resource_tenant_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: recurso de outro tenant"
        )
    
    return True