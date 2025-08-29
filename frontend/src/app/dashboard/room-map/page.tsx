// frontend/src/app/dashboard/room-map/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle,
  Map,
  RefreshCw,
  Plus,
  Calendar
} from 'lucide-react';
import { useRoomMap } from '@/hooks/useRoomMap';
import { PropertyResponse } from '@/types/api';
import { 
  MapRoomData, 
  MapReservationResponse,
  MapQuickBooking
} from '@/types/room-map';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Componentes
import RoomMapGrid from '@/components/room-map/RoomMapGrid';
import RoomMapQuickBooking from '@/components/room-map/RoomMapQuickBooking';

export default function RoomMapPage() {
  const [selectedStartDate, setSelectedStartDate] = useState(() => 
    format(new Date(), 'yyyy-MM-dd')
  );

  const {
    mapData,
    loading,
    error,
    filters,
    loadMapData,
    updateFilters,
    createQuickBooking
  } = useRoomMap({
    initialDays: 31, // 31 dias fixos
  });

  // Estados locais
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<MapRoomData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { toast } = useToast();

  // Carregar propriedades
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoadingProperties(true);
        const response = await apiClient.getProperties({ per_page: 100 });
        setProperties(response.properties || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as propriedades",
          variant: "destructive",
        });
      } finally {
        setLoadingProperties(false);
      }
    };

    loadProperties();
  }, [toast]);

  // Atualizar filtros quando a data inicial mudar
  useEffect(() => {
    const startDate = new Date(selectedStartDate + 'T00:00:00');
    const endDate = addDays(startDate, 31);

    updateFilters({
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd')
    });
  }, [selectedStartDate, updateFilters]);

  // Handlers
  const handleDateChange = (dateStr: string) => {
    setSelectedStartDate(dateStr);
  };

  const handleRoomClick = (room: MapRoomData) => {
    console.log('Room clicked:', room);
  };

  const handleReservationClick = (reservation: MapReservationResponse, room: MapRoomData) => {
    console.log('Reservation clicked:', reservation, room);
  };

  const handleCellClick = (room: MapRoomData, date: string) => {
    if (!room.is_operational || room.is_out_of_order) {
      toast({
        title: "Quarto Indisponível",
        description: "Este quarto não está operacional no momento",
        variant: "destructive",
      });
      return;
    }

    // Verificar se há reserva nesta data
    const hasReservation = room.reservations.some(r => {
      const checkIn = new Date(r.check_in_date + 'T00:00:00');
      const checkOut = new Date(r.check_out_date + 'T00:00:00');
      const cellDate = new Date(date + 'T00:00:00');
      return cellDate >= checkIn && cellDate < checkOut;
    });

    if (hasReservation) {
      toast({
        title: "Quarto Ocupado",
        description: "Este quarto já possui reserva para esta data",
        variant: "destructive",
      });
      return;
    }

    // Abrir modal de reserva rápida
    setSelectedRoom(room);
    setSelectedDate(date);
    setIsQuickBookingOpen(true);
  };

  const handleQuickBooking = () => {
    setSelectedRoom(null);
    setSelectedDate(null);
    setIsQuickBookingOpen(true);
  };

  const handleQuickBookingSubmit = async (booking: MapQuickBooking) => {
    await createQuickBooking(booking);
  };

  const handleQuickBookingClose = () => {
    setIsQuickBookingOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
  };

  const handleRefresh = async () => {
    await loadMapData();
  };

  // Obter quartos disponíveis para reserva rápida
  const availableRooms = mapData?.categories.flatMap(category => 
    category.rooms.filter(room => room.is_operational && !room.is_out_of_order)
  ) || [];

  return (
    <div className="space-y-6 pb-6">
      {/* Header da página */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Map className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa de Quartos</h1>
            <p className="text-gray-600">
              Visualização de ocupação dos quartos
            </p>
          </div>
        </div>

        <Button onClick={handleQuickBooking} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Reserva
        </Button>
      </div>

      {/* Controles simples */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Seletor de data inicial */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Label htmlFor="start-date" className="text-sm font-medium">
                  Data inicial:
                </Label>
              </div>
              <Input
                id="start-date"
                type="date"
                value={selectedStartDate}
                onChange={(e) => handleDateChange(e.target.value)}
                disabled={loading}
                className="w-40"
              />
              <span className="text-sm text-gray-500">
                (mostra 31 dias consecutivos)
              </span>
            </div>

            {/* Botão atualizar */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Mapa principal */}
      <Card>
        <CardContent className="p-0">
          {loading && !mapData ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">Carregando mapa de quartos...</p>
              <p className="text-sm text-gray-500">
                Período: {format(new Date(selectedStartDate), 'dd/MM/yyyy')} - {format(addDays(new Date(selectedStartDate), 30), 'dd/MM/yyyy')}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Indicador de scroll horizontal */}
              {mapData && mapData.date_headers && mapData.date_headers.length > 0 && (
                <div className="absolute top-2 right-4 z-20 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                  ← Role para ver todos os {mapData.date_headers.length} dias →
                </div>
              )}
              
              <div className="overflow-x-auto overflow-y-hidden">
                <RoomMapGrid
                  mapData={mapData!}
                  onRoomClick={handleRoomClick}
                  onReservationClick={handleReservationClick}
                  onCellClick={handleCellClick}
                  loading={loading}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda compacta */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-white border border-gray-300 rounded"></div>
              <span>Disponível</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Confirmada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Check-in</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span>Inativo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Chegada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span>Saída</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Reserva Rápida */}
      <RoomMapQuickBooking
        isOpen={isQuickBookingOpen}
        onClose={handleQuickBookingClose}
        onSubmit={handleQuickBookingSubmit}
        selectedRoom={selectedRoom}
        selectedDate={selectedDate}
        availableRooms={availableRooms}
        properties={properties}
        loading={loading}
      />
    </div>
  );
}