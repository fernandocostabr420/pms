// src/types/api.ts

// ===== AUTH TYPES =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: UserResponse;
  tenant: TenantResponse;
  token: Token;
}

// ===== USER TYPES =====
export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  tenant_id: number;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// ===== TENANT TYPES =====
export interface TenantResponse {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== PROPERTY TYPES =====
export interface PropertyResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  property_type: string;
  address_line1: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  email: string | null;
  is_operational: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

// ===== ROOM TYPES =====
export interface RoomTypeResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  base_capacity: number;
  max_capacity: number;
  is_bookable: boolean;
  tenant_id: number;
  created_at: string;
}

export interface RoomResponse {
  id: number;
  name: string;
  room_number: string;
  property_id: number;
  room_type_id: number;
  floor: number | null;
  is_operational: boolean;
  is_out_of_order: boolean;
  tenant_id: number;
  created_at: string;
}

// ===== GUEST TYPES =====
export interface GuestResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  tenant_id: number;
  created_at: string;
}

// ===== RESERVATION TYPES =====
export interface ReservationResponse {
  id: number;
  reservation_number: string;
  guest_id: number;
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  adults: number;
  children: number;
  total_amount: number | null;
  paid_amount: number;
  guest_name: string | null;
  property_name: string | null;
  nights: number | null;
  tenant_id: number;
  created_at: string;
}

// ===== COMMON TYPES =====
export interface MessageResponse {
  message: string;
  success?: boolean;
}

export interface ErrorResponse {
  detail: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

// ===== API RESPONSE WRAPPERS =====
export interface PropertyListResponse extends PaginatedResponse<PropertyResponse> {
  properties: PropertyResponse[];
}

export interface ReservationListResponse extends PaginatedResponse<ReservationResponse> {
  reservations: ReservationResponse[];
}

export interface GuestListResponse extends PaginatedResponse<GuestResponse> {
  guests: GuestResponse[];
}

// ===== CALENDAR API TYPES =====
export interface CalendarMonthRequest {
  year: number;
  month: number;
  property_id?: number;
}

export interface CalendarRangeRequest {
  start_date: string;
  end_date: string;
  property_id?: number;
  status?: string;
}

export interface AvailabilityCheckRequest {
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  adults?: number;
  children?: number;
  room_type_id?: number;
}

export interface AvailabilityRequest {
  property_id: number;
  check_in_date: string;
  check_out_date: string;
  adults?: number;
  children?: number;
  room_type_id?: number;
  
  // ✅ NOVO CAMPO - Para excluir reserva específica em edições
  exclude_reservation_id?: number;
}

export interface AvailableRoom {
  id: number;
  room_number: string;
  name?: string;
  room_type_id: number;
  room_type_name?: string;
  max_occupancy: number;
  floor?: number;
  building?: string;
  
  // ✅ NOVO CAMPO - Taxa base do quarto
  rate_per_night?: number;
  
  // ✅ CAMPO ADICIONAL - Para marcar quarto atual da reserva (frontend only)
  isCurrentReservation?: boolean;
}

export interface CalendarStatsResponse {
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

export interface TodaysReservationsResponse {
  date: string;
  arrivals: ReservationResponse[];
  departures: ReservationResponse[];
  current_guests: ReservationResponse[];
  arrivals_count: number;
  departures_count: number;
  current_guests_count: number;
}

// ===== GUEST TYPES IMPORT =====
export * from './guest';