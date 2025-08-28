// frontend/src/types/room-availability.ts

export interface RoomAvailabilityResponse {
  id: number;
  room_id: number;
  date: string;
  tenant_id: number;
  
  // Status de disponibilidade
  is_available: boolean;
  is_blocked: boolean;
  is_out_of_order: boolean;
  is_maintenance: boolean;
  is_reserved: boolean;
  reservation_id?: number;
  
  // Preços e restrições
  rate_override?: number;
  min_stay: number;
  max_stay?: number;
  
  // Restrições de check-in/check-out
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  
  // Informações adicionais
  reason?: string;
  notes?: string;
  
  // Metadados
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Campos computados
  status?: string;
  is_bookable?: boolean;
  
  // Dados relacionados
  room_number?: string;
  room_name?: string;
  room_type_name?: string;
  property_name?: string;
}

export interface RoomAvailabilityCreate {
  room_id: number;
  date: string;
  
  // Status de disponibilidade
  is_available?: boolean;
  is_blocked?: boolean;
  is_out_of_order?: boolean;
  is_maintenance?: boolean;
  
  // Preços e restrições
  rate_override?: number;
  min_stay?: number;
  max_stay?: number;
  
  // Restrições de check-in/check-out
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  
  // Informações adicionais
  reason?: string;
  notes?: string;
}

export interface RoomAvailabilityUpdate {
  // Status de disponibilidade
  is_available?: boolean;
  is_blocked?: boolean;
  is_out_of_order?: boolean;
  is_maintenance?: boolean;
  
  // Preços e restrições
  rate_override?: number;
  min_stay?: number;
  max_stay?: number;
  
  // Restrições de check-in/check-out
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  
  // Informações adicionais
  reason?: string;
  notes?: string;
}

export interface RoomAvailabilityListResponse {
  availabilities: RoomAvailabilityResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface RoomAvailabilityFilters {
  room_id?: number;
  property_id?: number;
  room_type_id?: number;
  
  date_from?: string;
  date_to?: string;
  
  is_available?: boolean;
  is_blocked?: boolean;
  is_out_of_order?: boolean;
  is_maintenance?: boolean;
  is_reserved?: boolean;
  is_bookable?: boolean;
  
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  
  has_rate_override?: boolean;
  min_rate?: number;
  max_rate?: number;
  
  search?: string;
}

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
}

export interface CalendarAvailabilityRequest {
  room_ids?: number[];
  property_id?: number;
  room_type_id?: number;
  date_from: string;
  date_to: string;
  include_reserved?: boolean;
}

export interface CalendarAvailabilityResponse {
  date: string;
  availabilities: RoomAvailabilityResponse[];
  summary: Record<string, number>; // available, blocked, reserved, etc.
}

export interface AvailabilityStatsResponse {
  total_rooms: number;
  available_rooms: number;
  blocked_rooms: number;
  reserved_rooms: number;
  maintenance_rooms: number;
  out_of_order_rooms: number;
  occupancy_rate: number;
  availability_rate: number;
}

export interface RoomAvailabilityCheckRequest {
  room_id: number;
  check_in_date: string;
  check_out_date: string;
}

export interface RoomAvailabilityCheckResponse {
  available: boolean;
  conflicts?: string[];
  blocked_dates?: string[];
  reason?: string;
}

// Status colors para UI
export const AVAILABILITY_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  blocked: 'bg-red-100 text-red-800 border-red-200',
  reserved: 'bg-blue-100 text-blue-800 border-blue-200',
  maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  out_of_order: 'bg-gray-100 text-gray-800 border-gray-200',
};

// Status labels para UI
export const AVAILABILITY_STATUS_LABELS: Record<string, string> = {
  available: 'Disponível',
  blocked: 'Bloqueado',
  reserved: 'Reservado',
  maintenance: 'Manutenção',
  out_of_order: 'Fora de Ordem',
};