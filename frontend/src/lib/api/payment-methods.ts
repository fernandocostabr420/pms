// frontend/src/lib/api/payment-methods.ts

import { apiClient } from '@/lib/api';
import type {
  PaymentMethod,
  PaymentMethodCreate,
  PaymentMethodUpdate,
  PaymentMethodsListResponse,
  PaymentMethodsActiveResponse,
  PaymentMethodsFilters
} from '@/types/payment-methods';

// Base URL para métodos de pagamento
const PAYMENT_METHODS_BASE_URL = '/api/v1/payment-methods';

export class PaymentMethodsAPI {
  
  /**
   * Listar métodos de pagamento com paginação e filtros
   */
  static async list(filters: PaymentMethodsFilters = {}): Promise<PaymentMethodsListResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.per_page) params.append('per_page', filters.per_page.toString());
      if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters.has_fee !== undefined) params.append('has_fee', filters.has_fee.toString());
      if (filters.search) params.append('search', filters.search);

      const response = await apiClient.get(`${PAYMENT_METHODS_BASE_URL}?${params}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      throw new Error('Falha ao carregar métodos de pagamento');
    }
  }

  /**
   * Buscar apenas métodos de pagamento ativos
   */
  static async listActive(): Promise<PaymentMethodsActiveResponse> {
    try {
      const response = await apiClient.get(`${PAYMENT_METHODS_BASE_URL}/active`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento ativos:', error);
      throw new Error('Falha ao carregar métodos de pagamento ativos');
    }
  }

  /**
   * Buscar um método de pagamento por ID
   */
  static async getById(id: number): Promise<PaymentMethod> {
    try {
      const response = await apiClient.get(`${PAYMENT_METHODS_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar método de pagamento ${id}:`, error);
      throw new Error('Método de pagamento não encontrado');
    }
  }

  /**
   * Criar novo método de pagamento
   */
  static async create(data: PaymentMethodCreate): Promise<PaymentMethod> {
    try {
      const response = await apiClient.post(PAYMENT_METHODS_BASE_URL, data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao criar método de pagamento:', error);
      
      if (error.response?.status === 409) {
        throw new Error('Já existe um método de pagamento com este código');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao criar método de pagamento');
    }
  }

  /**
   * Atualizar método de pagamento
   */
  static async update(id: number, data: PaymentMethodUpdate): Promise<PaymentMethod> {
    try {
      const response = await apiClient.put(`${PAYMENT_METHODS_BASE_URL}/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao atualizar método de pagamento ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Método de pagamento não encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Já existe um método de pagamento com este código');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao atualizar método de pagamento');
    }
  }

  /**
   * Deletar método de pagamento (soft delete)
   */
  static async delete(id: number): Promise<void> {
    try {
      await apiClient.delete(`${PAYMENT_METHODS_BASE_URL}/${id}`);
    } catch (error: any) {
      console.error(`Erro ao deletar método de pagamento ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Método de pagamento não encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Não é possível deletar este método de pagamento pois está sendo utilizado');
      }
      
      throw new Error('Falha ao deletar método de pagamento');
    }
  }

  /**
   * Ativar/Desativar método de pagamento
   */
  static async toggleStatus(id: number, isActive: boolean): Promise<PaymentMethod> {
    try {
      const response = await apiClient.put(`${PAYMENT_METHODS_BASE_URL}/${id}`, {
        is_active: isActive
      });
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao alterar status do método de pagamento ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Método de pagamento não encontrado');
      }
      
      throw new Error('Falha ao alterar status do método de pagamento');
    }
  }

  /**
   * Criar dados padrão (métodos de pagamento comuns)
   */
  static async setupDefaults(): Promise<{ message: string; created_count: number }> {
    try {
      const response = await apiClient.post(`${PAYMENT_METHODS_BASE_URL}/setup-defaults`);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao criar métodos de pagamento padrão:', error);
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao criar métodos de pagamento padrão');
    }
  }

  /**
   * Validar código único antes de criar/editar
   */
  static async validateCode(code: string, excludeId?: number): Promise<{ available: boolean }> {
    try {
      const params = new URLSearchParams();
      params.append('code', code);
      if (excludeId) params.append('exclude_id', excludeId.toString());
      
      const response = await apiClient.get(`${PAYMENT_METHODS_BASE_URL}/validate-code?${params}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao validar código:', error);
      return { available: false };
    }
  }
}

// Exportar como default
export default PaymentMethodsAPI;