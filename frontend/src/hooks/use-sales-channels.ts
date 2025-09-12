// frontend/src/hooks/use-sales-channels.ts

import { useState, useEffect, useCallback, useReducer } from 'react';
import { useToast } from '@/hooks/use-toast';
import SalesChannelsAPI from '@/lib/api/sales-channels';
import type {
  SalesChannel,
  SalesChannelCreate,
  SalesChannelUpdate,
  SalesChannelsFilters,
  SalesChannelsState,
  SalesChannelsAction,
  BulkOperationRequest,
  CommissionCalculationRequest
} from '@/types/sales-channels';

// Reducer para gerenciar estado dos canais de venda
function salesChannelsReducer(
  state: SalesChannelsState,
  action: SalesChannelsAction
): SalesChannelsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_SALES_CHANNELS':
      return {
        ...state,
        salesChannels: action.payload.sales_channels,
        total: action.payload.total,
        page: action.payload.page,
        per_page: action.payload.per_page,
        total_pages: action.payload.total_pages,
        loading: false,
        error: null
      };
    
    case 'ADD_SALES_CHANNEL':
      return {
        ...state,
        salesChannels: [action.payload, ...state.salesChannels],
        total: state.total + 1
      };
    
    case 'UPDATE_SALES_CHANNEL':
      return {
        ...state,
        salesChannels: state.salesChannels.map(sc =>
          sc.id === action.payload.id ? action.payload : sc
        )
      };
    
    case 'REMOVE_SALES_CHANNEL':
      return {
        ...state,
        salesChannels: state.salesChannels.filter(sc => sc.id !== action.payload),
        total: state.total - 1
      };
    
    case 'TOGGLE_SALES_CHANNEL_STATUS':
      return {
        ...state,
        salesChannels: state.salesChannels.map(sc =>
          sc.id === action.payload.id
            ? { ...sc, is_active: action.payload.is_active }
            : sc
        )
      };
    
    case 'BULK_UPDATE':
      return {
        ...state,
        salesChannels: state.salesChannels.map(sc =>
          action.payload.ids.includes(sc.id)
            ? { ...sc, ...action.payload.changes }
            : sc
        )
      };
    
    default:
      return state;
  }
}

const initialState: SalesChannelsState = {
  salesChannels: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  per_page: 10,
  total_pages: 0
};

