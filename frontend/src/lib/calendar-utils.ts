// frontend/src/lib/calendar-utils.ts

import { format, parseISO, differenceInDays, isWithinInterval, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarReservation, 
  CalendarDay, 
  ReservationStatus,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS 
} from '@/types/calendar';

// ===== CONSTANTES =====
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const CALENDAR_CONFIG = {
  WEEKS_TO_SHOW: 6,
  MIN_CELL_HEIGHT: 120,
  MOBILE_CELL_HEIGHT: 80,
  COMPACT_CELL_HEIGHT: 60,
  MAX_RESERVATIONS_PER_DAY: 3,
  ANIMATION_DURATION: 300,
};

export const OCCUPANCY_LEVELS = {
  LOW: { threshold: 0.3, color: 'green', label: 'Baixa' },
  MEDIUM: { threshold: 0.7, color: 'yellow', label: 'Média' },
  HIGH: { threshold: 1, color: 'red', label: 'Alta' },
} as const;

// ===== UTILITÁRIOS DE DATA =====

/**
 * Formata data para exibição brasileira
 */
export function formatDateBR(date: Date | string, formatStr: string = 'dd/MM/yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date + 'T00:00:00') : date;
  return format(dateObj, formatStr, { locale: ptBR });
}

/**
 * Formata data de reserva de forma consistente
 * Esta função garante que as datas sejam formatadas da mesma forma
 * que funciona corretamente no mapa de reservas
 */
export function formatReservationDate(dateString: string, formatStr: string = 'dd/MM/yyyy'): string {
  try {
    // Usa a mesma lógica que funciona no mapa
    return formatDateBR(dateString, formatStr);
  } catch (error) {
    console.warn('Erro ao formatar data de reserva:', dateString, error);
    return dateString;
  }
}

/**
 * Formata data de reserva no formato longo (ex: "10 de setembro de 2025")
 */
export function formatReservationDateLong(dateString: string): string {
  try {
    // Usa a mesma lógica segura mas com formato longo
    return formatDateBR(dateString, 'PPP');
  } catch (error) {
    console.warn('Erro ao formatar data de reserva:', dateString, error);
    return dateString;
  }
}

/**
 * Formata período de datas
 */
export function formatDateRange(checkIn: string, checkOut: string): string {
  const checkInDate = parseISO(checkIn + 'T00:00:00');
  const checkOutDate = parseISO(checkOut + 'T00:00:00');
  
  const nights = differenceInDays(checkOutDate, checkInDate);
  
  return `${formatDateBR(checkInDate)} - ${formatDateBR(checkOutDate)} (${nights} noite${nights !== 1 ? 's' : ''})`;
}

/**
 * Verifica se data está no período
 */
export function isDateInRange(date: Date, startDate: string, endDate: string): boolean {
  const start = parseISO(startDate + 'T00:00:00');
  const end = parseISO(endDate + 'T00:00:00');
  
  return isWithinInterval(date, { start, end: subDays(end, 1) });
}

/**
 * Gera lista de datas entre duas datas
 */
export function getDatesBetween(startDate: string, endDate: string): Date[] {
  const start = parseISO(startDate + 'T00:00:00');
  const end = parseISO(endDate + 'T00:00:00');
  const dates: Date[] = [];
  
  let currentDate = start;
  while (currentDate < end) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  
  return dates;
}

// ===== UTILITÁRIOS DE RESERVA =====

/**
 * Calcula estatísticas de um dia
 */
export function calculateDayStats(date: Date, reservations: CalendarReservation[]) {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  const arrivals = reservations.filter(r => r.check_in_date === dateStr);
  const departures = reservations.filter(r => r.check_out_date === dateStr);
  const occupying = reservations.filter(r => isDateInRange(date, r.check_in_date, r.check_out_date));
  const checkedIn = occupying.filter(r => r.status === 'checked_in');
  
  return {
    arrivals: arrivals.length,
    departures: departures.length,
    occupying: occupying.length,
    checkedIn: checkedIn.length,
    occupancyRate: occupying.length > 0 ? checkedIn.length / occupying.length : 0,
  };
}

/**
 * Filtra reservas por status
 */
export function filterReservationsByStatus(
  reservations: CalendarReservation[], 
  statuses: ReservationStatus[]
): CalendarReservation[] {
  return reservations.filter(reservation => statuses.includes(reservation.status));
}

/**
 * Agrupa reservas por data
 */
export function groupReservationsByDate(reservations: CalendarReservation[]) {
  const grouped: Record<string, CalendarReservation[]> = {};
  
  reservations.forEach(reservation => {
    const dates = getDatesBetween(reservation.check_in_date, reservation.check_out_date);
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(reservation);
    });
  });
  
  return grouped;
}

/**
 * Calcula receita total de reservas
 */
