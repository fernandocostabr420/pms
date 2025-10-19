// frontend/src/hooks/useCalendarData.ts

import { useState, useEffect, useCallback } from 'react';
import { addMonths, subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import apiClient from '@/lib/api';
import { 
  CalendarReservation, 
  CalendarFilters, 
  CalendarStats,
  CalendarMonth,
  CalendarDay,
  CalendarWeek
} from '@/types/calendar';
import { ReservationResponse, TodaysReservationsResponse } from '@/types/api';

interface UseCalendarDataReturn {
  currentDate: Date;
  reservations: CalendarReservation[];
  calendarMonth: CalendarMonth | null;
  stats: CalendarStats | null;
  todaysData: TodaysReservationsResponse | null;
  loading: boolean;
  error: string | null;
  filters: CalendarFilters;
  
  // Actions
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  setCurrentDate: (date: Date) => void;
  updateFilters: (newFilters: Partial<CalendarFilters>) => void;
  refreshData: () => Promise<void>;
  
  // Utilities
  getReservationsForDate: (date: Date) => CalendarReservation[];
  getDayStats: (date: Date) => { arrivals: number; departures: number; occupied: number };
}

export function useCalendarData(): UseCalendarDataReturn {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<CalendarMonth | null>(null);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [todaysData, setTodaysData] = useState<TodaysReservationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>({
    view_mode: 'month'
  });

  // Converter ReservationResponse para CalendarReservation
  const convertToCalendarReservation = useCallback((reservation: ReservationResponse): CalendarReservation => {
    return {
      id: reservation.id,
      reservation_number: reservation.reservation_number,
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email,
      status: reservation.status as any,
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      total_guests: reservation.total_guests,
      adults: reservation.adults,
      children: reservation.children,
      total_amount: Number(reservation.total_amount),
      property_name: reservation.property_name,
      rooms: reservation.rooms?.map(room => ({
        id: room.id,
        room_id: room.room_id,
        room_number: room.room_number || '',
        room_name: room.room_name,
        room_type_name: room.room_type_name,
        check_in_date: room.check_in_date,
        check_out_date: room.check_out_date,
        status: room.status
      })),
      source: reservation.source,
      nights: reservation.nights || 0,
      can_check_in: reservation.can_check_in || false,
      can_check_out: reservation.can_check_out || false,
      can_cancel: reservation.can_cancel || false,
      is_current: reservation.is_current || false,
    };
  }, []);

  // Gerar estrutura do calendário mensal
  const generateCalendarMonth = useCallback((date: Date, reservations: CalendarReservation[]): CalendarMonth => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    // Começar na segunda-feira da primeira semana
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - ((calendarStart.getDay() + 6) % 7));
    
    const weeks: CalendarWeek[] = [];
    const currentWeekStart = new Date(calendarStart);

    // Gerar 6 semanas (padrão do calendário)
    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const days: CalendarDay[] = [];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const currentDay = new Date(currentWeekStart);
        currentDay.setDate(currentWeekStart.getDate() + dayIndex);
        
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = format(currentDay, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const isWeekend = currentDay.getDay() === 0 || currentDay.getDay() === 6;
        
        // Filtrar reservas para este dia
        const dayReservations = reservations.filter(reservation => {
          const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
          const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
          return currentDay >= checkIn && currentDay < checkOut;
        });
        
        days.push({
          date: new Date(currentDay),
          dateStr,
          isCurrentMonth,
          isToday,
          isWeekend,
          reservations: dayReservations
        });
      }
      
      weeks.push({ days });
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return {
      year,
      month,
      weeks,
      monthName: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  }, []);

  // Carregar dados do calendário
  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // API usa 1-12

      // Carregar reservas do mês
      const monthReservations = await apiClient.getCalendarMonth(year, month, filters.property_id);
      const calendarReservations = monthReservations.map(convertToCalendarReservation);
      
      setReservations(calendarReservations);

      // Gerar estrutura do calendário
      const calendarData = generateCalendarMonth(currentDate, calendarReservations);
      setCalendarMonth(calendarData);

      // Carregar estatísticas do dashboard (em paralelo)
      try {
        const [dashboardStats, todaysReservations] = await Promise.all([
          apiClient.getDashboardStats(filters.property_id),
          apiClient.getTodaysReservations(filters.property_id)
        ]);

        setStats({
          total_reservations: dashboardStats.total_reservations || 0,
          checked_in: dashboardStats.current_guests || 0,
          arriving_today: todaysReservations.arrivals_count || 0,
          departing_today: todaysReservations.departures_count || 0,
          available_rooms: dashboardStats.available_rooms || 0,
          occupancy_rate: dashboardStats.occupancy_rate || 0,
        });

        setTodaysData(todaysReservations);
      } catch (statsError) {
        console.warn('Erro ao carregar estatísticas:', statsError);
      }

    } catch (err) {
      console.error('Erro ao carregar dados do calendário:', err);
      setError('Erro ao carregar dados do calendário');
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters, convertToCalendarReservation, generateCalendarMonth]);

  // Effect para carregar dados quando data ou filtros mudam
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Actions
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const updateFilters = useCallback((newFilters: Partial<CalendarFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const refreshData = useCallback(async () => {
    await loadCalendarData();
  }, [loadCalendarData]);

  // Utilities
  const getReservationsForDate = useCallback((date: Date): CalendarReservation[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservations.filter(reservation => {
      const checkIn = reservation.check_in_date;
      const checkOut = reservation.check_out_date;
      return dateStr >= checkIn && dateStr < checkOut;
    });
  }, [reservations]);

  const getDayStats = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayReservations = reservations.filter(reservation => {
      const checkIn = reservation.check_in_date;
      const checkOut = reservation.check_out_date;
      return dateStr >= checkIn && dateStr < checkOut;
    });

    const arrivals = reservations.filter(r => r.check_in_date === dateStr).length;
    const departures = reservations.filter(r => r.check_out_date === dateStr).length;
    const occupied = dayReservations.filter(r => r.status === 'checked_in').length;

    return { arrivals, departures, occupied };
  }, [reservations]);

  return {
    currentDate,
    reservations,
    calendarMonth,
    stats,
    todaysData,
    loading,
    error,
    filters,
    
    // Actions
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    setCurrentDate,
    updateFilters,
    refreshData,
    
    // Utilities
    getReservationsForDate,
    getDayStats,
  };
}