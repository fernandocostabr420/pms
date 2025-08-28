// frontend/src/types/calendar.ts

export interface CalendarReservation {
  id: number;
  reservation_number: string;
  guest_name?: string;
  guest_email?: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  check_in_date: string;
  check_out_date: string;
  total_guests: number;
  adults: number;
  children: number;
  total_amount: number;
  property_name?: string;
  rooms?: ReservationRoomInfo[];
  source?: string;
  nights: number;
  can_check_in: boolean;
  can_check_out: boolean;
  can_cancel: boolean;
  is_current: boolean;
}

export interface ReservationRoomInfo {
  id: number;
  room_id: number;
  room_number: string;
  room_name?: string;
  room_type_name?: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

export interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  reservations: CalendarReservation[];
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarWeek[];
  monthName: string;
}

export interface CalendarFilters {
  property_id?: number;
  room_type_id?: number;
  status?: string;
  view_mode: 'month' | 'week' | 'day';
}

export interface CalendarStats {
  total_reservations: number;
  checked_in: number;
  arriving_today: number;
  departing_today: number;
  available_rooms: number;
  occupancy_rate: number;
}

export interface RoomAvailability {
  id: number;
  room_number: string;
  name?: string;
  room_type_id: number;
  room_type_name?: string;
  max_occupancy: number;
  floor?: number;
  building?: string;
  is_available: boolean;
  current_reservation?: CalendarReservation;
}

export interface QuickBookingData {
  guest_id?: number;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  room_ids: number[];
  total_amount?: number;
  source?: string;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  reservation: CalendarReservation;
  color?: string;
  textColor?: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';

export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  checked_in: 'bg-green-100 text-green-800 border-green-200',
  checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
  cancelled: 'Cancelada',
};