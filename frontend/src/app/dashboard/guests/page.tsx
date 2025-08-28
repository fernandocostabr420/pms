// frontend/src/app/dashboard/guests/page.tsx
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
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGuests } from '@/hooks/useGuests';
import { GuestResponse } from '@/types/guest';
import GuestStats from '@/components/guests/GuestStats';
import GuestFilters from '@/components/guests/GuestFilters';
import GuestCard from '@/components/guests/GuestCard';
import GuestModal from '@/components/guests/GuestModal';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function GuestsPage() {
  const {
    guests,
    loading,
    error,
    stats,
    pagination,
    refreshData,
    setFilters,
    setPage,
    filters,
    currentPage,
    clearFilters,
    deleteGuest,
  } = useGuests();

  const [selectedGuest, setSelectedGuest] = useState<GuestResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<GuestResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [guestDetails, setGuestDetails] = useState<GuestResponse | null>(null);

  const { toast } = useToast();

  // Handlers para CRUD
  const handleCreateGuest = () => {
    setSelectedGuest(null);
    setIsModalOpen(true);
  };

  const handleEditGuest = (guest: GuestResponse) => {
    setSelectedGuest(guest);
    setIsModalOpen(true);
  };

  const handleViewGuest = async (guest: GuestResponse) => {
    try {
      const guestWithDetails = await apiClient.get(`/guests/${guest.id}/stats`);
      setGuestDetails(guestWithDetails.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      setGuestDetails(guest);
      setIsDetailModalOpen(true);
    }
  };

  const handleDeleteGuest = (guest: GuestResponse) => {
    setGuestToDelete(guest);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (guestToDelete) {
      await deleteGuest(guestToDelete.id);
      setIsDeleteDialogOpen(false);
      setGuestToDelete(null);
    }
  };

  const handleModalClose = (success: boolean = false) => {
    setIsModalOpen(false);
    setSelectedGuest(null);
    if (success) {
      refreshData();
    }
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hóspedes</h1>
          <p className="text-gray-600">
            Gerencie informações dos seus hóspedes
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleCreateGuest}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Hóspede
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && <GuestStats stats={stats} />}

      {/* Filtros */}
      <GuestFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        loading={loading}
      />

      {/* Content */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && guests.length === 0 && !error && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {Object.keys(filters).some(key => filters[key as keyof typeof filters])
                ? 'Nenhum hóspede encontrado'
                : 'Nenhum hóspede cadastrado'}
            </h3>
            <p className="text-gray-600 mb-4">
              {Object.keys(filters).some(key => filters[key as keyof typeof filters])
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece cadastrando seu primeiro hóspede.'}
            </p>
            {!Object.keys(filters).some(key => filters[key as keyof typeof filters]) && (
              <Button onClick={handleCreateGuest} className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Hóspede
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Guests Grid */}
      {!loading && guests.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guests.map((guest) => (
              <GuestCard
                key={guest.id}
                guest={guest}
                onEdit={handleEditGuest}
                onDelete={handleDeleteGuest}
                onView={handleViewGuest}
              />
            ))}
          </div>

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Mostrando {guests.length} de {pagination.total} hóspedes
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
      <GuestModal
        isOpen={isModalOpen}
        onClose={() => handleModalClose()}
        guest={selectedGuest}
        onSuccess={() => handleModalClose(true)}
      />

      {/* Modal de detalhes */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Hóspede</DialogTitle>
          </DialogHeader>
          
          {guestDetails && (
            <div className="space-y-6">
              {/* Header com nome */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{guestDetails.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {guestDetails.display_document && (
                      <Badge variant="outline">{guestDetails.display_document}</Badge>
                    )}
                    <Badge className="bg-blue-100 text-blue-800">
                      {guestDetails.nationality}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Informações de contato */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {guestDetails.email || 'Email não informado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {guestDetails.phone || 'Telefone não informado'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {guestDetails.full_address || 'Endereço não informado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Estatísticas (se disponível) */}
              {'total_reservations' in guestDetails && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {(guestDetails as any).total_reservations}
                    </p>
                    <p className="text-xs text-gray-600">Total Reservas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {(guestDetails as any).completed_stays}
                    </p>
                    <p className="text-xs text-gray-600">Estadias</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {(guestDetails as any).total_nights}
                    </p>
                    <p className="text-xs text-gray-600">Noites</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {(guestDetails as any).cancelled_reservations}
                    </p>
                    <p className="text-xs text-gray-600">Canceladas</p>
                  </div>
                </div>
              )}

              {/* Notas */}
              {guestDetails.notes && (
                <div>
                  <h4 className="font-medium mb-2">Observações:</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {guestDetails.notes}
                  </p>
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
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o hóspede "{guestToDelete?.full_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}