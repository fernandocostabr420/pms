// frontend/src/types/reservation.ts

import { BaseResponse } from './api';

export interface ReservationResponse extends BaseResponse {
  id: number;
  reservation_number: string;
  tenant_id: number;
  guest_id: number;
  property_id: number;
  
  // Datas
  check_in_date: string;
  check_out_date: string;
  
  // Status e informações
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  adults: number;
  children: number;
  total_guests: number;
  
  // Valores financeiros
  room_rate?: number;
  total_amount?: number;
  paid_amount: number;
  discount: number;
  taxes: number;
  
  // Origem e observações
  source?: string;
  channel_reservation_id?: string;
  guest_requests?: string;
  internal_notes?: string;
  
  // Datas importantes
  created_date: string;
  confirmed_date?: string;
  checked_in_date?: string;
  checked_out_date?: string;
  cancelled_date?: string;
  cancellation_reason?: string;
  
  // Relacionamentos
  guest_name?: string;
  guest_email?: string;
  property_name?: string;
  
  // Campos computados
  nights?: number;
  balance_due?: number;
  status_display?: string;
  is_paid?: boolean;
  can_check_in?: boolean;
  can_check_out?: boolean;
  can_cancel?: boolean;
  is_current?: boolean;
  
  // Quartos
  rooms?: ReservationRoomResponse[];
}

export interface ReservationRoomResponse extends BaseResponse {
  id: number;
  reservation_id: number;
  room_id: number;
  check_in_date: string;
  check_out_date: string;
  rate_per_night?: number;
  total_amount?: number;
  status: string;
  notes?: string;
  room_number?: string;
  room_name?: string;
}

export interface ReservationCreate {
  guest_id: number;
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rooms: {
    room_id: number;
    rate_per_night?: number;
  }[];
  total_amount?: number;
  source?: string;
  guest_requests?: string;
  internal_notes?: string;
}

export interface ReservationUpdate {
  check_in_date?: string;
  check_out_date?: string;
  adults?: number;
  children?: number;
  total_amount?: number;
  guest_requests?: string;
  internal_notes?: string;
  rooms?: {
    room_id: number;
    rate_per_night?: number;
  }[];
}

export interface ReservationFilters {
  status?: string;
  source?: string;
  property_id?: number;
  guest_id?: number;
  check_in_from?: string;
  check_in_to?: string;
  check_out_from?: string;
  check_out_to?: string;
  created_from?: string;
  created_to?: string;
  min_amount?: number;
  max_amount?: number;
  is_paid?: boolean;
  requires_deposit?: boolean;
  is_group_reservation?: boolean;
  search?: string;
}

export interface ReservationListResponse {
  reservations: ReservationResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface ReservationWithDetails extends ReservationResponse {
  guest?: any;
  property?: any;
}

export interface CheckInRequest {
  actual_check_in_time?: string;
  notes?: string;
  room_assignments?: Record<number, number>;
}

export interface CheckOutRequest {
  actual_check_out_time?: string;
  notes?: string;
  final_charges?: number;
}

export interface CancelReservationRequest {
  cancellation_reason: string;
  refund_amount?: number;
  notes?: string;
}

export interface AvailabilityRequest {
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  adults?: number;
  children?: number;
  room_type_id?: number;
}

export interface AvailabilityResponse {
  available: boolean;
  available_rooms: any[];
  total_available_rooms: number;
  conflicting_reservations?: string[];
}

export interface ReservationStats {
  total_reservations: number;
  confirmed_reservations: number;
  checked_in_reservations: number;
  pending_reservations: number;
  cancelled_reservations: number;
  total_revenue: number;
  occupancy_rate: number;
  available_rooms: number;
  occupied_rooms: number;
}