# backend/app/services/bulk_edit_service.py

from typing import Dict, List, Any, Optional, Union, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import logging
import uuid
import math
import json

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
# ✅ NOVO IMPORT PARA SINCRONIZAÇÃO MANUAL
from app.services.manual_sync_service import ManualSyncService
from app.utils.decorators import AuditContext

logger = logging.getLogger(__name__)


def safe_str(value: Any) -> str:
    """Converte qualquer valor para string de forma segura"""
    if value is None:
        return "None"
    if isinstance(value, str):
        return value
    if isinstance(value, Exception):
        return f"{type(value).__name__}: {str(value)}"
    try:
        return str(value)
    except Exception:
        return f"Erro na conversão para string: {type(value).__name__}"


def ensure_json_serializable(obj: Any) -> Any:
    """Garante que um objeto seja serializável em JSON"""
    if obj is None:
        return None
    
    # Tipos básicos que são JSON serializáveis
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    # Listas
    if isinstance(obj, (list, tuple)):
        return [ensure_json_serializable(item) for item in obj]
    
    # Dicionários
    if isinstance(obj, dict):
        return {safe_str(k): ensure_json_serializable(v) for k, v in obj.items()}
    
    # Decimais
    if isinstance(obj, Decimal):
        return float(obj)
    
    # Datas
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    
    # Exceções e outros objetos
    if isinstance(obj, Exception):
        return f"{type(obj).__name__}: {str(obj)}"
    
    # Fallback para string
    return safe_str(obj)


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
        Executa operação de bulk edit com tratamento robusto de erros
        """
        operation_id = f"bulk_edit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{user.id}"
        started_at = datetime.utcnow()
        
        logger.info(f"Iniciando bulk edit {operation_id} - Escopo: {request.scope}, "
                   f"Período: {request.date_from} a {request.date_to}, "
                   f"Operações: {len(request.operations)}")
        
        try:
            # ✅ 1. Validação completa da requisição (movida do schema para aqui)
            validation_errors = self._validate_complete_request(request, tenant_id)
            if validation_errors:
                return self._create_error_result(
                    operation_id, tenant_id, user.id, started_at,
                    validation_errors, request
                )
            
            # ✅ 2. Obter quartos no escopo
            target_rooms = self._get_target_rooms(request, tenant_id)
            if not target_rooms:
                return self._create_error_result(
                    operation_id, tenant_id, user.id, started_at,
                    ["Nenhum quarto encontrado no escopo especificado"], request
                )
            
            # ✅ 3. Obter datas no período
            target_dates = self._get_target_dates(request)
            
            # ✅ 4. Inicializar resultado
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
                completed_at=started_at,
                duration_seconds=0.0,
                dry_run=request.dry_run,
                request_summary=self._create_request_summary(request)
            )
            
            # ✅ 5. Executar operações
            if request.dry_run:
                result = self._execute_dry_run(request, target_rooms, target_dates, result, tenant_id)
            else:
                result = self._execute_real_operations(
                    request, target_rooms, target_dates, result, tenant_id, user, request_obj
                )
            
            # ✅ 6. Trigger de sincronização (se solicitado e operações bem-sucedidas)
            sync_result = None
            if self._should_trigger_sync(request) and result.successful_operations > 0:
                try:
                    logger.info("Disparando sincronização pós bulk edit...")
                    sync_result = self._trigger_sync_after_bulk_edit(
                        target_rooms, target_dates, tenant_id
                    )
                    logger.info(f"Sincronização trigger result: {sync_result.get('status', 'unknown')}")
                    
                    # Log detalhado do resultado
                    self._log_sync_trigger_result(sync_result, operation_id)
                    
                    # Adicionar informações de sync ao resultado
                    result.sync_triggered = sync_result.get("triggered", False)
                    result.sync_result = sync_result
                    
                except Exception as e:
                    logger.error(f"Erro no trigger de sincronização: {str(e)}")
                    sync_result = {
                        "triggered": False,
                        "reason": "trigger_error",
                        "message": f"Erro ao disparar: {str(e)}"
                    }
                    result.sync_triggered = False
                    result.sync_result = sync_result
            
            # ✅ 7. Finalizar resultado
            completed_at = datetime.utcnow()
            result.completed_at = completed_at
            result.duration_seconds = (completed_at - started_at).total_seconds()
            
            # ✅ 8. Garantir serialização segura
            result = self._ensure_result_serializable(result)
            
            logger.info(f"Bulk edit {operation_id} concluído - "
                       f"Sucesso: {result.successful_operations}, "
                       f"Falha: {result.failed_operations}, "
                       f"Duração: {result.duration_seconds:.2f}s, "
                       f"Sync: {result.sync_triggered}")
            
            return result
            
        except Exception as e:
            # ✅ Tratamento robusto de exceções
            logger.error(f"Erro em bulk edit {operation_id}: {safe_str(e)}", exc_info=True)
            return self._create_error_result(
                operation_id, tenant_id, user.id, started_at,
                [f"Erro interno: {safe_str(e)}"], request
            )
    
    # ============== VALIDAÇÕES COMPLETAS ==============
    
    def _validate_complete_request(self, request: BulkEditRequest, tenant_id: int) -> List[str]:
        """
        Valida completamente a requisição (movido dos schemas para aqui)
        """
        errors = []
        
        try:
            # Validar room_ids únicos
            if request.room_ids and len(request.room_ids) != len(set(request.room_ids)):
                errors.append("IDs de quartos devem ser únicos")
            
            # Validar days_of_week
            if request.days_of_week:
                for day in request.days_of_week:
                    if not (0 <= day <= 6):
                        errors.append("Dias da semana devem estar entre 0 (Domingo) e 6 (Sábado)")
                        break
                if len(request.days_of_week) != len(set(request.days_of_week)):
                    errors.append("Dias da semana devem ser únicos")
            
            # Validar período de datas
            if request.date_to <= request.date_from:
                errors.append("date_to deve ser posterior a date_from")
            
            days_diff = (request.date_to - request.date_from).days
            if days_diff > 366:
                errors.append("Período não pode exceder 366 dias")
            
            # Validar escopo
            if request.scope == BulkEditScope.ROOM_TYPE and not request.room_type_id:
                errors.append("room_type_id é obrigatório para escopo room_type")
            
            if request.scope == BulkEditScope.SPECIFIC_ROOMS and not request.room_ids:
                errors.append("room_ids é obrigatório para escopo specific_rooms")
            
            # Validar operações
            operation_errors = self._validate_operations(request.operations)
            errors.extend(operation_errors)
            
            # Validar propriedade
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
            
        except Exception as e:
            logger.error(f"Erro durante validação: {safe_str(e)}")
            errors.append(f"Erro na validação: {safe_str(e)}")
        
        return errors
    
    def _validate_operations(self, operations: List[BulkEditOperation]) -> List[str]:
        """Valida operações"""
        errors = []
        
        for i, operation in enumerate(operations):
            try:
                # Validar se operações que requerem valor têm valor
                if operation.operation in [
                    BulkEditOperationType.SET_VALUE,
                    BulkEditOperationType.INCREASE_AMOUNT,
                    BulkEditOperationType.DECREASE_AMOUNT,
                    BulkEditOperationType.INCREASE_PERCENT,
                    BulkEditOperationType.DECREASE_PERCENT
                ]:
                    if operation.value is None:
                        errors.append(f"Operação {i+1}: {operation.operation} requer um valor")
                        continue
                
                # Validar tipos por target
                if operation.target == BulkEditTarget.PRICE:
                    if operation.operation == BulkEditOperationType.SET_VALUE and operation.value is not None:
                        try:
                            float(operation.value)
                        except (ValueError, TypeError):
                            errors.append(f"Operação {i+1}: Preço deve ser numérico")
                
                elif operation.target in [BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                    if operation.operation == BulkEditOperationType.SET_VALUE and operation.value is not None:
                        try:
                            val = int(operation.value)
                            if val < 1 or val > 30:
                                errors.append(f"Operação {i+1}: Min/Max stay deve estar entre 1 e 30")
                        except (ValueError, TypeError):
                            errors.append(f"Operação {i+1}: Min/Max stay deve ser um número inteiro")
                
                elif operation.target in [
                    BulkEditTarget.AVAILABILITY,
                    BulkEditTarget.BLOCKED,
                    BulkEditTarget.CLOSED_TO_ARRIVAL,
                    BulkEditTarget.CLOSED_TO_DEPARTURE
                ]:
                    if operation.operation == BulkEditOperationType.SET_VALUE and operation.value is not None:
                        if not isinstance(operation.value, bool):
                            errors.append(f"Operação {i+1}: {operation.target} deve ser true/false")
                
            except Exception as e:
                errors.append(f"Operação {i+1}: Erro na validação - {safe_str(e)}")
        
        return errors
    
    # ============== EXECUÇÃO DRY RUN ==============
    
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
        
        try:
            for room in target_rooms:
                for target_date in target_dates:
                    # Obter registro existente
                    availability_record = self._get_availability_record(room, target_date, tenant_id)
                    
                    for operation in request.operations:
                        try:
                            item_result = self._simulate_single_operation(
                                operation, room, target_date, availability_record, request
                            )
                            
                            # Garantir serialização segura do resultado
                            item_result = self._ensure_item_result_serializable(item_result)
                            detailed_results.append(item_result)
                            
                            result.total_operations_executed += 1
                            
                            if item_result.success:
                                result.successful_operations += 1
                            elif item_result.skipped:
                                result.skipped_operations += 1
                            else:
                                result.failed_operations += 1
                                
                        except Exception as e:
                            error_msg = safe_str(e)
                            logger.error(f"Erro na simulação: {error_msg}")
                            result.failed_operations += 1
                            result.processing_errors.append(error_msg)
            
            result.detailed_results = detailed_results
            
        except Exception as e:
            error_msg = safe_str(e)
            logger.error(f"Erro geral no dry-run: {error_msg}")
            result.processing_errors.append(f"Erro no dry-run: {error_msg}")
        
        return result
    
    # ============== EXECUÇÃO REAL - MÉTODO FALTANDO ==============
    
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
        """Executa operações reais no banco de dados"""
        
        detailed_results = []
        
        try:
            for room in target_rooms:
                for target_date in target_dates:
                    # Obter ou criar registro de availability
                    availability_record = self._get_or_create_availability_record(
                        room, target_date, tenant_id, request.create_missing_records
                    )
                    
                    if not availability_record and not request.create_missing_records:
                        # Pular se não deve criar registros e não existe
                        for operation in request.operations:
                            item_result = BulkEditItemResult(
                                room_id=room.id,
                                date=target_date,
                                target=operation.target,
                                operation=operation.operation,
                                success=False,
                                error_message="Registro de availability não existe",
                                skipped=True
                            )
                            detailed_results.append(item_result)
                            result.total_operations_executed += 1
                            result.skipped_operations += 1
                        continue
                    
                    for operation in request.operations:
                        try:
                            item_result = self._execute_single_real_operation(
                                operation, room, target_date, availability_record, 
                                request, tenant_id
                            )
                            
                            # Garantir serialização segura do resultado
                            item_result = self._ensure_item_result_serializable(item_result)
                            detailed_results.append(item_result)
                            
                            result.total_operations_executed += 1
                            
                            if item_result.success:
                                result.successful_operations += 1
                                if item_result.created_record:
                                    result.records_created += 1
                                else:
                                    result.records_updated += 1
                            elif item_result.skipped:
                                result.skipped_operations += 1
                            else:
                                result.failed_operations += 1
                                
                        except Exception as e:
                            error_msg = safe_str(e)
                            logger.error(f"Erro na operação real: {error_msg}")
                            result.failed_operations += 1
                            result.processing_errors.append(error_msg)
            
            # Commit todas as alterações
            self.db.commit()
            
            # Atualizar contadores finais
            result.detailed_results = detailed_results
            
            # Agrupar resultados por target para estatísticas
            result.results_by_target = self._group_results_by_target(detailed_results)
            
        except Exception as e:
            self.db.rollback()
            error_msg = safe_str(e)
            logger.error(f"Erro geral na execução real: {error_msg}")
            result.processing_errors.append(f"Erro na execução: {error_msg}")
        
        return result

    def _execute_single_real_operation(
        self,
        operation: BulkEditOperation,
        room: Room,
        target_date: date,
        availability_record: Optional[RoomAvailability],
        request: BulkEditRequest,
        tenant_id: int
    ) -> BulkEditItemResult:
        """Executa uma operação individual real no banco"""
        
        try:
            created_record = False
            
            # Criar registro se necessário
            if not availability_record:
                if not request.create_missing_records:
                    return BulkEditItemResult(
                        room_id=room.id,
                        date=target_date,
                        target=operation.target,
                        operation=operation.operation,
                        success=False,
                        error_message="Registro de availability não existe",
                        skipped=True
                    )
                
                availability_record = self._create_new_availability_record(
                    room, target_date, tenant_id
                )
                created_record = True
            
            # Obter valor atual
            old_value = self._get_current_value(availability_record, operation.target)
            
            # Calcular novo valor
            new_value = self._calculate_new_value(old_value, operation)
            
            # Aplicar a mudança
            self._apply_value_to_record(availability_record, operation.target, new_value)
            
            # Marcar para sincronização se necessário
            if request.sync_immediately:
                availability_record.sync_pending = True
            
            # Adicionar motivo se fornecido
            if request.reason:
                availability_record.reason = request.reason
            
            # Atualizar timestamps
            availability_record.updated_at = datetime.utcnow()
            
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=True,
                old_value=ensure_json_serializable(old_value),
                new_value=ensure_json_serializable(new_value),
                created_record=created_record
            )
            
        except Exception as e:
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=False,
                error_message=safe_str(e)
            )

    def _get_or_create_availability_record(
        self,
        room: Room,
        target_date: date,
        tenant_id: int,
        create_if_missing: bool = True
    ) -> Optional[RoomAvailability]:
        """Obtém ou cria um registro de availability"""
        
        # Tentar buscar registro existente
        existing = self.db.query(RoomAvailability).filter(
            RoomAvailability.room_id == room.id,
            RoomAvailability.date == target_date,
            RoomAvailability.tenant_id == tenant_id,
            RoomAvailability.is_active == True
        ).first()
        
        if existing:
            return existing
        
        if not create_if_missing:
            return None
        
        # Criar novo registro
        return self._create_new_availability_record(room, target_date, tenant_id)

    def _create_new_availability_record(
        self,
        room: Room,
        target_date: date,
        tenant_id: int
    ) -> RoomAvailability:
        """Cria um novo registro de availability com valores padrão"""
        
        new_record = RoomAvailability(
            room_id=room.id,
            date=target_date,
            tenant_id=tenant_id,
            is_available=True,
            is_blocked=False,
            rate_override=None,
            min_stay=1,
            max_stay=30,
            closed_to_arrival=False,
            closed_to_departure=False,
            sync_pending=False,
            reason=None,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(new_record)
        self.db.flush()  # Para obter o ID sem commit
        
        return new_record

    def _apply_value_to_record(
        self,
        record: RoomAvailability,
        target: BulkEditTarget,
        value: Any
    ) -> None:
        """Aplica um valor a um campo específico do registro"""
        
        if target == BulkEditTarget.PRICE:
            record.rate_override = value
        elif target == BulkEditTarget.AVAILABILITY:
            record.is_available = bool(value)
        elif target == BulkEditTarget.BLOCKED:
            record.is_blocked = bool(value)
        elif target == BulkEditTarget.MIN_STAY:
            record.min_stay = int(value) if value is not None else None
        elif target == BulkEditTarget.MAX_STAY:
            record.max_stay = int(value) if value is not None else None
        elif target == BulkEditTarget.CLOSED_TO_ARRIVAL:
            record.closed_to_arrival = bool(value)
        elif target == BulkEditTarget.CLOSED_TO_DEPARTURE:
            record.closed_to_departure = bool(value)
        elif target == BulkEditTarget.STOP_SELL:
            # Stop sell = não disponível E bloqueado
            if bool(value):
                record.is_available = False
                record.is_blocked = True
            else:
                record.is_available = True
                record.is_blocked = False
        else:
            raise ValueError(f"Target não suportado: {target}")

    def _group_results_by_target(self, detailed_results: List[BulkEditItemResult]) -> Dict[str, Dict[str, int]]:
        """Agrupa resultados por target para estatísticas"""
        
        grouped = {}
        
        for result in detailed_results:
            target_key = result.target.value
            
            if target_key not in grouped:
                grouped[target_key] = {
                    "total": 0,
                    "successful": 0,
                    "failed": 0,
                    "skipped": 0,
                    "created": 0,
                    "updated": 0
                }
            
            grouped[target_key]["total"] += 1
            
            if result.success:
                grouped[target_key]["successful"] += 1
                if result.created_record:
                    grouped[target_key]["created"] += 1
                else:
                    grouped[target_key]["updated"] += 1
            elif result.skipped:
                grouped[target_key]["skipped"] += 1
            else:
                grouped[target_key]["failed"] += 1
        
        return grouped

    # ============== NOVO: TRIGGER DE SINCRONIZAÇÃO MANUAL ==============
    
    def _should_trigger_sync(self, request: BulkEditRequest) -> bool:
        """
        Determina se deve disparar sincronização após bulk edit
        
        Args:
            request: Requisição de bulk edit
            
        Returns:
            True se deve disparar sincronização
        """
        # Não sincronizar em dry run
        if request.dry_run:
            return False
        
        # Sincronizar apenas se solicitado explicitamente
        if not request.sync_immediately:
            return False
        
        # Verificar se há operações que requerem sincronização
        sync_operations = [
            BulkEditOperationType.SET_VALUE,
            BulkEditOperationType.INCREASE_AMOUNT,
            BulkEditOperationType.DECREASE_AMOUNT,
            BulkEditOperationType.INCREASE_PERCENT,
            BulkEditOperationType.DECREASE_PERCENT,
            BulkEditOperationType.TOGGLE,
            BulkEditOperationType.CLEAR
        ]
        
        sync_targets = [
            BulkEditTarget.PRICE,
            BulkEditTarget.AVAILABILITY,
            BulkEditTarget.BLOCKED,
            BulkEditTarget.MIN_STAY,
            BulkEditTarget.MAX_STAY,
            BulkEditTarget.CLOSED_TO_ARRIVAL,
            BulkEditTarget.CLOSED_TO_DEPARTURE,
            BulkEditTarget.STOP_SELL
        ]
        
        has_sync_operations = any(
            op.operation in sync_operations and op.target in sync_targets
            for op in request.operations
        )
        
        return has_sync_operations

    def _trigger_sync_after_bulk_edit(
        self,
        target_rooms: List[Room],
        target_dates: List[date],
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        Dispara sincronização manual após bulk edit
        
        Args:
            target_rooms: Lista de quartos afetados
            target_dates: Lista de datas afetadas
            tenant_id: ID do tenant
            
        Returns:
            Dict com resultado da sincronização
        """
        
        try:
            logger.info(f"Iniciando sincronização pós bulk edit para {len(target_rooms)} quartos e {len(target_dates)} datas")
            
            # Criar serviço de sincronização manual
            manual_sync_service = ManualSyncService(self.db)
            
            # Verificar se há configuração WuBook ativa
            sync_status = manual_sync_service.get_sync_status(tenant_id)
            
            if not sync_status.get("sync_available"):
                logger.warning("Sincronização não disponível - nenhuma configuração WuBook ativa")
                return {
                    "triggered": False,
                    "reason": "no_wubook_configuration",
                    "message": "Nenhuma configuração WuBook ativa encontrada"
                }
            
            # Verificar se há registros pendentes antes de disparar
            pending_info = manual_sync_service.get_pending_count(tenant_id)
            pending_count = pending_info.get("total_pending", 0)
            
            if pending_count == 0:
                logger.info("Nenhum registro pendente para sincronizar")
                return {
                    "triggered": False,
                    "reason": "no_pending_records",
                    "message": "Nenhum registro pendente de sincronização"
                }
            
            # Executar sincronização com configurações otimizadas para bulk edit
            sync_result = manual_sync_service.process_manual_sync(
                tenant_id=tenant_id,
                property_id=None,  # Sincronizar todas as propriedades afetadas
                force_all=False,   # Apenas registros pendentes
                batch_size=200     # Batch maior para bulk edit
            )
            
            # Analisar resultado
            if sync_result.get("status") == "success":
                logger.info(f"Sincronização pós bulk edit bem-sucedida: "
                           f"{sync_result.get('successful', 0)}/{sync_result.get('processed', 0)} registros")
                
                return {
                    "triggered": True,
                    "sync_id": sync_result.get("sync_id"),
                    "status": "success",
                    "message": f"Sincronização concluída: {sync_result.get('successful', 0)} registros sincronizados",
                    "successful": sync_result.get("successful", 0),
                    "failed": sync_result.get("failed", 0),
                    "duration": sync_result.get("duration_seconds", 0)
                }
            
            elif sync_result.get("status") == "partial_success":
                logger.warning(f"Sincronização pós bulk edit parcialmente bem-sucedida: "
                              f"{sync_result.get('successful', 0)}/{sync_result.get('processed', 0)} registros")
                
                return {
                    "triggered": True,
                    "sync_id": sync_result.get("sync_id"),
                    "status": "partial_success",
                    "message": f"Sincronização parcial: {sync_result.get('successful', 0)} sucessos, {sync_result.get('failed', 0)} falhas",
                    "successful": sync_result.get("successful", 0),
                    "failed": sync_result.get("failed", 0),
                    "errors": sync_result.get("errors", [])[:3],  # Primeiros 3 erros
                    "duration": sync_result.get("duration_seconds", 0)
                }
            
            else:
                logger.error(f"Sincronização pós bulk edit falhou: {sync_result.get('message', 'Erro desconhecido')}")
                
                return {
                    "triggered": True,
                    "sync_id": sync_result.get("sync_id"),
                    "status": "error",
                    "message": f"Sincronização falhou: {sync_result.get('message', 'Erro desconhecido')}",
                    "successful": 0,
                    "failed": sync_result.get("failed", 0),
                    "errors": sync_result.get("errors", [])[:3]
                }
            
        except Exception as e:
            logger.error(f"Erro ao disparar sincronização pós bulk edit: {str(e)}")
            
            return {
                "triggered": False,
                "reason": "sync_error",
                "message": f"Erro na sincronização: {str(e)}",
                "error": str(e)
            }

    def _log_sync_trigger_result(self, sync_result: Dict[str, Any], operation_id: str) -> None:
        """
        Registra resultado do trigger de sincronização nos logs
        
        Args:
            sync_result: Resultado do trigger de sincronização
            operation_id: ID da operação de bulk edit
        """
        if not sync_result:
            return
        
        if sync_result.get("triggered"):
            if sync_result.get("status") == "success":
                logger.info(f"[{operation_id}] Sincronização automática bem-sucedida: "
                           f"{sync_result.get('successful', 0)} registros sincronizados "
                           f"em {sync_result.get('duration', 0):.1f}s")
            
            elif sync_result.get("status") == "partial_success":
                logger.warning(f"[{operation_id}] Sincronização automática parcial: "
                              f"{sync_result.get('successful', 0)} sucessos, "
                              f"{sync_result.get('failed', 0)} falhas")
            
            elif sync_result.get("status") == "error":
                logger.error(f"[{operation_id}] Sincronização automática falhou: "
                            f"{sync_result.get('message', 'Erro desconhecido')}")
        
        else:
            reason = sync_result.get("reason", "unknown")
            message = sync_result.get("message", "Motivo não especificado")
            logger.info(f"[{operation_id}] Sincronização não disparada: {reason} - {message}")
    
    # ============== OPERAÇÕES INDIVIDUAIS ==============
    
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
            
            # Obter valor atual ou padrão
            if availability_record:
                old_value = self._get_current_value(availability_record, operation.target)
            else:
                old_value = self._get_default_value(operation.target)
            
            # Calcular novo valor
            new_value = self._calculate_new_value(old_value, operation)
            
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=True,
                old_value=ensure_json_serializable(old_value),
                new_value=ensure_json_serializable(new_value),
                created_record=availability_record is None
            )
            
        except Exception as e:
            return BulkEditItemResult(
                room_id=room.id,
                date=target_date,
                target=operation.target,
                operation=operation.operation,
                success=False,
                error_message=safe_str(e)
            )
    
    # ============== VALUE OPERATIONS ==============
    
    def _get_current_value(self, record: RoomAvailability, target: BulkEditTarget) -> Any:
        """Obtém valor atual do campo"""
        try:
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
                return not record.is_available and record.is_blocked
            else:
                return None
        except Exception as e:
            logger.warning(f"Erro ao obter valor atual para {target}: {safe_str(e)}")
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
        
        try:
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
                    return operation.value if operation.operation == BulkEditOperationType.SET_VALUE else None
                else:
                    current_value = 0
            
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
            
            # Garantir valores não negativos
            if operation.target in [BulkEditTarget.PRICE, BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                result = max(result, Decimal('0'))
            
            # Arredondar preços
            if operation.target == BulkEditTarget.PRICE:
                result = result.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            # Converter para tipo correto
            if operation.target in [BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
                return int(result)
            else:
                return float(result)
                
        except Exception as e:
            raise ValueError(f"Erro no cálculo: {safe_str(e)}")
    
    # ============== HELPER METHODS ==============
    
    def _get_target_rooms(self, request: BulkEditRequest, tenant_id: int) -> List[Room]:
        """Obtém quartos no escopo da operação"""
        try:
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
        except Exception as e:
            logger.error(f"Erro ao buscar quartos: {safe_str(e)}")
            return []
    
    def _get_target_dates(self, request: BulkEditRequest) -> List[date]:
        """Obtém datas no período"""
        dates = []
        try:
            current_date = request.date_from
            
            while current_date <= request.date_to:
                if request.days_of_week is None or current_date.weekday() in request.days_of_week:
                    dates.append(current_date)
                current_date += timedelta(days=1)
        except Exception as e:
            logger.error(f"Erro ao calcular datas: {safe_str(e)}")
        
        return dates
    
    def _get_availability_record(self, room: Room, target_date: date, tenant_id: int) -> Optional[RoomAvailability]:
        """Obtém registro de availability existente"""
        try:
            return self.db.query(RoomAvailability).filter(
                RoomAvailability.room_id == room.id,
                RoomAvailability.date == target_date,
                RoomAvailability.tenant_id == tenant_id,
                RoomAvailability.is_active == True
            ).first()
        except Exception as e:
            logger.error(f"Erro ao buscar availability: {safe_str(e)}")
            return None
    
    def _create_error_result(
        self, operation_id: str, tenant_id: int, user_id: int, 
        started_at: datetime, errors: List[str], request: BulkEditRequest
    ) -> BulkEditResult:
        """Cria resultado de erro"""
        completed_at = datetime.utcnow()
        
        # Garantir que todos os erros sejam strings seguras
        safe_errors = [safe_str(error) for error in errors]
        
        return BulkEditResult(
            operation_id=operation_id,
            tenant_id=tenant_id,
            user_id=user_id,
            total_items_targeted=0,
            total_operations_executed=0,
            successful_operations=0,
            failed_operations=0,
            skipped_operations=0,
            validation_errors=safe_errors,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=(completed_at - started_at).total_seconds(),
            dry_run=request.dry_run,
            request_summary=self._create_request_summary(request)
        )
    
    def _create_request_summary(self, request: BulkEditRequest) -> Dict[str, Any]:
        """Cria resumo da requisição garantindo serialização"""
        try:
            return {
                "scope": safe_str(request.scope.value),
                "property_id": request.property_id,
                "room_type_id": request.room_type_id,
                "room_ids_count": len(request.room_ids) if request.room_ids else 0,
                "date_from": safe_str(request.date_from),
                "date_to": safe_str(request.date_to),
                "days_of_week": request.days_of_week,
                "operations": [
                    {
                        "target": safe_str(op.target.value),
                        "operation": safe_str(op.operation.value),
                        "value": ensure_json_serializable(op.value)
                    }
                    for op in request.operations
                ],
                "reason": safe_str(request.reason) if request.reason else None,
                "sync_immediately": bool(request.sync_immediately),
                "dry_run": bool(request.dry_run)
            }
        except Exception as e:
            logger.error(f"Erro ao criar resumo: {safe_str(e)}")
            return {"error": f"Erro ao criar resumo: {safe_str(e)}"}
    
    def _ensure_result_serializable(self, result: BulkEditResult) -> BulkEditResult:
        """Garante que o resultado seja serializável"""
        try:
            # Limpar processing_errors
            if result.processing_errors:
                result.processing_errors = [safe_str(error) for error in result.processing_errors]
            
            # Limpar validation_errors
            if result.validation_errors:
                result.validation_errors = [safe_str(error) for error in result.validation_errors]
            
            # Limpar detailed_results se necessário
            if result.detailed_results:
                result.detailed_results = [
                    self._ensure_item_result_serializable(item) 
                    for item in result.detailed_results
                ]
            
            # Garantir que request_summary seja serializável
            if result.request_summary:
                result.request_summary = ensure_json_serializable(result.request_summary)
            
            # Garantir que sync_result seja serializável
            if result.sync_result:
                result.sync_result = ensure_json_serializable(result.sync_result)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao garantir serialização do resultado: {safe_str(e)}")
            # Se tudo falhar, criar um resultado mínimo
            return BulkEditResult(
                operation_id=safe_str(result.operation_id),
                tenant_id=result.tenant_id,
                user_id=result.user_id,
                total_items_targeted=0,
                total_operations_executed=0,
                successful_operations=0,
                failed_operations=1,
                skipped_operations=0,
                started_at=result.started_at,
                completed_at=datetime.utcnow(),
                duration_seconds=0.0,
                dry_run=result.dry_run,
                processing_errors=[f"Erro na serialização: {safe_str(e)}"]
            )
    
    def _ensure_item_result_serializable(self, item: BulkEditItemResult) -> BulkEditItemResult:
        """Garante que um item resultado seja serializável"""
        try:
            if item.error_message:
                item.error_message = safe_str(item.error_message)
            
            if item.old_value is not None:
                item.old_value = ensure_json_serializable(item.old_value)
            
            if item.new_value is not None:
                item.new_value = ensure_json_serializable(item.new_value)
            
            return item
        except Exception as e:
            logger.error(f"Erro ao garantir serialização do item: {safe_str(e)}")
            # Criar um item resultado seguro
            return BulkEditItemResult(
                room_id=item.room_id,
                date=item.date,
                target=item.target,
                operation=item.operation,
                success=False,
                error_message=f"Erro na serialização: {safe_str(e)}"
            )