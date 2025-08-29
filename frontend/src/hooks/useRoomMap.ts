// frontend/src/hooks/useRoomMap.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addDays, format } from 'date-fns';
import apiClient from '@/lib/api';
import { 
  MapResponse, 
  MapStatsResponse, 
  MapFilters,
  MapBulkOperation,
  MapQuickBooking
} from '@/types/room-map';
import { useToast } from '@/hooks/use-toast';

interface UseRoomMapOptions {
  initialDays?: number;
  defaultPropertyId?: number;
}

export function useRoomMap(options: UseRoomMapOptions = {}) {
  const { initialDays = 31, defaultPropertyId } = options;
  const { toast } = useToast();

  // Estados
  const [mapData, setMapData] = useState<MapResponse | null>(null);
  const [stats, setStats] = useState<MapStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [filters, setFilters] = useState<MapFilters>(() => ({
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), initialDays), 'yyyy-MM-dd'),
    property_id: defaultPropertyId,
    include_out_of_order: true,
    include_cancelled: false,
  }));

  // Função para carregar dados do mapa
  const loadMapData = useCallback(async (customFilters?: Partial<MapFilters>) => {
    const activeFilters = { ...filters, ...customFilters };
    
    try {
      setLoading(true);
      setError(null);

      const [mapResponse, statsResponse] = await Promise.all([
        apiClient.getMapData(activeFilters),
        apiClient.getMapStats(
          activeFilters.start_date,
          activeFilters.end_date,
          activeFilters.property_id
        )
      ]);

      setMapData(mapResponse);
      setStats(statsResponse);

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Erro ao carregar dados do mapa';
      setError(errorMessage);
      console.error('Erro ao carregar mapa:', err);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // ✅ CORREÇÃO: useEffect com formatação correta
  useEffect(() => {
    loadMapData();
  }, [filters.start_date, filters.end_date, filters.property_id, filters.include_out_of_order, filters.include_cancelled, toast]);

  // Atualizar filtros
  const updateFilters = useCallback((newFilters: Partial<MapFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // ✅ CORREÇÃO: Operação em lote sem dependência circular
  const executeBulkOperation = useCallback(async (operation: MapBulkOperation) => {
    try {
      setLoading(true);
      await apiClient.executeBulkOperation(operation);
      
      toast({
        title: "Sucesso",
        description: "Operação executada com sucesso",
      });

      // Recarregar dados diretamente sem callback
      const activeFilters = filters;
      const [mapResponse, statsResponse] = await Promise.all([
        apiClient.getMapData(activeFilters),
        apiClient.getMapStats(
          activeFilters.start_date,
          activeFilters.end_date,
          activeFilters.property_id
        )
      ]);
      setMapData(mapResponse);
      setStats(statsResponse);

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao executar operação';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // ✅ CORREÇÃO: Reserva rápida sem dependência circular
  const createQuickBooking = useCallback(async (booking: MapQuickBooking) => {
    try {
      setLoading(true);
      const result = await apiClient.createQuickBooking(booking);
      
      toast({
        title: "Sucesso",
        description: "Reserva criada com sucesso",
      });

      // Recarregar dados diretamente sem callback
      const activeFilters = filters;
      const [mapResponse, statsResponse] = await Promise.all([
        apiClient.getMapData(activeFilters),
        apiClient.getMapStats(
          activeFilters.start_date,
          activeFilters.end_date,
          activeFilters.property_id
        )
      ]);
      setMapData(mapResponse);
      setStats(statsResponse);
      
      return result;

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao criar reserva';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // ✅ CORREÇÃO: Refresh manual sem dependência circular
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const activeFilters = filters;
      const [mapResponse, statsResponse] = await Promise.all([
        apiClient.getMapData(activeFilters),
        apiClient.getMapStats(
          activeFilters.start_date,
          activeFilters.end_date,
          activeFilters.property_id
        )
      ]);
      setMapData(mapResponse);
      setStats(statsResponse);
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao carregar dados';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // Gerar cabeçalhos de data para exibição
  const dateHeaders = useMemo(() => {
    if (!mapData?.date_headers) return [];
    
    return mapData.date_headers.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        date: dateStr,
        dayOfWeek: format(date, 'EEE'),
        dayOfMonth: format(date, 'd'),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      };
    });
  }, [mapData]);

  // Calcular range de datas baseado nos filtros
  const dateRange = useMemo(() => {
    const startDate = new Date(filters.start_date + 'T00:00:00');
    const endDate = new Date(filters.end_date + 'T00:00:00');
    
    return {
      startDate,
      endDate
    };
  }, [filters.start_date, filters.end_date]);

  return {
    // Dados
    mapData,
    stats,
    dateHeaders,
    dateRange,
    
    // Estado
    loading,
    error,
    filters,
    
    // Ações
    loadMapData,
    refreshData,
    updateFilters,
    executeBulkOperation,
    createQuickBooking,
  };
}