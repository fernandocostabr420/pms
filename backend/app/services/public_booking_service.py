# backend/app/services/public_booking_service.py

from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
from decimal import Decimal
import secrets
import logging

from app.models.property import Property
from app.models.room import Room
from app.models.guest import Guest
from app.models.reservation import Reservation
from app.models.booking_engine_config import BookingEngineConfig
from app.schemas.public_booking import PublicBookingCreate
from app.services.room_availability_service import RoomAvailabilityService

logger = logging.getLogger(__name__)


class PublicBookingService:
    """
    Service para gerenciar reservas públicas (booking engine).
    Responsável por criar reservas vindas do site público.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.availability_service = RoomAvailabilityService(db)
    
    def create_booking(self, booking_data: PublicBookingCreate) -> Reservation:
        """
        Cria uma nova reserva através do motor público.
        
        Fluxo:
        1. Valida propriedade e motor de reservas
        2. Valida disponibilidade do quarto
        3. Cria/atualiza hóspede
        4. Calcula valores
        5. Cria reserva com status 'pending_confirmation'
        6. Gera token público
        7. Atualiza estatísticas
        
        Args:
            booking_data: Dados da reserva pública
            
        Returns:
            Objeto Reservation criado
            
        Raises:
            ValueError: Se alguma validação falhar
        """
        try:
            # 1. Validar propriedade e booking engine
            property_obj = self._validate_property(booking_data.property_slug)
            booking_config = self._validate_booking_engine(property_obj.id)
            
            # 2. Validar quarto
            room = self._validate_room(booking_data.room_id, property_obj.tenant_id)
            
            # 3. Validar datas e disponibilidade
            self._validate_dates_and_availability(
                room,
                booking_data.check_in_date,
                booking_data.check_out_date,
                property_obj.tenant_id,
                booking_config
            )
            
            # 4. Validar capacidade
            self._validate_capacity(room, booking_data.adults + booking_data.children)
            
            # 5. Criar ou atualizar hóspede
            guest = self._create_or_update_guest(booking_data, property_obj.tenant_id)
            
            # 6. Calcular valores
            pricing = self._calculate_pricing(
                room,
                booking_data.check_in_date,
                booking_data.check_out_date,
                property_obj.tenant_id,
                booking_data.extras
            )
            
            # 7. Criar reserva
            reservation = self._create_reservation(
                booking_data,
                property_obj,
                room,
                guest,
                pricing
            )
            
            # 8. Atualizar estatísticas do booking engine
            booking_config.increment_booking()
            self.db.commit()
            
            logger.info(
                f"Reserva pública criada: ID {reservation.id} | "
                f"Propriedade: {property_obj.name} | "
                f"Hóspede: {guest.full_name}"
            )
            
            return reservation
            
        except ValueError:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar reserva pública: {str(e)}")
            raise ValueError(f"Erro ao processar reserva: {str(e)}")
    
    def _validate_property(self, slug: str) -> Property:
        """Valida e retorna propriedade pelo slug"""
        property_obj = self.db.query(Property).filter(
            Property.slug == slug,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            raise ValueError("Propriedade não encontrada ou inativa")
        
        return property_obj
    
    def _validate_booking_engine(self, property_id: int) -> BookingEngineConfig:
        """Valida que o motor de reservas está ativo para a propriedade"""
        booking_config = self.db.query(BookingEngineConfig).filter(
            BookingEngineConfig.property_id == property_id,
            BookingEngineConfig.is_active == True
        ).first()
        
        if not booking_config:
            raise ValueError("Motor de reservas não está ativo para esta propriedade")
        
        return booking_config
    
    def _validate_room(self, room_id: int, tenant_id: int) -> Room:
        """Valida e retorna quarto"""
        room = self.db.query(Room).filter(
            Room.id == room_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True,
            Room.is_operational == True
        ).first()
        
        if not room:
            raise ValueError("Quarto não encontrado ou indisponível")
        
        return room
    
    def _validate_dates_and_availability(
        self,
        room: Room,
        check_in: date,
        check_out: date,
        tenant_id: int,
        booking_config: BookingEngineConfig
    ):
        """Valida datas e disponibilidade"""
        
        # Validar que as datas são futuras
        today = date.today()
        if check_in < today:
            raise ValueError("Data de check-in não pode ser no passado")
        
        # Validar antecedência mínima
        min_hours = booking_config.min_advance_booking_hours
        min_advance = datetime.now() + timedelta(hours=min_hours)
        check_in_datetime = datetime.combine(check_in, datetime.min.time())
        
        if check_in_datetime < min_advance:
            raise ValueError(
                f"Reserva deve ser feita com pelo menos {min_hours} horas de antecedência"
            )
        
        # Validar antecedência máxima
        max_days = booking_config.max_advance_booking_days
        max_advance = today + timedelta(days=max_days)
        
        if check_in > max_advance:
            raise ValueError(
                f"Reservas podem ser feitas com até {max_days} dias de antecedência"
            )
        
        # Validar número de noites
        nights = (check_out - check_in).days
        
        if nights < booking_config.default_min_stay:
            raise ValueError(
                f"Estadia mínima é de {booking_config.default_min_stay} noite(s)"
            )
        
        if booking_config.default_max_stay and nights > booking_config.default_max_stay:
            raise ValueError(
                f"Estadia máxima é de {booking_config.default_max_stay} noite(s)"
            )
        
        # Validar disponibilidade real
        is_available = self.availability_service.check_room_availability(
            room.id,
            check_in,
            check_out,
            tenant_id,
            validate_restrictions=False
        )
        
        if not is_available['available']:
            raise ValueError("Quarto não está disponível para o período selecionado")
    
    def _validate_capacity(self, room: Room, total_guests: int):
        """Valida capacidade do quarto"""
        if total_guests > room.max_occupancy:
            raise ValueError(
                f"Número de hóspedes ({total_guests}) excede a capacidade "
                f"máxima do quarto ({room.max_occupancy})"
            )
    
    def _create_or_update_guest(
        self,
        booking_data: PublicBookingCreate,
        tenant_id: int
    ) -> Guest:
        """
        Cria novo hóspede ou atualiza existente.
        ✅ CORRIGIDO: Usar campos corretos do modelo Guest
        """
        
        # Buscar hóspede existente por email
        guest = self.db.query(Guest).filter(
            Guest.email == booking_data.guest_email,
            Guest.tenant_id == tenant_id
        ).first()
        
        # Separar nome em first_name e last_name
        name_parts = booking_data.guest_name.strip().split()
        first_name = name_parts[0]
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
        
        if guest:
            # Atualizar dados do hóspede existente
            guest.first_name = first_name
            guest.last_name = last_name
            guest.phone = booking_data.guest_phone
            
            if booking_data.guest_document:
                guest.document_number = booking_data.guest_document
                
            if booking_data.guest_country:
                guest.nationality = booking_data.guest_country
                
            # ✅ CORRIGIDO: Usar address_line1 ao invés de address
            if booking_data.guest_address:
                guest.address_line1 = booking_data.guest_address
                
        else:
            # ✅ CORRIGIDO: Criar novo hóspede com campos corretos
            guest = Guest(
                tenant_id=tenant_id,
                first_name=first_name,
                last_name=last_name,
                email=booking_data.guest_email,
                phone=booking_data.guest_phone,
                document_number=booking_data.guest_document,
                nationality=booking_data.guest_country or "Brasil",
                address_line1=booking_data.guest_address  # ✅ CORRIGIDO: Campo correto
            )
            self.db.add(guest)
        
        self.db.flush()
        return guest
    
    def _calculate_pricing(
        self,
        room: Room,
        check_in: date,
        check_out: date,
        tenant_id: int,
        extras: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Decimal]:
        """Calcula valores da reserva"""
        
        # Calcular tarifa base do período
        availability_check = self.availability_service.check_room_availability(
            room.id,
            check_in,
            check_out,
            tenant_id,
            validate_restrictions=False
        )
        
        base_rate = availability_check.get('total_rate', Decimal('0.00'))
        
        if not base_rate:
            raise ValueError("Não foi possível calcular tarifa para o período")
        
        # Calcular extras (se houver)
        extras_total = Decimal('0.00')
        if extras:
            for extra in extras:
                extras_total += Decimal(str(extra.get('price', 0)))
        
        # Calcular total
        subtotal = base_rate
        total = subtotal + extras_total
        
        return {
            'subtotal': subtotal,
            'extras': extras_total,
            'discount': Decimal('0.00'),
            'taxes': Decimal('0.00'),
            'total': total
        }
    
    def _create_reservation(
        self,
        booking_data: PublicBookingCreate,
        property_obj: Property,
        room: Room,
        guest: Guest,
        pricing: Dict[str, Decimal]
    ) -> Reservation:
        """Cria a reserva no banco de dados"""
        
        nights = (booking_data.check_out_date - booking_data.check_in_date).days
        
        # Gerar token público único
        public_token = self._generate_public_token()
        
        # Gerar número de reserva
        reservation_number = self._generate_reservation_number(property_obj.tenant_id)
        
        # Criar reserva
        reservation = Reservation(
            tenant_id=property_obj.tenant_id,
            reservation_number=reservation_number,
            property_id=property_obj.id,
            room_id=room.id,
            guest_id=guest.id,
            
            # Datas
            check_in_date=booking_data.check_in_date,
            check_out_date=booking_data.check_out_date,
            # nights é calculado automaticamente pelo modelo
            
            # Hóspedes
            adults=booking_data.adults,
            children=booking_data.children,
            total_guests=booking_data.adults + booking_data.children,
            
            # Valores
            total_amount=pricing['total'],
            
            # Status inicial
            status='pending_confirmation',
            
            # Canal de venda
            source='public_booking_engine',
            sales_channel_name='Booking Engine',
            
            # Método de pagamento escolhido
            payment_method=booking_data.payment_method,
            
            # Informações adicionais
            special_requests=booking_data.special_requests,
            
            # Token público
            public_token=public_token,
            
            # Dados do hóspede (copiados para reserva)
            guest_name=guest.full_name if hasattr(guest, 'full_name') else f"{guest.first_name} {guest.last_name}",
            guest_email=guest.email,
            guest_phone=guest.phone,
            guest_document=guest.document_number,
            
            # Metadata
            booking_source='public_booking_engine',
            booking_metadata={
                'accepts_terms': booking_data.accepts_terms,
                'accepts_privacy_policy': booking_data.accepts_privacy_policy,
                'subscribe_newsletter': booking_data.subscribe_newsletter,
                'promo_code': booking_data.promo_code,
                'source': booking_data.source,
                'referrer': booking_data.referrer,
                'extras': booking_data.extras,
                'pricing_breakdown': {
                    'subtotal': float(pricing['subtotal']),
                    'extras': float(pricing['extras']),
                    'discount': float(pricing['discount']),
                    'taxes': float(pricing['taxes']),
                    'total': float(pricing['total'])
                }
            }
        )
        
        self.db.add(reservation)
        self.db.flush()
        
        # ✅ CRÍTICO: Criar entrada em ReservationRoom para o mapa funcionar
        from app.models.reservation import ReservationRoom
        
        reservation_room = ReservationRoom(
            reservation_id=reservation.id,
            room_id=room.id,
            check_in_date=booking_data.check_in_date,
            check_out_date=booking_data.check_out_date,
            rate_per_night=pricing['subtotal'] / nights if nights > 0 else Decimal('0.00'),
            total_amount=pricing['total'],
            status='reserved',
            notes=booking_data.special_requests
        )
        
        self.db.add(reservation_room)
        self.db.flush()
        
        return reservation
    
    def _generate_reservation_number(self, tenant_id: int) -> str:
        """Gera número único de reserva"""
        from sqlalchemy import func
        
        year = datetime.now().year
        count = self.db.query(func.count(Reservation.id)).filter(
            Reservation.tenant_id == tenant_id,
            func.extract('year', Reservation.created_at) == year
        ).scalar()
        
        sequence = count + 1
        return f"RES-{year}-{sequence:06d}"
    
    def _generate_public_token(self) -> str:
        """Gera token único para acompanhamento público da reserva"""
        return secrets.token_urlsafe(32)
    
    def get_booking_by_token(self, token: str) -> Optional[Reservation]:
        """Busca reserva pelo token público"""
        return self.db.query(Reservation).filter(
            Reservation.public_token == token
        ).first()
    
    def send_booking_notifications(self, reservation_id: int, tenant_id: int):
        """
        Envia notificações sobre nova reserva.
        Executado em background task.
        
        Args:
            reservation_id: ID da reserva
            tenant_id: ID do tenant
        """
        try:
            reservation = self.db.query(Reservation).filter(
                Reservation.id == reservation_id,
                Reservation.tenant_id == tenant_id
            ).first()
            
            if not reservation:
                logger.error(f"Reserva {reservation_id} não encontrada para notificações")
                return
            
            # TODO: Implementar envio de emails
            # 1. Email para o hóspede (confirmação)
            # 2. Email para a propriedade (notificação)
            # 3. SMS/WhatsApp (se configurado)
            
            logger.info(f"Notificações enviadas para reserva {reservation_id}")
            
        except Exception as e:
            logger.error(f"Erro ao enviar notificações para reserva {reservation_id}: {str(e)}")