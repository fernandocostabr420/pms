// frontend/src/components/reservations/ReservationStats.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Home,
  Percent
} from 'lucide-react';
import { ReservationStats } from '@/types/reservation';

interface ReservationStatsProps {
  stats: ReservationStats;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function ReservationStatsComponent({
  stats,
  className,
  layout = 'horizontal'
}: ReservationStatsProps) {
  
  const statCards = [
    {
      title: 'Total de Reservas',
      value: stats.total_reservations,
      icon: Calendar,
      color: 'blue',
      description: 'Todas as reservas',
    },
    {
      title: 'Confirmadas',
      value: stats.confirmed_reservations,
      icon: CheckCircle,
      color: 'green',
      description: 'Reservas confirmadas',
      percentage: stats.total_reservations > 0 ? 
        Math.round((stats.confirmed_reservations / stats.total_reservations) * 100) : 0,
    },
    {
      title: 'Check-in Feito',
      value: stats.checked_in_reservations,
      icon: Users,
      color: 'purple',
      description: 'Hóspedes no hotel',
      percentage: stats.total_reservations > 0 ? 
        Math.round((stats.checked_in_reservations / stats.total_reservations) * 100) : 0,
    },
    {
      title: 'Pendentes',
      value: stats.pending_reservations,
      icon: Clock,
      color: 'amber',
      description: 'Aguardando confirmação',
      percentage: stats.total_reservations > 0 ? 
        Math.round((stats.pending_reservations / stats.total_reservations) * 100) : 0,
    },
    {
      title: 'Canceladas',
      value: stats.cancelled_reservations,
      icon: AlertTriangle,
      color: 'red',
      description: 'Reservas canceladas',
      percentage: stats.total_reservations > 0 ? 
        Math.round((stats.cancelled_reservations / stats.total_reservations) * 100) : 0,
    },
    {
      title: 'Receita Total',
      value: formatCurrency(stats.total_revenue || 0),
      icon: DollarSign,
      color: 'emerald',
      description: 'Valor total das reservas',
      showTrend: true,
    },
    {
      title: 'Taxa de Ocupação',
      value: `${Math.round(stats.occupancy_rate || 0)}%`,
      icon: Percent,
      color: stats.occupancy_rate >= 80 ? 'red' : stats.occupancy_rate >= 50 ? 'amber' : 'green',
      description: 'Ocupação atual',
    },
    {
      title: 'Quartos Disponíveis',
      value: stats.available_rooms,
      icon: Home,
      color: 'gray',
      description: 'Quartos livres',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      purple: 'text-purple-600 bg-purple-100',
      amber: 'text-amber-600 bg-amber-100',
      red: 'text-red-600 bg-red-100',
      emerald: 'text-emerald-600 bg-emerald-100',
      gray: 'text-gray-600 bg-gray-100',
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  if (layout === 'vertical') {
    return (
      <div className={`space-y-4 ${className}`}>
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getColorClasses(stat.color)}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-sm text-gray-500">{stat.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.percentage !== undefined && (
                    <p className="text-sm text-gray-500">{stat.percentage}%</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {statCards.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                {stat.percentage !== undefined && (
                  <div className="flex items-center mt-1">
                    <Badge variant="outline" className="text-xs">
                      {stat.percentage}%
                    </Badge>
                    <span className="text-xs text-gray-500 ml-2">do total</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
              <div className={`p-3 rounded-full ${getColorClasses(stat.color)}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}