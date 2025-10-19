// frontend/src/hooks/useRoomTypes.ts
import { useState, useCallback, useEffect } from 'react';
import apiClient from '@/lib/api';
import { RoomTypeResponse, RoomTypeFilters } from '@/types/rooms';
import { useToast } from '@/hooks/use-toast';

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

interface RoomTypeStats {
  total_room_types: number;
  bookable_room_types: number;
  total_rooms: number;
  average_capacity: number;
}

export const useRoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState<RoomTypeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomTypeStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Filtros e paginação
  const [filters, setFiltersState] = useState<RoomTypeFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);

  const { toast } = useToast();

  const loadRoomTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        per_page: perPage,
        ...filters,
      };
      
      const response = await apiClient.getRoomTypes(params);
      
      setRoomTypes(response.room_types);
      setPagination({
        total: response.total,
        page: response.page,
        pages: response.pages,
        per_page: response.per_page,
      });
      
      // Calcular estatísticas básicas
      const totalRoomTypes = response.total;
      const bookableCount = response.room_types.filter(rt => rt.is_bookable).length;
      const averageCapacity = response.room_types.length > 0 
        ? response.room_types.reduce((sum, rt) => sum + rt.base_capacity, 0) / response.room_types.length
        : 0;
      
      setStats({
        total_room_types: totalRoomTypes,
        bookable_room_types: bookableCount,
        total_rooms: 0, // Seria necessário chamar API específica
        average_capacity: Math.round(averageCapacity * 10) / 10,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar tipos de quartos:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar tipos de quartos');
      setRoomTypes([]);
      setPagination(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, perPage]);

  const refreshData = useCallback(async () => {
    await loadRoomTypes();
  }, [loadRoomTypes]);

  const setFilters = useCallback((newFilters: Partial<RoomTypeFilters>) => {
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
    setCurrentPage(1); // Reset para primeira página ao mudar itens por página
  }, []);

  // Actions para Room Types
  const toggleBookable = useCallback(async (roomTypeId: number) => {
    try {
      await apiClient.toggleRoomTypeBookable(roomTypeId);
      toast({
        title: "Sucesso",
        description: "Status de reserva alterado com sucesso",
      });
      await refreshData();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao alterar status',
        variant: "destructive",
      });
    }
  }, [toast, refreshData]);

  const deleteRoomType = useCallback(async (roomTypeId: number) => {
    try {
      await apiClient.deleteRoomType(roomTypeId);
      toast({
        title: "Sucesso",
        description: "Tipo de quarto excluído com sucesso",
      });
      await refreshData();
    } catch (error: any) {
      console.error('Erro ao excluir tipo de quarto:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao excluir tipo de quarto',
        variant: "destructive",
      });
      throw error; // Re-throw para tratamento no componente
    }
  }, [toast, refreshData]);

  // Effect para carregar dados quando filtros/página mudam
  useEffect(() => {
    loadRoomTypes();
  }, [loadRoomTypes]);

  return {
    // Data
    roomTypes,
    loading,
    error,
    stats,
    pagination,
    
    // Actions
    loadRoomTypes,
    refreshData,
    setFilters,
    clearFilters,
    setPage,
    setPerPage,
    toggleBookable,
    deleteRoomType,
    
    // Current state
    filters,
    currentPage,
    perPage,
  };
};