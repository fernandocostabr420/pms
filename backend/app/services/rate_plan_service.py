# backend/app/services/rate_plan_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc
from fastapi import HTTPException, status
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from app.models.wubook_rate_plan import WuBookRatePlan
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.room import Room
from app.schemas.rate_plan import (
    RatePlanCreate, RatePlanUpdate, RatePlanFilters,
    PricingRuleCreate, PricingRuleUpdate,
    BulkPricingOperation, BulkPricingResult
)
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class RatePlanService:
    """Serviço para gerenciar planos de tarifa"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    # ============== CRUD BÁSICO ==============
    
    def get_rate_plan(self, rate_plan_id: int, tenant_id: int) -> Optional[WuBookRatePlan]:
        """Busca plano de tarifa por ID"""
        return self.db.query(WuBookRatePlan).filter(
            WuBookRatePlan.id == rate_plan_id,
            WuBookRatePlan.tenant_id == tenant_id
        ).first()
    
    def get_rate_plans(
        self,
        tenant_id: int,
        filters: RatePlanFilters = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[WuBookRatePlan]:
        """Lista planos de tarifa com filtros"""
        query = self.db.query(WuBookRatePlan).options(
            joinedload(WuBookRatePlan.room_type),
            joinedload(WuBookRatePlan.property_obj)
        ).filter(
            WuBookRatePlan.tenant_id == tenant_id
        )
        
        # Aplicar filtros
        if filters:
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        WuBookRatePlan.name.ilike(search_term),
                        WuBookRatePlan.rate_plan_code.ilike(search_term),
                        WuBookRatePlan.description.ilike(search_term)
                    )
                )
            
            if filters.rate_plan_type:
                query = query.filter(WuBookRatePlan.rate_plan_type == filters.rate_plan_type)
            
            if filters.room_type_id:
                query = query.filter(WuBookRatePlan.room_type_id == filters.room_type_id)
            
            if filters.property_id:
                query = query.filter(WuBookRatePlan.property_id == filters.property_id)
            
            if filters.is_active is not None:
                query = query.filter(WuBookRatePlan.is_active == filters.is_active)
            
            if filters.is_default is not None:
                query = query.filter(WuBookRatePlan.is_default == filters.is_default)
            
            if filters.valid_on_date:
                query = query.filter(
                    and_(
                        or_(WuBookRatePlan.valid_from.is_(None), WuBookRatePlan.valid_from <= filters.valid_on_date),
                        or_(WuBookRatePlan.valid_to.is_(None), WuBookRatePlan.valid_to >= filters.valid_on_date)
                    )
                )
        
        return query.order_by(desc(WuBookRatePlan.is_default), WuBookRatePlan.name).offset(skip).limit(limit).all()
    
    def count_rate_plans(self, tenant_id: int, filters: RatePlanFilters = None) -> int:
        """Conta total de planos de tarifa"""
        query = self.db.query(WuBookRatePlan).filter(WuBookRatePlan.tenant_id == tenant_id)
        
        # Aplicar mesmos filtros da listagem
        if filters:
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        WuBookRatePlan.name.ilike(search_term),
                        WuBookRatePlan.rate_plan_code.ilike(search_term),
                        WuBookRatePlan.description.ilike(search_term)
                    )
                )
            
            if filters.rate_plan_type:
                query = query.filter(WuBookRatePlan.rate_plan_type == filters.rate_plan_type)
            
            if filters.room_type_id:
                query = query.filter(WuBookRatePlan.room_type_id == filters.room_type_id)
            
            if filters.property_id:
                query = query.filter(WuBookRatePlan.property_id == filters.property_id)
            
            if filters.is_active is not None:
                query = query.filter(WuBookRatePlan.is_active == filters.is_active)
            
            if filters.is_default is not None:
                query = query.filter(WuBookRatePlan.is_default == filters.is_default)
        
        return query.count()
    
    def create_rate_plan(self, rate_plan_data: RatePlanCreate, tenant_id: int, user_id: int) -> WuBookRatePlan:
        """Cria novo plano de tarifa"""
        try:
            # Verificar se código já existe
            existing = self.db.query(WuBookRatePlan).filter(
                WuBookRatePlan.tenant_id == tenant_id,
                WuBookRatePlan.rate_plan_code == rate_plan_data.code
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Código '{rate_plan_data.code}' já existe"
                )
            
            # Se for marcado como padrão, desmarcar outros
            if rate_plan_data.is_default:
                self._unset_default_rate_plans(tenant_id, rate_plan_data.room_type_id)
            
            # Criar plano
            rate_plan = WuBookRatePlan(
                tenant_id=tenant_id,
                name=rate_plan_data.name,
                rate_plan_code=rate_plan_data.code,
                code=rate_plan_data.code,
                description=rate_plan_data.description,
                room_type_id=rate_plan_data.room_type_id,
                property_id=rate_plan_data.property_id,
                rate_plan_type=rate_plan_data.rate_plan_type,
                is_active=rate_plan_data.is_active,
                is_default=rate_plan_data.is_default,
                valid_from=rate_plan_data.valid_from.isoformat() if rate_plan_data.valid_from else None,
                valid_to=rate_plan_data.valid_to.isoformat() if rate_plan_data.valid_to else None,
                base_rate_single=rate_plan_data.base_rate_single,
                base_rate_double=rate_plan_data.base_rate_double,
                base_rate_triple=rate_plan_data.base_rate_triple,
                base_rate_quad=rate_plan_data.base_rate_quad,
                extra_adult_rate=rate_plan_data.extra_adult_rate,
                extra_child_rate=rate_plan_data.extra_child_rate,
                min_stay=rate_plan_data.min_stay,
                max_stay=rate_plan_data.max_stay,
                min_advance_days=rate_plan_data.min_advance_days,
                max_advance_days=rate_plan_data.max_advance_days,
                inclusions=rate_plan_data.inclusions or {},
                restrictions=rate_plan_data.restrictions or {}
            )
            
            self.db.add(rate_plan)
            self.db.commit()
            self.db.refresh(rate_plan)
            
            # Auditoria
            # Buscar objeto User para auditoria
            from app.models.user import User
            user_obj = self.db.query(User).filter(User.id == user_id).first()
            if user_obj:
                new_values = {
                    "name": rate_plan.name,
                    "code": rate_plan.code,
                    "rate_plan_type": rate_plan.rate_plan_type,
                    "base_rate_double": str(rate_plan.base_rate_double) if rate_plan.base_rate_double else None
                }
                self.audit_service.log_create(
                    table_name="wubook_rate_plans",
                    record_id=rate_plan.id,
                    new_values=new_values,
                    user=user_obj,
                    description="Rate plan criado"
                )
            
            logger.info(f"Plano de tarifa criado: {rate_plan.name} (ID: {rate_plan.id})")
            return rate_plan
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao criar plano: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade nos dados"
            )
    
    def update_rate_plan(
        self, 
        rate_plan_id: int, 
        rate_plan_data: RatePlanUpdate, 
        tenant_id: int, 
        user_id: int
    ) -> WuBookRatePlan:
        """Atualiza plano de tarifa"""
        rate_plan = self.get_rate_plan(rate_plan_id, tenant_id)
        if not rate_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plano de tarifa não encontrado"
            )
        
        # Capturar valores anteriores para auditoria
        old_values = {
            "name": rate_plan.name,
            "is_active": rate_plan.is_active,
            "is_default": rate_plan.is_default
        }
        
        # Aplicar atualizações
        update_data = rate_plan_data.model_dump(exclude_unset=True)
        
        # Se for marcado como padrão, desmarcar outros
        if update_data.get('is_default'):
            self._unset_default_rate_plans(tenant_id, rate_plan.room_type_id, exclude_id=rate_plan_id)
        
        # Converter datas para string se necessário
        if 'valid_from' in update_data and update_data['valid_from']:
            update_data['valid_from'] = update_data['valid_from'].isoformat()
        if 'valid_to' in update_data and update_data['valid_to']:
            update_data['valid_to'] = update_data['valid_to'].isoformat()
        
        for field, value in update_data.items():
            setattr(rate_plan, field, value)
        
        try:
            self.db.commit()
            self.db.refresh(rate_plan)
            
            # Auditoria
            from app.models.user import User
            user_obj = self.db.query(User).filter(User.id == user_id).first()
            if user_obj:
                changes = {key: str(value) if isinstance(value, Decimal) else value 
                          for key, value in update_data.items()}
                self.audit_service.log_update(
                    table_name="wubook_rate_plans",
                    record_id=rate_plan.id,
                    old_values=old_values,
                    new_values=changes,
                    user=user_obj,
                    description="Rate plan atualizado"
                )
            
            logger.info(f"Plano de tarifa atualizado: {rate_plan.name} (ID: {rate_plan.id})")
            return rate_plan
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar plano: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade nos dados"
            )
    
    def delete_rate_plan(self, rate_plan_id: int, tenant_id: int, user_id: int) -> bool:
        """Exclui plano de tarifa (soft delete)"""
        rate_plan = self.get_rate_plan(rate_plan_id, tenant_id)
        if not rate_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plano de tarifa não encontrado"
            )
        
        # Verificar se tem regras de preço ativas
        # (implementar quando criar tabela de pricing rules)
        
        # Soft delete
        rate_plan.is_active = False
        rate_plan.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        # Auditoria
        from app.models.user import User
        user_obj = self.db.query(User).filter(User.id == user_id).first()
        if user_obj:
            old_values = {
                "name": rate_plan.name,
                "code": rate_plan.code,
                "is_active": True
            }
            self.audit_service.log_delete(
                table_name="wubook_rate_plans",
                record_id=rate_plan.id,
                old_values=old_values,
                user=user_obj,
                description="Rate plan excluído (soft delete)"
            )
        
        logger.info(f"Plano de tarifa excluído: {rate_plan.name} (ID: {rate_plan.id})")
        return True
    
    # ============== OPERAÇÕES EM MASSA ==============
    
    def bulk_update_pricing(
        self, 
        operation: BulkPricingOperation, 
        tenant_id: int, 
        user_id: int
    ) -> BulkPricingResult:
        """Atualização em massa de preços"""
        try:
            total_rules_created = 0
            total_rules_updated = 0
            errors = []
            
            # Validar planos de tarifa
            valid_rate_plans = self.db.query(WuBookRatePlan).filter(
                WuBookRatePlan.id.in_(operation.rate_plan_ids),
                WuBookRatePlan.tenant_id == tenant_id,
                WuBookRatePlan.is_active == True
            ).all()
            
            if len(valid_rate_plans) != len(operation.rate_plan_ids):
                found_ids = [rp.id for rp in valid_rate_plans]
                missing_ids = set(operation.rate_plan_ids) - set(found_ids)
                errors.append(f"Planos não encontrados: {missing_ids}")
            
            # Calcular total de dias
            total_days = (operation.date_to - operation.date_from).days + 1
            
            # Aplicar operação para cada plano
            for rate_plan in valid_rate_plans:
                try:
                    result = self._apply_pricing_operation(
                        rate_plan, operation, tenant_id, user_id
                    )
                    total_rules_created += result.get('created', 0)
                    total_rules_updated += result.get('updated', 0)
                    
                except Exception as e:
                    errors.append(f"Erro no plano {rate_plan.name}: {str(e)}")
            
            self.db.commit()
            
            # Log da operação
            from app.models.user import User
            user_obj = self.db.query(User).filter(User.id == user_id).first()
            if user_obj:
                operation_data = {
                    "operation": operation.operation_type,
                    "rate_plans": operation.rate_plan_ids,
                    "period": f"{operation.date_from} - {operation.date_to}",
                    "rules_created": total_rules_created,
                    "rules_updated": total_rules_updated
                }
                self.audit_service.log_create(
                    table_name="bulk_operations",
                    record_id=0,  # Operações em massa não têm ID específico
                    new_values=operation_data,
                    user=user_obj,
                    description="Operação em massa de preços"
                )
            
            return BulkPricingResult(
                success=len(errors) == 0,
                message=f"Operação concluída. {total_rules_created} criadas, {total_rules_updated} atualizadas",
                total_rules_created=total_rules_created,
                total_rules_updated=total_rules_updated,
                total_days_affected=total_days * len(valid_rate_plans),
                errors=errors if errors else None
            )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro na operação em massa: {str(e)}")
            return BulkPricingResult(
                success=False,
                message=f"Erro na operação: {str(e)}",
                total_rules_created=0,
                total_rules_updated=0,
                total_days_affected=0,
                errors=[str(e)]
            )
    
    # ============== MÉTODOS AUXILIARES ==============
    
    def _unset_default_rate_plans(self, tenant_id: int, room_type_id: Optional[int], exclude_id: Optional[int] = None):
        """Remove flag de padrão de outros planos"""
        query = self.db.query(WuBookRatePlan).filter(
            WuBookRatePlan.tenant_id == tenant_id,
            WuBookRatePlan.is_default == True
        )
        
        if room_type_id:
            query = query.filter(WuBookRatePlan.room_type_id == room_type_id)
        
        if exclude_id:
            query = query.filter(WuBookRatePlan.id != exclude_id)
        
        for rate_plan in query.all():
            rate_plan.is_default = False
        
        self.db.flush()
    
    def _apply_pricing_operation(
        self, 
        rate_plan: WuBookRatePlan, 
        operation: BulkPricingOperation, 
        tenant_id: int, 
        user_id: int
    ) -> Dict[str, int]:
        """Aplica operação de preço a um plano específico"""
        # Por enquanto, vamos atualizar diretamente os preços base do rate plan
        # Posteriormente, criaremos uma tabela de pricing_rules para preços específicos por data
        
        created = 0
        updated = 1  # Sempre atualiza o rate plan
        
        if operation.operation_type == "set":
            # Definir preços fixos
            if "base_rate_single" in operation.values:
                rate_plan.base_rate_single = Decimal(str(operation.values["base_rate_single"]))
            if "base_rate_double" in operation.values:
                rate_plan.base_rate_double = Decimal(str(operation.values["base_rate_double"]))
            if "base_rate_triple" in operation.values:
                rate_plan.base_rate_triple = Decimal(str(operation.values["base_rate_triple"]))
            if "base_rate_quad" in operation.values:
                rate_plan.base_rate_quad = Decimal(str(operation.values["base_rate_quad"]))
        
        elif operation.operation_type == "multiply":
            # Aplicar multiplicador
            multiplier = Decimal(str(operation.values.get("multiplier", 1.0)))
            if rate_plan.base_rate_single:
                rate_plan.base_rate_single *= multiplier
            if rate_plan.base_rate_double:
                rate_plan.base_rate_double *= multiplier
            if rate_plan.base_rate_triple:
                rate_plan.base_rate_triple *= multiplier
            if rate_plan.base_rate_quad:
                rate_plan.base_rate_quad *= multiplier
        
        elif operation.operation_type == "add":
            # Somar valor
            add_value = Decimal(str(operation.values.get("add_value", 0)))
            if rate_plan.base_rate_single:
                rate_plan.base_rate_single += add_value
            if rate_plan.base_rate_double:
                rate_plan.base_rate_double += add_value
            if rate_plan.base_rate_triple:
                rate_plan.base_rate_triple += add_value
            if rate_plan.base_rate_quad:
                rate_plan.base_rate_quad += add_value
        
        rate_plan.last_rate_update = datetime.utcnow().isoformat()
        
        return {"created": created, "updated": updated}
    
    def get_applicable_rate_plans(
        self, 
        tenant_id: int, 
        room_type_id: Optional[int] = None,
        property_id: Optional[int] = None,
        check_date: Optional[date] = None
    ) -> List[WuBookRatePlan]:
        """Busca planos de tarifa aplicáveis a critérios específicos"""
        query = self.db.query(WuBookRatePlan).filter(
            WuBookRatePlan.tenant_id == tenant_id,
            WuBookRatePlan.is_active == True
        )
        
        # Filtrar por tipo de quarto (None = aplicável a todos)
        if room_type_id:
            query = query.filter(
                or_(
                    WuBookRatePlan.room_type_id == room_type_id,
                    WuBookRatePlan.room_type_id.is_(None)
                )
            )
        
        # Filtrar por propriedade
        if property_id:
            query = query.filter(
                or_(
                    WuBookRatePlan.property_id == property_id,
                    WuBookRatePlan.property_id.is_(None)
                )
            )
        
        # Filtrar por validade
        if check_date:
            query = query.filter(
                and_(
                    or_(WuBookRatePlan.valid_from.is_(None), WuBookRatePlan.valid_from <= check_date.isoformat()),
                    or_(WuBookRatePlan.valid_to.is_(None), WuBookRatePlan.valid_to >= check_date.isoformat())
                )
            )
        
        return query.order_by(desc(WuBookRatePlan.is_default), WuBookRatePlan.name).all()