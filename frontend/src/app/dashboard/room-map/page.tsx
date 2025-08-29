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
  // ✅ Estados principais
  const [selectedStartDate, setSelectedStartDate] = useState(() => 
    format(new Date(), 'yyyy-MM-dd')
  );
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<MapRoomData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // ✅ CORREÇÃO: Estado para controlar o calendário Popover
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { toast } = useToast();

  const {
    mapData,
    loading,
    error,
    filters,
    loadMapData,
    updateFilters,
    createQuickBooking
  } = useRoomMap({
    initialDays: 31,
  });

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
  }, []);

  // Sincronizar calendarDate com selectedStartDate
  useEffect(() => {
    setCalendarDate(new Date(selectedStartDate + 'T00:00:00'));
  }, [selectedStartDate]);

  // Atualizar filtros quando a data inicial mudar
  useEffect(() => {
    const startDate = new Date(selectedStartDate + 'T00:00:00');
    const endDate = addDays(startDate, 31);

    const newStartDate = format(startDate, 'yyyy-MM-dd');
    const newEndDate = format(endDate, 'yyyy-MM-dd');
    
    if (filters.start_date !== newStartDate || filters.end_date !== newEndDate) {
      updateFilters({
        start_date: newStartDate,
        end_date: newEndDate
      });
    }
  }, [selectedStartDate, filters.start_date, filters.end_date, updateFilters]);

  // ✅ CORREÇÃO: Handler para seleção de data no calendário
  const handleCalendarDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      setSelectedStartDate(dateStr);
      setCalendarDate(date);
      setIsCalendarOpen(false); // Fechar o calendário após seleção
    }
  };

  // Outros handlers
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
    try {
      await createQuickBooking(booking);
      toast({
        title: "Sucesso",
        description: "Reserva criada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.detail || "Erro ao criar reserva",
        variant: "destructive",
      });
    }
  };

  const handleQuickBookingClose = () => {
    setIsQuickBookingOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
  };

  const handleRefresh = async () => {
    await loadMapData();
  };

  // Quartos disponíveis
  const availableRooms = mapData?.categories.flatMap(category => 
    category.rooms.filter(room => room.is_operational && !room.is_out_of_order)
  ) || [];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* Header compacto fixo */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Título + Data */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Map className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mapa de Quartos</h1>
              </div>
            </div>
            
            {/* Seletor de data compacto */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-gray-700">Data inicial:</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-40 justify-start text-left font-normal",
                      !calendarDate && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {calendarDate 
                      ? format(calendarDate, "dd/MM/yyyy", { locale: ptBR }) 
                      : "Selecionar"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={handleCalendarDateSelect}
                    disabled={(date) => date < new Date(new Date().toDateString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={handleQuickBooking} size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Reserva
            </Button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Mapa ocupando todo o espaço restante */}
      <div className="flex-1 overflow-hidden">
        {loading && !mapData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">Carregando mapa de quartos...</p>
              <p className="text-sm text-gray-500">
                Período: {format(new Date(selectedStartDate), 'dd/MM/yyyy')} - {format(addDays(new Date(selectedStartDate), 30), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        ) : mapData ? (
          <div className="h-full relative">
            
            <div className="h-full overflow-auto">
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
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">Nenhum dado encontrado</p>
              <p className="text-sm text-gray-500 mb-4">
                Selecione uma data e clique em Atualizar para carregar os dados
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Carregar Dados
              </Button>
            </div>
          </div>
        )}
      </div>

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