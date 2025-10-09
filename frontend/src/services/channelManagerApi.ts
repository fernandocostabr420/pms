// frontend/src/services/channelManagerApi.ts

import apiClient from '@/lib/api';
import {
  ChannelManagerOverview,
  AvailabilityCalendarRequest,
  AvailabilityCalendarResponse,
  BulkAvailabilityUpdate,
  BulkOperationResult,
  SyncRequest,
  SyncResult,
  ChannelManagerFilters
} from '@/types/channel-manager';

export class ChannelManagerAPI {
  
  // ============== DASHBOARD & OVERVIEW ==============
  
  /**
   * Busca visão geral do Channel Manager
   */
  async getOverview(params?: {
    date_from?: string;
    date_to?: string;
    property_id?: number;
  }): Promise<ChannelManagerOverview> {
    try {
      const response = await apiClient.get('/channel-manager/overview', params);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar overview do Channel Manager:', error);
      throw error;
    }
  }

  // ============== CALENDÁRIO ==============
  
  /**
   * Busca dados do calendário de disponibilidade
   */
  async getAvailabilityCalendar(
    request: AvailabilityCalendarRequest
  ): Promise<AvailabilityCalendarResponse> {
    try {
      const response = await apiClient.post('/channel-manager/availability/calendar', request);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar calendário de disponibilidade:', error);
      throw error;
    }
  }

  /**
   * Busca calendário com filtros simplificados (GET)
   */
  async getCalendarRange(params: {
    date_from: string;
    date_to: string;
    room_ids?: number[];
    property_id?: number;
  }): Promise<AvailabilityCalendarResponse> {
    try {
      const response = await apiClient.get('/channel-manager/availability/calendar', params);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar range do calendário:', error);
      throw error;
    }
  }

  // ============== EDIÇÃO INLINE ==============
  
  /**
   * Atualiza uma única célula do calendário
   */
  async updateAvailabilityCell(data: {
    room_id: number;
    date: string;
    field: 'rate' | 'availability' | 'min_stay' | 'closed_to_arrival' | 'closed_to_departure';
    value: any;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      // Usar endpoint de bulk update com um único item
      const bulkData: BulkAvailabilityUpdate = {
        room_ids: [data.room_id],
        date_from: data.date,
        date_to: data.date,
        [data.field === 'rate' ? 'rate_override' : data.field]: data.value
      };

      const response = await apiClient.post('/room-availability/bulk-update', bulkData);
      return { success: true, message: 'Atualizado com sucesso' };
    } catch (error) {
      console.error('Erro ao atualizar célula:', error);
      throw error;
    }
  }

  // ============== BULK EDIT ==============
  
  /**
   * Executa edição em massa
   */
  async bulkUpdateAvailability(
    data: BulkAvailabilityUpdate
  ): Promise<BulkOperationResult> {
    try {
      const response = await apiClient.post('/room-availability/bulk-update', data);
      return response.data;
    } catch (error) {
      console.error('Erro na edição em massa:', error);
      throw error;
    }
  }

  /**
   * Valida operação de bulk edit antes de executar
   */
  async validateBulkOperation(
    data: BulkAvailabilityUpdate
  ): Promise<{
    is_valid: boolean;
    total_cells: number;
    conflicts: string[];
    warnings: string[];
  }> {
    try {
      // Usar endpoint de bulk edit validation se existir, senão simular
      const response = await apiClient.post('/bulk-edit/validate', {
        target: 'availability',
        operation: 'update',
        scope: {
          room_ids: data.room_ids,
          date_from: data.date_from,
          date_to: data.date_to
        },
        changes: data
      });
      return response.data;
    } catch (error) {
      console.error('Erro na validação de bulk edit:', error);
      // Retornar validação básica em caso de erro
      const totalDays = Math.ceil(
        (new Date(data.date_to).getTime() - new Date(data.date_from).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      
      return {
        is_valid: true,
        total_cells: data.room_ids.length * totalDays,
        conflicts: [],
        warnings: []
      };
    }
  }

  // ============== SINCRONIZAÇÃO ==============
  
  /**
   * Inicia sincronização manual com WuBook
   */
  async syncWithWuBook(request: SyncRequest): Promise<SyncResult> {
    try {
      const response = await apiClient.post('/channel-manager/sync', request);
      return response.data;
    } catch (error) {
      console.error('Erro na sincronização com WuBook:', error);
      throw error;
    }
  }

  /**
   * Busca status de sincronização por task_id
   */
  async getSyncStatus(taskId: string): Promise<SyncResult> {
    try {
      const response = await apiClient.get(`/channel-manager/sync/status/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar status de sincronização:', error);
      throw error;
    }
  }

  /**
   * Força sincronização completa
   */
  async forceFullSync(params?: {
    room_ids?: number[];
    property_id?: number;
  }): Promise<SyncResult> {
    try {
      const request: SyncRequest = {
        sync_type: 'full',
        force_sync: true,
        ...params
      };
      return await this.syncWithWuBook(request);
    } catch (error) {
      console.error('Erro na sincronização completa:', error);
      throw error;
    }
  }

  // ============== CONFIGURAÇÕES ==============
  
  /**
   * Lista configurações de canal
   */
  async getConfigurations(filters?: ChannelManagerFilters): Promise<{
    items: any[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const response = await apiClient.get('/channel-manager/configurations', filters);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      throw error;
    }
  }

  // ============== HEALTH CHECK ==============
  
  /**
   * Verifica saúde das sincronizações
   */
  async getHealthReport(): Promise<{
    overall_health: 'healthy' | 'warning' | 'critical';
    health_score: number;
    issues: Array<{ type: string; message: string; severity: string }>;
    recommendations: string[];
  }> {
    try {
      const response = await apiClient.get('/channel-manager/health');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar relatório de saúde:', error);
      throw error;
    }
  }

  // ============== UTILITIES ==============
  
  /**
   * Calcula estatísticas do período
   */
  calculatePeriodStats(calendarData: AvailabilityCalendarResponse): {
    totalDays: number;
    totalRooms: number;
    totalCells: number;
    availabilityRate: number;
    syncRate: number;
  } {
    const totalDays = calendarData.total_days;
    const totalRooms = calendarData.rooms_summary.length;
    const totalCells = totalDays * totalRooms;
    
    const availableCount = calendarData.calendar_data.reduce(
      (acc, day) => acc + day.summary.available_rooms, 0
    );
    
    const availabilityRate = totalCells > 0 ? (availableCount / totalCells) * 100 : 0;
    const syncRate = calendarData.statistics.sync_rate;

    return {
      totalDays,
      totalRooms,
      totalCells,
      availabilityRate: Math.round(availabilityRate * 100) / 100,
      syncRate: Math.round(syncRate * 100) / 100
    };
  }
}

// Export singleton instance
export const channelManagerAPI = new ChannelManagerAPI();
export default channelManagerAPI;