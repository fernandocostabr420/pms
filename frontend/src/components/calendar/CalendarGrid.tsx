// frontend/src/components/calendar/CalendarGrid.tsx
'use client';

import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarReservation } from '@/types/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReservationCard from './ReservationCard';

interface CalendarGridProps {
  currentDate: Date;
  reservations: CalendarReservation[];
  onDateClick: (date: Date) => void;
  onReservationClick: (reservation: CalendarReservation) => void;
  loading?: boolean;
}

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  reservations: CalendarReservation[];
  arrivals: number;
  departures: number;
}

export default function CalendarGrid({
  currentDate,
  reservations,
  onDateClick,
  onReservationClick,
  loading = false
}: CalendarGridProps) {
  
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Começar no domingo da primeira semana
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
    
    // Terminar no sábado da última semana  
    const calendarEnd = new Date(monthEnd);
    calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return days.map((date): CalendarDay => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const isCurrentMonth = isSameMonth(date, currentDate);
      const isToday = isToday(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      // Filtrar reservas para este dia
      const dayReservations = reservations.filter(reservation => {
        const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
        const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
        return date >= checkIn && date < checkOut;
      });
      
      // Contar chegadas e saídas
      const arrivals = reservations.filter(r => r.check_in_date === dateStr).length;
      const departures = reservations.filter(r => r.check_out_date === dateStr).length;
      
      return {
        date,
        isCurrentMonth,
        isToday,
        isWeekend,
        reservations: dayReservations,
        arrivals,
        departures
      };
    });
  }, [currentDate, reservations]);

  const weeks = useMemo(() => {
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < calendarData.length; i += 7) {
      weeks.push(calendarData.slice(i, i + 7));
    }
    return weeks;
  }, [calendarData]);

  if (loading) {
    return (
      <div className="animate-pulse">
        {/* Header */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {WEEKDAYS_SHORT.map((day) => (
            <div key={day} className="h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
        
        {/* Grid */}
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden rounded-lg border">
      {/* Header com dias da semana */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {WEEKDAYS_SHORT.map((dayName, index) => (
          <div
            key={dayName}
            className={cn(
              "bg-gray-50 px-3 py-3 text-center text-sm font-medium text-gray-700",
              (index === 0 || index === 6) && "bg-gray-100" // Fins de semana
            )}
          >
            <div className="hidden sm:block">{WEEKDAYS_LONG[index]}</div>
            <div className="sm:hidden">{dayName}</div>
          </div>
        ))}
      </div>

      {/* Grid das semanas */}
      <div className="bg-gray-200">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-px">
            {week.map((day) => (
              <CalendarDayCell
                key={format(day.date, 'yyyy-MM-dd')}
                day={day}
                onDateClick={onDateClick}
                onReservationClick={onReservationClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CalendarDayCellProps {
  day: CalendarDay;
  onDateClick: (date: Date) => void;
  onReservationClick: (reservation: CalendarReservation) => void;
}

function CalendarDayCell({ day, onDateClick, onReservationClick }: CalendarDayCellProps) {
  const dayNumber = format(day.date, 'd');
  const occupiedReservations = day.reservations.filter(r => r.status === 'checked_in' || r.status === 'confirmed');
  
  return (
    <div
      className={cn(
        "bg-white min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-gray-50 group relative",
        !day.isCurrentMonth && "bg-gray-50/50 text-gray-400",
        day.isToday && "bg-blue-50 border-l-4 border-l-blue-500",
        day.isWeekend && day.isCurrentMonth && "bg-gray-50/30",
      )}
      onClick={() => onDateClick(day.date)}
    >
      {/* Header do dia */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "text-sm font-medium",
            day.isToday && "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold",
            !day.isCurrentMonth && "text-gray-400"
          )}
        >
          {dayNumber}
        </span>

        {/* Indicadores de atividade */}
        {day.isCurrentMonth && (day.arrivals > 0 || day.departures > 0) && (
          <div className="flex gap-1">
            {day.arrivals > 0 && (
              <Badge variant="outline" className="text-xs px-1 py-0 bg-green-100 text-green-700 border-green-300 h-5">
                ↓{day.arrivals}
              </Badge>
            )}
            {day.departures > 0 && (
              <Badge variant="outline" className="text-xs px-1 py-0 bg-orange-100 text-orange-700 border-orange-300 h-5">
                ↑{day.departures}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Reservas do dia */}
      <div className="space-y-1 overflow-hidden">
        {occupiedReservations.slice(0, 3).map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            onClick={onReservationClick}
            compact
          />
        ))}
        
        {occupiedReservations.length > 3 && (
          <div 
            className="text-xs text-gray-500 text-center py-1 hover:text-gray-700 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Poderia abrir modal com todas as reservas do dia
            }}
          >
            +{occupiedReservations.length - 3} mais...
          </div>
        )}
        
        {occupiedReservations.length === 0 && day.isCurrentMonth && (
          <div className="text-center py-2">
            <div className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
              Disponível
            </div>
          </div>
        )}
      </div>

      {/* Contador de ocupação */}
      {occupiedReservations.length > 0 && day.isCurrentMonth && (
        <div className="absolute bottom-1 right-1">
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
            {occupiedReservations.length}
          </div>
        </div>
      )}

      {/* Overlay para adicionar reserva */}
      {day.isCurrentMonth && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="absolute top-2 right-2">
            <div className="bg-blue-500 text-white p-1 rounded-full text-xs">
              +
            </div>
          </div>
        </div>
      )}
    </div>
  );
}