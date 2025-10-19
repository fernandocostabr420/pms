# backend/app/schemas/public_booking.py

from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from decimal import Decimal


# ============== PUBLIC BOOKING CREATION ==============

class PublicBookingCreate(BaseModel):
    """
    Schema para criação de reserva através do motor público.
    Contém todos os dados necessários para criar uma reserva.
    """
    
    # Identificação da propriedade
    property_slug: str = Field(..., min_length=3, max_length=100, description="Slug da propriedade")
    
    # Quarto selecionado
    room_id: int = Field(..., gt=0, description="ID do quarto")
    
    # Datas da reserva
    check_in_date: date = Field(..., description="Data de check-in")
    check_out_date: date = Field(..., description="Data de check-out")
    
    # Hóspedes
    adults: int = Field(..., ge=1, le=10, description="Número de adultos")
    children: int = Field(0, ge=0, le=10, description="Número de crianças")
    
    # Dados do hóspede principal
    guest_name: str = Field(..., min_length=3, max_length=200, description="Nome completo do hóspede")
    guest_email: EmailStr = Field(..., description="Email do hóspede")
    guest_phone: str = Field(..., min_length=10, max_length=20, description="Telefone do hóspede")
    guest_document: Optional[str] = Field(None, max_length=20, description="CPF/Passaporte do hóspede")
    
    # Dados adicionais do hóspede
    guest_country: Optional[str] = Field(None, max_length=100, description="País de origem")
    guest_address: Optional[str] = Field(None, max_length=500, description="Endereço completo")
    
    # Método de pagamento escolhido (ID ou nome)
    payment_method: str = Field(..., description="Método de pagamento escolhido")
    
    # Pedidos especiais
    special_requests: Optional[str] = Field(None, max_length=1000, description="Pedidos especiais")
    
    # Extras/Serviços adicionais (opcional)
    extras: Optional[List[Dict[str, Any]]] = Field(
        None, 
        description="Serviços extras selecionados"
    )
    
    # Cupom de desconto (opcional)
    promo_code: Optional[str] = Field(None, max_length=50, description="Código promocional")
    
    # Aceite de termos
    accepts_terms: bool = Field(..., description="Aceite dos termos e condições")
    accepts_privacy_policy: bool = Field(..., description="Aceite da política de privacidade")
    
    # Newsletter
    subscribe_newsletter: bool = Field(False, description="Deseja receber newsletter")
    
    # Origem da reserva (para tracking)
    source: Optional[str] = Field(None, max_length=100, description="Origem da reserva")
    referrer: Optional[str] = Field(None, max_length=500, description="URL de referência")
    
    @field_validator('check_out_date')
    @classmethod
    def validate_dates(cls, v, info):
        """Valida que check-out é posterior ao check-in"""
        if 'check_in_date' in info.data and v <= info.data['check_in_date']:
            raise ValueError('Data de check-out deve ser posterior ao check-in')
        return v
    
    @field_validator('guest_phone')
    @classmethod
    def validate_phone(cls, v):
        """Remove caracteres não numéricos do telefone"""
        import re
        # Remove tudo que não é número
        phone_clean = re.sub(r'[^\d]', '', v)
        if len(phone_clean) < 10:
            raise ValueError('Telefone deve ter pelo menos 10 dígitos')
        return phone_clean
    
    @field_validator('guest_name')
    @classmethod
    def validate_name(cls, v):
        """Valida que o nome tem pelo menos nome e sobrenome"""
        parts = v.strip().split()
        if len(parts) < 2:
            raise ValueError('Por favor, informe nome e sobrenome completos')
        return v.strip()


# ============== PUBLIC BOOKING RESPONSE ==============

class PublicBookingResponse(BaseModel):
    """
    Schema de resposta após criação de reserva pública.
    Retorna informações essenciais e token de acompanhamento.
    """
    
    # Identificadores
    reservation_id: int = Field(..., description="ID da reserva no sistema")
    reservation_number: str = Field(..., description="Número da reserva (visível para o hóspede)")
    public_token: str = Field(..., description="Token para acompanhamento público da reserva")
    
    # Status
    status: str = Field(..., description="Status atual da reserva")
    
    # Dados do hóspede
    guest_name: str
    guest_email: str
    guest_phone: str
    
    # Datas
    check_in_date: date
    check_out_date: date
    nights: int
    
    # Hóspedes
    adults: int
    children: int
    
    # Quarto
    room_info: Dict[str, Any] = Field(..., description="Informações do quarto reservado")
    
    # Valores
    pricing: Dict[str, Any] = Field(..., description="Detalhes de preços")
    
    # Pagamento
    payment_method: str
    
    # Extras
    special_requests: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    
    # Mensagem de confirmação
    message: str = Field(..., description="Mensagem de confirmação para o usuário")
    
    # URL de acompanhamento
    tracking_url: str = Field(..., description="URL para acompanhar a reserva")
    
    class Config:
        from_attributes = True


# ============== BOOKING TRACKING ==============

