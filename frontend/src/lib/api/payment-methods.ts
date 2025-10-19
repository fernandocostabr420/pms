// frontend/src/lib/api/payment-methods.ts

import apiClient from '../api';

export interface PaymentMethodResponse {
  id: number;
  name: string;
  code: string;
  description?: string;
  display_order: number;
  icon?: string;
  color?: string;
  is_active: boolean;
  requires_reference?: boolean;
  has_fees?: boolean;
  default_fee_rate?: number;
  settings?: any;
  validation_rules?: any;
  created_at: string;
  updated_at: string;
  tenant_id: number;
  // Campos computados
  display_name?: string;
  is_card_payment?: boolean;
  is_electronic_payment?: boolean;
  requires_external_validation?: boolean;
}

export interface PaymentMethodCreate {
  name: string;
  code: string;
  description?: string;
  display_order?: number;
  icon?: string;
  color?: string;
  requires_reference?: boolean;
  has_fees?: boolean;
  default_fee_rate?: number;
  settings?: any;
  validation_rules?: any;
}

export interface PaymentMethodUpdate {
  name?: string;
  code?: string;
  description?: string;
  display_order?: number;
  icon?: string;
  color?: string;
  requires_reference?: boolean;
  has_fees?: boolean;
  default_fee_rate?: number;
  settings?: any;
  validation_rules?: any;
}

export interface PaymentMethodListResponse {
  payment_methods: PaymentMethodResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface PaymentMethodFilters {
  search?: string;
  is_active?: boolean;
  has_fees?: boolean;
  requires_reference?: boolean;
}

export class PaymentMethodsAPI {
  // ✅ IMPORTANTE: Usar apenas o endpoint sem /api/v1 pois o baseURL já tem
  async list(params?: PaymentMethodFilters & { page?: number; per_page?: number }): Promise<PaymentMethodListResponse> {
    try {
      const response = await apiClient.get('/payment-methods', params);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      throw error;
    }
  }

  async create(data: PaymentMethodCreate): Promise<PaymentMethodResponse> {
    const response = await apiClient.post('/payment-methods', data);
    return response.data;
  }

  async getById(id: number): Promise<PaymentMethodResponse> {
    const response = await apiClient.get(`/payment-methods/${id}`);
    return response.data;
  }

  async update(id: number, data: PaymentMethodUpdate): Promise<PaymentMethodResponse> {
    const response = await apiClient.put(`/payment-methods/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/payment-methods/${id}`);
  }

  async getActive(): Promise<PaymentMethodResponse[]> {
    const response = await apiClient.get('/payment-methods/active');
    return response.data;
  }

  async getStats(): Promise<any> {
    const response = await apiClient.get('/payment-methods/stats');
    return response.data;
  }

  async bulkOperation(operation: {
    operation: 'activate' | 'deactivate' | 'delete';
    payment_method_ids: number[];
  }): Promise<any> {
    const response = await apiClient.post('/payment-methods/bulk-operation', operation);
    return response.data;
  }

  async updateOrder(orderData: {
    payment_method_orders: Array<{ id: number; display_order: number }>;
  }): Promise<PaymentMethodResponse[]> {
    const response = await apiClient.put('/payment-methods/update-order', orderData);
    return response.data;
  }

  async getByCode(code: string): Promise<PaymentMethodResponse> {
    const response = await apiClient.get(`/payment-methods/code/${code}`);
    return response.data;
  }

  async setupDefaults(): Promise<PaymentMethodResponse[]> {
    const response = await apiClient.post('/payment-methods/setup-defaults');
    return response.data;
  }
}

export const paymentMethodsAPI = new PaymentMethodsAPI();
export default paymentMethodsAPI;