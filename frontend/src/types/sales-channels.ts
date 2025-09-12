// frontend/src/types/sales-channels.ts

export type SalesChannelType = 
  | 'direct' 
  | 'ota' 
  | 'phone' 
  | 'email' 
  | 'walk_in' 
  | 'agency' 
  | 'corporate' 
  | 'other';

export interface SalesChannel {
  id: number;
  name: string;
  code: string;
  channel_type: SalesChannelType;
  commission_percentage?: number;
  is_external: boolean;
  is_active: boolean;
  webhook_url?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
  tenant_id: number;
}

export interface SalesChannelCreate {
  name: string;
  code: string;
  channel_type: SalesChannelType;
  commission_percentage?: number;
  is_external?: boolean;
  is_active?: boolean;
  webhook_url?: string;
  settings?: Record<string, any>;
}

export interface SalesChannelUpdate {
  name?: string;
  code?: string;
  channel_type?: SalesChannelType;
  commission_percentage?: number;
  is_external?: boolean;
  is_active?: boolean;
  webhook_url?: string;
  settings?: Record<string, any>;
}

export interface SalesChannelsListResponse {
  sales_channels: SalesChannel[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SalesChannelsExternalResponse {
  sales_channels: SalesChannel[];
  total: number;
}

export interface SalesChannelsFilters {
  page?: number;
  per_page?: number;
  channel_type?: SalesChannelType;
  is_external?: boolean;
  is_active?: boolean;
  search?: string;
}

export interface SalesChannelFormData {
  name: string;
  code: string;
  channel_type: SalesChannelType;
  commission_percentage: number;
  is_external: boolean;
  is_active: boolean;
  webhook_url: string;
  settings: Record<string, any>;
}

// Operações em massa
export interface BulkOperationRequest {
  operation: 'activate' | 'deactivate' | 'delete' | 'update_commission';
  channel_ids: number[];
  data?: {
    commission_percentage?: number;
    is_active?: boolean;
  };
}

export interface BulkOperationResponse {
  success: boolean;
  message: string;
  affected_count: number;
  errors?: string[];
}

// Cálculo de comissão
export interface CommissionCalculationRequest {
  amount: number;
  currency?: string;
}

export interface CommissionCalculationResponse {
  original_amount: number;
  commission_percentage: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
}

// Estados para UI
export interface SalesChannelsState {
  salesChannels: SalesChannel[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Ações
export type SalesChannelsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SALES_CHANNELS'; payload: SalesChannelsListResponse }
  | { type: 'ADD_SALES_CHANNEL'; payload: SalesChannel }
  | { type: 'UPDATE_SALES_CHANNEL'; payload: SalesChannel }
  | { type: 'REMOVE_SALES_CHANNEL'; payload: number }
  | { type: 'TOGGLE_SALES_CHANNEL_STATUS'; payload: { id: number; is_active: boolean } }
  | { type: 'BULK_UPDATE'; payload: { ids: number[]; changes: Partial<SalesChannel> } };

// Constantes
export const SALES_CHANNEL_TYPES: { value: SalesChannelType; label: string }[] = [
  { value: 'direct', label: 'Direto' },
  { value: 'ota', label: 'OTA (Online Travel Agency)' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'Email' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'agency', label: 'Agência de Viagem' },
  { value: 'corporate', label: 'Corporativo' },
  { value: 'other', label: 'Outro' }
];

export const EXTERNAL_CHANNEL_TYPES: SalesChannelType[] = ['ota', 'agency'];

// Utilitários
export const getSalesChannelTypeLabel = (type: SalesChannelType): string => {
  const item = SALES_CHANNEL_TYPES.find(t => t.value === type);
  return item?.label || type;
};

export const isExternalChannelType = (type: SalesChannelType): boolean => {
  return EXTERNAL_CHANNEL_TYPES.includes(type);
};