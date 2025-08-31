# app/api/v1/endpoints/payments.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.core.database import get_db
from app.services.payment_service import PaymentService
from app.schemas.payment import (
    PaymentCreate, PaymentUpdate, PaymentStatusUpdate, PaymentFilters,
    PaymentResponse, PaymentWithReservation, PaymentListResponse,
    ReservationPaymentSummary, PaymentReport, PaymentBulkOperation
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
    """Atualiza dados do pagamento"""
    payment_service = PaymentService(db)
    
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
    current_user: User = Depends(get_current_active_user)
):
    """Exclui pagamento (soft delete)"""
    payment_service = PaymentService(db)
    
    success = payment_service.delete_payment(
        payment_id=payment_id,
        tenant_id=current_user.tenant_id,
        current_user=current_user,
        request=request
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    return MessageResponse(message="Pagamento excluído com sucesso")


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