# app/models/payment.py

from sqlalchemy import Column, String, Numeric, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from decimal import Decimal

from app.models.base import BaseModel, TenantMixin


class Payment(BaseModel, TenantMixin):
    """
    Modelo para pagamentos de reservas.
    Registra todos os recebimentos relacionados às reservas.
    """
    __tablename__ = "payments"
    
    # Relacionamento obrigatório com reserva
    reservation_id = Column(Integer, ForeignKey('reservations.id'), nullable=False, index=True)
    
    # Identificação do pagamento
    payment_number = Column(String(50), nullable=False, unique=True, index=True)  # PAY-2025-001
    reference_number = Column(String(100), nullable=True, index=True)  # PIX txid, comprovante, etc.
    
    # Dados financeiros
    amount = Column(Numeric(10, 2), nullable=False)  # Valor do pagamento
    currency = Column(String(3), default="BRL", nullable=False)  # Moeda
    
    # Método de pagamento
    payment_method = Column(String(20), nullable=False, index=True)
    # pix, credit_card, debit_card, bank_transfer, cash, check, other
    
    # Datas importantes
    payment_date = Column(DateTime, nullable=False, index=True)  # Data do pagamento
    confirmed_date = Column(DateTime, nullable=True)  # Data da confirmação
    
    # Status do pagamento
    status = Column(String(20), default="pending", nullable=False, index=True)
    # pending, confirmed, cancelled, refunded, failed
    
    # Observações
    notes = Column(Text, nullable=True)  # Observações do pagamento
    internal_notes = Column(Text, nullable=True)  # Notas internas
    
    # Metadados de processamento
    processor_data = Column(Text, nullable=True)  # Dados do processador (JSON string)
    fee_amount = Column(Numeric(10, 2), nullable=True)  # Taxa cobrada
    net_amount = Column(Numeric(10, 2), nullable=True)  # Valor líquido recebido
    
    # Flags de controle
    is_partial = Column(Boolean, default=False)  # Pagamento parcial
    is_refund = Column(Boolean, default=False)  # É um estorno
    
    # Relacionamentos
    reservation = relationship("Reservation", back_populates="payments")
    
    def __repr__(self):
        return (f"<Payment(id={self.id}, number='{self.payment_number}', "
                f"reservation_id={self.reservation_id}, amount={self.amount}, "
                f"method='{self.payment_method}', status='{self.status}')>")
    
    @property
    def status_display(self):
        """Status formatado para exibição"""
        status_map = {
            "pending": "Pendente",
            "confirmed": "Confirmado", 
            "cancelled": "Cancelado",
            "refunded": "Estornado",
            "failed": "Falhou"
        }
        return status_map.get(self.status, self.status.title())
    
    @property
    def payment_method_display(self):
        """Método de pagamento formatado"""
        method_map = {
            "pix": "PIX",
            "credit_card": "Cartão de Crédito",
            "debit_card": "Cartão de Débito", 
            "bank_transfer": "Transferência Bancária",
            "cash": "Dinheiro",
            "check": "Cheque",
            "other": "Outro"
        }
        return method_map.get(self.payment_method, self.payment_method.title())
    
    @classmethod
    def generate_payment_number(cls, tenant_id: int, db_session) -> str:
        """Gera número único de pagamento"""
        from sqlalchemy import func
        
        year = datetime.now().year
        count = db_session.query(func.count(cls.id)).filter(
            cls.tenant_id == tenant_id,
            func.extract('year', cls.created_at) == year
        ).scalar()
        
        sequence = count + 1
        return f"PAY-{year}-{sequence:06d}"