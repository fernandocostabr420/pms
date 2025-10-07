# backend/app/schemas/bulk_edit.py

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Union
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ============== ENUMS ==============

class BulkEditOperationType(str, Enum):
    """Tipos de operação em massa"""
    SET_VALUE = "set_value"           # Definir valor específico
    INCREASE_AMOUNT = "increase_amount"   # Aumentar por valor
    INCREASE_PERCENT = "increase_percent" # Aumentar por percentual
    DECREASE_AMOUNT = "decrease_amount"   # Diminuir por valor
    DECREASE_PERCENT = "decrease_percent" # Diminuir por percentual
    TOGGLE = "toggle"                 # Alternar boolean
    CLEAR = "clear"                   # Limpar valor


class BulkEditScope(str, Enum):
    """Escopo da operação"""
    PROPERTY = "property"
    ROOM_TYPE = "room_type"
    SPECIFIC_ROOMS = "specific_rooms"


class BulkEditTarget(str, Enum):
    """Campos que podem ser editados em massa"""
    PRICE = "price"                   # rate_override
    AVAILABILITY = "availability"     # is_available
    BLOCKED = "blocked"               # is_blocked
    MIN_STAY = "min_stay"            # min_stay
    MAX_STAY = "max_stay"            # max_stay
    CLOSED_TO_ARRIVAL = "closed_to_arrival"     # closed_to_arrival
    CLOSED_TO_DEPARTURE = "closed_to_departure" # closed_to_departure
    STOP_SELL = "stop_sell"          # combinação de flags


# ============== BASE SCHEMAS ==============

class BulkEditOperation(BaseModel):
    """Schema para uma operação específica de bulk edit"""
    target: BulkEditTarget = Field(..., description="Campo a ser editado")
    operation: BulkEditOperationType = Field(..., description="Tipo de operação")
    value: Optional[Union[str, int, float, bool]] = Field(None, description="Valor da operação")
    
    @model_validator(mode='after')
    def validate_operation_value(self):
        """Valida se o valor é compatível com a operação"""
        if self.operation in [
            BulkEditOperationType.SET_VALUE,
            BulkEditOperationType.INCREASE_AMOUNT,
            BulkEditOperationType.DECREASE_AMOUNT,
            BulkEditOperationType.INCREASE_PERCENT,
            BulkEditOperationType.DECREASE_PERCENT
        ]:
            if self.value is None:
                raise ValueError(f"Operação {self.operation} requer um valor")
        
        # Validar tipos por target
        if self.target == BulkEditTarget.PRICE:
            if self.operation == BulkEditOperationType.SET_VALUE and self.value is not None:
                try:
                    float(self.value)
                except (ValueError, TypeError):
                    raise ValueError("Preço deve ser numérico")
        
        elif self.target in [BulkEditTarget.MIN_STAY, BulkEditTarget.MAX_STAY]:
            if self.operation == BulkEditOperationType.SET_VALUE and self.value is not None:
                try:
                    val = int(self.value)
                    if val < 1 or val > 30:
                        raise ValueError("Min/Max stay deve estar entre 1 e 30")
                except (ValueError, TypeError):
                    raise ValueError("Min/Max stay deve ser um número inteiro")
        
        elif self.target in [
            BulkEditTarget.AVAILABILITY,
            BulkEditTarget.BLOCKED,
            BulkEditTarget.CLOSED_TO_ARRIVAL,
            BulkEditTarget.CLOSED_TO_DEPARTURE
        ]:
            if self.operation == BulkEditOperationType.SET_VALUE and self.value is not None:
                if not isinstance(self.value, bool):
                    raise ValueError(f"{self.target} deve ser true/false")
        
        return self


