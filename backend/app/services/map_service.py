# backend/app/services/map_service.py

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, case, text, desc
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.reservation import Reservation, ReservationRoom
from app.models.guest import Guest
from app.models.room_availability import RoomAvailability
from app.schemas.map import (
    MapDataRequest, MapResponse, MapCategoryData, MapRoomData, 
    MapReservationResponse, MapStatsResponse, MapAvailabilityCheck,
    MapBulkOperation, MapQuickBooking
)
from app.services.reservation_service import ReservationService
from app.services.room_availability_service import RoomAvailabilityService
from app.utils.decorators import audit_operation


class MapService:
    """Serviço para operações do mapa de quartos"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_map_data(
        self, 
        tenant_id: int, 
        request: MapDataRequest
    ) -> MapResponse:
        """
        Busca dados completos para o mapa de quartos
        """
        # Validar período
        if (request.end_date - request.start_date).days > 90:
            raise ValueError("Período não pode exceder 90 dias")
        
        # Buscar propriedade se especificada
        property_info = None
        if request.property_id:
            property_info = self.db.query(Property).filter(
                Property.id == request.property_id,
                Property.tenant_id == tenant_id,
                Property.is_active == True
            ).first()
        
        # Buscar quartos agrupados por tipo
        categories = self._get_rooms_by_category(
            tenant_id, 
            request.property_id, 
            request.room_type_ids,
            request.include_out_of_order
        )
        
        # Buscar reservas do período
        reservations = self._get_period_reservations(
            tenant_id,
            request.start_date,
            request.end_date,
            request.property_id,
            request.status_filter,
            request.include_cancelled
        )
        
        # Mapear reservas por quarto
        room_reservations = self._map_reservations_by_room(reservations, request.start_date, request.end_date)
        
        # Construir dados das categorias
        category_data = []
        total_rooms = 0
        total_operational_rooms = 0
        total_reservations = 0
        total_revenue = Decimal('0.00')
        status_counts = {}
        
        for room_type, rooms in categories.items():
            category_rooms = []
            category_stats = {
                'total_rooms': len(rooms),
                'operational_rooms': 0,
                'out_of_order_rooms': 0,
                'occupied_rooms': 0,
                'available_rooms': 0,
                'total_reservations': 0,
                'total_revenue': Decimal('0.00'),
                'occupancy_rate': 0.0
            }
            
            for room in rooms:
                # Reservas deste quarto no período
                room_room_reservations = room_reservations.get(room.id, [])
                
                # Calcular ocupação do quarto
                occupancy_days = self._calculate_room_occupancy_days(
                    room_room_reservations, request.start_date, request.end_date
                )
                total_days = (request.end_date - request.start_date).days
                occupancy_rate = (occupancy_days / total_days * 100) if total_days > 0 else 0
                
                # Converter reservas para response schema
                map_reservations = []
                for reservation in room_room_reservations:
                    map_reservation = MapReservationResponse(
                        id=reservation.id,
                        reservation_number=reservation.reservation_number,
                        status=reservation.status,
                        guest_name=reservation.guest.full_name if reservation.guest else "Hóspede não informado",
                        guest_email=reservation.guest.email if reservation.guest else None,
                        check_in_date=reservation.check_in_date,
                        check_out_date=reservation.check_out_date,
                        nights=reservation.nights,
                        total_amount=reservation.total_amount,
                        paid_amount=reservation.total_paid,
                        balance_due=reservation.balance_due,
                        total_guests=reservation.total_guests,
                        source=reservation.source,
                        notes=reservation.internal_notes,
                        is_arrival=reservation.check_in_date == date.today(),
                        is_departure=reservation.check_out_date == date.today(),
                        is_current=(reservation.status == 'checked_in')
                    )
                    map_reservations.append(map_reservation)
                    
                    # Contar por status
                    status_counts[reservation.status] = status_counts.get(reservation.status, 0) + 1
                
                # Dados do quarto
                room_data = MapRoomData(
                    id=room.id,
                    room_number=room.room_number,
                    name=room.name,
                    floor=room.floor,
                    building=room.building,
                    max_occupancy=room.max_occupancy or room.room_type.max_capacity,
                    is_operational=room.is_operational,
                    is_out_of_order=room.is_out_of_order,
                    maintenance_notes=room.maintenance_notes,
                    housekeeping_notes=room.housekeeping_notes,
                    reservations=map_reservations,
                    occupancy_days=occupancy_days,
                    total_days_in_period=total_days,
                    occupancy_rate=occupancy_rate
                )
                
                category_rooms.append(room_data)
                
                # Atualizar estatísticas da categoria
                if room.is_operational:
                    category_stats['operational_rooms'] += 1
                if room.is_out_of_order:
                    category_stats['out_of_order_rooms'] += 1
                if room_room_reservations:
                    category_stats['occupied_rooms'] += 1
                else:
                    category_stats['available_rooms'] += 1
                
                category_stats['total_reservations'] += len(room_room_reservations)
                category_stats['total_revenue'] += sum(r.total_amount for r in room_room_reservations)
            
            # Calcular ocupação média da categoria
            if category_stats['total_rooms'] > 0:
                total_room_days = category_stats['total_rooms'] * total_days
                occupied_days = sum(room.occupancy_days for room in category_rooms)
                category_stats['occupancy_rate'] = (occupied_days / total_room_days * 100) if total_room_days > 0 else 0
            
            # Dados da categoria
            category_data.append(MapCategoryData(
                room_type_id=room_type.id,
                room_type_name=room_type.name,
                room_type_slug=room_type.slug,
                room_type_description=room_type.description,
                base_capacity=room_type.base_capacity,
                max_capacity=room_type.max_capacity,
                rooms=category_rooms,
                total_rooms=category_stats['total_rooms'],
                operational_rooms=category_stats['operational_rooms'],
                out_of_order_rooms=category_stats['out_of_order_rooms'],
                occupied_rooms=category_stats['occupied_rooms'],
                available_rooms=category_stats['available_rooms'],
                total_reservations=category_stats['total_reservations'],
                total_revenue=category_stats['total_revenue'],
                average_occupancy_rate=category_stats['occupancy_rate']
            ))
            
            # Atualizar totais gerais
            total_rooms += category_stats['total_rooms']
            total_operational_rooms += category_stats['operational_rooms']
            total_reservations += category_stats['total_reservations']
            total_revenue += category_stats['total_revenue']
        
        # Calcular ocupação geral
        total_days = (request.end_date - request.start_date).days
        total_room_nights = total_operational_rooms * total_days
        occupied_room_nights = sum(
            sum(room.occupancy_days for room in category.rooms) 
            for category in category_data
        )
        overall_occupancy_rate = (occupied_room_nights / total_room_nights * 100) if total_room_nights > 0 else 0
        
        # Gerar cabeçalhos de data
        date_headers = []
        current_date = request.start_date
        while current_date < request.end_date:
            date_headers.append(current_date)
            current_date += timedelta(days=1)
        
        return MapResponse(
            start_date=request.start_date,
            end_date=request.end_date,
            total_days=total_days,
            property_id=request.property_id,
            property_name=property_info.name if property_info else None,
            categories=category_data,
            total_rooms=total_rooms,
            total_operational_rooms=total_operational_rooms,
            total_reservations=total_reservations,
            total_revenue=total_revenue,
            overall_occupancy_rate=overall_occupancy_rate,
            status_counts=status_counts,
            date_headers=date_headers
        )

    def get_map_stats(
        self, 
        tenant_id: int, 
        start_date: date, 
        end_date: date,
        property_id: Optional[int] = None
    ) -> MapStatsResponse:
        """
        Busca estatísticas do mapa para um período
        """
        # Validações básicas
        if (end_date - start_date).days > 365:
            raise ValueError("Período não pode exceder 365 dias")
        
        # Buscar quartos
        rooms_query = self.db.query(Room).options(
            joinedload(Room.room_type)
        ).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        if property_id:
            rooms_query = rooms_query.filter(Room.property_id == property_id)
        
        rooms = rooms_query.all()
        
        # Buscar reservas do período - USANDO A LÓGICA CORRIGIDA
        reservations_query = self.db.query(Reservation).options(
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True,
            # ✅ CORREÇÃO: Lógica corrigida de sobreposição
            or_(
                # Reservas que se sobrepõem ao período (lógica simplificada e correta)
                and_(
                    Reservation.check_out_date > start_date,  # Termina depois do início do período
                    Reservation.check_in_date < end_date      # Começa antes do fim do período
                ),
                # Reservas checked-in que ainda não fizeram checkout (sempre visíveis)
                and_(
                    Reservation.status == 'checked_in',
                    Reservation.check_out_date >= start_date  # Ainda não passou da data de checkout
                )
            )
        )
        
        if property_id:
            reservations_query = reservations_query.filter(Reservation.property_id == property_id)
        
        reservations = reservations_query.all()
        
        # Calcular estatísticas
        total_days = (end_date - start_date).days
        total_rooms = len(rooms)
        operational_rooms = sum(1 for room in rooms if room.is_operational)
        out_of_order_rooms = sum(1 for room in rooms if room.is_out_of_order)
        maintenance_rooms = sum(1 for room in rooms if room.maintenance_notes)
        
        # Estatísticas de ocupação
        total_room_nights = operational_rooms * total_days
        occupied_room_nights = 0
        
        for reservation in reservations:
            # Calcular noites ocupadas dentro do período
            res_start = max(reservation.check_in_date, start_date)
            res_end = min(reservation.check_out_date, end_date)
            if res_start < res_end:
                nights_in_period = (res_end - res_start).days
                occupied_room_nights += nights_in_period
        
        available_room_nights = total_room_nights - occupied_room_nights
        occupancy_rate = (occupied_room_nights / total_room_nights * 100) if total_room_nights > 0 else 0
        
        # Estatísticas de receita
        total_revenue = sum(r.total_amount for r in reservations if r.status != 'cancelled')
        confirmed_revenue = sum(r.total_amount for r in reservations if r.status in ['confirmed', 'checked_in', 'checked_out'])
        pending_revenue = sum(r.total_amount for r in reservations if r.status == 'pending')
        
        average_daily_rate = (total_revenue / occupied_room_nights) if occupied_room_nights > 0 else Decimal('0.00')
        revenue_per_available_room = (total_revenue / total_room_nights) if total_room_nights > 0 else Decimal('0.00')
        
        # Contadores de reservas
        total_reservations = len(reservations)
        arrivals = sum(1 for r in reservations if r.check_in_date >= start_date and r.check_in_date < end_date)
        departures = sum(1 for r in reservations if r.check_out_date > start_date and r.check_out_date <= end_date)
        stayovers = total_reservations - arrivals - departures
        
        # Contadores por status
        status_counts = {}
        for reservation in reservations:
            status = reservation.status
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Estatísticas por categoria
        category_stats = []
        room_types = {}
        for room in rooms:
            if room.room_type_id not in room_types:
                room_types[room.room_type_id] = {
                    'room_type': room.room_type,
                    'rooms': [],
                    'reservations': []
                }
            room_types[room.room_type_id]['rooms'].append(room)
        
        for reservation in reservations:
            for res_room in reservation.reservation_rooms:
                if res_room.room and res_room.room.room_type_id in room_types:
                    room_types[res_room.room.room_type_id]['reservations'].append(reservation)
        
        for rt_id, rt_data in room_types.items():
            rt_total_rooms = len(rt_data['rooms'])
            rt_operational = sum(1 for r in rt_data['rooms'] if r.is_operational)
            rt_reservations = len(rt_data['reservations'])
            rt_revenue = sum(r.total_amount for r in rt_data['reservations'] if r.status != 'cancelled')
            rt_room_nights = rt_operational * total_days
            rt_occupied_nights = 0
            
            for reservation in rt_data['reservations']:
                res_start = max(reservation.check_in_date, start_date)
                res_end = min(reservation.check_out_date, end_date)
                if res_start < res_end:
                    nights = (res_end - res_start).days
                    rt_occupied_nights += nights
            
            rt_occupancy = (rt_occupied_nights / rt_room_nights * 100) if rt_room_nights > 0 else 0
            
            category_stats.append({
                'room_type_id': rt_id,
                'room_type_name': rt_data['room_type'].name,
                'total_rooms': rt_total_rooms,
                'operational_rooms': rt_operational,
                'total_reservations': rt_reservations,
                'total_revenue': float(rt_revenue),
                'occupancy_rate': rt_occupancy,
                'average_daily_rate': float(rt_revenue / rt_occupied_nights) if rt_occupied_nights > 0 else 0
            })
        
        return MapStatsResponse(
            period_start=start_date,
            period_end=end_date,
            total_days=total_days,
            total_rooms=total_rooms,
            operational_rooms=operational_rooms,
            out_of_order_rooms=out_of_order_rooms,
            maintenance_rooms=maintenance_rooms,
            total_room_nights=total_room_nights,
            occupied_room_nights=occupied_room_nights,
            available_room_nights=available_room_nights,
            occupancy_rate=occupancy_rate,
            total_revenue=total_revenue,
            confirmed_revenue=confirmed_revenue,
            pending_revenue=pending_revenue,
            average_daily_rate=average_daily_rate,
            revenue_per_available_room=revenue_per_available_room,
            total_reservations=total_reservations,
            arrivals=arrivals,
            departures=departures,
            stayovers=stayovers,
            confirmed_reservations=status_counts.get('confirmed', 0),
            checked_in_reservations=status_counts.get('checked_in', 0),
            checked_out_reservations=status_counts.get('checked_out', 0),
            cancelled_reservations=status_counts.get('cancelled', 0),
            pending_reservations=status_counts.get('pending', 0),
            category_stats=category_stats
        )

    def _get_rooms_by_category(
        self, 
        tenant_id: int, 
        property_id: Optional[int] = None,
        room_type_ids: Optional[List[int]] = None,
        include_out_of_order: bool = True
    ) -> Dict[RoomType, List[Room]]:
        """
        Busca quartos agrupados por categoria
        """
        query = self.db.query(Room).options(
            joinedload(Room.room_type)
        ).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        if property_id:
            query = query.filter(Room.property_id == property_id)
        
        if room_type_ids:
            query = query.filter(Room.room_type_id.in_(room_type_ids))
        
        if not include_out_of_order:
            query = query.filter(Room.is_out_of_order == False)
        
        rooms = query.order_by(Room.room_type_id, Room.room_number).all()
        
        # Agrupar por tipo de quarto
        categories = {}
        for room in rooms:
            if room.room_type not in categories:
                categories[room.room_type] = []
            categories[room.room_type].append(room)
        
        return categories

    def _get_period_reservations(
        self,
        tenant_id: int,
        start_date: date,
        end_date: date,
        property_id: Optional[int] = None,
        status_filter: Optional[List[str]] = None,
        include_cancelled: bool = False
    ) -> List[Reservation]:
        """
        ✅ CORRIGIDO: Busca reservas que se sobrepõem ao período
        
        A lógica anterior era muito restritiva e não capturava todas as reservas
        que deveriam aparecer no mapa. A nova lógica usa uma abordagem mais simples
        e correta para determinar sobreposição de intervalos.
        """
        query = self.db.query(Reservation).options(
            joinedload(Reservation.guest),
            joinedload(Reservation.reservation_rooms).joinedload(ReservationRoom.room)
        ).filter(
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True,
            # ✅ CORREÇÃO PRINCIPAL: Nova lógica de sobreposição
            or_(
                # Caso 1: Reservas que se sobrepõem ao período (lógica matemática correta)
                # Uma reserva se sobrepõe ao período SE:
                # - Termina DEPOIS do início do período E
                # - Começa ANTES do fim do período
                and_(
                    Reservation.check_out_date > start_date,  # Termina depois do início
                    Reservation.check_in_date < end_date      # Começa antes do fim
                ),
                # Caso 2: Reservas checked-in sempre visíveis (independente do período)
                # Reservas que já fizeram check-in devem continuar aparecendo 
                # no mapa até que façam check-out
                and_(
                    Reservation.status == 'checked_in',
                    or_(
                        Reservation.check_out_date >= start_date,  # Checkout futuro
                        Reservation.check_out_date.is_(None)       # Checkout indefinido
                    )
                )
            )
        )
        
        if property_id:
            query = query.filter(Reservation.property_id == property_id)
        
        if status_filter:
            query = query.filter(Reservation.status.in_(status_filter))
        
        if not include_cancelled:
            query = query.filter(Reservation.status != 'cancelled')
        
        return query.all()

    def _map_reservations_by_room(
        self, 
        reservations: List[Reservation],
        start_date: date,
        end_date: date
    ) -> Dict[int, List[Reservation]]:
        """
        Mapeia reservas por ID do quarto
        """
        room_reservations = {}
        
        for reservation in reservations:
            for res_room in reservation.reservation_rooms:
                if res_room.room_id:
                    if res_room.room_id not in room_reservations:
                        room_reservations[res_room.room_id] = []
                    room_reservations[res_room.room_id].append(reservation)
        
        return room_reservations

    def _calculate_room_occupancy_days(
        self, 
        reservations: List[Reservation], 
        start_date: date, 
        end_date: date
    ) -> int:
        """
        Calcula total de dias ocupados de um quarto no período
        """
        occupied_days = 0
        
        for reservation in reservations:
            if reservation.status in ['confirmed', 'checked_in', 'checked_out']:
                # Interseção da reserva com o período
                res_start = max(reservation.check_in_date, start_date)
                res_end = min(reservation.check_out_date, end_date)
                
                if res_start < res_end:
                    occupied_days += (res_end - res_start).days
        
        return occupied_days

    @audit_operation("map_bulk_operation", "room_availability")
    def execute_bulk_operation(
        self, 
        tenant_id: int, 
        operation: MapBulkOperation, 
        user_id: int
    ) -> Dict[str, Any]:
        """
        Executa operação em lote no mapa
        """
        availability_service = RoomAvailabilityService(self.db)
        
        affected_records = 0
        errors = []
        
        try:
            if operation.operation_type == "block":
                # Bloquear quartos criando registros de disponibilidade
                for room_id in operation.room_ids:
                    current_date = operation.date_from
                    while current_date <= operation.date_to:
                        try:
                            # Verificar se já existe registro para esta data
                            existing = self.db.query(RoomAvailability).filter(
                                RoomAvailability.room_id == room_id,
                                RoomAvailability.date == current_date,
                                RoomAvailability.tenant_id == tenant_id
                            ).first()
                            
                            if existing:
                                # Atualizar registro existente
                                existing.is_blocked = True
                                existing.reason = operation.reason
                                existing.notes = operation.notes
                            else:
                                # Criar novo registro
                                availability_record = RoomAvailability(
                                    room_id=room_id,
                                    date=current_date,
                                    is_available=False,
                                    is_blocked=True,
                                    is_out_of_order=False,
                                    is_maintenance=False,
                                    reason=operation.reason,
                                    notes=operation.notes,
                                    tenant_id=tenant_id
                                )
                                self.db.add(availability_record)
                            
                            affected_records += 1
                        except Exception as e:
                            errors.append(f"Quarto {room_id}, data {current_date}: {str(e)}")
                        current_date += timedelta(days=1)
            
            elif operation.operation_type == "unblock":
                # Desbloquear quartos (implementação similar ao block)
                for room_id in operation.room_ids:
                    current_date = operation.date_from
                    while current_date <= operation.date_to:
                        try:
                            # Verificar se existe registro para esta data
                            existing = self.db.query(RoomAvailability).filter(
                                RoomAvailability.room_id == room_id,
                                RoomAvailability.date == current_date,
                                RoomAvailability.tenant_id == tenant_id
                            ).first()
                            
                            if existing:
                                # Atualizar registro existente
                                existing.is_blocked = False
                                existing.is_available = True
                                existing.reason = operation.reason
                                existing.notes = operation.notes
                                affected_records += 1
                            else:
                                # Criar novo registro desbloqueado
                                availability_record = RoomAvailability(
                                    room_id=room_id,
                                    date=current_date,
                                    is_available=True,
                                    is_blocked=False,
                                    is_out_of_order=False,
                                    is_maintenance=False,
                                    reason=operation.reason,
                                    notes=operation.notes,
                                    tenant_id=tenant_id
                                )
                                self.db.add(availability_record)
                                affected_records += 1
                        except Exception as e:
                            errors.append(f"Quarto {room_id}, data {current_date}: {str(e)}")
                        current_date += timedelta(days=1)
            
            elif operation.operation_type == "maintenance":
                # Marcar para manutenção
                for room_id in operation.room_ids:
                    room = self.db.query(Room).filter(
                        Room.id == room_id,
                        Room.tenant_id == tenant_id
                    ).first()
                    if room:
                        room.maintenance_notes = operation.notes or "Manutenção programada"
                        room.is_out_of_order = True
                        affected_records += 1
            
            elif operation.operation_type == "clean":
                # Limpar status
                for room_id in operation.room_ids:
                    room = self.db.query(Room).filter(
                        Room.id == room_id,
                        Room.tenant_id == tenant_id
                    ).first()
                    if room:
                        room.housekeeping_notes = operation.notes or "Limpeza realizada"
                        room.is_out_of_order = False
                        room.maintenance_notes = None
                        affected_records += 1
            
            self.db.commit()
            
            return {
                "success": True,
                "message": f"Operação {operation.operation_type} executada com sucesso",
                "affected_records": affected_records,
                "errors": errors,
                "operation_details": {
                    "type": operation.operation_type,
                    "rooms_count": len(operation.room_ids),
                    "date_range": f"{operation.date_from} até {operation.date_to}",
                    "reason": operation.reason
                }
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "message": f"Erro na operação em lote: {str(e)}",
                "affected_records": 0,
                "errors": errors + [str(e)]
            }

    def create_quick_booking(
        self, 
        tenant_id: int, 
        property_id: int,
        booking_data: MapQuickBooking,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Cria reserva rápida pelo mapa
        """
        try:
            reservation_service = ReservationService(self.db)
            
            # Verificar disponibilidade do quarto
            availability = reservation_service.check_room_availability(
                [booking_data.room_id],
                booking_data.check_in_date,
                booking_data.check_out_date,
                tenant_id
            )
            
            if not availability.get(booking_data.room_id, False):
                return {
                    "success": False,
                    "message": "Quarto não está disponível no período selecionado"
                }
            
            # Buscar o objeto User pelo ID
            from app.models.user import User
            current_user = self.db.query(User).filter(User.id == user_id).first()
            if not current_user:
                return {
                    "success": False,
                    "message": "Usuário não encontrado"
                }
            
            # Criar ou buscar hóspede
            guest = None
            if booking_data.guest_email:
                guest = self.db.query(Guest).filter(
                    Guest.email == booking_data.guest_email,
                    Guest.tenant_id == tenant_id,
                    Guest.is_active == True
                ).first()
            
            guest_id = None
            
            if not guest:
                # Criar novo hóspede
                from app.schemas.guest import GuestCreate
                from app.services.guest_service import GuestService

                # Separar nome completo em primeiro nome e sobrenome
                name_parts = booking_data.guest_name.strip().split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else 'Sobrenome'

                guest_service = GuestService(self.db)
                guest_data = GuestCreate(
                    first_name=first_name,
                    last_name=last_name,
                    email=booking_data.guest_email,
                    phone=booking_data.guest_phone,
                    nationality='Brasil',  # Valor padrão obrigatório
                    country='Brasil'       # Valor padrão obrigatório
                )
                guest_result = guest_service.create_guest(guest_data, tenant_id, current_user)
                
                # Verificar se retornou ID ou objeto
                if isinstance(guest_result, int):
                    guest_id = guest_result
                    # Buscar o guest pelo ID para usar o full_name na resposta
                    guest = self.db.query(Guest).filter(Guest.id == guest_id).first()
                else:
                    guest_id = guest_result.id
                    guest = guest_result
            else:
                guest_id = guest.id
            
            # Calcular valores
            nights = (booking_data.check_out_date - booking_data.check_in_date).days
            rate_per_night = booking_data.rate or Decimal('100.00')  # Taxa padrão
            total_amount = booking_data.total_amount or (rate_per_night * nights)
            
            # Criar reserva
            from app.schemas.reservation import ReservationCreate
            
            reservation_data = ReservationCreate(
                guest_id=guest_id,
                property_id=property_id,
                check_in_date=booking_data.check_in_date,
                check_out_date=booking_data.check_out_date,
                adults=booking_data.adults,
                children=booking_data.children,
                total_amount=total_amount,
                source="direct",  # Usar valor válido aceito pela validação
                internal_notes=booking_data.notes,
                rooms=[{
                    "room_id": booking_data.room_id,
                    "check_in_date": booking_data.check_in_date,
                    "check_out_date": booking_data.check_out_date,
                    "rate_per_night": rate_per_night
                }]
            )
            
            reservation = reservation_service.create_reservation(reservation_data, tenant_id, current_user)
            
            return {
                "success": True,
                "message": "Reserva criada com sucesso",
                "reservation": {
                    "id": reservation.id,
                    "number": reservation.reservation_number,
                    "guest_name": guest.full_name if guest else booking_data.guest_name,
                    "check_in": str(reservation.check_in_date),
                    "check_out": str(reservation.check_out_date),
                    "total_amount": float(reservation.total_amount)
                }
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "message": f"Erro ao criar reserva: {str(e)}"
            }