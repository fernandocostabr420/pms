// frontend/src/app/dashboard/reservations/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // ✅ Adicionar import do router
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar,
  Plus,
  Download,
  RefreshCw,
  Users,
  Building,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Filter,
  FileSpreadsheet,
  Table as TableIcon,
  Grid,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Components
import ReservationFiltersComponent from '@/components/reservations/ReservationFilters';
import ReservationTable from '@/components/reservations/ReservationTable';
import ReservationCard from '@/components/reservations/ReservationCard';
import ReservationDetails from '@/components/reservations/ReservationDetails';
import LoadingSpinner from '@/components/ui/loading-spinner';
import CancelReservationModal from '@/components/reservations/CancelReservationModal'; // ✅ NOVO IMPORT

// ✅ NOVOS IMPORTS - Componente Padronizado
import StandardReservationModal from '@/components/reservations/StandardReservationModal';
import { RESERVATION_MODAL_CONFIGS } from '@/components/reservations/configs/reservationModalConfigs';

// Types
import { ReservationFilters, ReservationResponseWithGuestDetails } from '@/types/reservation';

// Services
import apiClient from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface ReservationPageState {
  reservations: ReservationResponseWithGuestDetails[];
  loading: boolean;
  error: string | null;
  total: number;
  currentPage: number;
  totalPages: number;
  summary: any | null;
}

interface QuickStats {
  totalReservations: number;
  totalRevenue: number;
  avgOccupancy: number;
  pendingCheckIns: number;
  pendingCheckOuts: number;
  overduePayments: number;
}

const INITIAL_FILTERS: ReservationFilters = {
  status: undefined,
  source: undefined,
  property_id: undefined,
  guest_id: undefined,
  check_in_from: undefined,
  check_in_to: undefined,
  check_out_from: undefined,
  check_out_to: undefined,
  created_from: undefined,
  created_to: undefined,
  search: undefined,
  guest_email: undefined,
  min_amount: undefined,
  max_amount: undefined,
  is_paid: undefined,
  requires_deposit: undefined,
  is_group_reservation: undefined,
};

const PER_PAGE = 20;

type ViewMode = 'table' | 'cards';

