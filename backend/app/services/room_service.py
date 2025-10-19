# backend/app/services/room_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, Integer
from fastapi import Request
from datetime import datetime, date
import logging

from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.user import User
from app.schemas.room import RoomCreate, RoomUpdate, RoomFilters, RoomBulkUpdate
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext

logger = logging.getLogger(__name__)


class RoomService:
    """Serviço para operações com quartos"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_room_by_id(self, room_id: int, tenant_id: int) -> Optional[Room]:
        """Busca quarto por ID dentro do tenant"""
        return self.db.query(Room).options(
            joinedload(Room.room_type),
            joinedload(Room.property_obj)
        ).filter(
            Room.id == room_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).first()

    def get_room_by_number(self, room_number: str, property_id: int, tenant_id: int) -> Optional[Room]:
        """Busca quarto por número dentro de uma propriedade"""
        return self.db.query(Room).filter(
            Room.room_number == room_number,
            Room.property_id == property_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).first()

    def get_rooms(
        self, 
        tenant_id: int, 
        filters: Optional[RoomFilters] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Room]:
        """Lista quartos com filtros opcionais"""
        query = self.db.query(Room).options(
            joinedload(Room.room_type),
            joinedload(Room.property_obj)
        ).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        if filters:
            if filters.property_id:
                query = query.filter(Room.property_id == filters.property_id)
            
            if filters.room_type_id:
                query = query.filter(Room.room_type_id == filters.room_type_id)
            
            if filters.floor is not None:
                query = query.filter(Room.floor == filters.floor)
            
            if filters.building:
                query = query.filter(Room.building.ilike(f"%{filters.building}%"))
            
            if filters.is_operational is not None:
                query = query.filter(Room.is_operational == filters.is_operational)
            
            if filters.is_out_of_order is not None:
                query = query.filter(Room.is_out_of_order == filters.is_out_of_order)
            
            if filters.is_available_for_booking is not None:
                # Disponível para reserva = ativo + operacional + não fora de ordem + tipo reservável
                if filters.is_available_for_booking:
                    query = query.join(RoomType).filter(
                        Room.is_operational == True,
                        Room.is_out_of_order == False,
                        RoomType.is_bookable == True
                    )
                else:
                    query = query.outerjoin(RoomType).filter(
                        or_(
                            Room.is_operational == False,
                            Room.is_out_of_order == True,
                            RoomType.is_bookable == False
                        )
                    )
            
            if filters.min_occupancy:
                # Considerar tanto max_occupancy do quarto quanto max_capacity do tipo
                query = query.outerjoin(RoomType).filter(
                    or_(
                        Room.max_occupancy >= filters.min_occupancy,
                        and_(Room.max_occupancy.is_(None), RoomType.max_capacity >= filters.min_occupancy)
                    )
                )
            
            if filters.max_occupancy:
                query = query.outerjoin(RoomType).filter(
                    or_(
                        Room.max_occupancy <= filters.max_occupancy,
                        and_(Room.max_occupancy.is_(None), RoomType.max_capacity <= filters.max_occupancy)
                    )
                )
            
            if filters.has_amenity:
                # Buscar amenidade nas comodidades base do tipo ou adiconais do quarto
                amenity_lower = filters.has_amenity.lower()
                query = query.outerjoin(RoomType).filter(
                    or_(
                        RoomType.amenities.op('?')(amenity_lower),
                        Room.additional_amenities.op('?')(amenity_lower)
                    )
                ).filter(
                    or_(
                        Room.removed_amenities.is_(None),
                        ~Room.removed_amenities.op('?')(amenity_lower)
                    )
                )
            
            if filters.search:
                # Busca textual em nome, número e observações
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Room.name.ilike(search_term),
                        Room.room_number.ilike(search_term),
                        Room.notes.ilike(search_term)
                    )
                )
        
        return query.order_by(Room.room_number).offset(skip).limit(limit).all()

    def count_rooms(self, tenant_id: int, filters: Optional[RoomFilters] = None) -> int:
        """Conta total de quartos (para paginação)"""
        query = self.db.query(func.count(Room.id)).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        # Aplicar mesmos filtros da busca (simplificado)
        if filters:
            if filters.property_id:
                query = query.filter(Room.property_id == filters.property_id)
            if filters.room_type_id:
                query = query.filter(Room.room_type_id == filters.room_type_id)
            if filters.floor is not None:
                query = query.filter(Room.floor == filters.floor)
            if filters.building:
                query = query.filter(Room.building.ilike(f"%{filters.building}%"))
            if filters.is_operational is not None:
                query = query.filter(Room.is_operational == filters.is_operational)
            if filters.is_out_of_order is not None:
                query = query.filter(Room.is_out_of_order == filters.is_out_of_order)
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Room.name.ilike(search_term),
                        Room.room_number.ilike(search_term),
                        Room.notes.ilike(search_term)
                    )
                )
        
        return query.scalar()

    def create_room(
        self, 
        room_data: RoomCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Room:
        """Cria novo quarto com auditoria automática e criação automática na WuBook"""
        
        # Verificar se já existe quarto com mesmo número na propriedade
        existing = self.get_room_by_number(room_data.room_number, room_data.property_id, tenant_id)
        if existing:
            raise ValueError("Já existe um quarto com este número nesta propriedade")
        
        # Verificar se propriedade e room_type existem e pertencem ao tenant
        property_obj = self.db.query(Property).filter(
            Property.id == room_data.property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()
        if not property_obj:
            raise ValueError("Propriedade não encontrada")
        
        room_type_obj = self.db.query(RoomType).filter(
            RoomType.id == room_data.room_type_id,
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True
        ).first()
        if not room_type_obj:
            raise ValueError("Tipo de quarto não encontrado")

        # Criar room no PMS primeiro
        room_obj = Room(
            **room_data.dict(),
            tenant_id=tenant_id
        )
        
        try:
            # 1. CRIAR NO PMS PRIMEIRO
            self.db.add(room_obj)
            self.db.commit()
            self.db.refresh(room_obj)
            
            # 2. REGISTRAR AUDITORIA
            new_values = _extract_model_data(room_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_create(
                    "rooms", 
                    room_obj.id, 
                    new_values,
                    f"Quarto '{room_obj.room_number}' criado na propriedade '{property_obj.name}'"
                )
            
            # 3. TENTAR CRIAR NA WUBOOK E MAPEAR (NÃO QUEBRA SE FALHAR)
            try:
                self._create_room_in_wubook_and_map(room_obj, tenant_id, current_user)
            except Exception as wubook_error:
                # Log da falha mas não quebra a criação do quarto
                logger.warning(f"Falha na criação automática na WuBook para quarto {room_obj.id}: {wubook_error}")
                # Quarto já foi criado no PMS, continua normalmente
            
            return room_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar quarto - dados duplicados")

    def update_room(
        self, 
        room_id: int, 
        tenant_id: int, 
        room_data: RoomUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Room]:
        """Atualiza quarto com auditoria automática"""
        
        room_obj = self.get_room_by_id(room_id, tenant_id)
        if not room_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(room_obj)

        # Verificar dados que serão atualizados
        update_data = room_data.dict(exclude_unset=True)

        # Se room_number for alterado, verificar duplicação
        if 'room_number' in update_data and update_data['room_number'] != room_obj.room_number:
            existing = self.get_room_by_number(update_data['room_number'], room_obj.property_id, tenant_id)
            if existing and existing.id != room_id:
                raise ValueError("Já existe um quarto com este número nesta propriedade")

        # Aplicar alterações apenas nos campos fornecidos
        for field, value in update_data.items():
            if hasattr(room_obj, field):
                setattr(room_obj, field, value)

        try:
            self.db.commit()
            self.db.refresh(room_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(room_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "rooms", 
                    room_obj.id, 
                    old_values, 
                    new_values,
                    f"Quarto '{room_obj.room_number}' atualizado"
                )
            
            return room_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar quarto")

    def delete_room(
        self, 
        room_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> bool:
        """Desativa quarto (soft delete) com auditoria e limpeza automática"""
        
        room_obj = self.get_room_by_id(room_id, tenant_id)
        if not room_obj:
            return False

        # Capturar valores para auditoria
        old_values = _extract_model_data(room_obj)

        try:
            # ✅ NOVO: Desativar mapeamentos WuBook relacionados
            from app.models.wubook_room_mapping import WuBookRoomMapping
            
            wubook_mappings = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room_id,
                WuBookRoomMapping.tenant_id == tenant_id,
                WuBookRoomMapping.is_active == True
            ).all()
            
            mappings_count = len(wubook_mappings)
            if mappings_count > 0:
                logger.info(f"Desativando {mappings_count} mapeamentos WuBook para quarto {room_id}")
                
                for mapping in wubook_mappings:
                    mapping.is_active = False
                    mapping.updated_at = datetime.utcnow()
                    # Marcar para sincronização de remoção
                    mapping.sync_pending = True
            
            # ✅ NOVO: Desativar disponibilidades futuras relacionadas  
            from app.models.room_availability import RoomAvailability
            
            future_availabilities = self.db.query(RoomAvailability).filter(
                RoomAvailability.room_id == room_id,
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.date >= date.today(),
                RoomAvailability.is_active == True
            ).all()
            
            availabilities_count = len(future_availabilities)
            if availabilities_count > 0:
                logger.info(f"Desativando {availabilities_count} disponibilidades futuras para quarto {room_id}")
                
                for availability in future_availabilities:
                    availability.is_active = False
                    availability.updated_at = datetime.utcnow()
                    # Marcar para sincronização de remoção
                    availability.sync_pending = True

            # Soft delete do quarto
            room_obj.is_active = False
            room_obj.updated_at = datetime.utcnow()
            
            # Commit todas as alterações
            self.db.commit()
            
            # Registrar auditoria com informações adicionais
            additional_info = []
            if mappings_count > 0:
                additional_info.append(f"{mappings_count} mapeamentos WuBook desativados")
            if availabilities_count > 0:
                additional_info.append(f"{availabilities_count} disponibilidades futuras desativadas")
            
            description = f"Quarto '{room_obj.room_number}' desativado"
            if additional_info:
                description += f" ({', '.join(additional_info)})"
                
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_delete(
                    "rooms", 
                    room_obj.id, 
                    old_values,
                    description
                )
            
            logger.info(f"Quarto {room_id} desativado com limpeza automática concluída")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao desativar quarto {room_id}: {e}")
            return False

    def bulk_update_rooms(
        self,
        bulk_data: RoomBulkUpdate,
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """Atualização em lote de quartos"""
        
        # Buscar quartos que serão atualizados
        rooms = self.db.query(Room).filter(
            Room.id.in_(bulk_data.room_ids),
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).all()
        
        if len(rooms) != len(bulk_data.room_ids):
            raise ValueError("Alguns quartos não foram encontrados")

        updated_rooms = []
        
        try:
            for room in rooms:
                old_values = _extract_model_data(room)
                
                # Aplicar atualizações
                for field, value in bulk_data.updates.items():
                    if hasattr(room, field):
                        setattr(room, field, value)
                
                updated_rooms.append({
                    'id': room.id,
                    'room_number': room.room_number,
                    'old_values': old_values
                })
            
            self.db.commit()
            
            # Registrar auditoria para cada quarto
            with AuditContext(self.db, current_user, request) as audit:
                for room_info in updated_rooms:
                    room = next(r for r in rooms if r.id == room_info['id'])
                    new_values = _extract_model_data(room)
                    
                    audit.log_update(
                        "rooms",
                        room.id,
                        room_info['old_values'],
                        new_values,
                        f"Quarto '{room.room_number}' atualizado em lote"
                    )
            
            return {
                'updated_count': len(updated_rooms),
                'updated_rooms': [{'id': r['id'], 'room_number': r['room_number']} for r in updated_rooms]
            }
            
        except Exception:
            self.db.rollback()
            raise ValueError("Erro na atualização em lote")

    def toggle_operational_status(
        self, 
        room_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Room]:
        """Alterna status operacional do quarto"""
        
        room_obj = self.get_room_by_id(room_id, tenant_id)
        if not room_obj:
            return None

        old_values = _extract_model_data(room_obj)
        
        # Alternar status
        room_obj.is_operational = not room_obj.is_operational
        
        try:
            self.db.commit()
            self.db.refresh(room_obj)
            
            # Registrar auditoria
            status = "operacional" if room_obj.is_operational else "não operacional"
            new_values = _extract_model_data(room_obj)
            
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "rooms", 
                    room_obj.id, 
                    old_values, 
                    new_values,
                    f"Status do quarto '{room_obj.room_number}' alterado para {status}"
                )
            
            return room_obj
            
        except Exception:
            self.db.rollback()
            return None

    def get_rooms_by_property(self, property_id: int, tenant_id: int) -> List[Room]:
        """Lista quartos de uma propriedade específica"""
        return self.db.query(Room).options(
            joinedload(Room.room_type)
        ).filter(
            Room.property_id == property_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).order_by(Room.room_number).all()

    def get_rooms_by_type(self, room_type_id: int, tenant_id: int) -> List[Room]:
        """Lista quartos de um tipo específico"""
        return self.db.query(Room).options(
            joinedload(Room.property_obj)
        ).filter(
            Room.room_type_id == room_type_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).order_by(Room.property_id, Room.room_number).all()

    def get_room_stats(self, tenant_id: int, property_id: Optional[int] = None) -> Dict[str, Any]:
        """Obtém estatísticas gerais dos quartos"""
        query = self.db.query(Room).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True
        )
        
        if property_id:
            query = query.filter(Room.property_id == property_id)

        stats = query.with_entities(
            func.count(Room.id).label('total_rooms'),
            func.sum(func.cast(Room.is_operational, Integer)).label('operational_rooms'),
            func.sum(func.cast(Room.is_out_of_order, Integer)).label('out_of_order_rooms')
        ).first()

        maintenance_count = query.filter(
            Room.maintenance_notes.isnot(None)
        ).count()

        return {
            'total_rooms': stats.total_rooms or 0,
            'operational_rooms': stats.operational_rooms or 0,
            'out_of_order_rooms': stats.out_of_order_rooms or 0,
            'maintenance_rooms': maintenance_count,
            'occupancy_rate': 0.0  # TODO: calcular quando implementar reservations
        }

    # ============== MÉTODOS PRIVADOS PARA WUBOOK ==============

    def _create_room_in_wubook_and_map(self, room: Room, tenant_id: int, current_user: User) -> None:
        """
        Cria quarto na WuBook automaticamente e mapeia
        Valores premium para proteção do cliente
        """
        try:
            # Importar apenas quando necessário para evitar dependências circulares
            from app.services.wubook_configuration_service import WuBookConfigurationService
            from app.integrations.wubook.wubook_client import WuBookClient
            from app.models.wubook_room_mapping import WuBookRoomMapping
            
            wubook_service = WuBookConfigurationService(self.db)
            
            # Buscar configuração WuBook ativa para esta propriedade
            configuration = wubook_service.get_configuration_by_property(room.property_id, tenant_id)
            
            if not configuration or not configuration.is_active or not configuration.is_connected:
                logger.debug(f"Configuração WuBook não encontrada ou inativa para propriedade {room.property_id}")
                return
            
            # Verificar se já existe mapeamento (evitar duplicação)
            existing_mapping = self.db.query(WuBookRoomMapping).filter(
                WuBookRoomMapping.room_id == room.id,
                WuBookRoomMapping.configuration_id == configuration.id,
                WuBookRoomMapping.tenant_id == tenant_id
            ).first()
            
            if existing_mapping:
                logger.debug(f"Mapeamento já existe para quarto {room.id}")
                return
            
            # Preparar dados para criação na WuBook
            wubook_room_name = f"{room.name} ({room.room_number})"
            beds_count = room.max_occupancy or (room.room_type.max_capacity if room.room_type else 2)
            
            # VALORES PREMIUM PARA PROTEÇÃO DO CLIENTE
            premium_price = 800.00  # R$ 800 por diária (valor alto)
            board_type = "fb"       # Pensão completa (mais caro)
            
            logger.info(f"Criando quarto '{wubook_room_name}' na WuBook (R${premium_price}, {beds_count} camas, pensão completa)")
            
            # Criar cliente WuBook
            client = WuBookClient(configuration.wubook_token, int(configuration.wubook_lcode))
            
            # Criar quarto na WuBook
            wubook_room_id = client.create_room(
                name=wubook_room_name,
                beds=beds_count,
                price=premium_price,
                availability=1,  # Sempre disponível por padrão
                board=board_type,
                room_shortname=room.room_number[:3].upper()  # Primeiras 3 letras do número
            )
            
            # Criar mapeamento automático
            new_mapping = WuBookRoomMapping(
                tenant_id=tenant_id,
                configuration_id=configuration.id,
                room_id=room.id,
                wubook_room_id=str(wubook_room_id),
                wubook_room_name=wubook_room_name,
                wubook_room_type="standard",  # Tipo padrão
                is_active=True,
                is_syncing=True,
                sync_availability=True,
                sync_rates=True,
                sync_restrictions=True,
                max_occupancy=beds_count,
                standard_occupancy=beds_count,
                min_occupancy=1,
                rate_multiplier=1.000,
                sync_pending=True,  # Marcar para sincronização inicial
                metadata_json={
                    "auto_created": True,
                    "created_at": datetime.utcnow().isoformat(),
                    "pms_room_id": room.id,
                    "pms_room_number": room.room_number,
                    "pms_room_name": room.name,
                    "creation_price": premium_price,
                    "creation_board": board_type
                }
            )
            
            self.db.add(new_mapping)
            self.db.commit()
            
            logger.info(f"Quarto criado na WuBook e mapeado automaticamente: PMS {room.id} ({room.room_number}) -> WuBook {wubook_room_id}")
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro ao criar quarto na WuBook e mapear: {e}")
            # Re-raise para que o método pai possa decidir como tratar
            raise

    def _create_auto_wubook_mapping(self, room: Room, tenant_id: int, current_user: User) -> None:
        """
        MÉTODO LEGADO - mantido para compatibilidade
        Agora chama o novo método que cria + mapeia
        """
        try:
            self._create_room_in_wubook_and_map(room, tenant_id, current_user)
        except Exception as e:
            logger.warning(f"Mapeamento automático legado falhou para quarto {room.id}: {e}")
            # Não propagar erro para manter compatibilidade