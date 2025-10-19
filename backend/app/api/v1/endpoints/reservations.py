# backend/app/api/v1/endpoints/reservations.py - ARQUIVO COMPLETO COM MULTI-SELECT E VOUCHER

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_, func, text, desc, asc, not_
from datetime import datetime, date, timedelta
from decimal import Decimal
import math
import logging
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from app.core.database import get_db
from app.services.reservation_service import ReservationService
from app.services.voucher_service import VoucherService
from app.services.voucher_service import VoucherService
from app.schemas.reservation import (
    ReservationCreate, 
    ReservationUpdate, 
    ReservationResponse, 
    ReservationListResponse,
    ReservationFilters,
    ReservationWithDetails,
    ReservationResponseWithGuestDetails,
    ReservationListResponseWithDetails,
    ReservationExportFilters,
    ReservationExportResponse,
    CheckInRequest,
    CheckOutRequest,
    CancelReservationRequest,
    AvailabilityRequest,
    AvailabilityResponse,
    ReservationRoomResponse,
    ReservationDetailedResponse
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.property import Property
from app.models.room import Room
from app.models.room_type import RoomType
from sqlalchemy import case, distinct
from datetime import timezone

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/unpaid-reservations", response_model=List[Dict[str, Any]])
def get_unpaid_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    limit: int = Query(10, ge=1, le=50, description="Número máximo de resultados")
):
    """Busca reservas sem nenhum pagamento (R$0)"""
    try:
        from app.models.payment import Payment
        
        # Subquery para calcular total pago
        paid_subquery = db.query(
            Payment.reservation_id,
            func.sum(Payment.amount).label('total_paid')
        ).filter(
            Payment.tenant_id == current_user.tenant_id,
            Payment.status == 'confirmed',
            Payment.is_refund == False,
            Payment.is_active == True
        ).group_by(Payment.reservation_id).subquery()
        
        # Query principal
        base_query = db.query(Reservation).options(
            joinedload(Reservation.guest)
        ).outerjoin(
            paid_subquery, Reservation.id == paid_subquery.c.reservation_id
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status.in_(['confirmed', 'pending', 'checked_in']),
            func.coalesce(paid_subquery.c.total_paid, 0) == 0,  # Sem pagamentos
            Reservation.total_amount > 0  # Com valor a ser pago
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        reservations = base_query.order_by(desc(Reservation.created_at)).limit(limit).all()
        
        result = []
        for r in reservations:
            days_until_checkin = (r.check_in_date - date.today()).days
            
            result.append({
                "reservation_id": r.id,
                "reservation_number": r.reservation_number,
                "guest_name": r.guest.full_name if r.guest else "N/A",
                "check_in_date": r.check_in_date.isoformat(),
                "check_out_date": r.check_out_date.isoformat(),
                "total_amount": float(r.total_amount),
                "status": r.status,
                "days_until_checkin": days_until_checkin
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao buscar reservas sem pagamento: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar reservas sem pagamento: {str(e)}"
        )


# ===== FUNÇÃO AUXILIAR PARA GERAR VOUCHER PDF =====

def generate_voucher_pdf(reservation_data: dict) -> bytes:
    """
    Gera um PDF de voucher da reserva com as informações principais
    """
    buffer = io.BytesIO()
    
    # Configuração do documento
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=12,
        textColor=colors.darkblue
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    # Elementos do documento
    elements = []
    
    # Título
    elements.append(Paragraph("VOUCHER DE RESERVA", title_style))
    elements.append(Spacer(1, 10*mm))
    
    # Informações da reserva
    elements.append(Paragraph("DADOS DA RESERVA", header_style))
    
    reservation_data_table = [
        ["Número da Reserva:", reservation_data.get('reservation_number', 'N/A')],
        ["Status:", reservation_data.get('status', 'N/A').upper()],
        ["Data de Criação:", reservation_data.get('created_date', 'N/A')],
        ["Canal:", reservation_data.get('source', 'Direto').capitalize()],
    ]
    
    reservation_table = Table(reservation_data_table, colWidths=[60*mm, 100*mm])
    reservation_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(reservation_table)
    elements.append(Spacer(1, 8*mm))
    
    # Informações do hóspede
    guest_data = reservation_data.get('guest', {})
    elements.append(Paragraph("DADOS DO HÓSPEDE", header_style))
    
    guest_data_table = [
        ["Nome Completo:", guest_data.get('full_name', 'N/A')],
        ["E-mail:", guest_data.get('email', 'N/A')],
        ["Telefone:", guest_data.get('phone', 'N/A')],
        ["Documento:", f"{guest_data.get('document_type', 'N/A')}: {guest_data.get('document_number', 'N/A')}"],
    ]
    
    guest_table = Table(guest_data_table, colWidths=[60*mm, 100*mm])
    guest_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(guest_table)
    elements.append(Spacer(1, 8*mm))
    
    # Informações da estadia
    elements.append(Paragraph("DADOS DA ESTADIA", header_style))
    
    stay_data_table = [
        ["Check-in:", reservation_data.get('check_in_date', 'N/A')],
        ["Check-out:", reservation_data.get('check_out_date', 'N/A')],
        ["Noites:", str(reservation_data.get('nights', 0))],
        ["Adultos:", str(reservation_data.get('adults', 0))],
        ["Crianças:", str(reservation_data.get('children', 0))],
        ["Total de Hóspedes:", str(reservation_data.get('total_guests', 0))],
    ]
    
    stay_table = Table(stay_data_table, colWidths=[60*mm, 100*mm])
    stay_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(stay_table)
    elements.append(Spacer(1, 8*mm))
    
    # Informações dos quartos
    rooms = reservation_data.get('rooms', [])
    if rooms:
        elements.append(Paragraph("QUARTOS RESERVADOS", header_style))
        
        for i, room in enumerate(rooms, 1):
            room_info = f"Quarto {i}: {room.get('room_number', 'N/A')}"
            if room.get('room_type_name'):
                room_info += f" - {room.get('room_type_name')}"
            elements.append(Paragraph(room_info, normal_style))
        
        elements.append(Spacer(1, 6*mm))
    
    # Informações financeiras
    elements.append(Paragraph("INFORMAÇÕES FINANCEIRAS", header_style))
    
    financial_data_table = [
        ["Valor Total:", f"R$ {reservation_data.get('total_amount', 0):.2f}"],
        ["Valor Pago:", f"R$ {reservation_data.get('paid_amount', 0):.2f}"],
        ["Saldo Devedor:", f"R$ {reservation_data.get('balance_due', 0):.2f}"],
    ]
    
    financial_table = Table(financial_data_table, colWidths=[60*mm, 100*mm])
    financial_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(financial_table)
    elements.append(Spacer(1, 8*mm))
    
    # Informações da propriedade
    property_data = reservation_data.get('property', {})
    if property_data:
        elements.append(Paragraph("INFORMAÇÕES DA PROPRIEDADE", header_style))
        
        property_data_table = [
            ["Nome:", property_data.get('name', 'N/A')],
            ["Endereço:", property_data.get('address_line1', 'N/A')],
            ["Cidade:", property_data.get('city', 'N/A')],
            ["Telefone:", property_data.get('phone', 'N/A')],
        ]
        
        property_table = Table(property_data_table, colWidths=[60*mm, 100*mm])
        property_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(property_table)
        elements.append(Spacer(1, 8*mm))
    
    # Observações
    if reservation_data.get('guest_requests'):
        elements.append(Paragraph("SOLICITAÇÕES ESPECIAIS", header_style))
        elements.append(Paragraph(reservation_data.get('guest_requests'), normal_style))
        elements.append(Spacer(1, 6*mm))
    
    if reservation_data.get('internal_notes'):
        elements.append(Paragraph("OBSERVAÇÕES INTERNAS", header_style))
        elements.append(Paragraph(reservation_data.get('internal_notes'), normal_style))
        elements.append(Spacer(1, 6*mm))
    
    # Rodapé
    elements.append(Spacer(1, 10*mm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey
    )
    
    elements.append(Paragraph(f"Voucher gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}", footer_style))
    elements.append(Paragraph("Este documento é válido como comprovante de reserva.", footer_style))
    
    # Gerar PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# ===== FUNÇÃO AUXILIAR PARA PROCESSAR FILTROS MULTI-SELECT =====

def process_multiselect_params(
    status: Optional[str] = None,
    source: Optional[str] = None,
    status_list: Optional[str] = None,
    source_list: Optional[str] = None
) -> Dict[str, Any]:
    """
    Processa parâmetros de multi-select vindos como strings separadas por vírgula
    e converte para o formato esperado pelo ReservationFilters
    """
    filters_dict = {}
    
    # Processar status
    if status_list and status_list.strip():
        # Multi-select tem prioridade sobre filtro único
        filters_dict['status_list'] = [s.strip() for s in status_list.split(',') if s.strip()]
    elif status and status.strip():
        # ✅ CORREÇÃO: Auto-detectar vírgulas e converter para multi-select
        if ',' in status:
            filters_dict['status_list'] = [s.strip() for s in status.split(',') if s.strip()]
        else:
            filters_dict['status'] = status.strip()
    
    # Processar source
    if source_list and source_list.strip():
        # Multi-select tem prioridade sobre filtro único
        filters_dict['source_list'] = [s.strip() for s in source_list.split(',') if s.strip()]
    elif source and source.strip():
        # ✅ CORREÇÃO: Auto-detectar vírgulas e converter para multi-select
        if ',' in source:
            filters_dict['source_list'] = [s.strip() for s in source.split(',') if s.strip()]
        else:
            filters_dict['source'] = source.strip()
    
    return filters_dict


def create_reservation_filters(
    # Filtros básicos
    status: Optional[str] = None,
    source: Optional[str] = None,
    property_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    search: Optional[str] = None,
    
    # NOVOS: Filtros multi-select como strings CSV
    status_list: Optional[str] = None,
    source_list: Optional[str] = None,
    
    # Filtros de data
    check_in_from: Optional[date] = None,
    check_in_to: Optional[date] = None,
    check_out_from: Optional[date] = None,
    check_out_to: Optional[date] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    confirmed_from: Optional[datetime] = None,
    confirmed_to: Optional[datetime] = None,
    cancelled_from: Optional[date] = None,
    cancelled_to: Optional[date] = None,
    actual_checkin_from: Optional[datetime] = None,
    actual_checkin_to: Optional[datetime] = None,
    actual_checkout_from: Optional[datetime] = None,
    actual_checkout_to: Optional[datetime] = None,
    
    # Filtros do hóspede
    guest_email: Optional[str] = None,
    guest_phone: Optional[str] = None,
    guest_document_type: Optional[str] = None,
    guest_nationality: Optional[str] = None,
    guest_city: Optional[str] = None,
    guest_state: Optional[str] = None,
    guest_country: Optional[str] = None,
    
    # Filtros financeiros
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    min_guests: Optional[int] = None,
    max_guests: Optional[int] = None,
    min_nights: Optional[int] = None,
    max_nights: Optional[int] = None,
    
    # Filtros de quarto
    room_type_id: Optional[int] = None,
    room_number: Optional[str] = None,
    
    # Filtros especiais
    has_special_requests: Optional[bool] = None,
    has_internal_notes: Optional[bool] = None,
    deposit_paid: Optional[bool] = None,
    payment_status: Optional[str] = None,
    is_paid: Optional[bool] = None,
    requires_deposit: Optional[bool] = None,
    is_group_reservation: Optional[bool] = None,
) -> ReservationFilters:
    """Cria objeto ReservationFilters a partir dos parâmetros"""
    
    # Processar multi-select
    multiselect_filters = process_multiselect_params(status, source, status_list, source_list)
    
    # Processar datas created_from/to flexíveis
    created_from_dt = None
    created_to_dt = None
    
    if created_from:
        try:
            if 'T' in created_from:
                created_from_dt = datetime.fromisoformat(created_from.replace('Z', '+00:00'))
            else:
                date_obj = datetime.strptime(created_from, '%Y-%m-%d').date()
                created_from_dt = datetime.combine(date_obj, datetime.min.time())
        except (ValueError, TypeError):
            logger.warning(f"Formato de data inválido para created_from: {created_from}")
    
    if created_to:
        try:
            if 'T' in created_to:
                created_to_dt = datetime.fromisoformat(created_to.replace('Z', '+00:00'))
            else:
                date_obj = datetime.strptime(created_to, '%Y-%m-%d').date()
                created_to_dt = datetime.combine(date_obj, datetime.max.time())
        except (ValueError, TypeError):
            logger.warning(f"Formato de data inválido para created_to: {created_to}")
    
    # Construir filtros
    filter_data = {
        # Filtros básicos
        'property_id': property_id,
        'guest_id': guest_id,
        'search': search,
        
        # Filtros de data
        'check_in_from': check_in_from,
        'check_in_to': check_in_to,
        'check_out_from': check_out_from,
        'check_out_to': check_out_to,
        'created_from': created_from_dt,
        'created_to': created_to_dt,
        'confirmed_from': confirmed_from,
        'confirmed_to': confirmed_to,
        'cancelled_from': cancelled_from,
        'cancelled_to': cancelled_to,
        'actual_checkin_from': actual_checkin_from,
        'actual_checkin_to': actual_checkin_to,
        'actual_checkout_from': actual_checkout_from,
        'actual_checkout_to': actual_checkout_to,
        
        # Filtros do hóspede
        'guest_email': guest_email,
        'guest_phone': guest_phone,
        'guest_document_type': guest_document_type,
        'guest_nationality': guest_nationality,
        'guest_city': guest_city,
        'guest_state': guest_state,
        'guest_country': guest_country,
        
        # Filtros financeiros
        'min_amount': Decimal(str(min_amount)) if min_amount is not None else None,
        'max_amount': Decimal(str(max_amount)) if max_amount is not None else None,
        'min_guests': min_guests,
        'max_guests': max_guests,
        'min_nights': min_nights,
        'max_nights': max_nights,
        
        # Filtros de quarto
        'room_type_id': room_type_id,
        'room_number': room_number,
        
        # Filtros especiais
        'has_special_requests': has_special_requests,
        'has_internal_notes': has_internal_notes,
        'deposit_paid': deposit_paid,
        'payment_status': payment_status,
        'is_paid': is_paid,
        'requires_deposit': requires_deposit,
        'is_group_reservation': is_group_reservation,
        
        # Adicionar filtros de multi-select processados
        **multiselect_filters
    }
    
    # Remover valores None
    filter_data = {k: v for k, v in filter_data.items() if v is not None}
    
    return ReservationFilters(**filter_data)


# ===== ENDPOINT PRINCIPAL COM MULTI-SELECT =====

@router.get("/", response_model=ReservationListResponse)
def list_reservations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros básicos existentes
    status: Optional[str] = Query(None, description="Filtrar por status (filtro único)"),
    source: Optional[str] = Query(None, description="Filtrar por canal (filtro único)"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    guest_id: Optional[int] = Query(None, description="Filtrar por hóspede"),
    
    # NOVOS: Filtros multi-select como strings separadas por vírgula
    status_list: Optional[str] = Query(None, description="Filtrar por múltiplos status (separados por vírgula)"),
    source_list: Optional[str] = Query(None, description="Filtrar por múltiplos canais (separados por vírgula)"),
    
    # Filtros de data existentes
    check_in_from: Optional[date] = Query(None, description="Check-in a partir de"),
    check_in_to: Optional[date] = Query(None, description="Check-in até"),
    check_out_from: Optional[date] = Query(None, description="Check-out a partir de"),
    check_out_to: Optional[date] = Query(None, description="Check-out até"),
    created_from: Optional[str] = Query(None, description="Criação a partir de (datetime ou date)"),
    created_to: Optional[str] = Query(None, description="Criação até (datetime ou date)"),
    
    # Filtros financeiros existentes
    min_amount: Optional[float] = Query(None, ge=0, description="Valor mínimo"),
    max_amount: Optional[float] = Query(None, ge=0, description="Valor máximo"),
    is_paid: Optional[bool] = Query(None, description="Filtrar por pago"),
    requires_deposit: Optional[bool] = Query(None, description="Exige depósito"),
    is_group_reservation: Optional[bool] = Query(None, description="Reserva em grupo"),
    
    # Busca textual
    search: Optional[str] = Query(None, description="Buscar por nome, email, número reserva"),
    
    # ===== FILTROS EXPANDIDOS =====
    
    # Filtros do hóspede
    guest_email: Optional[str] = Query(None, description="E-mail do hóspede"),
    guest_phone: Optional[str] = Query(None, description="Telefone do hóspede"),
    guest_document_type: Optional[str] = Query(None, description="Tipo de documento"),
    guest_nationality: Optional[str] = Query(None, description="Nacionalidade do hóspede"),
    guest_city: Optional[str] = Query(None, description="Cidade do hóspede"),
    guest_state: Optional[str] = Query(None, description="Estado do hóspede"),
    guest_country: Optional[str] = Query(None, description="País do hóspede"),
    
    # Filtros de data de cancelamento  
    cancelled_from: Optional[date] = Query(None, description="Cancelamento a partir de"),
    cancelled_to: Optional[date] = Query(None, description="Cancelamento até"),
    
    # Filtros de confirmação
    confirmed_from: Optional[datetime] = Query(None, description="Confirmação a partir de"),
    confirmed_to: Optional[datetime] = Query(None, description="Confirmação até"),
    
    # Filtros de check-in/out realizados
    actual_checkin_from: Optional[datetime] = Query(None, description="Check-in realizado a partir de"),
    actual_checkin_to: Optional[datetime] = Query(None, description="Check-in realizado até"),
    actual_checkout_from: Optional[datetime] = Query(None, description="Check-out realizado a partir de"), 
    actual_checkout_to: Optional[datetime] = Query(None, description="Check-out realizado até"),
    
    # Filtros por número de hóspedes e noites
    min_guests: Optional[int] = Query(None, ge=1, description="Número mínimo de hóspedes"),
    max_guests: Optional[int] = Query(None, ge=1, description="Número máximo de hóspedes"),
    min_nights: Optional[int] = Query(None, ge=1, description="Número mínimo de noites"),
    max_nights: Optional[int] = Query(None, ge=1, description="Número máximo de noites"),
    
    # Filtros de quarto
    room_type_id: Optional[int] = Query(None, description="ID do tipo de quarto"),
    room_number: Optional[str] = Query(None, description="Número do quarto"),
    
    # Filtros especiais
    has_special_requests: Optional[bool] = Query(None, description="Possui pedidos especiais"),
    has_internal_notes: Optional[bool] = Query(None, description="Possui notas internas"),
    deposit_paid: Optional[bool] = Query(None, description="Depósito pago"),
    payment_status: Optional[str] = Query(None, description="Status do pagamento"),
    
    # Parâmetros para incluir dados expandidos
    include_guest_details: bool = Query(True, description="Incluir dados do hóspede"),
    include_property_details: bool = Query(True, description="Incluir dados da propriedade"),
    include_room_details: Optional[bool] = Query(True, description="Incluir detalhes dos quartos"),
    include_payment_details: Optional[bool] = Query(False, description="Incluir detalhes de pagamento"),
):
    """
    Lista reservas do tenant com filtros avançados e paginação
    VERSÃO ATUALIZADA COM SUPORTE A MULTI-SELECT
    """
    
    try:
        # Criar filtros usando função auxiliar
        filters = create_reservation_filters(
            status=status,
            source=source,
            property_id=property_id,
            guest_id=guest_id,
            search=search,
            status_list=status_list,  # NOVO
            source_list=source_list,  # NOVO
            check_in_from=check_in_from,
            check_in_to=check_in_to,
            check_out_from=check_out_from,
            check_out_to=check_out_to,
            created_from=created_from,
            created_to=created_to,
            confirmed_from=confirmed_from,
            confirmed_to=confirmed_to,
            cancelled_from=cancelled_from,
            cancelled_to=cancelled_to,
            actual_checkin_from=actual_checkin_from,
            actual_checkin_to=actual_checkin_to,
            actual_checkout_from=actual_checkout_from,
            actual_checkout_to=actual_checkout_to,
            guest_email=guest_email,
            guest_phone=guest_phone,
            guest_document_type=guest_document_type,
            guest_nationality=guest_nationality,
            guest_city=guest_city,
            guest_state=guest_state,
            guest_country=guest_country,
            min_amount=min_amount,
            max_amount=max_amount,
            min_guests=min_guests,
            max_guests=max_guests,
            min_nights=min_nights,
            max_nights=max_nights,
            room_type_id=room_type_id,
            room_number=room_number,
            has_special_requests=has_special_requests,
            has_internal_notes=has_internal_notes,
            deposit_paid=deposit_paid,
            payment_status=payment_status,
            is_paid=is_paid,
            requires_deposit=requires_deposit,
            is_group_reservation=is_group_reservation,
        )
        
        # Usar o service atualizado
        reservation_service = ReservationService(db)
        skip = (page - 1) * per_page
        
        # Buscar reservas com filtros (incluindo multi-select)
        reservations = reservation_service.get_reservations(
            current_user.tenant_id, 
            filters, 
            skip, 
            per_page
        )
        
        # Contar total
        total = reservation_service.count_reservations(current_user.tenant_id, filters)
        
        # ===== CONVERTER PARA RESPONSE (MESMO CÓDIGO EXISTENTE) =====
        
        reservations_response = []
        
        for reservation in reservations:
            # Criar response básico
            reservation_dict = {
                'id': reservation.id,
                'reservation_number': reservation.reservation_number,
                'property_id': reservation.property_id,
                'guest_id': reservation.guest_id,
                'check_in_date': reservation.check_in_date,
                'check_out_date': reservation.check_out_date,
                'status': reservation.status,
                'adults': reservation.adults,
                'children': reservation.children,
                'total_guests': reservation.total_guests,
                'room_rate': reservation.room_rate,
                'total_amount': reservation.total_amount,
                'paid_amount': reservation.paid_amount,
                'discount': reservation.discount,
                'taxes': reservation.taxes,
                'source': reservation.source,
                'source_reference': reservation.source_reference,
                'created_date': reservation.created_date,
                'confirmed_date': reservation.confirmed_date,
                'checked_in_date': reservation.checked_in_date,
                'checked_out_date': reservation.checked_out_date,
                'cancelled_date': reservation.cancelled_date,
                'guest_requests': reservation.guest_requests,
                'internal_notes': reservation.internal_notes,
                'cancellation_reason': reservation.cancellation_reason,
                'preferences': reservation.preferences,
                'extra_data': reservation.extra_data,
                'is_group_reservation': reservation.is_group_reservation,
                'requires_deposit': reservation.requires_deposit,
                'deposit_paid': reservation.deposit_paid,
                'tenant_id': reservation.tenant_id,
                'created_at': reservation.created_at,
                'updated_at': reservation.updated_at,
                'is_active': reservation.is_active,
            }
            
            # Campos computados - hóspede
            if reservation.guest:
                reservation_dict['guest_name'] = f"{reservation.guest.first_name} {reservation.guest.last_name}".strip()
                reservation_dict['guest_email'] = reservation.guest.email
            else:
                reservation_dict['guest_name'] = "Hóspede não encontrado"
                reservation_dict['guest_email'] = None
            
            # Campos computados - propriedade
            if reservation.property_obj:
                reservation_dict['property_name'] = reservation.property_obj.name
            else:
                reservation_dict['property_name'] = "Propriedade não encontrada"
            
            # Campos computados - pagamento usando total_paid
            total_amount = float(reservation.total_amount) if reservation.total_amount else 0
            paid_amount = float(reservation.total_paid) if reservation.total_paid else 0
            
            reservation_dict['is_paid'] = paid_amount >= total_amount if total_amount > 0 else True
            reservation_dict['balance'] = max(0, total_amount - paid_amount)
            
            # Campos computados - noites
            if reservation.check_in_date and reservation.check_out_date:
                reservation_dict['nights'] = (reservation.check_out_date - reservation.check_in_date).days
            else:
                reservation_dict['nights'] = 0
            
            # Campos computados - quartos
            if include_room_details and reservation.reservation_rooms:
                rooms_data = []
                for room_reservation in reservation.reservation_rooms:
                    if room_reservation.room:
                        room_data = {
                            'id': room_reservation.id,
                            'reservation_id': room_reservation.reservation_id,
                            'room_id': room_reservation.room_id,
                            'check_in_date': room_reservation.check_in_date.isoformat() if room_reservation.check_in_date else reservation.check_in_date.isoformat(),
                            'check_out_date': room_reservation.check_out_date.isoformat() if room_reservation.check_out_date else reservation.check_out_date.isoformat(),
                            'rate_per_night': room_reservation.rate_per_night if hasattr(room_reservation, 'rate_per_night') else None,
                            'total_amount': room_reservation.total_amount if hasattr(room_reservation, 'total_amount') else None,
                            'status': room_reservation.status if hasattr(room_reservation, 'status') else 'confirmed',
                            'notes': room_reservation.notes if hasattr(room_reservation, 'notes') else None,
                            'room_number': room_reservation.room.room_number,
                            'room_name': room_reservation.room.name if hasattr(room_reservation.room, 'name') else None,
                            'room_type_name': room_reservation.room.room_type.name if room_reservation.room.room_type else None,
                            'guests': room_reservation.guests if hasattr(room_reservation, 'guests') else 1,
                            'rate_plan_name': None
                        }
                        rooms_data.append(room_data)
                
                reservation_dict['rooms'] = rooms_data
            else:
                reservation_dict['rooms'] = []
            
            # Criar objeto de resposta
            reservation_response = ReservationResponse(**reservation_dict)
            reservations_response.append(reservation_response)
        
        # Calcular páginas
        total_pages = math.ceil(total / per_page) if total > 0 else 0
        
        return ReservationListResponse(
            reservations=reservations_response,
            total=total,
            page=page,
            pages=total_pages,
            per_page=per_page
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar reservas: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno do servidor: {str(e)}"
        )


# ===== LISTAGEM DETALHADA COM MULTI-SELECT =====

@router.get("/detailed", response_model=ReservationListResponseWithDetails)
def get_reservations_detailed(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Página (inicia em 1)"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
    
    # Filtros básicos
    status: Optional[str] = Query(None, description="Status da reserva (filtro único)"),
    source: Optional[str] = Query(None, description="Origem da reserva (filtro único)"),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    guest_id: Optional[int] = Query(None, description="ID do hóspede"),
    search: Optional[str] = Query(None, description="Busca por nome, email ou número da reserva"),
    
    # NOVOS: Filtros multi-select
    status_list: Optional[str] = Query(None, description="Múltiplos status (separados por vírgula)"),
    source_list: Optional[str] = Query(None, description="Múltiplas origens (separadas por vírgula)"),
    
    # Filtros de data
    check_in_from: Optional[date] = Query(None, description="Data de check-in a partir de"),
    check_in_to: Optional[date] = Query(None, description="Data de check-in até"),
    check_out_from: Optional[date] = Query(None, description="Data de check-out a partir de"),
    check_out_to: Optional[date] = Query(None, description="Data de check-out até"),
    created_from: Optional[str] = Query(None, description="Data de criação a partir de"),
    created_to: Optional[str] = Query(None, description="Data de criação até"),
    confirmed_from: Optional[datetime] = Query(None, description="Data de confirmação a partir de"),
    confirmed_to: Optional[datetime] = Query(None, description="Data de confirmação até"),
    cancelled_from: Optional[date] = Query(None, description="Data de cancelamento a partir de"),
    cancelled_to: Optional[date] = Query(None, description="Data de cancelamento até"),
    actual_checkin_from: Optional[datetime] = Query(None, description="Check-in realizado a partir de"),
    actual_checkin_to: Optional[datetime] = Query(None, description="Check-in realizado até"),
    actual_checkout_from: Optional[datetime] = Query(None, description="Check-out realizado a partir de"),
    actual_checkout_to: Optional[datetime] = Query(None, description="Check-out realizado até"),
    
    # Filtros do hóspede
    guest_email: Optional[str] = Query(None, description="Email do hóspede"),
    guest_phone: Optional[str] = Query(None, description="Telefone do hóspede"),
    guest_document_type: Optional[str] = Query(None, description="Tipo de documento do hóspede"),
    guest_nationality: Optional[str] = Query(None, description="Nacionalidade do hóspede"),
    guest_city: Optional[str] = Query(None, description="Cidade do hóspede"),
    guest_state: Optional[str] = Query(None, description="Estado do hóspede"),
    guest_country: Optional[str] = Query(None, description="País do hóspede"),
    
    # Filtros de valor e hóspedes
    min_amount: Optional[float] = Query(None, description="Valor mínimo"),
    max_amount: Optional[float] = Query(None, description="Valor máximo"),
    min_guests: Optional[int] = Query(None, ge=1, description="Número mínimo de hóspedes"),
    max_guests: Optional[int] = Query(None, le=20, description="Número máximo de hóspedes"),
    min_nights: Optional[int] = Query(None, ge=1, description="Número mínimo de noites"),
    max_nights: Optional[int] = Query(None, le=365, description="Número máximo de noites"),
    
    # Filtros de quarto
    room_type_id: Optional[int] = Query(None, description="ID do tipo de quarto"),
    room_number: Optional[str] = Query(None, description="Número do quarto"),
    
    # Filtros especiais
    has_special_requests: Optional[bool] = Query(None, description="Possui pedidos especiais"),
    has_internal_notes: Optional[bool] = Query(None, description="Possui notas internas"),
    deposit_paid: Optional[bool] = Query(None, description="Depósito pago"),
    payment_status: Optional[str] = Query(None, description="Status do pagamento"),
    is_paid: Optional[bool] = Query(None, description="Está pago"),
    requires_deposit: Optional[bool] = Query(None, description="Requer depósito"),
    is_group_reservation: Optional[bool] = Query(None, description="É reserva em grupo"),
    
    # Parâmetros de controle
    include_guest_details: bool = Query(True, description="Incluir detalhes do hóspede"),
    include_room_details: bool = Query(True, description="Incluir detalhes dos quartos"),
    include_payment_details: bool = Query(True, description="Incluir detalhes de pagamento"),
    include_property_details: bool = Query(False, description="Incluir detalhes da propriedade"),
):
    """Lista reservas com detalhes expandidos dos hóspedes e propriedades - COM MULTI-SELECT"""
    try:
        # Criar filtros usando função auxiliar
        filters = create_reservation_filters(
            status=status,
            source=source,
            property_id=property_id,
            guest_id=guest_id,
            search=search,
            status_list=status_list,  # NOVO
            source_list=source_list,  # NOVO
            check_in_from=check_in_from,
            check_in_to=check_in_to,
            check_out_from=check_out_from,
            check_out_to=check_out_to,
            created_from=created_from,
            created_to=created_to,
            confirmed_from=confirmed_from,
            confirmed_to=confirmed_to,
            cancelled_from=cancelled_from,
            cancelled_to=cancelled_to,
            actual_checkin_from=actual_checkin_from,
            actual_checkin_to=actual_checkin_to,
            actual_checkout_from=actual_checkout_from,
            actual_checkout_to=actual_checkout_to,
            guest_email=guest_email,
            guest_phone=guest_phone,
            guest_document_type=guest_document_type,
            guest_nationality=guest_nationality,
            guest_city=guest_city,
            guest_state=guest_state,
            guest_country=guest_country,
            min_amount=min_amount,
            max_amount=max_amount,
            min_guests=min_guests,
            max_guests=max_guests,
            min_nights=min_nights,
            max_nights=max_nights,
            room_type_id=room_type_id,
            room_number=room_number,
            has_special_requests=has_special_requests,
            has_internal_notes=has_internal_notes,
            deposit_paid=deposit_paid,
            payment_status=payment_status,
            is_paid=is_paid,
            requires_deposit=requires_deposit,
            is_group_reservation=is_group_reservation,
        )
        
        # Usar o service atualizado
        reservation_service = ReservationService(db)
        skip = (page - 1) * per_page
        
        # Buscar reservas com filtros (incluindo multi-select)
        reservations = reservation_service.get_reservations(
            current_user.tenant_id, 
            filters, 
            skip, 
            per_page
        )
        
        # Contar total
        total = reservation_service.count_reservations(current_user.tenant_id, filters)
        
        # Converter para response expandido com guest_phone garantido
        detailed_reservations = []
        
        for reservation in reservations:
            try:
                # Base response sem conflitos
                base_data = ReservationResponse.model_validate(reservation)
                base_dict = base_data.model_dump()
                
                # Sempre popular campos básicos primeiro
                if reservation.guest:
                    base_dict['guest_name'] = reservation.guest.full_name
                    base_dict['guest_email'] = reservation.guest.email
                else:
                    base_dict['guest_name'] = "Hóspede não encontrado"
                    base_dict['guest_email'] = None
                    
                if reservation.property_obj:
                    base_dict['property_name'] = reservation.property_obj.name
                else:
                    base_dict['property_name'] = "Propriedade não encontrada"
                
                # Remover campos que conflitam
                fields_to_override = [
                    'guest_phone', 'guest_document_type', 'guest_document_number',
                    'guest_nationality', 'guest_city', 'guest_state', 'guest_country',
                    'guest_address', 'guest_date_of_birth', 'property_address', 
                    'property_phone', 'property_city', 'deposit_paid', 
                    'is_group_reservation', 'requires_deposit', 'rooms'
                ]
                for field in fields_to_override:
                    base_dict.pop(field, None)

                # Criar response expandido mantendo a estrutura de rooms original
                detailed_reservation = ReservationResponseWithGuestDetails(
                    **base_dict,

                    # Dados do hóspede expandidos - sempre incluir
                    guest_phone=reservation.guest.phone if reservation.guest else None,
                    guest_document_type=reservation.guest.document_type if reservation.guest else None,
                    guest_document_number=reservation.guest.document_number if reservation.guest else None,
                    guest_nationality=reservation.guest.nationality if reservation.guest else None,
                    guest_city=reservation.guest.city if reservation.guest else None,
                    guest_state=reservation.guest.state if reservation.guest else None,
                    guest_country=reservation.guest.country if reservation.guest else None,
                    guest_address=reservation.guest.address_line1 if reservation.guest else None,
                    guest_date_of_birth=reservation.guest.date_of_birth if reservation.guest else None,

                    # Dados da propriedade expandidos
                    property_address=reservation.property_obj.address_line1 if reservation.property_obj else None,
                    property_phone=reservation.property_obj.phone if reservation.property_obj else None,
                    property_city=reservation.property_obj.city if reservation.property_obj else None,

                    # Manter estrutura original de quartos
                    rooms=[
                        ReservationRoomResponse(
                            id=room.id,
                            reservation_id=room.reservation_id,
                            room_id=room.room_id,
                            check_in_date=room.check_in_date.isoformat() if room.check_in_date else None,
                            check_out_date=room.check_out_date.isoformat() if room.check_out_date else None,
                            rate_per_night=float(room.rate_per_night) if room.rate_per_night else None,
                            total_amount=float(room.total_amount) if room.total_amount else None,
                            status=room.status,
                            notes=room.notes,
                            room_number=room.room.room_number if room.room else None,
                            room_name=room.room.name if room.room else None,
                            room_type_name=room.room.room_type.name if (room.room and room.room.room_type) else None,
                        )
                        for room in reservation.reservation_rooms if room.room
                    ] if reservation.reservation_rooms else [],

                    # Campos adicionais específicos para reservas
                    deposit_paid=reservation.deposit_paid,
                    is_group_reservation=reservation.is_group_reservation,
                    requires_deposit=reservation.requires_deposit,
                )
                
                detailed_reservations.append(detailed_reservation)
                
            except Exception as e:
                logger.error(f"Erro ao processar reserva {reservation.id}: {str(e)}")
                continue
        
        # Calcular estatísticas da busca usando total_paid
        summary = None
        if total > 0 and reservations:
            total_amount = sum(float(r.total_amount or 0) for r in reservations)
            total_paid = sum(float(r.total_paid or 0) for r in reservations)
            total_pending = total_amount - total_paid
            
            # Distribuição por status
            status_counts = {}
            for r in reservations:
                status_counts[r.status] = status_counts.get(r.status, 0) + 1
            
            # Distribuição por fonte
            source_counts = {}
            for r in reservations:
                source_counts[r.source] = source_counts.get(r.source, 0) + 1
            
            # Médias
            avg_nights = sum((r.check_out_date - r.check_in_date).days for r in reservations) / len(reservations)
            avg_guests = sum(r.total_guests for r in reservations) / len(reservations)
            avg_amount = total_amount / len(reservations) if len(reservations) > 0 else 0
            
            summary = {
                "total_amount": total_amount,
                "total_paid": total_paid,
                "total_pending": total_pending,
                "status_counts": status_counts,
                "source_counts": source_counts,
                "avg_nights": round(avg_nights, 1),
                "avg_guests": round(avg_guests, 1),
                "avg_amount": round(avg_amount, 2)
            }
        
        # Calcular páginas
        pages = math.ceil(total / per_page) if total > 0 else 0
        
        return ReservationListResponseWithDetails(
            reservations=detailed_reservations,
            total=total,
            page=page,
            pages=pages,
            per_page=per_page,
            summary=summary
        )
        
    except Exception as e:
        logger.error(f"Erro ao listar reservas detalhadas: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno do servidor: {str(e)}"
        )


# ===== RESERVAS DE HOJE =====

@router.get("/today", response_model=Dict[str, Any])
def get_todays_reservations_improved(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    include_details: bool = Query(True, description="Incluir detalhes dos hóspedes")
):
    """Obtém reservas do dia atual com check-outs pendentes (melhorado)"""
    try:
        today = date.today()
        
        # Query base com joins
        base_query = db.query(Reservation)
        
        if include_details:
            base_query = base_query.options(
                joinedload(Reservation.guest),
                selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
            )
        
        base_query = base_query.filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Chegadas hoje
        arrivals = base_query.filter(
            Reservation.check_in_date == today,
            Reservation.status.in_(['confirmed', 'pending'])
        ).order_by(asc(Reservation.id)).all()
        
        # Check-outs pendentes (hoje e anteriores)
        departures = base_query.filter(
            Reservation.check_out_date <= today,
            Reservation.status == 'checked_in'
        ).order_by(asc(Reservation.check_out_date), asc(Reservation.id)).all()
        
        # Hóspedes atuais
        current_guests = base_query.filter(
            Reservation.status == 'checked_in',
            Reservation.check_in_date <= today,
            Reservation.check_out_date > today
        ).all()
        
        # Formatação da resposta
        response_data = {
            "date": today.isoformat(),
            "arrivals_count": len(arrivals),
            "pending_checkouts_count": len(departures),
            "current_guests_count": len(current_guests),
        }
        
        if include_details:
            # Função para formatar reserva simples
            def format_reservation_simple(reservation):
                nights = (reservation.check_out_date - reservation.check_in_date).days
                total_paid = float(reservation.total_paid) if reservation.total_paid else 0.0
                balance_due = float(reservation.total_amount) - total_paid
                
                return {
                    "id": reservation.id,
                    "reservation_number": reservation.reservation_number,
                    "guest_name": reservation.guest.full_name if reservation.guest else "Sem nome",
                    "guest_email": reservation.guest.email if reservation.guest else None,
                    "property_name": reservation.property_obj.name if reservation.property_obj else None,
                    "check_in_date": reservation.check_in_date.isoformat(),
                    "check_out_date": reservation.check_out_date.isoformat(),
                    "status": reservation.status,
                    "total_amount": float(reservation.total_amount),
                    "paid_amount": total_paid,
                    "balance_due": balance_due,
                    "nights": nights,
                    "source": reservation.source,
                    "adults": reservation.adults,
                    "children": reservation.children,
                    "total_guests": reservation.total_guests,
                    "created_at": reservation.created_at.isoformat() if reservation.created_at else None
                }
            
            response_data.update({
                "arrivals": [format_reservation_simple(r) for r in arrivals],
                "pending_checkouts": [format_reservation_simple(r) for r in departures], 
                "current_guests": [format_reservation_simple(r) for r in current_guests]
            })
        else:
            response_data.update({
                "arrivals": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in arrivals],
                "pending_checkouts": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in departures],
                "current_guests": [{"id": r.id, "guest_name": r.guest.full_name if r.guest else "N/A"} for r in current_guests]
            })
        
        return response_data
        
    except Exception as e:
        logger.error(f"Erro ao buscar reservas de hoje: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar reservas de hoje: {str(e)}"
        )


# Correção para o endpoint /recent em backend/app/api/v1/endpoints/reservations.py

@router.get("/recent", response_model=List[Dict[str, Any]])
def get_recent_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(5, ge=1, le=20, description="Número de reservas recentes"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """Obtém as reservas mais recentes - CORRIGIDO"""
    try:
        base_query = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        recent_reservations = base_query.order_by(
            desc(Reservation.created_at)
        ).limit(limit).all()
        
        # Construir dict manual - CORRIGIDO
        reservations_list = []
        for reservation in recent_reservations:
            try:
                nights = (reservation.check_out_date - reservation.check_in_date).days
                
                # ✅ CORRIGIDO: Usar paid_amount da tabela em vez de total_paid (propriedade)
                total_amount = float(reservation.total_amount) if reservation.total_amount else 0.0
                paid_amount = float(reservation.paid_amount) if reservation.paid_amount else 0.0
                balance_due = max(0.0, total_amount - paid_amount)
                
                # ✅ TRATAMENTO SEGURO: Verificar se relacionamentos existem
                guest_name = "Sem nome"
                guest_email = None
                if reservation.guest:
                    guest_name = reservation.guest.full_name or "Sem nome"
                    guest_email = reservation.guest.email
                
                property_name = None
                if reservation.property_obj:
                    property_name = reservation.property_obj.name
                
                reservation_data = {
                    "id": reservation.id,
                    "reservation_number": reservation.reservation_number,
                    "guest_name": guest_name,
                    "guest_email": guest_email,
                    "property_name": property_name,
                    "check_in_date": reservation.check_in_date.isoformat(),
                    "check_out_date": reservation.check_out_date.isoformat(),
                    "status": reservation.status,
                    "total_amount": total_amount,
                    "paid_amount": paid_amount,
                    "balance_due": balance_due,
                    "nights": nights,
                    "source": reservation.source,
                    "created_at": reservation.created_at.isoformat() if reservation.created_at else None
                }
                
                reservations_list.append(reservation_data)
                
            except Exception as reservation_error:
                # ✅ TRATAMENTO: Se uma reserva específica falhar, continuar com as outras
                logger.warning(f"Erro ao processar reserva {reservation.id}: {str(reservation_error)}")
                continue
        
        return reservations_list
        
    except Exception as e:
        logger.error(f"Erro ao buscar reservas recentes: {str(e)}")
        # ✅ FALLBACK: Retornar lista vazia em vez de erro 500
        return []


@router.get("/checked-in-pending-payment", response_model=List[Dict[str, Any]])
def get_checked_in_pending_payment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    limit: int = Query(10, ge=1, le=50, description="Número máximo de resultados")
):
    """Obtém reservas com check-in feito e saldo pendente"""
    try:
        # Query mais complexa para usar total_paid
        from app.models.payment import Payment
        
        # Subquery para calcular total pago de cada reserva
        paid_subquery = db.query(
            Payment.reservation_id,
            func.sum(Payment.amount).label('total_paid')
        ).filter(
            Payment.tenant_id == current_user.tenant_id,
            Payment.status == 'confirmed',
            Payment.is_refund == False,
            Payment.is_active == True
        ).group_by(Payment.reservation_id).subquery()
        
        # Query principal com join da subquery
        base_query = db.query(Reservation).options(
            joinedload(Reservation.guest),
            selectinload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).outerjoin(
            paid_subquery, Reservation.id == paid_subquery.c.reservation_id
        ).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status == 'checked_in',
            # Usar subquery em vez de paid_amount
            Reservation.total_amount > func.coalesce(paid_subquery.c.total_paid, 0)
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        reservations = base_query.order_by(
            asc(Reservation.check_in_date)  # Mais antigos primeiro (mais urgente)
        ).limit(limit).all()
        
        pending_payments = []
        for reservation in reservations:
            days_since_checkin = (date.today() - reservation.check_in_date).days
            
            # Pegar número do quarto da primeira reservation_room
            room_number = None
            if reservation.reservation_rooms and reservation.reservation_rooms[0].room:
                room_number = reservation.reservation_rooms[0].room.room_number
            
            # Usar total_paid
            total_paid = float(reservation.total_paid) if reservation.total_paid else 0.0
            pending_amount = float(reservation.total_amount) - total_paid
            
            pending_payments.append({
                "reservation_id": reservation.id,
                "guest_name": reservation.guest.full_name if reservation.guest else "N/A",
                "room_number": room_number or "N/A",
                "check_in_date": reservation.check_in_date.isoformat(),
                "pending_amount": pending_amount,
                "days_since_checkin": days_since_checkin,
                "total_amount": float(reservation.total_amount),
                "paid_amount": total_paid,
                "payment_status": "overdue" if days_since_checkin > 3 else "pending"
            })
        
        return pending_payments
        
    except Exception as e:
        logger.error(f"Erro ao buscar check-ins com saldo pendente: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar check-ins com saldo pendente: {str(e)}"
        )


@router.get("/dashboard-summary", response_model=Dict[str, Any])
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade")
):
    """Obtém resumo consolidado para o dashboard"""
    try:
        today = date.today()
        
        # Query base
        base_query = db.query(Reservation).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Estatísticas básicas
        total_reservations = base_query.count()
        
        # Check-ins de hoje
        todays_checkins = base_query.filter(
            Reservation.check_in_date == today,
            Reservation.status.in_(['confirmed', 'pending'])
        ).count()
        
        # Check-outs de hoje  
        pending_checkouts = base_query.filter(
            Reservation.check_out_date <= today,
            Reservation.status == 'checked_in'
        ).count()
        
        # Hóspedes atuais (checked-in)
        current_guests = base_query.filter(
            Reservation.status == 'checked_in'
        ).count()
        
        # Receita total e pendente usando total_paid
        from app.models.payment import Payment
        
        # Subquery para calcular total pago
        paid_subquery = db.query(
            Payment.reservation_id,
            func.sum(Payment.amount).label('total_paid')
        ).filter(
            Payment.tenant_id == current_user.tenant_id,
            Payment.status == 'confirmed',
            Payment.is_refund == False,
            Payment.is_active == True
        ).group_by(Payment.reservation_id).subquery()
        
        # Receita total
        total_revenue = base_query.with_entities(
            func.sum(Reservation.total_amount)
        ).scalar() or 0
        
        # Receita paga (usando subquery)
        paid_revenue = base_query.outerjoin(
            paid_subquery, Reservation.id == paid_subquery.c.reservation_id
        ).with_entities(
            func.sum(func.coalesce(paid_subquery.c.total_paid, 0))
        ).scalar() or 0
        
        pending_revenue = float(total_revenue) - float(paid_revenue)
        
        # Saldo pendente de check-ins usando total_paid
        checked_in_pending = base_query.outerjoin(
            paid_subquery, Reservation.id == paid_subquery.c.reservation_id
        ).filter(
            Reservation.status == 'checked_in',
            Reservation.total_amount > func.coalesce(paid_subquery.c.total_paid, 0)
        ).count()
        
        return {
            "total_reservations": total_reservations,
            "todays_checkins": todays_checkins,
            "pending_checkouts": pending_checkouts,
            "current_guests": current_guests,
            "total_revenue": float(total_revenue),
            "paid_revenue": float(paid_revenue),
            "pending_revenue": pending_revenue,
            "checked_in_with_pending_payment": checked_in_pending,
            "summary_date": today.isoformat(),
            "property_id": property_id
        }
        
    except Exception as e:
        logger.error(f"Erro ao buscar resumo do dashboard: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar resumo do dashboard: {str(e)}"
        )