class BulkEditRequest(BaseModel):
    """Schema principal para requisição de bulk edit"""
    
    # ============== ESCOPO ==============
    scope: BulkEditScope = Field(..., description="Escopo da operação")
    property_id: int = Field(..., gt=0, description="ID da propriedade")
    room_type_id: Optional[int] = Field(None, gt=0, description="ID do tipo de quarto (para escopo room_type)")
    room_ids: Optional[List[int]] = Field(None, min_length=1, max_length=100, description="IDs específicos dos quartos")
    
    # ============== PERÍODO ==============
    date_from: date = Field(..., description="Data inicial")
    date_to: date = Field(..., description="Data final")
    
    # Filtros de dias da semana (0=Domingo, 6=Sábado)
    days_of_week: Optional[List[int]] = Field(None, description="Dias da semana específicos (0-6)")
    
    # ============== OPERAÇÕES ==============
    operations: List[BulkEditOperation] = Field(..., min_length=1, max_length=10, description="Lista de operações")
    
    # ============== OPÇÕES ==============
    reason: Optional[str] = Field(None, max_length=200, description="Motivo da operação")
    sync_immediately: bool = Field(True, description="Sincronizar com channels imediatamente")
    create_missing_records: bool = Field(True, description="Criar registros de availability se não existirem")
    overwrite_existing: bool = Field(True, description="Sobrescrever valores existentes")
    
    # Validações avançadas
    skip_validation_errors: bool = Field(False, description="Continuar mesmo com erros de validação")
    dry_run: bool = Field(False, description="Apenas simular, não aplicar mudanças")
    
    @field_validator('room_ids')
    @classmethod
    def validate_room_ids_unique(cls, v):
        """Garantir que room_ids são únicos"""
        if v and len(v) != len(set(v)):
            raise ValueError("IDs de quartos devem ser únicos")
        return v
    
    @field_validator('days_of_week')
    @classmethod
    def validate_days_of_week(cls, v):
        """Validar dias da semana"""
        if v:
            for day in v:
                if day < 0 or day > 6:
                    raise ValueError("Dias da semana devem estar entre 0 (Domingo) e 6 (Sábado)")
            if len(v) != len(set(v)):
                raise ValueError("Dias da semana devem ser únicos")
        return v
    
    @model_validator(mode='after')
    def validate_scope_requirements(self):
        """Validar requisitos por escopo"""
        if self.scope == BulkEditScope.ROOM_TYPE and not self.room_type_id:
            raise ValueError("room_type_id é obrigatório para escopo room_type")
        
        if self.scope == BulkEditScope.SPECIFIC_ROOMS and not self.room_ids:
            raise ValueError("room_ids é obrigatório para escopo specific_rooms")
        
        # Validar período
        if self.date_to <= self.date_from:
            raise ValueError("date_to deve ser posterior a date_from")
        
        days_diff = (self.date_to - self.date_from).days
        if days_diff > 366:
            raise ValueError("Período não pode exceder 366 dias")
        
        return self


# ============== RESPONSE SCHEMAS ==============

class BulkEditItemResult(BaseModel):
    """Resultado de um item individual"""
    room_id: int
    date: date
    target: BulkEditTarget
    operation: BulkEditOperationType
    
    success: bool
    old_value: Optional[Union[str, int, float, bool]] = None
    new_value: Optional[Union[str, int, float, bool]] = None
    error_message: Optional[str] = None
    
    # Metadados
    created_record: bool = False  # Se foi criado um novo registro de availability
    skipped: bool = False         # Se foi pulado por algum motivo


