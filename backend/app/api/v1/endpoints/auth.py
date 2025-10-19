# backend/app/api/v1/endpoints/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.schemas.auth import LoginRequest, Token, TokenRefresh, AuthResponse
from app.schemas.user import UserResponse
from app.schemas.tenant import TenantResponse
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=AuthResponse, summary="Login do usuário")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Autentica usuário e retorna tokens de acesso
    
    - **email**: Email do usuário
    - **password**: Senha do usuário
    """
    auth_service = AuthService(db)
    
    # Tentar login
    result = auth_service.login(login_data)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    user = result["user"]
    tenant = result["tenant"]
    tokens = result["tokens"]
    
    # Converter para response schemas
    user_response = UserResponse.model_validate(user)
    tenant_response = TenantResponse.model_validate(tenant)
    
    return AuthResponse(
        user=user_response.dict(),
        tenant=tenant_response.dict(),
        token=tokens
    )


@router.post("/refresh", response_model=Token, summary="Renovar token de acesso")
def refresh_token(
    token_data: TokenRefresh,
    db: Session = Depends(get_db)
):
    """
    Renova token de acesso usando refresh token
    
    - **refresh_token**: Token de renovação válido
    """
    auth_service = AuthService(db)
    
    new_token = auth_service.refresh_access_token(token_data.refresh_token)
    
    if not new_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado"
        )
    
    return new_token


@router.get("/me", response_model=UserResponse, summary="Dados do usuário atual")
def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna informações do usuário autenticado atual
    """
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse, summary="Logout do usuário")
def logout(
    current_user: User = Depends(get_current_active_user)
):
    """
    Logout do usuário (invalidar token no cliente)
    
    Nota: Como usamos JWT stateless, o token continuará válido até expirar.
    O cliente deve descartar o token para efetuar o logout.
    """
    return MessageResponse(
        message="Logout realizado com sucesso",
        success=True
    )


# Endpoint de teste - pode ser removido depois
@router.get("/test", summary="Endpoint de teste de autenticação")
def test_auth(
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint para testar se a autenticação está funcionando
    """
    return {
        "message": f"Olá, {current_user.full_name}!",
        "user_id": current_user.id,
        "email": current_user.email,
        "tenant_id": current_user.tenant_id,
        "is_superuser": current_user.is_superuser
    }