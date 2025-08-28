// frontend/src/components/room-types/RoomTypeStats.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag, Users, Bed, CheckCircle } from 'lucide-react';

interface RoomTypeStatsProps {
  stats: {
    total_room_types: number;
    bookable_room_types: number;
    total_rooms: number;
    average_capacity: number;
  };
  loading?: boolean;
}

export default function RoomTypeStats({ stats, loading = false }: RoomTypeStatsProps) {
  const statItems = [
    {
      title: 'Total de Tipos',
      value: stats.total_room_types,
      icon: Tag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'tipos cadastrados'
    },
    {
      title: 'Tipos Reserváveis',
      value: stats.bookable_room_types,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'disponíveis para reserva',
      percentage: stats.total_room_types > 0 
        ? Math.round((stats.bookable_room_types / stats.total_room_types) * 100)
        : 0
    },
    {
      title: 'Capacidade Média',
      value: stats.average_capacity,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'pessoas por tipo',
      suffix: ' pessoas'
    },
    {
      title: 'Total de Quartos',
      value: stats.total_rooms || 0,
      icon: Bed,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'quartos cadastrados'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardTitle>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => {
        const IconComponent = item.icon;
        
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {item.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${item.bgColor}`}>
                <IconComponent className={`h-4 w-4 ${item.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">
                  {typeof item.value === 'number' && item.value % 1 !== 0
                    ? item.value.toFixed(1)
                    : item.value
                  }
                  {item.suffix}
                </div>
                {item.percentage !== undefined && (
                  <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                    item.percentage >= 80 
                      ? 'bg-green-100 text-green-800'
                      : item.percentage >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {item.percentage}%
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {item.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}