class BulkEditResult(BaseModel):
    """Schema para resultado de operação bulk edit"""
    
    # ============== IDENTIFICAÇÃO ==============
    operation_id: str = Field(..., description="ID único da operação")
    tenant_id: int = Field(..., description="ID do tenant")
    user_id: int = Field(..., description="ID do usuário que executou")
    
    # ============== RESUMO GERAL ==============
    total_items_targeted: int = Field(..., description="Total de itens que seriam processados")
    total_operations_executed: int = Field(..., description="Total de operações executadas")
    successful_operations: int = Field(..., description="Operações bem-sucedidas")
    failed_operations: int = Field(..., description="Operações com falha")
    skipped_operations: int = Field(..., description="Operações puladas")
    
    # ============== DETALHES POR TIPO ==============
    records_created: int = Field(0, description="Novos registros de availability criados")
    records_updated: int = Field(0, description="Registros existentes atualizados")
    
    # Breakdown por target
    results_by_target: Dict[str, Dict[str, int]] = Field(
        default_factory=dict,
        description="Resultados agrupados por target/campo"
    )
    
    # ============== ERROS E VALIDAÇÕES ==============
    validation_errors: List[str] = Field(default_factory=list, description="Erros de validação")
    processing_errors: List[str] = Field(default_factory=list, description="Erros de processamento")
    
    # ============== RESULTADOS DETALHADOS ==============
    detailed_results: Optional[List[BulkEditItemResult]] = Field(
        None,
        description="Resultados detalhados por item (opcional, para dry-run)"
    )
    
    # ============== SINCRONIZAÇÃO ==============
    sync_triggered: bool = Field(False, description="Se a sincronização foi acionada")
    sync_job_id: Optional[str] = Field(None, description="ID do job de sincronização")
    
    # ============== TIMING ==============
    started_at: datetime = Field(..., description="Início da operação")
    completed_at: datetime = Field(..., description="Fim da operação")
    duration_seconds: float = Field(..., description="Duração em segundos")
    
    # ============== METADATA ==============
    dry_run: bool = Field(False, description="Se foi apenas uma simulação")
    request_summary: Dict[str, Any] = Field(default_factory=dict, description="Resumo da requisição")


# ============== VALIDATION SCHEMAS ==============

class BulkEditValidationRequest(BaseModel):
    """Schema para validar operação antes de executar"""
    bulk_edit_request: BulkEditRequest = Field(..., description="Requisição a ser validada")
    
    # Opções de validação
    check_room_availability: bool = Field(True, description="Verificar se quartos estão disponíveis")
    check_existing_reservations: bool = Field(True, description="Verificar reservas existentes")
    check_channel_conflicts: bool = Field(True, description="Verificar conflitos com canais")
    estimate_processing_time: bool = Field(True, description="Estimar tempo de processamento")


class BulkEditValidationResult(BaseModel):
    """Schema para resultado da validação"""
    is_valid: bool = Field(..., description="Se a operação é válida")
    
    # Estatísticas estimadas
    estimated_items_to_process: int = Field(0, description="Itens estimados para processamento")
    estimated_duration_seconds: float = Field(0.0, description="Tempo estimado em segundos")
    
    # Rooms afetados
    affected_rooms: List[Dict[str, Any]] = Field(default_factory=list, description="Quartos que serão afetados")
    
    # Warnings e erros
    validation_warnings: List[str] = Field(default_factory=list, description="Avisos de validação")
    validation_errors: List[str] = Field(default_factory=list, description="Erros de validação")
    
    # Conflitos
    reservation_conflicts: List[Dict[str, Any]] = Field(default_factory=list, description="Conflitos com reservas")
    channel_conflicts: List[Dict[str, Any]] = Field(default_factory=list, description="Conflitos com canais")
    
    # Recomendações
    recommendations: List[str] = Field(default_factory=list, description="Recomendações")


# ============== FILTER SCHEMAS ==============

class BulkEditHistoryFilters(BaseModel):
    """Filtros para histórico de bulk edits"""
    user_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    operation_type: Optional[BulkEditOperationType] = None
    target: Optional[BulkEditTarget] = None
    successful_only: Optional[bool] = None


class BulkEditHistoryResponse(BaseModel):
    """Resposta do histórico de bulk edits"""
    operation_id: str
    user_id: int
    user_name: Optional[str] = None
    
    # Resumo da operação
    scope: BulkEditScope
    total_operations: int
    successful_operations: int
    failed_operations: int
    
    # Timing
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    
    # Metadados
    reason: Optional[str] = None
    dry_run: bool = False