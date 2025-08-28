# backend/app/services/room_type_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func, Integer
from fastapi import Request

from app.models.room_type import RoomType
from app.models.user import User
from app.schemas.room_type import RoomTypeCreate, RoomTypeUpdate, RoomTypeFilters
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext


class RoomTypeService:
    """Serviço para operações com tipos de quarto"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_room_type_by_id(self, room_type_id: int, tenant_id: int) -> Optional[RoomType]:
        """Busca tipo de quarto por ID dentro do tenant"""
        return self.db.query(RoomType).filter(
            RoomType.id == room_type_id,
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True
        ).first()

    def get_room_type_by_slug(self, slug: str, tenant_id: int) -> Optional[RoomType]:
        """Busca tipo de quarto por slug dentro do tenant"""
        return self.db.query(RoomType).filter(
            RoomType.slug == slug,
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True
        ).first()

    def get_room_types(
        self, 
        tenant_id: int, 
        filters: Optional[RoomTypeFilters] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[RoomType]:
        """Lista tipos de quarto com filtros opcionais"""
        query = self.db.query(RoomType).filter(
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True
        )
        
        if filters:
            if filters.is_bookable is not None:
                query = query.filter(RoomType.is_bookable == filters.is_bookable)
            
            if filters.min_capacity:
                query = query.filter(RoomType.base_capacity >= filters.min_capacity)
            
            if filters.max_capacity:
                query = query.filter(RoomType.max_capacity <= filters.max_capacity)
            
            if filters.has_amenity:
                # Buscar tipos que tenham a comodidade especificada
                query = query.filter(
                    RoomType.amenities.op('?')(filters.has_amenity.lower())
                )
            
            if filters.search:
                # Busca textual em nome e descrição
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        RoomType.name.ilike(search_term),
                        RoomType.description.ilike(search_term)
                    )
                )
        
        return query.order_by(RoomType.name).offset(skip).limit(limit).all()

    def count_room_types(self, tenant_id: int, filters: Optional[RoomTypeFilters] = None) -> int:
        """Conta total de tipos de quarto (para paginação)"""
        query = self.db.query(func.count(RoomType.id)).filter(
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True
        )
        
        # Aplicar mesmos filtros da busca (simplificado)
        if filters:
            if filters.is_bookable is not None:
                query = query.filter(RoomType.is_bookable == filters.is_bookable)
            if filters.min_capacity:
                query = query.filter(RoomType.base_capacity >= filters.min_capacity)
            if filters.max_capacity:
                query = query.filter(RoomType.max_capacity <= filters.max_capacity)
            if filters.has_amenity:
                query = query.filter(
                    RoomType.amenities.op('?')(filters.has_amenity.lower())
                )
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        RoomType.name.ilike(search_term),
                        RoomType.description.ilike(search_term)
                    )
                )
        
        return query.scalar()

    def create_room_type(
        self, 
        room_type_data: RoomTypeCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> RoomType:
        """Cria novo tipo de quarto com auditoria automática"""
        
        # Verificar se já existe tipo com mesmo slug no tenant
        existing = self.get_room_type_by_slug(room_type_data.slug, tenant_id)
        if existing:
            raise ValueError("Já existe um tipo de quarto com este slug")
        
        # Criar room_type
        room_type_obj = RoomType(
            **room_type_data.dict(),
            tenant_id=tenant_id
        )
        
        try:
            self.db.add(room_type_obj)
            self.db.commit()
            self.db.refresh(room_type_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(room_type_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_create(
                    "room_types", 
                    room_type_obj.id, 
                    new_values,
                    f"Tipo de quarto '{room_type_obj.name}' criado"
                )
            
            return room_type_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar tipo de quarto - dados duplicados")

    def update_room_type(
        self, 
        room_type_id: int, 
        tenant_id: int, 
        room_type_data: RoomTypeUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[RoomType]:
        """Atualiza tipo de quarto com auditoria automática"""
        
        room_type_obj = self.get_room_type_by_id(room_type_id, tenant_id)
        if not room_type_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(room_type_obj)

        # Verificar dados que serão atualizados
        update_data = room_type_data.dict(exclude_unset=True)

        # Se slug for alterado, verificar se novo slug já existe
        if 'slug' in update_data and update_data['slug'] != room_type_obj.slug:
            existing = self.get_room_type_by_slug(update_data['slug'], tenant_id)
            if existing and existing.id != room_type_id:
                raise ValueError("Novo slug já está em uso")

        # Aplicar alterações apenas nos campos fornecidos
        for field, value in update_data.items():
            if hasattr(room_type_obj, field):
                setattr(room_type_obj, field, value)

        try:
            self.db.commit()
            self.db.refresh(room_type_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(room_type_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "room_types", 
                    room_type_obj.id, 
                    old_values, 
                    new_values,
                    f"Tipo de quarto '{room_type_obj.name}' atualizado"
                )
            
            return room_type_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar tipo de quarto")

    def delete_room_type(
        self, 
        room_type_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None,
        force: bool = False
    ) -> bool:
        """Desativa tipo de quarto (soft delete) com auditoria"""
        
        room_type_obj = self.get_room_type_by_id(room_type_id, tenant_id)
        if not room_type_obj:
            return False

        # Verificar se há quartos vinculados (a menos que seja forçado)
        if not force:
            from app.models.room import Room
            rooms_count = self.db.query(func.count(Room.id)).filter(
                Room.room_type_id == room_type_id,
                Room.tenant_id == tenant_id,
                Room.is_active == True
            ).scalar()
            
            if rooms_count > 0:
                raise ValueError(f"Não é possível excluir: há {rooms_count} quartos vinculados a este tipo")

        # Capturar valores para auditoria
        old_values = _extract_model_data(room_type_obj)

        # Soft delete
        room_type_obj.is_active = False
        
        try:
            self.db.commit()
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_delete(
                    "room_types", 
                    room_type_obj.id, 
                    old_values,
                    f"Tipo de quarto '{room_type_obj.name}' desativado"
                )
            
            return True
            
        except Exception:
            self.db.rollback()
            return False

    def toggle_bookable_status(
        self, 
        room_type_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[RoomType]:
        """Alterna status de reserva do tipo de quarto"""
        
        room_type_obj = self.get_room_type_by_id(room_type_id, tenant_id)
        if not room_type_obj:
            return None

        old_values = _extract_model_data(room_type_obj)
        
        # Alternar status
        room_type_obj.is_bookable = not room_type_obj.is_bookable
        
        try:
            self.db.commit()
            self.db.refresh(room_type_obj)
            
            # Registrar auditoria
            status = "reservável" if room_type_obj.is_bookable else "não reservável"
            new_values = _extract_model_data(room_type_obj)
            
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "room_types", 
                    room_type_obj.id, 
                    old_values, 
                    new_values,
                    f"Status do tipo '{room_type_obj.name}' alterado para {status}"
                )
            
            return room_type_obj
            
        except Exception:
            self.db.rollback()
            return None

    def get_room_type_stats(self, room_type_id: int, tenant_id: int) -> Dict[str, int]:
        """Obtém estatísticas do tipo de quarto"""
        from app.models.room import Room
        
        room_type_obj = self.get_room_type_by_id(room_type_id, tenant_id)
        if not room_type_obj:
            return {}

        stats = self.db.query(
            func.count(Room.id).label('total_rooms'),
            func.sum(func.cast(Room.is_operational, Integer)).label('operational_rooms'),
            func.sum(func.cast(Room.is_out_of_order, Integer)).label('out_of_order_rooms')
        ).filter(
            Room.room_type_id == room_type_id,
            Room.tenant_id == tenant_id,
            Room.is_active == True
        ).first()

        return {
            'total_rooms': stats.total_rooms or 0,
            'operational_rooms': stats.operational_rooms or 0,
            'out_of_order_rooms': stats.out_of_order_rooms or 0
        }

    def get_available_amenities(self, tenant_id: int) -> List[str]:
        """Lista todas as comodidades usadas nos tipos do tenant"""
        room_types = self.db.query(RoomType).filter(
            RoomType.tenant_id == tenant_id,
            RoomType.is_active == True,
            RoomType.amenities.isnot(None)
        ).all()
        
        all_amenities = set()
        for rt in room_types:
            if rt.amenities:
                all_amenities.update(rt.amenities)
        
        return sorted(list(all_amenities))