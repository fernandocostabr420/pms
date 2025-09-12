# backend/app/services/voucher_service.py - BASEADO NO CÓDIGO ORIGINAL

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
    """Serviço para vouchers em formato paisagem - versão baseada no original"""
    
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
        """Prepara dados usando valores corretos do sistema"""
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
        payment_data = detailed_data.get('payment', {})
        
        # Formatar hóspedes
        adults = detailed_data.get('adults', 0)
        children = detailed_data.get('children', 0)
        guests_text = f"{adults} Adulto{'s' if adults != 1 else ''}"
        if children > 0:
            guests_text += f" e {children} Criança{'s' if children != 1 else ''}"
        
        # Formatar tipo do quarto
        rooms_data = detailed_data.get('rooms', [])
        room_type = "Standard"
        room_number = "N/A"
        if rooms_data and len(rooms_data) > 0:
            first_room = rooms_data[0]
            if first_room.get('room_type_name') and first_room.get('room_type_name') != 'N/A':
                room_type = first_room.get('room_type_name', 'Standard')
            if first_room.get('room_number'):
                room_number = first_room.get('room_number')
        
        # Calcular noites corretamente
        check_in_str = detailed_data.get('check_in_date', '')
        check_out_str = detailed_data.get('check_out_date', '')
        nights = 1
        
        try:
            if check_in_str and check_out_str:
                # Converter para objetos de data
                if isinstance(check_in_str, str):
                    check_in_date = datetime.fromisoformat(check_in_str.replace('Z', '+00:00')).date()
                else:
                    check_in_date = check_in_str if hasattr(check_in_str, 'year') else check_in_str.date()
                
                if isinstance(check_out_str, str):
                    check_out_date = datetime.fromisoformat(check_out_str.replace('Z', '+00:00')).date()
                else:
                    check_out_date = check_out_str if hasattr(check_out_str, 'year') else check_out_str.date()
                
                nights = (check_out_date - check_in_date).days
                if nights <= 0:
                    nights = 1
        except Exception as e:
            logger.warning(f"Erro no cálculo de noites: {e}")
            nights = 1
        
        # Usar valores corretos do payment_data
        total_amount = payment_data.get('total_amount', 0) or detailed_data.get('total_amount', 0)
        paid_amount = payment_data.get('paid_amount', 0) or 0
        balance_due = payment_data.get('balance_due', 0) or 0
        
        # Buscar método de pagamento usando a mesma lógica da página detalhada
        payment_method = "Nenhum pagamento"
        payments_list = detailed_data.get('payments', [])
        
        if payments_list and len(payments_list) > 0:
            # Os pagamentos vêm direto do modelo, não do PaymentResponse
            # Vamos acessar o primeiro pagamento (mais recente)
            latest_payment = payments_list[0]
            
            # Se é um objeto Payment, usar as properties diretamente
            if hasattr(latest_payment, 'payment_method_display'):
                payment_method = latest_payment.payment_method_display
            elif hasattr(latest_payment, 'payment_method'):
                # Aplicar a mesma formatação que existe no modelo Payment
                method_raw = latest_payment.payment_method
                method_map = {
                    "pix": "PIX",
                    "credit_card": "Cartão de Crédito", 
                    "debit_card": "Cartão de Débito",
                    "bank_transfer": "Transferência Bancária",
                    "cash": "Dinheiro",
                    "check": "Cheque",
                    "other": "Outro"
                }
                payment_method = method_map.get(method_raw, method_raw.title() if method_raw else "Não especificado")
            # Se é um dict (improvável, mas para ser seguro)
            elif isinstance(latest_payment, dict):
                method_display = latest_payment.get('payment_method_display')
                if method_display and method_display not in ['N/A', '', None]:
                    payment_method = method_display
                else:
                    method_raw = latest_payment.get('payment_method')
                    if method_raw and method_raw not in ['N/A', '', None]:
                        method_map = {
                            "pix": "PIX",
                            "credit_card": "Cartão de Crédito", 
                            "debit_card": "Cartão de Débito",
                            "bank_transfer": "Transferência Bancária",
                            "cash": "Dinheiro",
                            "check": "Cheque",
                            "other": "Outro"
                        }
                        payment_method = method_map.get(method_raw.lower(), method_raw.title())
        
        return {
            'property_name': property_data.get('name', 'Hotel'),
            'reservation_number': detailed_data.get('reservation_number', 'N/A'),
            'guest_name': guest_data.get('full_name', 'N/A'),
            'guests_text': guests_text,
            'room_type': room_type,
            'room_number': room_number,
            'check_in_date': format_date(detailed_data.get('check_in_date')),
            'check_out_date': format_date(detailed_data.get('check_out_date')),
            'nights': nights,
            'total_amount': format_currency(total_amount),
            'paid_amount': format_currency(paid_amount),
            'balance_due': format_currency(balance_due),
            'payment_method': payment_method,
            'property_phone': property_data.get('phone', 'N/A'),
            'property_email': property_data.get('email', 'contato@hotel.com'),
            'guest_email': guest_data.get('email', 'N/A'),
            'property_address': property_data.get('address_line1', 'N/A'),
            'property_city': property_data.get('city', 'N/A'),
            'status': detailed_data.get('status', 'confirmed').upper(),
            'source': detailed_data.get('source', 'PMS').upper()
        }
    
    def _generate_landscape_pdf(self, data: Dict[str, Any]) -> bytes:
        """Gera PDF em formato paisagem - baseado no código original"""
        buffer = io.BytesIO()
        
        # Configuração da página em paisagem
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),  # 297mm x 210mm
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=12*mm,
            bottomMargin=12*mm
        )
        
        elements = []
        
        # === CABEÇALHO COM ESPAÇO PARA LOGO ===
        
        # Criar tabela para logo + título
        header_data = [
            [
                # Espaço reservado para logo (50mm x 35mm)
                Paragraph("LOGO<br/>Inserir logo aqui", ParagraphStyle('LogoSpace', 
                                               fontSize=12, 
                                               alignment=TA_CENTER,
                                               textColor=colors.HexColor('#e91e63'))),
                # Título da propriedade
                Paragraph(f"<b>{data['property_name']}</b><br/>Voucher de Reserva", 
                         ParagraphStyle('HeaderTitle', 
                                      fontSize=16, 
                                      fontName='Helvetica-Bold',
                                      textColor=colors.HexColor('#2563eb'),
                                      alignment=TA_CENTER))
            ]
        ]
        
        header_table = Table(header_data, colWidths=[50*mm, 210*mm])
        header_table.setStyle(TableStyle([
            # Espaço da logo
            ('BOX', (0, 0), (0, 0), 2, colors.HexColor('#e91e63')),
            ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#fce4ec')),
            
            # Título
            ('VALIGN', (1, 0), (1, 0), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('LEFTPADDING', (1, 0), (1, 0), 20),
            
            # Geral
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(header_table)
        elements.append(Spacer(1, 15))
        
        # === STATUS DA RESERVA ===
        status_style = ParagraphStyle(
            'Status',
            fontSize=12,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#059669'),
            alignment=TA_CENTER,
            spaceAfter=15
        )
        
        status_text = f"✓ RESERVA CONFIRMADA - {data['reservation_number']}"
        elements.append(Paragraph(status_text, status_style))
        
        # === LAYOUT EM DUAS COLUNAS ===
        
        # COLUNA 1: Informações principais
        main_info_data = [
            ["HÓSPEDE", data['guest_name']],
            ["OCUPAÇÃO", data['guests_text']],
            ["QUARTO", f"{data['room_type']} - {data['room_number']}"],
            ["CHECK-IN", data['check_in_date']],
            ["CHECK-OUT", data['check_out_date']],
            ["ESTADIA", f"{data['nights']} noite{'s' if data['nights'] != 1 else ''}"]
        ]
        
        main_table = Table(main_info_data, colWidths=[35*mm, 85*mm])
        main_table.setStyle(TableStyle([
            # Cabeçalhos
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#334155')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, -1), 9),
            
            # Valores
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (1, 0), (1, -1), 9),
            
            # Layout
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ]))
        
        # COLUNA 2: Informações financeiras (SEM STATUS PAGAMENTO)
        financial_data = [
            ["VALOR TOTAL", data['total_amount']],
            ["VALOR PAGO", data['paid_amount']],
            ["SALDO PENDENTE", data['balance_due']],
            ["MÉTODO PAGAMENTO", data['payment_method']]
        ]
        
        financial_table = Table(financial_data, colWidths=[45*mm, 75*mm])
        financial_table.setStyle(TableStyle([
            # Cabeçalhos
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#fef3c7')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#92400e')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, -1), 9),
            
            # Valores financeiros (3 primeiras linhas)
            ('TEXTCOLOR', (1, 0), (1, 2), colors.HexColor('#1e293b')),
            ('FONTNAME', (1, 0), (1, 2), 'Helvetica-Bold'),
            ('FONTSIZE', (1, 0), (1, 2), 9),
            
            # Método de pagamento (última linha)
            ('TEXTCOLOR', (1, 3), (1, 3), colors.HexColor('#475569')),
            ('FONTNAME', (1, 3), (1, 3), 'Helvetica'),
            ('FONTSIZE', (1, 3), (1, 3), 9),
            
            # Layout
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ]))
        
        # Combinar as duas colunas lado a lado
        combined_data = [[main_table, financial_table]]
        combined_table = Table(combined_data, colWidths=[125*mm, 125*mm])
        combined_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(combined_table)
        elements.append(Spacer(1, 20))
        
        # === SEÇÃO DE CONTATO CENTRALIZADA ===
        contact_header_style = ParagraphStyle(
            'ContactHeader',
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#2563eb'),
            alignment=TA_CENTER,
            spaceAfter=8
        )
        
        contact_style = ParagraphStyle(
            'Contact',
            fontSize=10,
            fontName='Helvetica',
            textColor=colors.HexColor('#475569'),
            alignment=TA_CENTER,
            spaceAfter=8
        )
        
        elements.append(Paragraph("CENTRAL DE ATENDIMENTO", contact_header_style))
        
        # Usar telefone e email da PROPRIEDADE
        contact_text = f"📞 {data['property_phone']} • ✉️ {data['property_email']}"
        elements.append(Paragraph(contact_text, contact_style))
        
        # === ENDEREÇO CENTRALIZADO ===
        address_style = ParagraphStyle(
            'Address',
            fontSize=9,
            fontName='Helvetica',
            textColor=colors.HexColor('#64748b'),
            alignment=TA_CENTER,
            spaceAfter=12
        )
        
        address_text = f"📍 {data['property_address']}, {data['property_city']}"
        elements.append(Paragraph(address_text, address_style))
        
        # === FOOTER CENTRALIZADO ===
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=8,
            fontName='Helvetica',
            textColor=colors.HexColor('#94a3b8'),
            alignment=TA_CENTER,
            spaceAfter=3
        )
        
        # Informações técnicas
        footer_info = f"Reserva {data['reservation_number']} • Status: {data['status']} • Origem: {data['source']}"
        elements.append(Paragraph(footer_info, footer_style))
        
        footer_tech = "Gerado pelo Sistema PMS • " + datetime.now().strftime('%d/%m/%Y às %H:%M')
        elements.append(Paragraph(footer_tech, footer_style))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    def get_voucher_filename(self, reservation_number: str) -> str:
        """Nome do arquivo com timestamp"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"voucher_{reservation_number}_{timestamp}.pdf"


# Alias para compatibilidade
VoucherService = LandscapeVoucherService