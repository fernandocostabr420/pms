# backend/app/services/guest_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func
from fastapi import Request

from app.models.guest import Guest
from app.models.user import User
from app.schemas.guest import GuestCreate, GuestUpdate, GuestFilters
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext


class GuestService:
    """Serviço para operações com hóspedes"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_guest_by_id(self, guest_id: int, tenant_id: int) -> Optional[Guest]:
        """Busca hóspede por ID dentro do tenant"""
        return self.db.query(Guest).filter(
            Guest.id == guest_id,
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        ).first()

    def get_guest_by_email(self, email: str, tenant_id: int) -> Optional[Guest]:
        """Busca hóspede por email dentro do tenant"""
        return self.db.query(Guest).filter(
            Guest.email == email,
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        ).first()

    def get_guest_by_document(self, document_number: str, tenant_id: int) -> Optional[Guest]:
        """Busca hóspede por documento dentro do tenant"""
        if not document_number:
            return None
        
        return self.db.query(Guest).filter(
            Guest.document_number == document_number,
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        ).first()

    def get_guests(
        self, 
        tenant_id: int, 
        filters: Optional[GuestFilters] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[Guest]:
        """Lista hóspedes com filtros opcionais"""
        query = self.db.query(Guest).filter(
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        )
        
        if filters:
            if filters.has_email is not None:
                if filters.has_email:
                    query = query.filter(Guest.email.isnot(None))
                else:
                    query = query.filter(Guest.email.is_(None))
            
            if filters.has_document is not None:
                if filters.has_document:
                    query = query.filter(Guest.document_number.isnot(None))
                else:
                    query = query.filter(Guest.document_number.is_(None))
            
            if filters.nationality:
                query = query.filter(Guest.nationality.ilike(f"%{filters.nationality}%"))
            
            if filters.city:
                query = query.filter(Guest.city.ilike(f"%{filters.city}%"))
            
            if filters.state:
                query = query.filter(Guest.state.ilike(f"%{filters.state}%"))
            
            if filters.marketing_consent:
                query = query.filter(Guest.marketing_consent == filters.marketing_consent)
            
            if filters.search:
                # Busca textual em nome, email e documento
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Guest.first_name.ilike(search_term),
                        Guest.last_name.ilike(search_term),
                        Guest.email.ilike(search_term),
                        Guest.document_number.ilike(search_term)
                    )
                )
        
        return query.order_by(Guest.first_name, Guest.last_name).offset(skip).limit(limit).all()

    def count_guests(self, tenant_id: int, filters: Optional[GuestFilters] = None) -> int:
        """Conta total de hóspedes (para paginação)"""
        query = self.db.query(func.count(Guest.id)).filter(
            Guest.tenant_id == tenant_id,
            Guest.is_active == True
        )
        
        # Aplicar mesmos filtros da busca
        if filters:
            if filters.has_email is not None:
                if filters.has_email:
                    query = query.filter(Guest.email.isnot(None))
                else:
                    query = query.filter(Guest.email.is_(None))
            if filters.has_document is not None:
                if filters.has_document:
                    query = query.filter(Guest.document_number.isnot(None))
                else:
                    query = query.filter(Guest.document_number.is_(None))
            if filters.nationality:
                query = query.filter(Guest.nationality.ilike(f"%{filters.nationality}%"))
            if filters.city:
                query = query.filter(Guest.city.ilike(f"%{filters.city}%"))
            if filters.state:
                query = query.filter(Guest.state.ilike(f"%{filters.state}%"))
            if filters.marketing_consent:
                query = query.filter(Guest.marketing_consent == filters.marketing_consent)
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Guest.first_name.ilike(search_term),
                        Guest.last_name.ilike(search_term),
                        Guest.email.ilike(search_term),
                        Guest.document_number.ilike(search_term)
                    )
                )
        
        return query.scalar()

    def create_guest(
        self, 
        guest_data: GuestCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Guest:
        """Cria novo hóspede com auditoria automática"""
        
        # Verificar se email já existe (se fornecido)
        if guest_data.email:
            existing_guest = self.get_guest_by_email(guest_data.email, tenant_id)
            if existing_guest:
                raise ValueError("Email já cadastrado neste tenant")

        # Verificar se documento já existe (se fornecido)
        if guest_data.document_number:
            existing_guest = self.get_guest_by_document(guest_data.document_number, tenant_id)
            if existing_guest:
                raise ValueError("Documento já cadastrado neste tenant")

        # Criar hóspede
        db_guest = Guest(
            first_name=guest_data.first_name,
            last_name=guest_data.last_name,
            email=guest_data.email,
            phone=guest_data.phone,
            document_type=guest_data.document_type,
            document_number=guest_data.document_number,
            date_of_birth=guest_data.date_of_birth,
            nationality=guest_data.nationality,
            address_line1=guest_data.address_line1,
            address_line2=guest_data.address_line2,
            city=guest_data.city,
            state=guest_data.state,
            postal_code=guest_data.postal_code,
            country=guest_data.country,
            preferences=guest_data.preferences,
            notes=guest_data.notes,
            marketing_consent=guest_data.marketing_consent,
            tenant_id=tenant_id
        )

        try:
            self.db.add(db_guest)
            self.db.commit()
            self.db.refresh(db_guest)
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                new_values = _extract_model_data(db_guest)
                audit.log_create(
                    "guests", 
                    db_guest.id, 
                    new_values, 
                    f"Hóspede '{db_guest.full_name}' criado"
                )
            
            return db_guest
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar hóspede - dados duplicados")

    def update_guest(
        self, 
        guest_id: int, 
        tenant_id: int, 
        guest_data: GuestUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Guest]:
        """Atualiza hóspede com auditoria automática"""
        
        guest_obj = self.get_guest_by_id(guest_id, tenant_id)
        if not guest_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(guest_obj)

        # Verificar dados que serão atualizados
        update_data = guest_data.dict(exclude_unset=True)

        # Validações específicas para update
        if 'email' in update_data and update_data['email'] != guest_obj.email:
            if update_data['email']:  # Se não for None
                existing = self.get_guest_by_email(update_data['email'], tenant_id)
                if existing and existing.id != guest_id:
                    raise ValueError("Email já está em uso por outro hóspede")

        if 'document_number' in update_data and update_data['document_number'] != guest_obj.document_number:
            if update_data['document_number']:  # Se não for None
                existing = self.get_guest_by_document(update_data['document_number'], tenant_id)
                if existing and existing.id != guest_id:
                    raise ValueError("Documento já está em uso por outro hóspede")

        # Aplicar alterações apenas nos campos fornecidos
        for field, value in update_data.items():
            if hasattr(guest_obj, field):
                setattr(guest_obj, field, value)

        try:
            self.db.commit()
            self.db.refresh(guest_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(guest_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "guests", 
                    guest_obj.id, 
                    old_values, 
                    new_values,
                    f"Hóspede '{guest_obj.full_name}' atualizado"
                )
            
            return guest_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar hóspede")

    def delete_guest(
        self, 
        guest_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> bool:
        """Desativa hóspede (soft delete) com auditoria"""
        
        guest_obj = self.get_guest_by_id(guest_id, tenant_id)
        if not guest_obj:
            return False

        # Verificar se há reservas vinculadas
        from app.models.reservation import Reservation
        active_reservations = self.db.query(func.count(Reservation.id)).filter(
            Reservation.guest_id == guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.status.in_(['confirmed', 'checked_in']),
            Reservation.is_active == True
        ).scalar()
        
        if active_reservations > 0:
            raise ValueError(f"Não é possível excluir: há {active_reservations} reservas ativas para este hóspede")

        # Capturar valores para auditoria
        old_values = _extract_model_data(guest_obj)

        # Soft delete
        guest_obj.is_active = False
        
        try:
            self.db.commit()
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_delete(
                    "guests", 
                    guest_obj.id, 
                    old_values,
                    f"Hóspede '{guest_obj.full_name}' desativado"
                )
            
            return True
            
        except Exception:
            self.db.rollback()
            return False

    def get_guest_stats(self, guest_id: int, tenant_id: int) -> Dict[str, Any]:
        """Obtém estatísticas do hóspede"""
        from app.models.reservation import Reservation
        
        guest_obj = self.get_guest_by_id(guest_id, tenant_id)
        if not guest_obj:
            return {}

        # Estatísticas de reservas
        reservations_query = self.db.query(Reservation).filter(
            Reservation.guest_id == guest_id,
            Reservation.tenant_id == tenant_id,
            Reservation.is_active == True
        )

        total_reservations = reservations_query.count()
        completed_stays = reservations_query.filter(Reservation.status == 'checked_out').count()
        cancelled_reservations = reservations_query.filter(Reservation.status == 'cancelled').count()
        
        # Total de noites
        completed_reservations = reservations_query.filter(Reservation.status == 'checked_out').all()
        total_nights = sum(r.nights for r in completed_reservations)
        
        # Última estadia
        last_stay = reservations_query.filter(
            Reservation.status == 'checked_out'
        ).order_by(Reservation.check_out_date.desc()).first()
        
        last_stay_date = last_stay.check_out_date if last_stay else None

        return {
            'total_reservations': total_reservations,
            'completed_stays': completed_stays,
            'cancelled_reservations': cancelled_reservations,
            'total_nights': total_nights,
            'last_stay_date': last_stay_date
        }

    def search_guests_by_name_or_document(self, search_term: str, tenant_id: int, limit: int = 10) -> List[Guest]:
        """Busca rápida de hóspedes por nome ou documento (para autocomplete)"""
        if not search_term or len(search_term) < 2:
            return []
        
        search_pattern = f"%{search_term}%"
        
        return self.db.query(Guest).filter(
            Guest.tenant_id == tenant_id,
            Guest.is_active == True,
            or_(
                Guest.first_name.ilike(search_pattern),
                Guest.last_name.ilike(search_pattern),
                Guest.document_number.ilike(search_pattern),
                Guest.email.ilike(search_pattern)
            )
        ).order_by(Guest.first_name, Guest.last_name).limit(limit).all()

    def merge_guests(
        self, 
        primary_guest_id: int, 
        secondary_guest_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Guest:
        """Mescla dois hóspedes (move todas as reservas do secundário para o primário)"""
        
        primary_guest = self.get_guest_by_id(primary_guest_id, tenant_id)
        secondary_guest = self.get_guest_by_id(secondary_guest_id, tenant_id)
        
        if not primary_guest or not secondary_guest:
            raise ValueError("Um dos hóspedes não foi encontrado")
        
        if primary_guest_id == secondary_guest_id:
            raise ValueError("Não é possível mesclar o hóspede consigo mesmo")

        try:
            # Mover todas as reservas do secundário para o primário
            from app.models.reservation import Reservation
            reservations_moved = self.db.query(Reservation).filter(
                Reservation.guest_id == secondary_guest_id,
                Reservation.tenant_id == tenant_id
            ).update({Reservation.guest_id: primary_guest_id})
            
            # Desativar hóspede secundário
            secondary_guest.is_active = False
            
            self.db.commit()
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "guests",
                    primary_guest_id,
                    {},
                    {},
                    f"Hóspede mesclado com '{secondary_guest.full_name}' - {reservations_moved} reservas transferidas"
                )
            
            return primary_guest
            
        except Exception:
            self.db.rollback()
            raise ValueError("Erro ao mesclar hóspedes")