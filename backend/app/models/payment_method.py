# backend/app/models/payment_method.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from typing import Optional, Dict, Any

from app.models.base import BaseModel, TenantMixin


class PaymentMethod(BaseModel, TenantMixin):
    """
    Modelo para métodos de pagamento configuráveis.
    Permite que cada tenant configure seus próprios métodos de pagamento.
    """
    __tablename__ = "payment_methods"
    
    # Informações básicas
    name = Column(String(100), nullable=False, index=True)  # Nome do método (ex: "PIX", "Cartão de Crédito")
    code = Column(String(50), nullable=False, index=True)   # Código único (ex: "pix", "credit_card")
    description = Column(Text, nullable=True)               # Descrição detalhada
    
    # Configurações de exibição
    display_order = Column(Integer, default=0, nullable=False, index=True)  # Ordem de exibição
    icon = Column(String(50), nullable=True)                # Ícone para UI (nome do ícone)
    color = Column(String(20), nullable=True)               # Cor para UI (hex ou nome)
    
    # Configurações funcionais
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    requires_reference = Column(Boolean, default=False)     # Se requer número de referência
    has_fees = Column(Boolean, default=False)               # Se tem taxas associadas
    default_fee_rate = Column(Numeric(5, 4), nullable=True) # Taxa padrão (0.0350 = 3.5%)
    
    # Configurações avançadas (JSON flexível)
    settings = Column(JSON, nullable=True)                  # Configurações específicas
    validation_rules = Column(JSON, nullable=True)          # Regras de validação
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='uq_payment_method_tenant_code'),
        UniqueConstraint('tenant_id', 'name', name='uq_payment_method_tenant_name'),
    )
    
    # Relacionamentos
    # payments = relationship("Payment", back_populates="payment_method_obj")  # Para futuro
    
    def __repr__(self):
        return (f"<PaymentMethod(id={self.id}, tenant_id={self.tenant_id}, "
                f"code='{self.code}', name='{self.name}', active={self.is_active})>")
    
    @property
    def display_name(self) -> str:
        """Nome formatado para exibição"""
        return self.name
    
    @property
    def is_card_payment(self) -> bool:
        """Verifica se é pagamento com cartão"""
        card_codes = ['credit_card', 'debit_card']
        return self.code.lower() in card_codes
    
    @property
    def is_electronic_payment(self) -> bool:
        """Verifica se é pagamento eletrônico"""
        electronic_codes = ['pix', 'bank_transfer', 'credit_card', 'debit_card']
        return self.code.lower() in electronic_codes
    
    @property
    def requires_external_validation(self) -> bool:
        """Verifica se requer validação externa"""
        external_codes = ['pix', 'bank_transfer', 'credit_card', 'debit_card']
        return self.code.lower() in external_codes
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Obtém uma configuração específica"""
        if not self.settings:
            return default
        return self.settings.get(key, default)
    
    def set_setting(self, key: str, value: Any) -> None:
        """Define uma configuração específica"""
        if not self.settings:
            self.settings = {}
        self.settings[key] = value
    
    def get_validation_rule(self, rule_name: str) -> Optional[Dict[str, Any]]:
        """Obtém uma regra de validação específica"""
        if not self.validation_rules:
            return None
        return self.validation_rules.get(rule_name)
    
    @classmethod
    def get_active_methods(cls, db_session, tenant_id: int):
        """Obtém todos os métodos ativos ordenados"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.is_active == True
        ).order_by(cls.display_order, cls.name).all()
    
    @classmethod
    def get_by_code(cls, db_session, tenant_id: int, code: str):
        """Busca método por código"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.code == code,
            cls.is_active == True
        ).first()
    
    @classmethod
    def create_default_methods(cls, db_session, tenant_id: int):
        """Cria métodos padrão para um novo tenant"""
        default_methods = [
            {
                'name': 'PIX',
                'code': 'pix',
                'description': 'Pagamento instantâneo via PIX',
                'display_order': 1,
                'icon': 'smartphone',
                'color': '#00D4AA',
                'requires_reference': True,
                'has_fees': False,
                'settings': {
                    'instant_confirmation': True,
                    'requires_key': True
                }
            },
            {
                'name': 'Cartão de Crédito',
                'code': 'credit_card',
                'description': 'Pagamento com cartão de crédito',
                'display_order': 2,
                'icon': 'credit-card',
                'color': '#3B82F6',
                'requires_reference': True,
                'has_fees': True,
                'default_fee_rate': 0.0399,  # 3.99%
                'settings': {
                    'allows_installments': True,
                    'max_installments': 12
                }
            },
            {
                'name': 'Cartão de Débito',
                'code': 'debit_card',
                'description': 'Pagamento com cartão de débito',
                'display_order': 3,
                'icon': 'credit-card',
                'color': '#10B981',
                'requires_reference': True,
                'has_fees': True,
                'default_fee_rate': 0.0299,  # 2.99%
                'settings': {
                    'instant_confirmation': True
                }
            },
            {
                'name': 'Transferência Bancária',
                'code': 'bank_transfer',
                'description': 'Transferência bancária tradicional',
                'display_order': 4,
                'icon': 'building',
                'color': '#6366F1',
                'requires_reference': True,
                'has_fees': False,
                'settings': {
                    'requires_confirmation': True,
                    'typical_delay_hours': 24
                }
            },
            {
                'name': 'Dinheiro',
                'code': 'cash',
                'description': 'Pagamento em dinheiro',
                'display_order': 5,
                'icon': 'banknote',
                'color': '#059669',
                'requires_reference': False,
                'has_fees': False,
                'settings': {
                    'instant_confirmation': True,
                    'requires_receipt': True
                }
            },
            {
                'name': 'Cheque',
                'code': 'check',
                'description': 'Pagamento com cheque',
                'display_order': 6,
                'icon': 'file-text',
                'color': '#D97706',
                'requires_reference': True,
                'has_fees': False,
                'settings': {
                    'requires_confirmation': True,
                    'typical_delay_days': 3
                }
            },
            {
                'name': 'Outro',
                'code': 'other',
                'description': 'Outros métodos de pagamento',
                'display_order': 99,
                'icon': 'more-horizontal',
                'color': '#6B7280',
                'requires_reference': False,
                'has_fees': False,
                'settings': {
                    'requires_description': True
                }
            }
        ]
        
        created_methods = []
        for method_data in default_methods:
            method = cls(
                tenant_id=tenant_id,
                **method_data
            )
            db_session.add(method)
            created_methods.append(method)
        
        db_session.flush()  # Para obter os IDs
        return created_methods