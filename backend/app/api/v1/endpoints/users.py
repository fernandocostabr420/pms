# backend/app/api/v1/endpoints/users.py

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserChangePassword, AdminResetPassword
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """Lista usuários do tenant atual"""
    users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.is_active == True
    ).offset(skip).limit(limit).all()
    
    return [UserResponse.model_validate(user) for user in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca usuário específico do tenant"""
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id, current_user.tenant_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    return UserResponse.model_validate(user)


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Cria novo usuário no tenant atual"""
    user_service = UserService(db)
    
    # Forçar tenant_id do usuário atual
    user_data.tenant_id = current_user.tenant_id
    
    try:
        user = user_service.create_user(user_data)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza usuário"""
    # Superuser pode editar qualquer usuário, usuário normal só pode editar a si mesmo
    if not current_user.is_superuser and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para editar este usuário"
        )
    
    user_service = UserService(db)
    
    try:
        user = user_service.update_user(user_id, current_user.tenant_id, user_data)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Desativa usuário (soft delete)"""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível desativar seu próprio usuário"
        )
    
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id, current_user.tenant_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Soft delete
    user.is_active = False
    db.commit()
    
    return MessageResponse(message="Usuário desativado com sucesso")


@router.post("/{user_id}/change-password", response_model=MessageResponse)
def change_user_password(
    user_id: int,
    password_data: UserChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Altera senha do usuário"""
    # Apenas o próprio usuário pode alterar sua senha
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só é possível alterar sua própria senha"
        )
    
    from app.core.security import verify_password, create_password_hash
    
    # Verificar senha atual
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta"
        )
    
    # Atualizar senha
    current_user.hashed_password = create_password_hash(password_data.new_password)
    db.commit()
    
    return MessageResponse(message="Senha alterada com sucesso")


@router.post("/{user_id}/admin-reset-password", response_model=MessageResponse)
def admin_reset_user_password(
    user_id: int,
    reset_data: AdminResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Admin reseta senha de qualquer usuário (apenas superuser)"""
    from app.core.security import create_password_hash
    from datetime import datetime
    
    # Buscar usuário
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id, current_user.tenant_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Não permitir resetar senha de outro superuser (segurança)
    if user.is_superuser and user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não é possível resetar senha de outro administrador"
        )
    
    # Atualizar senha
    user.hashed_password = create_password_hash(reset_data.new_password)
    
    # Forçar troca de senha no próximo login (se campo existir no model)
    if hasattr(user, 'must_change_password'):
        user.must_change_password = reset_data.must_change_password
    
    # Atualizar data de mudança de senha (se campo existir no model)
    if hasattr(user, 'password_changed_at'):
        user.password_changed_at = datetime.utcnow()
    
    db.commit()
    
    # Mensagem de retorno
    message = "Senha resetada com sucesso."
    if reset_data.must_change_password:
        message += " Usuário deverá trocar senha no próximo login."
    
    return MessageResponse(message=message)