# app/models/reservation.py - CORRIGIDO PARA MAPEAMENTOS

from sqlalchemy import Column, String, Date, DateTime, Numeric, Integer, Text, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship, validates
from datetime import datetime, date
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class Reservation(BaseModel, TenantMixin):
    """
    Modelo de Reserva - reservas de quartos pelos hóspedes.
    Multi-tenant: cada tenant mantém suas próprias reservas.
    """
    __tablename__ = "reservations"
    
    # Identificação da reserva
    reservation_number = Column(String(50), nullable=False, unique=True, index=True)  # RES-2025-001
    
    # Relacionamentos principais
    guest_id = Column(Integer, ForeignKey('guests.id'), nullable=False, index=True)
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    
    # Período da reserva
    check_in_date = Column(Date, nullable=False, index=True)
    check_out_date = Column(Date, nullable=False, index=True)
    
    # Status da reserva
    status = Column(String(20), nullable=False, default="pending", index=True)
    # pending, confirmed, checked_in, checked_out, cancelled, no_show, booking
    
    # Informações dos hóspedes
    adults = Column(Integer, default=1, nullable=False)
    children = Column(Integer, default=0, nullable=False) 
    total_guests = Column(Integer, default=1, nullable=False)
    
    # Valores financeiros
    room_rate = Column(Numeric(10, 2), nullable=True)        # Diária base
    total_amount = Column(Numeric(10, 2), nullable=True)     # Valor total
    paid_amount = Column(Numeric(10, 2), default=0, nullable=False)  # Valor pago (DEPRECATED - usar payments)
    discount = Column(Numeric(10, 2), default=0, nullable=False)     # Desconto
    taxes = Column(Numeric(10, 2), default=0, nullable=False)        # Impostos/taxas
    
    # Origem da reserva
    source = Column(String(50), nullable=True, index=True)   # direct, booking, airbnb, room_map, etc.
    source_reference = Column(String(100), nullable=True)   # ID externo da reserva
    
    # ✅ NOVO: Estacionamento
    parking_requested = Column(Boolean, default=False, nullable=False)  # Solicita estacionamento
    
    # Datas importantes
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_date = Column(DateTime, nullable=True)
    checked_in_date = Column(DateTime, nullable=True)
    checked_out_date = Column(DateTime, nullable=True)
    cancelled_date = Column(DateTime, nullable=True)
    
    # Observações e requisições
    guest_requests = Column(Text, nullable=True)      # Pedidos especiais do hóspede
    internal_notes = Column(Text, nullable=True)      # Notas internas do hotel
    cancellation_reason = Column(Text, nullable=True) # Motivo do cancelamento
    
    # Metadados flexíveis
    extra_data = Column(JSON, nullable=True)  # Dados extras específicos do canal/integração
    preferences = Column(JSON, nullable=True)  # Preferências específicas desta reserva
    
    # Flags de controle
    is_group_reservation = Column(Boolean, default=False)  # Reserva em grupo
    requires_deposit = Column(Boolean, default=False)      # Exige depósito
    deposit_paid = Column(Boolean, default=False)          # Depósito pago
    
    # Relacionamentos
    guest = relationship("Guest", back_populates="reservations")
    property_obj = relationship("Property")
    reservation_rooms = relationship("ReservationRoom", back_populates="reservation", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="reservation", cascade="all, delete-orphan")
    
    # ✅ NOVOS MAPEAMENTOS PARA CORRIGIR PROBLEMAS
    
    # Mapeamento de status válidos
    _VALID_STATUSES = {
        'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'booking'
    }
    
    # Mapeamento de status para display
    _STATUS_DISPLAY_MAP = {
        'pending': 'Pendente',
        'confirmed': 'Confirmada',
        'checked_in': 'Check-in Realizado',
        'checked_out': 'Check-out Realizado',
        'cancelled': 'Cancelada',
        'no_show': 'No-show',
        'booking': 'Reserva Externa'  # ✅ NOVO: Para booking.com não confirmadas
    }
    
    # Mapeamento de origens válidas
    _VALID_SOURCES = {
        'direct', 'direct_booking', 'website', 'phone', 'email', 'walk_in',
        'booking', 'booking.com', 'airbnb', 'expedia', 'hotels.com', 'agoda',
        'room_map', 'dashboard', 'admin', 'agent', 'social_media', 'referral'
    }
    
    # Mapeamento de origens para display
    _SOURCE_DISPLAY_MAP = {
        'direct': 'Reserva Direta',
        'direct_booking': 'Reserva Direta',
        'website': 'Site Próprio',
        'phone': 'Telefone',
        'email': 'Email',
        'walk_in': 'Walk-in',
        'booking': 'Booking.com',
        'booking.com': 'Booking.com',
        'airbnb': 'Airbnb',
        'expedia': 'Expedia',
        'hotels.com': 'Hotels.com',
        'agoda': 'Agoda',
        'room_map': 'Mapa de Quartos',  # ✅ NOVO: Para reservas criadas pelo mapa
        'dashboard': 'Dashboard',
        'admin': 'Administração',
        'agent': 'Agente/Operadora',
        'social_media': 'Redes Sociais',
        'referral': 'Indicação',
    }
    
    # Aliases para normalização
    _SOURCE_ALIASES = {
        'booking.com': 'booking',
        'bookingcom': 'booking',
        'room_map': 'room_map',
        'roommap': 'room_map',
        'mapa_quartos': 'room_map',
        'direct_booking': 'direct',
        'direto': 'direct',
        'telefone': 'phone',
        'e-mail': 'email',
        'walk-in': 'walk_in',
        'walkin': 'walk_in',
    }

    def __repr__(self):
        return (f"<Reservation(id={self.id}, number='{self.reservation_number}', "
                f"guest='{self.guest.full_name if self.guest else 'N/A'}', "
                f"dates={self.check_in_date}-{self.check_out_date}, status='{self.status}')>")
    
    # ✅ VALIDADORES PARA NORMALIZAÇÃO AUTOMÁTICA
    
    @validates('status')
    def validate_status(self, key, status):
        """Valida e normaliza status da reserva"""
        if not status:
            return 'pending'
        
        status_lower = status.lower().strip()
        
        # Se já é válido, retornar
        if status_lower in self._VALID_STATUSES:
            return status_lower
        
        # Normalizar aliases comuns
        status_aliases = {
            'check_in': 'checked_in',
            'checkin': 'checked_in',
            'check-in': 'checked_in',
            'check_out': 'checked_out',
            'checkout': 'checked_out',
            'check-out': 'checked_out',
            'canceled': 'cancelled',
            'no-show': 'no_show',
            'noshow': 'no_show',
            'reserva_externa': 'booking',
        }
        
        normalized = status_aliases.get(status_lower)
        if normalized:
            return normalized
        
        # Se não reconhecido, usar pending como padrão
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Status desconhecido: {status}, usando 'pending'")
        return 'pending'

    @validates('source')
    def validate_source(self, key, source):
        """Valida e normaliza origem da reserva"""
        if not source:
            return 'direct'
        
        source_lower = source.lower().strip()
        
        # Se já é válido, retornar
        if source_lower in self._VALID_SOURCES:
            return source_lower
        
        # Aplicar aliases
        normalized = self._SOURCE_ALIASES.get(source_lower)
        if normalized:
            return normalized
        
        # Se não reconhecido, manter como está mas logar
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Origem desconhecida: {source}")
        return source_lower

    # ✅ PROPRIEDADES MELHORADAS

    @property
    def nights(self):
        """Número de noites da reserva"""
        if not self.check_in_date or not self.check_out_date:
            return 0
        return (self.check_out_date - self.check_in_date).days

    @property
    def total_paid(self):
        """Total efetivamente pago (apenas pagamentos confirmados)"""
        if not self.payments:
            return Decimal('0')
        confirmed_payments = [p for p in self.payments if p.status == "confirmed" and not p.is_refund]
        return sum((p.amount for p in confirmed_payments), Decimal('0'))

    @property
    def total_refunded(self):
        """Total estornado"""
        if not self.payments:
            return Decimal('0')
        refunds = [p for p in self.payments if p.status == "confirmed" and p.is_refund]
        return sum((p.amount for p in refunds), Decimal('0'))

    @property
    def balance_due(self):
        """Saldo devedor baseado nos pagamentos reais"""
        if not self.total_amount:
            return Decimal('0')
        return self.total_amount - self.total_paid + self.total_refunded

    @property
    def balance_due_legacy(self):
        """Saldo devedor usando campo paid_amount (compatibilidade)"""
        if not self.total_amount:
            return Decimal('0')
        return self.total_amount - self.paid_amount
    
    @property
    def is_paid(self):
        """Verifica se a reserva está quitada"""
        return self.balance_due <= 0
    
    @property
    def payment_status(self):
        """Status do pagamento baseado nos pagamentos reais"""
        if not self.total_amount or self.total_amount == 0:
            return "no_payment_required"
        
        balance = self.balance_due
        total_paid = self.total_paid
        
        if balance <= 0:
            return "paid"
        elif total_paid > 0:
            return "partial"
        else:
            return "unpaid"
    
    @property
    def last_payment_date(self):
        """Data do último pagamento confirmado"""
        confirmed_payments = [p for p in self.payments if p.status == "confirmed"]
        if not confirmed_payments:
            return None
        return max(p.payment_date for p in confirmed_payments)
    
    @property
    def payment_count(self):
        """Número total de pagamentos (exceto estornos)"""
        return len([p for p in self.payments if not p.is_refund and p.status == "confirmed"])
    
    @property
    def status_display(self):
        """Status formatado para exibição - CORRIGIDO"""
        return self._STATUS_DISPLAY_MAP.get(self.status, self.status.replace('_', ' ').title())
    
    @property
    def source_display(self):
        """✅ NOVO: Origem formatada para exibição"""
        if not self.source:
            return 'Não Informado'
        return self._SOURCE_DISPLAY_MAP.get(self.source, self.source.replace('_', ' ').title())
    
    @property
    def can_check_in(self):
        """Verifica se pode fazer check-in"""
        today = date.today()
        return (
            self.status in ["pending", "confirmed"] and 
            self.check_in_date <= today and
            self.is_active
        )
    
    @property
    def can_check_out(self):
        """Verifica se pode fazer check-out"""
        return self.status == "checked_in" and self.is_active
    
    @property
    def can_cancel(self):
        """Verifica se pode ser cancelada"""
        return self.status in ["pending", "confirmed"] and self.is_active
    
    @property
    def is_current(self):
        """Verifica se é uma reserva atual (hóspede no hotel)"""
        today = date.today()
        return (
            self.status == "checked_in" and
            self.check_in_date <= today <= self.check_out_date and
            self.is_active
        )
    
    # ✅ NOVO: Propriedade para identificação visual de estacionamento
    @property
    def parking_display(self):
        """Status do estacionamento formatado para exibição"""
        return "Solicitado" if self.parking_requested else None
    
    # ✅ NOVOS MÉTODOS PARA SUPORTE A FILTROS FLEXÍVEIS
    
    @classmethod
    def normalize_status_for_search(cls, status: str) -> str:
        """Normaliza status para busca flexível"""
        if not status:
            return status
        
        status_lower = status.lower().strip()
        
        # Mapeamentos de busca flexível
        search_map = {
            'pendente': 'pending',
            'confirmada': 'confirmed',
            'check-in': 'checked_in',
            'checkin': 'checked_in',
            'check_in': 'checked_in',
            'check-out': 'checked_out',
            'checkout': 'checked_out',
            'check_out': 'checked_out',
            'cancelada': 'cancelled',
            'canceled': 'cancelled',
            'no-show': 'no_show',
            'noshow': 'no_show',
            'reserva_externa': 'booking',
            'booking': 'booking',
        }
        
        return search_map.get(status_lower, status_lower)
    
    @classmethod
    def normalize_source_for_search(cls, source: str) -> str:
        """Normaliza origem para busca flexível"""
        if not source:
            return source
        
        source_lower = source.lower().strip()
        
        # Mapeamentos de busca flexível
        search_map = {
            'booking.com': 'booking',
            'bookingcom': 'booking',
            'room_map': 'room_map',
            'roommap': 'room_map',
            'mapa_quartos': 'room_map',
            'mapa': 'room_map',
            'direct_booking': 'direct',
            'direto': 'direct',
            'direct': 'direct',
            'telefone': 'phone',
            'fone': 'phone',
            'e-mail': 'email',
            'mail': 'email',
            'walk-in': 'walk_in',
            'walkin': 'walk_in',
            'presencial': 'walk_in',
        }
        
        return search_map.get(source_lower, source_lower)
    
    @classmethod
    def get_status_variations(cls, canonical_status: str) -> list:
        """Retorna todas as variações possíveis de um status para busca"""
        variations_map = {
            'pending': ['pending', 'pendente'],
            'confirmed': ['confirmed', 'confirmada'],
            'checked_in': ['checked_in', 'check_in', 'checkin', 'check-in'],
            'checked_out': ['checked_out', 'check_out', 'checkout', 'check-out'],
            'cancelled': ['cancelled', 'canceled', 'cancelada'],
            'no_show': ['no_show', 'noshow', 'no-show'],
            'booking': ['booking', 'reserva_externa'],
        }
        
        return variations_map.get(canonical_status, [canonical_status])
    
    @classmethod
    def get_source_variations(cls, canonical_source: str) -> list:
        """Retorna todas as variações possíveis de uma origem para busca"""
        variations_map = {
            'booking': ['booking', 'booking.com', 'bookingcom'],
            'room_map': ['room_map', 'roommap', 'mapa_quartos', 'mapa'],
            'direct': ['direct', 'direct_booking', 'direto'],
            'phone': ['phone', 'telefone', 'fone'],
            'email': ['email', 'e-mail', 'mail'],
            'walk_in': ['walk_in', 'walkin', 'walk-in', 'presencial'],
        }
        
        return variations_map.get(canonical_source, [canonical_source])


class ReservationRoom(BaseModel):
    """
    Modelo para vincular reservas aos quartos específicos.
    Permite reservas multi-quarto e mudanças de quarto.
    """
    __tablename__ = "reservation_rooms"
    
    # Relacionamentos
    reservation_id = Column(Integer, ForeignKey('reservations.id'), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False, index=True)
    
    # Período específico (pode diferir da reserva principal em casos de mudança)
    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    
    # Preços específicos por quarto/período
    rate_per_night = Column(Numeric(10, 2), nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=True)
    
    # Status específico do quarto
    status = Column(String(20), default="reserved", nullable=False)
    # reserved, occupied, checked_out, cancelled
    
    # Observações específicas
    notes = Column(Text, nullable=True)
    
    # Relacionamentos
    reservation = relationship("Reservation", back_populates="reservation_rooms")
    room = relationship("Room")
    
    def __repr__(self):
        return (f"<ReservationRoom(reservation_id={self.reservation_id}, "
                f"room_id={self.room_id}, dates={self.check_in_date}-{self.check_out_date})>")
    
    @property
    def nights(self):
        """Número de noites neste quarto"""
        return (self.check_out_date - self.check_in_date).days