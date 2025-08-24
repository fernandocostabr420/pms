// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  Building, 
  DollarSign,
  ArrowUpIcon,
  ArrowDownIcon,
  Clock
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface DashboardStats {
  total_reservations: number;
  arrivals_today: number;
  departures_today: number;
  current_guests: number;
  total_revenue: number;
  pending_revenue: number;
}

interface TodaysReservations {
  arrivals: any[];
  departures: any[];
  current_guests: any[];
  arrivals_count: number;
  departures_count: number;
  current_guests_count: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todaysData, setTodaysData] = useState<TodaysReservations | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Carregar estatísticas gerais
        const dashboardStats = await apiClient.getDashboardStats();
        setStats(dashboardStats);

        // Carregar dados de hoje
        const todaysReservations = await apiClient.getTodaysReservations();
        setTodaysData(todaysReservations);

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Bem-vindo, {user?.full_name}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Bem-vindo, {user?.full_name} · {today}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reservas Totais</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_reservations || 0}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hóspedes Atuais</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.current_guests || 0}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Receita Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {(stats?.total_revenue || 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">A Receber</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {(stats?.pending_revenue || 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chegadas Hoje */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chegadas Hoje</CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 mb-2">
              {todaysData?.arrivals_count || 0}
            </div>
            <div className="space-y-2">
              {todaysData?.arrivals?.slice(0, 3).map((reservation, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {reservation.guest_name || `Reserva ${reservation.reservation_number}`}
                  </span>
                  <Badge variant="outline">
                    {reservation.status}
                  </Badge>
                </div>
              )) || (
                <p className="text-sm text-gray-500">Nenhuma chegada hoje</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saídas Hoje */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas Hoje</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {todaysData?.departures_count || 0}
            </div>
            <div className="space-y-2">
              {todaysData?.departures?.slice(0, 3).map((reservation, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {reservation.guest_name || `Reserva ${reservation.reservation_number}`}
                  </span>
                  <Badge variant="outline">
                    {reservation.status}
                  </Badge>
                </div>
              )) || (
                <p className="text-sm text-gray-500">Nenhuma saída hoje</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Nova Reserva</div>
              <div className="text-xs text-gray-500">Criar uma nova reserva</div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Novo Hóspede</div>
              <div className="text-xs text-gray-500">Cadastrar hóspede</div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Ver Calendário</div>
              <div className="text-xs text-gray-500">Visualizar ocupação</div>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}