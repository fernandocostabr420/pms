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
  RefreshCw,
  Globe,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

// ✅ FUNÇÕES DE TRADUÇÃO DE STATUS
const getStatusLabel = (status: string) => {
  const statusMap = {
    'pending': 'Pendente',
    'confirmed': 'Confirmada', 
    'checked_in': 'Check-in',
    'checked_out': 'Check-out',
    'cancelled': 'Cancelada',
    'no_show': 'No-show'
  };
  
  return statusMap[status as keyof typeof statusMap] || status;
};

const getStatusVariant = (status: string) => {
  const variantMap = {
    'pending': 'secondary' as const,
    'confirmed': 'default' as const,
    'checked_in': 'success' as const,
    'checked_out': 'outline' as const,
    'cancelled': 'destructive' as const,
    'no_show': 'destructive' as const
  };
  
  return variantMap[status as keyof typeof variantMap] || 'default' as const;
};

// ✅ NOVA FUNÇÃO - Tradução da origem da reserva
const getSourceLabel = (source?: string | null) => {
  if (!source) return 'Não informado';
  
  const sourceMap = {
    'direct': 'Direto',
    'booking': 'Booking.com',
    'airbnb': 'Airbnb',
    'expedia': 'Expedia',
    'hotels': 'Hotels.com',
    'agoda': 'Agoda',
    'phone': 'Telefone',
    'email': 'Email',
    'walk_in': 'Walk-in',
    'website': 'Site',
    'social_media': 'Redes Sociais',
    'referral': 'Indicação'
  };
  
  return sourceMap[source as keyof typeof sourceMap] || source;
};

// ✅ NOVA FUNÇÃO - Ícone da origem
const getSourceIcon = (source?: string | null) => {
  if (!source) return Globe;
  
  const iconMap = {
    'direct': Building2,
    'booking': Globe,
    'airbnb': Home,
    'expedia': Globe,
    'hotels': Globe,
    'agoda': Globe,
    'phone': Users,
    'email': Users,
    'walk_in': Users,
    'website': Globe,
    'social_media': Users,
    'referral': Users
  };
  
  return iconMap[source as keyof typeof iconMap] || Globe;
};

