# app/services/payment_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, desc, asc
from fastapi import Request, HTTPException, status
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.models.payment import Payment
from app.models.reservation import Reservation
from app.models.guest import Guest
from app.models.property import Property
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate, PaymentUpdate, PaymentStatusUpdate, PaymentFilters,
    PaymentResponse, PaymentWithReservation, ReservationPaymentSummary,
    PaymentReport, PaymentBulkOperation, PaymentConfirmedUpdate
)
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext


class PaymentService:
    """Serviço para operações com pagamentos"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_payment_by_id(self, payment_id: int, tenant_id: int) -> Optional[Payment]:
        """Busca pagamento por ID dentro do tenant"""
        return self.db.query(Payment).options(
            joinedload(Payment.reservation).joinedload(Reservation.guest),
            joinedload(Payment.reservation).joinedload(Reservation.property_obj)
        ).filter(
            Payment.id == payment_id,
            Payment.tenant_id == tenant_id,
            Payment.is_active == True
        ).first()

    def get_payment_by_number(self, payment_number: str, tenant_id: int) -> Optional[Payment]:
        """Busca pagamento por número dentro do tenant"""
        return self.db.query(Payment).options(
            joinedload(Payment.reservation).joinedload(Reservation.guest),
            joinedload(Payment.reservation).joinedload(Reservation.property_obj)
        ).filter(
            Payment.payment_number == payment_number,
            Payment.tenant_id == tenant_id,
            Payment.is_active == True
        ).first()

    def _validate_admin_permission(self, current_user: User, operation: str) -> None:
        """Valida se o usuário tem permissão de administrador para operações sensíveis"""
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Apenas administradores podem {operation} pagamentos confirmados"
            )

    def _log_sensitive_operation(
        self, 
        payment_obj: Payment, 
        operation: str, 
        reason: str, 
        current_user: User, 
        request: Optional[Request]
    ) -> None:
        """Log detalhado para operações sensíveis em pagamentos confirmados"""
        import json
        
        operation_details = {
            "payment_id": payment_obj.id,
            "payment_number": payment_obj.payment_number,
            "reservation_id": payment_obj.reservation_id,
            "amount": float(payment_obj.amount),
            "operation": operation,
            "reason": reason,
            "user_id": current_user.id,
            "user_email": current_user.email,
            "timestamp": datetime.utcnow().isoformat(),
            "ip_address": request.client.host if request else None,
            "user_agent": request.headers.get("user-agent") if request else None
        }
        
        # Adicionar às notas internas do pagamento
        timestamp = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
        new_note = f"[{timestamp}] {operation.upper()} ADMINISTRATIVO por {current_user.email}: {reason}"
        
        current_notes = payment_obj.internal_notes or ""
        payment_obj.internal_notes = f"{current_notes}\n{new_note}".strip()

    def create_payment(
        self, 
        payment_data: PaymentCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Payment]:
        """Cria novo pagamento - SEMPRE CONFIRMADO AUTOMATICAMENTE"""
        
        # Verificar se a reserva existe e pertence ao tenant
        reservation = self.db.query(Reservation).filter(
            Reservation.id == payment_data.reservation_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Gerar número do pagamento
        payment_number = Payment.generate_payment_number(tenant_id, self.db)
        
        # Calcular valor líquido se taxa foi informada
        net_amount = None
        if payment_data.fee_amount:
            net_amount = payment_data.amount - payment_data.fee_amount
        
        # Criar pagamento SEMPRE CONFIRMADO
        payment_obj = Payment(
            tenant_id=tenant_id,
            reservation_id=payment_data.reservation_id,
            payment_number=payment_number,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method.value,  # Convert enum to string
            payment_date=payment_data.payment_date,
            reference_number=payment_data.reference_number,
            notes=payment_data.notes,
            internal_notes=payment_data.internal_notes,
            fee_amount=payment_data.fee_amount,
            net_amount=net_amount,
            is_partial=payment_data.is_partial,
            status="confirmed",  # ✅ SEMPRE CONFIRMADO
            confirmed_date=datetime.utcnow()  # ✅ DATA DE CONFIRMAÇÃO AUTOMÁTICA
        )
        
        try:
            self.db.add(payment_obj)
            self.db.commit()
            self.db.refresh(payment_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(payment_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_create(
                    "payments", 
                    payment_obj.id,
                    new_values,
                    f"Pagamento criado e confirmado automaticamente para reserva '{reservation.reservation_number}' - {payment_obj.payment_method_display} R$ {payment_obj.amount}"
                )
            
            return payment_obj
            
        except IntegrityError:
            self.db.rollback()
            return None

    def update_payment(
        self, 
        payment_id: int, 
        payment_data: PaymentUpdate, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Payment]:
        """Atualiza pagamento - PERMITE edição de pagamentos confirmados com validações"""
        
        payment_obj = self.get_payment_by_id(payment_id, tenant_id)
        if not payment_obj:
            return None
        
        old_values = _extract_model_data(payment_obj)
        old_status = payment_obj.status
        
        # ✅ NOVA LÓGICA: Permitir edição de pagamentos confirmados com validações
        if payment_obj.status in ["confirmed", "refunded"]:
            # Validar permissão de administrador
            self._validate_admin_permission(current_user, "editar")
            
            # Se é uma edição de pagamento confirmado, verificar se há justificativa
            if hasattr(payment_data, 'admin_reason') and payment_data.admin_reason:
                # Log da operação sensível
                self._log_sensitive_operation(
                    payment_obj, 
                    "EDIÇÃO", 
                    payment_data.admin_reason, 
                    current_user, 
                    request
                )
            else:
                # Se não tem justificativa, adicionar nota padrão
                self._log_sensitive_operation(
                    payment_obj, 
                    "EDIÇÃO", 
                    "Edição administrativa sem justificativa específica", 
                    current_user, 
                    request
                )
        
        # Atualizar campos se fornecidos
        if payment_data.amount is not None:
            payment_obj.amount = payment_data.amount
        if payment_data.payment_method is not None:
            payment_obj.payment_method = payment_data.payment_method.value  # Convert enum to string
        if payment_data.payment_date is not None:
            payment_obj.payment_date = payment_data.payment_date
        if payment_data.reference_number is not None:
            payment_obj.reference_number = payment_data.reference_number
        if payment_data.notes is not None:
            payment_obj.notes = payment_data.notes
        if payment_data.internal_notes is not None:
            payment_obj.internal_notes = payment_data.internal_notes
        if payment_data.fee_amount is not None:
            payment_obj.fee_amount = payment_data.fee_amount
            # Recalcular valor líquido
            payment_obj.net_amount = payment_obj.amount - payment_data.fee_amount
        if payment_data.is_partial is not None:
            payment_obj.is_partial = payment_data.is_partial
        
        try:
            self.db.commit()
            self.db.refresh(payment_obj)
            
            # Registrar auditoria detalhada
            new_values = _extract_model_data(payment_obj)
            audit_message = f"Pagamento atualizado - {payment_obj.payment_number}"
            
            if old_status in ["confirmed", "refunded"]:
                audit_message += f" [EDIÇÃO ADMINISTRATIVA por {current_user.email}]"
            
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "payments", 
                    payment_obj.id, 
                    old_values, 
                    new_values,
                    audit_message
                )
            
            return payment_obj
            
        except IntegrityError:
            self.db.rollback()
            return None

    def update_confirmed_payment(
        self, 
        payment_id: int, 
        payment_data: PaymentConfirmedUpdate, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Payment]:
        """Método específico para atualização de pagamentos confirmados com justificativa obrigatória"""
        
        payment_obj = self.get_payment_by_id(payment_id, tenant_id)
        if not payment_obj:
            return None
        
        # Validar que o pagamento está confirmado
        if payment_obj.status != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este método é apenas para pagamentos confirmados"
            )
        
        # Validar permissão de administrador
        self._validate_admin_permission(current_user, "editar")
        
        # Justificativa é obrigatória
        if not payment_data.admin_reason or len(payment_data.admin_reason.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Justificativa detalhada (mínimo 10 caracteres) é obrigatória para editar pagamentos confirmados"
            )
        
        old_values = _extract_model_data(payment_obj)
        
        # Log da operação sensível
        self._log_sensitive_operation(
            payment_obj, 
            "EDIÇÃO CONFIRMADO", 
            payment_data.admin_reason, 
            current_user, 
            request
        )
        
        # Atualizar campos permitidos
        if payment_data.amount is not None:
            payment_obj.amount = payment_data.amount
        if payment_data.payment_method is not None:
            payment_obj.payment_method = payment_data.payment_method.value
        if payment_data.payment_date is not None:
            payment_obj.payment_date = payment_data.payment_date
        if payment_data.reference_number is not None:
            payment_obj.reference_number = payment_data.reference_number
        if payment_data.notes is not None:
            payment_obj.notes = payment_data.notes
        if payment_data.fee_amount is not None:
            payment_obj.fee_amount = payment_data.fee_amount
            payment_obj.net_amount = payment_obj.amount - payment_data.fee_amount
        if payment_data.is_partial is not None:
            payment_obj.is_partial = payment_data.is_partial
        
        try:
            self.db.commit()
            self.db.refresh(payment_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(payment_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "payments", 
                    payment_obj.id, 
                    old_values, 
                    new_values,
                    f"EDIÇÃO ADMINISTRATIVA de pagamento confirmado - {payment_obj.payment_number} por {current_user.email}. Motivo: {payment_data.admin_reason}"
                )
            
            return payment_obj
            
        except IntegrityError:
            self.db.rollback()
            return None

    def update_payment_status(
        self, 
        payment_id: int, 
        status_data: PaymentStatusUpdate, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Payment]:
        """Atualiza status do pagamento"""
        
        payment_obj = self.get_payment_by_id(payment_id, tenant_id)
        if not payment_obj:
            return None
        
        old_values = _extract_model_data(payment_obj)
        old_status = payment_obj.status
        
        # Atualizar status
        payment_obj.status = status_data.status
        
        # Se confirmando, definir data de confirmação
        if status_data.status == "confirmed" and not payment_obj.confirmed_date:
            payment_obj.confirmed_date = status_data.confirmed_date or datetime.utcnow()
        
        # Adicionar observações se fornecidas
        if status_data.notes:
            current_notes = payment_obj.internal_notes or ""
            timestamp = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
            new_note = f"[{timestamp}] Status alterado de '{old_status}' para '{status_data.status}': {status_data.notes}"
            payment_obj.internal_notes = f"{current_notes}\n{new_note}".strip()
        
        try:
            self.db.commit()
            self.db.refresh(payment_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(payment_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "payments", 
                    payment_obj.id, 
                    old_values, 
                    new_values,
                    f"Status do pagamento alterado de '{old_status}' para '{status_data.status}'"
                )
            
            return payment_obj
            
        except Exception:
            self.db.rollback()
            return None

    def get_payments(
        self, 
        tenant_id: int, 
        filters: Optional[PaymentFilters] = None,
        page: int = 1, 
        per_page: int = 50,
        order_by: str = "payment_date",
        order_direction: str = "desc"
    ) -> Tuple[List[Payment], int]:
        """Busca pagamentos com filtros e paginação"""
        
        query = self.db.query(Payment).options(
            joinedload(Payment.reservation).joinedload(Reservation.guest),
            joinedload(Payment.reservation).joinedload(Reservation.property_obj)
        ).filter(
            Payment.tenant_id == tenant_id,
            Payment.is_active == True
        )
        
        # Aplicar filtros
        if filters:
            if filters.reservation_id:
                query = query.filter(Payment.reservation_id == filters.reservation_id)
            
            if filters.status:
                query = query.filter(Payment.status == filters.status)
            
            if filters.payment_method:
                query = query.filter(Payment.payment_method == filters.payment_method)
            
            if filters.payment_date_from:
                query = query.filter(func.date(Payment.payment_date) >= filters.payment_date_from)
            
            if filters.payment_date_to:
                query = query.filter(func.date(Payment.payment_date) <= filters.payment_date_to)
            
            if filters.confirmed_date_from:
                query = query.filter(func.date(Payment.confirmed_date) >= filters.confirmed_date_from)
            
            if filters.confirmed_date_to:
                query = query.filter(func.date(Payment.confirmed_date) <= filters.confirmed_date_to)
            
            if filters.min_amount:
                query = query.filter(Payment.amount >= filters.min_amount)
            
            if filters.max_amount:
                query = query.filter(Payment.amount <= filters.max_amount)
            
            if filters.is_partial is not None:
                query = query.filter(Payment.is_partial == filters.is_partial)
            
            if filters.is_refund is not None:
                query = query.filter(Payment.is_refund == filters.is_refund)
            
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Payment.payment_number.ilike(search_term),
                        Payment.reference_number.ilike(search_term),
                        Payment.notes.ilike(search_term)
                    )
                )
        
        # Ordenação
        if order_direction == "desc":
            order_clause = desc(getattr(Payment, order_by, Payment.payment_date))
        else:
            order_clause = asc(getattr(Payment, order_by, Payment.payment_date))
        
        query = query.order_by(order_clause)
        
        # Contar total
        total = query.count()
        
        # Aplicar paginação
        offset = (page - 1) * per_page
        payments = query.offset(offset).limit(per_page).all()
        
        return payments, total

    def get_reservation_payment_summary(
        self, 
        reservation_id: int, 
        tenant_id: int
    ) -> Optional[ReservationPaymentSummary]:
        """Busca resumo de pagamentos de uma reserva"""
        
        reservation = self.db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        ).first()
        
        if not reservation:
            return None
        
        # Buscar todos os pagamentos da reserva
        payments = self.db.query(Payment).filter(
            Payment.reservation_id == reservation_id,
            Payment.tenant_id == tenant_id,
            Payment.is_active == True
        ).order_by(desc(Payment.payment_date)).all()
        
        # Calcular totais
        total_paid = sum(p.amount for p in payments if p.status == "confirmed" and not p.is_refund)
        total_refunded = sum(p.amount for p in payments if p.status == "confirmed" and p.is_refund)
        balance_due = reservation.balance_due
        
        # Data do último pagamento
        last_payment_date = None
        confirmed_payments = [p for p in payments if p.status == "confirmed"]
        if confirmed_payments:
            last_payment_date = max(p.payment_date for p in confirmed_payments)
        
        return ReservationPaymentSummary(
            reservation_id=reservation_id,
            reservation_number=reservation.reservation_number,
            total_amount=reservation.total_amount or Decimal('0'),
            total_paid=total_paid,
            total_refunded=total_refunded,
            balance_due=balance_due,
            payment_count=len(payments),
            last_payment_date=last_payment_date,
            payments=[PaymentResponse.model_validate(p) for p in payments]
        )

    def get_payment_report(
        self, 
        tenant_id: int, 
        start_date: date, 
        end_date: date
    ) -> PaymentReport:
        """Gera relatório de pagamentos por período"""
        
        # Buscar pagamentos do período
        payments = self.db.query(Payment).filter(
            Payment.tenant_id == tenant_id,
            Payment.is_active == True,
            func.date(Payment.payment_date) >= start_date,
            func.date(Payment.payment_date) <= end_date,
            Payment.status == "confirmed"
        ).all()
        
        # Calcular totais
        total_received = sum(p.amount for p in payments if not p.is_refund)
        total_refunded = sum(p.amount for p in payments if p.is_refund)
        net_received = total_received - total_refunded
        payment_count = len([p for p in payments if not p.is_refund])
        refund_count = len([p for p in payments if p.is_refund])
        
        # Agrupar por método de pagamento
        payments_by_method = {}
        for payment in payments:
            method = payment.payment_method
            if method not in payments_by_method:
                payments_by_method[method] = {"count": 0, "amount": Decimal('0')}
            
            payments_by_method[method]["count"] += 1
            if payment.is_refund:
                payments_by_method[method]["amount"] -= payment.amount
            else:
                payments_by_method[method]["amount"] += payment.amount
        
        # Agrupar por status
        payments_by_status = {}
        for payment in payments:
            status = payment.status
            if status not in payments_by_status:
                payments_by_status[status] = {"count": 0, "amount": Decimal('0')}
            
            payments_by_status[status]["count"] += 1
            payments_by_status[status]["amount"] += payment.amount
        
        # Totais diários
        daily_totals = []
        current_date = start_date
        while current_date <= end_date:
            daily_payments = [
                p for p in payments 
                if p.payment_date.date() == current_date
            ]
            
            daily_amount = sum(
                p.amount if not p.is_refund else -p.amount 
                for p in daily_payments
            )
            
            daily_totals.append({
                "date": current_date.isoformat(),
                "amount": float(daily_amount),
                "count": len(daily_payments)
            })
            
            current_date += timedelta(days=1)
        
        return PaymentReport(
            period_start=start_date,
            period_end=end_date,
            total_received=total_received,
            total_refunded=total_refunded,
            net_received=net_received,
            payment_count=payment_count,
            refund_count=refund_count,
            payments_by_method={k: {**v, "amount": float(v["amount"])} for k, v in payments_by_method.items()},
            payments_by_status={k: {**v, "amount": float(v["amount"])} for k, v in payments_by_status.items()},
            daily_totals=daily_totals
        )

    def delete_payment(
        self, 
        payment_id: int, 
        tenant_id: int,
        current_user: User,
        admin_reason: Optional[str] = None,
        request: Optional[Request] = None
    ) -> bool:
        """Marca pagamento como inativo (soft delete) - PERMITE exclusão de pagamentos confirmados"""
        
        payment_obj = self.get_payment_by_id(payment_id, tenant_id)
        if not payment_obj:
            return False
        
        # ✅ NOVA LÓGICA: Permitir exclusão de pagamentos confirmados com validações
        if payment_obj.status == "confirmed":
            # Validar permissão de administrador
            self._validate_admin_permission(current_user, "excluir")
            
            # Justificativa é obrigatória para exclusão de pagamentos confirmados
            if not admin_reason or len(admin_reason.strip()) < 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Justificativa detalhada (mínimo 10 caracteres) é obrigatória para excluir pagamentos confirmados"
                )
            
            # Log da operação sensível
            self._log_sensitive_operation(
                payment_obj, 
                "EXCLUSÃO", 
                admin_reason, 
                current_user, 
                request
            )
        
        old_values = _extract_model_data(payment_obj)
        payment_obj.is_active = False
        
        try:
            self.db.commit()
            
            # Registrar auditoria detalhada
            audit_message = f"Pagamento excluído - {payment_obj.payment_number}"
            
            if payment_obj.status == "confirmed":
                audit_message += f" [EXCLUSÃO ADMINISTRATIVA por {current_user.email}. Motivo: {admin_reason}]"
            
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_delete(
                    "payments", 
                    payment_obj.id, 
                    old_values,
                    audit_message
                )
            
            return True
            
        except Exception:
            self.db.rollback()
            return False