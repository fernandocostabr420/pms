// frontend/src/types/reservation.ts - ARQUIVO COMPLETO COM TODAS AS MODIFICAÇÕES

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
  room_type_name?: string;
  guests?: number;
  rate_plan_name?: string;
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

// ===== FILTROS EXPANDIDOS (ORIGINAL + NOVOS CAMPOS) =====
export interface ReservationFilters {
  // Filtros básicos existentes
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
  
  // ===== NOVOS FILTROS ADICIONADOS =====
  
  // Filtros do hóspede
  guest_email?: string;
  guest_phone?: string;
  guest_document_type?: string;
  guest_nationality?: string;
  guest_city?: string;
  guest_state?: string;
  guest_country?: string;
  
  // Filtros de data expandidos
  cancelled_from?: string;
  cancelled_to?: string;
  confirmed_from?: string;
  confirmed_to?: string;
  actual_checkin_from?: string;
  actual_checkin_to?: string;
  actual_checkout_from?: string;
  actual_checkout_to?: string;
  
  // Filtros por número de hóspedes e noites
  min_guests?: number;
  max_guests?: number;
  min_nights?: number;
  max_nights?: number;
  
  // Filtros de quarto
  room_type_id?: number;
  room_number?: string;
  
  // Filtros especiais
  has_special_requests?: boolean;
  has_internal_notes?: boolean;
  deposit_paid?: boolean;
  payment_status?: string;
  marketing_source?: string;
  
