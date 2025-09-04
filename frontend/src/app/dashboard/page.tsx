// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Users, 
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  UserPlus,
  Plus,
  Map,
  CreditCard,
  ArrowUpIcon,
  ArrowDownIcon,
  Home,
  RefreshCw
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { 
  RecentReservationResponse, 
  CheckedInPendingPayment, 
  DashboardSummary, 
  TodaysReservationsImproved 
} from '@/lib/api';

// IMPORTS - Componentes de Modal
import StandardReservationModal from '@/components/reservations/StandardReservationModal';
import GuestModal from '@/components/guests/GuestModal';

// Estado para gerenciar todos os dados do dashboard
interface DashboardData {
  summary: DashboardSummary | null;
  recentReservations: RecentReservationResponse[];
  pendingPayments: CheckedInPendingPayment[];
  todaysData: TodaysReservationsImproved | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    summary: null,
    recentReservations: [],
    pendingPayments: [],
    todaysData: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ESTADOS - Controle dos Modais
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [showNewGuestModal, setShowNewGuestModal] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Função para carregar todos os dados do dashboard
  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Carregar todos os dados em paralelo
      const [summary, recentReservations, pendingPayments, todaysData] = await Promise.allSettled([
        apiClient.getDashboardSummary(),
        apiClient.getRecentReservations(5),
        apiClient.getCheckedInPendingPayments(5),
        apiClient.getTodaysReservationsImproved(undefined, false)
      ]);

      // Processar resultados
      setData({
        summary: summary.status === 'fulfilled' ? summary.value : null,
        recentReservations: recentReservations.status === 'fulfilled' ? recentReservations.value : [],
        pendingPayments: pendingPayments.status === 'fulfilled' ? pendingPayments.value : [],
        todaysData: todaysData.status === 'fulfilled' ? todaysData.value : null
      });

