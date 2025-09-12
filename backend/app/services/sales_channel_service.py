# backend/app/services/sales_channel_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc, asc
from fastapi import HTTPException, status
from datetime import datetime
import logging
import json
import requests
from decimal import Decimal

from app.models.sales_channel import SalesChannel
from app.models.user import User
from app.schemas.sales_channel import (
    SalesChannelCreate, SalesChannelUpdate, SalesChannelFilters,
    SalesChannelResponse, SalesChannelStats, SalesChannelUsage,
    SalesChannelBulkOperation, SalesChannelOrderUpdate, SalesChannelCommission,
    SalesChannelTestConnection, SalesChannelTestResult
)
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class SalesChannelService:
    """Serviço para operações com canais de venda"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)
    
    def get_sales_channel_by_id(self, sales_channel_id: int, tenant_id: int) -> Optional[SalesChannel]:
        """Busca canal de venda por ID dentro do tenant"""
        return self.db.query(SalesChannel).filter(
            SalesChannel.id == sales_channel_id,
            SalesChannel.tenant_id == tenant_id
        ).first()
    
    def get_sales_channel_by_code(self, code: str, tenant_id: int) -> Optional[SalesChannel]:
        """Busca canal de venda por código dentro do tenant"""
        return self.db.query(SalesChannel).filter(
            SalesChannel.code == code,
            SalesChannel.tenant_id == tenant_id
        ).first()
    
    def get_sales_channels(
        self,
        tenant_id: int,
        filters: SalesChannelFilters,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[SalesChannel], int]:
        """Lista canais de venda com filtros e paginação"""
        query = self.db.query(SalesChannel).filter(SalesChannel.tenant_id == tenant_id)
        
        # Aplicar filtros
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    SalesChannel.name.ilike(search_term),
                    SalesChannel.code.ilike(search_term),
                    SalesChannel.description.ilike(search_term)
                )
            )
        
        if filters.is_active is not None:
            query = query.filter(SalesChannel.is_active == filters.is_active)
        
        if filters.is_external is not None:
            query = query.filter(SalesChannel.is_external == filters.is_external)
        
        if filters.channel_type:
            query = query.filter(SalesChannel.channel_type == filters.channel_type)
        
        if filters.has_api_integration is not None:
            query = query.filter(SalesChannel.has_api_integration == filters.has_api_integration)
        
        if filters.requires_commission is not None:
            if filters.requires_commission:
                query = query.filter(
                    and_(
                        SalesChannel.commission_rate.is_not(None),
                        SalesChannel.commission_rate > 0
                    )
                )
            else:
                query = query.filter(
                    or_(
                        SalesChannel.commission_rate.is_(None),
                        SalesChannel.commission_rate == 0
                    )
                )
        
        if filters.code_list:
            query = query.filter(SalesChannel.code.in_(filters.code_list))
        
        # Total de registros
        total = query.count()
        
        # Ordenação e paginação
        query = query.order_by(SalesChannel.display_order, SalesChannel.name)
        
        if per_page > 0:
            offset = (page - 1) * per_page
            query = query.offset(offset).limit(per_page)
        
        sales_channels = query.all()
        return sales_channels, total
    
    def get_active_sales_channels(self, tenant_id: int) -> List[SalesChannel]:
        """Obtém todos os canais ativos ordenados"""
        return SalesChannel.get_active_channels(self.db, tenant_id)
    
    def get_external_channels(self, tenant_id: int) -> List[SalesChannel]:
        """Obtém apenas canais externos (OTAs)"""
        return SalesChannel.get_external_channels(self.db, tenant_id)
    
    def create_sales_channel(
        self, 
        sales_channel_data: SalesChannelCreate, 
        tenant_id: int,
        current_user: User
    ) -> SalesChannel:
        """Cria novo canal de venda"""
        try:
            # Verificar se código já existe
            existing = self.get_sales_channel_by_code(sales_channel_data.code, tenant_id)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Já existe um canal com o código '{sales_channel_data.code}'"
                )
            
            # Verificar se nome já existe
            existing_name = self.db.query(SalesChannel).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.name == sales_channel_data.name
            ).first()
            if existing_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Já existe um canal com o nome '{sales_channel_data.name}'"
                )
            
            # Preparar dados (remover credenciais para processamento separado)
            channel_data = sales_channel_data.model_dump()
            credentials = channel_data.pop('credentials', None)
            
            # Criar canal de venda
            sales_channel = SalesChannel(
                tenant_id=tenant_id,
                **channel_data
            )
            
            # Processar credenciais se fornecidas
            if credentials:
                # TODO: Implementar criptografia das credenciais
                sales_channel.credentials = credentials
            
            self.db.add(sales_channel)
            self.db.flush()  # Para obter o ID
            
            # Registrar auditoria (sem incluir credenciais)
            audit_data = sales_channel_data.model_dump()
            if 'credentials' in audit_data:
                audit_data['credentials'] = '***OMITIDO***'
            
            self.audit_service.log_action(
                table_name="sales_channels",
                record_id=sales_channel.id,
                action="CREATE",
                user_id=current_user.id,
                tenant_id=tenant_id,
                description=f"Canal de venda '{sales_channel.name}' criado",
                new_values=audit_data
            )
            
            self.db.commit()
            logger.info(f"Canal de venda {sales_channel.id} criado por usuário {current_user.id}")
            
            return sales_channel
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao criar canal de venda: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade: código ou nome já existem"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar canal de venda: {e}")
            raise
    
    def update_sales_channel(
        self,
        sales_channel_id: int,
        sales_channel_data: SalesChannelUpdate,
        tenant_id: int,
        current_user: User
    ) -> SalesChannel:
        """Atualiza canal de venda"""
        try:
            sales_channel = self.get_sales_channel_by_id(sales_channel_id, tenant_id)
            if not sales_channel:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Canal de venda não encontrado"
                )
            
            # Capturar valores originais para auditoria
            old_values = {
                "name": sales_channel.name,
                "code": sales_channel.code,
                "description": sales_channel.description,
                "display_order": sales_channel.display_order,
                "icon": sales_channel.icon,
                "color": sales_channel.color,
                "channel_type": sales_channel.channel_type,
                "is_external": sales_channel.is_external,
                "is_active": sales_channel.is_active,
                "commission_rate": float(sales_channel.commission_rate) if sales_channel.commission_rate else None,
                "commission_type": sales_channel.commission_type,
                "base_fee": float(sales_channel.base_fee) if sales_channel.base_fee else None,
                "has_api_integration": sales_channel.has_api_integration,
                "webhook_url": sales_channel.webhook_url,
                "settings": sales_channel.settings,
                "business_rules": sales_channel.business_rules,
                "external_id": sales_channel.external_id
            }
            
            # Verificar conflitos se código for alterado
            update_data = sales_channel_data.model_dump(exclude_unset=True)
            if 'code' in update_data and update_data['code'] != sales_channel.code:
                existing = self.get_sales_channel_by_code(update_data['code'], tenant_id)
                if existing and existing.id != sales_channel.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Já existe um canal com o código '{update_data['code']}'"
                    )
            
            # Verificar conflitos se nome for alterado
            if 'name' in update_data and update_data['name'] != sales_channel.name:
                existing_name = self.db.query(SalesChannel).filter(
                    SalesChannel.tenant_id == tenant_id,
                    SalesChannel.name == update_data['name'],
                    SalesChannel.id != sales_channel.id
                ).first()
                if existing_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Já existe um canal com o nome '{update_data['name']}'"
                    )
            
            # Processar credenciais separadamente
            credentials = update_data.pop('credentials', None)
            if credentials:
                # TODO: Implementar criptografia das credenciais
                sales_channel.credentials = credentials
            
            # Aplicar atualizações
            for field, value in update_data.items():
                setattr(sales_channel, field, value)
            
            self.db.flush()
            
            # Registrar auditoria (sem incluir credenciais)
            audit_update_data = update_data.copy()
            if credentials:
                audit_update_data['credentials'] = '***ATUALIZADO***'
            
            self.audit_service.log_action(
                table_name="sales_channels",
                record_id=sales_channel.id,
                action="UPDATE",
                user_id=current_user.id,
                tenant_id=tenant_id,
                description=f"Canal de venda '{sales_channel.name}' atualizado",
                old_values=old_values,
                new_values=audit_update_data
            )
            
            self.db.commit()
            logger.info(f"Canal de venda {sales_channel.id} atualizado por usuário {current_user.id}")
            
            return sales_channel
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Erro de integridade ao atualizar canal de venda: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade: código ou nome já existem"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar canal de venda: {e}")
            raise
    
    def delete_sales_channel(
        self, 
        sales_channel_id: int, 
        tenant_id: int,
        current_user: User
    ) -> bool:
        """Exclui canal de venda (soft delete)"""
        try:
            sales_channel = self.get_sales_channel_by_id(sales_channel_id, tenant_id)
            if not sales_channel:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Canal de venda não encontrado"
                )
            
            # Verificar se canal está sendo usado
            # TODO: Implementar verificação de uso em reservas
            
            # Soft delete
            sales_channel.is_active = False
            self.db.flush()
            
            # Registrar auditoria
            self.audit_service.log_action(
                table_name="sales_channels",
                record_id=sales_channel.id,
                action="DELETE",
                user_id=current_user.id,
                tenant_id=tenant_id,
                description=f"Canal de venda '{sales_channel.name}' desativado",
                old_values={"is_active": True},
                new_values={"is_active": False}
            )
            
            self.db.commit()
            logger.info(f"Canal de venda {sales_channel.id} desativado por usuário {current_user.id}")
            
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao excluir canal de venda: {e}")
            raise
    
    def bulk_operation(
        self,
        operation_data: SalesChannelBulkOperation,
        tenant_id: int,
        current_user: User
    ) -> Dict[str, Any]:
        """Operação em massa nos canais de venda"""
        try:
            sales_channels = self.db.query(SalesChannel).filter(
                SalesChannel.id.in_(operation_data.sales_channel_ids),
                SalesChannel.tenant_id == tenant_id
            ).all()
            
            if not sales_channels:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Nenhum canal de venda encontrado"
                )
            
            results = []
            
            for sales_channel in sales_channels:
                try:
                    old_active = sales_channel.is_active
                    
                    if operation_data.operation == "activate":
                        sales_channel.is_active = True
                    elif operation_data.operation == "deactivate":
                        sales_channel.is_active = False
                    elif operation_data.operation == "delete":
                        sales_channel.is_active = False
                    
                    # Registrar auditoria se houve mudança
                    if old_active != sales_channel.is_active:
                        self.audit_service.log_action(
                            table_name="sales_channels",
                            record_id=sales_channel.id,
                            action=operation_data.operation.upper(),
                            user_id=current_user.id,
                            tenant_id=tenant_id,
                            description=f"Operação em massa '{operation_data.operation}' no canal '{sales_channel.name}'",
                            old_values={"is_active": old_active},
                            new_values={"is_active": sales_channel.is_active}
                        )
                    
                    results.append({
                        "id": sales_channel.id,
                        "name": sales_channel.name,
                        "success": True
                    })
                    
                except Exception as e:
                    results.append({
                        "id": sales_channel.id,
                        "name": sales_channel.name,
                        "success": False,
                        "error": str(e)
                    })
            
            self.db.commit()
            logger.info(f"Operação em massa '{operation_data.operation}' executada por usuário {current_user.id}")
            
            return {
                "operation": operation_data.operation,
                "total_requested": len(operation_data.sales_channel_ids),
                "total_processed": len([r for r in results if r["success"]]),
                "results": results
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro em operação em massa: {e}")
            raise
    
    def update_display_order(
        self,
        order_data: SalesChannelOrderUpdate,
        tenant_id: int,
        current_user: User
    ) -> List[SalesChannel]:
        """Atualiza ordem de exibição dos canais"""
        try:
            updated_channels = []
            
            for order_item in order_data.sales_channel_orders:
                sales_channel = self.get_sales_channel_by_id(order_item["id"], tenant_id)
                if sales_channel:
                    old_order = sales_channel.display_order
                    sales_channel.display_order = order_item["display_order"]
                    
                    # Registrar auditoria
                    self.audit_service.log_action(
                        table_name="sales_channels",
                        record_id=sales_channel.id,
                        action="UPDATE",
                        user_id=current_user.id,
                        tenant_id=tenant_id,
                        description=f"Ordem de exibição do canal '{sales_channel.name}' alterada",
                        old_values={"display_order": old_order},
                        new_values={"display_order": sales_channel.display_order}
                    )
                    
                    updated_channels.append(sales_channel)
            
            self.db.commit()
            logger.info(f"Ordem de exibição atualizada por usuário {current_user.id}")
            
            return updated_channels
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao atualizar ordem de exibição: {e}")
            raise
    
    def calculate_commission(
        self,
        sales_channel_id: int,
        tenant_id: int,
        base_amount: Decimal
    ) -> SalesChannelCommission:
        """Calcula comissão para um valor específico"""
        sales_channel = self.get_sales_channel_by_id(sales_channel_id, tenant_id)
        if not sales_channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Canal de venda não encontrado"
            )
        
        commission = sales_channel.calculate_commission(float(base_amount))
        net_amount = float(base_amount) - commission
        
        return SalesChannelCommission(
            channel_id=sales_channel.id,
            channel_name=sales_channel.name,
            base_amount=base_amount,
            commission_rate=sales_channel.commission_rate,
            commission_type=sales_channel.commission_type,
            base_fee=sales_channel.base_fee,
            calculated_commission=Decimal(str(commission)),
            net_amount=Decimal(str(net_amount))
        )
    
    def test_channel_connection(
        self,
        test_data: SalesChannelTestConnection,
        tenant_id: int
    ) -> SalesChannelTestResult:
        """Testa conexão com canal externo"""
        sales_channel = self.get_sales_channel_by_id(test_data.channel_id, tenant_id)
        if not sales_channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Canal de venda não encontrado"
            )
        
        start_time = datetime.utcnow()
        success = False
        message = ""
        error_details = None
        response_time = None
        
        try:
            if test_data.test_type == "webhook" and sales_channel.webhook_url:
                # Testar webhook
                response = requests.post(
                    sales_channel.webhook_url,
                    json={"test": True, "channel": sales_channel.code},
                    timeout=10
                )
                response_time = (datetime.utcnow() - start_time).total_seconds()
                success = response.status_code < 400
                message = f"Webhook respondeu com status {response.status_code}"
                
            elif test_data.test_type == "api" and sales_channel.has_api_integration:
                # Testar API (implementação específica por canal)
                # TODO: Implementar testes específicos por tipo de canal
                success = False
                message = "Teste de API não implementado para este canal"
                
            elif test_data.test_type == "credentials":
                # Testar credenciais
                success = bool(sales_channel.credentials)
                message = "Credenciais presentes" if success else "Credenciais não configuradas"
                
            else:
                success = False
                message = f"Tipo de teste '{test_data.test_type}' não suportado para este canal"
                
        except requests.RequestException as e:
            response_time = (datetime.utcnow() - start_time).total_seconds()
            success = False
            message = f"Erro de conexão: {str(e)}"
            error_details = {"error_type": "connection", "details": str(e)}
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds()
            success = False
            message = f"Erro interno: {str(e)}"
            error_details = {"error_type": "internal", "details": str(e)}
        
        return SalesChannelTestResult(
            channel_id=sales_channel.id,
            channel_name=sales_channel.name,
            test_type=test_data.test_type,
            success=success,
            message=message,
            response_time=response_time,
            error_details=error_details,
            tested_at=datetime.utcnow()
        )
    
    def get_sales_channel_stats(self, tenant_id: int) -> SalesChannelStats:
        """Obtém estatísticas dos canais de venda"""
        try:
            # Estatísticas básicas
            total_channels = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id
            ).scalar() or 0
            
            active_channels = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.is_active == True
            ).scalar() or 0
            
            inactive_channels = total_channels - active_channels
            
            external_channels = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.is_external == True,
                SalesChannel.is_active == True
            ).scalar() or 0
            
            channels_with_integration = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.has_api_integration == True,
                SalesChannel.is_active == True
            ).scalar() or 0
            
            channels_with_commission = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.commission_rate.is_not(None),
                SalesChannel.commission_rate > 0,
                SalesChannel.is_active == True
            ).scalar() or 0
            
            # Média de taxa de comissão
            avg_commission = self.db.query(func.avg(SalesChannel.commission_rate)).filter(
                SalesChannel.tenant_id == tenant_id,
                SalesChannel.commission_rate.is_not(None),
                SalesChannel.commission_rate > 0,
                SalesChannel.is_active == True
            ).scalar()
            
            # TODO: Implementar estatísticas de uso quando houver relação com Reservation
            most_used_channel = None
            total_reservations = 0
            total_revenue = Decimal('0')
            
            return SalesChannelStats(
                total_channels=total_channels,
                active_channels=active_channels,
                inactive_channels=inactive_channels,
                external_channels=external_channels,
                channels_with_integration=channels_with_integration,
                channels_with_commission=channels_with_commission,
                most_used_channel=most_used_channel,
                total_reservations=total_reservations,
                total_revenue=total_revenue,
                average_commission_rate=avg_commission
            )
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {e}")
            raise
    
    def setup_default_sales_channels(self, tenant_id: int, current_user: User) -> List[SalesChannel]:
        """Cria canais de venda padrão para um tenant"""
        try:
            # Verificar se já existem canais
            existing_count = self.db.query(func.count(SalesChannel.id)).filter(
                SalesChannel.tenant_id == tenant_id
            ).scalar()
            
            if existing_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tenant já possui canais de venda configurados"
                )
            
            # Criar canais padrão
            default_channels = SalesChannel.create_default_channels(self.db, tenant_id)
            
            # Registrar auditoria para cada canal criado
            for channel in default_channels:
                self.audit_service.log_create(
                    table_name="sales_channels",
                    record_id=channel.id,
                    new_values={
                        "name": channel.name,
                        "code": channel.code,
                        "description": channel.description,
                        "channel_type": channel.channel_type,
                        "display_order": channel.display_order
                    },
                    user=current_user,
                    description=f"Canal de venda padrão '{channel.name}' criado automaticamente"
                )
            
            self.db.commit()
            logger.info(f"Canais de venda padrão criados para tenant {tenant_id}")
            
            return default_channels
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar canais padrão: {e}")
            raise