  // Filtros por flags específicas
  is_current?: boolean;
  can_check_in?: boolean;
  can_check_out?: boolean;
  can_cancel?: boolean;
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

// ===== NOVOS TIPOS EXPANDIDOS =====

export interface GuestDetails {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  document_type?: string;
  document_number?: string;
  nationality?: string;
  city?: string;
  state?: string;
  country?: string;
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  date_of_birth?: string;
  preferences?: Record<string, any>;
  notes?: string;
  marketing_consent?: string;
  total_reservations?: number;
  completed_stays?: number;
  cancelled_reservations?: number;
  total_nights?: number;
  last_stay_date?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface PropertyDetails {
  id: number;
  name: string;
  description?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  total_rooms?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationResponseWithGuestDetails extends ReservationResponse {
  // Dados do hóspede expandidos
  guest?: GuestDetails;
  guest_phone?: string;
  guest_document_type?: string;
  guest_document_number?: string;
  guest_nationality?: string;
  guest_city?: string;
  guest_state?: string;
  guest_country?: string;
  guest_address?: string;
  guest_date_of_birth?: string;
  
  // Dados da propriedade expandidos
  property?: PropertyDetails;
  property_address?: string;
  property_phone?: string;
  property_city?: string;
  
  // Estatísticas do hóspede
  guest_total_reservations?: number;
  guest_completed_stays?: number;
  guest_cancelled_reservations?: number;
  guest_last_stay_date?: string;
  
  // Dados de pagamento expandidos
  last_payment_date?: string;
  payment_method_last?: string;
  total_payments?: number;
  
  // Informações dos quartos com mais detalhes
  room_details?: ReservationRoomResponse[];
  
  // Campos adicionais específicos para reservas
  is_group_reservation?: boolean;
  requires_deposit?: boolean;
  deposit_paid?: boolean;
}

export interface ReservationListResponseWithDetails {
  reservations: ReservationResponseWithGuestDetails[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
  
  // Estatísticas da busca
  summary?: {
    total_amount: number;
    total_paid: number;
    total_pending: number;
    status_counts: Record<string, number>;
    source_counts: Record<string, number>;
    avg_nights: number;
    avg_guests: number;
    avg_amount: number;
  };
}

// ===== TIPOS DE EXPORTAÇÃO =====

export interface ReservationExportFilters extends ReservationFilters {
  // Campos específicos para exportação
  include_guest_details?: boolean;
  include_room_details?: boolean;
  include_payment_details?: boolean;
  include_property_details?: boolean;
  
  // Formato da exportação
  date_format?: string;
  currency_format?: string;
  
  // Campos customizados para incluir
  custom_fields?: string[];
}

export interface ReservationExportResponse {
  file_url: string;
  file_name: string;
  total_records: number;
  generated_at: string;
  expires_at: string;
}

// ===== TIPOS DE AÇÕES RÁPIDAS =====

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

// ===== TIPOS DE DISPONIBILIDADE =====

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

// ===== TIPOS DE ESTATÍSTICAS =====

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

export interface DashboardStats {
  total_reservations: number;
  total_revenue: number;
  occupancy_rate: number;
  pending_checkins: number;
  pending_checkouts: number;
  overdue_payments: number;
  avg_nights: number;
  avg_guests: number;
  avg_daily_rate: number;
  
  // Estatísticas por período
  today_arrivals: number;
  today_departures: number;
  current_guests: number;
  available_rooms_today: number;
  
  // Distribuições
  status_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  
  // Tendências
  revenue_trend: Array<{
    date: string;
    revenue: number;
    reservations: number;
  }>;
  
  // Top performers
  top_sources: Array<{
    source: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  
  // Reservas recentes e próximas
  recent_reservations: ReservationResponse[];
  upcoming_checkins: ReservationResponse[];
  upcoming_checkouts: ReservationResponse[];
  
  // Alertas e notificações
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    count?: number;
  }>;
}

// ===== ENUMS E CONSTANTES =====

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export enum ReservationSource {
  DIRECT = 'direct',
  BOOKING = 'booking',
  AIRBNB = 'airbnb',
  EXPEDIA = 'expedia',
  PHONE = 'phone',
  EMAIL = 'email',
  WALK_IN = 'walk_in',
  AGENT = 'agent',
  CORPORATE = 'corporate'
}

export enum PaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  REFUNDED = 'refunded'
}

// ===== TIPOS PARA BUSCA E FILTROS AVANÇADOS =====

export interface ReservationSearchCriteria {
  // Critérios básicos
  text_search?: string;
  status_filter?: ReservationStatus[];
  source_filter?: ReservationSource[];
  
  // Critérios de data
  date_range?: {
    start: string;
    end: string;
    type: 'check_in' | 'check_out' | 'created' | 'confirmed' | 'cancelled';
  };
  
  // Critérios de hóspede
  guest_criteria?: {
    has_email?: boolean;
    has_phone?: boolean;
    nationality?: string;
    location?: string;
    document_type?: string;
    is_returning?: boolean;
  };
  
  // Critérios financeiros
  financial_criteria?: {
    min_amount?: number;
    max_amount?: number;
    payment_status?: PaymentStatus[];
    has_balance?: boolean;
    requires_deposit?: boolean;
  };
  
  // Critérios de acomodação
  accommodation_criteria?: {
    property_ids?: number[];
    room_type_ids?: number[];
    min_guests?: number;
    max_guests?: number;
    min_nights?: number;
    max_nights?: number;
  };
  
  // Critérios especiais
  special_criteria?: {
    has_special_requests?: boolean;
    has_internal_notes?: boolean;
    is_group_reservation?: boolean;
    requires_special_attention?: boolean;
  };
}

// ===== TIPOS PARA RELATÓRIOS =====

export interface ReservationReportData {
  period: {
    start: string;
    end: string;
    type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  };
  
  summary: {
    total_reservations: number;
    total_revenue: number;
    avg_daily_rate: number;
    occupancy_rate: number;
    cancellation_rate: number;
    no_show_rate: number;
  };
  
  breakdown: {
    by_status: Record<string, { count: number; revenue: number }>;
    by_source: Record<string, { count: number; revenue: number }>;
    by_property: Record<string, { count: number; revenue: number }>;
    by_room_type: Record<string, { count: number; revenue: number }>;
  };
  
  trends: Array<{
    date: string;
    reservations: number;
    revenue: number;
    occupancy: number;
  }>;
  
  top_performers: {
    properties: Array<{ name: string; count: number; revenue: number }>;
    room_types: Array<{ name: string; count: number; revenue: number }>;
    sources: Array<{ name: string; count: number; revenue: number }>;
  };
}

// ===== TIPOS UTILITÁRIOS =====

export type ReservationAction = 
  | 'confirm' 
  | 'check-in' 
  | 'check-out' 
  | 'cancel' 
  | 'modify' 
  | 'add-payment' 
  | 'send-confirmation' 
  | 'add-note';

export interface ReservationActionResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}