export function calculateTotalRevenue(reservations: CalendarReservation[]): number {
  return reservations.reduce((total, reservation) => {
    if (reservation.status !== 'cancelled') {
      return total + reservation.total_amount;
    }
    return total;
  }, 0);
}

/**
 * Calcula receita por período
 */
export function calculateRevenueByPeriod(
  reservations: CalendarReservation[], 
  startDate: string, 
  endDate: string
): number {
  const filteredReservations = reservations.filter(reservation => 
    reservation.status !== 'cancelled' &&
    (
      isDateInRange(parseISO(reservation.check_in_date + 'T00:00:00'), startDate, endDate) ||
      isDateInRange(parseISO(reservation.check_out_date + 'T00:00:00'), startDate, endDate)
    )
  );
  
  return calculateTotalRevenue(filteredReservations);
}

// ===== UTILITÁRIOS DE STATUS =====

/**
 * Obtém cor do status
 */
export function getStatusColor(status: ReservationStatus): string {
  return RESERVATION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Obtém label do status
 */
export function getStatusLabel(status: ReservationStatus): string {
  return RESERVATION_STATUS_LABELS[status] || status;
}

/**
 * Verifica se reserva pode ser modificada
 */
export function canModifyReservation(reservation: CalendarReservation): {
  canCheckIn: boolean;
  canCheckOut: boolean;
  canCancel: boolean;
  canModify: boolean;
} {
  return {
    canCheckIn: reservation.can_check_in,
    canCheckOut: reservation.can_check_out,
    canCancel: reservation.can_cancel,
    canModify: ['pending', 'confirmed'].includes(reservation.status),
  };
}

// ===== UTILITÁRIOS DE OCUPAÇÃO =====

/**
 * Calcula nível de ocupação
 */
export function calculateOccupancyLevel(currentOccupancy: number, maxCapacity: number) {
  if (maxCapacity === 0) return OCCUPANCY_LEVELS.LOW;
  
  const rate = currentOccupancy / maxCapacity;
  
  if (rate >= OCCUPANCY_LEVELS.HIGH.threshold) return OCCUPANCY_LEVELS.HIGH;
  if (rate >= OCCUPANCY_LEVELS.MEDIUM.threshold) return OCCUPANCY_LEVELS.MEDIUM;
  return OCCUPANCY_LEVELS.LOW;
}

/**
 * Obtém cor da ocupação
 */
export function getOccupancyColor(occupancyRate: number): string {
  if (occupancyRate >= 0.8) return 'bg-red-600';
  if (occupancyRate >= 0.6) return 'bg-yellow-600';
  if (occupancyRate >= 0.3) return 'bg-green-600';
  return 'bg-gray-600';
}

// ===== UTILITÁRIOS DE FORMATAÇÃO =====

/**
 * Formata valor monetário
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

/**
 * Formata número de hóspedes
 */
export function formatGuestCount(adults: number, children: number): string {
  const total = adults + children;
  const adultsText = adults === 1 ? 'adulto' : 'adultos';
  const childrenText = children === 1 ? 'criança' : 'crianças';
  
  if (children === 0) {
    return `${adults} ${adultsText}`;
  }
  
  return `${total} hóspede${total !== 1 ? 's' : ''} (${adults} ${adultsText} + ${children} ${childrenText})`;
}

/**
 * Trunca texto
 */
export function truncateText(text: string, maxLength: number = 20): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ===== UTILITÁRIOS DE VALIDAÇÃO =====

/**
 * Valida período de datas
 */
export function validateDateRange(checkIn: string, checkOut: string): {
  isValid: boolean;
  error?: string;
} {
  const checkInDate = parseISO(checkIn + 'T00:00:00');
  const checkOutDate = parseISO(checkOut + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (checkInDate >= checkOutDate) {
    return { isValid: false, error: 'Data de check-out deve ser posterior ao check-in' };
  }
  
  if (checkInDate < today) {
    return { isValid: false, error: 'Data de check-in não pode ser no passado' };
  }
  
  const nights = differenceInDays(checkOutDate, checkInDate);
  if (nights > 30) {
    return { isValid: false, error: 'Período não pode exceder 30 dias' };
  }
  
  return { isValid: true };
}

/**
 * Valida dados de reserva
 */
export function validateReservationData(data: {
  guestName?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number[];
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.guestName || data.guestName.trim().length < 2) {
    errors.push('Nome do hóspede deve ter pelo menos 2 caracteres');
  }
  
  const dateValidation = validateDateRange(data.checkIn, data.checkOut);
  if (!dateValidation.isValid) {
    errors.push(dateValidation.error!);
  }
  
  if (data.adults < 1 || data.adults > 10) {
    errors.push('Número de adultos deve ser entre 1 e 10');
  }
  
  if (data.children < 0 || data.children > 10) {
    errors.push('Número de crianças deve ser entre 0 e 10');
  }
  
  if (data.rooms.length === 0) {
    errors.push('Selecione pelo menos um quarto');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}