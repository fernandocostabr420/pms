// frontend/src/types/payment.ts

export enum PaymentMethodEnum {
  PIX = "pix",
  CREDIT_CARD = "credit_card", 
  DEBIT_CARD = "debit_card",
  BANK_TRANSFER = "bank_transfer",
  CASH = "cash",
  CHECK = "check",
  OTHER = "other"
}

export enum PaymentStatusEnum {
  PENDING = "pending",
  CONFIRMED = "confirmed", 
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  FAILED = "failed"
}

// Base interfaces
export interface PaymentCreate {
  reservation_id: number;
  amount: number;
  payment_method: PaymentMethodEnum;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  internal_notes?: string;
  fee_amount?: number;
  is_partial?: boolean;
}

export interface PaymentUpdate {
  amount?: number;
  payment_method?: PaymentMethodEnum;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  internal_notes?: string;
  fee_amount?: number;
  is_partial?: boolean;
}

// ✅ NOVO: Interface para edição de pagamentos confirmados (justificativa obrigatória)
export interface PaymentConfirmedUpdate {
  amount?: number;
  payment_method?: PaymentMethodEnum;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  fee_amount?: number;
  is_partial?: boolean;
  // ✅ OBRIGATÓRIO: Justificativa para edição de pagamento confirmado
  admin_reason: string;
}

// ✅ NOVO: Interface para exclusão de pagamentos confirmados
export interface PaymentDeleteConfirmed {
  admin_reason: string;
}

export interface PaymentStatusUpdate {
  status: PaymentStatusEnum;
  confirmed_date?: string;
  notes?: string;
}

export interface PaymentResponse {
  id: number;
  payment_number: string;
  reservation_id: number;
  tenant_id: number;
  
  // Dados financeiros
  amount: number;
  currency: string;
  fee_amount?: number;
  net_amount?: number;
  
  // Identificação e método
  payment_method: string;
  reference_number?: string;
  
  // Datas
  payment_date: string;
  confirmed_date?: string;
  
  // Status e flags
  status: string;
  is_partial: boolean;
  is_refund: boolean;
  
  // Observações
  notes?: string;
  internal_notes?: string;
  
  // Metadados
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Campos computados
  status_display?: string;
  payment_method_display?: string;
  
  // ✅ NOVOS: Campos para auditoria administrativa
  has_admin_changes?: boolean;
  last_admin_action?: string;
}

export interface PaymentWithReservation extends PaymentResponse {
  reservation_number?: string;
  guest_name?: string;
  property_name?: string;
  check_in_date?: string;
  check_out_date?: string;
}

export interface PaymentListResponse {
  payments: PaymentResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface PaymentFilters {
  reservation_id?: number;
  status?: PaymentStatusEnum;
  payment_method?: PaymentMethodEnum;
  payment_date_from?: string;
  payment_date_to?: string;
  min_amount?: number;
  max_amount?: number;
  is_partial?: boolean;
  is_refund?: boolean;
  search?: string;
}

export interface ReservationPaymentSummary {
  reservation_id: number;
  reservation_number: string;
  total_amount: number;
  total_paid: number;
  total_refunded: number;
  balance_due: number;
  payment_count: number;
  last_payment_date?: string;
  payments: PaymentResponse[];
}

export interface PaymentReport {
  period_start: string;
  period_end: string;
  total_received: number;
  total_refunded: number;
  net_received: number;
  payment_count: number;
  refund_count: number;
  payments_by_method: Record<string, { count: number; amount: number }>;
  payments_by_status: Record<string, { count: number; amount: number }>;
  daily_totals: Array<{ date: string; amount: number; count: number }>;
}

export interface PaymentBulkOperation {
  operation: "confirm" | "cancel" | "refund";
  payment_ids: number[];
  notes?: string;
}

export interface PaymentStats {
  total_payments: number;
  total_amount: number;
  pending_payments: number;
  pending_amount: number;
  confirmed_payments: number;
  confirmed_amount: number;
  refunded_payments: number;
  refunded_amount: number;
}

// ===== ✅ NOVOS TIPOS PARA FUNCIONALIDADES ADMINISTRATIVAS =====

/**
 * Interface para verificação de permissões de pagamento
 */
export interface PaymentPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_edit_confirmed: boolean;
  can_delete: boolean;
  can_delete_confirmed: boolean;
  can_bulk_operations: boolean;
  is_admin: boolean;
  restrictions: string[];
}

