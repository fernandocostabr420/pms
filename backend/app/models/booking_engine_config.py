# backend/app/models/booking_engine_config.py

from sqlalchemy import Column, String, Text, Boolean, Integer, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from typing import Optional, Dict, Any, List

from app.models.base import BaseModel, TenantMixin


class BookingEngineConfig(BaseModel, TenantMixin):
    """
    Modelo de Configuração do Motor de Reservas Público.
    Armazena toda a personalização e conteúdo do site de reservas.
    Multi-tenant: cada tenant pode ter múltiplas propriedades com motores diferentes.
    """
    __tablename__ = "booking_engine_configs"
    
    # Relacionamento com propriedade (uma config por propriedade)
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    
    # ============== CONFIGURAÇÕES BÁSICAS ==============
    
    # Status do motor
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Slug customizado (usado na URL pública)
    # Ex: reservas.com.br/pousada-exemplo
    custom_slug = Column(String(100), nullable=True, index=True, unique=True)
    
    # ============== BRANDING ==============
    
    # Logo da propriedade (URL)
    logo_url = Column(String(500), nullable=True)
    
    # Cor primária do tema (hex)
    primary_color = Column(String(7), default="#2563eb", nullable=False)
    
    # Cor secundária (hex)
    secondary_color = Column(String(7), default="#1e40af", nullable=True)
    
    # ============== CONTEÚDO ==============
    
    # Texto de boas-vindas (hero section)
    welcome_text = Column(Text, nullable=True)
    
    # Descrição longa (sobre a propriedade)
    about_text = Column(Text, nullable=True)
    
    # Galeria de fotos principais (array de URLs)
    # Ex: ["url1.jpg", "url2.jpg", "url3.jpg"]
    gallery_photos = Column(JSON, nullable=True, default=list)
    
    # Fotos do hero (carrossel principal)
    hero_photos = Column(JSON, nullable=True, default=list)
    
    # Depoimentos de hóspedes
    # Ex: [{"name": "João", "rating": 5, "text": "Excelente!"}]
    testimonials = Column(JSON, nullable=True, default=list)
    
    # ============== REDES SOCIAIS ==============
    
    # Links de redes sociais
    # Ex: {"facebook": "url", "instagram": "url", "whatsapp": "5511999999999"}
    social_links = Column(JSON, nullable=True, default=dict)
    
    # ============== POLÍTICAS ==============
    
    # Política de cancelamento
    cancellation_policy = Column(Text, nullable=True)
    
    # Regras da casa
    house_rules = Column(Text, nullable=True)
    
    # Termos e condições
    terms_and_conditions = Column(Text, nullable=True)
    
    # Política de privacidade
    privacy_policy = Column(Text, nullable=True)
    
    # ============== HORÁRIOS ==============
    
    # Horário de check-in (formato HH:MM)
    check_in_time = Column(String(5), default="14:00", nullable=False)
    
    # Horário de check-out (formato HH:MM)
    check_out_time = Column(String(5), default="12:00", nullable=False)
    
    # ============== CONFIGURAÇÕES DE RESERVA ==============
    
    # Requer pré-pagamento?
    require_prepayment = Column(Boolean, default=False, nullable=False)
    
    # Valor do pré-pagamento (percentual 0-100)
    prepayment_percentage = Column(Integer, default=0, nullable=True)
    
    # Permitir reserva instantânea (sem aprovação)
    instant_booking = Column(Boolean, default=True, nullable=False)
    
    # Estadia mínima padrão (noites)
    default_min_stay = Column(Integer, default=1, nullable=False)
    
    # Estadia máxima padrão (noites)
    default_max_stay = Column(Integer, default=30, nullable=True)
    
    # Antecedência mínima para reserva (horas)
    min_advance_booking_hours = Column(Integer, default=2, nullable=False)
    
    # Antecedência máxima para reserva (dias)
    max_advance_booking_days = Column(Integer, default=365, nullable=False)
    
    # ============== SEO ==============
    
    # Meta título (para SEO)
    meta_title = Column(String(200), nullable=True)
    
    # Meta descrição (para SEO)
    meta_description = Column(Text, nullable=True)
    
    # Meta keywords (para SEO)
    meta_keywords = Column(String(500), nullable=True)
    
    # ============== NOTIFICAÇÕES ==============
    
    # Emails para notificação de novas reservas (separados por vírgula)
    notification_emails = Column(String(500), nullable=True)
    
    # Enviar SMS de confirmação?
    send_sms_confirmation = Column(Boolean, default=False, nullable=False)
    
    # Enviar WhatsApp de confirmação?
    send_whatsapp_confirmation = Column(Boolean, default=False, nullable=False)
    
    # ============== EXTRAS E SERVIÇOS ==============
    
    # Serviços/Extras disponíveis para adicionar na reserva
    # Ex: [{"name": "Café da manhã", "price": 25.00, "type": "per_person_per_day"}]
    available_extras = Column(JSON, nullable=True, default=list)
    
    # ============== MULTILINGUAGEM ==============
    
    # Idiomas disponíveis (array de códigos ISO)
    # Ex: ["pt", "en", "es"]
    available_languages = Column(JSON, nullable=True, default=list)
    
    # Idioma padrão
    default_language = Column(String(5), default="pt", nullable=False)
    
    # ============== ANALYTICS ==============
    
    # Google Analytics ID
    google_analytics_id = Column(String(50), nullable=True)
    
    # Facebook Pixel ID
    facebook_pixel_id = Column(String(50), nullable=True)
    
    # ============== CONFIGURAÇÕES AVANÇADAS ==============
    
    # Configurações customizadas (JSON livre)
    custom_settings = Column(JSON, nullable=True, default=dict)
    
    # CSS customizado
    custom_css = Column(Text, nullable=True)
    
    # JavaScript customizado
    custom_js = Column(Text, nullable=True)
    
    # ============== ESTATÍSTICAS (calculadas) ==============
    
    # Total de visitas (atualizado periodicamente)
    total_visits = Column(Integer, default=0, nullable=False)
    
    # Total de reservas geradas
    total_bookings = Column(Integer, default=0, nullable=False)
    
    # Taxa de conversão (calculada)
    # conversion_rate = total_bookings / total_visits * 100
    
    # ============== RELACIONAMENTOS ==============
    
    property_obj = relationship("Property", back_populates="booking_engine_config")
    
    # ============== CONSTRAINTS ==============
    
    __table_args__ = (
        UniqueConstraint('property_id', 'tenant_id', name='unique_booking_config_per_property'),
    )
    
    # ============== MÉTODOS ==============
    
    def __repr__(self):
        return f"<BookingEngineConfig(property_id={self.property_id}, slug='{self.custom_slug}', active={self.is_active})>"
    
    @property
    def conversion_rate(self) -> float:
        """Calcula taxa de conversão"""
        if self.total_visits == 0:
            return 0.0
        return (self.total_bookings / self.total_visits) * 100
    
    @property
    def booking_url(self) -> str:
        """Retorna URL pública do motor de reservas"""
        from app.core.config import settings
        base_url = settings.BOOKING_ENGINE_URL or "http://localhost:3001"
        slug = self.custom_slug or f"property-{self.property_id}"
        return f"{base_url}/{slug}"
    
    def get_social_link(self, platform: str) -> Optional[str]:
        """Retorna link de uma rede social específica"""
        if not self.social_links:
            return None
        return self.social_links.get(platform)
    
    def get_notification_email_list(self) -> List[str]:
        """Retorna lista de emails para notificação"""
        if not self.notification_emails:
            return []
        return [email.strip() for email in self.notification_emails.split(",")]
    
    def has_feature(self, feature: str) -> bool:
        """Verifica se uma feature está habilitada"""
        if not self.custom_settings:
            return False
        return self.custom_settings.get(f"enable_{feature}", False)
    
    def get_available_languages_list(self) -> List[str]:
        """Retorna lista de idiomas disponíveis"""
        if not self.available_languages:
            return [self.default_language]
        return self.available_languages
    
    def increment_visit(self):
        """Incrementa contador de visitas"""
        self.total_visits += 1
    
    def increment_booking(self):
        """Incrementa contador de reservas"""
        self.total_bookings += 1
    
    def to_public_dict(self) -> Dict[str, Any]:
        """
        Retorna dicionário com informações públicas (seguras para expor).
        Não inclui dados sensíveis.
        """
        return {
            "slug": self.custom_slug,
            "is_active": self.is_active,
            "branding": {
                "logo_url": self.logo_url,
                "primary_color": self.primary_color,
                "secondary_color": self.secondary_color
            },
            "content": {
                "welcome_text": self.welcome_text,
                "about_text": self.about_text,
                "gallery_photos": self.gallery_photos or [],
                "hero_photos": self.hero_photos or [],
                "testimonials": self.testimonials or []
            },
            "social_links": self.social_links or {},
            "policies": {
                "cancellation": self.cancellation_policy,
                "house_rules": self.house_rules,
                "check_in_time": self.check_in_time,
                "check_out_time": self.check_out_time
            },
            "booking_settings": {
                "instant_booking": self.instant_booking,
                "require_prepayment": self.require_prepayment,
                "prepayment_percentage": self.prepayment_percentage,
                "default_min_stay": self.default_min_stay,
                "default_max_stay": self.default_max_stay,
                "min_advance_booking_hours": self.min_advance_booking_hours,
                "max_advance_booking_days": self.max_advance_booking_days
            },
            "extras": self.available_extras or [],
            "languages": {
                "available": self.get_available_languages_list(),
                "default": self.default_language
            },
            "seo": {
                "title": self.meta_title,
                "description": self.meta_description
            }
        }