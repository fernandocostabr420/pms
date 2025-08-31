// frontend/src/app/dashboard/reservations/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Components
import ReservationFiltersComponent from '@/components/reservations/ReservationFilters';
import ReservationCard from '@/components/reservations/ReservationCard';
import ReservationDetails from '@/components/reservations/ReservationDetails';
import LoadingSpinner from '@/components/ui/loading-spinner';

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

export default function ReservationsPage() {
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

  // Carregar reservas
  const loadReservations = useCallback(async (page: number = 1) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const queryParams = {
        page,
        per_page: PER_PAGE,
        include_guest_details: true,
        include_room_details: true,
        include_payment_summary: true,
        ...filters
      };

      // Remover valores vazios/null/undefined
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key as keyof typeof queryParams];
        if (value === null || value === undefined || value === '' || value === 'all') {
          delete queryParams[key as keyof typeof queryParams];
        }
      });

      const response = await apiClient.getReservations(queryParams);
      
      setState(prev => ({
        ...prev,
        reservations: response.reservations || [],
        total: response.total || 0,
        currentPage: response.page || 1,
        totalPages: response.pages || 0,
        summary: response.summary || null,
        loading: false,
        error: null,
      }));

    } catch (error: any) {
      console.error('Erro ao carregar reservas:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.response?.data?.detail || 'Erro ao carregar reservas'
      }));
      toast({
        title: "Erro",
        description: "Não foi possível carregar as reservas. Tente novamente.",
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

  const handleEditReservation = (reservation: ReservationResponseWithGuestDetails) => {
    // TODO: Implementar edição
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A edição de reservas será implementada em breve."
    });
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
          // TODO: Abrir modal de confirmação com motivo
          response = await apiClient.cancelReservation(reservation.id, {
            cancellation_reason: "Cancelado pelo sistema"
          });
          toast({
            title: "Sucesso",
            description: "Reserva cancelada com sucesso!"
          });
          break;
          
        default:
          throw new Error(`Ação não implementada: ${action}`);
      }
      
      // Recarregar dados
      await loadReservations(state.currentPage);
      await loadQuickStats();
      
    } catch (error: any) {
      console.error(`Erro na ação ${action}:`, error);
      toast({
        title: "Erro",
        description: error?.response?.data?.detail || `Erro ao ${action} reserva`,
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [reservation.id]: null }));
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const exportFilters = {
        ...filters,
        include_guest_details: true,
        include_room_details: true,
        include_payment_details: true,
        date_format: "dd/mm/yyyy",
        currency_format: "pt-BR"
      };

      const response = await apiClient.exportReservationsCSV(exportFilters);
      
      // Fazer download do arquivo
      window.open(response.file_url, '_blank');
      
      toast({
        title: "Sucesso",
        description: `Arquivo exportado com ${response.total_records} reservas!`
      });
      
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar reservas. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const getActionLoadingForReservation = (reservationId: number) => {
    return actionLoading[reservationId] || null;
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== null && value !== undefined && value !== '' && value !== 'all'
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-600">
            Gerencie todas as reservas do seu hotel
            {state.total > 0 && (
              <span className="ml-2">
                • {state.total} reserva{state.total !== 1 ? 's' : ''} encontrada{state.total !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => loadReservations(state.currentPage)}
            disabled={state.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button
            variant="outline" 
            onClick={handleExportCSV}
            disabled={exporting || state.loading || state.total === 0}
          >
            <FileSpreadsheet className={`h-4 w-4 mr-2 ${exporting ? 'animate-spin' : ''}`} />
            Exportar CSV
          </Button>
          
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {quickStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-xl font-bold">{quickStats.totalReservations}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Receita</p>
                  <p className="text-lg font-bold">
                    R$ {quickStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Ocupação</p>
                  <p className="text-xl font-bold">{quickStats.avgOccupancy.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-ins</p>
                  <p className="text-xl font-bold">{quickStats.pendingCheckIns}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-outs</p>
                  <p className="text-xl font-bold">{quickStats.pendingCheckOuts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Em atraso</p>
                  <p className="text-xl font-bold">{quickStats.overduePayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <ReservationFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        loading={state.loading}
      />

      {/* Summary da Busca */}
      {state.summary && state.total > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-900">Valor Total:</span>
                <div className="text-lg font-bold text-blue-700">
                  R$ {state.summary.total_amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-900">Valor Pago:</span>
                <div className="text-lg font-bold text-green-700">
                  R$ {state.summary.total_paid?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-900">Média de Noites:</span>
                <div className="text-lg font-bold text-blue-700">
                  {state.summary.avg_nights?.toFixed(1)}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-900">Média de Hóspedes:</span>
                <div className="text-lg font-bold text-blue-700">
                  {state.summary.avg_guests?.toFixed(1)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Reservas */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Reservas Encontradas
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {Object.values(filters).filter(v => 
                    v !== null && v !== undefined && v !== '' && v !== 'all'
                  ).length} filtros ativos
                </Badge>
              )}
            </CardTitle>
            
            {state.total > 0 && (
              <div className="text-sm text-gray-600">
                Página {state.currentPage} de {state.totalPages} • {state.total} registros
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {state.error ? (
            <Alert className="m-6" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : state.loading ? (
            <div className="p-8">
              <LoadingSpinner className="mx-auto" />
              <div className="text-center mt-4 text-gray-600">
                Carregando reservas...
              </div>
            </div>
          ) : state.reservations.length === 0 ? (
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
          ) : (
            <>
              <div className="space-y-4 p-6">
                {state.reservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onView={() => handleViewReservation(reservation)}
                    onEdit={() => handleEditReservation(reservation)}
                    onQuickAction={(action) => handleQuickAction(reservation, action)}
                    actionLoading={getActionLoadingForReservation(reservation.id)}
                  />
                ))}
              </div>

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
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      {showDetails && selectedReservation && (
        <ReservationDetails
          reservation={selectedReservation}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedReservation(null);
          }}
          onUpdate={async () => {
            await loadReservations(state.currentPage);
            setShowDetails(false);
            setSelectedReservation(null);
          }}
        />
      )}
    </div>
  );
}