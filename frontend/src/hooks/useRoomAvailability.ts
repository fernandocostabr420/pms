// frontend/src/hooks/useRoomAvailability.ts
import { useState, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api';
import {
  RoomAvailabilityResponse,
  RoomAvailabilityFilters,
  RoomAvailabilityCreate,
  RoomAvailabilityUpdate,
  BulkAvailabilityUpdate,
  AvailabilityStatsResponse,
  CalendarAvailabilityRequest,
  CalendarAvailabilityResponse,
} from '@/types/room-availability';
import { useToast } from '@/hooks/use-toast';

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export const useRoomAvailability = () => {
  const [availabilities, setAvailabilities] = useState<RoomAvailabilityResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AvailabilityStatsResponse | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Filtros e paginação
  const [filters, setFiltersState] = useState<RoomAvailabilityFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);

  const { toast } = useToast();

  const loadAvailabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        per_page: perPage,
        ...filters,
      };
      
      const response = await apiClient.getRoomAvailabilities(params);
      
      setAvailabilities(response.availabilities);
      setPagination({
        total: response.total,
        page: response.page,
        pages: response.pages,
        per_page: response.per_page,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar disponibilidades:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar disponibilidades');
      setAvailabilities([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, perPage]);

  const loadStats = useCallback(async (statsFilters?: {
    date_from?: string;
    date_to?: string;
    property_id?: number;
  }) => {
    try {
      const statsData = await apiClient.getAvailabilityStats(statsFilters);
      setStats(statsData);
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
      setStats(null);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadAvailabilities();
    await loadStats();
  }, [loadAvailabilities, loadStats]);

  const setFilters = useCallback((newFilters: Partial<RoomAvailabilityFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset para primeira página ao filtrar
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setCurrentPage(1);
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setPerPage = useCallback((newPerPage: number) => {
    setPerPageState(newPerPage);
    setCurrentPage(1); // Reset para primeira página ao alterar quantidade por página
  }, []);

  // CRUD Operations
  const createAvailability = useCallback(async (data: RoomAvailabilityCreate) => {
    try {
      const newAvailability = await apiClient.createRoomAvailability(data);
      
      toast({
        title: "Sucesso!",
        description: "Disponibilidade criada com sucesso.",
      });
      
      await refreshData();
      return newAvailability;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao criar disponibilidade';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [refreshData, toast]);

  const updateAvailability = useCallback(async (id: number, data: RoomAvailabilityUpdate) => {
    try {
      const updatedAvailability = await apiClient.updateRoomAvailability(id, data);
      
      toast({
        title: "Sucesso!",
        description: "Disponibilidade atualizada com sucesso.",
      });
      
      await refreshData();
      return updatedAvailability;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao atualizar disponibilidade';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [refreshData, toast]);

  const deleteAvailability = useCallback(async (id: number) => {
    try {
      await apiClient.deleteRoomAvailability(id);
      
      toast({
        title: "Sucesso!",
        description: "Disponibilidade removida com sucesso.",
      });
      
      await refreshData();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao remover disponibilidade';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [refreshData, toast]);

  const bulkUpdate = useCallback(async (data: BulkAvailabilityUpdate) => {
    try {
      const result = await apiClient.bulkUpdateAvailability(data);
      
      toast({
        title: "Sucesso!",
        description: `${result.updated} disponibilidades atualizadas, ${result.created} criadas.`,
      });
      
      await refreshData();
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro na atualização em massa';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [refreshData, toast]);

  // Calendar operations
  const getRoomCalendar = useCallback(async (
    roomId: number, 
    dateFrom: string, 
    dateTo: string
  ) => {
    try {
      return await apiClient.getRoomCalendar(roomId, dateFrom, dateTo);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao carregar calendário';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [toast]);

  const getCalendarRange = useCallback(async (request: CalendarAvailabilityRequest) => {
    try {
      return await apiClient.getCalendarRange(request);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao carregar período';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [toast]);

  const checkAvailability = useCallback(async (
    roomId: number,
    checkInDate: string,
    checkOutDate: string
  ) => {
    try {
      return await apiClient.checkRoomAvailability(roomId, checkInDate, checkOutDate);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao verificar disponibilidade';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [toast]);

  // Auto-load on mount
  useEffect(() => {
    loadAvailabilities();
    loadStats();
  }, [loadAvailabilities, loadStats]);

  return {
    // State
    availabilities,
    loading,
    error,
    stats,
    pagination,
    filters,
    currentPage,
    perPage,
    
    // Actions
    loadAvailabilities,
    loadStats,
    refreshData,
    setFilters,
    clearFilters,
    setPage,
    setPerPage,
    
    // CRUD
    createAvailability,
    updateAvailability,
    deleteAvailability,
    bulkUpdate,
    
    // Calendar
    getRoomCalendar,
    getCalendarRange,
    checkAvailability,
  };
};