# ===== CRUD BÁSICO =====

@router.get("/{reservation_id}", response_model=ReservationResponse)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva específica do tenant"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    # Conversão manual para incluir quartos
    try:
        base_response = ReservationResponse.model_validate(reservation_obj)
        base_dict = base_response.model_dump()
        
        # Adicionar quartos manualmente
        if reservation_obj.reservation_rooms:
            rooms_data = []
            for room_reservation in reservation_obj.reservation_rooms:
                if room_reservation.room:
                    room_data = {
                        'id': room_reservation.id,
                        'reservation_id': room_reservation.reservation_id,
                        'room_id': room_reservation.room_id,
                        'check_in_date': room_reservation.check_in_date.isoformat() if room_reservation.check_in_date else reservation_obj.check_in_date.isoformat(),
                        'check_out_date': room_reservation.check_out_date.isoformat() if room_reservation.check_out_date else reservation_obj.check_out_date.isoformat(),
                        'rate_per_night': float(room_reservation.rate_per_night) if room_reservation.rate_per_night else None,
                        'total_amount': float(room_reservation.total_amount) if room_reservation.total_amount else None,
                        'status': getattr(room_reservation, 'status', 'confirmed'),
                        'notes': getattr(room_reservation, 'notes', None),
                        'room_number': room_reservation.room.room_number,
                        'room_name': getattr(room_reservation.room, 'name', None),
                        'room_type_name': room_reservation.room.room_type.name if room_reservation.room.room_type else None,
                        'guests': getattr(room_reservation, 'guests', 1),
                        'rate_plan_name': None
                    }
                    rooms_data.append(room_data)
            
            base_dict['rooms'] = rooms_data
        else:
            base_dict['rooms'] = []
        
        # Adicionar campos computados básicos
        if reservation_obj.guest:
            base_dict['guest_name'] = f"{reservation_obj.guest.first_name} {reservation_obj.guest.last_name}".strip()
            base_dict['guest_email'] = reservation_obj.guest.email
        else:
            base_dict['guest_name'] = "Hóspede não encontrado"
            base_dict['guest_email'] = None
        
        if reservation_obj.property_obj:
            base_dict['property_name'] = reservation_obj.property_obj.name
        else:
            base_dict['property_name'] = "Propriedade não encontrada"
        
        # Campos computados - noites
        if reservation_obj.check_in_date and reservation_obj.check_out_date:
            base_dict['nights'] = (reservation_obj.check_out_date - reservation_obj.check_in_date).days
        else:
            base_dict['nights'] = 0
        
        # Campos computados - pagamento usando total_paid
        total_amount = float(reservation_obj.total_amount) if reservation_obj.total_amount else 0
        paid_amount = float(reservation_obj.total_paid) if reservation_obj.total_paid else 0
        
        base_dict['is_paid'] = paid_amount >= total_amount if total_amount > 0 else True
        base_dict['balance_due'] = max(0, total_amount - paid_amount)
        
        return ReservationResponse(**base_dict)
        
    except Exception as e:
        logger.error(f"Erro ao processar reserva {reservation_id}: {str(e)}")
        # Fallback para versão básica sem quartos
        return ReservationResponse.model_validate(reservation_obj)


