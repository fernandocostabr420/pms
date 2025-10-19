// frontend/src/components/room-map/RoomMapStats.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bed,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Wrench
} from 'lucide-react';
import { MapStatsResponse, MapResponse } from '@/types/room-map';
import { cn } from '@/lib/utils';

interface RoomMapStatsProps {
  stats: MapStatsResponse | null;
  mapData?: MapResponse | null;
  loading?: boolean;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export default function RoomMapStats({
  stats,
  mapData,
  loading = false,
  className,
  layout = 'horizontal'
}: RoomMapStatsProps) {
  
  if (loading) {
    return (
      <div className={cn("grid gap-4", 
        layout === 'horizontal' ? 'grid-cols-4' : 
        layout === 'vertical' ? 'grid-cols-1' : 
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        className
      )}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
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

  if (!stats) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Estatísticas não disponíveis</p>
      </div>
    );
  }

  const mainStats = [
    {
      title: 'Ocupação',
      value: `${Math.round(stats.occupancy_rate)}%`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: `${stats.occupied_room_nights} de ${stats.total_room_nights} quartos/noite`,
      trend: stats.occupancy_rate >= 80 ? 'high' : stats.occupancy_rate >= 60 ? 'medium' : 'low'
    },
    {
      title: 'Receita Total',
      value: `R$ ${stats.total_revenue.toLocaleString('pt-BR')}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: `Diária média: R$ ${Math.round(stats.average_daily_rate)}`,
      breakdown: {
        confirmed: stats.confirmed_revenue,
        pending: stats.pending_revenue
      }
    },
    {
      title: 'Reservas',
      value: stats.total_reservations,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: `${stats.arrivals} chegadas, ${stats.departures} saídas`,
      breakdown: {
        confirmed: stats.confirmed_reservations,
        checkedIn: stats.checked_in_reservations,
        pending: stats.pending_reservations,
        cancelled: stats.cancelled_reservations
      }
    },
    {
      title: 'Quartos',
      value: `${stats.operational_rooms}/${stats.total_rooms}`,
      icon: Bed,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: 'quartos operacionais',
      breakdown: {
        operational: stats.operational_rooms,
        outOfOrder: stats.out_of_order_rooms,
        maintenance: stats.maintenance_rooms
      }
    }
  ];

  const statusStats = [
    {
      label: 'Confirmadas',
      value: stats.confirmed_reservations,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      label: 'Check-in',
      value: stats.checked_in_reservations,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      label: 'Pendentes',
      value: stats.pending_reservations,
      icon: Clock,
      color: 'text-yellow-600'
    },
    {
      label: 'Canceladas',
      value: stats.cancelled_reservations,
      icon: XCircle,
      color: 'text-red-600'
    }
  ];

  const operationalStats = [
    {
      label: 'Operacionais',
      value: stats.operational_rooms,
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      label: 'Fora de ordem',
      value: stats.out_of_order_rooms,
      icon: AlertTriangle,
      color: 'text-red-600'
    },
    {
      label: 'Manutenção',
      value: stats.maintenance_rooms,
      icon: Wrench,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Cards principais */}
      <div className={cn("grid gap-4", 
        layout === 'horizontal' ? 'grid-cols-4' : 
        layout === 'vertical' ? 'grid-cols-1' : 
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      )}>
        {mainStats.map((stat, index) => {
          const IconComponent = stat.icon;
          
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <IconComponent className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">
                    {typeof stat.value === 'number' 
                      ? stat.value.toLocaleString('pt-BR')
                      : stat.value
                    }
                  </div>
                  {stat.title === 'Ocupação' && (
                    <Badge 
                      variant={
                        stat.trend === 'high' ? 'default' : 
                        stat.trend === 'medium' ? 'secondary' : 'outline'
                      }
                      className="text-xs"
                    >
                      {stat.trend === 'high' ? 'Alta' : 
                       stat.trend === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhes adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status das reservas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Status das Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {statusStats.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                    <span className="font-medium">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status dos quartos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Status dos Quartos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operationalStats.map((item, index) => {
                const IconComponent = item.icon;
                const percentage = stats.total_rooms > 0 
                  ? Math.round((item.value / stats.total_rooms) * 100)
                  : 0;
                
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.value}</span>
                      <Badge variant="outline" className="text-xs">
                        {percentage}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo do período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.arrivals}</div>
              <div className="text-sm text-gray-500">Chegadas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.departures}</div>
              <div className="text-sm text-gray-500">Saídas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.stayovers}</div>
              <div className="text-sm text-gray-500">Pernoites</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                R$ {Math.round(stats.revenue_per_available_room)}
              </div>
              <div className="text-sm text-gray-500">RevPAR</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorias (se disponível) */}
      {stats.category_stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempenho por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.category_stats.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{category.room_type_name}</div>
                    <div className="text-sm text-gray-500">
                      {category.total_rooms} quartos • {category.total_reservations} reservas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">
                      R$ {category.total_revenue.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {Math.round(category.occupancy_rate)}% ocupação
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}