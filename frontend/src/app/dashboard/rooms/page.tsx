// frontend/src/app/dashboard/rooms/page.tsx
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
  Bed,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building,
  Users,
  MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRooms } from '@/hooks/useRooms';
import { RoomResponse } from '@/types/rooms';
import RoomStats from '@/components/rooms/RoomStats';
import RoomFilters from '@/components/rooms/RoomFilters';
import RoomCard from '@/components/rooms/RoomCard';
import RoomModal from '@/components/rooms/RoomModal';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function RoomsPage() {
  const {
    rooms,
    loading,
    error,
    stats,
    pagination,
    loadRooms,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    filters,
    currentPage,
    perPage,
  } = useRooms();

  const [selectedRoom, setSelectedRoom] = useState<RoomResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<RoomResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [roomDetails, setRoomDetails] = useState<RoomResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  // Handlers para CRUD
  const handleCreateRoom = () => {
    setSelectedRoom(null);
    setIsModalOpen(true);
  };

  const handleEditRoom = (room: RoomResponse) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
  };

  const handleViewRoom = async (room: RoomResponse) => {
    try {
      const roomWithDetails = await apiClient.getRoomWithDetails(room.id);
      setRoomDetails(roomWithDetails);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes do quarto",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = (room: RoomResponse) => {
    setRoomToDelete(room);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) return;

    try {
      setActionLoading('delete');
      await apiClient.deleteRoom(roomToDelete.id);
      
      toast({
        title: "Sucesso",
        description: "Quarto excluído com sucesso",
      });
      
      refreshData();
    } catch (error: any) {
      console.error('Erro ao excluir quarto:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao excluir quarto',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setIsDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  const handleToggleOperational = async (room: RoomResponse) => {
    try {
      setActionLoading(`toggle-${room.id}`);
      await apiClient.toggleRoomOperational(room.id);
      
      toast({
        title: "Sucesso",
        description: `Quarto ${room.is_operational ? 'desativado' : 'ativado'} com sucesso`,
      });
      
      refreshData();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao alterar status do quarto',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleModalClose = (needsRefresh = false) => {
    setIsModalOpen(false);
    setSelectedRoom(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Quartos</h1>
          <p className="text-gray-600">Gerencie os quartos de suas propriedades</p>
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
          
          <Button onClick={handleCreateRoom} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Quarto
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <RoomStats stats={stats} loading={loading} />
      )}

      {/* Filtros */}
      <RoomFilters
        filters={filters}
        onFiltersChange={setFilters}
        loading={loading}
      />

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Lista de Quartos */}
      {loading && rooms.length === 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bed className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum quarto encontrado
            </h3>
            <p className="text-gray-500 mb-6 text-center">
              Não há quartos cadastrados ou que atendam aos filtros aplicados.
            </p>
            <Button onClick={handleCreateRoom}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Primeiro Quarto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Grid de quartos */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={handleEditRoom}
                onDelete={handleDeleteRoom}
                onView={handleViewRoom}
                onToggleOperational={handleToggleOperational}
                loading={actionLoading === `toggle-${room.id}`}
              />
            ))}
          </div>

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {((currentPage - 1) * perPage) + 1} a{' '}
                {Math.min(currentPage * perPage, pagination.total)} de{' '}
                {pagination.total} quartos
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
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = i + Math.max(1, currentPage - 2);
                    if (page > pagination.pages) return null;
                    
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
      <RoomModal
        isOpen={isModalOpen}
        onClose={() => handleModalClose()}
        room={selectedRoom}
        onSuccess={() => handleModalClose(true)}
      />

      {/* Modal de detalhes */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Quarto</DialogTitle>
          </DialogHeader>
          
          {roomDetails && (
            <div className="space-y-6">
              {/* Header com nome e número */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{roomDetails.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">#{roomDetails.room_number}</Badge>
                    <Badge className={
                      roomDetails.is_operational 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }>
                      {roomDetails.is_operational ? 'Operacional' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Informações básicas */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Localização</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-500" />
                        {roomDetails.property_name || 'N/A'}
                      </div>
                      {roomDetails.floor !== null && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          Andar {roomDetails.floor}
                        </div>
                      )}
                      {roomDetails.building && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-500" />
                          {roomDetails.building}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Capacidade</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-500" />
                      Máximo {roomDetails.max_occupancy} pessoas
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Operacional:</span>
                        <Badge variant={roomDetails.is_operational ? "default" : "destructive"}>
                          {roomDetails.is_operational ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fora de ordem:</span>
                        <Badge variant={roomDetails.is_out_of_order ? "destructive" : "default"}>
                          {roomDetails.is_out_of_order ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reservável:</span>
                        <Badge variant={roomDetails.is_available_for_booking ? "default" : "secondary"}>
                          {roomDetails.is_available_for_booking ? 'Sim' : 'Não'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              {(roomDetails.housekeeping_notes || roomDetails.maintenance_notes || roomDetails.notes) && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Observações</h4>
                  
                  {roomDetails.housekeeping_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h5 className="font-medium text-blue-800 mb-1">Limpeza</h5>
                      <p className="text-sm text-blue-700">{roomDetails.housekeeping_notes}</p>
                    </div>
                  )}

                  {roomDetails.maintenance_notes && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <h5 className="font-medium text-orange-800 mb-1">Manutenção</h5>
                      <p className="text-sm text-orange-700">{roomDetails.maintenance_notes}</p>
                    </div>
                  )}

                  {roomDetails.notes && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <h5 className="font-medium text-gray-800 mb-1">Geral</h5>
                      <p className="text-sm text-gray-700">{roomDetails.notes}</p>
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
              Tem certeza que deseja excluir o quarto "{roomToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={!!actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === 'delete' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}