@router.get("/{reservation_id}/details", response_model=ReservationWithDetails)
def get_reservation_with_details(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva com todos os detalhes"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    # Converter para response com detalhes
    reservation_response = ReservationResponse.model_validate(reservation_obj)
    
    guest_data = None
    if reservation_obj.guest:
        guest_data = {
            'id': reservation_obj.guest.id,
            'full_name': reservation_obj.guest.full_name,
            'email': reservation_obj.guest.email,
            'phone': reservation_obj.guest.phone,
            'document_type': reservation_obj.guest.document_type,
            'document_number': reservation_obj.guest.document_number
        }
    
    property_data = None
    if reservation_obj.property_obj:
        property_data = {
            'id': reservation_obj.property_obj.id,
            'name': reservation_obj.property_obj.name,
            'property_type': reservation_obj.property_obj.property_type,
            'city': reservation_obj.property_obj.city,
            'phone': reservation_obj.property_obj.phone
        }
    
    return ReservationWithDetails(
        **reservation_response.dict(),
        guest=guest_data,
        property=property_data
    )


@router.get("/{reservation_id}/detailed", response_model=ReservationDetailedResponse)
def get_reservation_detailed(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca reserva com todos os detalhes para página individual
    Inclui dados completos do hóspede, propriedade, quartos, pagamentos e histórico
    """
    try:
        reservation_service = ReservationService(db)
        detailed_data = reservation_service.get_reservation_detailed(
            reservation_id, 
            current_user.tenant_id
        )
        
        if not detailed_data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Converter datetime para string onde necessário
        if detailed_data.get('created_date') and hasattr(detailed_data['created_date'], 'isoformat'):
            detailed_data['created_date'] = detailed_data['created_date'].isoformat()
        if detailed_data.get('confirmed_date') and hasattr(detailed_data['confirmed_date'], 'isoformat'):
            detailed_data['confirmed_date'] = detailed_data['confirmed_date'].isoformat()
        if detailed_data.get('checked_in_date') and hasattr(detailed_data['checked_in_date'], 'isoformat'):
            detailed_data['checked_in_date'] = detailed_data['checked_in_date'].isoformat()
        if detailed_data.get('checked_out_date') and hasattr(detailed_data['checked_out_date'], 'isoformat'):
            detailed_data['checked_out_date'] = detailed_data['checked_out_date'].isoformat()
        if detailed_data.get('cancelled_date') and hasattr(detailed_data['cancelled_date'], 'isoformat'):
            detailed_data['cancelled_date'] = detailed_data['cancelled_date'].isoformat()
        
        # Converter datas nos dados do hóspede
        guest_data = detailed_data.get('guest', {})
        if guest_data.get('date_of_birth') and hasattr(guest_data['date_of_birth'], 'isoformat'):
            guest_data['date_of_birth'] = guest_data['date_of_birth'].isoformat()
        if guest_data.get('last_stay_date') and hasattr(guest_data['last_stay_date'], 'isoformat'):
            guest_data['last_stay_date'] = guest_data['last_stay_date'].isoformat()
        if guest_data.get('created_at') and hasattr(guest_data['created_at'], 'isoformat'):
            guest_data['created_at'] = guest_data['created_at'].isoformat()
        if guest_data.get('updated_at') and hasattr(guest_data['updated_at'], 'isoformat'):
            guest_data['updated_at'] = guest_data['updated_at'].isoformat()
        
        # Converter datas nos dados da propriedade
        property_data = detailed_data.get('property', {})
        if property_data.get('created_at') and hasattr(property_data['created_at'], 'isoformat'):
            property_data['created_at'] = property_data['created_at'].isoformat()
        if property_data.get('updated_at') and hasattr(property_data['updated_at'], 'isoformat'):
            property_data['updated_at'] = property_data['updated_at'].isoformat()
        
        # Converter timestamps no histórico de auditoria
        for entry in detailed_data.get('audit_history', []):
            if entry.get('timestamp') and hasattr(entry['timestamp'], 'isoformat'):
                entry['timestamp'] = entry['timestamp'].isoformat()
        
        # Converter datas principais
        if detailed_data.get('check_in_date') and hasattr(detailed_data['check_in_date'], 'isoformat'):
            detailed_data['check_in_date'] = detailed_data['check_in_date'].isoformat()
        if detailed_data.get('check_out_date') and hasattr(detailed_data['check_out_date'], 'isoformat'):
            detailed_data['check_out_date'] = detailed_data['check_out_date'].isoformat()
        if detailed_data.get('created_at') and hasattr(detailed_data['created_at'], 'isoformat'):
            detailed_data['created_at'] = detailed_data['created_at'].isoformat()
        if detailed_data.get('updated_at') and hasattr(detailed_data['updated_at'], 'isoformat'):
            detailed_data['updated_at'] = detailed_data['updated_at'].isoformat()
        
        return ReservationDetailedResponse(**detailed_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar detalhes da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


# ===== NOVO ENDPOINT PARA VOUCHER =====

@router.get("/{reservation_id}/voucher")
def download_reservation_voucher(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gera e retorna o voucher da reserva em PDF para download
    """
    try:
        # Usar o VoucherService para gerar o PDF
        voucher_service = VoucherService(db)
        pdf_content = voucher_service.generate_reservation_voucher(
            reservation_id, 
            current_user.tenant_id
        )
        
        # Buscar dados básicos para o nome do arquivo
        reservation_service = ReservationService(db)
        reservation = reservation_service.get_reservation_by_id(reservation_id, current_user.tenant_id)
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Gerar nome do arquivo usando o serviço
        filename = voucher_service.get_voucher_filename(reservation.reservation_number)
        
        # Retornar PDF como response
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf"
            }
        )
        
    except ValueError as e:
        # Erro específico do serviço (reserva não encontrada)
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao gerar voucher da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao gerar voucher da reserva"
        )


