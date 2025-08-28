// frontend/src/components/calendar/CalendarStats.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  Users,
  DollarSign,
  ArrowUpDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarStats, CalendarReservation } from '@/types/calendar';
import { formatCurrency, calculateTotalRevenue } from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';

interface CalendarStatsProps {
  stats: CalendarStats;
  currentDate: Date;
  reservations?: CalendarReservation[];
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export default function CalendarStatsComponent({
  stats,
  currentDate,
  reservations = [],
  className,
  layout = 'horizontal'
}: CalendarStatsProps) {
  const monthYear = format(currentDate, 'MMMM yyyy', { locale: ptBR });
  const revenue = reservations.length > 0 ? calculateTotalRevenue(reservations) : 0;
  
  // Estatísticas calculadas
  const pendingReservations = reservations.filter(r => r.status === 'pending').length;
  const confirmedReservations = reservations.filter(r => r.status === 'confirmed').length;
  const activeReservations = stats.checked_in;
  const averageStay = reservations.length > 0 ? 
    reservations.reduce((sum, r) => sum + r.nights, 0) / reservations.length : 0;

  const statCards = [
    {
      title: 'Reservas Totais',
      value: stats.total_reservations,
      icon: Calendar,
      color: 'blue',
      description: `Em ${monthYear.toLowerCase()}`,
    },
    {
      title: 'Ocupação Atual',
      value: `${Math.round(stats.occupancy_rate)}%`,
      icon: Users,
      color: stats.occupancy_rate >= 80 ? 'red' : stats.occupancy_rate >= 50 ? 'yellow' : 'green',
      description: `${stats.checked_in} de ${stats.checked_in + stats.available_rooms} quartos`,
    },
    {
      title: 'Receita Estimada',
      value: formatCurrency(revenue),
      icon: DollarSign,
      color: 'green',
      description: `Período selecionado`,
    },
    {
      title: 'Movimento Hoje',
      value: stats.arriving_today + stats.departing_today,
      icon: ArrowUpDown,
      color: 'orange',
      description: `${stats.arriving_today} chegadas, ${stats.departing_today} saídas`,
    },
  ];

  const additionalStats = [
    {
      label: 'Pendentes',
      value: pendingReservations,
      icon: Clock,
      color: 'yellow',
    },
    {
      label: 'Confirmadas',
      value: confirmedReservations,
      icon: CheckCircle,
      color: 'blue',
    },
    {
      label: 'Ativas',
      value: activeReservations,
      icon: Users,
      color: 'green',
    },
    {
      label: 'Estadia Média',
      value: `${averageStay.toFixed(1)} dias`,
      icon: TrendingUp,
      color: 'purple',
    },
  ];

  if (layout === 'vertical') {
    return (
      <div className={cn("space-y-4", className)}>
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <StatCardContent stat={stat} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (layout === 'grid') {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <StatCardContent stat={stat} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Layout horizontal (padrão)
  return (
    <div className={cn("space-y-6", className)}>
      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <StatCardContent stat={stat} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estatísticas adicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Detalhamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {additionalStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className={cn(
                    "p-2 rounded-full",
                    stat.color === 'blue' && "bg-blue-100",
                    stat.color === 'green' && "bg-green-100",
                    stat.color === 'yellow' && "bg-yellow-100",
                    stat.color === 'red' && "bg-red-100",
                    stat.color === 'orange' && "bg-orange-100",
                    stat.color === 'purple' && "bg-purple-100"
                  )}>
                    <stat.icon className={cn(
                      "h-4 w-4",
                      stat.color === 'blue' && "text-blue-600",
                      stat.color === 'green' && "text-green-600",
                      stat.color === 'yellow' && "text-yellow-600",
                      stat.color === 'red' && "text-red-600",
                      stat.color === 'orange' && "text-orange-600",
                      stat.color === 'purple' && "text-purple-600"
                    )} />
                  </div>
                </div>
                <div className="font-semibold text-lg">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alertas e notificações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reservas pendentes */}
        {pendingReservations > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <div className="font-semibold text-yellow-800">
                    {pendingReservations} Reserva{pendingReservations !== 1 ? 's' : ''} Pendente{pendingReservations !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-yellow-700">
                    Aguardando confirmação
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ocupação alta */}
        {stats.occupancy_rate >= 90 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <div className="font-semibold text-red-800">
                    Ocupação Muito Alta
                  </div>
                  <div className="text-sm text-red-700">
                    {Math.round(stats.occupancy_rate)}% de ocupação
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Movimento intenso */}
        {(stats.arriving_today + stats.departing_today) > 10 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ArrowUpDown className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-800">
                    Movimento Intenso Hoje
                  </div>
                  <div className="text-sm text-blue-700">
                    {stats.arriving_today + stats.departing_today} movimentações
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quartos disponíveis baixos */}
        {stats.available_rooms <= 2 && stats.available_rooms > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="font-semibold text-orange-800">
                    Poucos Quartos Disponíveis
                  </div>
                  <div className="text-sm text-orange-700">
                    Apenas {stats.available_rooms} quarto{stats.available_rooms !== 1 ? 's' : ''} disponível{stats.available_rooms !== 1 ? 'eis' : ''}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface StatCardContentProps {
  stat: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    description?: string;
  };
}

function StatCardContent({ stat }: StatCardContentProps) {
  const Icon = stat.icon;
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">
          {stat.title}
        </p>
        <p className="text-2xl font-bold text-gray-900 mb-1">
          {stat.value}
        </p>
        {stat.description && (
          <p className="text-xs text-gray-500">
            {stat.description}
          </p>
        )}
      </div>
      <div className={cn(
        "p-3 rounded-full",
        stat.color === 'blue' && "bg-blue-100",
        stat.color === 'green' && "bg-green-100",
        stat.color === 'yellow' && "bg-yellow-100",
        stat.color === 'red' && "bg-red-100",
        stat.color === 'orange' && "bg-orange-100",
        stat.color === 'purple' && "bg-purple-100"
      )}>
        <Icon className={cn(
          "h-6 w-6",
          stat.color === 'blue' && "text-blue-600",
          stat.color === 'green' && "text-green-600",
          stat.color === 'yellow' && "text-yellow-600",
          stat.color === 'red' && "text-red-600",
          stat.color === 'orange' && "text-orange-600",
          stat.color === 'purple' && "text-purple-600"
        )} />
      </div>
    </div>
  );
}