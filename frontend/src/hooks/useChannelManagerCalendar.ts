// frontend/src/hooks/useChannelManagerCalendar.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { channelManagerAPI } from '@/services/channelManagerApi';
import {
  AvailabilityCalendarResponse,
  ChannelManagerFilters,
  CalendarUIState,
  BulkEditState,
  SimpleAvailabilityView,
  PendingCountResponse,
  PendingDateRangeResponse
} from '@/types/channel-manager';

interface UseChannelManagerCalendarProps {
  initialDateRange?: {
    from: Date;
    to: Date;
  };
  propertyId?: number;
  roomIds?: number[];
  autoRefresh?: boolean;
  refreshInterval?: number; // em segundos
}

interface UseChannelManagerCalendarReturn {
  // Dados
  data: AvailabilityCalendarResponse | null;
  loading: boolean;
  error: string | null;
  
  // Estado da UI
  uiState: CalendarUIState;
  bulkEditState: BulkEditState;
  
  // Controles de data
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  
  // Filtros
  filters: ChannelManagerFilters;
  setFilters: (filters: ChannelManagerFilters) => void;
  
  // Ações de edição
  updateCell: (roomId: number, date: string, field: string, value: any) => Promise<void>;
  startBulkEdit: () => void;
  updateBulkEditState: (updates: Partial<BulkEditState>) => void;
  executeBulkEdit: () => Promise<void>;
  
  // 🆕 Sincronização Manual
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pendingCount: number;
  dateRangeInfo: PendingDateRangeResponse | null;
  syncWithWuBook: () => Promise<void>;
  
  // Utilidades
  refresh: () => Promise<void>;
  getAvailabilityByRoomDate: (roomId: number, date: string) => SimpleAvailabilityView | null;
  calculateStats: () => {
    totalCells: number;
    availableRooms: number;
    blockedRooms: number;
    syncRate: number;
  };
}