class BookingTrackingResponse(BaseModel):
    """
    Schema para resposta de acompanhamento de reserva.
    Informações públicas sobre o status da reserva.
    """
    
    reservation_number: str
    status: str
    status_message: str
    
    guest_name: str
    
    check_in_date: date
    check_out_date: date
    nights: int
    
    room_info: Dict[str, Any]
    total_amount: float
    payment_method: str
    
    property_info: Dict[str, Any]
    
    created_at: datetime
    last_updated: Optional[datetime] = None
    
    # Timeline de eventos (opcional)
    timeline: Optional[List[Dict[str, Any]]] = None


# ============== PRICE CALCULATION ==============

class PriceCalculationRequest(BaseModel):
    """Schema para requisição de cálculo de preço"""
    
    property_slug: str = Field(..., description="Slug da propriedade")
    room_id: int = Field(..., gt=0, description="ID do quarto")
    check_in: date = Field(..., description="Data de check-in")
    check_out: date = Field(..., description="Data de check-out")
    adults: int = Field(2, ge=1, le=10, description="Número de adultos")
    children: int = Field(0, ge=0, le=10, description="Número de crianças")
    promo_code: Optional[str] = Field(None, max_length=50, description="Código promocional")
    extras: Optional[List[Dict[str, Any]]] = Field(None, description="Extras selecionados")


class PriceCalculationResponse(BaseModel):
    """Schema para resposta de cálculo de preço"""
    
    check_in: str
    check_out: str
    nights: int
    
    # Breakdown de valores
    subtotal: float = Field(..., description="Subtotal das diárias")
    extras_total: float = Field(0.0, description="Total de extras")
    discount: float = Field(0.0, description="Desconto aplicado")
    taxes: float = Field(0.0, description="Taxas")
    service_fee: float = Field(0.0, description="Taxa de serviço")
    total_amount: float = Field(..., description="Valor total")
    
    average_per_night: float = Field(..., description="Média por noite")
    currency: str = Field("BRL", description="Moeda")
    
    # Detalhamento
    breakdown: List[Dict[str, Any]] = Field(..., description="Detalhamento dos valores")
    
    # Informações de desconto (se aplicável)
    promo_code_applied: Optional[str] = None
    discount_percentage: Optional[float] = None


# ============== AVAILABILITY SEARCH ==============

class PublicAvailabilitySearch(BaseModel):
    """Schema para busca pública de disponibilidade"""
    
    property_slug: str = Field(..., description="Slug da propriedade")
    check_in: date = Field(..., description="Data de check-in")
    check_out: date = Field(..., description="Data de check-out")
    adults: int = Field(2, ge=1, le=10, description="Número de adultos")
    children: int = Field(0, ge=0, le=10, description="Número de crianças")
    
    # Filtros opcionais
    room_type_id: Optional[int] = Field(None, description="Filtrar por tipo de quarto")
    min_price: Optional[float] = Field(None, ge=0, description="Preço mínimo")
    max_price: Optional[float] = Field(None, ge=0, description="Preço máximo")
    amenities: Optional[List[str]] = Field(None, description="Comodidades requeridas")
    
    @field_validator('check_out')
    @classmethod
    def validate_dates(cls, v, info):
        """Valida período de busca"""
        if 'check_in' in info.data:
            if v <= info.data['check_in']:
                raise ValueError('Check-out deve ser posterior ao check-in')
            
            nights = (v - info.data['check_in']).days
            if nights > 90:
                raise ValueError('Período máximo de busca é 90 dias')
        
        return v


class PublicRoomAvailability(BaseModel):
    """Schema para quarto disponível na busca pública"""
    
    room_id: int
    room_number: str
    room_name: str
    
    room_type: Dict[str, Any]
    
    max_occupancy: int
    amenities: List[str]
    
    pricing: Dict[str, Any]
    availability: Dict[str, Any]
    
    photos: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class PublicAvailabilityResponse(BaseModel):
    """Schema para resposta de busca de disponibilidade"""
    
    property_name: str
    
    check_in: str
    check_out: str
    nights: int
    
    adults: int
    children: int
    total_guests: int
    
    available_rooms: List[PublicRoomAvailability]
    total_results: int
    
    filters_applied: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


# ============== CONTACT FORM ==============

class PublicContactForm(BaseModel):
    """Schema para formulário de contato no booking engine"""
    
    property_slug: str = Field(..., description="Slug da propriedade")
    
    name: str = Field(..., min_length=3, max_length=200, description="Nome")
    email: EmailStr = Field(..., description="Email")
    phone: Optional[str] = Field(None, max_length=20, description="Telefone")
    
    subject: str = Field(..., min_length=5, max_length=200, description="Assunto")
    message: str = Field(..., min_length=10, max_length=2000, description="Mensagem")
    
    # Dados da possível reserva (opcional)
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    guests: Optional[int] = None


class PublicContactResponse(BaseModel):
    """Schema para resposta do formulário de contato"""
    
    success: bool
    message: str
    contact_id: Optional[int] = None