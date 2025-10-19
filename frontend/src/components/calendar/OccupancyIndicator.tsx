// frontend/src/components/calendar/OccupancyIndicator.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Building, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Home,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarStats } from '@/types/calendar';
import { getOccupancyColor, formatCurrency, OCCUPANCY_LEVELS } from '@/lib/calendar-utils';

interface OccupancyIndicatorProps {
  stats: CalendarStats;
  className?: string;
  compact?: boolean;
  showTrend?: boolean;
  previousStats?: CalendarStats;
}

export default function OccupancyIndicator({
  stats,
  className,
  compact = false,
  showTrend = false,
  previousStats
}: OccupancyIndicatorProps) {
  const occupancyRate = stats.occupancy_rate || 0;
  const totalRooms = stats.available_rooms + stats.checked_in;
  const occupiedRooms = stats.checked_in;
  
  // Calcular tendência se dados anteriores fornecidos
  const trend = showTrend && previousStats ? 
    stats.occupancy_rate - previousStats.occupancy_rate : null;

  // Determinar cor baseada na ocupação
  const occupancyColor = getOccupancyColor(occupancyRate / 100);
  
  // Determinar nível de ocupação
  const occupancyLevel = occupancyRate >= 80 ? OCCUPANCY_LEVELS.HIGH :
                        occupancyRate >= 50 ? OCCUPANCY_LEVELS.MEDIUM :
                        OCCUPANCY_LEVELS.LOW;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1">
          <Home className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">
            {occupiedRooms}/{totalRooms}
          </span>
        </div>
        <Badge 
          variant="outline" 
          className={cn("text-xs", `bg-${occupancyLevel.color}-100 text-${occupancyLevel.color}-700`)}
        >
          {Math.round(occupancyRate)}%
        </Badge>
        {trend !== null && (
          <div className="flex items-center">
            {trend > 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trend < 0 ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-gray-500" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="h-5 w-5 text-gray-500" />
              Taxa de Ocupação
            </h3>
            <Badge 
              variant="outline"
              className={cn(
                "px-3 py-1",
                occupancyLevel.color === 'red' && "bg-red-100 text-red-700 border-red-200",
                occupancyLevel.color === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                occupancyLevel.color === 'green' && "bg-green-100 text-green-700 border-green-200"
              )}
            >
              {occupancyLevel.label}
            </Badge>
          </div>

          {/* Percentual Principal */}
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {Math.round(occupancyRate)}%
            </div>
            <div className="text-sm text-gray-600">
              {occupiedRooms} de {totalRooms} quartos ocupados
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={occupancyRate} 
              className="h-3"
              // className={cn("h-3", occupancyColor)}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Detalhamento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Ocupados</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {occupiedRooms}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Home className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Disponíveis</span>
              </div>
              <div className="text-2xl font-bold text-gray-600">
                {stats.available_rooms}
              </div>
            </div>
          </div>

          {/* Estatísticas Adicionais */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total de Reservas:</span>
              <span className="font-medium">{stats.total_reservations}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Chegadas Hoje:</span>
              <span className="font-medium text-orange-600">{stats.arriving_today}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Saídas Hoje:</span>
              <span className="font-medium text-blue-600">{stats.departing_today}</span>
            </div>
          </div>

          {/* Tendência */}
          {showTrend && trend !== null && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-600">Tendência:</span>
                {trend > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600">
                      +{Math.abs(trend).toFixed(1)}%
                    </span>
                  </>
                ) : trend < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">
                      -{Math.abs(trend).toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">
                      Estável
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Progress se não existir
export function Progress({ value, className, ...props }: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", className)} {...props}>
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}