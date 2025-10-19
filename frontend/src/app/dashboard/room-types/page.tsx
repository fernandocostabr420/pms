// frontend/src/app/dashboard/room-types/page.tsx
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
  Tag,
  ChevronLeft,
  ChevronRight,
  Eye,
  Users,
  Bed
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRoomTypes } from '@/hooks/useRoomTypes';
import { RoomTypeResponse } from '@/types/rooms';
import RoomTypeStats from '@/components/room-types/RoomTypeStats';
import RoomTypeFilters from '@/components/room-types/RoomTypeFilters';
import RoomTypeCard from '@/components/room-types/RoomTypeCard';
import RoomTypeModal from '@/components/room-types/RoomTypeModal';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function RoomTypesPage() {
  const {
    roomTypes,
    loading,
    error,
    stats,
    pagination,
    loadRoomTypes,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    filters,
    currentPage,
    perPage,
    clearFilters,
    toggleBookable,
    deleteRoomType,
  } = useRoomTypes();

  const [selectedRoomType, setSelectedRoomType] = useState<RoomTypeResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomTypeToDelete, setRoomTypeToDelete] = useState<RoomTypeResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [roomTypeDetails, setRoomTypeDetails] = useState<RoomTypeResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  // Handlers para CRUD
  const handleCreateRoomType = () => {
    setSelectedRoomType(null);
    setIsModalOpen(true);
  };

  const handleEditRoomType = (roomType: RoomTypeResponse) => {
    setSelectedRoomType(roomType);
    setIsModalOpen(true);
  };

  const handleViewRoomType = async (roomType: RoomTypeResponse) => {
    try {
      const roomTypeWithDetails = await apiClient.getRoomType(roomType.id);
      setRoomTypeDetails(roomTypeWithDetails);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes do tipo de quarto",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoomType = (roomType: RoomTypeResponse) => {
    setRoomTypeToDelete(roomType);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!roomTypeToDelete) return;

    try {
      setActionLoading('delete');
      await deleteRoomType(roomTypeToDelete.id);
      setIsDeleteDialogOpen(false);
      setRoomTypeToDelete(null);
    } catch (error) {
      // Error já tratado no hook
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBookable = async (roomType: RoomTypeResponse) => {
    try {
      setActionLoading(`toggle-${roomType.id}`);
      await toggleBookable(roomType.id);
    } catch (error) {
      // Error já tratado no hook
    } finally {
      setActionLoading(null);
    }
  };

  const handleModalClose = (needsRefresh = false) => {
    setIsModalOpen(false);
    setSelectedRoomType(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Quartos</h1>
          <p className="text-gray-600">Gerencie as categorias de quartos de suas propriedades</p>
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
            onClick={handleCreateRoomType}
            disabled={loading}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Tipo
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <RoomTypeStats 
          stats={stats} 
          loading={loading} 
        />
      )}

      {/* Filtros */}
      <RoomTypeFilters
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

      {/* Loading State */}
      {loading && roomTypes.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">Carregando tipos de quartos...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && roomTypes.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Nenhum tipo de quarto encontrado
            </h3>
            <p className="mt-2 text-gray-600">
              {Object.keys(filters).length > 0 
                ? 'Tente ajustar os filtros de busca.' 
                : 'Comece criando seu primeiro tipo de quarto.'
              }
            </p>
            {Object.keys(filters).length === 0 && (
              <Button 
                onClick={handleCreateRoomType} 
                className="mt-4"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Tipo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Room Types Grid */}
      {!loading && roomTypes.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roomTypes.map((roomType) => (
              <RoomTypeCard
                key={roomType.id}
                roomType={roomType}
                onEdit={handleEditRoomType}
                onDelete={handleDeleteRoomType}
                onView={handleViewRoomType}
                onToggleBookable={handleToggleBookable}
                loading={actionLoading === `toggle-${roomType.id}`}
              />
            ))}
          </div>

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Mostrando {roomTypes.length} de {pagination.total} tipos de quartos
              </p>
              
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
      <RoomTypeModal
        isOpen={isModalOpen}
        onClose={() => handleModalClose()}
        roomType={selectedRoomType}
        onSuccess={() => handleModalClose(true)}
      />

      {/* Modal de detalhes */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Tipo de Quarto</DialogTitle>
          </DialogHeader>
          
          {roomTypeDetails && (
            <div className="space-y-6">
              {/* Header com nome e slug */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{roomTypeDetails.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">#{roomTypeDetails.slug}</Badge>
                    <Badge className={
                      roomTypeDetails.is_bookable 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }>
                      {roomTypeDetails.is_bookable ? 'Reservável' : 'Não Reservável'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Capacidades */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Capacidade Base</span>
                  </div>
                  <p className="text-2xl font-bold">{roomTypeDetails.base_capacity} pessoas</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Capacidade Máxima</span>
                  </div>
                  <p className="text-2xl font-bold">{roomTypeDetails.max_capacity} pessoas</p>
                </div>
              </div>

              {/* Descrição */}
              {roomTypeDetails.description && (
                <div className="space-y-2">
                  <span className="font-medium">Descrição</span>
                  <p className="text-gray-700">{roomTypeDetails.description}</p>
                </div>
              )}

              {/* Comodidades */}
              {roomTypeDetails.base_amenities && roomTypeDetails.base_amenities.length > 0 && (
                <div className="space-y-2">
                  <span className="font-medium">Comodidades Base</span>
                  <div className="flex flex-wrap gap-1">
                    {roomTypeDetails.base_amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadados */}
              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Criado em:</span>
                  <br />
                  {new Date(roomTypeDetails.created_at).toLocaleDateString('pt-BR')}
                </div>
                <div>
                  <span className="font-medium">Atualizado em:</span>
                  <br />
                  {new Date(roomTypeDetails.updated_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
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
              Tem certeza que deseja excluir o tipo de quarto "{roomTypeToDelete?.name}"? 
              Esta ação não pode ser desfeita e pode afetar quartos existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={actionLoading === 'delete'}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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