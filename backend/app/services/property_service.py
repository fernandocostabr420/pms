# backend/app/services/property_service.py

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_, func
from fastapi import Request

from app.models.property import Property
from app.models.user import User
from app.schemas.property import PropertyCreate, PropertyUpdate, PropertyFilters, ParkingConfigUpdate
from app.services.audit_service import AuditService
from app.utils.decorators import _extract_model_data, AuditContext


class PropertyService:
    """Serviço para operações com propriedades"""
    
    def __init__(self, db: Session):
        self.db = db

    def get_property_by_id(self, property_id: int, tenant_id: int) -> Optional[Property]:
        """Busca propriedade por ID dentro do tenant"""
        return self.db.query(Property).filter(
            Property.id == property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()

    def get_property_by_slug(self, slug: str, tenant_id: int) -> Optional[Property]:
        """Busca propriedade por slug dentro do tenant"""
        return self.db.query(Property).filter(
            Property.slug == slug,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()

    def get_properties(
        self, 
        tenant_id: int, 
        filters: Optional[PropertyFilters] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[Property]:
        """Lista propriedades com filtros opcionais"""
        query = self.db.query(Property).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        )
        
        if filters:
            if filters.property_type:
                query = query.filter(Property.property_type == filters.property_type.lower())
            
            if filters.city:
                query = query.filter(Property.city.ilike(f"%{filters.city}%"))
            
            if filters.state:
                query = query.filter(Property.state.ilike(f"%{filters.state}%"))
            
            if filters.is_operational is not None:
                query = query.filter(Property.is_operational == filters.is_operational)
            
            if filters.has_amenity:
                # Buscar propriedades que tenham a comodidade especificada
                query = query.filter(
                    Property.amenities.op('?')(filters.has_amenity.lower())
                )
            
            # ✅ NOVO: Filtros de estacionamento
            if filters.has_parking is not None:
                if filters.has_parking:
                    query = query.filter(
                        and_(
                            Property.parking_enabled == True,
                            Property.parking_spots_total > 0
                        )
                    )
                else:
                    query = query.filter(
                        or_(
                            Property.parking_enabled == False,
                            Property.parking_spots_total.is_(None),
                            Property.parking_spots_total <= 0
                        )
                    )
            
            if filters.parking_policy:
                query = query.filter(Property.parking_policy == filters.parking_policy.lower())
            
            if filters.search:
                # Busca textual em nome e descrição
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Property.name.ilike(search_term),
                        Property.description.ilike(search_term)
                    )
                )
        
        return query.order_by(Property.name).offset(skip).limit(limit).all()

    def count_properties(self, tenant_id: int, filters: Optional[PropertyFilters] = None) -> int:
        """Conta total de propriedades (para paginação)"""
        query = self.db.query(func.count(Property.id)).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        )
        
        # Aplicar mesmos filtros da busca
        if filters:
            if filters.property_type:
                query = query.filter(Property.property_type == filters.property_type.lower())
            if filters.city:
                query = query.filter(Property.city.ilike(f"%{filters.city}%"))
            if filters.state:
                query = query.filter(Property.state.ilike(f"%{filters.state}%"))
            if filters.is_operational is not None:
                query = query.filter(Property.is_operational == filters.is_operational)
            if filters.has_amenity:
                query = query.filter(Property.amenities.op('?')(filters.has_amenity.lower()))
            
            # ✅ NOVO: Aplicar filtros de estacionamento na contagem também
            if filters.has_parking is not None:
                if filters.has_parking:
                    query = query.filter(
                        and_(
                            Property.parking_enabled == True,
                            Property.parking_spots_total > 0
                        )
                    )
                else:
                    query = query.filter(
                        or_(
                            Property.parking_enabled == False,
                            Property.parking_spots_total.is_(None),
                            Property.parking_spots_total <= 0
                        )
                    )
            
            if filters.parking_policy:
                query = query.filter(Property.parking_policy == filters.parking_policy.lower())
                
            if filters.search:
                search_term = f"%{filters.search}%"
                query = query.filter(
                    or_(
                        Property.name.ilike(search_term),
                        Property.description.ilike(search_term)
                    )
                )
        
        return query.scalar()

    def create_property(
        self, 
        property_data: PropertyCreate, 
        tenant_id: int, 
        current_user: User,
        request: Optional[Request] = None
    ) -> Property:
        """Cria nova propriedade com auditoria automática"""

        # NOVA VERIFICAÇÃO: Limitar a uma propriedade por tenant
        existing_count = self.db.query(Property).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).count()
        
        if existing_count >= 1:
            raise ValueError("Este tenant já possui uma propriedade ativa. Apenas uma propriedade é permitida por conta.")

        # Verificar se slug já existe no tenant
        existing_property = self.get_property_by_slug(property_data.slug, tenant_id)
        if existing_property:
            raise ValueError("Slug já está em uso neste tenant")

        # Criar propriedade
        db_property = Property(
            name=property_data.name,
            slug=property_data.slug,
            description=property_data.description,
            property_type=property_data.property_type,
            address_line1=property_data.address_line1,
            address_line2=property_data.address_line2,
            city=property_data.city,
            state=property_data.state,
            postal_code=property_data.postal_code,
            country=property_data.country,
            latitude=property_data.latitude,
            longitude=property_data.longitude,
            phone=property_data.phone,
            email=property_data.email,
            website=property_data.website,
            check_in_time=property_data.check_in_time,
            check_out_time=property_data.check_out_time,
            # ✅ NOVO: Campos de estacionamento
            parking_enabled=getattr(property_data, 'parking_enabled', False),
            parking_spots_total=getattr(property_data, 'parking_spots_total', None),
            parking_policy=getattr(property_data, 'parking_policy', 'integral'),
            amenities=property_data.amenities,
            policies=property_data.policies,
            settings=property_data.settings,
            is_operational=property_data.is_operational,
            tenant_id=tenant_id
        )

        try:
            self.db.add(db_property)
            self.db.commit()
            self.db.refresh(db_property)
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                new_values = _extract_model_data(db_property)
                audit.log_create(
                    "properties", 
                    db_property.id, 
                    new_values, 
                    f"Propriedade '{db_property.name}' criada"
                )
            
            return db_property
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao criar propriedade - dados duplicados")

    def update_property(
        self, 
        property_id: int, 
        tenant_id: int, 
        property_data: PropertyUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Property]:
        """Atualiza propriedade com auditoria automática"""
        
        property_obj = self.get_property_by_id(property_id, tenant_id)
        if not property_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(property_obj)

        # Verificar dados que serão atualizados
        update_data = property_data.dict(exclude_unset=True)

        # Se slug for alterado, verificar se novo slug já existe
        if 'slug' in update_data and update_data['slug'] != property_obj.slug:
            existing = self.get_property_by_slug(update_data['slug'], tenant_id)
            if existing and existing.id != property_id:
                raise ValueError("Novo slug já está em uso")

        # Aplicar alterações apenas nos campos fornecidos
        for field, value in update_data.items():
            if hasattr(property_obj, field):
                setattr(property_obj, field, value)

        # ✅ NOVO: Validar configurações de estacionamento se atualizadas
        if any(key in update_data for key in ['parking_enabled', 'parking_spots_total', 'parking_policy']):
            self._validate_parking_config(property_obj)

        try:
            self.db.commit()
            self.db.refresh(property_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(property_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "properties", 
                    property_obj.id, 
                    old_values, 
                    new_values,
                    f"Propriedade '{property_obj.name}' atualizada"
                )
            
            return property_obj
            
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Erro ao atualizar propriedade")

    # ✅ NOVO: Método específico para atualizar configurações de estacionamento
    def update_parking_config(
        self,
        property_id: int,
        tenant_id: int,
        parking_config: ParkingConfigUpdate,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Property]:
        """Atualiza apenas as configurações de estacionamento de uma propriedade"""
        
        property_obj = self.get_property_by_id(property_id, tenant_id)
        if not property_obj:
            return None

        # Capturar valores antigos para auditoria
        old_values = _extract_model_data(property_obj)

        # Atualizar configurações de estacionamento
        property_obj.parking_enabled = parking_config.parking_enabled
        property_obj.parking_spots_total = parking_config.parking_spots_total
        property_obj.parking_policy = parking_config.parking_policy

        # Validar configurações
        self._validate_parking_config(property_obj)

        try:
            self.db.commit()
            self.db.refresh(property_obj)
            
            # Registrar auditoria
            new_values = _extract_model_data(property_obj)
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "properties", 
                    property_obj.id, 
                    old_values, 
                    new_values,
                    f"Configurações de estacionamento da propriedade '{property_obj.name}' atualizadas"
                )
            
            return property_obj
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Erro ao atualizar configurações de estacionamento: {str(e)}")

    # ✅ NOVO: Método para validar configurações de estacionamento
    def _validate_parking_config(self, property_obj: Property) -> None:
        """Valida configurações de estacionamento"""
        if property_obj.parking_enabled:
            if not property_obj.parking_spots_total or property_obj.parking_spots_total <= 0:
                raise ValueError("Quando estacionamento está habilitado, deve ter pelo menos 1 vaga")
            
            if property_obj.parking_spots_total > 999:
                raise ValueError("Número máximo de vagas é 999")
        
        if property_obj.parking_policy and property_obj.parking_policy not in ['integral', 'flexible']:
            raise ValueError("Política de estacionamento deve ser 'integral' ou 'flexible'")
        
        # Se estacionamento desabilitado, normalizar valores
        if not property_obj.parking_enabled:
            property_obj.parking_spots_total = None

    def delete_property(
        self, 
        property_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> bool:
        """Desativa propriedade (soft delete) com auditoria"""
        
        property_obj = self.get_property_by_id(property_id, tenant_id)
        if not property_obj:
            return False

        # Capturar valores para auditoria
        old_values = _extract_model_data(property_obj)

        # Soft delete
        property_obj.is_active = False
        
        try:
            self.db.commit()
            
            # Registrar auditoria
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_delete(
                    "properties", 
                    property_obj.id, 
                    old_values,
                    f"Propriedade '{property_obj.name}' desativada"
                )
            
            return True
            
        except Exception:
            self.db.rollback()
            return False

    def toggle_operational_status(
        self, 
        property_id: int, 
        tenant_id: int,
        current_user: User,
        request: Optional[Request] = None
    ) -> Optional[Property]:
        """Alterna status operacional da propriedade"""
        
        property_obj = self.get_property_by_id(property_id, tenant_id)
        if not property_obj:
            return None

        old_values = _extract_model_data(property_obj)
        
        # Alternar status
        property_obj.is_operational = not property_obj.is_operational
        
        try:
            self.db.commit()
            self.db.refresh(property_obj)
            
            # Registrar auditoria
            status = "operacional" if property_obj.is_operational else "fora de operação"
            new_values = _extract_model_data(property_obj)
            
            with AuditContext(self.db, current_user, request) as audit:
                audit.log_update(
                    "properties", 
                    property_obj.id, 
                    old_values, 
                    new_values,
                    f"Status da propriedade '{property_obj.name}' alterado para {status}"
                )
            
            return property_obj
            
        except Exception:
            self.db.rollback()
            return None

    def get_property_types(self, tenant_id: int) -> List[str]:
        """Lista todos os tipos de propriedades usados no tenant"""
        types = self.db.query(Property.property_type).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).distinct().all()
        
        return [t[0] for t in types]

    def get_cities(self, tenant_id: int) -> List[str]:
        """Lista todas as cidades onde o tenant tem propriedades"""
        cities = self.db.query(Property.city).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).distinct().order_by(Property.city).all()
        
        return [c[0] for c in cities]

    def search_by_location(
        self, 
        tenant_id: int, 
        latitude: float, 
        longitude: float, 
        radius_km: float = 10
    ) -> List[Property]:
        """Busca propriedades próximas a uma coordenada (raio em km)"""
        # Fórmula haversine simplificada para PostgreSQL
        # Aproximação: 1 grau ≈ 111km
        lat_range = radius_km / 111.0
        lng_range = radius_km / (111.0 * abs(func.cos(func.radians(latitude))))
        
        return self.db.query(Property).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True,
            Property.latitude.isnot(None),
            Property.longitude.isnot(None),
            Property.latitude.between(latitude - lat_range, latitude + lat_range),
            Property.longitude.between(longitude - lng_range, longitude + lng_range)
        ).all()

    # ✅ NOVO: Métodos auxiliares para estacionamento
    def get_properties_with_parking(self, tenant_id: int) -> List[Property]:
        """Lista apenas propriedades que oferecem estacionamento"""
        return self.db.query(Property).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True,
            Property.parking_enabled == True,
            Property.parking_spots_total > 0
        ).all()

    def get_parking_summary(self, tenant_id: int) -> Dict[str, Any]:
        """Retorna resumo das configurações de estacionamento do tenant"""
        
        # Total de propriedades
        total_properties = self.db.query(func.count(Property.id)).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).scalar() or 0

        # Propriedades com estacionamento
        properties_with_parking = self.db.query(func.count(Property.id)).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True,
            Property.parking_enabled == True,
            Property.parking_spots_total > 0
        ).scalar() or 0

        # Total de vagas disponíveis
        total_spots = self.db.query(func.sum(Property.parking_spots_total)).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True,
            Property.parking_enabled == True
        ).scalar() or 0

        # Políticas utilizadas
        policies = self.db.query(
            Property.parking_policy,
            func.count(Property.id).label('count')
        ).filter(
            Property.tenant_id == tenant_id,
            Property.is_active == True,
            Property.parking_enabled == True
        ).group_by(Property.parking_policy).all()

        policies_summary = {policy: count for policy, count in policies}

        return {
            'total_properties': total_properties,
            'properties_with_parking': properties_with_parking,
            'properties_without_parking': total_properties - properties_with_parking,
            'total_parking_spots': total_spots,
            'parking_policies': policies_summary,
            'parking_coverage_rate': round(
                (properties_with_parking / total_properties * 100) if total_properties > 0 else 0, 1
            )
        }