// frontend/src/components/payments/PaymentStats.tsx
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  DollarSign, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  RefreshCw,
  ArrowUpIcon,
  ArrowDownIcon
} from 'lucide-react';
import { PaymentStats as PaymentStatsType } from '@/types/payment';
import { cn } from '@/lib/utils';

interface PaymentStatsProps {
  stats: PaymentStatsType | null;
  loading?: boolean;
}

export default function PaymentStats({ stats, loading = false }: PaymentStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  };

  const confirmationRate = stats.total_payments > 0 
    ? (stats.confirmed_payments / stats.total_payments) * 100 
    : 0;

  const statsItems = [
    {
      title: "Total de Pagamentos",
      value: stats.total_payments.toString(),
      subtitle: formatCurrency(stats.total_amount),
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Pendentes",
      value: stats.pending_payments.toString(),
      subtitle: formatCurrency(stats.pending_amount),
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Confirmados",
      value: stats.confirmed_payments.toString(),
      subtitle: formatCurrency(stats.confirmed_amount),
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Taxa de Confirmação",
      value: `${confirmationRate.toFixed(1)}%`,
      subtitle: `${stats.confirmed_payments} de ${stats.total_payments}`,
      icon: confirmationRate >= 80 ? ArrowUpIcon : ArrowDownIcon,
      color: confirmationRate >= 80 ? "text-green-600" : "text-red-600",
      bgColor: confirmationRate >= 80 ? "bg-green-100" : "bg-red-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsItems.map((item, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">{item.title}</p>
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                {item.subtitle && (
                  <p className="text-sm text-gray-500">{item.subtitle}</p>
                )}
              </div>
              <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", item.bgColor)}>
                <item.icon className={cn("h-6 w-6", item.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}