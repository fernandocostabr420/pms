// frontend/src/components/rooms/RoomStats.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bed, 
  CheckCircle, 
  XCircle, 
  Wrench, 
  TrendingUp,
  Building
} from 'lucide-react';
import { RoomStats as RoomStatsType } from '@/types/rooms';

interface RoomStatsProps {
  stats: RoomStatsType;
  loading?: boolean;
}

export default function RoomStats({ stats, loading }: RoomStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsItems = [
    {
      label: 'Total Quartos',
      value: stats.total_rooms,
      icon: Building,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Operacionais',
      value: stats.operational_rooms,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Fora de Ordem',
      value: stats.out_of_order_rooms,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      label: 'Manutenção',
      value: stats.maintenance_rooms,
      icon: Wrench,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      label: 'Taxa Ocupação',
      value: `${Math.round(stats.occupancy_rate)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  const getOccupancyColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    if (rate >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statsItems.map((item, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`h-8 w-8 ${item.bgColor} rounded-full flex items-center justify-center`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              {index === 4 && ( // Taxa de ocupação
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                  <div 
                    className={`w-2 h-2 rounded-full ${getOccupancyColor(stats.occupancy_rate)}`}
                  ></div>
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </div>
              <div className="text-xs text-gray-600 font-medium">
                {item.label}
              </div>
            </div>

            {/* Barra de progresso para taxa de ocupação */}
            {index === 4 && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${getOccupancyColor(stats.occupancy_rate)} transition-all duration-300`}
                    style={{ width: `${Math.min(stats.occupancy_rate, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Badge de status para quartos operacionais */}
            {index === 1 && stats.total_rooms > 0 && (
              <div className="mt-2">
                <Badge 
                  variant={stats.operational_rooms === stats.total_rooms ? "default" : "secondary"}
                  className="text-xs"
                >
                  {stats.operational_rooms === stats.total_rooms ? '100% Ativo' : 
                   `${Math.round((stats.operational_rooms / stats.total_rooms) * 100)}% Ativo`}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}