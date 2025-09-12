# backend/app/services/payment_method_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc, asc
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.schemas.payment_method import (
    PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodFilters,
    PaymentMethodResponse, PaymentMethodStats, PaymentMethodUsage,
    PaymentMethodBulkOperation, PaymentMethodOrderUpdate
)
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class PaymentMethodService:
    """Serviço para operações com métodos de pagamento"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    def get_payment_method_by_id(self, payment_method_id: int, tenant_id: int) -> Optional[PaymentMethod]:
        """Busca método de pagamento por ID dentro do tenant"""
        return self.db.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method_id,
            PaymentMethod.tenant_id == tenant_id
        ).first()
    
    def get_payment_method_by_code(self, code: str, tenant_id: int) -> Optional[PaymentMethod]:
        """Busca método de pagamento por código dentro do tenant"""
        return self.db.query(PaymentMethod).filter(
            PaymentMethod.code == code,
            PaymentMethod.tenant_id == tenant_id
        ).first()
    
    def get_payment_methods(
        self,
        tenant_id: int,
        filters: PaymentMethodFilters,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[PaymentMethod], int]:
        """Lista métodos de pagamento com filtros e paginação"""
        query = self.db.query(PaymentMethod).filter(PaymentMethod.tenant_id == tenant_id)
        
        # Aplicar filtros
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    PaymentMethod.name.ilike(search_term),
                    PaymentMethod.code.ilike(search_term),
                    PaymentMethod.description.ilike(search_term)
                )
            )
        
        if filters.is_active is not None:
            query = query.filter(PaymentMethod.is_active == filters.is_active)
        
        if filters.has_fees is not None:
            query = query.filter(PaymentMethod.has_fees == filters.has_fees)
        
        if filters.requires_reference is not None:
            query = query.filter(PaymentMethod.requires_reference == filters.requires_reference)
        
        if filters.code_list:
            query = query.filter(PaymentMethod.code.in_(filters.code_list))
        
        # Total de registros
        total = query.count()
        
        # Ordenação e paginação
        query = query.order_by(PaymentMethod.display_order, PaymentMethod.name)
        
        if per_page > 0:
            offset = (page - 1) * per_page
            query = query.offset(offset).limit(per_page)
        
        payment_methods = query.all()
        return payment_methods, total
    
    def get_active_payment_methods(self, tenant_id: int) -> List[PaymentMethod]:
        """Obtém todos os métodos ativos ordenados"""
        return PaymentMethod.get_active_methods(self.db, tenant_id)
    
    def create_payment_method(
        self, 
        payment_method_data: PaymentMethodCreate, 
        tenant_id: int,
        current_user: User
    ) -> PaymentMethod:
        """Cria novo método de pagamento"""
        try:
            # Verificar se código já existe
            existing = self.get_payment_method_by_code(payment_method_data.code, tenant_id)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Já existe um método com o código '{payment_method_data.code}'"
                )
            
            # Verificar se nome já existe
            existing_name = self.db.query(PaymentMethod).filter(
                PaymentMethod.tenant_id == tenant_id,
                PaymentMethod.name == payment_method_data.name
            ).first()
            if existing_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Já existe um método com o nome '{payment_method_data.name}'"
                )
            
            # Criar método de pagamento
            payment_method = PaymentMethod(
                tenant_id=tenant_id,
                **payment_method_data.model_dump()
            )
            
            self.db.add(payment_method)
            self.db.flush()  # Para obter o ID
            
            # Registrar auditoria
            self.audit_service.log_create(
                table_name="payment_methods",
                record_id=payment_method.id,
                new_values=payment_method_data.model_dump(),
                user=current_user,
                request=None,
                description=f"Método de pagamento '{payment_method.name}' criado"
            )
            
            self.db.commit()
            logger.info(f"Método de pagamento {payment_method.id} criado por usuário {current_user.id}")
            
            return payment_method
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao criar método de pagamento: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade: código ou nome já existem"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar método de pagamento: {e}")
            raise
    
    def update_payment_method(
        self,
        payment_method_id: int,
        payment_method_data: PaymentMethodUpdate,
        tenant_id: int,
        current_user: User
    ) -> PaymentMethod:
        """Atualiza método de pagamento"""
        try:
            payment_method = self.get_payment_method_by_id(payment_method_id, tenant_id)
            if not payment_method:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Método de pagamento não encontrado"
                )
            
            # Capturar valores originais para auditoria
            old_values = {
                "name": payment_method.name,
                "code": payment_method.code,
                "description": payment_method.description,
                "display_order": payment_method.display_order,
                "icon": payment_method.icon,
                "color": payment_method.color,
                "is_active": payment_method.is_active,
                "requires_reference": payment_method.requires_reference,
                "has_fees": payment_method.has_fees,
                "default_fee_rate": float(payment_method.default_fee_rate) if payment_method.default_fee_rate else None,
                "settings": payment_method.settings,
                "validation_rules": payment_method.validation_rules
            }
            
            # Verificar conflitos se código for alterado
            update_data = payment_method_data.model_dump(exclude_unset=True)
            if 'code' in update_data and update_data['code'] != payment_method.code:
                existing = self.get_payment_method_by_code(update_data['code'], tenant_id)
                if existing and existing.id != payment_method.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Já existe um método com o código '{update_data['code']}'"
                    )
            
            # Verificar conflitos se nome for alterado
            if 'name' in update_data and update_data['name'] != payment_method.name:
                existing_name = self.db.query(PaymentMethod).filter(
                    PaymentMethod.tenant_id == tenant_id,
                    PaymentMethod.name == update_data['name'],
                    PaymentMethod.id != payment_method.id
                ).first()
                if existing_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Já existe um método com o nome '{update_data['name']}'"
                    )
            
            # Aplicar atualizações
            for field, value in update_data.items():
                setattr(payment_method, field, value)
            
            self.db.flush()
            
            # Registrar auditoria
            self.audit_service.log_update(
                table_name="payment_methods",
                record_id=payment_method.id,
                old_values=old_values,
                new_values=update_data,
                user=current_user,
                request=None,
                description=f"Método de pagamento '{payment_method.name}' atualizado"
            )
            
            self.db.commit()
            logger.info(f"Método de pagamento {payment_method.id} atualizado por usuário {current_user.id}")
            
            return payment_method
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao atualizar método de pagamento: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade: código ou nome já existem"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar método de pagamento: {e}")
            raise
    
    def delete_payment_method(
        self, 
        payment_method_id: int, 
        tenant_id: int,
        current_user: User
    ) -> bool:
        """Exclui método de pagamento (soft delete)"""
        try:
            payment_method = self.get_payment_method_by_id(payment_method_id, tenant_id)
            if not payment_method:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Método de pagamento não encontrado"
                )
            
            # Verificar se método está sendo usado
            # TODO: Implementar verificação de uso em pagamentos
            
            # Soft delete
            payment_method.is_active = False
            self.db.flush()
            
            # Registrar auditoria (usando log_update pois é soft delete)
            self.audit_service.log_update(
                table_name="payment_methods",
                record_id=payment_method.id,
                old_values={"is_active": True},
                new_values={"is_active": False},
                user=current_user,
                request=None,
                description=f"Método de pagamento '{payment_method.name}' desativado"
            )
            
            self.db.commit()
            logger.info(f"Método de pagamento {payment_method.id} desativado por usuário {current_user.id}")
            
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao excluir método de pagamento: {e}")
            raise
    
    def bulk_operation(
        self,
        operation_data: PaymentMethodBulkOperation,
        tenant_id: int,
        current_user: User
    ) -> Dict[str, Any]:
        """Operação em massa nos métodos de pagamento"""
        try:
            payment_methods = self.db.query(PaymentMethod).filter(
                PaymentMethod.id.in_(operation_data.payment_method_ids),
                PaymentMethod.tenant_id == tenant_id
            ).all()
            
            if not payment_methods:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Nenhum método de pagamento encontrado"
                )
            
            results = []
            
            for payment_method in payment_methods:
                try:
                    old_active = payment_method.is_active
                    
                    if operation_data.operation == "activate":
                        payment_method.is_active = True
                    elif operation_data.operation == "deactivate":
                        payment_method.is_active = False
                    elif operation_data.operation == "delete":
                        payment_method.is_active = False
                    
                    # Registrar auditoria se houve mudança
                    if old_active != payment_method.is_active:
                        self.audit_service.log_update(
                            table_name="payment_methods",
                            record_id=payment_method.id,
                            old_values={"is_active": old_active},
                            new_values={"is_active": payment_method.is_active},
                            user=current_user,
                            request=None,
                            description=f"Operação em massa '{operation_data.operation}' no método '{payment_method.name}'"
                        )
                    
                    results.append({
                        "id": payment_method.id,
                        "name": payment_method.name,
                        "success": True
                    })
                    
                except Exception as e:
                    results.append({
                        "id": payment_method.id,
                        "name": payment_method.name,
                        "success": False,
                        "error": str(e)
                    })
            
            self.db.commit()
            logger.info(f"Operação em massa '{operation_data.operation}' executada por usuário {current_user.id}")
            
            return {
                "operation": operation_data.operation,
                "total_requested": len(operation_data.payment_method_ids),
                "total_processed": len([r for r in results if r["success"]]),
                "results": results
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro em operação em massa: {e}")
            raise
    
    def update_display_order(
        self,
        order_data: PaymentMethodOrderUpdate,
        tenant_id: int,
        current_user: User
    ) -> List[PaymentMethod]:
        """Atualiza ordem de exibição dos métodos"""
        try:
            updated_methods = []
            
            for order_item in order_data.payment_method_orders:
                payment_method = self.get_payment_method_by_id(order_item["id"], tenant_id)
                if payment_method:
                    old_order = payment_method.display_order
                    payment_method.display_order = order_item["display_order"]
                    
                    # Registrar auditoria
                    self.audit_service.log_update(
                        table_name="payment_methods",
                        record_id=payment_method.id,
                        old_values={"display_order": old_order},
                        new_values={"display_order": payment_method.display_order},
                        user=current_user,
                        request=None,
                        description=f"Ordem de exibição do método '{payment_method.name}' alterada"
                    )
                    
                    updated_methods.append(payment_method)
            
            self.db.commit()
            logger.info(f"Ordem de exibição atualizada por usuário {current_user.id}")
            
            return updated_methods
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar ordem de exibição: {e}")
            raise
    
    def get_payment_method_stats(self, tenant_id: int) -> PaymentMethodStats:
        """Obtém estatísticas dos métodos de pagamento"""
        try:
            # Estatísticas básicas
            total_methods = self.db.query(func.count(PaymentMethod.id)).filter(
                PaymentMethod.tenant_id == tenant_id
            ).scalar() or 0
            
            active_methods = self.db.query(func.count(PaymentMethod.id)).filter(
                PaymentMethod.tenant_id == tenant_id,
                PaymentMethod.is_active == True
            ).scalar() or 0
            
            inactive_methods = total_methods - active_methods
            
            methods_with_fees = self.db.query(func.count(PaymentMethod.id)).filter(
                PaymentMethod.tenant_id == tenant_id,
                PaymentMethod.has_fees == True,
                PaymentMethod.is_active == True
            ).scalar() or 0
            
            # TODO: Implementar estatísticas de uso quando houver relação com Payment
            most_used_method = None
            total_transactions = 0
            total_volume = 0
            
            return PaymentMethodStats(
                total_methods=total_methods,
                active_methods=active_methods,
                inactive_methods=inactive_methods,
                methods_with_fees=methods_with_fees,
                most_used_method=most_used_method,
                total_transactions=total_transactions,
                total_volume=total_volume
            )
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {e}")
            raise
    
    def setup_default_payment_methods(self, tenant_id: int, current_user: User) -> List[PaymentMethod]:
        """Cria métodos de pagamento padrão para um tenant"""
        try:
            # Verificar se já existem métodos
            existing_count = self.db.query(func.count(PaymentMethod.id)).filter(
                PaymentMethod.tenant_id == tenant_id
            ).scalar()
            
            if existing_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tenant já possui métodos de pagamento configurados"
                )
            
            # Criar métodos padrão
            default_methods = PaymentMethod.create_default_methods(self.db, tenant_id)
            
            # Registrar auditoria para cada método criado
            for method in default_methods:
                # Preparar new_values com os dados do método criado
                new_values = {
                    'name': method.name,
                    'code': method.code,
                    'description': method.description,
                    'display_order': method.display_order,
                    'icon': method.icon,
                    'color': method.color,
                    'is_active': method.is_active,
                    'requires_reference': method.requires_reference,
                    'has_fees': method.has_fees,
                    'default_fee_rate': float(method.default_fee_rate) if method.default_fee_rate else None,
                    'settings': method.settings,
                    'validation_rules': method.validation_rules
                }
                
                self.audit_service.log_create(
                    table_name="payment_methods",
                    record_id=method.id,
                    new_values=new_values,
                    user=current_user,
                    request=None,
                    description=f"Método de pagamento padrão '{method.name}' criado automaticamente"
                )
            
            self.db.commit()
            logger.info(f"Métodos de pagamento padrão criados para tenant {tenant_id}")
            
            return default_methods
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar métodos padrão: {e}")
            raise