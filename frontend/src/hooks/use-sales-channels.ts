// frontend/src/hooks/use-sales-channels.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import salesChannelsAPI, {
  SalesChannelResponse,
  SalesChannelCreate,
  SalesChannelUpdate,
  SalesChannelListResponse,
  SalesChannelFilters
} from '@/lib/api/sales-channels';

interface UseSalesChannelsReturn {
  // Estado
  salesChannels: SalesChannelResponse[];
  loading: boolean;
  error: string | null;
  
  // Paginação
  pagination: {
    total: number;
    page: number;
    pages: number;
    per_page: number;
  };
  
  // Filtros
  filters: SalesChannelFilters;
  currentPage: number;
  perPage: number;
  
  // Ações
  loadSalesChannels: () => Promise<void>;
  refreshData: () => Promise<void>;
  setFilters: (filters: SalesChannelFilters) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  clearFilters: () => void;
  
  // Operações CRUD
  createSalesChannel: (data: SalesChannelCreate) => Promise<SalesChannelResponse | null>;
  updateSalesChannel: (id: number, data: SalesChannelUpdate) => Promise<SalesChannelResponse | null>;
  deleteSalesChannel: (id: number) => Promise<boolean>;
  getSalesChannel: (id: number) => Promise<SalesChannelResponse | null>;
  
  // Operações especiais
  getActiveSalesChannels: () => Promise<SalesChannelResponse[]>;
  getExternalChannels: () => Promise<SalesChannelResponse[]>;
  bulkOperation: (operation: {
    operation: 'activate' | 'deactivate' | 'delete';
    sales_channel_ids: number[];
  }) => Promise<any>;
  updateOrder: (orderData: {
    sales_channel_orders: Array<{ id: number; display_order: number }>;
  }) => Promise<SalesChannelResponse[] | null>;
  calculateCommission: (id: number, data: {
    base_amount: number;
    reservation_data?: any;
  }) => Promise<any>;
  testConnection: (id: number) => Promise<any>;
  setupDefaults: () => Promise<SalesChannelResponse[] | null>;
}

const initialFilters: SalesChannelFilters = {};

