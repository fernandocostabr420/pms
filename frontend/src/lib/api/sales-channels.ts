// frontend/src/lib/api/sales-channels.ts

import apiClient from '../api';

export interface SalesChannelResponse {
  id: number;
  name: string;
  code: string;
  description?: string;
  display_order: number;
  icon?: string;
  color?: string;
  channel_type: string;
  is_external: boolean;
  is_active: boolean;
  commission_rate?: number;
  commission_type?: string;
  base_fee?: number;
  has_api_integration?: boolean;
  api_config?: any;
  webhook_url?: string;
  settings?: any;
  business_rules?: any;
  external_id?: string;
  credentials?: any;
  created_at: string;
  updated_at: string;
  tenant_id: number;
  // Campos computados
  display_name?: string;
  is_ota?: boolean;
  requires_commission?: boolean;
  has_integration?: boolean;
  channel_type_display?: string;
}

export interface SalesChannelCreate {
  name: string;
  code: string;
  description?: string;
  display_order?: number;
  icon?: string;
  color?: string;
  channel_type: string;
  is_external?: boolean;
  commission_rate?: number;
  commission_type?: string;
  base_fee?: number;
  has_api_integration?: boolean;
  api_config?: any;
  webhook_url?: string;
  settings?: any;
  business_rules?: any;
  external_id?: string;
  credentials?: any;
}

export interface SalesChannelUpdate {
  name?: string;
  code?: string;
  description?: string;
  display_order?: number;
  icon?: string;
  color?: string;
  channel_type?: string;
  is_external?: boolean;
  commission_rate?: number;
  commission_type?: string;
  base_fee?: number;
  has_api_integration?: boolean;
  api_config?: any;
  webhook_url?: string;
  settings?: any;
  business_rules?: any;
  external_id?: string;
  credentials?: any;
}

export interface SalesChannelListResponse {
  sales_channels: SalesChannelResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface SalesChannelFilters {
  search?: string;
  is_active?: boolean;
  is_external?: boolean;
  channel_type?: string;
  has_api_integration?: boolean;
  requires_commission?: boolean;
}

export class SalesChannelsAPI {
  // ✅ IMPORTANTE: Usar apenas o endpoint sem /api/v1 pois o baseURL já tem
  async list(params?: SalesChannelFilters & { page?: number; per_page?: number }): Promise<SalesChannelListResponse> {
    try {
      const response = await apiClient.get('/sales-channels', params);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar canais de venda:', error);
      throw error;
    }
  }

  async create(data: SalesChannelCreate): Promise<SalesChannelResponse> {
    const response = await apiClient.post('/sales-channels', data);
    return response.data;
  }

  async getById(id: number): Promise<SalesChannelResponse> {
    const response = await apiClient.get(`/sales-channels/${id}`);
    return response.data;
  }

  async update(id: number, data: SalesChannelUpdate): Promise<SalesChannelResponse> {
    const response = await apiClient.put(`/sales-channels/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/sales-channels/${id}`);
  }

  async getActive(): Promise<SalesChannelResponse[]> {
    const response = await apiClient.get('/sales-channels/active');
    return response.data;
  }

  async getExternal(): Promise<SalesChannelResponse[]> {
    const response = await apiClient.get('/sales-channels/external');
    return response.data;
  }

  async getStats(): Promise<any> {
    const response = await apiClient.get('/sales-channels/stats');
    return response.data;
  }

  async bulkOperation(operation: {
    operation: 'activate' | 'deactivate' | 'delete';
    sales_channel_ids: number[];
  }): Promise<any> {
    const response = await apiClient.post('/sales-channels/bulk-operation', operation);
    return response.data;
  }

  async updateOrder(orderData: {
    sales_channel_orders: Array<{ id: number; display_order: number }>;
  }): Promise<SalesChannelResponse[]> {
    const response = await apiClient.put('/sales-channels/update-order', orderData);
    return response.data;
  }

  async getByCode(code: string): Promise<SalesChannelResponse> {
    const response = await apiClient.get(`/sales-channels/code/${code}`);
    return response.data;
  }

  async calculateCommission(id: number, data: {
    base_amount: number;
    reservation_data?: any;
  }): Promise<{
    commission_amount: number;
    base_fee: number;
    total_fee: number;
    net_amount: number;
  }> {
    const response = await apiClient.post(`/sales-channels/${id}/calculate-commission`, data);
    return response.data;
  }

  async testConnection(id: number): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const response = await apiClient.post(`/sales-channels/${id}/test-connection`);
    return response.data;
  }

  async setupDefaults(): Promise<SalesChannelResponse[]> {
    const response = await apiClient.post('/sales-channels/setup-defaults');
    return response.data;
  }
}

export const salesChannelsAPI = new SalesChannelsAPI();
export default salesChannelsAPI;