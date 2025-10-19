// frontend/src/components/channel-manager/CalendarHeader.tsx
// Path: frontend/src/components/channel-manager/CalendarHeader.tsx

'use client';

import { format, parseISO, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AvailabilityCalendarResponse } from '@/types/channel-manager';

interface CalendarHeaderProps {
  dateRange: { from: Date; to: Date };
  data?: AvailabilityCalendarResponse | null;
}

export function CalendarHeader({ dateRange, data }: CalendarHeaderProps) {
  
  const getDatesFromRange = () => {
    const dates = [];
    const current = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    
    while (current <= end) {
      dates.push({
        date: format(current, 'yyyy-MM-dd'),
        summary: { total_rooms: 0, available_rooms: 0, blocked_rooms: 0 }
      });
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const dates = data?.calendar_data || getDatesFromRange();

  const getColumnStats = (dayData: typeof dates[0]) => {
    const total = dayData.summary.total_rooms;
    const available = dayData.summary.available_rooms;
    const blocked = dayData.summary.blocked_rooms;
    const occupied = total - available - blocked;
    
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    return { total, available, blocked, occupied, occupancyRate };
  };

  const getOccupancyBadgeVariant = (rate: number) => {
    if (rate >= 90) return "destructive";
    if (rate >= 70) return "default";
    if (rate >= 40) return "secondary";
    return "outline";
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
      <div className="flex">
        
        {/* ===== SIDEBAR HEADER (apenas título) ===== */}
        <div className="w-48 flex-shrink-0 border-r bg-gray-50">
          <div className="h-20 flex items-center justify-center border-b">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 text-sm">Quarto / Plano</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {data?.rooms_summary.length || 0} unidades
              </p>
            </div>
          </div>
        </div>

        {/* ===== DATE COLUMNS ===== */}
        <div className="flex overflow-x-auto">
          {dates.map((dayData) => {
            const date = parseISO(dayData.date);
            const stats = getColumnStats(dayData);
            const isCurrentDate = isToday(date);
            const isWeekendDate = isWeekend(date);
            
            return (
              <div
                key={dayData.date}
                className="w-24 flex-shrink-0 border-r"
              >
                {/* Header com data e estatísticas */}
                <div className={cn(
                  "h-20 p-2 border-b",
                  isCurrentDate && "bg-blue-50 border-blue-200",
                  isWeekendDate && !isCurrentDate && "bg-gray-50"
                )}>
                  <div className="flex flex-col items-center justify-center h-full space-y-1">
                    
                    {/* Dia da semana */}
                    <div className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      isCurrentDate ? "text-blue-700" : isWeekendDate ? "text-gray-600" : "text-gray-500"
                    )}>
                      {format(date, 'EEE', { locale: ptBR })}
                    </div>
                    
                    {/* Dia do mês */}
                    <div className={cn(
                      "text-lg font-bold leading-none",
                      isCurrentDate ? "text-blue-900" : "text-gray-900"
                    )}>
                      {format(date, 'dd')}
                    </div>
                    
                    {/* Mês */}
                    <div className={cn(
                      "text-xs",
                      isCurrentDate ? "text-blue-600" : "text-gray-500"
                    )}>
                      {format(date, 'MMM', { locale: ptBR })}
                    </div>

                    {/* Badge de ocupação (se tiver dados) */}
                    {data && stats.total > 0 && (
                      <Badge 
                        variant={getOccupancyBadgeVariant(stats.occupancyRate)}
                        className="text-xs px-1.5 py-0"
                      >
                        {stats.occupancyRate}%
                      </Badge>
                    )}
                    
                    {/* Indicador de hoje */}
                    {isCurrentDate && (
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}