export function useSalesChannels(): UseSalesChannelsReturn {
  const [salesChannels, setSalesChannels] = useState<SalesChannelResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<SalesChannelFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    per_page: 20,
  });

  const { toast } = useToast();

  const loadSalesChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await salesChannelsAPI.list({
        page: currentPage,
        per_page: perPage,
        ...filters,
      });
      
      // ✅ CORREÇÃO: Garantir que sempre seja um array
      setSalesChannels(response?.sales_channels || []);
      setPagination({
        total: response?.total || 0,
        page: response?.page || 1,
        pages: response?.pages || 1,
        per_page: response?.per_page || 20,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar canais de venda:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar canais de venda');
      // ✅ CORREÇÃO: Garantir array vazio em caso de erro
      setSalesChannels([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filters]);

  const refreshData = useCallback(async () => {
    await loadSalesChannels();
  }, [loadSalesChannels]);

  const setFilters = useCallback((newFilters: SalesChannelFilters) => {
    setFiltersState(newFilters);
    setCurrentPage(1); // Reset para primeira página quando filtros mudam
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setPerPage = useCallback((newPerPage: number) => {
    setPerPageState(newPerPage);
    setCurrentPage(1); // Reset para primeira página quando per_page muda
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setCurrentPage(1);
  }, []);

  const createSalesChannel = useCallback(async (data: SalesChannelCreate) => {
    try {
      const response = await salesChannelsAPI.create(data);
      
      // Adicionar à lista
      setSalesChannels(prev => [response, ...prev]);
      
      toast({
        title: "Canal de venda criado",
        description: "O canal de venda foi criado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao criar canal de venda:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao criar canal de venda',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const updateSalesChannel = useCallback(async (id: number, data: SalesChannelUpdate) => {
    try {
      const response = await salesChannelsAPI.update(id, data);
      
      // Atualizar na lista
      setSalesChannels(prev => 
        prev.map(channel => 
          channel.id === id ? response : channel
        )
      );
      
      toast({
        title: "Canal de venda atualizado",
        description: "O canal de venda foi atualizado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao atualizar canal de venda:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao atualizar canal de venda',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const deleteSalesChannel = useCallback(async (id: number) => {
    try {
      await salesChannelsAPI.delete(id);
      
      // Remover da lista
      setSalesChannels(prev => prev.filter(channel => channel.id !== id));
      
      toast({
        title: "Canal de venda excluído",
        description: "O canal de venda foi excluído com sucesso.",
      });
      
      return true;
    } catch (err: any) {
      console.error('Erro ao excluir canal de venda:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao excluir canal de venda',
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const getSalesChannel = useCallback(async (id: number) => {
    try {
      const response = await salesChannelsAPI.getById(id);
      return response;
    } catch (err: any) {
      console.error('Erro ao buscar canal de venda:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao buscar canal de venda',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const getActiveSalesChannels = useCallback(async () => {
    try {
      const response = await salesChannelsAPI.getActive();
      return response;
    } catch (err: any) {
      console.error('Erro ao buscar canais ativos:', err);
      return [];
    }
  }, []);

  const getExternalChannels = useCallback(async () => {
    try {
      const response = await salesChannelsAPI.getExternal();
      return response;
    } catch (err: any) {
      console.error('Erro ao buscar canais externos:', err);
      return [];
    }
  }, []);

  const bulkOperation = useCallback(async (operation: {
    operation: 'activate' | 'deactivate' | 'delete';
    sales_channel_ids: number[];
  }) => {
    try {
      const response = await salesChannelsAPI.bulkOperation(operation);
      
      // Recarregar dados após operação em massa
      await loadSalesChannels();
      
      toast({
        title: "Operação realizada",
        description: `${operation.operation} executado com sucesso em ${operation.sales_channel_ids.length} canal(is).`,
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro na operação em massa:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro na operação em massa',
        variant: "destructive",
      });
      return null;
    }
  }, [loadSalesChannels, toast]);

  const updateOrder = useCallback(async (orderData: {
    sales_channel_orders: Array<{ id: number; display_order: number }>;
  }) => {
    try {
      const response = await salesChannelsAPI.updateOrder(orderData);
      
      // Atualizar lista com nova ordem
      setSalesChannels(response);
      
      toast({
        title: "Ordem atualizada",
        description: "A ordem dos canais de venda foi atualizada com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao atualizar ordem:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao atualizar ordem',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const calculateCommission = useCallback(async (id: number, data: {
    base_amount: number;
    reservation_data?: any;
  }) => {
    try {
      const response = await salesChannelsAPI.calculateCommission(id, data);
      return response;
    } catch (err: any) {
      console.error('Erro ao calcular comissão:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao calcular comissão',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const testConnection = useCallback(async (id: number) => {
    try {
      const response = await salesChannelsAPI.testConnection(id);
      
      toast({
        title: response.success ? "Conexão bem-sucedida" : "Falha na conexão",
        description: response.message,
        variant: response.success ? "default" : "destructive",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao testar conexão:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao testar conexão',
        variant: "destructive",
      });
      return { success: false, message: 'Erro ao testar conexão' };
    }
  }, [toast]);

  const setupDefaults = useCallback(async () => {
    try {
      const response = await salesChannelsAPI.setupDefaults();
      
      // Adicionar canais padrão à lista
      setSalesChannels(response);
      
      toast({
        title: "Canais padrão criados",
        description: `${response.length} canal(is) de venda padrão foram criados com sucesso.`,
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao criar canais padrão:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao criar canais padrão',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Carregar dados inicial
  useEffect(() => {
    loadSalesChannels();
  }, [loadSalesChannels]);

  return {
    salesChannels,
    loading,
    error,
    pagination,
    filters,
    currentPage,
    perPage,
    loadSalesChannels,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    clearFilters,
    createSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    getSalesChannel,
    getActiveSalesChannels,
    getExternalChannels,
    bulkOperation,
    updateOrder,
    calculateCommission,
    testConnection,
    setupDefaults,
  };
}