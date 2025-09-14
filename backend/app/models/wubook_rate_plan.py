# backend/app/models/wubook_rate_plan.py

from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, Date, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import date, datetime

from app.models.base import BaseModel, TenantMixin


class WuBookRatePlan(BaseModel, TenantMixin):
    """
    Modelo para planos tarifários do WuBook.
    Gerencia diferentes planos de preços e suas regras.
    """
    __tablename__ = "wubook_rate_plans"
    
    # Configuração à qual pertence este rate plan
    configuration_id = Column(Integer, ForeignKey('wubook_configurations.id'), nullable=False, index=True)
    
    # Identificação do Rate Plan
    wubook_rate_plan_id = Column(String(50), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Tipo de Rate Plan
    plan_type = Column(String(30), default="standard", nullable=False)
    # standard, non_refundable, package, corporate, long_stay, early_booking, last_minute
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_visible = Column(Boolean, default=True, nullable=False)  # Visível nos canais
    is_bookable = Column(Boolean, default=True, nullable=False)  # Pode receber reservas
    
    # Rate Plan Pai (para planos derivados)
    parent_rate_plan_id = Column(Integer, ForeignKey('wubook_rate_plans.id'), nullable=True, index=True)
    is_derived = Column(Boolean, default=False, nullable=False)
    
    # Configuração de derivação (se for derivado)
    derivation_type = Column(String(20), nullable=True)  # percentage, fixed
    derivation_value = Column(Numeric(10, 3), nullable=True)  # Ex: -10.0 para 10% desconto
    
    # Validade do Rate Plan
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    
    # Dias da semana aplicáveis (JSON array com números 0-6, onde 0=segunda)
    applicable_days = Column(JSON, nullable=True, default=list)
    # Ex: [0, 1, 2, 3, 4] para dias úteis
    
    # Canais onde está disponível (referência aos IDs do WuBook)
    available_channels = Column(JSON, nullable=True, default=list)
    # Ex: ["1", "2", "3"] - IDs dos canais no WuBook
    
    # Regras de estadia
    min_stay = Column(Integer, default=1, nullable=False)
    max_stay = Column(Integer, nullable=True)
    min_advance_days = Column(Integer, default=0, nullable=False)  # Antecedência mínima
    max_advance_days = Column(Integer, nullable=True)  # Antecedência máxima
    
    # Configurações de preço base (por tipo de ocupação)
    base_rate_single = Column(Numeric(10, 2), nullable=True)
    base_rate_double = Column(Numeric(10, 2), nullable=True)
    base_rate_triple = Column(Numeric(10, 2), nullable=True)
    base_rate_quad = Column(Numeric(10, 2), nullable=True)
    
    # Preços por pessoa adicional
    extra_adult_rate = Column(Numeric(10, 2), nullable=True)
    extra_child_rate = Column(Numeric(10, 2), nullable=True)
    
    # Políticas
    cancellation_policy = Column(JSON, nullable=True, default=dict)
    # Ex: {"type": "flexible", "days_before": 1, "penalty": 0}
    
    payment_policy = Column(JSON, nullable=True, default=dict)
    # Ex: {"deposit": 30, "deposit_type": "percentage", "payment_time": "arrival"}
    
    # Inclusões (o que está incluído no rate plan)
    inclusions = Column(JSON, nullable=True, default=dict)
    # Ex: {"breakfast": true, "wifi": true, "parking": false}
    
    # Restrições específicas
    restrictions = Column(JSON, nullable=True, default=dict)
    # Ex: {"closed_to_arrival": ["2024-12-24"], "closed_to_departure": ["2024-12-25"]}
    
    # Yield Management
    yield_enabled = Column(Boolean, default=False, nullable=False)
    yield_rules = Column(JSON, nullable=True, default=dict)
    # Ex: {"occupancy_threshold": 80, "increase_percentage": 10}
    
    # Última sincronização
    last_sync_at = Column(String(30), nullable=True)
    last_rate_update = Column(String(30), nullable=True)
    sync_error = Column(Text, nullable=True)
    
    # Dados originais do WuBook
    wubook_data = Column(JSON, nullable=True, default=dict)
    
    # Metadados
    metadata_json = Column(JSON, nullable=True, default=dict)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'configuration_id', 'wubook_rate_plan_id', 
                         name='uq_wubook_rate_plan'),
        UniqueConstraint('tenant_id', 'configuration_id', 'code', 
                         name='uq_wubook_rate_plan_code'),
    )
    
    # Relacionamentos
    configuration = relationship("WuBookConfiguration", back_populates="rate_plans")
    parent_plan = relationship("WuBookRatePlan", remote_side="WuBookRatePlan.id", backref="derived_plans")
    
    def __repr__(self):
        return (f"<WuBookRatePlan(id={self.id}, name='{self.name}', "
                f"code='{self.code}', type='{self.plan_type}', active={self.is_active})>")
    
    @property
    def is_valid(self) -> bool:
        """Verifica se o rate plan está válido para hoje"""
        today = date.today()
        
        if self.valid_from and today < self.valid_from:
            return False
        if self.valid_to and today > self.valid_to:
            return False
        
        return self.is_active and self.is_bookable
    
    @property
    def is_available_today(self) -> bool:
        """Verifica se está disponível hoje (dia da semana)"""
        if not self.applicable_days:
            return True  # Se não há restrição, está sempre disponível
        
        today_weekday = datetime.now().weekday()
        return today_weekday in self.applicable_days
    
    def calculate_rate(self, occupancy: int, checkin_date: date = None) -> Optional[Decimal]:
        """Calcula a tarifa base para uma ocupação"""
        base_rate = None
        
        if occupancy == 1 and self.base_rate_single:
            base_rate = self.base_rate_single
        elif occupancy == 2 and self.base_rate_double:
            base_rate = self.base_rate_double
        elif occupancy == 3 and self.base_rate_triple:
            base_rate = self.base_rate_triple
        elif occupancy >= 4 and self.base_rate_quad:
            base_rate = self.base_rate_quad
        
        if base_rate and self.is_derived and self.parent_rate_plan_id:
            # Aplicar derivação se for um plano derivado
            base_rate = self._apply_derivation(base_rate)
        
        if base_rate and self.yield_enabled and checkin_date:
            # Aplicar yield management se habilitado
            base_rate = self._apply_yield(base_rate, checkin_date)
        
        return base_rate
    
    def _apply_derivation(self, rate: Decimal) -> Decimal:
        """Aplica regra de derivação ao rate"""
        if not self.derivation_type or not self.derivation_value:
            return rate
        
        if self.derivation_type == "percentage":
            # Aplica percentual (positivo = aumento, negativo = desconto)
            multiplier = 1 + (self.derivation_value / 100)
            return rate * Decimal(str(multiplier))
        elif self.derivation_type == "fixed":
            # Aplica valor fixo (positivo = aumento, negativo = desconto)
            return rate + self.derivation_value
        
        return rate
    
    def _apply_yield(self, rate: Decimal, checkin_date: date) -> Decimal:
        """Aplica yield management ao rate"""
        if not self.yield_rules:
            return rate
        
        # TODO: Implementar lógica de yield baseada em ocupação, 
        # dias até o checkin, eventos, etc.
        return rate
    
    def is_channel_enabled(self, channel_id: str) -> bool:
        """Verifica se o rate plan está disponível em um canal"""
        if not self.available_channels:
            return True  # Se não há restrição, disponível em todos
        return str(channel_id) in self.available_channels
    
    def add_channel(self, channel_id: str) -> None:
        """Adiciona um canal ao rate plan"""
        if not self.available_channels:
            self.available_channels = []
        if str(channel_id) not in self.available_channels:
            self.available_channels.append(str(channel_id))
    
    def remove_channel(self, channel_id: str) -> None:
        """Remove um canal do rate plan"""
        if self.available_channels and str(channel_id) in self.available_channels:
            self.available_channels.remove(str(channel_id))
    
    def validate_booking(self, checkin: date, checkout: date, advance_days: int = None) -> tuple[bool, str]:
        """
        Valida se uma reserva pode ser feita com este rate plan
        Retorna (is_valid, error_message)
        """
        # Verificar validade do plano
        if not self.is_valid:
            return False, "Rate plan não está disponível"
        
        # Verificar estadia mínima
        nights = (checkout - checkin).days
        if nights < self.min_stay:
            return False, f"Estadia mínima: {self.min_stay} noites"
        
        # Verificar estadia máxima
        if self.max_stay and nights > self.max_stay:
            return False, f"Estadia máxima: {self.max_stay} noites"
        
        # Verificar antecedência
        if advance_days is not None:
            if advance_days < self.min_advance_days:
                return False, f"Antecedência mínima: {self.min_advance_days} dias"
            if self.max_advance_days and advance_days > self.max_advance_days:
                return False, f"Antecedência máxima: {self.max_advance_days} dias"
        
        # Verificar restrições de chegada/saída
        if self.restrictions:
            cta = self.restrictions.get("closed_to_arrival", [])
            if str(checkin) in cta:
                return False, "Data fechada para chegada"
            
            ctd = self.restrictions.get("closed_to_departure", [])
            if str(checkout) in ctd:
                return False, "Data fechada para saída"
        
        return True, "OK"
    
    def get_cancellation_penalty(self, days_before: int) -> Dict[str, Any]:
        """Calcula penalidade de cancelamento baseada na política"""
        if not self.cancellation_policy:
            return {"penalty": 0, "type": "none"}
        
        policy_type = self.cancellation_policy.get("type", "flexible")
        
        if policy_type == "non_refundable":
            return {"penalty": 100, "type": "percentage"}
        elif policy_type == "flexible":
            deadline = self.cancellation_policy.get("days_before", 1)
            if days_before >= deadline:
                return {"penalty": 0, "type": "none"}
            else:
                penalty = self.cancellation_policy.get("penalty", 100)
                return {"penalty": penalty, "type": "percentage"}
        
        return {"penalty": 0, "type": "none"}
    
    def update_sync_status(self, success: bool = True, error: str = None) -> None:
        """Atualiza status de sincronização"""
        self.last_sync_at = datetime.utcnow().isoformat()
        if success:
            self.sync_error = None
        else:
            self.sync_error = error or "Erro desconhecido"