// frontend/src/types/channel-manager.ts

// ============== ENUMS ==============

export enum ChannelSyncStatus {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected", 
  ERROR = "error",
  SYNCING = "syncing",
  PENDING = "pending"
}

export enum SyncDirection {
  INBOUND = "inbound",           // WuBook -> PMS
  OUTBOUND = "outbound",         // PMS -> WuBook  
  BIDIRECTIONAL = "bidirectional" // Ambos
}

export enum ChannelType {
  BOOKING_COM = "booking_com",
  EXPEDIA = "expedia",
  AIRBNB = "airbnb",
  HOTELS_COM = "hotels_com",
  AGODA = "agoda",
  DESPEGAR = "despegar",
  TRIVAGO = "trivago",
  GOOGLE_HOTEL_ADS = "google_hotel_ads",
  OTHER = "other"
}

// ============== INTERFACES PRINCIPAIS ==============

export interface ChannelManagerOverview {
  // Informações gerais
  total_configurations: number;
  active_configurations: number;
  connected_channels: number;
  
  // Status de sincronização  
  sync_status: Record<string, number>;
  last_sync_at?: string;
  
  // Estatísticas
  availability_stats: Record<string, any>;
  sync_stats: Record<string, any>;
  channels_by_type: Record<string, number>;
  
  // Performance
  total_rooms_mapped: number;
  sync_health_score: number;
  error_rate: number;
  pending_sync_count: number;
  
  // Receita estimada
  estimated_monthly_revenue?: number;
}

export interface SimpleAvailabilityView {
  date: string;
  room_id: number;
  room_number: string;
  room_name?: string;
  
  // Status PMS
  is_available: boolean;
  is_bookable: boolean;
  rate?: number;
  min_stay: number;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  
  // Informações de sincronização
  sync_status: string;
  last_sync?: string;
  sync_pending: boolean;
  sync_error?: string;
  
  // Canais
  mapped_channels: string[];
  sync_enabled_channels: string[];
}

export interface AvailabilityCalendarRequest {
  date_from: string;
  date_to: string;
  room_ids?: number[];
  property_id?: number;
  include_sync_status?: boolean;
  include_restrictions?: boolean;
}

export interface AvailabilityCalendarResponse {
  date_from: string;
  date_to: string;
  total_days: number;
  calendar_data: CalendarDayData[];
  rooms_summary: RoomSummary[];
  channels_summary: ChannelSummary[];
  statistics: CalendarStatistics;
  sync_status: SyncStatusInfo;
}

export interface CalendarDayData {
  date: string;
  availabilities: SimpleAvailabilityView[];
  summary: {
    total_rooms: number;
    available_rooms: number;
    blocked_rooms: number;
  };
}

export interface RoomSummary {
  room_id: number;
  room_number: string;
  room_name: string;
  has_channel_mapping: boolean;
  sync_enabled: boolean;
}

export interface ChannelSummary {
  configuration_id: number;
  channel_name: string;
  mapped_rooms: number;
  sync_enabled: boolean;
  last_sync?: string;
}

export interface CalendarStatistics {
  total_days: number;
  total_records: number;
  synced_records: number;
  sync_rate: number;
  pending_sync: number;
}

export interface SyncStatusInfo {
  healthy_configurations: number;
  error_configurations: number;
  last_global_sync?: string;
}

// ============== BULK EDIT ==============

export interface BulkAvailabilityUpdate {
  room_ids: number[];
  date_from: string;
  date_to: string;
  
  // Campos para atualizar
  is_available?: boolean;
  is_blocked?: boolean;
  is_out_of_order?: boolean;
  is_maintenance?: boolean;
  
  rate_override?: number;
  min_stay?: number;
  max_stay?: number;
  
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  
  reason?: string;
  notes?: string;
  
  // ❌ REMOVIDO: sync_immediately não existe mais
}

export interface BulkOperationResult {
  success: boolean;
  total_processed: number;
  created: number;
  updated: number;
  errors: string[];
  changes_summary: Record<string, any>;
}

// ============== SYNC (DEPRECATED) ==============

/**
 * @deprecated Use ManualSyncRequest
 */
export interface SyncRequest {
  sync_type?: string;
  room_ids?: number[];
  date_from?: string;
  date_to?: string;
  force_sync?: boolean;
  sync_direction?: SyncDirection;
}

/**
 * @deprecated Use ManualSyncResult
 */
export interface SyncResult {
  task_id: string;
  status: string;
  message: string;
  total_items: number;
  processed_items: number;
  errors: string[];
  changes_summary: Record<string, any>;
  started_at: string;
  completed_at?: string;
}

// ============== 🆕 SINCRONIZAÇÃO MANUAL ==============

/**
 * 🆕 Request para contagem de registros pendentes
 */
export interface PendingCountResponse {
  total_pending: number;
  by_property: Record<string, number>;
  has_pending: boolean;
}

/**
 * 🆕 Response com intervalo de datas pendentes (detecção automática)
 */
export interface PendingDateRangeResponse {
  date_from: string | null;
  date_to: string | null;
  total_pending: number;
  rooms_affected: number[];
  has_pending: boolean;
}

/**
 * 🆕 Request para sincronização manual
 */
export interface ManualSyncRequest {
  property_id?: number;
  force_all?: boolean;
  async_processing?: boolean;
  batch_size?: number;
}

/**
 * 🆕 Resultado da sincronização manual
 */
export interface ManualSyncResult {
  sync_id: string;
  status: string;
  message: string;
  processed: number;
  successful: number;
  failed: number;
  success_rate: number;
  errors: string[];
  duration_seconds: number;
}

// ============== FILTROS ==============

export interface ChannelManagerFilters {
  date_from?: string;
  date_to?: string;
  room_ids?: number[];
  property_id?: number;
  room_type_id?: number;
  sync_status?: ChannelSyncStatus;
  has_errors?: boolean;
  search?: string;
}

// ============== UI STATE ==============

export interface CalendarUIState {
  selectedDate?: string;
  selectedRooms: number[];
  viewMode: 'calendar' | 'list';
  showFilters: boolean;
  showBulkEdit: boolean;
  editingCell?: {
    roomId: number;
    date: string;
    field: 'rate' | 'availability' | 'restrictions';
  };
}

export interface BulkEditState {
  isOpen: boolean;
  step: 1 | 2 | 3; // Escopo -> Ação -> Confirmar
  scope: {
    dateRange: { from: string; to: string };
    roomIds: number[];
    daysOfWeek?: number[];
  };
  actions: {
    priceAction?: 'set' | 'increase' | 'decrease';
    priceValue?: number;
    availabilityAction?: 'open' | 'close' | 'set';
    availabilityValue?: number;
    restrictions?: {
      minStay?: number;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    };
  };
  preview?: {
    totalCells: number;
    conflicts: string[];
    estimatedChanges: Record<string, number>;
  };
}