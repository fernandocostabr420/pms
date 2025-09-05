// frontend/src/types/room-map.ts

import { Decimal } from 'decimal.js';

export interface MapReservationResponse {
  id: number;
  reservation_number: string;
  status: string;
  guest_name: string;
  guest_email?: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_amount: number;
  paid_amount: number;
  total_paid?: number;
  balance_due: number;
  total_guests: number;
  source?: string;
  notes?: string;
  
  // Status indicators
  is_arrival: boolean;
  is_departure: boolean;
  is_current: boolean;
}

export interface MapRoomData {
  id: number;
  room_number: string;
  name: string;
  floor?: number;
  building?: string;
  max_occupancy: number;
  
  // Status operacional
  is_operational: boolean;
  is_out_of_order: boolean;
  maintenance_notes?: string;
  housekeeping_notes?: string;
  
  // Reservas do quarto no período
  reservations: MapReservationResponse[];
  
  // Status calculado para o período
  occupancy_days: number;
  total_days_in_period: number;
  occupancy_rate: number;
}

export interface MapCategoryData {
  room_type_id: number;
  room_type_name: string;
  room_type_slug: string;
  room_type_description?: string;
  base_capacity: number;
  max_capacity: number;
  
  // Quartos desta categoria
  rooms: MapRoomData[];
  
  // Estatísticas da categoria
  total_rooms: number;
  operational_rooms: number;
  out_of_order_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  
  // Ocupação da categoria
  total_reservations: number;
  total_revenue: number;
  average_occupancy_rate: number;
}

export interface MapResponse {
  start_date: string;
  end_date: string;
  total_days: number;
  property_id?: number;
  property_name?: string;
  
  // Categorias com quartos e reservas
  categories: MapCategoryData[];
  
  // Estatísticas gerais
  total_rooms: number;
  total_operational_rooms: number;
  total_reservations: number;
  total_revenue: number;
  overall_occupancy_rate: number;
  status_counts: Record<string, number>;
  date_headers: string[];
}

export interface MapStatsResponse {
  period_start: string;
  period_end: string;
  total_days: number;
  
  // Estatísticas de quartos
  total_rooms: number;
  operational_rooms: number;
  out_of_order_rooms: number;
  maintenance_rooms: number;
  
  // Estatísticas de ocupação
  total_room_nights: number;
  occupied_room_nights: number;
  available_room_nights: number;
  occupancy_rate: number;
  
  // Estatísticas financeiras
  total_revenue: number;
  confirmed_revenue: number;
  pending_revenue: number;
  average_daily_rate: number;
  revenue_per_available_room: number;
  
  // Estatísticas de reservas
  total_reservations: number;
  arrivals: number;
  departures: number;
  stayovers: number;
  confirmed_reservations: number;
  checked_in_reservations: number;
  checked_out_reservations: number;
  cancelled_reservations: number;
  pending_reservations: number;
  
  // Estatísticas por categoria
  category_stats: Array<{
    room_type_id: number;
    room_type_name: string;
    total_rooms: number;
    operational_rooms: number;
    total_reservations: number;
    total_revenue: number;
    occupancy_rate: number;
    average_daily_rate: number;
  }>;
}

export interface MapFilters {
  start_date: string;
  end_date: string;
  property_id?: number;
  room_type_ids?: number[];
  include_out_of_order?: boolean;
  include_cancelled?: boolean;
  status_filter?: string[];
}

export interface MapBulkOperation {
  operation_type: 'block' | 'unblock' | 'maintenance' | 'clean';
  room_ids: number[];
  date_from: string;
  date_to: string;
  reason?: string;
  notes?: string;
  rate_override?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
}

export interface MapQuickBooking {
  room_id: number;
  check_in_date: string;
  check_out_date: string;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  adults: number;
  children: number;
  rate?: number;
  total_amount?: number;
  notes?: string;
  source?: string;
}

export interface RoomAvailabilityData {
  room: {
    id: number;
    room_number: string;
    name: string;
    room_type: string;
    is_operational: boolean;
    is_out_of_order: boolean;
  };
  period: {
    start_date: string;
    end_date: string;
    total_days: number;
  };
  availability: Array<{
    date: string;
    is_available: boolean;
    is_reserved: boolean;
    is_blocked: boolean;
    is_maintenance: boolean;
    reservation_id?: number;
    notes?: string;
  }>;
  summary: {
    available_days: number;
    reserved_days: number;
    blocked_days: number;
    maintenance_days: number;
  };
}

export interface CategorySummaryData {
  room_type_id: number;
  room_type_name: string;
  total_rooms: number;
  operational_rooms: number;
  reservations_count: number;
  occupancy_rate: number;
  revenue: number;
}