export function useChannelManagerCalendar({
  initialDateRange,
  propertyId,
  roomIds,
  autoRefresh = false,
  refreshInterval = 30
}: UseChannelManagerCalendarProps = {}): UseChannelManagerCalendarReturn {
  
  // ============== ESTADO PRINCIPAL ==============
  
  const [data, setData] = useState<AvailabilityCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Configurar range inicial - próximos 14 dias por padrão
  const getDefaultDateRange = () => {
    const today = new Date();
    return {
      from: initialDateRange?.from || today,
      to: initialDateRange?.to || addDays(today, 13)
    };
  };
  
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [filters, setFilters] = useState<ChannelManagerFilters>({
    property_id: propertyId,
    room_ids: roomIds
  });
  
  // ============== ESTADO DA UI ==============
  
  const [uiState, setUIState] = useState<CalendarUIState>({
    selectedRooms: [],
    viewMode: 'calendar',
    showFilters: false,
    showBulkEdit: false
  });
  
  const [bulkEditState, setBulkEditState] = useState<BulkEditState>({
    isOpen: false,
    step: 1,
    scope: {
      dateRange: { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') },
      roomIds: []
    },
    actions: {}
  });
  
  // ============== 🆕 SINCRONIZAÇÃO MANUAL ==============
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [dateRangeInfo, setDateRangeInfo] = useState<PendingDateRangeResponse | null>(null);
  
  // ============== REFS ==============
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingCountIntervalRef = useRef<NodeJS.Timeout>();
  const lastFetchParamsRef = useRef<string>('');
  
  // ============== FETCH DATA ==============
  
  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const params = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        property_id: filters.property_id,
        room_ids: filters.room_ids,
        include_sync_status: true,
        include_restrictions: true
      };
      
      // Evitar chamadas duplicadas
      const paramsString = JSON.stringify(params);
      if (paramsString === lastFetchParamsRef.current && data) {
        return;
      }
      lastFetchParamsRef.current = paramsString;
      
      const response = await channelManagerAPI.getAvailabilityCalendar(params);
      setData(response);
      
    } catch (err: any) {
      console.error('Erro ao carregar dados do calendário:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar dados do calendário');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [dateRange.from, dateRange.to, filters, data]);
  
  // ============== 🆕 POLLING DE PENDENTES ==============
  
  const fetchPendingCount = useCallback(async () => {
    try {
      const result = await channelManagerAPI.getPendingCount(filters.property_id);
      setPendingCount(result.total_pending);
    } catch (err) {
      console.error('Erro ao buscar contagem de pendentes:', err);
      // Não exibir erro ao usuário - apenas log
    }
  }, [filters.property_id]);
  
  const fetchDateRangeInfo = useCallback(async () => {
    try {
      if (pendingCount > 0) {
        const result = await channelManagerAPI.getPendingDateRange(filters.property_id);
        setDateRangeInfo(result);
      } else {
        setDateRangeInfo(null);
      }
    } catch (err) {
      console.error('Erro ao buscar intervalo de datas pendentes:', err);
      setDateRangeInfo(null);
    }
  }, [pendingCount, filters.property_id]);
  
  // ============== EFEITOS ==============
  
  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // 🆕 Polling de pendentes a cada 5 segundos
  useEffect(() => {
    // Buscar imediatamente
    fetchPendingCount();
    
    // Configurar polling
    pendingCountIntervalRef.current = setInterval(() => {
      fetchPendingCount();
    }, 5000); // 5 segundos
    
    return () => {
      if (pendingCountIntervalRef.current) {
        clearInterval(pendingCountIntervalRef.current);
      }
    };
  }, [fetchPendingCount]);
  
  // 🆕 Buscar intervalo quando pendingCount mudar
  useEffect(() => {
    if (pendingCount > 0) {
      fetchDateRangeInfo();
    } else {
      setDateRangeInfo(null);
    }
  }, [pendingCount, fetchDateRangeInfo]);
  
  // Auto refresh do calendário
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimeoutRef.current = setInterval(() => {
        fetchData(false); // refresh silencioso
      }, refreshInterval * 1000);
      
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchData]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
      if (pendingCountIntervalRef.current) {
        clearInterval(pendingCountIntervalRef.current);
      }
    };
  }, []);
  
  // ============== CONTROLES DE DATA ==============
  
  const goToPreviousWeek = useCallback(() => {
    setDateRange(prev => ({
      from: addDays(prev.from, -7),
      to: addDays(prev.to, -7)
    }));
  }, []);
  
  const goToNextWeek = useCallback(() => {
    setDateRange(prev => ({
      from: addDays(prev.from, 7),
      to: addDays(prev.to, 7)
    }));
  }, []);
  
  const goToToday = useCallback(() => {
    const today = new Date();
    const newFrom = startOfWeek(today, { weekStartsOn: 1 }); // Segunda-feira
    setDateRange({
      from: newFrom,
      to: addDays(newFrom, 13) // 2 semanas
    });
  }, []);
  
  // ============== EDIÇÃO ==============
  
  const updateCell = useCallback(async (roomId: number, date: string, field: string, value: any) => {
    try {
      await channelManagerAPI.updateAvailabilityCell({ room_id: roomId, date, field, value });
      
      // Atualizar dados localmente (optimistic update)
      if (data) {
        const updatedData = { ...data };
        const dayData = updatedData.calendar_data.find(d => d.date === date);
        if (dayData) {
          const availability = dayData.availabilities.find(a => a.room_id === roomId);
          if (availability) {
            (availability as any)[field] = value;
            setData(updatedData);
          }
        }
      }
      
      // Refresh completo após um tempo
      setTimeout(() => fetchData(false), 1000);
      
    } catch (error) {
      console.error('Erro ao atualizar célula:', error);
      throw error;
    }
  }, [data, fetchData]);
  
  const startBulkEdit = useCallback(() => {
    setBulkEditState(prev => ({
      ...prev,
      isOpen: true,
      step: 1,
      scope: {
        dateRange: { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') },
        roomIds: uiState.selectedRooms.length > 0 ? uiState.selectedRooms : data?.rooms_summary.map(r => r.room_id) || []
      }
    }));
  }, [dateRange, uiState.selectedRooms, data]);
  
  const updateBulkEditState = useCallback((updates: Partial<BulkEditState>) => {
    setBulkEditState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const executeBulkEdit = useCallback(async () => {
    try {
      const { scope, actions } = bulkEditState;
      
      const bulkData = {
        room_ids: scope.roomIds,
        date_from: scope.dateRange.from,
        date_to: scope.dateRange.to,
        ...(actions.priceAction === 'set' && { rate_override: actions.priceValue }),
        ...(actions.availabilityAction === 'open' && { is_available: true }),
        ...(actions.availabilityAction === 'close' && { is_available: false }),
        ...(actions.restrictions?.minStay && { min_stay: actions.restrictions.minStay }),
        ...(actions.restrictions?.closedToArrival !== undefined && { closed_to_arrival: actions.restrictions.closedToArrival }),
        ...(actions.restrictions?.closedToDeparture !== undefined && { closed_to_departure: actions.restrictions.closedToDeparture })
        // ❌ REMOVIDO: sync_immediately
      };
      
      await channelManagerAPI.bulkUpdateAvailability(bulkData);
      
      // Fechar modal e atualizar dados
      setBulkEditState(prev => ({ ...prev, isOpen: false }));
      await fetchData();
      
      // ✅ Após bulk edit, o sistema marca automaticamente para sync
      // O polling atualizará o pendingCount automaticamente
      
    } catch (error) {
      console.error('Erro na edição em massa:', error);
      throw error;
    }
  }, [bulkEditState, fetchData]);
  
  // ============== 🆕 SINCRONIZAÇÃO MANUAL ==============
  
  const syncWithWuBook = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      
      const result = await channelManagerAPI.syncWithWuBook({
        property_id: filters.property_id,
        force_all: false, // Apenas pendentes
        async_processing: false, // Síncrono
        batch_size: 100
      });
      
      if (result.status === 'success' || result.status === 'completed') {
        setSyncStatus('success');
        
        // Zerar contador imediatamente
        setPendingCount(0);
        setDateRangeInfo(null);
        
        // Refresh do calendário após sincronização
        setTimeout(() => fetchData(false), 2000);
      } else {
        setSyncStatus('error');
      }
      
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncStatus('error');
    } finally {
      // Reset status após 3 segundos
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [filters.property_id, fetchData]);
  
  // ============== UTILIDADES ==============
  
  const refresh = useCallback(() => fetchData(), [fetchData]);
  
  const getAvailabilityByRoomDate = useCallback((roomId: number, date: string): SimpleAvailabilityView | null => {
    if (!data) return null;
    
    const dayData = data.calendar_data.find(d => d.date === date);
    return dayData?.availabilities.find(a => a.room_id === roomId) || null;
  }, [data]);
  
  const calculateStats = useCallback(() => {
    if (!data) {
      return { totalCells: 0, availableRooms: 0, blockedRooms: 0, syncRate: 0 };
    }
    
    const totalCells = data.calendar_data.reduce((acc, day) => acc + day.availabilities.length, 0);
    const availableRooms = data.calendar_data.reduce((acc, day) => acc + day.summary.available_rooms, 0);
    const blockedRooms = data.calendar_data.reduce((acc, day) => acc + day.summary.blocked_rooms, 0);
    const syncRate = data.statistics.sync_rate;
    
    return { totalCells, availableRooms, blockedRooms, syncRate };
  }, [data]);
  
  // ============== UPDATE UI STATE ==============
  
  const updateUIState = useCallback((updates: Partial<CalendarUIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // ============== RETURN ==============
  
  return {
    // Dados
    data,
    loading,
    error,
    
    // Estado da UI
    uiState,
    bulkEditState,
    
    // Controles de data
    dateRange,
    setDateRange,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    
    // Filtros
    filters,
    setFilters,
    
    // Ações de edição
    updateCell,
    startBulkEdit,
    updateBulkEditState,
    executeBulkEdit,
    
    // 🆕 Sincronização Manual
    syncStatus,
    pendingCount,
    dateRangeInfo,
    syncWithWuBook,
    
    // Utilidades
    refresh,
    getAvailabilityByRoomDate,
    calculateStats
  };
}