// frontend/src/components/calendar/CalendarView.tsx
'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarMonth, CalendarReservation } from '@/types/calendar';
import ReservationCard from './ReservationCard';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  calendarMonth: CalendarMonth | null;
  loading: boolean;
  onDayClick: (date: Date) => void;
  onReservationClick: (reservation: CalendarReservation) => void;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function CalendarView({
  calendarMonth,
  loading,
  onDayClick,
  onReservationClick
}: CalendarViewProps) {
  if (loading || !calendarMonth) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          {/* Header dos dias da semana */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="bg-gray-200 h-8 rounded"></div>
            ))}
          </div>
          
          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="bg-gray-100 h-32 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {WEEKDAYS.map((dayName) => (
          <div
            key={dayName}
            className="bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-700"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Grid das semanas */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {calendarMonth.weeks.map((week, weekIndex) =>
          week.days.map((day, dayIndex) => (
            <CalendarDayCell
              key={`${weekIndex}-${dayIndex}`}
              day={day}
              onDayClick={onDayClick}
              onReservationClick={onReservationClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CalendarDayCellProps {
  day: {
    date: Date;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    reservations: CalendarReservation[];
  };
  onDayClick: (date: Date) => void;
  onReservationClick: (reservation: CalendarReservation) => void;
}

function CalendarDayCell({ day, onDayClick, onReservationClick }: CalendarDayCellProps) {
  const dayNumber = format(day.date, 'd');
  
  // Estatísticas do dia
  const arrivals = day.reservations.filter(r => r.check_in_date === day.dateStr).length;
  const departures = day.reservations.filter(r => r.check_out_date === day.dateStr).length;
  const occupied = day.reservations.filter(r => 
    r.status === 'checked_in' && 
    day.dateStr >= r.check_in_date && 
    day.dateStr < r.check_out_date
  ).length;

  // Apenas reservas que realmente ocupam o quarto neste dia
  const occupyingReservations = day.reservations.filter(r => 
    r.status === 'checked_in' || r.status === 'confirmed'
  );

  return (
    <div
      className={cn(
        'bg-white min-h-[120px] p-1 relative cursor-pointer transition-colors border-b border-r border-gray-100',
        'hover:bg-gray-50',
        !day.isCurrentMonth && 'bg-gray-50 text-gray-400',
        day.isToday && 'bg-blue-50 border-blue-200',
        day.isWeekend && day.isCurrentMonth && 'bg-gray-50',
      )}
      onClick={() => onDayClick(day.date)}
    >
      {/* Número do dia */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-sm font-medium',
            day.isToday && 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs',
            !day.isCurrentMonth && 'text-gray-400'
          )}
        >
          {dayNumber}
        </span>

        {/* Indicador de ações */}
        {day.isCurrentMonth && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDayClick(day.date);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
            title="Nova reserva"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Indicadores de atividade */}
      {day.isCurrentMonth && (arrivals > 0 || departures > 0) && (
        <div className="flex gap-1 mb-1">
          {arrivals > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 bg-green-100 text-green-700 border-green-300">
              ↓{arrivals}
            </Badge>
          )}
          {departures > 0 && (
            <Badge variant="outline" className="text-xs px-1 py-0 bg-orange-100 text-orange-700 border-orange-300">
              ↑{departures}
            </Badge>
          )}
        </div>
      )}

      {/* Reservas ocupando o quarto */}
      <div className="space-y-1 overflow-hidden">
        {occupyingReservations.slice(0, 2).map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            onClick={onReservationClick}
            compact
          />
        ))}
        
        {occupyingReservations.length > 2 && (
          <div className="text-xs text-gray-500 text-center py-1">
            +{occupyingReservations.length - 2} mais
          </div>
        )}
      </div>

      {/* Contador de ocupados */}
      {occupied > 0 && day.isCurrentMonth && (
        <div className="absolute bottom-1 right-1">
          <div className="bg-gray-700 text-white text-xs px-1.5 py-0.5 rounded-full">
            {occupied}
          </div>
        </div>
      )}
    </div>
  );
}