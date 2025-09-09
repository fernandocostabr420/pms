# backend/app/services/audit_formatting_service.py

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class AuditFormattingService:
    """
    Serviço para formatação rica de entradas de auditoria.
    Transforma logs brutos em descrições amigáveis e estruturadas.
    """
    
    # Mapeamento de nomes técnicos para nomes amigáveis
    FIELD_NAMES = {
        # Campos de reserva
        'reservation_number': 'Número da Reserva',
        'status': 'Status',
        'check_in_date': 'Data Check-in',
        'check_out_date': 'Data Check-out',
        'actual_check_in': 'Check-in Realizado',
        'actual_check_out': 'Check-out Realizado',
        'total_amount': 'Valor Total',
        'paid_amount': 'Valor Pago',
        'balance_due': 'Saldo Devedor',
        'adults_count': 'Adultos',
        'children_count': 'Crianças',
        'infants_count': 'Bebês',
        'notes': 'Observações',
        'special_requests': 'Solicitações Especiais',
        'source': 'Canal de Origem',
        'confirmed_at': 'Confirmado em',
        'confirmed_by': 'Confirmado por',
        'cancelled_at': 'Cancelado em',
        'cancelled_by': 'Cancelado por',
        'cancellation_reason': 'Motivo do Cancelamento',
        
        # ✅ ADICIONADO: Campo para alterações de quartos
        'quartos': 'Quartos da Reserva',
        
        # Campos de pagamento
        'payment_number': 'Número do Pagamento',
        'amount': 'Valor',
        'payment_method': 'Forma de Pagamento',
        'payment_date': 'Data do Pagamento',
        'reference_number': 'Número de Referência',
        'fee_amount': 'Taxa',
        'fee_percentage': 'Taxa (%)',
        
        # Campos de hóspede
        'full_name': 'Nome Completo',
        'email': 'Email',
        'phone': 'Telefone',
        'document_type': 'Tipo de Documento',
        'document_number': 'CPF/Documento',
        'date_of_birth': 'Data de Nascimento',
        'nationality': 'Nacionalidade',
        'country': 'País',
        'city': 'Cidade',
        'state': 'Estado',
        'address_line1': 'Endereço',
        'postal_code': 'CEP',
        
        # Campos de quarto
        'room_id': 'Quarto',
        'room_type_id': 'Tipo de Quarto',
        'assigned_room': 'Quarto Atribuído',
        'rate_amount': 'Valor da Diária',
        'nights': 'Noites',
        
        # Campos gerais
        'property_id': 'Propriedade',
        'guest_id': 'Hóspede',
        'user_id': 'Usuário',
        'created_at': 'Criado em',
        'updated_at': 'Atualizado em',
    }
    
    # Mapeamento de status para nomes amigáveis
    STATUS_NAMES = {
        'pending': 'Pendente',
        'confirmed': 'Confirmada',
        'checked_in': 'Check-in Feito',
        'checked_out': 'Check-out Feito', 
        'cancelled': 'Cancelada',
        'no_show': 'Não Compareceu',
    }
    
    # Mapeamento de formas de pagamento
    PAYMENT_METHODS = {
        'cash': 'Dinheiro',
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'bank_transfer': 'Transferência Bancária',
        'pix': 'PIX',
        'check': 'Cheque',
        'other': 'Outros',
    }
    
    # Mapeamento de canais de origem
    SOURCE_NAMES = {
        'direct': 'Reserva Direta',
        'booking': 'Booking.com',
        'airbnb': 'Airbnb',
        'expedia': 'Expedia',
        'phone': 'Telefone',
        'email': 'Email',
        'walk_in': 'Walk-in',
        'agent': 'Agente/Operadora',
    }

    def __init__(self):
        pass

    def format_audit_entry(self, log: Any) -> Dict[str, Any]:
        """
        Formata uma entrada de auditoria com descrição detalhada e mudanças estruturadas.
        """
        try:
            # Descrição básica
            description = self._get_basic_description(log)
            
            # Detalhes específicos baseado na tabela e ação
            details = []
            formatted_changes = []
            
            if log.table_name == 'payments':
                description, details, formatted_changes = self._format_payment_entry(log)
            elif log.table_name == 'reservations':
                description, details, formatted_changes = self._format_reservation_entry(log)
            elif log.table_name == 'reservation_rooms':
                description, details, formatted_changes = self._format_room_entry(log)
            elif log.table_name == 'guests':
                description, details, formatted_changes = self._format_guest_entry(log)
            
            # Dados do usuário
            user_data = None
            if log.user:
                user_data = {
                    'id': log.user.id,
                    'name': log.user.full_name,
                    'email': log.user.email,
                    'role': getattr(log.user, 'role', None)
                }
            
            return {
                'id': log.id,
                'timestamp': log.created_at,
                'user': user_data,
                'action': log.action.lower(),
                'description': description,
                'details': details,
                'formatted_changes': formatted_changes,
                'table_name': log.table_name,
                'record_id': log.record_id,
                'old_values': log.old_values,
                'new_values': log.new_values,
                'ip_address': log.ip_address,
                'user_agent': log.user_agent,
            }
            
        except Exception as e:
            logger.error(f"Erro ao formatar entrada de auditoria {log.id}: {e}")
            return self._get_fallback_entry(log)

    def _get_basic_description(self, log: Any) -> str:
        """Gera descrição básica baseada na ação."""
        action_map = {
            'CREATE': 'Criação',
            'UPDATE': 'Atualização', 
            'DELETE': 'Exclusão',
        }
        return action_map.get(log.action, log.action)

    def _format_payment_entry(self, log: Any) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        """Formata entrada de auditoria para pagamentos."""
        details = []
        formatted_changes = []
        
        if log.action == 'CREATE':
            description = "💰 Pagamento registrado"
            
            if log.new_values:
                # Criar formatted_changes para cada campo do pagamento criado
                for field, value in log.new_values.items():
                    if field in ['amount', 'payment_method', 'payment_date', 'notes', 'reference_number', 'fee_amount']:
                        change_detail = self._format_field_change(field, None, value)
                        if change_detail:
                            formatted_changes.append(change_detail)
                
                # Detalhes textuais para exibição rápida
                amount = log.new_values.get('amount')
                if amount:
                    details.append(f"Valor: {self._format_currency(amount)}")
                
                payment_method = log.new_values.get('payment_method')
                if payment_method:
                    method_name = self.PAYMENT_METHODS.get(payment_method, payment_method)
                    details.append(f"Forma: {method_name}")
                
                payment_date = log.new_values.get('payment_date')
                if payment_date:
                    details.append(f"Data: {self._format_date(payment_date)}")
                
                notes = log.new_values.get('notes')
                if notes:
                    details.append(f"Obs: {notes[:50]}{'...' if len(notes) > 50 else ''}")
        
        elif log.action == 'UPDATE':
            description = "💰 Pagamento atualizado"
            
            if log.changed_fields and log.old_values and log.new_values:
                # Tratamento especial para mudanças de status
                if 'status' in log.changed_fields:
                    new_status = log.new_values.get('status')
                    if new_status == 'confirmed':
                        description = "✅ Pagamento confirmado"
                    elif new_status == 'cancelled':
                        description = "❌ Pagamento cancelado"
                
                # Processar todas as mudanças
                for field in log.changed_fields:
                    old_val = log.old_values.get(field)
                    new_val = log.new_values.get(field)
                    
                    change_detail = self._format_field_change(field, old_val, new_val)
                    if change_detail:
                        formatted_changes.append(change_detail)
                        details.append(change_detail['summary'])
        
        elif log.action == 'DELETE':
            description = "🗑️ Pagamento removido"
            
            if log.old_values:
                amount = log.old_values.get('amount')
                if amount:
                    details.append(f"Valor removido: {self._format_currency(amount)}")
                    change_detail = self._format_field_change('amount', amount, None)
                    if change_detail:
                        formatted_changes.append(change_detail)
        
        return description, details, formatted_changes

    def _format_reservation_entry(self, log: Any) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        """Formata entrada de auditoria para reservas."""
        details = []
        formatted_changes = []
        
        if log.action == 'CREATE':
            description = "📋 Reserva criada"
            
            if log.new_values:
                # Criar formatted_changes para campos importantes
                important_fields = ['status', 'check_in_date', 'check_out_date', 'total_amount', 'adults_count', 'children_count']
                for field in important_fields:
                    if field in log.new_values:
                        change_detail = self._format_field_change(field, None, log.new_values[field])
                        if change_detail:
                            formatted_changes.append(change_detail)
                
                # Detalhes textuais
                guest_id = log.new_values.get('guest_id')
                if guest_id:
                    details.append(f"Hóspede ID: {guest_id}")
                
                total_amount = log.new_values.get('total_amount')
                if total_amount:
                    details.append(f"Valor: {self._format_currency(total_amount)}")
                
                check_in = log.new_values.get('check_in_date')
                check_out = log.new_values.get('check_out_date')
                if check_in and check_out:
                    nights = self._calculate_nights(check_in, check_out)
                    details.append(f"Período: {self._format_date(check_in)} a {self._format_date(check_out)} ({nights} noites)")
        
        elif log.action == 'UPDATE':
            description = "📝 Reserva atualizada"
            
            if log.changed_fields and log.old_values and log.new_values:
                # ✅ ADICIONADO: Tratamento especial para mudanças de quartos
                if 'quartos' in log.changed_fields:
                    # Usar a descrição já formatada do log (que vem do nosso código)
                    if log.description and ('🔄' in log.description or '🏨' in log.description):
                        description = log.description  # Usar nossa descrição personalizada
                
                # Tratamento especial para mudanças de status (código existente)
                elif 'status' in log.changed_fields:
                    new_status = log.new_values.get('status')
                    if new_status == 'confirmed':
                        description = "✅ Reserva confirmada"
                    elif new_status == 'checked_in':
                        description = "🏨 Check-in realizado"
                    elif new_status == 'checked_out':
                        description = "🚪 Check-out realizado"
                    elif new_status == 'cancelled':
                        description = "❌ Reserva cancelada"
                
                # Processar todas as mudanças
                for field in log.changed_fields:
                    old_val = log.old_values.get(field)
                    new_val = log.new_values.get(field)
                    
                    change_detail = self._format_field_change(field, old_val, new_val)
                    if change_detail:
                        formatted_changes.append(change_detail)
                        details.append(change_detail['summary'])
        
        elif log.action == 'DELETE':
            description = "🗑️ Reserva removida"
            
            if log.old_values:
                reservation_number = log.old_values.get('reservation_number')
                if reservation_number:
                    details.append(f"Número: {reservation_number}")
                    change_detail = self._format_field_change('reservation_number', reservation_number, None)
                    if change_detail:
                        formatted_changes.append(change_detail)
        
        return description, details, formatted_changes

    def _format_room_entry(self, log: Any) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        """Formata entrada de auditoria para quartos de reserva."""
        details = []
        formatted_changes = []
        
        if log.action == 'CREATE':
            description = "🏠 Quarto adicionado à reserva"
            
            if log.new_values:
                for field, value in log.new_values.items():
                    if field in ['room_id', 'room_type_id', 'rate_amount', 'nights']:
                        change_detail = self._format_field_change(field, None, value)
                        if change_detail:
                            formatted_changes.append(change_detail)
        
        elif log.action == 'UPDATE':
            description = "🏠 Quarto da reserva atualizado"
            
            if log.changed_fields and log.old_values and log.new_values:
                for field in log.changed_fields:
                    old_val = log.old_values.get(field)
                    new_val = log.new_values.get(field)
                    
                    change_detail = self._format_field_change(field, old_val, new_val)
                    if change_detail:
                        formatted_changes.append(change_detail)
                        details.append(change_detail['summary'])
        
        elif log.action == 'DELETE':
            description = "🗑️ Quarto removido da reserva"
            
            if log.old_values:
                room_id = log.old_values.get('room_id')
                if room_id:
                    details.append(f"Quarto removido: {room_id}")
        
        return description, details, formatted_changes

    def _format_guest_entry(self, log: Any) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        """Formata entrada de auditoria para hóspedes."""
        details = []
        formatted_changes = []
        
        if log.action == 'CREATE':
            description = "👤 Hóspede cadastrado"
            
            if log.new_values:
                name = log.new_values.get('full_name')
                if name:
                    details.append(f"Nome: {name}")
                
                email = log.new_values.get('email')
                if email:
                    details.append(f"Email: {email}")
        
        elif log.action == 'UPDATE':
            description = "👤 Dados do hóspede atualizados"
            
            if log.changed_fields and log.old_values and log.new_values:
                for field in log.changed_fields:
                    old_val = log.old_values.get(field)
                    new_val = log.new_values.get(field)
                    
                    change_detail = self._format_field_change(field, old_val, new_val)
                    if change_detail:
                        formatted_changes.append(change_detail)
                        details.append(change_detail['summary'])
        
        return description, details, formatted_changes

    def _format_field_change(self, field: str, old_value: Any, new_value: Any) -> Optional[Dict[str, Any]]:
        """
        Formata a mudança de um campo específico.
        Retorna um dicionário com detalhes estruturados da mudança.
        """
        try:
            field_name = self.FIELD_NAMES.get(field, field.replace('_', ' ').title())
            
            # Formatação específica por tipo de campo
            if field in ['amount', 'total_amount', 'paid_amount', 'balance_due', 'rate_amount', 'fee_amount']:
                old_formatted = self._format_currency(old_value) if old_value is not None else None
                new_formatted = self._format_currency(new_value) if new_value is not None else None
                field_type = 'currency'
                
            elif field in ['check_in_date', 'check_out_date', 'payment_date', 'date_of_birth']:
                old_formatted = self._format_date(old_value) if old_value else None
                new_formatted = self._format_date(new_value) if new_value else None
                field_type = 'date'
                
            elif field in ['created_at', 'updated_at', 'confirmed_at', 'cancelled_at', 'actual_check_in', 'actual_check_out']:
                old_formatted = self._format_datetime(old_value) if old_value else None
                new_formatted = self._format_datetime(new_value) if new_value else None
                field_type = 'datetime'
                
            elif field == 'status':
                old_formatted = self.STATUS_NAMES.get(old_value, old_value) if old_value else None
                new_formatted = self.STATUS_NAMES.get(new_value, new_value) if new_value else None
                field_type = 'status'
                
            elif field == 'payment_method':
                old_formatted = self.PAYMENT_METHODS.get(old_value, old_value) if old_value else None
                new_formatted = self.PAYMENT_METHODS.get(new_value, new_value) if new_value else None
                field_type = 'payment_method'
                
            elif field == 'source':
                old_formatted = self.SOURCE_NAMES.get(old_value, old_value) if old_value else None
                new_formatted = self.SOURCE_NAMES.get(new_value, new_value) if new_value else None
                field_type = 'source'
                
            elif field in ['room_id', 'assigned_room']:
                old_formatted = f"Quarto {old_value}" if old_value else None
                new_formatted = f"Quarto {new_value}" if new_value else None
                field_type = 'room'
                
            # ✅ ADICIONADO: Tratamento especial para alterações de quartos
            elif field == 'quartos':
                old_formatted = old_value if old_value else "Nenhum"
                new_formatted = new_value if new_value else "Nenhum"
                field_type = 'rooms'
                
            else:
                old_formatted = str(old_value) if old_value is not None else None
                new_formatted = str(new_value) if new_value is not None else None
                field_type = 'text'
            
            # Gerar resumo da mudança
            if old_value is None and new_value is not None:
                summary = f"{field_name}: {new_formatted}"
            elif old_value is not None and new_value is None:
                summary = f"{field_name}: {old_formatted} → (removido)"
            elif old_value != new_value:
                summary = f"{field_name}: {old_formatted} → {new_formatted}"
            else:
                return None  # Sem mudança real
            
            return {
                'field': field,
                'field_name': field_name,
                'old_value': old_value,
                'new_value': new_value,
                'old_formatted': old_formatted,
                'new_formatted': new_formatted,
                'summary': summary,
                'type': field_type
            }
            
        except Exception as e:
            logger.error(f"Erro ao formatar mudança do campo {field}: {e}")
            return {
                'field': field,
                'field_name': field,
                'old_value': old_value,
                'new_value': new_value,
                'old_formatted': str(old_value) if old_value is not None else None,
                'new_formatted': str(new_value) if new_value is not None else None,
                'summary': f"{field}: {old_value} → {new_value}",
                'type': 'text'
            }

    def _format_currency(self, value: Any) -> str:
        """Formata valor monetário"""
        if value is None:
            return "R$ 0,00"
        
        try:
            if isinstance(value, str):
                value = float(value)
            elif isinstance(value, Decimal):
                value = float(value)
            
            return f"R$ {value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except (ValueError, TypeError):
            return f"R$ {value}"

    def _format_date(self, value: Any) -> str:
        """Formata data"""
        if value is None:
            return ""
        
        try:
            if isinstance(value, str):
                # Tentar parser string de data
                if 'T' in value:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    value = dt.date()
                else:
                    value = datetime.strptime(value, '%Y-%m-%d').date()
            elif isinstance(value, datetime):
                value = value.date()
            
            if isinstance(value, date):
                return value.strftime('%d/%m/%Y')
        except (ValueError, TypeError):
            pass
        
        return str(value)

    def _format_datetime(self, value: Any) -> str:
        """Formata data e hora"""
        if value is None:
            return ""
        
        try:
            if isinstance(value, str):
                value = datetime.fromisoformat(value.replace('Z', '+00:00'))
            
            if isinstance(value, datetime):
                return value.strftime('%d/%m/%Y às %H:%M')
        except (ValueError, TypeError):
            pass
        
        return str(value)

    def _calculate_nights(self, check_in: Any, check_out: Any) -> int:
        """Calcula número de noites"""
        try:
            if isinstance(check_in, str):
                check_in = datetime.strptime(check_in, '%Y-%m-%d').date()
            if isinstance(check_out, str):
                check_out = datetime.strptime(check_out, '%Y-%m-%d').date()
            
            if isinstance(check_in, datetime):
                check_in = check_in.date()
            if isinstance(check_out, datetime):
                check_out = check_out.date()
            
            return (check_out - check_in).days
        except:
            return 0

    def _get_fallback_entry(self, log: Any) -> Dict[str, Any]:
        """Retorna entrada básica em caso de erro na formatação"""
        return {
            'id': log.id,
            'timestamp': log.created_at,
            'user': {'name': 'Sistema'} if not log.user else {'name': log.user.full_name},
            'action': log.action.lower(),
            'description': f"{log.action} em {log.table_name}",
            'details': [],
            'formatted_changes': [],
            'table_name': log.table_name,
            'record_id': log.record_id,
            'old_values': log.old_values,
            'new_values': log.new_values,
            'ip_address': log.ip_address,
            'user_agent': log.user_agent,
        }

    def group_changes_by_category(self, formatted_changes: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Agrupa mudanças por categoria para melhor organização.
        """
        groups = {
            'status': [],
            'dates': [],
            'financial': [],
            'guests': [],
            'rooms': [],
            'other': []
        }
        
        for change in formatted_changes:
            field = change['field']
            change_type = change.get('type', 'text')
            
            if field == 'status' or change_type == 'status':
                groups['status'].append(change)
            elif change_type in ['date', 'datetime'] or 'date' in field:
                groups['dates'].append(change)
            elif change_type == 'currency' or 'amount' in field:
                groups['financial'].append(change)
            elif 'guest' in field or field in ['adults_count', 'children_count', 'infants_count']:
                groups['guests'].append(change)
            elif change_type in ['room', 'rooms'] or 'room' in field or field == 'quartos':
                groups['rooms'].append(change)
            else:
                groups['other'].append(change)
        
        # Remover grupos vazios
        return {k: v for k, v in groups.items() if v}

    def format_audit_timeline(self, logs: List[Any]) -> List[Dict[str, Any]]:
        """
        Formata múltiplos logs em uma timeline organizada.
        """
        timeline = []
        
        for log in logs:
            formatted_entry = self.format_audit_entry(log)
            
            # Adicionar informações extras para timeline
            formatted_entry['grouped_changes'] = self.group_changes_by_category(
                formatted_entry['formatted_changes']
            )
            
            timeline.append(formatted_entry)
        
        return timeline