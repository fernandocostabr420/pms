// frontend/src/app/dashboard/room-map/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  AlertTriangle,
  Map,
  RefreshCw,
  Plus,
  Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  // Estados principais
  const [selectedStartDate, setSelectedStartDate] = useState(() => 
    format(new Date(), 'yyyy-MM-dd')
  );
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<MapRoomData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Estado para controlar o calendário Popover
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { toast } = useToast();

  const {
    mapData,
    loading,
    error,
    refresh: handleRefresh,
    updateFilters,
    filters
  } = useRoomMap({
    start_date: selectedStartDate,
    end_date: format(addDays(new Date(selectedStartDate), 30), 'yyyy-MM-dd'),
  });

  // Carregamento de propriedades
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoadingProperties(true);
        const response = await apiClient.getProperties({});
        setProperties(response.data || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar propriedades",
          variant: "destructive",
        });
      } finally {
        setLoadingProperties(false);
      }
    };
    loadProperties();
  }, [toast]);

  // Disponibilidade de quartos para reserva rápida
  const availableRooms = mapData?.categories.flatMap(cat => 
    cat.rooms.filter(room => 
      room.is_operational && 
      !room.is_out_of_order &&
      selectedDate && !room.reservations.some(res => {
        const checkIn = new Date(res.check_in_date + 'T00:00:00');
        const checkOut = new Date(res.check_out_date + 'T00:00:00');
        const targetDate = new Date(selectedDate + 'T00:00:00');
        return targetDate >= checkIn && targetDate < checkOut;
      })
    )
  ) || [];

  // Handlers de interação
  const handleRoomClick = (room: MapRoomData) => {
    console.log('Room clicked:', room);
  };

  const handleReservationClick = (reservation: MapReservationResponse, room: MapRoomData) => {
    console.log('Reservation clicked:', reservation, room);
  };

  const handleCellClick = (room: MapRoomData, date: string) => {
    if (!room.is_operational || room.is_out_of_order) {
      return;
    }
    
    const hasReservation = room.reservations.some(res => {
      const checkIn = new Date(res.check_in_date + 'T00:00:00');
      const checkOut = new Date(res.check_out_date + 'T00:00:00');
      const targetDate = new Date(date + 'T00:00:00');
      return targetDate >= checkIn && targetDate < checkOut;
    });

    if (hasReservation) {
      return;
    }

    setSelectedRoom(room);
    setSelectedDate(date);
    setIsQuickBookingOpen(true);
  };

  const handleDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    const formattedDate = format(date, 'yyyy-MM-dd');
    setSelectedStartDate(formattedDate);
    setCalendarDate(date);
    setIsCalendarOpen(false);
    
    updateFilters({
      start_date: formattedDate,
      end_date: format(addDays(date, 30), 'yyyy-MM-dd'),
    });
  };

  const handleQuickBookingClose = () => {
    setIsQuickBookingOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
  };

  const handleQuickBookingSubmit = async (bookingData: MapQuickBooking) => {
    try {
      console.log('Creating quick booking:', bookingData);
      
      toast({
        title: "Sucesso",
        description: "Reserva criada com sucesso!",
      });
      
      handleQuickBookingClose();
      handleRefresh();
    } catch (error: any) {
      console.error('Erro ao criar reserva:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || "Erro ao criar reserva",
        variant: "destructive",
      });
    }
  };

  // Calcular estatísticas
  const totalOccupied = mapData ? mapData.categories.reduce((sum, cat) => 
    sum + cat.rooms.filter(room => 
      room.reservations.some(res => {
        const checkIn = new Date(res.check_in_date + 'T00:00:00');
        const checkOut = new Date(res.check_out_date + 'T00:00:00');
        const today = new Date();
        return today >= checkIn && today < checkOut;
      })
    ).length, 0
  ) : 0;

  const totalAvailable = (mapData?.total_rooms || 0) - totalOccupied;
  const occupancyRate = mapData?.total_rooms ? Math.round((totalOccupied / mapData.total_rooms) * 100) : 0;

  return (
    <div className="space-y-6 w-full max-w-full px-4 sm:px-6 lg:px-8">
      {/* Header aprimorado da página */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          {/* Linha superior: Título e botão principal */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Map className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mapa de Quartos</h1>
                <p className="text-gray-500 mt-1">
                  {mapData ? `${mapData.total_rooms} quartos cadastrados` : 'Carregando informações...'}
                </p>
              </div>
            </div>
            
            {/* Botão Nova Reserva */}
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
          </div>

          {/* Linha inferior: Controles e informações */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            {/* Controles de data */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-date" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Data inicial:
                  </Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal w-[140px] sm:w-[160px] border-gray-300",
                          !selectedStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span className="truncate">
                          {selectedStartDate ? format(new Date(selectedStartDate), "dd/MM/yyyy") : "Selecionar"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={calendarDate}
                        onSelect={handleDateChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button 
                  onClick={handleRefresh} 
                  disabled={loading}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
                <span className="font-medium">Período:</span>{' '}
                {format(new Date(selectedStartDate), 'dd/MM/yyyy')} - {format(addDays(new Date(selectedStartDate), 30), 'dd/MM/yyyy')}
              </div>
            </div>

            {/* Cards de estatísticas */}
            <div className="lg:col-span-7">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-600 text-xs font-medium uppercase tracking-wide">Total</div>
                  <div className="text-blue-900 text-xl font-bold mt-1">
                    {mapData?.total_rooms || 0}
                  </div>
                  <div className="text-blue-600 text-xs">Quartos</div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-green-600 text-xs font-medium uppercase tracking-wide">Ocupados</div>
                  <div className="text-green-900 text-xl font-bold mt-1">
                    {totalOccupied}
                  </div>
                  <div className="text-green-600 text-xs">Hoje</div>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-amber-600 text-xs font-medium uppercase tracking-wide">Livres</div>
                  <div className="text-amber-900 text-xl font-bold mt-1">
                    {totalAvailable}
                  </div>
                  <div className="text-amber-600 text-xs">Hoje</div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-purple-600 text-xs font-medium uppercase tracking-wide">Ocupação</div>
                  <div className="text-purple-900 text-xl font-bold mt-1">
                    {occupancyRate}%
                  </div>
                  <div className="text-purple-600 text-xs">Taxa</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="min-w-0">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* MAPA RESPONSIVO COM SCROLL HORIZONTAL */}
      <Card className="w-full">
        <CardContent className="p-0 w-full overflow-hidden">
          {loading && !mapData ? (
            <div className="p-8 sm:p-12 text-center">
              <RefreshCw className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-base sm:text-lg text-gray-600 mb-2">Carregando mapa de quartos...</p>
              <p className="text-xs sm:text-sm text-gray-500">
                Período: {format(new Date(selectedStartDate), 'dd/MM/yyyy')} - {format(addDays(new Date(selectedStartDate), 30), 'dd/MM/yyyy')}
              </p>
            </div>
          ) : mapData ? (
            <div className="w-full room-map-container">
              <div className="w-full overflow-x-auto room-map-scroll">
                <RoomMapGrid
                  mapData={mapData}
                  onRoomClick={handleRoomClick}
                  onReservationClick={handleReservationClick}
                  onCellClick={handleCellClick}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center">
              <Map className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-base sm:text-lg text-gray-600 mb-2">Nenhum dado encontrado</p>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">
                Selecione uma data e clique em Atualizar para carregar os dados
              </p>
              <Button onClick={handleRefresh} variant="outline" className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Carregar Dados
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda compacta e responsiva */}
      <Card className="w-full">
        <CardContent className="p-2 sm:p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:flex lg:items-center lg:justify-center gap-2 lg:gap-6 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-white border border-gray-300 rounded flex-shrink-0"></div>
              <span className="truncate">Disponível</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded flex-shrink-0"></div>
              <span className="truncate">Confirmada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded flex-shrink-0"></div>
              <span className="truncate">Check-in</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded flex-shrink-0"></div>
              <span className="truncate">Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 rounded flex-shrink-0"></div>
              <span className="truncate">Inativo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
              <span className="truncate">Chegada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
              <span className="truncate">Saída</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de reserva rápida */}
      {isQuickBookingOpen && (
        <RoomMapQuickBooking
          isOpen={isQuickBookingOpen}
          onClose={handleQuickBookingClose}
          onSubmit={handleQuickBookingSubmit}
          selectedRoom={selectedRoom}
          selectedDate={selectedDate}
          availableRooms={availableRooms}
        />
      )}
    </div>
  );
}