# backend/app/api/v1/endpoints/guests.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
import math

from app.core.database import get_db
from app.services.guest_service import GuestService
from app.schemas.guest import (
    GuestCreate, 
    GuestUpdate, 
    GuestResponse, 
    GuestListResponse,
    GuestFilters,
    GuestWithStats
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=GuestListResponse)
def list_guests(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    has_email: Optional[bool] = Query(None, description="Filtrar por presença de email"),
    has_document: Optional[bool] = Query(None, description="Filtrar por presença de documento"),
    nationality: Optional[str] = Query(None, description="Filtrar por nacionalidade"),
    city: Optional[str] = Query(None, description="Filtrar por cidade"),
    state: Optional[str] = Query(None, description="Filtrar por estado"),
    marketing_consent: Optional[str] = Query(None, description="Filtrar por consentimento de marketing"),
    search: Optional[str] = Query(None, description="Busca textual")
):
    """Lista hóspedes do tenant com filtros e paginação"""
    guest_service = GuestService(db)
    
    # Construir filtros
    filters = GuestFilters(
        has_email=has_email,
        has_document=has_document,
        nationality=nationality,
        city=city,
        state=state,
        marketing_consent=marketing_consent,
        search=search
    )
    
    # Calcular offset
    skip = (page - 1) * per_page
    
    # Buscar hóspedes e total
    guests = guest_service.get_guests(current_user.tenant_id, filters, skip, per_page)
    total = guest_service.count_guests(current_user.tenant_id, filters)
    
    # Calcular total de páginas
    total_pages = math.ceil(total / per_page)
    
    # Converter para response
    guests_response = [GuestResponse.model_validate(guest) for guest in guests]
    
    return GuestListResponse(
        guests=guests_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


@router.get("/search", response_model=List[GuestResponse])
def search_guests_quick(
    q: str = Query(..., min_length=2, description="Termo de busca"),
    limit: int = Query(10, ge=1, le=50, description="Limite de resultados"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca rápida de hóspedes para autocomplete"""
    guest_service = GuestService(db)
    guests = guest_service.search_guests_by_name_or_document(q, current_user.tenant_id, limit)
    
    return [GuestResponse.model_validate(guest) for guest in guests]


@router.get("/{guest_id}", response_model=GuestResponse)
def get_guest(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca hóspede específico do tenant"""
    guest_service = GuestService(db)
    guest_obj = guest_service.get_guest_by_id(guest_id, current_user.tenant_id)
    
    if not guest_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hóspede não encontrado"
        )
    
    return GuestResponse.model_validate(guest_obj)


@router.get("/{guest_id}/stats", response_model=GuestWithStats)
def get_guest_with_stats(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca hóspede com estatísticas"""
    guest_service = GuestService(db)
    guest_obj = guest_service.get_guest_by_id(guest_id, current_user.tenant_id)
    
    if not guest_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hóspede não encontrado"
        )
    
    # Buscar estatísticas
    stats = guest_service.get_guest_stats(guest_id, current_user.tenant_id)
    
    # Converter para response
    guest_response = GuestResponse.model_validate(guest_obj)
    
    return GuestWithStats(
        **guest_response.dict(),
        **stats
    )


@router.post("/", response_model=GuestResponse)
def create_guest(
    guest_data: GuestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria novo hóspede no tenant atual"""
    guest_service = GuestService(db)
    
    try:
        guest_obj = guest_service.create_guest(
            guest_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return GuestResponse.model_validate(guest_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{guest_id}", response_model=GuestResponse)
def update_guest(
    guest_id: int,
    guest_data: GuestUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza hóspede"""
    guest_service = GuestService(db)
    
    try:
        guest_obj = guest_service.update_guest(
            guest_id, 
            current_user.tenant_id, 
            guest_data,
            current_user,
            request
        )
        if not guest_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hóspede não encontrado"
            )
        return GuestResponse.model_validate(guest_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{guest_id}", response_model=MessageResponse)
def delete_guest(
    guest_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Desativa hóspede (soft delete)"""
    guest_service = GuestService(db)
    
    try:
        success = guest_service.delete_guest(
            guest_id, 
            current_user.tenant_id,
            current_user,
            request
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hóspede não encontrado"
            )
        
        return MessageResponse(message="Hóspede desativado com sucesso")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/merge", response_model=GuestResponse)
def merge_guests(
    primary_guest_id: int = Query(..., description="ID do hóspede principal (que será mantido)"),
    secondary_guest_id: int = Query(..., description="ID do hóspede secundário (que será mesclado)"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mescla dois hóspedes (move reservas do secundário para o primário)"""
    guest_service = GuestService(db)
    
    try:
        merged_guest = guest_service.merge_guests(
            primary_guest_id,
            secondary_guest_id,
            current_user.tenant_id,
            current_user,
            request
        )
        return GuestResponse.model_validate(merged_guest)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Endpoint adicional para busca avançada
@router.post("/advanced-search", response_model=GuestListResponse)
def advanced_search_guests(
    filters: GuestFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST"""
    guest_service = GuestService(db)
    
    skip = (page - 1) * per_page
    
    guests = guest_service.get_guests(current_user.tenant_id, filters, skip, per_page)
    total = guest_service.count_guests(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    guests_response = [GuestResponse.model_validate(guest) for guest in guests]
    
    return GuestListResponse(
        guests=guests_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


# Endpoints para verificações específicas
@router.get("/check/email", response_model=Dict[str, bool])
def check_email_availability(
    email: str = Query(..., description="Email para verificar"),
    exclude_guest_id: Optional[int] = Query(None, description="ID do hóspede para excluir da verificação"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica se email está disponível"""
    try:
        guest_service = GuestService(db)
        
        # Buscar hóspede com este email
        existing_guest = guest_service.get_guest_by_email(email, current_user.tenant_id)
        
        # Determinar se está disponível
        if existing_guest is None:
            # Email não existe, está disponível
            is_available = True
        elif exclude_guest_id is not None and existing_guest.id == exclude_guest_id:
            # Email existe mas é do próprio hóspede (edição), está disponível
            is_available = True
        else:
            # Email existe e pertence a outro hóspede, não está disponível
            is_available = False
        
        return {"available": is_available}
        
    except Exception as e:
        # Em caso de erro, loggar e retornar disponível por segurança
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao verificar disponibilidade do email {email}: {e}")
        
        # Retornar disponível por padrão em caso de erro
        return {"available": True}
        
    except Exception as e:
        # Em caso de erro, loggar e retornar disponível por segurança
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao verificar disponibilidade do email {email}: {e}")
        
        # Retornar disponível por padrão em caso de erro
        return {"available": True}


@router.get("/check/document", response_model=Dict[str, bool])
def check_document_availability(
    document_number: str = Query(..., description="Documento para verificar"),
    exclude_guest_id: Optional[int] = Query(None, description="ID do hóspede para excluir da verificação"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica se documento está disponível"""
    try:
        guest_service = GuestService(db)
        
        # Buscar hóspede com este documento
        existing_guest = guest_service.get_guest_by_document(document_number, current_user.tenant_id)
        
        # Determinar se está disponível
        if existing_guest is None:
            # Documento não existe, está disponível
            is_available = True
        elif exclude_guest_id is not None and existing_guest.id == exclude_guest_id:
            # Documento existe mas é do próprio hóspede (edição), está disponível
            is_available = True
        else:
            # Documento existe e pertence a outro hóspede, não está disponível
            is_available = False
        
        return {"available": is_available}
        
    except Exception as e:
        # Em caso de erro, loggar e retornar disponível por segurança
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao verificar disponibilidade do documento {document_number}: {e}")
        
        # Retornar disponível por padrão em caso de erro
        return {"available": True}


@router.get("/stats/general", response_model=Dict[str, Any])
def get_guests_general_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém estatísticas gerais dos hóspedes"""
    guest_service = GuestService(db)
    
    # Contagens básicas
    total_guests = guest_service.count_guests(current_user.tenant_id)
    guests_with_email = guest_service.count_guests(
        current_user.tenant_id, 
        GuestFilters(has_email=True)
    )
    guests_with_document = guest_service.count_guests(
        current_user.tenant_id, 
        GuestFilters(has_document=True)
    )
    
    # Consentimento marketing
    marketing_yes = guest_service.count_guests(
        current_user.tenant_id, 
        GuestFilters(marketing_consent="yes")
    )
    marketing_no = guest_service.count_guests(
        current_user.tenant_id, 
        GuestFilters(marketing_consent="no")
    )
    marketing_not_asked = guest_service.count_guests(
        current_user.tenant_id, 
        GuestFilters(marketing_consent="not_asked")
    )
    
    return {
        'total_guests': total_guests,
        'guests_with_email': guests_with_email,
        'guests_with_document': guests_with_document,
        'email_percentage': round((guests_with_email / total_guests) * 100, 1) if total_guests > 0 else 0,
        'document_percentage': round((guests_with_document / total_guests) * 100, 1) if total_guests > 0 else 0,
        'marketing_consent': {
            'yes': marketing_yes,
            'no': marketing_no,
            'not_asked': marketing_not_asked
        }
    }