// frontend/src/hooks/useChannelManagerCalendar.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { channelManagerAPI } from '@/services/channelManagerApi';
import { useServerSentEvents } from '@/hooks/useServerSentEvents';
import {
  AvailabilityCalendarResponse,
  ChannelManagerFilters,
  CalendarUIState,
  BulkEditState,
  SimpleAvailabilityView,
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
  
  // Sincronização Manual (com SSE)
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pendingCount: number;
  dateRangeInfo: PendingDateRangeResponse | null;
  syncWithWuBook: () => Promise<void>;
  
  // Status da conexão SSE
  sseConnected: boolean;
  
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
  
  // ============== SINCRONIZAÇÃO MANUAL ==============
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [dateRangeInfo, setDateRangeInfo] = useState<PendingDateRangeResponse | null>(null);
  
  // ============== SSE (SUBSTITUINDO POLLING) ==============
  
  const { connectionState, lastEvent, isConnected } = useServerSentEvents({
    onError: (error) => {
      console.error('❌ SSE error:', error);
    },
    onConnected: () => {
      console.log('✅ SSE conectado - monitorando pendentes de sincronização');
      fetchPendingCount();
    },
  });
  
  // ============== REFS ==============
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchParamsRef = useRef<string>('');
  
  // ============== FETCH DATA ==============
  
  /**
   * Busca dados do calendário de disponibilidade
   * ✅ Suporta todos os campos: rate, availability, min_stay, closed_to_arrival, closed_to_departure
   */
  const fetchData = useCallback(async (showLoading = true, force = false) => {
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
      
      const paramsString = JSON.stringify(params);
      if (!force && paramsString === lastFetchParamsRef.current) {
        if (showLoading) setLoading(false);
        console.log('⏭️ FetchData: Parâmetros idênticos, pulando busca');
        return;
      }
      lastFetchParamsRef.current = paramsString;
      
      console.log(`🔄 FetchData: Buscando dados do calendário (force=${force})...`);
      const response = await channelManagerAPI.getAvailabilityCalendar(params);
      setData(response);
      console.log(`✅ FetchData: ${response.calendar_data.length} dias carregados`);
      
    } catch (err: any) {
      console.error('❌ Erro ao carregar dados do calendário:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar dados do calendário');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [dateRange.from, dateRange.to, filters.property_id, filters.room_ids]);
  
  // ============== BUSCAR CONTAGEM DE PENDENTES ==============
  
  const fetchPendingCount = useCallback(async () => {
    try {
      const result = await channelManagerAPI.getPendingCount(filters.property_id);
      const count = filters.property_id 
        ? result.by_property?.[filters.property_id] || 0
        : result.total_pending;
      setPendingCount(count);
      console.log(`📊 Contagem de pendentes atualizada: ${count}`);
    } catch (err) {
      console.error('❌ Erro ao buscar contagem de pendentes:', err);
      setPendingCount(0);
    }
  }, [filters.property_id]);
  
  // ============== BUSCAR INTERVALO DE DATAS PENDENTES ==============
  
  const fetchDateRangeInfo = useCallback(async () => {
    try {
      if (pendingCount > 0) {
        const result = await channelManagerAPI.getPendingDateRange(filters.property_id);
        setDateRangeInfo(result);
        console.log('📅 Intervalo de datas pendentes:', result);
      } else {
        setDateRangeInfo(null);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar intervalo de datas pendentes:', err);
      setDateRangeInfo(null);
    }
  }, [pendingCount, filters.property_id]);
  
  // ============== EFEITOS ==============
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);
  
  // Escutar eventos SSE
  useEffect(() => {
    if (!lastEvent) return;
    
    switch (lastEvent.type) {
      case 'sync_pending_updated':
        const propertyCount = filters.property_id 
          ? lastEvent.data.by_property?.[filters.property_id] || 0
          : lastEvent.data.total;
        
        setPendingCount(propertyCount);
        console.log(`📊 Pendentes atualizados via SSE: ${propertyCount}`);
        break;
        
      case 'sync_completed':
        console.log('✅ Sincronização concluída via SSE');
        setPendingCount(0);
        setDateRangeInfo(null);
        setSyncStatus('success');
        
        setTimeout(() => fetchData(false, true), 1000);
        setTimeout(() => setSyncStatus('idle'), 3000);
        break;
        
      case 'bulk_update_completed':
        console.log('✅ Bulk update concluído via SSE');
        fetchPendingCount();
        setTimeout(() => fetchData(false, true), 1000);
        break;
        
      case 'availability_updated':
        console.log('🔄 Disponibilidade atualizada via SSE');
        fetchPendingCount();
        setTimeout(() => fetchData(false, true), 2000);
        break;
    }
  }, [lastEvent, filters.property_id, fetchData, fetchPendingCount]);
  
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
        fetchData(false);
      }, refreshInterval * 1000);
      
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchData]);
  
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
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
    const newFrom = startOfWeek(today, { weekStartsOn: 1 });
    setDateRange({
      from: newFrom,
      to: addDays(newFrom, 13)
    });
  }, []);
  
  // ============== EDIÇÃO ==============
  
  /**
   * ✅ Atualiza uma célula individual
   * Suporta TODOS os campos: rate, is_available, min_stay, closed_to_arrival, closed_to_departure
   */
  const updateCell = useCallback(async (roomId: number, date: string, field: string, value: any) => {
    try {
      console.log(`📝 Atualizando célula: room=${roomId}, date=${date}, field=${field}, value=${value}`);
      
      await channelManagerAPI.updateAvailabilityCell({ 
        room_id: roomId, 
        date, 
        field, 
        value 
      });
      
      // Atualizar dados localmente (optimistic update)
      setData(prevData => {
        if (!prevData) return prevData;
        
        const updatedData = { ...prevData };
        const dayData = updatedData.calendar_data.find(d => d.date === date);
        if (dayData) {
          const availability = dayData.availabilities.find(a => a.room_id === roomId);
          if (availability) {
            (availability as any)[field] = value;
          }
        }
        return updatedData;
      });
      
      console.log('📊 Atualizando contagem de pendentes após updateCell...');
      fetchPendingCount();
      
      console.log('🔄 Agendando refresh forçado após updateCell...');
      setTimeout(() => fetchData(false, true), 1000);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar célula:', error);
      throw error;
    }
  }, [fetchData, fetchPendingCount]);
  
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
  
  /**
   * ✅ Executa edição em massa
   * Suporta TODOS os campos incluindo closed_to_arrival e closed_to_departure
   */
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
      };
      
      console.log('🚀 Executando bulk edit:', bulkData);
      
      const result = await channelManagerAPI.bulkUpdateAvailability(bulkData);
      
      console.log('✅ Bulk edit concluído:', result);
      
      console.log('📊 Buscando contagem real de pendentes após bulk edit...');
      await fetchPendingCount();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setBulkEditState(prev => ({ ...prev, isOpen: false }));
      
      console.log('🔄 Forçando refresh imediato do calendário após bulk edit...');
      await fetchData(false, true);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Erro na edição em massa:', error);
      
      throw new Error(
        error.response?.data?.detail || 
        error.message || 
        'Erro desconhecido ao executar bulk edit'
      );
    }
  }, [bulkEditState, fetchData, fetchPendingCount]);
  
  // ============== SINCRONIZAÇÃO MANUAL ==============
  
  const syncWithWuBook = useCallback(async () => {
    if (pendingCount === 0) {
      console.warn('⚠️ Nenhum registro pendente para sincronizar');
      return;
    }
    
    try {
      setSyncStatus('syncing');
      console.log(`🔄 Iniciando sincronização de ${pendingCount} registros...`);
      
      const result = await channelManagerAPI.syncWithWuBook({
        property_id: filters.property_id,
        force_all: false,
        async_processing: true,
        batch_size: 100
      });
      
      console.log('📦 Resposta da sincronização:', result);
      
      if (result.status === 'success' || result.status === 'partial_success' || result.status === 'error') {
        console.log('✅ Processamento SÍNCRONO detectado - resultado imediato');
        
        if (result.status === 'success' || result.status === 'partial_success') {
          setSyncStatus('success');
          setPendingCount(0);
          setDateRangeInfo(null);
          
          console.log('🔄 Forçando refresh do calendário após sincronização síncrona...');
          setTimeout(() => fetchData(false, true), 500);
          
          setTimeout(() => {
            setSyncStatus('idle');
            console.log('✅ Status resetado para idle');
          }, 3000);
          
        } else {
          setSyncStatus('error');
          console.error('❌ Sincronização falhou:', result.message);
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
        
      } else {
        console.log('🎯 Processamento ASSÍNCRONO detectado - aguardando SSE...');
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      throw new Error(
        error.response?.data?.detail || 
        error.message || 
        'Não foi possível sincronizar com WuBook'
      );
    }
  }, [filters.property_id, pendingCount, fetchData]);
  
  // ============== UTILIDADES ==============
  
  const refresh = useCallback(() => {
    console.log('🔄 Refresh manual solicitado (force=true)');
    fetchData(true, true);
    fetchPendingCount();
  }, [fetchData, fetchPendingCount]);
  
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
  
  // ============== RETURN ==============
  
  return {
    data,
    loading,
    error,
    uiState,
    bulkEditState,
    dateRange,
    setDateRange,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    filters,
    setFilters,
    updateCell,
    startBulkEdit,
    updateBulkEditState,
    executeBulkEdit,
    syncStatus,
    pendingCount,
    dateRangeInfo,
    syncWithWuBook,
    sseConnected: isConnected,
    refresh,
    getAvailabilityByRoomDate,
    calculateStats
  };
}