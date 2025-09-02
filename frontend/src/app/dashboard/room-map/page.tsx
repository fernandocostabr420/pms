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

// 🔄 NOVOS IMPORTS - Componente Padronizado
import StandardReservationModal from '@/components/reservations/StandardReservationModal';
import { RESERVATION_MODAL_CONFIGS } from '@/components/reservations/configs/reservationModalConfigs';

export default function RoomMapPage() {
  // Estados principais
  const [selectedStartDate, setSelectedStartDate] = useState(() => 
    format(new Date(), 'yyyy-MM-dd')
  );
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  
  // 🔄 ESTADOS ATUALIZADOS - Substituindo RoomMapQuickBooking
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
    filters,
    loadMapData,
    updateFilters,
    createQuickBooking
  } = useRoomMap({
    initialDays: 31,
  });

  // Carregamento de propriedades
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

  // Quartos disponíveis
  const availableRooms = mapData?.categories.flatMap(category => 
    category.rooms.filter(room => room.is_operational && !room.is_out_of_order)
  ) || [];

  // Handlers de interação
  const handleRoomClick = (room: MapRoomData) => {
    console.log('Room clicked:', room);
  };

  // Handler de reserva (mantido para compatibilidade)
  const handleReservationClick = (reservation: MapReservationResponse, room: MapRoomData) => {
    console.log('Reservation clicked (fallback):', reservation, room);
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

    // 🔄 ATUALIZADO - Abrir modal padronizado com dados pré-selecionados
    setSelectedRoom(room);
    setSelectedDate(date);
    setIsQuickBookingOpen(true);
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      setSelectedStartDate(dateStr);
      setCalendarDate(date);
      setIsCalendarOpen(false); // Fechar o calendário após seleção
    }
  };

  // 🔄 HANDLERS ATUALIZADOS - Para o StandardReservationModal
  const handleQuickBookingClose = () => {
    setIsQuickBookingOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
  };

  const handleQuickBookingSuccess = () => {
    setIsQuickBookingOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
    loadMapData(); // Recarregar dados do mapa
    toast({
      title: "Sucesso",
      description: "Reserva criada com sucesso"
    });
  };

  // Handler para Nova Reserva genérica (sem quarto específico)
  const handleQuickBooking = () => {
    setSelectedRoom(null);
    setSelectedDate(null);
    setIsQuickBookingOpen(true);
  };

  const handleRefresh = async () => {
    await loadMapData();
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
    <div className="space-y-4 w-full max-w-full px-4 sm:px-6 lg:px-8">
      {/* Header da página */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-3">
          {/* Linha superior: Título e botão principal */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Map className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mapa de Quartos</h1>
                <p className="text-sm text-gray-500">
                  {mapData ? `${mapData.total_rooms} quartos cadastrados` : 'Carregando informações...'}
                </p>
              </div>
            </div>
            
            {/* 🔄 BOTÃO ATUALIZADO - Conectado ao handler do modal padronizado */}
            <Button onClick={handleQuickBooking} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium text-sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
          </div>

          {/* Linha inferior: Controles e informações */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            {/* Controles de data */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-date" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                    Data inicial:
                  </Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal w-[130px] sm:w-[140px] border-gray-300 h-8 text-xs",
                          !selectedStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 flex-shrink-0 text-gray-500" />
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
                  className="border-gray-300 hover:bg-gray-50 h-8 px-3 text-xs"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              
              <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                <span className="font-medium">Período:</span>{' '}
                {format(new Date(selectedStartDate), 'dd/MM/yyyy')} - {format(addDays(new Date(selectedStartDate), 30), 'dd/MM/yyyy')}
              </div>
            </div>

            {/* Cards de estatísticas */}
            <div className="lg:col-span-7">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <div className="text-blue-600 text-[10px] font-medium uppercase tracking-wide">Total</div>
                  <div className="text-blue-900 text-lg font-bold leading-none">
                    {mapData?.total_rooms || 0}
                  </div>
                  <div className="text-blue-600 text-[10px]">Quartos</div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                  <div className="text-green-600 text-[10px] font-medium uppercase tracking-wide">Ocupados</div>
                  <div className="text-green-900 text-lg font-bold leading-none">
                    {totalOccupied}
                  </div>
                  <div className="text-green-600 text-[10px]">Hoje</div>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="text-amber-600 text-[10px] font-medium uppercase tracking-wide">Livres</div>
                  <div className="text-amber-900 text-lg font-bold leading-none">
                    {totalAvailable}
                  </div>
                  <div className="text-amber-600 text-[10px]">Hoje</div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                  <div className="text-purple-600 text-[10px] font-medium uppercase tracking-wide">Ocupação</div>
                  <div className="text-purple-900 text-lg font-bold leading-none">
                    {occupancyRate}%
                  </div>
                  <div className="text-purple-600 text-[10px]">Taxa</div>
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

      {/* 🔄 MODAL PADRONIZADO - Substitui RoomMapQuickBooking */}
      <StandardReservationModal
        isOpen={isQuickBookingOpen}
        onClose={handleQuickBookingClose}
        onSuccess={handleQuickBookingSuccess}
        prefilledData={selectedRoom && selectedDate ? {
          // DADOS PRÉ-SELECIONADOS DO MAPA
          room_id: selectedRoom.id,
          selected_date: selectedDate,
          property_id: selectedRoom.property_id,
          source: 'room_map',
        } : undefined}
        {...RESERVATION_MODAL_CONFIGS.ROOM_MAP_BOOKING}
      />
    </div>
  );
}