export function useSalesChannels(initialFilters?: SalesChannelsFilters) {
  const [state, dispatch] = useReducer(salesChannelsReducer, initialState);
  const [filters, setFilters] = useState<SalesChannelsFilters>(initialFilters || {});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { toast } = useToast();

  // Carregar canais de venda
  const loadSalesChannels = useCallback(async (newFilters?: SalesChannelsFilters) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const finalFilters = newFilters || filters;
      const response = await SalesChannelsAPI.list(finalFilters);
      dispatch({ type: 'SET_SALES_CHANNELS', payload: response });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Erro ao carregar canais de venda',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [filters, toast]);

  // Carregar apenas canais externos
  const loadExternalSalesChannels = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await SalesChannelsAPI.listExternal();
      dispatch({ 
        type: 'SET_SALES_CHANNELS', 
        payload: {
          sales_channels: response.sales_channels,
          total: response.total,
          page: 1,
          per_page: response.total,
          total_pages: 1
        }
      });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Erro ao carregar canais externos',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Criar canal de venda
  const createSalesChannel = useCallback(async (data: SalesChannelCreate) => {
    try {
      const newSalesChannel = await SalesChannelsAPI.create(data);
      dispatch({ type: 'ADD_SALES_CHANNEL', payload: newSalesChannel });
      
      toast({
        title: 'Canal de venda criado',
        description: `${newSalesChannel.name} foi criado com sucesso.`
      });
      
      return newSalesChannel;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar canal de venda',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Atualizar canal de venda
  const updateSalesChannel = useCallback(async (id: number, data: SalesChannelUpdate) => {
    try {
      const updatedSalesChannel = await SalesChannelsAPI.update(id, data);
      dispatch({ type: 'UPDATE_SALES_CHANNEL', payload: updatedSalesChannel });
      
      toast({
        title: 'Canal de venda atualizado',
        description: `${updatedSalesChannel.name} foi atualizado com sucesso.`
      });
      
      return updatedSalesChannel;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar canal de venda',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Deletar canal de venda
  const deleteSalesChannel = useCallback(async (id: number, name: string) => {
    try {
      await SalesChannelsAPI.delete(id);
      dispatch({ type: 'REMOVE_SALES_CHANNEL', payload: id });
      
      toast({
        title: 'Canal de venda removido',
        description: `${name} foi removido com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover canal de venda',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Alternar status (ativar/desativar)
  const toggleSalesChannelStatus = useCallback(async (id: number, isActive: boolean, name: string) => {
    try {
      await SalesChannelsAPI.toggleStatus(id, isActive);
      dispatch({ 
        type: 'TOGGLE_SALES_CHANNEL_STATUS', 
        payload: { id, is_active: isActive } 
      });
      
      toast({
        title: `Canal de venda ${isActive ? 'ativado' : 'desativado'}`,
        description: `${name} foi ${isActive ? 'ativado' : 'desativado'} com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Operações em massa
  const performBulkOperation = useCallback(async (request: BulkOperationRequest) => {
    try {
      const response = await SalesChannelsAPI.bulkOperation(request);
      
      // Atualizar estado baseado na operação
      if (request.operation === 'activate' || request.operation === 'deactivate') {
        const isActive = request.operation === 'activate';
        dispatch({
          type: 'BULK_UPDATE',
          payload: {
            ids: request.channel_ids,
            changes: { is_active: isActive }
          }
        });
      } else if (request.operation === 'delete') {
        // Remover múltiplos itens
        request.channel_ids.forEach(id => {
          dispatch({ type: 'REMOVE_SALES_CHANNEL', payload: id });
        });
      } else if (request.operation === 'update_commission' && request.data?.commission_percentage) {
        dispatch({
          type: 'BULK_UPDATE',
          payload: {
            ids: request.channel_ids,
            changes: { commission_percentage: request.data.commission_percentage }
          }
        });
      }

      toast({
        title: 'Operação realizada com sucesso',
        description: `${response.affected_count} canais foram afetados.`
      });
      
      setSelectedIds([]); // Limpar seleção
      return response;
    } catch (error: any) {
      toast({
        title: 'Erro na operação em massa',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Calcular comissão
  const calculateCommission = useCallback(async (id: number, request: CommissionCalculationRequest) => {
    try {
      const response = await SalesChannelsAPI.calculateCommission(id, request);
      return response;
    } catch (error: any) {
      toast({
        title: 'Erro ao calcular comissão',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Aplicar filtros
  const applyFilters = useCallback((newFilters: SalesChannelsFilters) => {
    setFilters(newFilters);
    loadSalesChannels(newFilters);
  }, [loadSalesChannels]);

  // Limpar filtros
  const clearFilters = useCallback(() => {
    const clearedFilters = { page: 1, per_page: 10 };
    setFilters(clearedFilters);
    loadSalesChannels(clearedFilters);
  }, [loadSalesChannels]);

  // Gerenciar seleção
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(state.salesChannels.map(sc => sc.id));
  }, [state.salesChannels]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadSalesChannels();
  }, [loadSalesChannels]);

  return {
    // Estado
    ...state,
    filters,
    selectedIds,
    
    // Ações
    loadSalesChannels,
    loadExternalSalesChannels,
    createSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    toggleSalesChannelStatus,
    performBulkOperation,
    calculateCommission,
    applyFilters,
    clearFilters,
    
    // Seleção
    toggleSelection,
    selectAll,
    clearSelection,
    
    // Utilitários
    refresh: () => loadSalesChannels(),
    hasMore: state.page < state.total_pages,
    isEmpty: state.salesChannels.length === 0 && !state.loading,
    hasSelected: selectedIds.length > 0,
    selectedCount: selectedIds.length
  };
}

// Hook simplificado para apenas buscar por ID
export function useSalesChannel(id?: number) {
  const [salesChannel, setSalesChannel] = useState<SalesChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSalesChannel = useCallback(async (salesChannelId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const sc = await SalesChannelsAPI.getById(salesChannelId);
      setSalesChannel(sc);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Erro ao carregar canal de venda',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (id) {
      loadSalesChannel(id);
    }
  }, [id, loadSalesChannel]);

  return {
    salesChannel,
    loading,
    error,
    loadSalesChannel,
    refresh: () => id && loadSalesChannel(id)
  };
}