/**
 * Interface para avisos de segurança em operações sensíveis
 */
export interface PaymentSecurityWarning {
  operation: 'edit_confirmed' | 'delete_confirmed';
  payment_id: number;
  payment_number: string;
  current_status: string;
  warning_message: string;
  requires_admin: boolean;
  requires_reason: boolean;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Interface para logs de auditoria de pagamentos
 */
export interface PaymentAuditLog {
  id: number;
  payment_id: number;
  payment_number: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ADMIN_EDIT' | 'ADMIN_DELETE';
  user_id: number;
  user_email: string;
  timestamp: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Interface para dados administrativos de um pagamento
 */
export interface PaymentAdminData {
  payment_id: number;
  has_admin_modifications: boolean;
  admin_edit_count: number;
  last_admin_edit_date?: string;
  last_admin_edit_user?: string;
  last_admin_edit_reason?: string;
  security_flags: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Interface para estatísticas administrativas
 */
export interface PaymentAdminStats {
  total_payments: number;
  confirmed_payments: number;
  pending_payments: number;
  cancelled_payments: number;
  refunded_payments: number;
  
  // Estatísticas de operações administrativas
  admin_edited_count: number;
  admin_deleted_count: number;
  admin_operations_last_30_days: number;
  
  // Valores
  total_amount: number;
  total_confirmed_amount: number;
  total_refunded_amount: number;
  
