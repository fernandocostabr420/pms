# app/api/v1/endpoints/payments.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Body
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.core.database import get_db
from app.services.payment_service import PaymentService
from app.schemas.payment import (
    PaymentCreate, PaymentUpdate, PaymentStatusUpdate, PaymentFilters,
    PaymentResponse, PaymentWithReservation, PaymentListResponse,
    ReservationPaymentSummary, PaymentReport, PaymentBulkOperation,
    PaymentConfirmedUpdate, PaymentDeleteConfirmed, PaymentPermissions,
    PaymentSecurityWarning, PaymentAdminStats
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    request: Request,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria novo pagamento"""
    payment_service = PaymentService(db)
    
    payment = payment_service.create_payment(
        payment_data=payment_data,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        request=request
    )
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Erro ao criar pagamento"
        )
    
    return PaymentResponse.model_validate(payment)


@router.get("/", response_model=PaymentListResponse)
def list_payments(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    # Filtros de busca
    reservation_id: Optional[int] = Query(None, description="ID da reserva"),
    status: Optional[str] = Query(None, description="Status do pagamento"),
    payment_method: Optional[str] = Query(None, description="Método de pagamento"),
    payment_date_from: Optional[date] = Query(None, description="Data de pagamento inicial"),
    payment_date_to: Optional[date] = Query(None, description="Data de pagamento final"),
    min_amount: Optional[float] = Query(None, ge=0, description="Valor mínimo"),
    max_amount: Optional[float] = Query(None, ge=0, description="Valor máximo"),
    is_partial: Optional[bool] = Query(None, description="Pagamento parcial"),
    is_refund: Optional[bool] = Query(None, description="É estorno"),
    has_admin_changes: Optional[bool] = Query(None, description="Tem alterações administrativas"),
    search: Optional[str] = Query(None, max_length=100, description="Busca textual"),
    # Paginação e ordenação
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(50, ge=1, le=200, description="Itens por página"),
    order_by: str = Query("payment_date", description="Campo de ordenação"),
    order_direction: str = Query("desc", regex="^(asc|desc)$", description="Direção da ordenação")
):
    """Lista pagamentos com filtros e paginação"""
    payment_service = PaymentService(db)
    
    # Construir filtros
    filters = PaymentFilters(
        reservation_id=reservation_id,
        status=status,
        payment_method=payment_method,
        payment_date_from=payment_date_from,
        payment_date_to=payment_date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        is_partial=is_partial,
        is_refund=is_refund,
        has_admin_changes=has_admin_changes,
        search=search
    )
    
    payments, total = payment_service.get_payments(
        tenant_id=current_user.tenant_id,
        filters=filters,
        page=page,
        per_page=per_page,
        order_by=order_by,
        order_direction=order_direction
    )
    
    # Calcular páginas
    pages = (total + per_page - 1) // per_page
    
    # Converter para response com dados da reserva
    payment_responses = []
    for payment in payments:
        payment_dict = PaymentResponse.model_validate(payment).model_dump()
        
        # Adicionar campos computados
        payment_dict["status_display"] = payment.status_display
        payment_dict["payment_method_display"] = payment.payment_method_display
        
        # Verificar se tem alterações administrativas
        if payment.internal_notes and ("EDIÇÃO ADMINISTRATIVO" in payment.internal_notes or "EXCLUSÃO ADMINISTRATIVO" in payment.internal_notes):
            payment_dict["has_admin_changes"] = True
            
            # Extrair última ação administrativa
            lines = payment.internal_notes.split('\n')
            for line in reversed(lines):
                if "ADMINISTRATIVO" in line:
                    payment_dict["last_admin_action"] = line.strip()
                    break
        
        payment_responses.append(PaymentResponse(**payment_dict))
    
    return PaymentListResponse(
        payments=payment_responses,
        total=total,
        page=page,
        pages=pages,
        per_page=per_page
    )


@router.get("/{payment_id}", response_model=PaymentWithReservation)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca pagamento por ID"""
    payment_service = PaymentService(db)
    
    payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Converter para response com dados da reserva
    payment_dict = PaymentResponse.model_validate(payment).model_dump()
    
    # Adicionar campos computados
    payment_dict["status_display"] = payment.status_display
    payment_dict["payment_method_display"] = payment.payment_method_display
    
    # Verificar alterações administrativas
    if payment.internal_notes and ("EDIÇÃO ADMINISTRATIVO" in payment.internal_notes or "EXCLUSÃO ADMINISTRATIVO" in payment.internal_notes):
        payment_dict["has_admin_changes"] = True
        
        # Extrair última ação administrativa
        lines = payment.internal_notes.split('\n')
        for line in reversed(lines):
            if "ADMINISTRATIVO" in line:
                payment_dict["last_admin_action"] = line.strip()
                break
    
    # Adicionar dados da reserva
    if payment.reservation:
        payment_dict["reservation_number"] = payment.reservation.reservation_number
        payment_dict["check_in_date"] = payment.reservation.check_in_date
        payment_dict["check_out_date"] = payment.reservation.check_out_date
        
        if payment.reservation.guest:
            payment_dict["guest_name"] = payment.reservation.guest.full_name
        
        if payment.reservation.property_obj:
            payment_dict["property_name"] = payment.reservation.property_obj.name
    
    return PaymentWithReservation(**payment_dict)


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza dados do pagamento - PERMITE edição de pagamentos confirmados com validações"""
    payment_service = PaymentService(db)
    
    # Verificar se o pagamento existe e seu status
    existing_payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
    if not existing_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Se for pagamento confirmado, validar permissões e justificativa
    if existing_payment.status in ["confirmed", "refunded"]:
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem editar pagamentos confirmados"
            )
        
        # Se não tem justificativa mas é operação administrativa, sugerir endpoint específico
        if not payment_data.admin_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para editar pagamentos confirmados, use o endpoint /confirmed/{payment_id} com justificativa obrigatória"
            )
    
    payment = payment_service.update_payment(
        payment_id=payment_id,
        payment_data=payment_data,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        request=request
    )
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return PaymentResponse.model_validate(payment)


# NOVO ENDPOINT ESPECÍFICO PARA EDIÇÃO DE PAGAMENTOS CONFIRMADOS
@router.put("/{payment_id}/confirmed", response_model=PaymentResponse)
def update_confirmed_payment(
    payment_id: int,
    payment_data: PaymentConfirmedUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)  # Apenas superuser
):
    """Atualiza pagamento confirmado com justificativa obrigatória (apenas administradores)"""
    payment_service = PaymentService(db)
    
    payment = payment_service.update_confirmed_payment(
        payment_id=payment_id,
        payment_data=payment_data,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        request=request
    )
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return PaymentResponse.model_validate(payment)


@router.patch("/{payment_id}/status", response_model=PaymentResponse)
def update_payment_status(
    payment_id: int,
    status_data: PaymentStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza status do pagamento"""
    payment_service = PaymentService(db)
    
    payment = payment_service.update_payment_status(
        payment_id=payment_id,
        status_data=status_data,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        request=request
    )
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return PaymentResponse.model_validate(payment)


@router.delete("/{payment_id}", response_model=MessageResponse)
def delete_payment(
    payment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    # Para pagamentos confirmados, aceitar justificativa via body
    delete_data: Optional[PaymentDeleteConfirmed] = Body(None)
):
    """Exclui pagamento (soft delete) - PERMITE exclusão de pagamentos confirmados com justificativa"""
    payment_service = PaymentService(db)
    
    # Verificar se o pagamento existe e seu status
    existing_payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
    if not existing_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Se for pagamento confirmado, validar permissões e justificativa
    admin_reason = None
    if existing_payment.status == "confirmed":
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem excluir pagamentos confirmados"
            )
        
        if not delete_data or not delete_data.admin_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Justificativa é obrigatória para excluir pagamentos confirmados. Use o endpoint /confirmed/{payment_id} ou envie a justificativa no body"
            )
        
        admin_reason = delete_data.admin_reason
    
    success = payment_service.delete_payment(
        payment_id=payment_id,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        admin_reason=admin_reason,
        request=request
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return MessageResponse(message="Pagamento excluído com sucesso")


# NOVO ENDPOINT ESPECÍFICO PARA EXCLUSÃO DE PAGAMENTOS CONFIRMADOS
@router.delete("/{payment_id}/confirmed", response_model=MessageResponse)
def delete_confirmed_payment(
    payment_id: int,
    delete_data: PaymentDeleteConfirmed,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)  # Apenas superuser
):
    """Exclui pagamento confirmado com justificativa obrigatória (apenas administradores)"""
    payment_service = PaymentService(db)
    
    success = payment_service.delete_payment(
        payment_id=payment_id,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        admin_reason=delete_data.admin_reason,
        request=request
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return MessageResponse(message="Pagamento confirmado excluído com sucesso")


@router.get("/{payment_id}/permissions", response_model=PaymentPermissions)
def get_payment_permissions(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica permissões do usuário para operações no pagamento"""
    payment_service = PaymentService(db)
    
    payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Definir permissões baseadas no status e no usuário
    permissions = PaymentPermissions(
        can_view=True,
        can_create=True,
        can_edit=True,
        can_edit_confirmed=current_user.is_superuser,
        can_delete=True,
        can_delete_confirmed=current_user.is_superuser,
        can_bulk_operations=current_user.is_superuser,
        is_admin=current_user.is_superuser
    )
    
    # Adicionar restrições baseadas no status
    if payment.status == "confirmed":
        if not current_user.is_superuser:
            permissions.restrictions.append("Pagamento confirmado - apenas administradores podem editar/excluir")
            permissions.can_edit = False
            permissions.can_delete = False
    
    if payment.status == "refunded":
        permissions.restrictions.append("Pagamento estornado - operações limitadas")
        if not current_user.is_superuser:
            permissions.can_edit = False
            permissions.can_delete = False
    
    return permissions


@router.get("/{payment_id}/security-warning", response_model=PaymentSecurityWarning)
def get_payment_security_warning(
    payment_id: int,
    operation: str = Query(..., regex="^(edit_confirmed|delete_confirmed)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Gera aviso de segurança para operações sensíveis"""
    payment_service = PaymentService(db)
    
    payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Gerar mensagem de aviso baseada na operação
    if operation == "edit_confirmed":
        warning_message = f"ATENÇÃO: Você está prestes a EDITAR um pagamento confirmado (#{payment.payment_number}) no valor de R$ {payment.amount}. Esta operação pode impactar a contabilidade e requer justificativa detalhada."
        impact_level = "high"
    else:  # delete_confirmed
        warning_message = f"PERIGO: Você está prestes a EXCLUIR um pagamento confirmado (#{payment.payment_number}) no valor de R$ {payment.amount}. Esta operação é IRREVERSÍVEL e pode causar sérios problemas contábeis."
        impact_level = "critical"
    
    return PaymentSecurityWarning(
        operation=operation,
        payment_id=payment.id,
        payment_number=payment.payment_number,
        current_status=payment.status,
        warning_message=warning_message,
        requires_admin=True,
        requires_reason=True,
        impact_level=impact_level
    )


@router.get("/reservation/{reservation_id}/summary", response_model=ReservationPaymentSummary)
def get_reservation_payment_summary(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca resumo de pagamentos de uma reserva"""
    payment_service = PaymentService(db)
    
    summary = payment_service.get_reservation_payment_summary(
        reservation_id=reservation_id,
        tenant_id=current_user.tenant_id
    )
    
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    return summary


@router.get("/reports/period", response_model=PaymentReport)
def get_payment_report(
    start_date: date = Query(..., description="Data inicial do relatório"),
    end_date: date = Query(..., description="Data final do relatório"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Gera relatório de pagamentos por período"""
    
    # Validar período (máximo 1 ano)
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Período do relatório não pode exceder 365 dias"
        )
    
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data inicial deve ser menor que data final"
        )
    
    payment_service = PaymentService(db)
    
    report = payment_service.get_payment_report(
        tenant_id=current_user.tenant_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return report


@router.get("/admin/stats", response_model=PaymentAdminStats)
def get_admin_payment_stats(
    start_date: Optional[date] = Query(None, description="Data inicial para estatísticas"),
    end_date: Optional[date] = Query(None, description="Data final para estatísticas"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)  # Apenas admin
):
    """Gera estatísticas administrativas de pagamentos (apenas para admins)"""
    from sqlalchemy import func, and_
    from app.models.payment import Payment
    from app.models.audit_log import AuditLog
    from datetime import datetime, timedelta
    
    # Definir período padrão se não fornecido
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Estatísticas básicas de pagamentos
    payments_query = db.query(Payment).filter(
        Payment.tenant_id == current_user.tenant_id,
        Payment.is_active == True,
        func.date(Payment.created_at) >= start_date,
        func.date(Payment.created_at) <= end_date
    )
    
    total_payments = payments_query.count()
    confirmed_payments = payments_query.filter(Payment.status == "confirmed").count()
    pending_payments = payments_query.filter(Payment.status == "pending").count()
    cancelled_payments = payments_query.filter(Payment.status == "cancelled").count()
    refunded_payments = payments_query.filter(Payment.status == "refunded").count()
    
    # Valores totais
    confirmed_amount = db.query(func.sum(Payment.amount)).filter(
        Payment.tenant_id == current_user.tenant_id,
        Payment.is_active == True,
        Payment.status == "confirmed",
        func.date(Payment.created_at) >= start_date,
        func.date(Payment.created_at) <= end_date
    ).scalar() or 0
    
    refunded_amount = db.query(func.sum(Payment.amount)).filter(
        Payment.tenant_id == current_user.tenant_id,
        Payment.is_active == True,
        Payment.is_refund == True,
        Payment.status == "confirmed",
        func.date(Payment.created_at) >= start_date,
        func.date(Payment.created_at) <= end_date
    ).scalar() or 0
    
    # Operações administrativas
    admin_edited_count = db.query(Payment).filter(
        Payment.tenant_id == current_user.tenant_id,
        Payment.is_active == True,
        Payment.internal_notes.contains("EDIÇÃO ADMINISTRATIVO")
    ).count()
    
    admin_deleted_count = db.query(Payment).filter(
        Payment.tenant_id == current_user.tenant_id,
        Payment.is_active == False,
        Payment.internal_notes.contains("EXCLUSÃO ADMINISTRATIVO")
    ).count()
    
    # Operações dos últimos 30 dias
    last_30_days = end_date - timedelta(days=30)
    admin_operations_last_30_days = db.query(AuditLog).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.table_name == "payments",
        AuditLog.action.in_(["UPDATE", "DELETE"]),
        AuditLog.description.contains("ADMINISTRATIVO"),
        func.date(AuditLog.created_at) >= last_30_days
    ).count()
    
    return PaymentAdminStats(
        total_payments=total_payments,
        confirmed_payments=confirmed_payments,
        pending_payments=pending_payments,
        cancelled_payments=cancelled_payments,
        refunded_payments=refunded_payments,
        admin_edited_count=admin_edited_count,
        admin_deleted_count=admin_deleted_count,
        admin_operations_last_30_days=admin_operations_last_30_days,
        total_amount=payments_query.with_entities(func.sum(Payment.amount)).scalar() or 0,
        total_confirmed_amount=confirmed_amount,
        total_refunded_amount=refunded_amount,
        period_start=start_date,
        period_end=end_date
    )


@router.get("/number/{payment_number}", response_model=PaymentWithReservation)
def get_payment_by_number(
    payment_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca pagamento por número"""
    payment_service = PaymentService(db)
    
    payment = payment_service.get_payment_by_number(payment_number, current_user.tenant_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    # Converter para response com dados da reserva
    payment_dict = PaymentResponse.model_validate(payment).model_dump()
    
    # Adicionar campos computados
    payment_dict["status_display"] = payment.status_display
    payment_dict["payment_method_display"] = payment.payment_method_display
    
    # Verificar alterações administrativas
    if payment.internal_notes and ("EDIÇÃO ADMINISTRATIVO" in payment.internal_notes or "EXCLUSÃO ADMINISTRATIVO" in payment.internal_notes):
        payment_dict["has_admin_changes"] = True
    
    # Adicionar dados da reserva
    if payment.reservation:
        payment_dict["reservation_number"] = payment.reservation.reservation_number
        payment_dict["check_in_date"] = payment.reservation.check_in_date
        payment_dict["check_out_date"] = payment.reservation.check_out_date
        
        if payment.reservation.guest:
            payment_dict["guest_name"] = payment.reservation.guest.full_name
        
        if payment.reservation.property_obj:
            payment_dict["property_name"] = payment.reservation.property_obj.name
    
    return PaymentWithReservation(**payment_dict)


# Endpoints para operações especiais (apenas para administradores)
@router.post("/bulk-operation", response_model=MessageResponse)
def execute_bulk_operation(
    operation_data: PaymentBulkOperation,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)  # Apenas superuser
):
    """Executa operação em lote nos pagamentos (apenas admin)"""
    payment_service = PaymentService(db)
    
    success_count = 0
    errors = []
    
    for payment_id in operation_data.payment_ids:
        try:
            payment = payment_service.get_payment_by_id(payment_id, current_user.tenant_id)
            if not payment:
                errors.append(f"Pagamento {payment_id} não encontrado")
                continue
            
            # Executar operação baseada no tipo
            if operation_data.operation == "confirm":
                from app.schemas.payment import PaymentStatusUpdate
                status_update = PaymentStatusUpdate(
                    status="confirmed",
                    notes=operation_data.notes
                )
                result = payment_service.update_payment_status(
                    payment_id=payment_id,
                    status_data=status_update,
                    tenant_id=current_user.tenant_id,
                    current_user=current_user,
                    request=request
                )
                
            elif operation_data.operation == "cancel":
                status_update = PaymentStatusUpdate(
                    status="cancelled",
                    notes=operation_data.notes
                )
                result = payment_service.update_payment_status(
                    payment_id=payment_id,
                    status_data=status_update,
                    tenant_id=current_user.tenant_id,
                    current_user=current_user,
                    request=request
                )
            
            elif operation_data.operation == "refund":
                # Para estorno, criar um novo pagamento negativo
                from app.schemas.payment import PaymentCreate
                refund_data = PaymentCreate(
                    reservation_id=payment.reservation_id,
                    amount=payment.amount,
                    payment_method=payment.payment_method,
                    payment_date=datetime.utcnow(),
                    reference_number=f"REFUND-{payment.payment_number}",
                    notes=f"Estorno de {payment.payment_number}. {operation_data.notes or ''}".strip(),
                    is_partial=False
                )
                
                # Criar pagamento de estorno
                refund_payment = payment_service.create_payment(
                    payment_data=refund_data,
                    tenant_id=current_user.tenant_id,
                    current_user=current_user,
                    request=request
                )
                
                if refund_payment:
                    # Marcar como estorno
                    refund_payment.is_refund = True
                    refund_payment.status = "confirmed"
                    db.commit()
                    result = refund_payment
                else:
                    result = None
            
            if result:
                success_count += 1
            else:
                errors.append(f"Erro ao processar pagamento {payment_id}")
                
        except Exception as e:
            errors.append(f"Erro ao processar pagamento {payment_id}: {str(e)}")
    
    message = f"Operação executada em {success_count} pagamentos"
    if errors:
        message += f". Erros: {'; '.join(errors[:5])}"  # Mostrar apenas os primeiros 5 erros
    
    return MessageResponse(message=message)