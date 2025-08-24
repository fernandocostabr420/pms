# backend/app/api/deps.py

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import AuthService
from app.models.user import User
from app.models.tenant import Tenant

# Esquema de autenticação Bearer
security = HTTPBearer()


def get_current_user_data(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Dependency para obter dados do usuário atual a partir do token JWT
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso requerido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = AuthService(db)
    user_data = auth_service.get_current_user_from_token(credentials.credentials)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_data


def get_current_user(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
) -> User:
    """
    Dependency para obter o usuário atual
    """
    return user_data["user"]


def get_current_tenant(
    user_data: Dict[str, Any] = Depends(get_current_user_data)
) -> Tenant:
    """
    Dependency para obter o tenant atual
    """
    return user_data["tenant"]


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency para obter usuário ativo atual
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    return current_user


def get_current_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Dependency para verificar se usuário é superuser
    """
    if not current_user.is_superuser:
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
    Dependency para obter usuário atual de forma opcional (pode ser None)
    """
    if not credentials:
        return None

    auth_service = AuthService(db)
    user_data = auth_service.get_current_user_from_token(credentials.credentials)
    
    if not user_data:
        return None

    return user_data["user"]