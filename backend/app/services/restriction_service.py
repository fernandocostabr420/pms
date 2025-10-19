# backend/app/services/restriction_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc, asc, text
from fastapi import HTTPException, status, Request
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from app.models.reservation_restriction import ReservationRestriction, RestrictionType
from app.models.property import Property
from app.models.room_type import RoomType
from app.models.room import Room
from app.models.user import User
from app.schemas.reservation_restriction import (
    ReservationRestrictionCreate, ReservationRestrictionUpdate, ReservationRestrictionFilters,
    BulkRestrictionOperation, BulkRestrictionResult,
    CalendarRestrictionRequest, CalendarRestrictionResponse, CalendarDayRestriction,
    RestrictionValidationRequest, RestrictionValidationResponse, RestrictionViolation
)
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class RestrictionService:
    """Serviço para gerenciar restrições de reserva"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    # ============== CRUD BÁSICO ==============
    
    def get_restriction(self, restriction_id: int, tenant_id: int) -> Optional[ReservationRestriction]:
        """Busca restrição por ID"""
        return self.db.query(ReservationRestriction).options(
            joinedload(ReservationRestriction.property_obj),
            joinedload(ReservationRestriction.room_type),
            joinedload(ReservationRestriction.room)
        ).filter(
            ReservationRestriction.id == restriction_id,
            ReservationRestriction.tenant_id == tenant_id
        ).first()
    
    def get_restrictions(
        self,
        tenant_id: int,
        filters: ReservationRestrictionFilters = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[ReservationRestriction]:
        """Lista restrições com filtros"""
        query = self.db.query(ReservationRestriction).options(
            joinedload(ReservationRestriction.property_obj),
            joinedload(ReservationRestriction.room_type),
            joinedload(ReservationRestriction.room)
        ).filter(
            ReservationRestriction.tenant_id == tenant_id
        )
        
        # Aplicar filtros
        if filters:
            if filters.property_id:
                query = query.filter(ReservationRestriction.property_id == filters.property_id)
            
            if filters.room_type_id:
                query = query.filter(ReservationRestriction.room_type_id == filters.room_type_id)
            
            if filters.room_id:
                query = query.filter(ReservationRestriction.room_id == filters.room_id)
            
            if filters.date_from:
                query = query.filter(ReservationRestriction.date_to >= filters.date_from)
            
            if filters.date_to:
                query = query.filter(ReservationRestriction.date_from <= filters.date_to)
            
            if filters.restriction_type:
                query = query.filter(ReservationRestriction.restriction_type == filters.restriction_type)
            
            if filters.restriction_types:
                query = query.filter(ReservationRestriction.restriction_type.in_(filters.restriction_types))
            
            if filters.is_active is not None:
                query = query.filter(ReservationRestriction.is_active == filters.is_active)
            
            if filters.is_restricted is not None:
                query = query.filter(ReservationRestriction.is_restricted == filters.is_restricted)
            
            if filters.source:
                query = query.filter(ReservationRestriction.source == filters.source)
            
            if filters.channel_name:
                query = query.filter(ReservationRestriction.channel_name.ilike(f"%{filters.channel_name}%"))
            
            if filters.scope_level:
                if filters.scope_level == "property":
                    query = query.filter(
                        ReservationRestriction.room_type_id.is_(None),
                        ReservationRestriction.room_id.is_(None)
                    )
                elif filters.scope_level == "room_type":
                    query = query.filter(
                        ReservationRestriction.room_type_id.isnot(None),
                        ReservationRestriction.room_id.is_(None)
                    )
                elif filters.scope_level == "room":
                    query = query.filter(ReservationRestriction.room_id.isnot(None))
            
            if filters.sync_pending is not None:
                query = query.filter(ReservationRestriction.sync_pending == filters.sync_pending)
            
            if filters.has_sync_error is not None:
                if filters.has_sync_error:
                    query = query.filter(ReservationRestriction.sync_error.isnot(None))
                else:
                    query = query.filter(ReservationRestriction.sync_error.is_(None))
            
            if filters.priority_min:
                query = query.filter(ReservationRestriction.priority >= filters.priority_min)
            
            if filters.priority_max:
                query = query.filter(ReservationRestriction.priority <= filters.priority_max)
            
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        ReservationRestriction.name.ilike(search_term),
                        ReservationRestriction.description.ilike(search_term),
                        ReservationRestriction.reason.ilike(search_term)
                    )
                )
        
        # Ordenação: prioridade DESC, data_from ASC
        query = query.order_by(
            desc(ReservationRestriction.priority),
            asc(ReservationRestriction.date_from),
            asc(ReservationRestriction.restriction_type)
        )
        
        return query.offset(skip).limit(limit).all()
    
    def count_restrictions(
        self,
        tenant_id: int,
        filters: ReservationRestrictionFilters = None
    ) -> int:
        """Conta total de restrições com filtros"""
        query = self.db.query(func.count(ReservationRestriction.id)).filter(
            ReservationRestriction.tenant_id == tenant_id
        )
        
        # Aplicar os mesmos filtros da listagem
        if filters:
            # Replicar lógica de filtros do get_restrictions
            if filters.property_id:
                query = query.filter(ReservationRestriction.property_id == filters.property_id)
            # ... (repetir todos os filtros)
        
        return query.scalar()
    
    def create_restriction(
        self,
        restriction_data: ReservationRestrictionCreate,
        tenant_id: int,
        user: User,
        request: Optional[Request] = None
    ) -> ReservationRestriction:
        """Cria nova restrição"""
        try:
            # Validar hierarquia (property deve existir, room deve estar no room_type, etc.)
            self._validate_restriction_hierarchy(restriction_data, tenant_id)
            
            # Verificar conflitos
            conflicts = self._check_conflicts(restriction_data, tenant_id)
            if conflicts:
                logger.warning(f"Conflitos encontrados ao criar restrição: {conflicts}")
            
            # Criar restrição
            restriction = ReservationRestriction(
                **restriction_data.dict(exclude={'metadata_json'}),
                tenant_id=tenant_id,
                metadata_json=restriction_data.metadata_json or {}
            )
            
            self.db.add(restriction)
            self.db.flush()  # Para obter o ID
            
            # Auditoria
            self.audit_service.log_create(
                table_name="reservation_restrictions",
                record_id=restriction.id,
                new_values=restriction_data.dict(),
                user=user,
                request=request,
                description=f"Restrição criada: {restriction.restriction_type} ({restriction.scope_level})"
            )
            
            self.db.commit()
            self.db.refresh(restriction)
            
            logger.info(f"Restrição criada: {restriction.id} - {restriction.restriction_type}")
            return restriction
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao criar restrição: {str(e)}")
            if "uq_restriction_scope_period_type" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Já existe uma restrição do mesmo tipo para este escopo e período"
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade dos dados"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar restrição: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno do servidor"
            )
    
    def update_restriction(
        self,
        restriction_id: int,
        restriction_data: ReservationRestrictionUpdate,
        tenant_id: int,
        user: User,
        request: Optional[Request] = None
    ) -> ReservationRestriction:
        """Atualiza restrição existente"""
        restriction = self.get_restriction(restriction_id, tenant_id)
        if not restriction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restrição não encontrada"
            )
        
        try:
            # Capturar valores antigos para auditoria
            old_values = {
                "date_from": restriction.date_from,
                "date_to": restriction.date_to,
                "restriction_type": restriction.restriction_type,
                "restriction_value": restriction.restriction_value,
                "is_restricted": restriction.is_restricted,
                "is_active": restriction.is_active,
                "priority": restriction.priority
            }
            
            # Atualizar campos
            update_data = restriction_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(restriction, field, value)
            
            # Marcar para sincronização se necessário
            if any(field in update_data for field in ['date_from', 'date_to', 'restriction_type', 'restriction_value', 'is_restricted']):
                restriction.sync_pending = True
            
            self.db.flush()
            
            # Auditoria
            self.audit_service.log_update(
                table_name="reservation_restrictions",
                record_id=restriction.id,
                old_values=old_values,
                new_values=update_data,
                user=user,
                request=request,
                description=f"Restrição atualizada: {restriction.restriction_type}"
            )
            
            self.db.commit()
            self.db.refresh(restriction)
            
            logger.info(f"Restrição atualizada: {restriction.id}")
            return restriction
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar restrição: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno do servidor"
            )
    
    def delete_restriction(
        self,
        restriction_id: int,
        tenant_id: int,
        user: User,
        request: Optional[Request] = None
    ) -> bool:
        """Remove restrição"""
        restriction = self.get_restriction(restriction_id, tenant_id)
        if not restriction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restrição não encontrada"
            )
        
        try:
            # Capturar dados para auditoria
            old_values = {
                "restriction_type": restriction.restriction_type,
                "scope_level": restriction.scope_level,
                "date_from": restriction.date_from,
                "date_to": restriction.date_to
            }
            
            self.db.delete(restriction)
            
            # Auditoria
            self.audit_service.log_delete(
                table_name="reservation_restrictions",
                record_id=restriction_id,
                old_values=old_values,
                user=user,
                request=request,
                description=f"Restrição removida: {restriction.restriction_type}"
            )
            
            self.db.commit()
            
            logger.info(f"Restrição removida: {restriction_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao remover restrição: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno do servidor"
            )
    
    # ============== OPERAÇÕES EM MASSA ==============
    
    def bulk_restriction_operation(
        self,
        operation_data: BulkRestrictionOperation,
        tenant_id: int,
        user: User,
        request: Optional[Request] = None
    ) -> BulkRestrictionResult:
        """Executa operação em massa com restrições"""
        try:
            if operation_data.dry_run:
                return self._execute_bulk_dry_run(operation_data, tenant_id)
            
            if operation_data.operation == "create":
                return self._bulk_create_restrictions(operation_data, tenant_id, user, request)
            elif operation_data.operation == "update":
                return self._bulk_update_restrictions(operation_data, tenant_id, user, request)
            elif operation_data.operation == "delete":
                return self._bulk_delete_restrictions(operation_data, tenant_id, user, request)
            else:
                raise ValueError(f"Operação inválida: {operation_data.operation}")
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro na operação em massa: {str(e)}")
            return BulkRestrictionResult(
                success=False,
                operation=operation_data.operation,
                message=f"Erro na operação: {str(e)}",
                errors=[str(e)]
            )
    
    def _bulk_create_restrictions(
        self,
        operation_data: BulkRestrictionOperation,
        tenant_id: int,
        user: User,
        request: Optional[Request] = None
    ) -> BulkRestrictionResult:
        """Criação em massa de restrições"""
        restrictions_created = 0
        restrictions_updated = 0
        conflicts_found = []
        errors = []
        
        # Determinar escopo
        scope_combinations = self._get_scope_combinations(operation_data, tenant_id)
        
        for property_id, room_type_id, room_id in scope_combinations:
            try:
                # Verificar se já existe
                existing = self._find_existing_restriction(
                    property_id, room_type_id, room_id,
                    operation_data.date_from, operation_data.date_to,
                    operation_data.restriction_type, tenant_id
                )
                
                if existing and not operation_data.overwrite_existing:
                    conflicts_found.append({
                        "property_id": property_id,
                        "room_type_id": room_type_id,
                        "room_id": room_id,
                        "message": "Restrição já existe"
                    })
                    continue
                
                if existing and operation_data.overwrite_existing:
                    # Atualizar existente
                    self._update_existing_restriction(existing, operation_data)
                    restrictions_updated += 1
                else:
                    # Criar nova
                    restriction = ReservationRestriction(
                        tenant_id=tenant_id,
                        property_id=property_id,
                        room_type_id=room_type_id,
                        room_id=room_id,
                        date_from=operation_data.date_from,
                        date_to=operation_data.date_to,
                        days_of_week=operation_data.days_of_week,
                        restriction_type=operation_data.restriction_type,
                        restriction_value=operation_data.restriction_value,
                        is_restricted=operation_data.is_restricted,
                        name=operation_data.name,
                        description=operation_data.description,
                        reason=operation_data.reason,
                        priority=operation_data.priority,
                        source="bulk_import"
                    )
                    
                    self.db.add(restriction)
                    restrictions_created += 1
                
            except Exception as e:
                errors.append(f"Erro ao processar {property_id}/{room_type_id}/{room_id}: {str(e)}")
        
        if not errors:
            self.db.commit()
            
            # Auditoria consolidada
            self.audit_service.log_create(
                table_name="reservation_restrictions",
                record_id=0,  # Operação em massa
                new_values=operation_data.dict(),
                user=user,
                request=request,
                description=f"Operação em massa: {restrictions_created} criadas, {restrictions_updated} atualizadas"
            )
        
        total_days = (operation_data.date_to - operation_data.date_from).days + 1
        
        return BulkRestrictionResult(
            success=len(errors) == 0,
            operation="create",
            message=f"Operação concluída: {restrictions_created} criadas, {restrictions_updated} atualizadas",
            total_restrictions_processed=restrictions_created + restrictions_updated,
            total_restrictions_created=restrictions_created,
            total_restrictions_updated=restrictions_updated,
            total_days_affected=total_days * len(scope_combinations),
            conflicts_found=conflicts_found,
            errors=errors if errors else None,
            properties_affected=operation_data.property_ids,
            room_types_affected=operation_data.room_type_ids or [],
            rooms_affected=operation_data.room_ids or []
        )
    
    # ============== MÉTODOS AUXILIARES ==============
    
    def _validate_restriction_hierarchy(self, restriction_data: ReservationRestrictionCreate, tenant_id: int):
        """Valida hierarquia de propriedade/tipo/quarto"""
        # Verificar se property existe
        property_exists = self.db.query(Property).filter(
            Property.id == restriction_data.property_id,
            Property.tenant_id == tenant_id
        ).first()
        
        if not property_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Propriedade não encontrada"
            )
        
        # Se room_type_id especificado, verificar se existe
        if restriction_data.room_type_id:
            room_type_exists = self.db.query(RoomType).filter(
                RoomType.id == restriction_data.room_type_id,
                RoomType.tenant_id == tenant_id
            ).first()
            
            if not room_type_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tipo de quarto não encontrado"
                )
        
        # Se room_id especificado, verificar hierarquia
        if restriction_data.room_id:
            room = self.db.query(Room).filter(
                Room.id == restriction_data.room_id,
                Room.tenant_id == tenant_id
            ).first()
            
            if not room:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Quarto não encontrado"
                )
            
            # Verificar se quarto pertence à propriedade
            if room.property_id != restriction_data.property_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Quarto não pertence à propriedade especificada"
                )
            
            # Se room_type_id especificado, verificar se quarto pertence ao tipo
            if restriction_data.room_type_id and room.room_type_id != restriction_data.room_type_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Quarto não pertence ao tipo especificado"
                )
    
    def _check_conflicts(self, restriction_data: ReservationRestrictionCreate, tenant_id: int) -> List[str]:
        """Verifica conflitos com restrições existentes"""
        conflicts = []
        
        # Buscar restrições sobrepostas no mesmo escopo
        existing = self.db.query(ReservationRestriction).filter(
            ReservationRestriction.tenant_id == tenant_id,
            ReservationRestriction.property_id == restriction_data.property_id,
            ReservationRestriction.room_type_id == restriction_data.room_type_id,
            ReservationRestriction.room_id == restriction_data.room_id,
            ReservationRestriction.restriction_type == restriction_data.restriction_type,
            ReservationRestriction.is_active == True,
            # Overlap de datas
            and_(
                ReservationRestriction.date_from <= restriction_data.date_to,
                ReservationRestriction.date_to >= restriction_data.date_from
            )
        ).all()
        
        for existing_restriction in existing:
            conflicts.append(f"Sobreposição com restrição existente ID: {existing_restriction.id}")
        
        return conflicts
    
    def _get_scope_combinations(self, operation_data: BulkRestrictionOperation, tenant_id: int) -> List[Tuple[int, Optional[int], Optional[int]]]:
        """Gera combinações de escopo para operação em massa"""
        combinations = []
        
        for property_id in operation_data.property_ids:
            if operation_data.room_ids:
                # Escopo específico por quarto
                for room_id in operation_data.room_ids:
                    # Buscar room_type_id do quarto
                    room = self.db.query(Room).filter(
                        Room.id == room_id,
                        Room.property_id == property_id,
                        Room.tenant_id == tenant_id
                    ).first()
                    
                    if room:
                        combinations.append((property_id, room.room_type_id, room_id))
            
            elif operation_data.room_type_ids:
                # Escopo por tipo de quarto
                for room_type_id in operation_data.room_type_ids:
                    combinations.append((property_id, room_type_id, None))
            
            else:
                # Escopo da propriedade inteira
                combinations.append((property_id, None, None))
        
        return combinations
    
    def _find_existing_restriction(
        self,
        property_id: int,
        room_type_id: Optional[int],
        room_id: Optional[int],
        date_from: date,
        date_to: date,
        restriction_type: str,
        tenant_id: int
    ) -> Optional[ReservationRestriction]:
        """Busca restrição existente no mesmo escopo e período"""
        return self.db.query(ReservationRestriction).filter(
            ReservationRestriction.tenant_id == tenant_id,
            ReservationRestriction.property_id == property_id,
            ReservationRestriction.room_type_id == room_type_id,
            ReservationRestriction.room_id == room_id,
            ReservationRestriction.restriction_type == restriction_type,
            ReservationRestriction.date_from == date_from,
            ReservationRestriction.date_to == date_to
        ).first()
    
    def _update_existing_restriction(self, restriction: ReservationRestriction, operation_data: BulkRestrictionOperation):
        """Atualiza restrição existente com dados da operação em massa"""
        restriction.restriction_value = operation_data.restriction_value
        restriction.is_restricted = operation_data.is_restricted
        restriction.priority = operation_data.priority
        restriction.sync_pending = True
        
        if operation_data.name:
            restriction.name = operation_data.name
        if operation_data.description:
            restriction.description = operation_data.description
        if operation_data.reason:
            restriction.reason = operation_data.reason
    
    def _execute_bulk_dry_run(self, operation_data: BulkRestrictionOperation, tenant_id: int) -> BulkRestrictionResult:
        """Executa simulação de operação em massa"""
        scope_combinations = self._get_scope_combinations(operation_data, tenant_id)
        would_create = 0
        would_update = 0
        conflicts_found = []
        
        for property_id, room_type_id, room_id in scope_combinations:
            existing = self._find_existing_restriction(
                property_id, room_type_id, room_id,
                operation_data.date_from, operation_data.date_to,
                operation_data.restriction_type, tenant_id
            )
            
            if existing:
                if operation_data.overwrite_existing:
                    would_update += 1
                else:
                    conflicts_found.append({
                        "property_id": property_id,
                        "room_type_id": room_type_id,
                        "room_id": room_id,
                        "message": "Conflito - restrição já existe"
                    })
            else:
                would_create += 1
        
        return BulkRestrictionResult(
            success=True,
            operation=f"dry_run_{operation_data.operation}",
            message=f"Simulação: {would_create} seriam criadas, {would_update} seriam atualizadas",
            would_create=would_create,
            would_update=would_update,
            conflicts_found=conflicts_found,
            properties_affected=operation_data.property_ids,
            room_types_affected=operation_data.room_type_ids or [],
            rooms_affected=operation_data.room_ids or []
        )