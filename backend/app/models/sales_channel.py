# backend/app/models/sales_channel.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from typing import Optional, Dict, Any, List

from app.models.base import BaseModel, TenantMixin


class SalesChannel(BaseModel, TenantMixin):
    """
    Modelo para canais de venda configuráveis.
    Permite que cada tenant configure seus próprios canais de vendas/reservas.
    """
    __tablename__ = "sales_channels"
    
    # Informações básicas
    name = Column(String(100), nullable=False, index=True)      # Nome do canal (ex: "Booking.com", "Site Oficial")
    code = Column(String(50), nullable=False, index=True)       # Código único (ex: "booking", "direct")
    description = Column(Text, nullable=True)                   # Descrição detalhada
    
    # Configurações de exibição
    display_order = Column(Integer, default=0, nullable=False, index=True)  # Ordem de exibição
    icon = Column(String(50), nullable=True)                    # Ícone para UI (nome do ícone)
    color = Column(String(20), nullable=True)                   # Cor para UI (hex ou nome)
    
    # Classificação do canal
    channel_type = Column(String(20), default="direct", nullable=False, index=True)
    # direct, ota (Online Travel Agency), phone, email, walk_in, corporate, agent, other
    
    is_external = Column(Boolean, default=False, nullable=False)   # Se é canal externo (OTA)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Configurações financeiras
    commission_rate = Column(Numeric(5, 4), nullable=True)      # Taxa de comissão (0.1500 = 15%)
    commission_type = Column(String(20), default="percentage")   # percentage, fixed, none
    base_fee = Column(Numeric(10, 2), nullable=True)           # Taxa fixa base
    
    # Configurações de integração
    has_api_integration = Column(Boolean, default=False)        # Tem integração via API
    api_config = Column(JSON, nullable=True)                   # Configurações da API
    webhook_url = Column(String(500), nullable=True)           # URL para webhooks
    
    # Configurações do canal
    settings = Column(JSON, nullable=True)                     # Configurações específicas
    business_rules = Column(JSON, nullable=True)               # Regras de negócio específicas
    
    # Metadados para integração
    external_id = Column(String(100), nullable=True)           # ID no sistema externo
    credentials = Column(JSON, nullable=True)                  # Credenciais (criptografadas)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='uq_sales_channel_tenant_code'),
        UniqueConstraint('tenant_id', 'name', name='uq_sales_channel_tenant_name'),
    )
    
    # Relacionamentos
    # reservations = relationship("Reservation", back_populates="sales_channel_obj")  # Para futuro
    
    def __repr__(self):
        return (f"<SalesChannel(id={self.id}, tenant_id={self.tenant_id}, "
                f"code='{self.code}', name='{self.name}', type='{self.channel_type}', "
                f"active={self.is_active}, external={self.is_external})>")
    
    @property
    def display_name(self) -> str:
        """Nome formatado para exibição"""
        return self.name
    
    @property
    def is_ota(self) -> bool:
        """Verifica se é uma OTA (Online Travel Agency)"""
        return self.channel_type == "ota" or self.is_external
    
    @property
    def requires_commission(self) -> bool:
        """Verifica se o canal cobra comissão"""
        return self.commission_rate and self.commission_rate > 0
    
    @property
    def has_integration(self) -> bool:
        """Verifica se tem integração técnica"""
        return self.has_api_integration or bool(self.webhook_url)
    
    @property
    def channel_type_display(self) -> str:
        """Tipo do canal formatado para exibição"""
        type_map = {
            "direct": "Direto",
            "ota": "OTA/Booking",
            "phone": "Telefone", 
            "email": "Email",
            "walk_in": "Presencial",
            "corporate": "Corporativo",
            "agent": "Agente/Parceiro",
            "other": "Outro"
        }
        return type_map.get(self.channel_type, self.channel_type.title())
    
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
    
    def get_business_rule(self, rule_name: str) -> Optional[Dict[str, Any]]:
        """Obtém uma regra de negócio específica"""
        if not self.business_rules:
            return None
        return self.business_rules.get(rule_name)
    
    def calculate_commission(self, base_amount: float) -> float:
        """Calcula comissão baseada no valor"""
        if not self.requires_commission:
            return 0.0
            
        if self.commission_type == "percentage":
            commission = base_amount * float(self.commission_rate or 0)
        elif self.commission_type == "fixed":
            commission = float(self.base_fee or 0)
        else:
            commission = 0.0
            
        # Adicionar taxa fixa se houver
        if self.base_fee and self.commission_type == "percentage":
            commission += float(self.base_fee)
            
        return commission
    
    @classmethod
    def get_active_channels(cls, db_session, tenant_id: int):
        """Obtém todos os canais ativos ordenados"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.is_active == True
        ).order_by(cls.display_order, cls.name).all()
    
    @classmethod
    def get_by_code(cls, db_session, tenant_id: int, code: str):
        """Busca canal por código"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.code == code,
            cls.is_active == True
        ).first()
    
    @classmethod
    def get_by_type(cls, db_session, tenant_id: int, channel_type: str):
        """Busca canais por tipo"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.channel_type == channel_type,
            cls.is_active == True
        ).order_by(cls.display_order, cls.name).all()
    
    @classmethod
    def get_external_channels(cls, db_session, tenant_id: int):
        """Obtém apenas canais externos (OTAs)"""
        return db_session.query(cls).filter(
            cls.tenant_id == tenant_id,
            cls.is_external == True,
            cls.is_active == True
        ).order_by(cls.display_order, cls.name).all()
    
    @classmethod
    def create_default_channels(cls, db_session, tenant_id: int):
        """Cria canais padrão para um novo tenant"""
        default_channels = [
            {
                'name': 'Site Oficial',
                'code': 'direct',
                'description': 'Reservas feitas diretamente pelo site oficial',
                'display_order': 1,
                'icon': 'globe',
                'color': '#3B82F6',
                'channel_type': 'direct',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'allows_modifications': True,
                    'requires_deposit': False,
                    'auto_confirm': True
                }
            },
            {
                'name': 'Booking.com',
                'code': 'booking',
                'description': 'Reservas vindas do Booking.com',
                'display_order': 2,
                'icon': 'building-2',
                'color': '#003580',
                'channel_type': 'ota',
                'is_external': True,
                'commission_rate': 0.15,  # 15%
                'commission_type': 'percentage',
                'has_api_integration': False,
                'settings': {
                    'payment_collected_by_ota': True,
                    'modification_restrictions': True,
                    'cancellation_policy': 'ota_managed'
                }
            },
            {
                'name': 'Telefone',
                'code': 'phone',
                'description': 'Reservas feitas por telefone',
                'display_order': 3,
                'icon': 'phone',
                'color': '#10B981',
                'channel_type': 'phone',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'requires_agent_confirmation': True,
                    'allows_special_requests': True
                }
            },
            {
                'name': 'Email',
                'code': 'email',
                'description': 'Reservas feitas por email',
                'display_order': 4,
                'icon': 'mail',
                'color': '#F59E0B',
                'channel_type': 'email',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'requires_email_confirmation': True,
                    'allows_attachments': True
                }
            },
            {
                'name': 'Walk-in',
                'code': 'walk_in',
                'description': 'Hóspedes que chegaram sem reserva',
                'display_order': 5,
                'icon': 'user-plus',
                'color': '#8B5CF6',
                'channel_type': 'walk_in',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'requires_immediate_payment': True,
                    'subject_to_availability': True
                }
            },
            {
                'name': 'Airbnb',
                'code': 'airbnb',
                'description': 'Reservas vindas do Airbnb',
                'display_order': 6,
                'icon': 'home',
                'color': '#FF5A5F',
                'channel_type': 'ota',
                'is_external': True,
                'commission_rate': 0.03,  # 3%
                'commission_type': 'percentage',
                'has_api_integration': False,
                'settings': {
                    'payment_collected_by_ota': True,
                    'host_service_fee': True
                }
            },
            {
                'name': 'Expedia',
                'code': 'expedia',
                'description': 'Reservas vindas da Expedia',
                'display_order': 7,
                'icon': 'plane',
                'color': '#FFC72C',
                'channel_type': 'ota',
                'is_external': True,
                'commission_rate': 0.18,  # 18%
                'commission_type': 'percentage',
                'has_api_integration': False,
                'settings': {
                    'payment_collected_by_ota': True,
                    'virtual_credit_card': True
                }
            },
            {
                'name': 'Mapa de Quartos',
                'code': 'room_map',
                'description': 'Reservas feitas através do mapa de quartos interno',
                'display_order': 8,
                'icon': 'map',
                'color': '#06B6D4',
                'channel_type': 'direct',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'internal_tool': True,
                    'staff_created': True,
                    'quick_booking': True
                }
            },
            {
                'name': 'Corporativo',
                'code': 'corporate',
                'description': 'Reservas de clientes corporativos',
                'display_order': 9,
                'icon': 'briefcase',
                'color': '#4338CA',
                'channel_type': 'corporate',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'requires_contract': True,
                    'special_rates': True,
                    'billing_integration': True
                }
            },
            {
                'name': 'Outro',
                'code': 'other',
                'description': 'Outros canais não especificados',
                'display_order': 99,
                'icon': 'more-horizontal',
                'color': '#6B7280',
                'channel_type': 'other',
                'is_external': False,
                'commission_rate': 0.0,
                'settings': {
                    'requires_description': True,
                    'manual_verification': True
                }
            }
        ]
        
        created_channels = []
        for channel_data in default_channels:
            channel = cls(
                tenant_id=tenant_id,
                **channel_data
            )
            db_session.add(channel)
            created_channels.append(channel)
        
        db_session.flush()  # Para obter os IDs
        return created_channels