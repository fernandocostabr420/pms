// frontend/src/lib/api/sales-channels.ts

import { apiClient } from '@/lib/api';
import type {
  SalesChannel,
  SalesChannelCreate,
  SalesChannelUpdate,
  SalesChannelsListResponse,
  SalesChannelsExternalResponse,
  SalesChannelsFilters,
  BulkOperationRequest,
  BulkOperationResponse,
  CommissionCalculationRequest,
  CommissionCalculationResponse
} from '@/types/sales-channels';

// Base URL para canais de venda
const SALES_CHANNELS_BASE_URL = '/api/v1/sales-channels';

export class SalesChannelsAPI {
  
  /**
   * Listar canais de venda com paginação e filtros
   */
  static async list(filters: SalesChannelsFilters = {}): Promise<SalesChannelsListResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.per_page) params.append('per_page', filters.per_page.toString());
      if (filters.channel_type) params.append('channel_type', filters.channel_type);
      if (filters.is_external !== undefined) params.append('is_external', filters.is_external.toString());
      if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters.search) params.append('search', filters.search);

      const response = await apiClient.get(`${SALES_CHANNELS_BASE_URL}?${params}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar canais de venda:', error);
      throw new Error('Falha ao carregar canais de venda');
    }
  }

  /**
   * Buscar apenas canais de venda externos (OTAs)
   */
  static async listExternal(): Promise<SalesChannelsExternalResponse> {
    try {
      const response = await apiClient.get(`${SALES_CHANNELS_BASE_URL}/external`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar canais de venda externos:', error);
      throw new Error('Falha ao carregar canais de venda externos');
    }
  }

  /**
   * Buscar um canal de venda por ID
   */
  static async getById(id: number): Promise<SalesChannel> {
    try {
      const response = await apiClient.get(`${SALES_CHANNELS_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar canal de venda ${id}:`, error);
      throw new Error('Canal de venda não encontrado');
    }
  }

  /**
   * Criar novo canal de venda
   */
  static async create(data: SalesChannelCreate): Promise<SalesChannel> {
    try {
      const response = await apiClient.post(SALES_CHANNELS_BASE_URL, data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao criar canal de venda:', error);
      
      if (error.response?.status === 409) {
        throw new Error('Já existe um canal de venda com este código');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao criar canal de venda');
    }
  }

  /**
   * Atualizar canal de venda
   */
  static async update(id: number, data: SalesChannelUpdate): Promise<SalesChannel> {
    try {
      const response = await apiClient.put(`${SALES_CHANNELS_BASE_URL}/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao atualizar canal de venda ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Já existe um canal de venda com este código');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao atualizar canal de venda');
    }
  }

  /**
   * Deletar canal de venda
   */
  static async delete(id: number): Promise<void> {
    try {
      await apiClient.delete(`${SALES_CHANNELS_BASE_URL}/${id}`);
    } catch (error: any) {
      console.error(`Erro ao deletar canal de venda ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('Não é possível deletar este canal de venda pois está sendo utilizado');
      }
      
      throw new Error('Falha ao deletar canal de venda');
    }
  }

  /**
   * Operações em massa (ativar, desativar, deletar, atualizar comissão)
   */
  static async bulkOperation(request: BulkOperationRequest): Promise<BulkOperationResponse> {
    try {
      const response = await apiClient.post(`${SALES_CHANNELS_BASE_URL}/bulk-operation`, request);
      return response.data;
    } catch (error: any) {
      console.error('Erro na operação em massa:', error);
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha na operação em massa');
    }
  }

  /**
   * Calcular comissão para um canal específico
   */
  static async calculateCommission(
    id: number, 
    request: CommissionCalculationRequest
  ): Promise<CommissionCalculationResponse> {
    try {
      const response = await apiClient.post(
        `${SALES_CHANNELS_BASE_URL}/${id}/calculate-commission`, 
        request
      );
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao calcular comissão para canal ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao calcular comissão');
    }
  }

  /**
   * Ativar/Desativar canal de venda
   */
  static async toggleStatus(id: number, isActive: boolean): Promise<SalesChannel> {
    try {
      const response = await apiClient.put(`${SALES_CHANNELS_BASE_URL}/${id}`, {
        is_active: isActive
      });
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao alterar status do canal de venda ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      throw new Error('Falha ao alterar status do canal de venda');
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
      
      const response = await apiClient.get(`${SALES_CHANNELS_BASE_URL}/validate-code?${params}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao validar código:', error);
      return { available: false };
    }
  }

  /**
   * Testar webhook de um canal
   */
  static async testWebhook(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post(`${SALES_CHANNELS_BASE_URL}/${id}/test-webhook`);
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao testar webhook do canal ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Falha ao testar webhook');
    }
  }

  /**
   * Obter estatísticas de um canal de venda
   */
  static async getStats(id: number, period?: '7d' | '30d' | '90d'): Promise<{
    total_reservations: number;
    total_revenue: number;
    total_commission: number;
    average_commission: number;
    period: string;
  }> {
    try {
      const params = period ? `?period=${period}` : '';
      const response = await apiClient.get(`${SALES_CHANNELS_BASE_URL}/${id}/stats${params}`);
      return response.data;
    } catch (error: any) {
      console.error(`Erro ao buscar estatísticas do canal ${id}:`, error);
      
      if (error.response?.status === 404) {
        throw new Error('Canal de venda não encontrado');
      }
      
      throw new Error('Falha ao carregar estatísticas');
    }
  }
}

// Exportar como default
export default SalesChannelsAPI;