# backend/app/api/v1/endpoints/booking_engine.py

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Dict, Any, List
from datetime import datetime
import os
import uuid
import re

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.booking_engine_config import BookingEngineConfig
from app.models.property import Property
from app.models.reservation import Reservation
from app.schemas.common import MessageResponse

router = APIRouter()


# ==================== HELPERS ====================

def validate_slug_format(slug: str) -> bool:
    """Valida formato do slug (apenas letras minúsculas, números e hífens)"""
    pattern = r'^[a-z0-9-]+$'
    return bool(re.match(pattern, slug))


def save_upload_file(file: UploadFile, upload_type: str, property_id: int) -> str:
    """
    Salva arquivo de upload e retorna a URL COMPLETA
    
    Args:
        file: Arquivo para upload
        upload_type: Tipo do arquivo (logo, gallery, hero)
        property_id: ID da propriedade
        
    Returns:
        URL COMPLETA do arquivo salvo (incluindo domínio do backend)
    """
    from app.core.config import settings
    
    # Criar diretório se não existir
    upload_dir = f"uploads/booking-engine/property-{property_id}/{upload_type}"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Gerar nome único para o arquivo
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Salvar arquivo
    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())
    
    # ✅ RETORNAR URL COMPLETA COM DOMÍNIO DO BACKEND
    # Obter URL base do backend (variável de ambiente ou padrão)
    backend_url = os.getenv('BACKEND_URL', 'http://72.60.50.223:8000')
    
    # Normalizar o caminho do arquivo (trocar \ por / no Windows)
    normalized_path = file_path.replace('\\', '/')
    
    # Construir URL completa
    full_url = f"{backend_url}/{normalized_path}"
    
    return full_url


# ==================== CRUD OPERATIONS ====================

