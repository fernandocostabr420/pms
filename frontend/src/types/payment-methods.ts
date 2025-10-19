// frontend/src/types/payment-methods.ts

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  fee_percentage?: number;
  is_active: boolean;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
  tenant_id: number;
}

export interface PaymentMethodCreate {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  fee_percentage?: number;
  is_active?: boolean;
  settings?: Record<string, any>;
}

export interface PaymentMethodUpdate {
  name?: string;
  code?: string;
  description?: string;
  icon?: string;
  color?: string;
  fee_percentage?: number;
  is_active?: boolean;
  settings?: Record<string, any>;
}

export interface PaymentMethodsListResponse {
  payment_methods: PaymentMethod[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PaymentMethodsActiveResponse {
  payment_methods: PaymentMethod[];
  total: number;
}

export interface PaymentMethodsFilters {
  page?: number;
  per_page?: number;
  is_active?: boolean;
  has_fee?: boolean;
  search?: string;
}

export interface PaymentMethodFormData {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  fee_percentage: number;
  is_active: boolean;
  settings: Record<string, any>;
}

// Estados para UI
export interface PaymentMethodsState {
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Ações
export type PaymentMethodsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAYMENT_METHODS'; payload: PaymentMethodsListResponse }
  | { type: 'ADD_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'UPDATE_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'REMOVE_PAYMENT_METHOD'; payload: number }
  | { type: 'TOGGLE_PAYMENT_METHOD_STATUS'; payload: { id: number; is_active: boolean } };

// Constantes
export const PAYMENT_METHOD_ICONS = [
  'credit-card',
  'banknote',
  'coins',
  'wallet',
  'smartphone',
  'qr-code',
  'building',
  'piggy-bank'
] as const;

export const PAYMENT_METHOD_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316'  // orange-500
] as const;

export type PaymentMethodIcon = typeof PAYMENT_METHOD_ICONS[number];
export type PaymentMethodColor = typeof PAYMENT_METHOD_COLORS[number];