export default function ReservationsPage() {
  const router = useRouter(); // ✅ Hook do router

  // Estados principais
  const [state, setState] = useState<ReservationPageState>({
    reservations: [],
    loading: true,
    error: null,
    total: 0,
    currentPage: 1,
    totalPages: 0,
    summary: null,
  });

  const [filters, setFilters] = useState<ReservationFilters>(INITIAL_FILTERS);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationResponseWithGuestDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: number]: string | null }>({});
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // ✅ NOVOS ESTADOS - Modais Padronizados
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [reservationToEdit, setReservationToEdit] = useState<ReservationResponseWithGuestDetails | null>(null);

  // ✅ NOVOS ESTADOS - Modal de Cancelamento
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<ReservationResponseWithGuestDetails | null>(null);

  // ✅ NOVA FUNÇÃO: Handler para clique na reserva (navegar para página de detalhes)
  const handleReservationClick = useCallback((reservation: ReservationResponseWithGuestDetails) => {
    router.push(`/dashboard/reservations/${reservation.id}`);
  }, [router]);

  // Carregar reservas
  const loadReservations = useCallback(async (page?: number) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const currentPage = page || state.currentPage;
      const params = {
        page: currentPage,
        per_page: PER_PAGE,
        ...filters,
        // Remover valores vazios/undefined
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => 
            value !== undefined && value !== '' && value !== null
          )
        ),
      };

      const response = await apiClient.getReservationsWithDetails(params);
      
      setState(prev => ({
        ...prev,
        reservations: response.reservations || [],
        total: response.total || 0,
        currentPage: currentPage,
        totalPages: Math.ceil((response.total || 0) / PER_PAGE),
        summary: response.summary || null,
        loading: false,
      }));
      
    } catch (error: any) {
      console.error('Erro ao carregar reservas:', error);
      setState(prev => ({
        ...prev,
        error: error?.response?.data?.detail || 'Erro ao carregar reservas',
        loading: false,
        reservations: [],
      }));
      
      toast({
        title: "Erro",
        description: error?.response?.data?.detail || 
          "Não foi possível carregar as reservas. Tente novamente.",
        variant: "destructive"
      });
    }
  }, [filters]);

  // Carregar estatísticas rápidas
  const loadQuickStats = useCallback(async () => {
    try {
      const stats = await apiClient.getDashboardStats();
      setQuickStats({
        totalReservations: stats.total_reservations || 0,
        totalRevenue: stats.total_revenue || 0,
        avgOccupancy: stats.occupancy_rate || 0,
        pendingCheckIns: stats.pending_checkins || 0,
        pendingCheckOuts: stats.pending_checkouts || 0,
        overduePayments: stats.overdue_payments || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  // Efeitos
  useEffect(() => {
    loadReservations(1);
    loadQuickStats();
  }, [loadReservations, loadQuickStats]);

  // Handlers
  const handleFiltersChange = (newFilters: ReservationFilters) => {
    setFilters(newFilters);
    setState(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setState(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
    loadReservations(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewReservation = (reservation: ReservationResponseWithGuestDetails) => {
    setSelectedReservation(reservation);
    setShowDetails(true);
  };

  // ✅ HANDLER ATUALIZADO - Agora abre o modal padronizado
  const handleEditReservation = (reservation: ReservationResponseWithGuestDetails) => {
    setReservationToEdit(reservation);
    setShowEditModal(true);
  };

  // ✅ NOVOS HANDLERS - Modais Padronizados
  const handleNewReservation = () => {
    setReservationToEdit(null);
    setShowNewReservationModal(true);
  };

  const handleNewReservationSuccess = () => {
    setShowNewReservationModal(false);
    loadReservations(); // Recarregar lista
    loadQuickStats(); // Atualizar estatísticas
    toast({
      title: "Sucesso",
      description: "Reserva criada com sucesso!"
    });
  };

  const handleEditReservationSuccess = () => {
    setShowEditModal(false);
    setReservationToEdit(null);
    loadReservations(); // Recarregar lista
    loadQuickStats(); // Atualizar estatísticas
    toast({
      title: "Sucesso", 
      description: "Reserva atualizada com sucesso!"
    });
  };

  // ✅ NOVA FUNÇÃO - Handler do cancelamento
  const handleCancelConfirm = async (cancelData: {
    cancellation_reason: string;
    refund_amount?: number;
    notes?: string;
  }) => {
    if (!reservationToCancel) return;

    try {
      setActionLoading(prev => ({ ...prev, [reservationToCancel.id]: 'cancel' }));
      
      await apiClient.cancelReservation(reservationToCancel.id, cancelData);
      
      toast({
        title: 'Reserva Cancelada',
        description: `A reserva ${reservationToCancel.reservation_number} foi cancelada com sucesso.`,
        variant: 'default',
      });
      
      // Recarregar dados da página
      await loadReservations();
      await loadQuickStats();
      
    } catch (error: any) {
      console.error('Erro ao cancelar reserva:', error);
      toast({
        title: 'Erro ao Cancelar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
      throw error; // Re-throw para o modal tratar
    } finally {
      setActionLoading(prev => ({ ...prev, [reservationToCancel.id]: null }));
    }
  };

  const handleQuickAction = async (reservation: ReservationResponseWithGuestDetails, action: string) => {
    setActionLoading(prev => ({ ...prev, [reservation.id]: action }));
    
    try {
      let response;
      
      switch (action) {
        case 'confirm':
          response = await apiClient.confirmReservation(reservation.id);
          toast({
            title: "Sucesso",
            description: "Reserva confirmada com sucesso!"
          });
          break;
          
        case 'check-in':
          response = await apiClient.checkInReservation(reservation.id, {});
          toast({
            title: "Sucesso", 
            description: "Check-in realizado com sucesso!"
          });
          break;
          
        case 'check-out':
          response = await apiClient.checkOutReservation(reservation.id, {});
          toast({
            title: "Sucesso",
            description: "Check-out realizado com sucesso!"
          });
          break;
          
        case 'cancel':
          // ✅ MODIFICAÇÃO - Abrir modal de cancelamento
          setReservationToCancel(reservation);
          setCancelModalOpen(true);
          return; // Sair sem fazer o resto do processamento
          
        default:
          break;
      }
      
      if (response) {
        // Recarregar dados após ação bem-sucedida
        loadReservations();
        loadQuickStats();
      }
      
    } catch (error: any) {
      console.error('Erro na ação rápida:', error);
      toast({
        title: "Erro",
        description: error?.response?.data?.detail || 
          "Não foi possível executar a ação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [reservation.id]: null }));
    }
  };

  const handleRefresh = () => {
    loadReservations();
    loadQuickStats();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const params = {
        ...filters,
        export_format: 'xlsx',
        include_guest_details: true,
        include_room_details: true,
        include_payment_details: true,
      };
      
      const response = await apiClient.exportReservations(params);
      
      // Criar link de download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `reservas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Sucesso",
        description: "Relatório exportado com sucesso!"
      });
      
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar o relatório. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  const getActionLoadingForReservation = (reservationId: number) => {
    return actionLoading[reservationId] || null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-600 mt-1">
            Gerencie todas as reservas do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Toggle de visualização */}
          <div className="flex items-center border rounded-md p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-blue-500 bg-blue-50' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                {Object.values(filters).filter(v => v !== undefined && v !== '' && v !== null).length}
              </Badge>
            )}
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={state.loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Exportar
          </Button>
          
          {/* ✅ BOTÃO ATUALIZADO - Conectado ao handler */}
          <Button size="sm" onClick={handleNewReservation}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      {quickStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total</p>
                  <p className="text-2xl font-bold text-blue-900">{quickStats.totalReservations}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Receita</p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(quickStats.totalRevenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Ocupação</p>
                  <p className="text-2xl font-bold text-purple-900">{quickStats.avgOccupancy}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Check-ins</p>
                  <p className="text-2xl font-bold text-orange-900">{quickStats.pendingCheckIns}</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-teal-50 to-teal-100 border-teal-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-800">Check-outs</p>
                  <p className="text-2xl font-bold text-teal-900">{quickStats.pendingCheckOuts}</p>
                </div>
                <Building className="h-8 w-8 text-teal-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Pendentes</p>
                  <p className="text-2xl font-bold text-red-900">{quickStats.overduePayments}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationFiltersComponent
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              loading={state.loading}
            />
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Resumo */}
      {state.summary && state.total > 0 && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {state.total} reserva{state.total !== 1 ? 's' : ''} encontrada{state.total !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-6">
                <span>
                  Total: <span className="font-bold">{formatCurrency(state.summary.total_amount || 0)}</span>
                </span>
                <span>
                  Pago: <span className="font-bold text-green-600">{formatCurrency(state.summary.total_paid || 0)}</span>
                </span>
                <span>
                  Pendente: <span className="font-bold text-red-600">{formatCurrency(state.summary.total_pending || 0)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo principal */}
      <Card className="flex-1">
        {state.loading && state.reservations.length === 0 ? (
          <CardContent className="p-8">
            <LoadingSpinner />
          </CardContent>
        ) : !state.reservations.length ? (
          <CardContent>
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma reserva encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                {hasActiveFilters 
                  ? 'Tente ajustar os filtros para encontrar reservas.'
                  : 'Comece criando sua primeira reserva.'
                }
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          </CardContent>
        ) : (
          <>
            {/* Tabela ou Cards */}
            {viewMode === 'table' ? (
              <CardContent className="p-0">
                <ReservationTable
                  reservations={state.reservations}
                  loading={state.loading}
                  onView={handleViewReservation}
                  onEdit={handleEditReservation}
                  onQuickAction={handleQuickAction}
                  onReservationClick={handleReservationClick} // ✅ Nova prop
                  actionLoading={actionLoading}
                />
              </CardContent>
            ) : (
              <CardContent>
                <div className="space-y-4 p-2">
                  {state.reservations.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      onView={() => handleViewReservation(reservation)}
                      onEdit={() => handleEditReservation(reservation)}
                      onQuickAction={(action) => handleQuickAction(reservation, action)}
                      onClick={handleReservationClick} // ✅ Adicionar para os cards também
                      actionLoading={getActionLoadingForReservation(reservation.id)}
                    />
                  ))}
                </div>
              </CardContent>
            )}

            {/* Paginação */}
            {state.totalPages > 1 && (
              <div className="p-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {((state.currentPage - 1) * PER_PAGE) + 1} até{' '}
                    {Math.min(state.currentPage * PER_PAGE, state.total)} de {state.total} registros
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(state.currentPage - 1)}
                      disabled={state.currentPage <= 1 || state.loading}
                    >
                      Anterior
                    </Button>
                    
                    <span className="text-sm text-gray-600 px-3">
                      {state.currentPage} / {state.totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(state.currentPage + 1)}
                      disabled={state.currentPage >= state.totalPages || state.loading}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modal de detalhes */}
      {showDetails && selectedReservation && (
        <ReservationDetails
          reservation={selectedReservation}
          open={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedReservation(null);
          }}
          onUpdate={() => {
            loadReservations();
            loadQuickStats();
          }}
        />
      )}

      {/* ===== NOVOS MODAIS PADRONIZADOS ===== */}
      
      {/* Modal para Nova Reserva */}
      <StandardReservationModal
        isOpen={showNewReservationModal}
        onClose={() => setShowNewReservationModal(false)}
        onSuccess={handleNewReservationSuccess}
        {...RESERVATION_MODAL_CONFIGS.FULL_RESERVATION}
      />

      {/* Modal para Editar Reserva */}
      <StandardReservationModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setReservationToEdit(null);
        }}
        onSuccess={handleEditReservationSuccess}
        reservation={reservationToEdit}
        {...RESERVATION_MODAL_CONFIGS.EDIT_RESERVATION}
      />

      {/* ✅ NOVO MODAL - Cancelamento de Reserva */}
      <CancelReservationModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setReservationToCancel(null);
        }}
        onConfirm={handleCancelConfirm}
        reservationNumber={reservationToCancel?.reservation_number}
        loading={reservationToCancel ? actionLoading[reservationToCancel.id] === 'cancel' : false}
      />
    </div>
  );
}