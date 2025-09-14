# backend/app/api/v1/endpoints/wubook.py

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Body
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User

# ✅ IMPORTS CORRETOS - Usando apenas schemas que EXISTEM
from app.schemas.wubook_configuration import (
    WuBookConfigurationCreate, WuBookConfigurationUpdate, WuBookConfigurationResponse,
    WuBookConfigurationListResponse, WuBookTestConnection, WuBookTestConnectionResult,
    WuBookConfigurationFilters, WuBookConfigurationStats, WuBookSyncRequest, WuBookSyncResult
)
from app.schemas.wubook_mapping import (
    WuBookRoomMappingCreate, WuBookRoomMappingUpdate, WuBookRoomMappingResponse,
    WuBookRoomSuggestion, WuBookRatePlanResponse
)
from app.schemas.wubook_sync import (
    WuBookSyncLogResponse, WuBookSyncLogListResponse, WuBookSyncLogFilters,
    WuBookSyncStats, WuBookSyncProgress
)
from app.schemas.common import MessageResponse
from app.services.wubook_configuration_service import WuBookConfigurationService

logger = logging.getLogger(__name__)

router = APIRouter()

# ===== CONFIGURATION ENDPOINTS =====

@router.get("", response_model=List[WuBookConfigurationResponse])
def list_configurations(
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    is_connected: Optional[bool] = Query(None, description="Filtrar por status de conexão"),
    sync_enabled: Optional[bool] = Query(None, description="Filtrar por sync habilitado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista configurações WuBook do tenant"""
    service = WuBookConfigurationService(db)
    
    filters = WuBookConfigurationFilters(
        property_id=property_id,
        is_connected=is_connected,
        sync_enabled=sync_enabled
    )
    
    # ✅ MÉTODO CORRETO
    configurations = service.get_configurations(current_user.tenant_id, filters)
    return [WuBookConfigurationResponse.model_validate(config) for config in configurations]


@router.post("", response_model=WuBookConfigurationResponse)
def create_configuration(
    config_data: WuBookConfigurationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova configuração WuBook"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ ASSINATURA CORRETA
        configuration = service.create_configuration(
            config_data, current_user.tenant_id, current_user
        )
        return WuBookConfigurationResponse.model_validate(configuration)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar configuração: {str(e)}"
        )


@router.get("/{config_id}", response_model=WuBookConfigurationResponse)
def get_configuration(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca configuração específica"""
    service = WuBookConfigurationService(db)
    
    # ✅ MÉTODO CORRETO
    configuration = service.get_configuration(config_id, current_user.tenant_id)
    if not configuration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração WuBook não encontrada"
        )
    
    return WuBookConfigurationResponse.model_validate(configuration)


@router.put("/{config_id}", response_model=WuBookConfigurationResponse)
def update_configuration(
    config_id: int,
    config_data: WuBookConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza configuração WuBook"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ ASSINATURA CORRETA
        configuration = service.update_configuration(
            config_id, config_data, current_user.tenant_id, current_user
        )
        if not configuration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração WuBook não encontrada"
            )
        return WuBookConfigurationResponse.model_validate(configuration)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar configuração: {str(e)}"
        )


@router.delete("/{config_id}", response_model=MessageResponse)
def delete_configuration(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove configuração WuBook"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ ASSINATURA CORRETA
        success = service.delete_configuration(
            config_id, current_user.tenant_id, current_user
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuração WuBook não encontrada"
            )
        
        return MessageResponse(message="Configuração WuBook removida com sucesso")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao remover configuração: {str(e)}"
        )


# ===== CONNECTION TEST ENDPOINTS =====

@router.post("/test-connection", response_model=WuBookTestConnectionResult)
def test_connection(
    test_data: WuBookTestConnection,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Testa conexão com WuBook"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ MÉTODO CORRETO
        result = service.test_connection(test_data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao testar conexão: {str(e)}"
        )


# ===== SYNC ENDPOINTS =====

@router.post("/{config_id}/sync", response_model=WuBookSyncResult)
def manual_sync(
    config_id: int,
    sync_request: WuBookSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Executa sincronização manual"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ MÉTODO CORRETO
        result = service.sync_now(
            config_id, sync_request, current_user.tenant_id, current_user
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro na sincronização: {str(e)}"
        )


# ===== CHANNEL MAPPING ENDPOINTS =====

@router.get("/{config_id}/channels", response_model=List[Dict[str, Any]])
def list_channel_mappings(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista mapeamentos de canais"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ MÉTODO CORRETO
        mappings = service.get_channel_mappings(config_id, current_user.tenant_id)
        return [mapping.model_dump() for mapping in mappings]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar mapeamentos: {str(e)}"
        )


# ===== ROOM MAPPING SUGGESTIONS =====

@router.get("/{config_id}/rooms/suggestions", response_model=List[WuBookRoomSuggestion])
def get_room_mapping_suggestions(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca sugestões inteligentes de mapeamento de quartos"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ MÉTODO CORRETO
        suggestions = service.get_room_mapping_suggestions(config_id, current_user.tenant_id)
        return suggestions
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar sugestões: {e}")
        return []


# ===== STATISTICS ENDPOINTS =====

@router.get("/{config_id}/stats", response_model=WuBookConfigurationStats)
def get_configuration_stats(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca estatísticas da configuração"""
    service = WuBookConfigurationService(db)
    
    try:
        # ✅ MÉTODO CORRETO
        stats = service.get_configuration_stats(config_id, current_user.tenant_id)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar estatísticas: {str(e)}"
        )


# ===== UTILITY ENDPOINTS =====

@router.get("/health", response_model=Dict[str, Any])
def wubook_health_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica saúde das integrações WuBook do tenant"""
    
    try:
        service = WuBookConfigurationService(db)
        
        # ✅ MÉTODO SIMPLIFICADO - implementar básico
        configurations = service.get_configurations(current_user.tenant_id)
        
        total_configs = len(configurations)
        connected_configs = len([c for c in configurations if c.is_connected])
        active_configs = len([c for c in configurations if c.is_active])
        
        return {
            "status": "healthy" if connected_configs > 0 else "warning",
            "total_configurations": total_configs,
            "connected_configurations": connected_configs,
            "active_configurations": active_configs,
            "message": f"{connected_configs}/{total_configs} configurações conectadas"
        }
    except Exception as e:
        logger.error(f"Erro no health check: {e}")
        return {
            "status": "error",
            "message": f"Erro ao verificar saúde: {str(e)}"
        }