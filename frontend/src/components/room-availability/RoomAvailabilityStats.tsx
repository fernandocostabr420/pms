// frontend/src/components/room-availability/RoomAvailabilityStats.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  BarChart3,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { AvailabilityStatsResponse } from '@/types/room-availability';

interface RoomAvailabilityStatsProps {
  stats: AvailabilityStatsResponse | null;
  loading?: boolean;
  period?: string;
}

export default function RoomAvailabilityStats({ 
  stats, 
  loading,
  period = "atual"
}: RoomAvailabilityStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                  <div className="w-16 h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Disponíveis',
      value: stats.available_rooms,
      total: stats.total_rooms,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      percentage: stats.availability_rate,
    },
    {
      title: 'Reservados',
      value: stats.reserved_rooms,
      total: stats.total_rooms,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      percentage: stats.occupancy_rate,
    },
    {
      title: 'Bloqueados',
      value: stats.blocked_rooms,
      total: stats.total_rooms,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      percentage: stats.total_rooms > 0 ? (stats.blocked_rooms / stats.total_rooms) * 100 : 0,
    },
    {
      title: 'Manutenção',
      value: stats.maintenance_rooms + stats.out_of_order_rooms,
      total: stats.total_rooms,
      icon: Settings,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      percentage: stats.total_rooms > 0 ? 
        ((stats.maintenance_rooms + stats.out_of_order_rooms) / stats.total_rooms) * 100 : 0,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const percentageFormatted = stat.percentage.toFixed(1);
          
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 ${stat.bgColor} rounded-lg`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">{stat.title}</div>
                      <div className="text-lg font-semibold">{stat.value}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {stat.value} / {stat.total}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {percentageFormatted}%
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${stat.bgColor.replace('bg-', 'bg-').replace('-100', '-500')}`}
                      style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              <h3 className="font-medium">Resumo - Período {period}</h3>
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">
                  Taxa de Disponibilidade: {stats.availability_rate.toFixed(1)}%
                </span>
                {stats.availability_rate >= 80 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">
                  Taxa de Ocupação: {stats.occupancy_rate.toFixed(1)}%
                </span>
                {stats.occupancy_rate >= 70 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}