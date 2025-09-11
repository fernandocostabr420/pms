# backend/app/services/voucher_service.py - FORMATO PAISAGEM CLEAN

import io
import logging
from datetime import datetime, date
from typing import Dict, Any, Optional
from decimal import Decimal

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from sqlalchemy.orm import Session
from app.services.reservation_service import ReservationService

logger = logging.getLogger(__name__)


class LandscapeVoucherService:
    """Serviço para vouchers em formato paisagem"""
    
    def __init__(self, db: Session):
        self.db = db
        self.reservation_service = ReservationService(db)
    
    def generate_reservation_voucher(self, reservation_id: int, tenant_id: int) -> bytes:
        """Gera voucher em formato paisagem"""
        try:
            detailed_data = self.reservation_service.get_reservation_detailed(
                reservation_id, tenant_id
            )
            
            if not detailed_data:
                raise ValueError(f"Reserva {reservation_id} não encontrada")
            
            voucher_data = self._prepare_data(detailed_data)
            pdf_content = self._generate_landscape_pdf(voucher_data)
            
            logger.info(f"Voucher paisagem gerado para reserva {reservation_id}")
            return pdf_content
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Erro ao gerar voucher paisagem: {str(e)}")
            raise Exception(f"Erro na geração do voucher: {str(e)}")
    
    def _prepare_data(self, detailed_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepara dados simples"""
        def format_date(date_value):
            if not date_value:
                return "N/A"
            if hasattr(date_value, 'strftime'):
                return date_value.strftime('%d/%m/%Y')
            elif isinstance(date_value, str):
                try:
                    dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    return dt.strftime('%d/%m/%Y')
                except:
                    return date_value
            return str(date_value)
        
        def format_currency(value):
            if value is None:
                return "R$ 0,00"
            try:
                return f"R$ {float(value):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            except:
                return "R$ 0,00"
        
        guest_data = detailed_data.get('guest', {})
        property_data = detailed_data.get('property', {})
        
        # Formatar hóspedes
        adults = detailed_data.get('adults', 0)
        children = detailed_data.get('children', 0)
        guests_text = f"{adults} Adulto{'s' if adults != 1 else ''}"
        if children > 0:
            guests_text += f" e {children} Criança{'s' if children != 1 else ''}"
        
        # Formatar tipo do quarto
        rooms_data = detailed_data.get('rooms', [])
        room_type = "Standard"
        if rooms_data and rooms_data[0].get('room_type_name') != 'N/A':
            room_type = rooms_data[0].get('room_type_name', 'Standard')
        
        return {
            'property_name': property_data.get('name', 'Hotel'),
            'reservation_number': detailed_data.get('reservation_number', 'N/A'),
            'guest_name': guest_data.get('full_name', 'N/A'),
            'guests_text': guests_text,
            'room_type': room_type,
            'check_in_date': format_date(detailed_data.get('check_in_date')),
            'check_out_date': format_date(detailed_data.get('check_out_date')),
            'total_amount': format_currency(detailed_data.get('total_amount')),
            'paid_amount': format_currency(detailed_data.get('paid_amount')),
            'property_phone': property_data.get('phone', 'N/A'),
            'guest_email': guest_data.get('email', 'N/A'),
            'property_address': property_data.get('address_line1', 'N/A'),
            'property_city': property_data.get('city', 'N/A')
        }
    
    def _generate_landscape_pdf(self, data: Dict[str, Any]) -> bytes:
        """Gera PDF em formato paisagem"""
        buffer = io.BytesIO()
        
        # IMPORTANTE: Usar landscape desde o início
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),  # 297mm x 210mm
            rightMargin=25*mm,
            leftMargin=25*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        elements = []
        
        # Título
        title_style = ParagraphStyle(
            'Title',
            fontSize=14,
            fontName='Helvetica-Bold',
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=20
        )
        
        title_text = f"{data['property_name']} - Voucher {data['reservation_number']}"
        elements.append(Paragraph(title_text, title_style))
        
        # Confirmação
        confirm_style = ParagraphStyle(
            'Confirm',
            fontSize=12,
            fontName='Helvetica',
            textColor=colors.black,
            alignment=TA_LEFT,
            spaceAfter=15
        )
        elements.append(Paragraph("Reserva foi confirmada!", confirm_style))
        
        # Linha separadora
        line_table = Table([['']]), 
        line_table[0].setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.grey),
            ('TOPPADDING', (0, 0), (-1, 0), 0),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ]))
        elements.append(line_table[0])
        elements.append(Spacer(1, 10))
        
        # Estilo para labels e valores
        label_style = ParagraphStyle(
            'Label',
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=colors.black,
            alignment=TA_LEFT
        )
        
        value_style = ParagraphStyle(
            'Value',
            fontSize=11,
            fontName='Helvetica',
            textColor=colors.black,
            alignment=TA_LEFT
        )
        
        # Informações principais
        info_data = [
            [Paragraph("Responsável:", label_style), Paragraph(data['guest_name'], value_style)],
            [Paragraph("Hóspedes:", label_style), Paragraph(data['guests_text'], value_style)],
            [Paragraph("UH:", label_style), Paragraph(data['room_type'], value_style)],
            [Paragraph("Check-in:", label_style), Paragraph(data['check_in_date'], value_style)],
            [Paragraph("Check-out:", label_style), Paragraph(data['check_out_date'], value_style)],
            [Paragraph("Total:", label_style), Paragraph(data['total_amount'], value_style)],
            [Paragraph("Valor pago (R$):", label_style), Paragraph(data['paid_amount'], value_style)],
        ]
        
        info_table = Table(info_data, colWidths=[50*mm, 150*mm], rowHeights=[8*mm]*7)
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        
        elements.append(info_table)
        elements.append(Spacer(1, 20))
        
        # Seção de contato
        contact_header_style = ParagraphStyle(
            'ContactHeader',
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=8
        )
        
        contact_style = ParagraphStyle(
            'Contact',
            fontSize=11,
            fontName='Helvetica',
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=15
        )
        
        elements.append(Paragraph("DÚVIDAS? FALE COM NOSSA CENTRAL DE RESERVAS:", contact_header_style))
        
        contact_text = f"{data['property_phone']} / {data['guest_email']}"
        elements.append(Paragraph(contact_text, contact_style))
        
        # Linha separadora final
        final_line_table = Table([['']]),
        final_line_table[0].setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.grey),
            ('TOPPADDING', (0, 0), (-1, 0), 0),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ]))
        elements.append(final_line_table[0])
        
        # Endereço
        address_style = ParagraphStyle(
            'Address',
            fontSize=10,
            fontName='Helvetica',
            textColor=colors.grey,
            alignment=TA_CENTER,
            spaceAfter=15
        )
        
        address_text = f"{data['property_address']}, {data['property_city']}"
        elements.append(Paragraph(address_text, address_style))
        
        # Footer
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=9,
            fontName='Helvetica',
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        
        elements.append(Paragraph("Enviado com ♥ por Sistema PMS", footer_style))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    def get_voucher_filename(self, reservation_number: str) -> str:
        """Nome do arquivo"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"voucher_{reservation_number}_{timestamp}.pdf"


# Alias para compatibilidade
VoucherService = LandscapeVoucherService