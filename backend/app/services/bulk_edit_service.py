# backend/app/services/bulk_edit_service.py

from typing import Dict, List, Any, Optional, Union, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import logging
import uuid
import math

from app.models.user import User
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.property import Property
from app.models.room_availability import RoomAvailability
from app.models.reservation_restriction import ReservationRestriction

from app.schemas.bulk_edit import (
    BulkEditRequest, BulkEditResult, BulkEditOperation, BulkEditItemResult,
    BulkEditValidationRequest, BulkEditValidationResult,
    BulkEditOperationType, BulkEditTarget, BulkEditScope
)

from app.services.room_availability_service import RoomAvailabilityService
from app.services.restriction_service import RestrictionService
from app.utils.decorators import AuditContext

logger = logging.getLogger(__name__)


class BulkEditService:
    """Serviço para operações de edição em massa no Channel Manager"""
    
    def __init__(self, db: Session):
        self.db = db
        self.availability_service = RoomAvailabilityService(db)
        self.restriction_service = RestrictionService(db)
    
    # ============== MAIN BULK EDIT EXECUTION ==============
    
    def execute_bulk_edit(
        self,
        request: BulkEditRequest,
        tenant_id: int,
        user: User,
        request_obj: Optional[Any] = None
    ) -> BulkEditResult:
        """
        Executa operação de bulk edit
        
        Args:
            request: Dados da operação
            tenant_id: ID do tenant
            user: Usuário executando a operação
            request_obj: Request HTTP para auditoria
            
        Returns:
            BulkEditResult com resultados detalhados
        """
        operation_id = f"bulk_edit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{user.id}"
        started_at = datetime.utcnow()
        
        logger.info(f"Iniciando bulk edit {operation_id} - Escopo: {request.scope}, "
                   f"Período: {request.date_from} a {request.date_to}, "
                   f"Operações: {len(request.operations)}")
        
        try:
            # 1. Validação prévia
            validation_result = self._validate_bulk_request(request, tenant_id)
            if not validation_result.is_valid:
                return self._create_error_result(
                    operation_id, tenant_id, user.id, started_at,
                    validation_result.validation_errors, request
                )
            
            # 2. Obter quartos no escopo
            target_rooms = self._get_target_rooms(request, tenant_id)
            if not target_rooms:
                return self._create_error_result(
                    operation_id, tenant_id, user.id, started_at,
                    ["Nenhum quarto encontrado no escopo especificado"], request
                )
            
            # 3. Obter datas no período (com filtro de dias da semana)
            target_dates = self._get_target_dates(request)
            
            # 4. Inicializar resultado
            result = BulkEditResult(
                operation_id=operation_id,
                tenant_id=tenant_id,
                user_id=user.id,
                total_items_targeted=len(target_rooms) * len(target_dates) * len(request.operations),
                total_operations_executed=0,
                successful_operations=0,
                failed_operations=0,
                skipped_operations=0,
                started_at=started_at,
                completed_at=started_at,  # Será atualizado
                duration_seconds=0.0,
                dry_run=request.dry_run,
                request_summary=self._create_request_summary(request)
            )
            
            # 5. Executar operações (com ou sem transação)
            if request.dry_run:
                result = self._execute_dry_run(request, target_rooms, target_dates, result, tenant_id)
            else:
                result = self._execute_real_operations(
                    request, target_rooms, target_dates, result, tenant_id, user, request_obj
                )
            
            # 6. Finalizar resultado
            completed_at = datetime.utcnow()
            result.completed_at = completed_at
            result.duration_seconds = (completed_at - started_at).total_seconds()
            
            logger.info(f"Bulk edit {operation_id} concluído - "
                       f"Sucesso: {result.successful_operations}, "
                       f"Falha: {result.failed_operations}, "
                       f"Duração: {result.duration_seconds:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Erro em bulk edit {operation_id}: {str(e)}")
            return self._create_error_result(
                operation_id, tenant_id, user.id, started_at,
                [f"Erro interno: {str(e)}"], request
            )
    
    def _execute_real_operations(
        self,
        request: BulkEditRequest,
        target_rooms: List[Room],
        target_dates: List[date],
        result: BulkEditResult,
        tenant_id: int,
        user: User,
        request_obj: Optional[Any] = None
    ) -> BulkEditResult:
        """Executa operações reais com transação"""
        
        try:
            with AuditContext(self.db, user, request_obj) as audit:
                # Processar por batches para evitar problemas de memória
                batch_size = 100
                total_combinations = len(target_rooms) * len(target_dates) * len(request.operations)
                
                processed = 0
                
                for room in target_rooms:
                    for target_date in target_dates:
                        # Obter ou criar registro de availability
                        availability_record = self._get_or_create_availability_record(
                            room, target_date, tenant_id, request.create_missing_records
                        )
                        
                        if not availability_record and not request.create_missing_records:
                            result.skipped_operations += len(request.operations)
                            continue
                        
                        # Executar cada operação
                        for operation in request.operations:
                            try:
                                item_result = self._execute_single_operation(
                                    operation, room, target_date, availability_record, 
                                    request, tenant_id
                                )
                                
                                result.total_operations_executed += 1
                                
                                if item_result.success:
                                    result.successful_operations += 1
                                    if item_result.created_record:
                                        result.records_created += 1
                                    else:
                                        result.records_updated += 1
                                else:
                                    result.failed_operations += 1
                                    if item_result.error_message:
                                        result.processing_errors.append(
                                            f"Room {room.room_number}, {target_date}, "
                                            f"{operation.target}: {item_result.error_message}"
                                        )
                                
                                # Atualizar breakdown por target
                                target_key = operation.target.value
                                if target_key not in result.results_by_target:
                                    result.results_by_target[target_key] = {
                                        "success": 0, "failed": 0, "skipped": 0
                                    }
                                
                                if item_result.success:
                                    result.results_by_target[target_key]["success"] += 1
                                elif item_result.skipped:
                                    result.results_by_target[target_key]["skipped"] += 1
                                else:
                                    result.results_by_target[target_key]["failed"] += 1
                                
                                processed += 1
                                
                                # Commit em batches
                                if processed % batch_size == 0:
                                    self.db.commit()
                                    logger.debug(f"Batch commit: {processed}/{total_combinations}")
                                
                            except Exception as e:
                                logger.error(f"Erro ao processar operação {operation.target} "
                                           f"para room {room.id}, date {target_date}: {str(e)}")
                                result.failed_operations += 1
                                result.processing_errors.append(
                                    f"Room {room.room_number}, {target_date}, "
                                    f"{operation.target}: {str(e)}"
                                )
                
                # Commit final
                self.db.commit()
                
                # Marcar para sincronização se solicitado
                if request.sync_immediately and result.successful_operations > 0:
                    self._mark_for_sync(target_rooms, target_dates, tenant_id)
                    result.sync_triggered = True
                
                # Log de auditoria
                audit.log_bulk_operation(
                    "bulk_edit",
                    result.operation_id,
                    {
                        "scope": request.scope,
                        "operations": len(request.operations),
                        "rooms_affected": len(target_rooms),
                        "dates_affected": len(target_dates),
                        "successful_operations": result.successful_operations,
                        "failed_operations": result.failed_operations
                    },
                    request.reason or f"Bulk edit: {', '.join([op.target.value for op in request.operations])}"
                )
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Erro na execução de operações reais: {str(e)}")
            result.processing_errors.append(f"Erro na transação: {str(e)}")
            result.failed_operations += (result.total_items_targeted - result.total_operations_executed)
        
        return result
    
    def _execute_dry_run(
        self,
        request: BulkEditRequest,
        target_rooms: List[Room],
        target_dates: List[date],
        result: BulkEditResult,
        tenant_id: int
    ) -> BulkEditResult:
        """Executa simulação sem aplicar mudanças"""
        
        detailed_results = []
        
        for room in target_rooms:
            for target_date in target_dates:
                # Obter registro existente (sem criar)
                availability_record = self._get_availability_record(room, target_date, tenant_id)
                
                for operation in request.operations:
                    # Simular operação
                    item_result = self._simulate_single_operation(
                        operation, room, target_date, availability_record, request
                    )
                    
                    detailed_results.append(item_result)
                    result.total_operations_executed += 1
                    
                    if item_result.success:
                        result.successful_operations += 1
                    elif item_result.skipped:
                        result.skipped_operations += 1
                    else:
                        result.failed_operations += 1
        
        result.detailed_results = detailed_results
        return result
    
    # ============== OPERAÇÕES INDIVIDUAIS ==============
    
    def _execute_single_operation(
        self,
        operation: BulkEditOperation,
        room: Room,
        target_date: date,
        availability_record: Optional[RoomAvailability],
        request: BulkEditRequest,
        tenant_id: int
    ) -> BulkEditItemResult:
        """Executa uma operação individual"""
        
        try:
            if not availability_record:
                return BulkEditItemResult(
                    room_id=room.id,
                    date=target_date,
                    target=operation.target,
                    operation=operation.operation,
                    success=False,
                    error_message="Registro de availability não encontrado e criação não permitida",
                    skipped=True
                )
            
            # Obter valor atual
            old_value = self._get_current_value(availability_record, operation.target)
            
            # Calcular novo valor
            new_value = self._calculate_new_value(old_value, operation)
            
            if new_value is None and not operation.operation == BulkEditOperationType.CLEAR:
                return BulkEditItemResult(
                    room_id=room.id,
                    date=target_date,
                    target=operation.target,
                    operation=operation.operation,
                    success=False,
                    old_value=old_value,
                    error_message="Não foi possível calcular novo valor"
                )
            
            # Verificar se precisa atualizar
            if not request.overwrite_existing and old_value == new_value:
                return BulkEditItemResult(
                    room_id=room.id,
                    date=target_date,
                    target=operation.target,
                    operation=operation.operation,
                    success=True,
                    old_value=old_value,
                    new_value=new_value,
                    skipped=True
                )
            
            # Aplicar novo valor
            self._apply_new_value(availability_record, operation.target, new_value)
            
            # Marcar para sincronização
            availability_record.sync_pending = request.sync_immediately
            availability_record.reason = request.reason
            
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=True,
                old_value=old_value,
                new_value=new_value,
                created_record=availability_record.id is None
            )
            
        except Exception as e:
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=False,
                error_message=str(e)
            )
    
    def _simulate_single_operation(
        self,
        operation: BulkEditOperation,
        room: Room,
        target_date: date,
        availability_record: Optional[RoomAvailability],
        request: BulkEditRequest
    ) -> BulkEditItemResult:
        """Simula uma operação individual (dry-run)"""
        
        try:
            if not availability_record and not request.create_missing_records:
                return BulkEditItemResult(
                    room_id=room.id,
                    date=target_date,
                    target=operation.target,
                    operation=operation.operation,
                    success=False,
                    error_message="Registro de availability não existe",
                    skipped=True
                )
            
            # Obter valor atual (ou padrão se não existe)
            old_value = self._get_current_value(availability_record, operation.target) if availability_record else self._get_default_value(operation.target)
            
            # Calcular novo valor
            new_value = self._calculate_new_value(old_value, operation)
            
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=True,
                old_value=old_value,
                new_value=new_value,
                created_record=availability_record is None
            )
            
        except Exception as e:
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=False,
                error_message=str(e)
            )
    
    # ============== VALUE OPERATIONS ==============
    
    def _get_current_value(self, record: RoomAvailability, target: BulkEditTarget) -> Any:
        """Obtém valor atual do campo"""
        if target == BulkEditTarget.PRICE:
            return record.rate_override
        elif target == BulkEditTarget.AVAILABILITY:
            return record.is_available
        elif target == BulkEditTarget.BLOCKED:
            return record.is_blocked
        elif target == BulkEditTarget.MIN_STAY:
            return record.min_stay
        elif target == BulkEditTarget.MAX_STAY:
            return record.max_stay
        elif target == BulkEditTarget.CLOSED_TO_ARRIVAL:
            return record.closed_to_arrival
        elif target == BulkEditTarget.CLOSED_TO_DEPARTURE:
            return record.closed_to_departure
        elif target == BulkEditTarget.STOP_SELL:
            # Stop sell = is_available=False AND is_blocked=True
            return not record.is_available and record.is_blocked
        else:
            return None
    
    def _get_default_value(self, target: BulkEditTarget) -> Any:
        """Obtém valor padrão para novos registros"""
        defaults = {
            BulkEditTarget.PRICE: None,
            BulkEditTarget.AVAILABILITY: True,
            BulkEditTarget.BLOCKED: False,
            BulkEditTarget.MIN_STAY: 1,
            BulkEditTarget.MAX_STAY: 30,
            BulkEditTarget.CLOSED_TO_ARRIVAL: False,
            BulkEditTarget.CLOSED_TO_DEPARTURE: False,
            BulkEditTarget.STOP_SELL: False
        }
        return defaults.get(target)
    
    def _calculate_new_value(self, current_value: Any, operation: BulkEditOperation) -> Any:
        """Calcula novo valor baseado na operação"""
        
        if operation.operation == BulkEditOperationType.CLEAR:
            return None
        
        if operation.operation == BulkEditOperationType.SET_VALUE:
            return operation.value
        
        if operation.operation == BulkEditOperationType.TOGGLE:
            if isinstance(current_value, bool):
                return not current_value
            else:
                raise ValueError("Toggle só funciona com valores boolean")
        
        # Operações numéricas
        if current_value is None:
            if operation.target in [BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                current_value = self._get_default_value(operation.target)
            elif operation.target == BulkEditTarget.PRICE:
                # Não pode fazer operações matemáticas em preço None
                return operation.value if operation.operation == BulkEditOperationType.SET_VALUE else None
            else:
                current_value = 0
        
        try:
            current_num = Decimal(str(current_value))
            operation_value = Decimal(str(operation.value))
            
            if operation.operation == BulkEditOperationType.INCREASE_AMOUNT:
                result = current_num + operation_value
            elif operation.operation == BulkEditOperationType.DECREASE_AMOUNT:
                result = current_num - operation_value
            elif operation.operation == BulkEditOperationType.INCREASE_PERCENT:
                result = current_num * (1 + operation_value / 100)
            elif operation.operation == BulkEditOperationType.DECREASE_PERCENT:
                result = current_num * (1 - operation_value / 100)
            else:
                raise ValueError(f"Operação não suportada: {operation.operation}")
            
            # Garantir valores não negativos para certos campos
            if operation.target in [BulkEditTarget.PRICE, BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                result = max(result, Decimal('0'))
            
            # Arredondar preços para 2 decimais
            if operation.target == BulkEditTarget.PRICE:
                result = result.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            # Converter para int se necessário
            if operation.target in [BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                result = int(result)
            else:
                result = float(result)
            
            return result
            
        except (ValueError, TypeError, ArithmeticError) as e:
            raise ValueError(f"Erro no cálculo: {str(e)}")
    
    def _apply_new_value(self, record: RoomAvailability, target: BulkEditTarget, value: Any):
        """Aplica novo valor ao registro"""
        if target == BulkEditTarget.PRICE:
            record.rate_override = value
        elif target == BulkEditTarget.AVAILABILITY:
            record.is_available = value
        elif target == BulkEditTarget.BLOCKED:
            record.is_blocked = value
        elif target == BulkEditTarget.MIN_STAY:
            record.min_stay = value
        elif target == BulkEditTarget.MAX_STAY:
            record.max_stay = value
        elif target == BulkEditTarget.CLOSED_TO_ARRIVAL:
            record.closed_to_arrival = value
        elif target == BulkEditTarget.CLOSED_TO_DEPARTURE:
            record.closed_to_departure = value
        elif target == BulkEditTarget.STOP_SELL:
            if value:  # Ativar stop sell
                record.is_available = False
                record.is_blocked = True
            else:  # Desativar stop sell
                record.is_available = True
                record.is_blocked = False
    
    # ============== HELPER METHODS ==============
    
    def _validate_bulk_request(self, request: BulkEditRequest, tenant_id: int) -> BulkEditValidationResult:
        """Valida requisição de bulk edit"""
        errors = []
        warnings = []
        
        # Validar propriedade existe
        property_obj = self.db.query(Property).filter(
            Property.id == request.property_id,
            Property.tenant_id == tenant_id,
            Property.is_active == True
        ).first()
        
        if not property_obj:
            errors.append("Propriedade não encontrada")
        
        # Validar room_type se especificado
        if request.room_type_id:
            room_type = self.db.query(RoomType).filter(
                RoomType.id == request.room_type_id,
                RoomType.tenant_id == tenant_id,
                RoomType.is_active == True
            ).first()
            
            if not room_type:
                errors.append("Tipo de quarto não encontrado")
        
        # Validar se há quartos no escopo
        target_rooms = self._get_target_rooms(request, tenant_id)
        if not target_rooms:
            errors.append("Nenhum quarto encontrado no escopo especificado")
        
        return BulkEditValidationResult(
            is_valid=len(errors) == 0,
            estimated_items_to_process=len(target_rooms) * len(self._get_target_dates(request)) * len(request.operations),
            validation_errors=errors,
            validation_warnings=warnings
        )
    
    def _get_target_rooms(self, request: BulkEditRequest, tenant_id: int) -> List[Room]:
        """Obtém quartos no escopo da operação"""
        query = self.db.query(Room).filter(
            Room.tenant_id == tenant_id,
            Room.is_active == True,
            Room.property_id == request.property_id
        )
        
        if request.scope == BulkEditScope.ROOM_TYPE:
            query = query.filter(Room.room_type_id == request.room_type_id)
        elif request.scope == BulkEditScope.SPECIFIC_ROOMS:
            query = query.filter(Room.id.in_(request.room_ids))
        
        return query.all()
    
    def _get_target_dates(self, request: BulkEditRequest) -> List[date]:
        """Obtém datas no período (com filtro de dias da semana)"""
        dates = []
        current_date = request.date_from
        
        while current_date <= request.date_to:
            # Filtrar por dias da semana se especificado
            if request.days_of_week is None or current_date.weekday() in request.days_of_week:
                dates.append(current_date)
            current_date += timedelta(days=1)
        
        return dates
    
    def _get_availability_record(self, room: Room, target_date: date, tenant_id: int) -> Optional[RoomAvailability]:
        """Obtém registro de availability existente"""
        return self.db.query(RoomAvailability).filter(
            RoomAvailability.room_id == room.id,
            RoomAvailability.date == target_date,
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).first()
    
    def _get_or_create_availability_record(
        self, room: Room, target_date: date, tenant_id: int, create_if_missing: bool
    ) -> Optional[RoomAvailability]:
        """Obtém ou cria registro de availability"""
        
        record = self._get_availability_record(room, target_date, tenant_id)
        
        if not record and create_if_missing:
            record = RoomAvailability(
                room_id=room.id,
                date=target_date,
                tenant_id=tenant_id,
                is_available=True,
                is_blocked=False,
                is_out_of_order=False,
                is_maintenance=False,
                is_reserved=False,
                min_stay=1,
                closed_to_arrival=False,
                closed_to_departure=False
            )
            self.db.add(record)
            self.db.flush()  # Obter ID
        
        return record
    
    def _mark_for_sync(self, rooms: List[Room], dates: List[date], tenant_id: int):
        """Marca registros para sincronização"""
        room_ids = [room.id for room in rooms]
        
        self.db.query(RoomAvailability).filter(
            RoomAvailability.room_id.in_(room_ids),
            RoomAvailability.date.in_(dates),
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).update({
            RoomAvailability.sync_pending: True
        }, synchronize_session=False)
    
    def _create_error_result(
        self, operation_id: str, tenant_id: int, user_id: int, 
        started_at: datetime, errors: List[str], request: BulkEditRequest
    ) -> BulkEditResult:
        """Cria resultado de erro"""
        completed_at = datetime.utcnow()
        
        return BulkEditResult(
            operation_id=operation_id,
            tenant_id=tenant_id,
            user_id=user_id,
            total_items_targeted=0,
            total_operations_executed=0,
            successful_operations=0,
            failed_operations=0,
            skipped_operations=0,
            validation_errors=errors,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=(completed_at - started_at).total_seconds(),
            dry_run=request.dry_run,
            request_summary=self._create_request_summary(request)
        )
    
    def _create_request_summary(self, request: BulkEditRequest) -> Dict[str, Any]:
        """Cria resumo da requisição"""
        return {
            "scope": request.scope.value,
            "property_id": request.property_id,
            "room_type_id": request.room_type_id,
            "room_ids_count": len(request.room_ids) if request.room_ids else 0,
            "date_from": str(request.date_from),
            "date_to": str(request.date_to),
            "days_of_week": request.days_of_week,
            "operations": [
                {
                    "target": op.target.value,
                    "operation": op.operation.value,
                    "value": op.value
                }
                for op in request.operations
            ],
            "reason": request.reason,
            "sync_immediately": request.sync_immediately,
            "dry_run": request.dry_run
        }