  // Por período
  period_start: string;
  period_end: string;
}

/**
 * Interface para análise de risco de operações
 */
export interface PaymentRiskAnalysis {
  payment_id: number;
  payment_number: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
  recommended_action: string;
  requires_approval: boolean;
  approval_level: 'manager' | 'admin' | 'super_admin';
}

// ===== ENUMS PARA OPERAÇÕES ADMINISTRATIVAS =====

export enum PaymentAdminAction {
  EDIT_CONFIRMED = "edit_confirmed",
  DELETE_CONFIRMED = "delete_confirmed",
  BULK_EDIT = "bulk_edit",
  BULK_DELETE = "bulk_delete",
  FORCE_STATUS_CHANGE = "force_status_change"
}

export enum PaymentSecurityLevel {
  LOW = "low",
  MEDIUM = "medium", 
  HIGH = "high",
  CRITICAL = "critical"
}

// Utility types para método e status displays
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.PIX]: "PIX",
  [PaymentMethodEnum.CREDIT_CARD]: "Cartão de Crédito",
  [PaymentMethodEnum.DEBIT_CARD]: "Cartão de Débito", 
  [PaymentMethodEnum.BANK_TRANSFER]: "Transferência Bancária",
  [PaymentMethodEnum.CASH]: "Dinheiro",
  [PaymentMethodEnum.CHECK]: "Cheque",
  [PaymentMethodEnum.OTHER]: "Outro"
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusEnum, string> = {
  [PaymentStatusEnum.PENDING]: "Pendente",
  [PaymentStatusEnum.CONFIRMED]: "Confirmado",
  [PaymentStatusEnum.CANCELLED]: "Cancelado", 
  [PaymentStatusEnum.REFUNDED]: "Estornado",
  [PaymentStatusEnum.FAILED]: "Falhou"
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatusEnum, string> = {
  [PaymentStatusEnum.PENDING]: "bg-yellow-100 text-yellow-800",
  [PaymentStatusEnum.CONFIRMED]: "bg-green-100 text-green-800",
  [PaymentStatusEnum.CANCELLED]: "bg-gray-100 text-gray-800",
  [PaymentStatusEnum.REFUNDED]: "bg-red-100 text-red-800", 
  [PaymentStatusEnum.FAILED]: "bg-red-100 text-red-800"
};

// ✅ NOVOS: Labels e cores para funcionalidades administrativas
export const PAYMENT_ADMIN_ACTION_LABELS: Record<PaymentAdminAction, string> = {
  [PaymentAdminAction.EDIT_CONFIRMED]: "Editar Pagamento Confirmado",
  [PaymentAdminAction.DELETE_CONFIRMED]: "Excluir Pagamento Confirmado",
  [PaymentAdminAction.BULK_EDIT]: "Edição em Massa",
  [PaymentAdminAction.BULK_DELETE]: "Exclusão em Massa",
  [PaymentAdminAction.FORCE_STATUS_CHANGE]: "Forçar Mudança de Status"
};

export const PAYMENT_SECURITY_LEVEL_COLORS: Record<PaymentSecurityLevel, string> = {
  [PaymentSecurityLevel.LOW]: "bg-green-100 text-green-800 border-green-200",
  [PaymentSecurityLevel.MEDIUM]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [PaymentSecurityLevel.HIGH]: "bg-orange-100 text-orange-800 border-orange-200",
  [PaymentSecurityLevel.CRITICAL]: "bg-red-100 text-red-800 border-red-200"
};

export const PAYMENT_SECURITY_LEVEL_LABELS: Record<PaymentSecurityLevel, string> = {
  [PaymentSecurityLevel.LOW]: "Baixo Risco",
  [PaymentSecurityLevel.MEDIUM]: "Risco Médio",
  [PaymentSecurityLevel.HIGH]: "Alto Risco",
  [PaymentSecurityLevel.CRITICAL]: "Risco Crítico"
};

// ✅ NOVOS: Utilitários para validação
export const ADMIN_REASON_MIN_LENGTH = 10;
export const ADMIN_REASON_MAX_LENGTH = 500;

/**
 * Função utilitária para validar justificativas administrativas
 */
export function validateAdminReason(reason: string): { valid: boolean; error?: string } {
  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: "Justificativa é obrigatória" };
  }
  
  if (reason.trim().length < ADMIN_REASON_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Justificativa deve ter pelo menos ${ADMIN_REASON_MIN_LENGTH} caracteres` 
    };
  }
  
  if (reason.trim().length > ADMIN_REASON_MAX_LENGTH) {
    return { 
      valid: false, 
      error: `Justificativa deve ter no máximo ${ADMIN_REASON_MAX_LENGTH} caracteres` 
    };
  }
  
  return { valid: true };
}

/**
 * Função utilitária para verificar se um pagamento pode ser editado/excluído
 */
export function canPerformAdminAction(
  payment: PaymentResponse, 
  permissions: PaymentPermissions,
  action: PaymentAdminAction
): { allowed: boolean; reason?: string } {
  
  if (!permissions.is_admin) {
    return { 
      allowed: false, 
      reason: "Operações administrativas requerem permissões de administrador" 
    };
  }
  
  switch (action) {
    case PaymentAdminAction.EDIT_CONFIRMED:
      if (payment.status !== 'confirmed') {
        return { allowed: false, reason: "Apenas pagamentos confirmados podem ser editados administrativamente" };
      }
      if (!permissions.can_edit_confirmed) {
        return { allowed: false, reason: "Sem permissão para editar pagamentos confirmados" };
      }
      break;
      
    case PaymentAdminAction.DELETE_CONFIRMED:
      if (payment.status !== 'confirmed') {
        return { allowed: false, reason: "Apenas pagamentos confirmados podem ser excluídos administrativamente" };
      }
      if (!permissions.can_delete_confirmed) {
        return { allowed: false, reason: "Sem permissão para excluir pagamentos confirmados" };
      }
      break;
      
    default:
      return { allowed: false, reason: "Ação administrativa não reconhecida" };
  }
  
  return { allowed: true };
}