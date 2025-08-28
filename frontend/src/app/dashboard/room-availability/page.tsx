// frontend/src/app/dashboard/room-availability/page.tsx
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  BarChart3,
  CalendarDays,
  Upload,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRoomAvailability } from '@/hooks/useRoomAvailability';
import { RoomAvailabilityResponse } from '@/types/room-availability';
import RoomAvailabilityFilters from '@/components/room-availability/RoomAvailabilityFilters';
import RoomAvailabilityCard from '@/components/room-availability/RoomAvailabilityCard';
import RoomAvailabilityModal from '@/components/room-availability/RoomAvailabilityModal';
import { useToast } from '@/hooks/use-toast';

export default function RoomAvailabilityPage() {
  const {
    availabilities,
    loading,
    error,
    stats,
    pagination,
    loadAvailabilities,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    filters,
    currentPage,
    perPage,
    clearFilters,
    deleteAvailability,
  } = useRoomAvailability();

  const [selectedAvailability, setSelectedAvailability] = useState<RoomAvailabilityResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<RoomAvailabilityResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [availabilityDetails, setAvailabilityDetails] = useState<RoomAvailabilityResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const { toast } = useToast();

  // Handlers para CRUD
  const handleCreateAvailability = () => {
    setSelectedAvailability(null);
    setIsModalOpen(true);
  };

  const handleEditAvailability = (availability: RoomAvailabilityResponse) => {
    setSelectedAvailability(availability);
    setIsModalOpen(true);
  };

  const handleViewAvailability = (availability: RoomAvailabilityResponse) => {
    setAvailabilityDetails(availability);
    setIsDetailModalOpen(true);
  };

  const handleDeleteRequest = (availability: RoomAvailabilityResponse) => {
    setAvailabilityToDelete(availability);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!availabilityToDelete) return;

    try {
      setActionLoading('delete');
      await deleteAvailability(availabilityToDelete.id);
      setIsDeleteDialogOpen(false);
      setAvailabilityToDelete(null);
    } catch (error) {
      // Error já tratado no hook
    } finally {
      setActionLoading(null);
    }
  };

  const handleModalClose = (needsRefresh = false) => {
    setIsModalOpen(false);
    setSelectedAvailability(null);
    if (needsRefresh) {
      refreshData();
    }
  };

  // Paginação
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination && currentPage < pagination.pages) {
      setPage(currentPage + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disponibilidade de Quartos</h1>
          <p className="text-gray-600">Gerencie a disponibilidade e preços dos quartos por data</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleCreateAvailability}
            disabled={loading}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Disponibilidade
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Disponíveis</div>
                  <div className="text-lg font-semibold">{stats.available_rooms}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Reservados</div>
                  <div className="text-lg font-semibold">{stats.reserved_rooms}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Bloqueados</div>
                  <div className="text-lg font-semibold">{stats.blocked_rooms}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Settings className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Manutenção</div>
                  <div className="text-lg font-semibold">{stats.maintenance_rooms}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <RoomAvailabilityFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        loading={loading}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {loading && availabilities.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lista de disponibilidades */}
          {availabilities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availabilities.map((availability) => (
                <RoomAvailabilityCard
                  key={availability.id}
                  availability={availability}
                  onEdit={handleEditAvailability}
                  onView={handleViewAvailability}
                  onDelete={handleDeleteRequest}
                  loading={loading || actionLoading === `delete-${availability.id}`}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <CalendarDays className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma disponibilidade encontrada
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {Object.keys(filters).length > 0
                        ? 'Nenhuma disponibilidade corresponde aos filtros aplicados.'
                        : 'Comece criando a primeira disponibilidade de quarto.'
                      }
                    </p>
                    {Object.keys(filters).length > 0 ? (
                      <Button variant="outline" onClick={clearFilters}>
                        Limpar Filtros
                      </Button>
                    ) : (
                      <Button onClick={handleCreateAvailability}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Disponibilidade
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {((currentPage - 1) * perPage) + 1} a {Math.min(currentPage * perPage, pagination.total)} de {pagination.total} resultados
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = currentPage <= 3 
                      ? i + 1 
                      : currentPage >= pagination.pages - 2
                        ? pagination.pages - 4 + i
                        : currentPage - 2 + i;
                        
                    if (page < 1 || page > pagination.pages) return null;
                    
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(page)}
                        disabled={loading}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= pagination.pages || loading}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de CRUD */}
      <RoomAvailabilityModal
        isOpen={isModalOpen}
        onClose={() => handleModalClose()}
        availability={selectedAvailability}
        onSuccess={() => handleModalClose(true)}
      />

      {/* Modal de detalhes */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Disponibilidade</DialogTitle>
          </DialogHeader>
          
          {availabilityDetails && (
            <div className="space-y-6">
              {/* Header com status */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">
                    Quarto {availabilityDetails.room_number || availabilityDetails.room_id}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{availabilityDetails.date}</Badge>
                    <Badge className={availabilityDetails.is_available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {availabilityDetails.is_available ? 'Disponível' : 'Indisponível'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Informações detalhadas */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Disponível:</span>
                        <Badge variant={availabilityDetails.is_available ? "default" : "destructive"}>
                          {availabilityDetails.is_available ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Bloqueado:</span>
                        <Badge variant={availabilityDetails.is_blocked ? "destructive" : "default"}>
                          {availabilityDetails.is_blocked ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reservado:</span>
                        <Badge variant={availabilityDetails.is_reserved ? "default" : "secondary"}>
                          {availabilityDetails.is_reserved ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Configurações</h4>
                    <div className="space-y-2 text-sm">
                      {availabilityDetails.rate_override && (
                        <div className="flex items-center justify-between">
                          <span>Preço Especial:</span>
                          <span className="font-medium text-green-600">
                            {availabilityDetails.rate_override.toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Estadia Mínima:</span>
                        <span>{availabilityDetails.min_stay} noite(s)</span>
                      </div>
                      {availabilityDetails.max_stay && (
                        <div className="flex items-center justify-between">
                          <span>Estadia Máxima:</span>
                          <span>{availabilityDetails.max_stay} noite(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Restrições */}
              {(availabilityDetails.closed_to_arrival || availabilityDetails.closed_to_departure) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Restrições</h4>
                  <div className="flex gap-2">
                    {availabilityDetails.closed_to_arrival && (
                      <Badge variant="outline">Fechado para Chegada</Badge>
                    )}
                    {availabilityDetails.closed_to_departure && (
                      <Badge variant="outline">Fechado para Saída</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Observações */}
              {(availabilityDetails.reason || availabilityDetails.notes) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Observações</h4>
                  {availabilityDetails.reason && (
                    <div className="mb-2">
                      <strong>Motivo:</strong> {availabilityDetails.reason}
                    </div>
                  )}
                  {availabilityDetails.notes && (
                    <div>
                      <strong>Notas:</strong> {availabilityDetails.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta disponibilidade? Esta ação não pode ser desfeita.
              {availabilityToDelete && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  <strong>Quarto:</strong> {availabilityToDelete.room_number || availabilityToDelete.room_id}<br />
                  <strong>Data:</strong> {availabilityToDelete.date}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === 'delete'}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={actionLoading === 'delete'}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === 'delete' && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}