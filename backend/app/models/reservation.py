# backend/app/models/reservation.py

from sqlalchemy import Column, String, Date, DateTime, Numeric, Integer, Text, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
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
    # pending, confirmed, checked_in, checked_out, cancelled, no_show
    
    # Informações dos hóspedes
    adults = Column(Integer, default=1, nullable=False)
    children = Column(Integer, default=0, nullable=False) 
    total_guests = Column(Integer, default=1, nullable=False)
    
    # Valores financeiros
    room_rate = Column(Numeric(10, 2), nullable=True)        # Diária base
    total_amount = Column(Numeric(10, 2), nullable=True)     # Valor total
    paid_amount = Column(Numeric(10, 2), default=0, nullable=False)  # Valor pago
    discount = Column(Numeric(10, 2), default=0, nullable=False)     # Desconto
    taxes = Column(Numeric(10, 2), default=0, nullable=False)        # Impostos/taxas
    
    # Origem da reserva
    source = Column(String(50), nullable=True, index=True)   # direct, booking.com, airbnb, etc.
    source_reference = Column(String(100), nullable=True)   # ID externo da reserva
    
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
    
    def __repr__(self):
        return (f"<Reservation(id={self.id}, number='{self.reservation_number}', "
                f"guest='{self.guest.full_name if self.guest else 'N/A'}', "
                f"dates={self.check_in_date}-{self.check_out_date}, status='{self.status}')>")
    
    @property
    def nights(self):
        """Número de noites da reserva"""
        if not self.check_in_date or not self.check_out_date:
            return 0
        return (self.check_out_date - self.check_in_date).days
    
    @property
    def balance_due(self):
        """Saldo devedor da reserva"""
        if not self.total_amount:
            return Decimal('0')
        return self.total_amount - self.paid_amount
    
    @property
    def is_paid(self):
        """Verifica se a reserva está quitada"""
        return self.balance_due <= 0
    
    @property
    def status_display(self):
        """Status formatado para exibição"""
        status_map = {
            "pending": "Pendente",
            "confirmed": "Confirmada", 
            "checked_in": "Check-in Realizado",
            "checked_out": "Check-out Realizado",
            "cancelled": "Cancelada",
            "no_show": "No-show"
        }
        return status_map.get(self.status, self.status.title())
    
    @property
    def can_check_in(self):
        """Verifica se pode fazer check-in"""
        today = date.today()
        return (
            self.status == "confirmed" and 
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