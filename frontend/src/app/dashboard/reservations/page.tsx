// frontend/src/app/dashboard/reservations/page.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  LogOut,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useReservations } from '@/hooks/useReservations';
import { ReservationResponse } from '@/types/reservation';
import ReservationStats from '@/components/reservations/ReservationStats';
import ReservationFilters from '@/components/reservations/ReservationFilters';
import ReservationCard from '@/components/reservations/ReservationCard';
import ReservationModal from '@/components/reservations/ReservationModal';
import ReservationDetails from '@/components/reservations/ReservationDetails';
import { useToast } from '@/hooks/use-toast';

export default function ReservationsPage() {
  const {
    reservations,
    loading,
    error,
    stats,
    pagination,
    loadReservations,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    filters,
    currentPage,
    perPage,
    clearFilters,
    confirmReservation,
    checkInReservation,
    checkOutReservation,
    cancelReservation,
  } = useReservations();

  const [selectedReservation, setSelectedReservation] = useState<ReservationResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ReservationResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  // ✅ CORRIGIDO - Função para extrair a ação do loading state
  const getActionLoadingForReservation = (reservationId: number): string | null => {
    if (!actionLoading) return null;
    
    const [action, id] = actionLoading.split('-');
    return parseInt(id) === reservationId ? action : null;
  };

  // Handlers para ações rápidas
  const handleQuickAction = async (reservation: ReservationResponse, action: string) => {
    setActionLoading(`${action}-${reservation.id}`);
    
    try {
      switch (action) {
        case 'confirm':
          await confirmReservation(reservation.id);
          break;
        case 'check-in':
          await checkInReservation(reservation.id, {});
          break;
        case 'check-out':
          await checkOutReservation(reservation.id, {});
          break;
        case 'cancel':
          await cancelReservation(reservation.id, {});
          break;
        default:
          break;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateReservation = () => {
    setSelectedReservation(null);
    setIsModalOpen(true);
  };

  const handleEditReservation = (reservation: ReservationResponse) => {
    setSelectedReservation(reservation);
    setIsModalOpen(true);
  };

  const handleViewReservation = (reservation: ReservationResponse) => {
    setReservationDetails(reservation);
    setIsDetailsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setSelectedReservation(null);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-600">
            Gerencie as reservas de seus hóspedes
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button onClick={handleCreateReservation}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <ReservationStats 
          stats={stats}
          className="mb-6"
        />
      )}

      {/* Filtros */}
      <ReservationFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        loading={loading}
      />

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Reservations List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma reserva encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                {Object.values(filters).some(v => v && v !== '') 
                  ? 'Tente ajustar os filtros para encontrar reservas.'
                  : 'Comece criando sua primeira reserva.'
                }
              </p>
              {Object.values(filters).some(v => v && v !== '') && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {reservations.map((reservation) => (
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

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {((currentPage - 1) * perPage) + 1} a{' '}
                      {Math.min(currentPage * perPage, pagination.total)} de{' '}
                      {pagination.total} reservas
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <span className="text-sm text-gray-600">
                        Página {currentPage} de {pagination.pages}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(currentPage + 1)}
                        disabled={currentPage === pagination.pages || loading}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReservation(null);
        }}
        reservation={selectedReservation}
        onSuccess={handleModalSuccess}
      />

      <ReservationDetails
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setReservationDetails(null);
        }}
        reservation={reservationDetails}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setSelectedReservation(reservationDetails);
          setIsModalOpen(true);
        }}
        onQuickAction={(action) => {
          if (reservationDetails) {
            handleQuickAction(reservationDetails, action);
          }
        }}
        actionLoading={reservationDetails ? getActionLoadingForReservation(reservationDetails.id) : null}
      />
    </div>
  );
}