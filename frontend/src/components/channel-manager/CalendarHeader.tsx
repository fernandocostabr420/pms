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
  
  // Se não temos dados ainda, criar lista de datas do range
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

  // Calcular estatísticas para cada coluna
  const getColumnStats = (dayData: typeof dates[0]) => {
    const total = dayData.summary.total_rooms;
    const available = dayData.summary.available_rooms;
    const blocked = dayData.summary.blocked_rooms;
    const occupied = total - available - blocked;
    
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    return {
      total,
      available,
      blocked,
      occupied,
      occupancyRate
    };
  };

  // Determinar cor do badge de ocupação
  const getOccupancyBadgeVariant = (rate: number) => {
    if (rate >= 90) return "destructive"; // Vermelho - quase lotado
    if (rate >= 70) return "default";     // Azul - boa ocupação
    if (rate >= 40) return "secondary";   // Cinza - ocupação média
    return "outline";                     // Outline - baixa ocupação
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="flex">
        
        {/* ===== ROOM COLUMN HEADER ===== */}
        <div className="flex-none w-64 border-r bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Quartos</h3>
              <p className="text-xs text-gray-500 mt-1">
                {data?.rooms_summary.length || 0} unidades
              </p>
            </div>
            
            {/* Resumo geral de quartos */}
            {data && (
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {data.rooms_summary.filter(r => r.has_channel_mapping).length}
                </div>
                <p className="text-xs text-gray-500">mapeados</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== DATE COLUMNS ===== */}
        <div className="flex-1 flex overflow-x-auto">
          {dates.map((dayData, index) => {
            const date = parseISO(dayData.date);
            const stats = getColumnStats(dayData);
            const isCurrentDate = isToday(date);
            const isWeekendDate = isWeekend(date);
            
            return (
              <div
                key={dayData.date}
                className={cn(
                  "flex-none w-32 border-r p-3 min-h-[80px]",
                  isCurrentDate && "bg-blue-50 border-blue-200",
                  isWeekendDate && !isCurrentDate && "bg-gray-50"
                )}
              >
                <div className="space-y-2">
                  
                  {/* Data */}
                  <div className="text-center">
                    <div className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      isCurrentDate ? "text-blue-700" : isWeekendDate ? "text-gray-600" : "text-gray-500"
                    )}>
                      {format(date, 'EEE', { locale: ptBR })}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      isCurrentDate ? "text-blue-900" : "text-gray-900"
                    )}>
                      {format(date, 'dd')}
                    </div>
                    <div className={cn(
                      "text-xs",
                      isCurrentDate ? "text-blue-600" : "text-gray-500"
                    )}>
                      {format(date, 'MMM', { locale: ptBR })}
                    </div>
                  </div>

                  {/* Estatísticas do dia */}
                  {data && stats.total > 0 && (
                    <div className="space-y-1">
                      
                      {/* Badge de ocupação */}
                      <div className="flex justify-center">
                        <Badge 
                          variant={getOccupancyBadgeVariant(stats.occupancyRate)}
                          className="text-xs px-2 py-0"
                        >
                          {stats.occupancyRate}%
                        </Badge>
                      </div>
                      
                      {/* Detalhes */}
                      <div className="text-center space-y-0.5">
                        <div className="flex justify-center items-center gap-2 text-xs">
                          <span className="text-green-600 font-medium">
                            {stats.available}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className="text-gray-600">
                            {stats.total}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          disponíveis
                        </div>
                        
                        {stats.blocked > 0 && (
                          <div className="text-xs text-red-600">
                            {stats.blocked} bloqueados
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Indicador de hoje */}
                  {isCurrentDate && (
                    <div className="flex justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECOND ROW - FIELD HEADERS ===== */}
      <div className="flex border-t bg-gray-50">
        
        {/* Room info header */}
        <div className="flex-none w-64 border-r p-2">
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-gray-600">
            <div className="text-center">Preço</div>
            <div className="text-center">Disp</div>
            <div className="text-center">Rest</div>
          </div>
        </div>

        {/* Date columns field headers */}
        <div className="flex-1 flex overflow-x-auto">
          {dates.map((dayData) => (
            <div
              key={`header-${dayData.date}`}
              className="flex-none w-32 border-r p-2"
            >
              <div className="grid grid-cols-3 gap-1 text-xs font-medium text-gray-600">
                <div className="text-center">R$</div>
                <div className="text-center">#</div>
                <div className="text-center">
                  <div className="flex justify-center gap-0.5">
                    <span title="Closed to Arrival" className="w-2 h-2 border border-gray-300 rounded-sm"></span>
                    <span title="Closed to Departure" className="w-2 h-2 border border-gray-300 rounded-sm"></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}