// ✅ NOVA FUNÇÃO - Cor da origem
const getSourceColor = (source?: string | null) => {
  if (!source) return 'text-gray-500';
  
  const colorMap = {
    'direct': 'text-green-600',
    'booking': 'text-blue-600',
    'airbnb': 'text-pink-600',
    'expedia': 'text-yellow-600',
    'hotels': 'text-red-600',
    'agoda': 'text-purple-600',
    'phone': 'text-orange-600',
    'email': 'text-indigo-600',
    'walk_in': 'text-teal-600',
    'website': 'text-green-600',
    'social_media': 'text-pink-600',
    'referral': 'text-blue-600'
  };
  
  return colorMap[source as keyof typeof colorMap] || 'text-gray-600';
};

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

  // ✅ FUNÇÃO PARA FORMATAÇÃO DE DIÁRIAS
  const formatNights = (nights: number) => {
    if (nights === 1) return '1 diária';
    return `${nights} diárias`;
  };

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
        apiClient.getRecentReservations(20),
        apiClient.getCheckedInPendingPayments(5),
        apiClient.getTodaysReservationsImproved(undefined, true)
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
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
        {/* ✅ HEADER COM BOTÕES */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Bem-vindo, {user?.full_name} · {today}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleNewReservation}
              variant="outline" 
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
            
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
                  <p className="text-sm font-medium text-gray-600">Check-outs Pendentes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {todaysData?.pending_checkouts_count || 0}
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

        {/* ✅ SEÇÃO PRINCIPAL - 2 COLUNAS (SEM AÇÕES RÁPIDAS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Últimas Reservas - Melhorado */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Últimas Reservas</CardTitle>
              <Calendar className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {recentReservations.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {recentReservations.map((reservation) => {
                      const SourceIcon = getSourceIcon(reservation.source);
                      return (
                        <div 
                          key={reservation.id} 
                          className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer group"
                          onClick={() => goToReservation(reservation.id)}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            {/* Nome e número da reserva na mesma linha */}
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {reservation.guest_name || 'Sem nome'}
                              </p>
                              <span className="text-xs text-gray-400 font-mono">
                                #{reservation.reservation_number.slice(-4)}
                              </span>
                            </div>
                            
                            {/* Data e origem na mesma linha - ✅ CORREÇÃO APLICADA AQUI */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {format(new Date(reservation.check_in_date + 'T00:00:00'), 'dd/MM', { locale: ptBR })} • {formatNights(reservation.nights)}
                              </span>
                              
                              <div className="flex items-center gap-1">
                                <SourceIcon className={`h-3 w-3 ${getSourceColor(reservation.source)}`} />
                                <span className={`text-xs ${getSourceColor(reservation.source)} font-medium`}>
                                  {getSourceLabel(reservation.source)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status e valor mais compactos */}
                          <div className="flex flex-col items-end gap-1">
                            <Badge 
                              variant={getStatusVariant(reservation.status)}
                              className="text-xs px-2 py-0 h-5"
                            >
                              {getStatusLabel(reservation.status)}
                            </Badge>
                            <span className="text-xs font-semibold text-gray-900">
                              R$ {reservation.total_amount?.toLocaleString('pt-BR', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0 
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma reserva recente</p>
                  </div>
                )}
              </div>
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
        </div>

        {/* Resumo do Dia - Listas de Reservas */}
        {(todaysData?.arrivals_count > 0 || todaysData?.pending_checkouts_count > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chegadas de Hoje - Lista detalhada */}
            {todaysData.arrivals_count > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <ArrowDownIcon className="h-4 w-4 text-green-600 mr-2" />
                    Chegadas de Hoje ({todaysData.arrivals_count})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-64 overflow-y-auto">
                    {todaysData.arrivals && todaysData.arrivals.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {todaysData.arrivals.map((reservation: any) => {
                          const SourceIcon = getSourceIcon(reservation.source);
                          return (
                            <div 
                              key={reservation.id} 
                              className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer group"
                              onClick={() => goToReservation(reservation.id)}
                            >
                              <div className="flex-1 min-w-0 pr-3">
                                {/* Nome e número da reserva */}
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {reservation.guest?.full_name || reservation.guest_name || 'Sem nome'}
                                  </p>
                                  <span className="text-xs text-gray-400 font-mono">
                                    #{reservation.reservation_number?.slice(-4)}
                                  </span>
                                </div>
                                
                                {/* Origem e noites */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    {formatNights(reservation.nights || 0)} • {reservation.adults || 0} adultos
                                  </span>
                                  
                                  <div className="flex items-center gap-1">
                                    <SourceIcon className={`h-3 w-3 ${getSourceColor(reservation.source)}`} />
                                    <span className={`text-xs ${getSourceColor(reservation.source)} font-medium`}>
                                      {getSourceLabel(reservation.source)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Status e valor */}
                              <div className="flex flex-col items-end gap-1">
                                <Badge 
                                  variant={getStatusVariant(reservation.status)}
                                  className="text-xs px-2 py-0 h-5"
                                >
                                  {getStatusLabel(reservation.status)}
                                </Badge>
                                <span className="text-xs font-semibold text-green-600">
                                  Check-in
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ArrowDownIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhuma chegada hoje</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Check-outs Pendentes - Lista detalhada */}
            {todaysData.pending_checkouts_count > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <ArrowUpIcon className="h-4 w-4 text-blue-600 mr-2" />
                    Check-outs Pendentes ({todaysData.pending_checkouts_count})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-64 overflow-y-auto">
                    {todaysData.pending_checkouts && todaysData.pending_checkouts.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {todaysData.pending_checkouts.map((reservation: any) => {
                          const SourceIcon = getSourceIcon(reservation.source);
                          return (
                            <div 
                              key={reservation.id} 
                              className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer group"
                              onClick={() => goToReservation(reservation.id)}
                            >
                              <div className="flex-1 min-w-0 pr-3">
                                {/* Nome e número da reserva */}
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {reservation.guest?.full_name || reservation.guest_name || 'Sem nome'}
                                  </p>
                                  <span className="text-xs text-gray-400 font-mono">
                                    #{reservation.reservation_number?.slice(-4)}
                                  </span>
                                </div>
                                
                                {/* Origem e noites */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    {reservation.nights || 0}n • {reservation.adults || 0} adultos
                                  </span>
                                  
                                  <div className="flex items-center gap-1">
                                    <SourceIcon className={`h-3 w-3 ${getSourceColor(reservation.source)}`} />
                                    <span className={`text-xs ${getSourceColor(reservation.source)} font-medium`}>
                                      {getSourceLabel(reservation.source)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Status e valor */}
                              <div className="flex flex-col items-end gap-1">
                                <Badge 
                                  variant={getStatusVariant(reservation.status)}
                                  className="text-xs px-2 py-0 h-5"
                                >
                                  {getStatusLabel(reservation.status)}
                                </Badge>
                                <span className="text-xs font-semibold text-blue-600">
                                  Check-out
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <ArrowUpIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhum check-out pendente</p>
                      </div>
                    )}
                  </div>
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