      // Mostrar erros se houver
      const errors = [summary, recentReservations, pendingPayments, todaysData]
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason);

      if (errors.length > 0 && !isRefresh) {
        console.error('Erros ao carregar dashboard:', errors);
        toast({
          title: "Aviso",
          description: "Alguns dados podem estar desatualizados. Tente atualizar a página.",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      if (!isRefresh) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do dashboard.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadDashboardData();
  }, []);

  // HANDLERS DOS MODAIS
  const handleNewReservation = () => {
    setShowNewReservationModal(true);
  };

  const handleNewGuest = () => {
    setShowNewGuestModal(true);
  };

  const handleNewReservationSuccess = () => {
    setShowNewReservationModal(false);
    loadDashboardData(true);
    toast({
      title: "Sucesso",
      description: "Reserva criada com sucesso!"
    });
  };

  const handleNewGuestSuccess = () => {
    setShowNewGuestModal(false);
    loadDashboardData(true);
    toast({
      title: "Sucesso", 
      description: "Hóspede cadastrado com sucesso!"
    });
  };

  // OUTRAS FUNÇÕES
  const handleViewRoomMap = () => {
    router.push('/dashboard/room-map');
  };

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  // FUNÇÃO SIMPLES PARA NAVEGAÇÃO - SEM useCallback
  const goToReservation = (reservationId: number) => {
    router.push(`/dashboard/reservations/${reservationId}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded"></div>
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

  const { summary, recentReservations, pendingPayments, todaysData } = data;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Bem-vindo, {user?.full_name} · {today}
            </p>
          </div>
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline" 
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards - Apenas os 3 solicitados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-ins Hoje</p>
                  <p className="text-2xl font-bold text-green-600">
                    {todaysData?.arrivals_count || 0}
                  </p>
                </div>
                <ArrowDownIcon className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-outs Hoje</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {todaysData?.departures_count || 0}
                  </p>
                </div>
                <ArrowUpIcon className="h-5 w-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pagamentos Pendentes</p>
                  <p className="text-2xl font-bold text-red-600">
                    {summary?.checked_in_with_pending_payment || 0}
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seção Principal - 3 Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Últimas Reservas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Últimas Reservas</CardTitle>
              <Calendar className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReservations.length > 0 ? (
                recentReservations.map((reservation) => (
                  <div 
                    key={reservation.id} 
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => goToReservation(reservation.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {reservation.guest_name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {reservation.reservation_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(reservation.check_in_date).toLocaleDateString('pt-BR')} - {reservation.nights}n
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge 
                        variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}
                        className="mb-1"
                      >
                        {reservation.status}
                      </Badge>
                      <p className="text-xs font-medium text-gray-900">
                        R$ {reservation.total_amount?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhuma reserva recente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check-ins com Saldo Pendente */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldos em Aberto</CardTitle>
              <CreditCard className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingPayments.length > 0 ? (
                pendingPayments.map((payment) => (
                  <div 
                    key={payment.reservation_id} 
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => goToReservation(payment.reservation_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {payment.guest_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Quarto {payment.room_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {payment.days_since_checkin} dias desde check-in
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge 
                        variant={payment.payment_status === 'overdue' ? 'destructive' : 'secondary'}
                        className="mb-1"
                      >
                        {payment.payment_status === 'overdue' ? 'Atrasado' : 'Pendente'}
                      </Badge>
                      <p className="text-xs font-medium text-red-600">
                        R$ {payment.pending_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Todos os pagamentos em dia!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleNewReservation}
                className="w-full justify-start h-auto p-4"
                variant="outline"
              >
                <div className="flex items-center w-full">
                  <Plus className="h-5 w-5 mr-3 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Nova Reserva</div>
                    <div className="text-xs text-gray-500">Criar uma nova reserva</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                onClick={handleNewGuest}
                className="w-full justify-start h-auto p-4"
                variant="outline"
              >
                <div className="flex items-center w-full">
                  <UserPlus className="h-5 w-5 mr-3 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Novo Hóspede</div>
                    <div className="text-xs text-gray-500">Cadastrar hóspede</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                onClick={handleViewRoomMap}
                className="w-full justify-start h-auto p-4"
                variant="outline"
              >
                <div className="flex items-center w-full">
                  <Map className="h-5 w-5 mr-3 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Mapa de Quartos</div>
                    <div className="text-xs text-gray-500">Visualizar ocupação</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resumo do Dia (se houver movimento) */}
        {(todaysData?.arrivals_count > 0 || todaysData?.departures_count > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chegadas de Hoje */}
            {todaysData.arrivals_count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center">
                    <ArrowDownIcon className="h-4 w-4 text-green-600 mr-2" />
                    Chegadas de Hoje ({todaysData.arrivals_count})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">
                    Reservas com check-in programado para hoje
                  </p>
                  <Button 
                    onClick={() => router.push('/dashboard/reservations?filter=arrivals_today')}
                    variant="outline" 
                    size="sm"
                  >
                    Ver Detalhes
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Saídas de Hoje */}
            {todaysData.departures_count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center">
                    <ArrowUpIcon className="h-4 w-4 text-blue-600 mr-2" />
                    Saídas de Hoje ({todaysData.departures_count})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">
                    Check-outs programados para hoje
                  </p>
                  <Button 
                    onClick={() => router.push('/dashboard/reservations?filter=departures_today')}
                    variant="outline" 
                    size="sm"
                  >
                    Ver Detalhes
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* MODAIS */}
      <StandardReservationModal
        isOpen={showNewReservationModal}
        onClose={() => setShowNewReservationModal(false)}
        onSuccess={handleNewReservationSuccess}
        mode="full"
        title="Nova Reserva"
        allowGuestSelection={true}
        allowMultipleRooms={true}
        showAdvancedFields={true}
      />

      <GuestModal
        isOpen={showNewGuestModal}
        onClose={() => setShowNewGuestModal(false)}
        onSuccess={handleNewGuestSuccess}
      />
    </>
  );
}