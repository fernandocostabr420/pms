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
  
  // 🆕 Sincronização Manual (com SSE)
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pendingCount: number;
  dateRangeInfo: PendingDateRangeResponse | null;
  syncWithWuBook: () => Promise<void>;
  
  // 🆕 Status da conexão SSE
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
  
  // ============== 🆕 SINCRONIZAÇÃO MANUAL ==============
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [dateRangeInfo, setDateRangeInfo] = useState<PendingDateRangeResponse | null>(null);
  
  // ============== 🆕 SSE (SUBSTITUINDO POLLING) ==============
  
  const { connectionState, lastEvent, isConnected } = useServerSentEvents({
    onError: (error) => {
      console.error('SSE error:', error);
    },
    onConnected: () => {
      console.log('SSE conectado - monitorando pendentes de sincronização');
      // ✅ NOVO: Buscar contagem inicial quando conectar
      fetchPendingCount();
    },
  });
  
  // ============== REFS ==============
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchParamsRef = useRef<string>('');
  
  // ============== FETCH DATA ==============
  
  /**
   * Busca dados do calendário de disponibilidade
   * 
   * @param showLoading - Se deve mostrar indicador de loading (padrão: true)
   * @param force - Se deve forçar busca mesmo com parâmetros idênticos (padrão: false)
   *                Use force=true quando souber que os dados mudaram no backend
   *                mas os parâmetros de busca são os mesmos (ex: após bulk edit)
   */
  // ✅ CORRIGIDO: Removido 'data' das dependências para evitar loop infinito
  // ✅ CORRIGIDO: Adicionado parâmetro 'force' para forçar refresh mesmo com params iguais
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
      
      // ✅ CORRIGIDO: Evitar chamadas duplicadas (exceto quando force=true)
      const paramsString = JSON.stringify(params);
      if (!force && paramsString === lastFetchParamsRef.current) {
        if (showLoading) setLoading(false);
        console.log('⏭️ FetchData: Parâmetros idênticos, pulando busca (use force=true para forçar)');
        return;
      }
      lastFetchParamsRef.current = paramsString;
      
      console.log(`🔄 FetchData: Buscando dados do calendário (force=${force})...`);
      const response = await channelManagerAPI.getAvailabilityCalendar(params);
      setData(response);
      console.log(`✅ FetchData: ${response.calendar_data.length} dias carregados`);
      
    } catch (err: any) {
      console.error('Erro ao carregar dados do calendário:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar dados do calendário');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [dateRange.from, dateRange.to, filters.property_id, filters.room_ids]);
  
  // ============== 🆕 BUSCAR CONTAGEM DE PENDENTES ==============
  
  const fetchPendingCount = useCallback(async () => {
    try {
      const result = await channelManagerAPI.getPendingCount(filters.property_id);
      const count = filters.property_id 
        ? result.by_property?.[filters.property_id] || 0
        : result.total_pending;
      setPendingCount(count);
      console.log(`📊 Contagem inicial de pendentes: ${count}`);
    } catch (err) {
      console.error('Erro ao buscar contagem de pendentes:', err);
      setPendingCount(0);
    }
  }, [filters.property_id]);
  
  // ============== 🆕 BUSCAR INTERVALO DE DATAS PENDENTES ==============
  
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
  
  // ✅ NOVO: Buscar contagem inicial de pendentes ao montar
  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);
  
  // 🆕 Escutar eventos SSE (SUBSTITUI O POLLING)
  useEffect(() => {
    if (!lastEvent) return;
    
    switch (lastEvent.type) {
      case 'sync_pending_updated':
        // Atualizar contagem de pendentes em tempo real
        const propertyCount = filters.property_id 
          ? lastEvent.data.by_property?.[filters.property_id] || 0
          : lastEvent.data.total;
        
        setPendingCount(propertyCount);
        console.log(`📊 Pendentes atualizados via SSE: ${propertyCount}`);
        break;
        
      case 'sync_completed':
        // Sincronização concluída - zerar pendentes e refresh
        console.log('✅ Sincronização concluída via SSE');
        setPendingCount(0);
        setDateRangeInfo(null);
        setSyncStatus('success');
        
        // ✅ Refresh forçado do calendário (dados mudaram)
        console.log('🔄 Forçando refresh após sincronização...');
        setTimeout(() => fetchData(false, true), 1000);
        
        // Reset status após 3 segundos
        setTimeout(() => setSyncStatus('idle'), 3000);
        break;
        
      case 'bulk_update_completed':
        // Bulk edit concluído - refresh calendário
        console.log('📦 Bulk update concluído via SSE');
        
        // ✅ NOVO: Atualizar pendingCount localmente
        fetchPendingCount();
        
        // ✅ CRÍTICO: Refresh forçado (force=true) porque dados mudaram
        console.log('🔄 Forçando refresh após bulk update via SSE...');
        setTimeout(() => fetchData(false, true), 1000);
        break;
        
      case 'availability_updated':
        // Atualização pontual - pode fazer refresh silencioso
        console.log('🔄 Disponibilidade atualizada via SSE');
        
        // ✅ NOVO: Atualizar pendingCount localmente
        fetchPendingCount();
        
        // ✅ Refresh forçado (force=true) porque dados mudaram
        setTimeout(() => fetchData(false, true), 2000);
        break;
    }
  }, [lastEvent, filters.property_id, fetchData, fetchPendingCount]);
  
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
      
      // ✅ CORRIGIDO: Buscar contagem real do backend (não incrementar localmente)
      console.log('📊 Atualizando contagem de pendentes após updateCell...');
      fetchPendingCount(); // Não precisa await aqui pois é rápido
      
      // ✅ CORRIGIDO: Refresh forçado (force=true) após um tempo (SSE também notificará)
      console.log('🔄 Agendando refresh forçado após updateCell...');
      setTimeout(() => fetchData(false, true), 1000);
      
    } catch (error) {
      console.error('Erro ao atualizar célula:', error);
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
  
  // ✅ CORRIGIDO: executeBulkEdit com tratamento de erros e atualização de estado
  const executeBulkEdit = useCallback(async () => {
    try {
      const { scope, actions } = bulkEditState;
      
      const bulkData = {
        room_ids: scope.roomIds,
        date_from: scope.dateRange.from,
        date_to: scope.dateRange.to,
        sync_immediately: true, // ✅ NOVO: Marcar para sincronização
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
      
      // ✅ CRÍTICO: Buscar contagem REAL do backend (não somar localmente)
      console.log('📊 Buscando contagem real de pendentes após bulk edit...');
      console.log('📊 Pendentes antes:', pendingCount);
      await fetchPendingCount();
      console.log('📊 Contagem de pendentes atualizada');
      
      // ✅ CRÍTICO: Aguardar um pouco para dateRangeInfo atualizar via useEffect
      // O useEffect [pendingCount] precisa disparar e completar fetchDateRangeInfo()
      console.log('⏳ Aguardando dateRangeInfo atualizar...');
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('✅ DateRangeInfo atualizado:', dateRangeInfo);
      
      // ✅ Fechar modal DEPOIS de atualizar contagens
      setBulkEditState(prev => ({ ...prev, isOpen: false }));
      console.log('✅ Modal fechado');
      
      // ✅ CRÍTICO: Refresh IMEDIATO do calendário (force=true para ignorar cache)
      console.log('🔄 Forçando refresh imediato do calendário após bulk edit...');
      await fetchData(false, true);
      console.log('✅ Calendário atualizado após bulk edit');
      
      // ✅ SSE também notificará com 'bulk_update_completed' como backup
      // O useEffect acima fará outro refresh se necessário
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Erro na edição em massa:', error);
      
      // Manter modal aberto em caso de erro
      throw new Error(
        error.response?.data?.detail || 
        error.message || 
        'Erro desconhecido ao executar bulk edit'
      );
    }
  }, [bulkEditState, fetchData, fetchPendingCount, pendingCount, dateRangeInfo]);
  
  // ============== 🆕 SINCRONIZAÇÃO MANUAL ==============
  
  // ✅ CORRIGIDO: syncWithWuBook implementado corretamente
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
        force_all: false, // Apenas pendentes
        async_processing: false, // Síncrono
        batch_size: 100
      });
      
      console.log('✅ Resultado da sincronização:', result);
      
      if (result.status === 'success' || result.status === 'completed') {
        // ✅ SSE notificará com 'sync_completed'
        // O useEffect acima atualizará o estado automaticamente
        console.log('🎉 Sincronização concluída - aguardando notificação SSE');
      } else if (result.status === 'partial_success') {
        console.warn('⚠️ Sincronização parcial:', result);
        setSyncStatus('success');
        
        // Atualizar contagem de pendentes
        fetchPendingCount();
        
        // Reset status após 3 segundos
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        console.error('❌ Sincronização falhou:', result);
        setSyncStatus('error');
        
        // Reset status após 3 segundos em caso de erro
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
      
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error);
      setSyncStatus('error');
      
      // Reset status após 3 segundos em caso de erro
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      throw new Error(
        error.response?.data?.detail || 
        error.message || 
        'Erro desconhecido na sincronização'
      );
    }
  }, [filters.property_id, pendingCount, fetchPendingCount]);
  
  // ============== UTILIDADES ==============
  
  // ✅ CORRIGIDO: refresh agora força a busca (force=true)
  const refresh = useCallback(() => {
    console.log('🔄 Refresh manual solicitado (force=true)');
    fetchData(true, true); // showLoading=true, force=true
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
    
    // 🆕 Sincronização Manual (com SSE)
    syncStatus,
    pendingCount,
    dateRangeInfo,
    syncWithWuBook,
    
    // 🆕 Status da conexão SSE
    sseConnected: isConnected,
    
    // Utilidades
    refresh,
    getAvailabilityByRoomDate,
    calculateStats
  };
}