@router.post("/properties/{property_id}/booking-engine", status_code=status.HTTP_201_CREATED)
def create_booking_engine_config(
    property_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria configuração do booking engine para uma propriedade.
    
    **Campos disponíveis (todos os campos REAIS do modelo):**
    
    **Básico:**
    - is_active: bool
    - custom_slug: str
    
    **Branding:**
    - logo_url: str
    - primary_color: str (hex)
    - secondary_color: str (hex)
    
    **Conteúdo:**
    - welcome_text: str
    - about_text: str
    - gallery_photos: list[str]
    - hero_photos: list[str]
    - testimonials: list[dict]
    - social_links: dict
    
    **Políticas:**
    - cancellation_policy: str
    - house_rules: str
    - terms_and_conditions: str
    - privacy_policy: str
    - check_in_time: str (HH:MM)
    - check_out_time: str (HH:MM)
    
    **Configurações de Reserva:**
    - require_prepayment: bool
    - prepayment_percentage: int
    - instant_booking: bool
    - default_min_stay: int (noites)
    - default_max_stay: int (noites)
    - min_advance_booking_hours: int
    - max_advance_booking_days: int
    
    **SEO:**
    - meta_title: str
    - meta_description: str
    - meta_keywords: str
    
    **Notificações:**
    - notification_emails: str
    - send_sms_confirmation: bool
    - send_whatsapp_confirmation: bool
    
    **Extras e Idiomas:**
    - available_extras: list[dict]
    - available_languages: list[str]
    - default_language: str
    
    **Analytics:**
    - google_analytics_id: str
    - facebook_pixel_id: str
    
    **Avançado:**
    - custom_settings: dict
    - custom_css: str
    - custom_js: str
    """
    
    # Verificar se a propriedade existe e pertence ao tenant
    property_obj = db.query(Property).filter(
        Property.id == property_id,
        Property.tenant_id == current_user.tenant_id
    ).first()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propriedade não encontrada"
        )
    
    # Verificar se já existe configuração
    existing = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuração já existe para esta propriedade. Use PUT para atualizar."
        )
    
    # Validar slug se fornecido
    custom_slug = data.get("custom_slug")
    if custom_slug:
        if not validate_slug_format(custom_slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug inválido. Use apenas letras minúsculas, números e hífens."
            )
        
        # Verificar se slug já está em uso
        slug_exists = db.query(BookingEngineConfig).filter(
            BookingEngineConfig.custom_slug == custom_slug,
            BookingEngineConfig.id != property_id
        ).first()
        
        if slug_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este slug já está em uso por outra propriedade"
            )
    
    # Criar nova configuração usando APENAS campos que existem no modelo
    config = BookingEngineConfig(
        tenant_id=current_user.tenant_id,
        property_id=property_id,
        # Básico
        is_active=data.get("is_active", True),
        custom_slug=custom_slug,
        # Branding
        logo_url=data.get("logo_url"),
        primary_color=data.get("primary_color", "#2563eb"),
        secondary_color=data.get("secondary_color", "#1e40af"),
        # Conteúdo
        welcome_text=data.get("welcome_text"),
        about_text=data.get("about_text"),
        gallery_photos=data.get("gallery_photos", []),
        hero_photos=data.get("hero_photos", []),
        testimonials=data.get("testimonials", []),
        social_links=data.get("social_links", {}),
        # Políticas
        cancellation_policy=data.get("cancellation_policy"),
        house_rules=data.get("house_rules"),
        terms_and_conditions=data.get("terms_and_conditions"),
        privacy_policy=data.get("privacy_policy"),
        check_in_time=data.get("check_in_time", "14:00"),
        check_out_time=data.get("check_out_time", "12:00"),
        # Configurações de Reserva
        require_prepayment=data.get("require_prepayment", False),
        prepayment_percentage=data.get("prepayment_percentage", 0),
        instant_booking=data.get("instant_booking", True),
        default_min_stay=data.get("default_min_stay", 1),
        default_max_stay=data.get("default_max_stay", 30),
        min_advance_booking_hours=data.get("min_advance_booking_hours", 2),
        max_advance_booking_days=data.get("max_advance_booking_days", 365),
        # SEO
        meta_title=data.get("meta_title"),
        meta_description=data.get("meta_description"),
        meta_keywords=data.get("meta_keywords"),
        # Notificações
        notification_emails=data.get("notification_emails"),
        send_sms_confirmation=data.get("send_sms_confirmation", False),
        send_whatsapp_confirmation=data.get("send_whatsapp_confirmation", False),
        # Extras e Idiomas
        available_extras=data.get("available_extras", []),
        available_languages=data.get("available_languages", []),
        default_language=data.get("default_language", "pt"),
        # Analytics
        google_analytics_id=data.get("google_analytics_id"),
        facebook_pixel_id=data.get("facebook_pixel_id"),
        # Avançado
        custom_settings=data.get("custom_settings", {}),
        custom_css=data.get("custom_css"),
        custom_js=data.get("custom_js")
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return config


@router.get("/properties/{property_id}/booking-engine")
def get_booking_engine_config(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Busca configuração do booking engine de uma propriedade.
    
    Retorna 404 se a configuração não existir.
    """
    
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    return config


@router.put("/properties/{property_id}/booking-engine")
def update_booking_engine_config(
    property_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    ✅ ROTA PUT - Atualiza configuração completa do booking engine.
    
    **IMPORTANTE:** Esta rota estava faltando e causava o erro 405.
    Agora usa APENAS os campos que existem no modelo BookingEngineConfig.
    
    Substitui todos os campos fornecidos. Para atualização parcial, use PATCH.
    """
    
    # Buscar configuração existente
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada. Use POST para criar."
        )
    
    # Validar slug se fornecido
    custom_slug = data.get("custom_slug")
    if custom_slug and custom_slug != config.custom_slug:
        if not validate_slug_format(custom_slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug inválido. Use apenas letras minúsculas, números e hífens."
            )
        
        # Verificar se slug já está em uso por outra propriedade
        slug_exists = db.query(BookingEngineConfig).filter(
            BookingEngineConfig.custom_slug == custom_slug,
            BookingEngineConfig.property_id != property_id
        ).first()
        
        if slug_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este slug já está em uso por outra propriedade"
            )
    
    # Atualizar APENAS campos que existem no modelo
    # Básico
    if "is_active" in data:
        config.is_active = data["is_active"]
    if "custom_slug" in data:
        config.custom_slug = data["custom_slug"]
    
    # Branding
    if "logo_url" in data:
        config.logo_url = data["logo_url"]
    if "primary_color" in data:
        config.primary_color = data["primary_color"]
    if "secondary_color" in data:
        config.secondary_color = data["secondary_color"]
    
    # Conteúdo
    if "welcome_text" in data:
        config.welcome_text = data["welcome_text"]
    if "about_text" in data:
        config.about_text = data["about_text"]
    if "gallery_photos" in data:
        config.gallery_photos = data["gallery_photos"]
    if "hero_photos" in data:
        config.hero_photos = data["hero_photos"]
    if "testimonials" in data:
        config.testimonials = data["testimonials"]
    if "social_links" in data:
        config.social_links = data["social_links"]
    
    # Políticas
    if "cancellation_policy" in data:
        config.cancellation_policy = data["cancellation_policy"]
    if "house_rules" in data:
        config.house_rules = data["house_rules"]
    if "terms_and_conditions" in data:
        config.terms_and_conditions = data["terms_and_conditions"]
    if "privacy_policy" in data:
        config.privacy_policy = data["privacy_policy"]
    if "check_in_time" in data:
        config.check_in_time = data["check_in_time"]
    if "check_out_time" in data:
        config.check_out_time = data["check_out_time"]
    
    # Configurações de Reserva
    if "require_prepayment" in data:
        config.require_prepayment = data["require_prepayment"]
    if "prepayment_percentage" in data:
        config.prepayment_percentage = data["prepayment_percentage"]
    if "instant_booking" in data:
        config.instant_booking = data["instant_booking"]
    if "default_min_stay" in data:
        config.default_min_stay = data["default_min_stay"]
    if "default_max_stay" in data:
        config.default_max_stay = data["default_max_stay"]
    if "min_advance_booking_hours" in data:
        config.min_advance_booking_hours = data["min_advance_booking_hours"]
    if "max_advance_booking_days" in data:
        config.max_advance_booking_days = data["max_advance_booking_days"]
    
    # SEO
    if "meta_title" in data:
        config.meta_title = data["meta_title"]
    if "meta_description" in data:
        config.meta_description = data["meta_description"]
    if "meta_keywords" in data:
        config.meta_keywords = data["meta_keywords"]
    
    # Notificações
    if "notification_emails" in data:
        config.notification_emails = data["notification_emails"]
    if "send_sms_confirmation" in data:
        config.send_sms_confirmation = data["send_sms_confirmation"]
    if "send_whatsapp_confirmation" in data:
        config.send_whatsapp_confirmation = data["send_whatsapp_confirmation"]
    
    # Extras e Idiomas
    if "available_extras" in data:
        config.available_extras = data["available_extras"]
    if "available_languages" in data:
        config.available_languages = data["available_languages"]
    if "default_language" in data:
        config.default_language = data["default_language"]
    
    # Analytics
    if "google_analytics_id" in data:
        config.google_analytics_id = data["google_analytics_id"]
    if "facebook_pixel_id" in data:
        config.facebook_pixel_id = data["facebook_pixel_id"]
    
    # Avançado
    if "custom_settings" in data:
        config.custom_settings = data["custom_settings"]
    if "custom_css" in data:
        config.custom_css = data["custom_css"]
    if "custom_js" in data:
        config.custom_js = data["custom_js"]
    
    # Atualizar timestamp
    config.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(config)
    
    return config


@router.patch("/properties/{property_id}/booking-engine")
def partial_update_booking_engine_config(
    property_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza parcialmente a configuração do booking engine.
    
    Atualiza apenas os campos fornecidos, mantendo os demais intactos.
    Usa a mesma lógica do PUT mas de forma mais concisa.
    """
    
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    # Validar slug se fornecido
    if "custom_slug" in data and data["custom_slug"] != config.custom_slug:
        custom_slug = data["custom_slug"]
        if not validate_slug_format(custom_slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug inválido. Use apenas letras minúsculas, números e hífens."
            )
        
        slug_exists = db.query(BookingEngineConfig).filter(
            BookingEngineConfig.custom_slug == custom_slug,
            BookingEngineConfig.property_id != property_id
        ).first()
        
        if slug_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este slug já está em uso por outra propriedade"
            )
    
    # Atualizar apenas campos fornecidos que existem no modelo
    for key, value in data.items():
        if hasattr(config, key):
            setattr(config, key, value)
    
    config.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(config)
    
    return config


@router.delete("/properties/{property_id}/booking-engine")
def delete_booking_engine_config(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Deleta configuração do booking engine.
    
    **ATENÇÃO:** Esta ação é irreversível.
    """
    
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    db.delete(config)
    db.commit()
    
    return MessageResponse(message="Configuração deletada com sucesso")


# ==================== STATISTICS ====================

@router.get("/properties/{property_id}/booking-engine/stats")
def get_booking_engine_stats(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna estatísticas do booking engine.
    
    Inclui:
    - Total de visitas
    - Total de reservas através do booking engine
    - Taxa de conversão
    - Status atual
    """
    
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    # Usar os campos total_visits e total_bookings do modelo
    total_visits = config.total_visits
    total_bookings = config.total_bookings
    
    # Calcular taxa de conversão
    conversion_rate = (total_bookings / total_visits * 100) if total_visits > 0 else 0
    
    return {
        "total_visits": total_visits,
        "total_bookings": total_bookings,
        "conversion_rate": round(conversion_rate, 2),
        "property_id": property_id,
        "is_active": config.is_active
    }


# ==================== FILE UPLOADS ====================

@router.post("/properties/{property_id}/booking-engine/upload")
async def upload_booking_engine_image(
    property_id: int,
    file: UploadFile = File(...),
    type: str = "gallery",  # logo, gallery, hero
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Faz upload de imagem para o booking engine.
    
    **Tipos aceitos:**
    - logo: Logotipo da propriedade
    - gallery: Fotos da galeria
    - hero: Imagem hero/banner
    
    **Formatos aceitos:** JPG, JPEG, PNG, WEBP
    """
    
    # Verificar se configuração existe
    config = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.property_id == property_id,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    # Validar tipo de arquivo
    allowed_extensions = [".jpg", ".jpeg", ".png", ".webp"]
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato não suportado. Use: {', '.join(allowed_extensions)}"
        )
    
    # Validar tipo de upload
    if type not in ["logo", "gallery", "hero"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo inválido. Use: logo, gallery ou hero"
        )
    
    # Salvar arquivo
    try:
        file_url = save_upload_file(file, type, property_id)
        
        # Atualizar configuração conforme o tipo
        if type == "logo":
            config.logo_url = file_url
        elif type == "gallery":
            if not config.gallery_photos:
                config.gallery_photos = []
            config.gallery_photos.append(file_url)
        elif type == "hero":
            if not config.hero_photos:
                config.hero_photos = []
            config.hero_photos.append(file_url)
        
        config.updated_at = datetime.utcnow()
        db.commit()
        
        return {"url": file_url, "type": type}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao fazer upload: {str(e)}"
        )


# ==================== SLUG VALIDATION ====================

@router.post("/booking-engine/validate-slug")
def validate_custom_slug(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Valida se um slug customizado está disponível.
    
    **Regras de validação:**
    - Apenas letras minúsculas, números e hífens
    - Não pode estar em uso por outra propriedade
    - Mínimo 3 caracteres
    """
    
    slug = data.get("slug", "").strip().lower()
    property_id = data.get("property_id")
    
    if not slug:
        return {
            "is_available": False,
            "message": "Slug não pode ser vazio"
        }
    
    if len(slug) < 3:
        return {
            "is_available": False,
            "message": "Slug deve ter no mínimo 3 caracteres"
        }
    
    if not validate_slug_format(slug):
        return {
            "is_available": False,
            "message": "Slug inválido. Use apenas letras minúsculas, números e hífens"
        }
    
    # Verificar se slug já está em uso
    query = db.query(BookingEngineConfig).filter(
        BookingEngineConfig.custom_slug == slug,
        BookingEngineConfig.tenant_id == current_user.tenant_id
    )
    
    # Se estiver atualizando uma propriedade existente, excluir ela da busca
    if property_id:
        query = query.filter(BookingEngineConfig.property_id != property_id)
    
    existing = query.first()
    
    if existing:
        return {
            "is_available": False,
            "message": "Este slug já está em uso por outra propriedade"
        }
    
    return {
        "is_available": True,
        "message": "Slug disponível"
    }