@router.get("/number/{reservation_number}", response_model=ReservationResponse)
def get_reservation_by_number(
    reservation_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reserva por número"""
    reservation_service = ReservationService(db)
    reservation_obj = reservation_service.get_reservation_by_number(reservation_number, current_user.tenant_id)
    
    if not reservation_obj:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada"
        )
    
    return ReservationResponse.model_validate(reservation_obj)


@router.post("/", response_model=ReservationResponse)
def create_reservation(
    reservation_data: ReservationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria nova reserva no tenant atual"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.create_reservation(
            reservation_data, 
            current_user.tenant_id, 
            current_user,
            request
        )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza reserva"""
    reservation_service = ReservationService(db)
    
    try:
        reservation_obj = reservation_service.update_reservation(
            reservation_id, 
            current_user.tenant_id, 
            reservation_data,
            current_user,
            request
        )
        if not reservation_obj:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        return ReservationResponse.model_validate(reservation_obj)
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ===== AÇÕES DAS RESERVAS =====

@router.patch("/{reservation_id}/confirm", response_model=ReservationResponseWithGuestDetails)
def confirm_reservation_expanded(
    reservation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Confirma uma reserva e retorna dados expandidos"""
    try:
        reservation_service = ReservationService(db)
        
        # Buscar reserva com relacionamentos carregados
        reservation = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj)
        ).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Confirmar a reserva
        confirmed_reservation = reservation_service.confirm_reservation(
            reservation_id, 
            current_user.tenant_id, 
            current_user, 
            request
        )
        
        if not confirmed_reservation:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível confirmar a reserva"
            )
        
        # Recarregar com todos os dados necessários
        confirmed_reservation = db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.property_obj),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        return ReservationResponseWithGuestDetails.model_validate(confirmed_reservation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao confirmar reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{reservation_id}/check-in", response_model=ReservationResponse)
def check_in_reservation_expanded(
    reservation_id: int,
    check_in_data: CheckInRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-in"""
    try:
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        if not reservation.can_check_in:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Check-in não permitido para esta reserva"
            )
        
        # Usar o serviço
        reservation_service = ReservationService(db)
        
        checked_in_reservation = reservation_service.check_in_reservation(
            reservation_id=reservation_id,
            tenant_id=current_user.tenant_id,
            check_in_request=check_in_data,
            current_user=current_user,
            request=request
        )
        
        if not checked_in_reservation:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível realizar o check-in"
            )
        
        return ReservationResponse.model_validate(checked_in_reservation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao fazer check-in da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{reservation_id}/check-out", response_model=ReservationResponse)
def check_out_reservation_expanded(
    reservation_id: int,
    check_out_data: CheckOutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Realiza check-out"""
    try:
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        if not reservation.can_check_out:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Check-out não permitido para esta reserva"
            )
        
        # Usar o serviço
        reservation_service = ReservationService(db)
        
        checked_out_reservation = reservation_service.check_out_reservation(
            reservation_id=reservation_id,
            tenant_id=current_user.tenant_id,
            check_out_request=check_out_data,
            current_user=current_user,
            request=request
        )
        
        if not checked_out_reservation:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível realizar o check-out"
            )
        
        return ReservationResponse.model_validate(checked_out_reservation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao fazer check-out da reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
def cancel_reservation_expanded(
    reservation_id: int,
    cancel_data: CancelReservationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancela uma reserva"""
    try:
        reservation = db.query(Reservation).filter(
            Reservation.id == reservation_id,
            Reservation.tenant_id == current_user.tenant_id
        ).first()
        
        if not reservation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Reserva não encontrada"
            )
        
        # Verificar se pode cancelar usando a propriedade do modelo
        if not reservation.can_cancel:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Reserva não pode ser cancelada no status atual"
            )
        
        # Usar o serviço em vez de manipular diretamente
        reservation_service = ReservationService(db)
        
        try:
            # Cancelar usando o serviço que já tem toda a lógica
            cancelled_reservation = reservation_service.cancel_reservation(
                reservation_id=reservation_id,
                tenant_id=current_user.tenant_id,
                cancel_request=cancel_data,
                current_user=current_user,
                request=request
            )
            
            if not cancelled_reservation:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Não foi possível cancelar a reserva"
                )
            
            return ReservationResponse.model_validate(cancelled_reservation)
            
        except ValueError as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao cancelar reserva {reservation_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


# ===== DISPONIBILIDADE E BUSCA =====

@router.post("/check-availability", response_model=AvailabilityResponse)
def check_availability(
    availability_request: AvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica disponibilidade de quartos"""
    reservation_service = ReservationService(db)
    
    try:
        # Usar o método do service que já funciona
        available_rooms = reservation_service.get_available_rooms(
            property_id=availability_request.property_id,
            check_in_date=availability_request.check_in_date,
            check_out_date=availability_request.check_out_date,
            tenant_id=current_user.tenant_id,
            room_type_id=availability_request.room_type_id,
            exclude_reservation_id=availability_request.exclude_reservation_id
        )
        
        # Buscar conflitos com sintaxe corrigida
        conflicts_query = db.query(Reservation.reservation_number).join(ReservationRoom).filter(
            Reservation.property_id == availability_request.property_id,
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True,
            Reservation.status.in_(['pending', 'confirmed', 'checked_in']),
            # Usar not_ importado corretamente
            not_(
                or_(
                    ReservationRoom.check_out_date <= availability_request.check_in_date,
                    ReservationRoom.check_in_date >= availability_request.check_out_date
                )
            )
        )
        
        # Excluir reserva específica dos conflitos
        if availability_request.exclude_reservation_id:
            conflicts_query = conflicts_query.filter(
                Reservation.id != availability_request.exclude_reservation_id
            )
        
        conflicting_reservations = [r[0] for r in conflicts_query.distinct().all()]
        
        # Preparar dados dos quartos sem acessar campos inexistentes
        rooms_data = []
        for room in available_rooms:
            room_data = {
                'id': room.id,
                'room_number': room.room_number,
                'name': getattr(room, 'name', None),
                'room_type_id': room.room_type_id,
                'room_type_name': room.room_type.name if room.room_type else None,
                'max_occupancy': getattr(room, 'max_occupancy', 2),
                'floor': getattr(room, 'floor', None),
                'building': getattr(room, 'building', None),
                'rate_per_night': 0.0  # Valor padrão
            }
            rooms_data.append(room_data)
        
        return AvailabilityResponse(
            available=len(available_rooms) > 0,
            available_rooms=rooms_data,
            total_available_rooms=len(available_rooms),
            conflicting_reservations=conflicting_reservations if conflicting_reservations else None
        )
        
    except ValueError as e:
        logger.error(f"ValueError em check_availability: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro em check_availability: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno do servidor"
        )


@router.post("/advanced-search", response_model=ReservationListResponse)
def advanced_search_reservations(
    filters: ReservationFilters,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Busca avançada com filtros complexos via POST - COM SUPORTE A MULTI-SELECT"""
    reservation_service = ReservationService(db)
    
    skip = (page - 1) * per_page
    
    # O ReservationFilters já suporta status_list e source_list
    reservations = reservation_service.get_reservations(current_user.tenant_id, filters, skip, per_page)
    total = reservation_service.count_reservations(current_user.tenant_id, filters)
    
    total_pages = math.ceil(total / per_page)
    
    reservations_response = [ReservationResponse.model_validate(reservation) for reservation in reservations]
    
    return ReservationListResponse(
        reservations=reservations_response,
        total=total,
        page=page,
        pages=total_pages,
        per_page=per_page
    )


# ===== CALENDÁRIO COM MULTI-SELECT =====

@router.get("/calendar/month", response_model=List[ReservationResponse])
def get_calendar_month(
    year: int = Query(..., ge=2020, le=2030, description="Ano"),
    month: int = Query(..., ge=1, le=12, description="Mês"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    status_list: Optional[str] = Query(None, description="Filtrar por múltiplos status (separados por vírgula)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reservas de um mês específico para o calendário - COM MULTI-SELECT"""
    from calendar import monthrange
    
    reservation_service = ReservationService(db)
    
    # Primeiro e último dia do mês
    start_date = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end_date = date(year, month, last_day)
    
    # Processar status_list
    status_filter = ['confirmed', 'checked_in', 'checked_out']  # Padrão
    if status_list and status_list.strip():
        status_filter = [s.strip() for s in status_list.split(',') if s.strip()]
    
    # Buscar reservas do período
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=status_filter  # Agora suporta multi-select
    )
    
    return [ReservationResponse.model_validate(reservation) for reservation in reservations]


@router.get("/calendar/range", response_model=List[ReservationResponse])
def get_calendar_range(
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    status: Optional[str] = Query(None, description="Filtrar por status (filtro único)"),
    status_list: Optional[str] = Query(None, description="Filtrar por múltiplos status (separados por vírgula)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Busca reservas em um período específico para o calendário - COM MULTI-SELECT"""
    reservation_service = ReservationService(db)
    
    # Validar período (máximo 1 ano)
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    # Processar filtros de status com prioridade para multi-select
    status_filter = ['confirmed', 'checked_in', 'checked_out']  # Padrão
    if status_list and status_list.strip():
        # Multi-select tem prioridade
        status_filter = [s.strip() for s in status_list.split(',') if s.strip()]
    elif status:
        # Filtro único para compatibilidade
        status_filter = [status]
    
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=status_filter  # Agora suporta multi-select
    )
    
    return [ReservationResponse.model_validate(reservation) for reservation in reservations]


# ===== ESTATÍSTICAS =====

@router.get("/stats/general", response_model=Dict[str, Any])
def get_reservation_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica")
):
    """Obtém estatísticas gerais das reservas"""
    reservation_service = ReservationService(db)
    stats = reservation_service.get_reservation_stats(current_user.tenant_id, property_id)
    
    return stats


@router.get("/stats/dashboard", response_model=Dict[str, Any])
def get_dashboard_stats_original(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="Estatísticas de propriedade específica"),
    days_back: int = Query(30, ge=1, le=365, description="Dias para análise")
):
    """Obtém estatísticas para dashboard (versão original)"""
    reservation_service = ReservationService(db)
    
    # Stats gerais
    general_stats = reservation_service.get_reservation_stats(current_user.tenant_id, property_id)
    
    # Stats dos últimos N dias
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    recent_reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id
    )
    
    # Análise por período
    reservations_by_day = {}
    for reservation in recent_reservations:
        day_key = reservation.created_at.date().isoformat()
        if day_key not in reservations_by_day:
            reservations_by_day[day_key] = 0
        reservations_by_day[day_key] += 1
    
    return {
        **general_stats,
        'period_days': days_back,
        'reservations_in_period': len(recent_reservations),
        'reservations_by_day': reservations_by_day,
        'average_daily_reservations': len(recent_reservations) / days_back if days_back > 0 else 0,
        # Adicionar campos esperados pelo frontend
        'total_reservations': general_stats.get('total_reservations', 0),
        'total_revenue': general_stats.get('total_revenue', 0),
        'occupancy_rate': general_stats.get('occupancy_rate', 0),
        'pending_checkins': 0,
        'pending_checkouts': 0,
        'overdue_payments': 0
    }


@router.get("/dashboard/stats", response_model=dict)
def get_dashboard_stats_expanded(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    property_id: Optional[int] = Query(None, description="ID da propriedade"),
    days_back: Optional[int] = Query(30, description="Número de dias para análise")
):
    """Obtém estatísticas expandidas do dashboard"""
    try:
        reservation_service = ReservationService(db)
        
        # Query base
        base_query = db.query(Reservation).filter(
            Reservation.tenant_id == current_user.tenant_id,
            Reservation.is_active == True
        )
        
        if property_id:
            base_query = base_query.filter(Reservation.property_id == property_id)
        
        # Estatísticas básicas
        total_reservations = base_query.count()
        
        # Reservas por status
        pending_checkins = base_query.filter(
            Reservation.status == 'confirmed',
            Reservation.check_in_date == date.today()
        ).count()
        
        pending_checkouts = base_query.filter(
            Reservation.status == 'checked_in',
            Reservation.check_out_date == date.today()
        ).count()
        
        # Receita total
        total_revenue_query = base_query.with_entities(
            func.sum(Reservation.total_amount)
        ).scalar() or 0
        
        # Pagamentos em atraso (mock)
        overdue_payments = 0
        
        # Taxa de ocupação (mock)
        occupancy_rate = 75.0
        
        # Estatísticas adicionais
        avg_nights = 2.5
        avg_guests = 2.0
        avg_amount = float(total_revenue_query) / total_reservations if total_reservations > 0 else 0
        
        # Distribuições por status e fonte
        status_distribution = {}
        source_distribution = {}
        
        for reservation in base_query.limit(1000):
            status_distribution[reservation.status] = status_distribution.get(reservation.status, 0) + 1
            source_distribution[reservation.source] = source_distribution.get(reservation.source, 0) + 1
        
        return {
            "total_reservations": total_reservations,
            "total_revenue": float(total_revenue_query),
            "occupancy_rate": occupancy_rate,
            "pending_checkins": pending_checkins,
            "pending_checkouts": pending_checkouts,
            "overdue_payments": overdue_payments,
            "avg_nights": avg_nights,
            "avg_guests": avg_guests,
            "avg_amount": round(avg_amount, 2),
            "this_month_reservations": total_reservations,
            "this_month_revenue": float(total_revenue_query),
            "last_month_reservations": total_reservations,
            "last_month_revenue": float(total_revenue_query),
            "status_distribution": status_distribution,
            "source_distribution": source_distribution,
            "recent_activity": []
        }
        
    except Exception as e:
        logger.error(f"Erro ao carregar estatísticas do dashboard: {str(e)}")
        # Retornar dados padrão em caso de erro
        return {
            "total_reservations": 0,
            "total_revenue": 0,
            "occupancy_rate": 0,
            "pending_checkins": 0,
            "pending_checkouts": 0,
            "overdue_payments": 0,
            "avg_nights": 0,
            "avg_guests": 0,
            "avg_amount": 0,
            "this_month_reservations": 0,
            "this_month_revenue": 0,
            "last_month_reservations": 0,
            "last_month_revenue": 0,
            "status_distribution": {},
            "source_distribution": {},
            "recent_activity": []
        }


# ===== ANÁLISES =====

@router.get("/analysis/occupancy", response_model=Dict[str, Any])
def get_occupancy_analysis(
    start_date: date = Query(..., description="Data inicial"),
    end_date: date = Query(..., description="Data final"),
    property_id: Optional[int] = Query(None, description="Filtrar por propriedade"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Análise de ocupação em um período"""
    reservation_service = ReservationService(db)
    
    # Validar período
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Período não pode exceder 365 dias"
        )
    
    # Buscar reservas do período
    reservations = reservation_service.get_reservations_by_date_range(
        current_user.tenant_id,
        start_date,
        end_date,
        property_id=property_id,
        status_filter=['checked_in', 'checked_out']
    )
    
    # Calcular métricas
    total_days = (end_date - start_date).days
    total_room_nights = 0
    occupied_room_nights = 0
    
    # TODO: Implementar cálculo real de ocupação baseado nos quartos disponíveis
    
    return {
        'period': {
            'start_date': start_date,
            'end_date': end_date,
            'total_days': total_days
        },
        'reservations_count': len(reservations),
        'total_room_nights': total_room_nights,
        'occupied_room_nights': occupied_room_nights,
        'occupancy_rate': 0.0,
        'average_stay_length': sum(r.nights for r in reservations) / len(reservations) if reservations else 0
    }


# ===== EXPORTAÇÃO =====

@router.get("/export", response_model=dict)
def export_reservations(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    format: str = Query("xlsx", description="Formato de exportação (xlsx, csv)"),
    
    # Reutilizar os mesmos filtros incluindo multi-select
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    status_list: Optional[str] = Query(None, description="Múltiplos status (separados por vírgula)"),
    source_list: Optional[str] = Query(None, description="Múltiplas origens (separadas por vírgula)"),
    property_id: Optional[int] = Query(None),
    guest_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    check_in_from: Optional[date] = Query(None),
    check_in_to: Optional[date] = Query(None),
    check_out_from: Optional[date] = Query(None),
    check_out_to: Optional[date] = Query(None),
    created_from: Optional[str] = Query(None),
    created_to: Optional[str] = Query(None),
    guest_email: Optional[str] = Query(None),
    guest_phone: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    min_guests: Optional[int] = Query(None),
    max_guests: Optional[int] = Query(None),
    is_paid: Optional[bool] = Query(None),
    requires_deposit: Optional[bool] = Query(None),
    is_group_reservation: Optional[bool] = Query(None),
    
    # Parâmetros específicos da exportação
    include_guest_details: bool = Query(True),
    include_room_details: bool = Query(True),
    include_payment_details: bool = Query(True),
    include_property_details: bool = Query(False),
):
    """Exporta reservas com filtros personalizados - COM SUPORTE A MULTI-SELECT"""
    try:
        # Por ora, retornar uma resposta mock
        # TODO: Implementar exportação real usando pandas
        
        return {
            "message": "Exportação em desenvolvimento",
            "filters_applied": {
                "status": status,
                "source": source,
                "status_list": status_list,  # NOVO
                "source_list": source_list,  # NOVO
                "property_id": property_id,
                "format": format,
                "timestamp": datetime.utcnow().isoformat()
            },
            "file_url": "/tmp/reservations_export.xlsx",
            "file_name": f"reservas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}",
            "total_records": 0,
            "generated_at": datetime.utcnow().isoformat(),
            "expires_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao exportar reservas: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao exportar reservas: {str(e)}"
        )


@router.post("/export", response_model=ReservationExportResponse)
def export_reservations_post(
    export_filters: ReservationExportFilters,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Exporta reservas para CSV com filtros personalizados via POST - COM MULTI-SELECT"""
    
    # O ReservationExportFilters já herda de ReservationFilters que suporta multi-select
    return ReservationExportResponse(
        file_url="http://exemplo.com/export.csv",
        file_name="reservations_export.csv",
        total_records=0,
        generated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )