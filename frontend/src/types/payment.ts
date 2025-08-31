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