# backend/app/models/wubook_room_mapping.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, Session
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime
import logging

from app.models.base import BaseModel, TenantMixin

logger = logging.getLogger(__name__)


class WuBookRoomMapping(BaseModel, TenantMixin):
    """
    Modelo para mapeamento entre quartos do PMS e quartos do WuBook.
    Permite vincular um quarto local com seu correspondente no WuBook.
    ✅ ATUALIZADO: Inclui métodos de limpeza automática para dados órfãos
    """
    __tablename__ = "wubook_room_mappings"
    
    # Configuração à qual pertence este mapeamento
    configuration_id = Column(Integer, ForeignKey('wubook_configurations.id'), nullable=False, index=True)
    
    # Quarto no PMS
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False, index=True)
    
    # Quarto no WuBook
    wubook_room_id = Column(String(50), nullable=False, index=True)
    wubook_room_name = Column(String(200), nullable=True)
    wubook_room_type = Column(String(100), nullable=True)
    
    # Status do mapeamento
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_syncing = Column(Boolean, default=True, nullable=False)  # Se deve sincronizar
    
    # Configurações de sincronização
    sync_availability = Column(Boolean, default=True, nullable=False)
    sync_rates = Column(Boolean, default=True, nullable=False)
    sync_restrictions = Column(Boolean, default=True, nullable=False)
    
    # Mapeamento de ocupação (quantas pessoas)
    max_occupancy = Column(Integer, nullable=True)
    standard_occupancy = Column(Integer, nullable=True)
    min_occupancy = Column(Integer, default=1, nullable=False)
    
    # Configurações de preço base (se diferente do PMS)
    base_rate_override = Column(Numeric(10, 2), nullable=True)
    rate_multiplier = Column(Numeric(5, 3), default=1.000, nullable=False)  # Multiplicador de preço
    
    # Última sincronização
    last_availability_sync = Column(String(30), nullable=True)  # ISO timestamp
    last_rate_sync = Column(String(30), nullable=True)
    last_restriction_sync = Column(String(30), nullable=True)
    last_sync_error = Column(Text, nullable=True)
    sync_error_count = Column(Integer, default=0, nullable=False)
    
    # ✅ NOVOS CAMPOS PARA SINCRONIZAÇÃO E LIMPEZA
    sync_pending = Column(Boolean, default=False, nullable=False, index=True)  # Pendente de sincronização
    deletion_pending = Column(Boolean, default=False, nullable=False)  # Pendente de remoção no WuBook
    
    # Dados adicionais do WuBook
    wubook_data = Column(JSON, nullable=True, default=dict)
    # Armazena dados extras como amenities, fotos, descrições, etc
    
    # Mapeamento de rate plans (quais rate plans este quarto aceita)
    rate_plan_ids = Column(JSON, nullable=True, default=list)
    # Ex: [1, 2, 3] - IDs dos rate plans aplicáveis
    
    # Configurações específicas
    room_settings = Column(JSON, nullable=True, default=dict)
    # Ex: {"min_stay": 2, "closed_to_arrival": ["2024-12-24"]}
    
    # Metadados
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'configuration_id', 'room_id', 
                         name='uq_wubook_mapping_room'),
        UniqueConstraint('tenant_id', 'configuration_id', 'wubook_room_id', 
                         name='uq_wubook_mapping_wubook_room'),
    )
    
    # Relacionamentos
    configuration = relationship("WuBookConfiguration", back_populates="room_mappings")
    room_ref = relationship("Room", back_populates="wubook_mappings")
    
    def __repr__(self):
        return (f"<WuBookRoomMapping(id={self.id}, room_id={self.room_id}, "
                f"wubook_room_id='{self.wubook_room_id}', active={self.is_active})>")
    
    @property
    def is_ready(self) -> bool:
        """Verifica se o mapeamento está pronto para sincronização"""
        return self.is_active and self.is_syncing
    
    @property
    def has_sync_errors(self) -> bool:
        """Verifica se tem erros de sincronização"""
        return self.sync_error_count > 0 or bool(self.last_sync_error)
    
    @property
    def needs_availability_sync(self) -> bool:
        """Verifica se precisa sincronizar disponibilidade"""
        if not self.sync_availability or not self.is_ready:
            return False
        return self.last_availability_sync is None
    
    @property
    def needs_rate_sync(self) -> bool:
        """Verifica se precisa sincronizar tarifas"""
        if not self.sync_rates or not self.is_ready:
            return False
        return self.last_rate_sync is None
    
    @property
    def effective_rate_multiplier(self) -> float:
        """Retorna o multiplicador de tarifa efetivo"""
        return float(self.rate_multiplier) if self.rate_multiplier else 1.0
    
    def calculate_wubook_rate(self, base_rate: Decimal) -> Decimal:
        """Calcula a tarifa para enviar ao WuBook"""
        if self.base_rate_override:
            rate = self.base_rate_override
        else:
            rate = base_rate
        
        return rate * Decimal(str(self.effective_rate_multiplier))
    
    def update_sync_timestamp(self, sync_type: str) -> None:
        """Atualiza timestamp de sincronização"""
        timestamp = datetime.utcnow().isoformat()
        
        if sync_type == "availability":
            self.last_availability_sync = timestamp
        elif sync_type == "rate":
            self.last_rate_sync = timestamp
        elif sync_type == "restriction":
            self.last_restriction_sync = timestamp
    
    def record_sync_error(self, error_message: str) -> None:
        """Registra erro de sincronização"""
        self.last_sync_error = f"[{datetime.utcnow().isoformat()}] {error_message}"
        self.sync_error_count += 1
    
    def clear_sync_errors(self) -> None:
        """Limpa erros de sincronização"""
        self.last_sync_error = None
        self.sync_error_count = 0
    
    def is_rate_plan_enabled(self, rate_plan_id: int) -> bool:
        """Verifica se um rate plan está habilitado para este quarto"""
        if not self.rate_plan_ids:
            return True  # Se não há restrição, aceita todos
        return rate_plan_id in self.rate_plan_ids
    
    def add_rate_plan(self, rate_plan_id: int) -> None:
        """Adiciona um rate plan ao mapeamento"""
        if not self.rate_plan_ids:
            self.rate_plan_ids = []
        if rate_plan_id not in self.rate_plan_ids:
            self.rate_plan_ids.append(rate_plan_id)
    
    def remove_rate_plan(self, rate_plan_id: int) -> None:
        """Remove um rate plan do mapeamento"""
        if self.rate_plan_ids and rate_plan_id in self.rate_plan_ids:
            self.rate_plan_ids.remove(rate_plan_id)
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Obtém uma configuração específica do quarto"""
        if not self.room_settings:
            return default
        return self.room_settings.get(key, default)
    
    def set_setting(self, key: str, value: Any) -> None:
        """Define uma configuração específica do quarto"""
        if not self.room_settings:
            self.room_settings = {}
        self.room_settings[key] = value
    
    # ✅ NOVOS MÉTODOS DE GERENCIAMENTO E LIMPEZA
    
    def mark_for_deletion(self) -> None:
        """Marca mapeamento para remoção no WuBook"""
        self.is_active = False
        self.is_syncing = False
        self.deletion_pending = True
        self.sync_pending = True
        self.updated_at = datetime.utcnow()
    
    def mark_sync_pending(self) -> None:
        """Marca para sincronização pendente"""
        self.sync_pending = True
        self.updated_at = datetime.utcnow()
    
    def confirm_deletion_synced(self) -> None:
        """Confirma que a remoção foi sincronizada com WuBook"""
        self.deletion_pending = False
        self.sync_pending = False
        self.updated_at = datetime.utcnow()
    
    # ✅ MÉTODOS ESTÁTICOS PARA LIMPEZA AUTOMÁTICA
    
    @staticmethod
    def cleanup_orphaned_mappings(room_id: int, tenant_id: int, session: Session) -> Dict[str, Any]:
        """
        Remove todos os mapeamentos WuBook órfãos de um quarto específico.
        Usado quando um quarto é excluído.
        """
        try:
            # Buscar todos os mapeamentos ativos para o quarto
            orphaned_mappings = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True
            ).all()
            
            mappings_count = len(orphaned_mappings)
            if mappings_count == 0:
                logger.debug(f"Nenhum mapeamento órfão encontrado para quarto {room_id}")
                return {
                    "success": True,
                    "mappings_cleaned": 0,
                    "message": "Nenhum mapeamento órfão encontrado"
                }
            
            # Marcar todos para remoção
            for mapping in orphaned_mappings:
                mapping.mark_for_deletion()
                logger.debug(f"Mapeamento {mapping.id} marcado para remoção (room_id: {room_id})")
            
            session.commit()
            
            logger.info(f"Removidos {mappings_count} mapeamentos órfãos para quarto {room_id}")
            return {
                "success": True,
                "mappings_cleaned": mappings_count,
                "message": f"Removidos {mappings_count} mapeamentos órfãos"
            }
            
        except Exception as e:
            session.rollback()
            logger.error(f"Erro ao limpar mapeamentos órfãos do quarto {room_id}: {e}")
            return {
                "success": False,
                "mappings_cleaned": 0,
                "error": str(e),
                "message": f"Erro ao limpar mapeamentos: {str(e)}"
            }
    
    @staticmethod
    def cleanup_all_orphaned_mappings(tenant_id: int, session: Session) -> Dict[str, Any]:
        """
        Limpa todos os mapeamentos órfãos do tenant.
        Usado para limpeza geral do sistema.
        """
        try:
            from app.models.room import Room
            
            # Buscar mapeamentos que referenciam quartos inativos
            orphaned_mappings = session.query(WuBookRoomMapping).outerjoin(Room).filter(
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True,
                # Quarto não existe ou está inativo
                (Room.id.is_(None)) | (Room.is_active == False)
            ).all()
            
            mappings_count = len(orphaned_mappings)
            if mappings_count == 0:
                logger.debug(f"Nenhum mapeamento órfão encontrado para tenant {tenant_id}")
                return {
                    "success": True,
                    "mappings_cleaned": 0,
                    "message": "Nenhum mapeamento órfão encontrado"
                }
            
            # Marcar todos para remoção
            for mapping in orphaned_mappings:
                mapping.mark_for_deletion()
                logger.debug(f"Mapeamento órfão {mapping.id} marcado para remoção")
            
            session.commit()
            
            logger.info(f"Limpeza completa: removidos {mappings_count} mapeamentos órfãos do tenant {tenant_id}")
            return {
                "success": True,
                "mappings_cleaned": mappings_count,
                "message": f"Limpeza concluída: {mappings_count} mapeamentos órfãos removidos"
            }
            
        except Exception as e:
            session.rollback()
            logger.error(f"Erro na limpeza completa de mapeamentos órfãos do tenant {tenant_id}: {e}")
            return {
                "success": False,
                "mappings_cleaned": 0,
                "error": str(e),
                "message": f"Erro na limpeza: {str(e)}"
            }
    
    @staticmethod
    def get_pending_deletions(tenant_id: int, session: Session, limit: int = 100) -> List['WuBookRoomMapping']:
        """
        Busca mapeamentos pendentes de remoção no WuBook.
        Usado pelos jobs de sincronização.
        """
        return session.query(WuBookRoomMapping).filter(
            WuBookRoomMapping.tenant_id == tenant_id,
            WuBookRoomMapping.deletion_pending == True,
            WuBookRoomMapping.sync_pending == True
        ).limit(limit).all()
    
    @staticmethod
    def create_default_mapping_for_room(
        room_id: int, 
        tenant_id: int, 
        configuration_id: int,
        wubook_room_id: str,
        session: Session,
        auto_created: bool = True
    ) -> Optional['WuBookRoomMapping']:
        """
        Cria mapeamento padrão para um quarto.
        Usado na criação automática de mapeamentos.
        """
        try:
            # Verificar se já existe mapeamento
            existing = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.configuration_id == configuration_id
            ).first()
            
            if existing:
                if existing.is_active:
                    logger.debug(f"Mapeamento já existe para quarto {room_id}")
                    return existing
                else:
                    # Reativar mapeamento existente
                    existing.is_active = True
                    existing.is_syncing = True
                    existing.sync_pending = True
                    existing.deletion_pending = False
                    existing.wubook_room_id = wubook_room_id
                    existing.updated_at = datetime.utcnow()
                    session.commit()
                    logger.info(f"Mapeamento reativado para quarto {room_id}")
                    return existing
            
            # Criar novo mapeamento
            new_mapping = WuBookRoomMapping(
                tenant_id=tenant_id,
                configuration_id=configuration_id,
                room_id=room_id,
                wubook_room_id=wubook_room_id,
                is_active=True,
                is_syncing=True,
                sync_availability=True,
                sync_rates=True,
                sync_restrictions=True,
                min_occupancy=1,
                rate_multiplier=1.000,
                sync_pending=True,
                metadata_json={
                    "auto_created": auto_created,
                    "created_at": datetime.utcnow().isoformat()
                }
            )
            
            session.add(new_mapping)
            session.commit()
            
            logger.info(f"Mapeamento padrão criado para quarto {room_id} -> WuBook {wubook_room_id}")
            return new_mapping
            
        except Exception as e:
            session.rollback()
            logger.error(f"Erro ao criar mapeamento padrão para quarto {room_id}: {e}")
            return None
    
    @staticmethod
    def get_orphaned_mappings_report(tenant_id: int, session: Session) -> Dict[str, Any]:
        """
        Gera relatório de mapeamentos órfãos.
        Útil para análise e auditoria.
        """
        try:
            from app.models.room import Room
            
            # Mapeamentos órfãos (quartos inexistentes ou inativos)
            orphaned_query = session.query(WuBookRoomMapping).outerjoin(Room).filter(
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True,
                (Room.id.is_(None)) | (Room.is_active == False)
            )
            
            orphaned_mappings = orphaned_query.all()
            
            # Mapeamentos pendentes de remoção
            pending_deletion = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.deletion_pending == True
            ).count()
            
            # Mapeamentos com erros
            error_mappings = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True,
                WuBookRoomMapping.sync_error_count > 0
            ).count()
            
            # Total de mapeamentos ativos
            total_active = session.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True
            ).count()
            
            return {
                "total_active_mappings": total_active,
                "orphaned_mappings": len(orphaned_mappings),
                "pending_deletion": pending_deletion,
                "error_mappings": error_mappings,
                "orphaned_details": [
                    {
                        "mapping_id": m.id,
                        "room_id": m.room_id,
                        "wubook_room_id": m.wubook_room_id,
                        "configuration_id": m.configuration_id,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                        "last_sync_error": m.last_sync_error
                    }
                    for m in orphaned_mappings
                ],
                "health_score": round(
                    (total_active - len(orphaned_mappings) - error_mappings) / max(total_active, 1) * 100, 2
                )
            }
            
        except Exception as e:
            logger.error(f"Erro ao gerar relatório de mapeamentos órfãos: {e}")
            return {
                "error": str(e),
                "total_active_mappings": 0,
                "orphaned_mappings": 0,
                "pending_deletion": 0,
                "error_mappings": 0,
                "orphaned_details": [],
                "health_score": 0.0
            }