// frontend/src/components/room-map/RoomMapGrid.tsx
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  MapResponse, 
  MapCategoryData, 
  MapRoomData, 
  MapReservationResponse 
} from '@/types/room-map';
import { 
  Bed, 
  AlertTriangle, 
  Wrench,
  Calendar,
  DollarSign
} from 'lucide-react';

interface RoomMapGridProps {
  mapData: MapResponse;
  onRoomClick?: (room: MapRoomData) => void;
  onReservationClick?: (reservation: MapReservationResponse, room: MapRoomData) => void;
  onCellClick?: (room: MapRoomData, date: string) => void;
  loading?: boolean;
}

interface DateHeader {
  date: string;
  dayOfWeek: string;
  dayOfMonth: string;
  isWeekend: boolean;
  isToday: boolean;
}

export default function RoomMapGrid({
  mapData,
  onRoomClick,
  onReservationClick,
  onCellClick,
  loading = false
}: RoomMapGridProps) {
  
  // Gerar cabeçalhos de data
  const dateHeaders = useMemo((): DateHeader[] => {
    if (!mapData?.date_headers) return [];
    
    return mapData.date_headers.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        date: dateStr,
        dayOfWeek: format(date, 'EEE', { locale: ptBR }),
        dayOfMonth: format(date, 'd'),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      };
    });
  }, [mapData]);

  // Renderizar célula de reserva
  const renderReservationCell = (
    room: MapRoomData, 
    date: string, 
    reservation?: MapReservationResponse
  ) => {
    const isToday = format(new Date(), 'yyyy-MM-dd') === date;
    const isWeekend = dateHeaders.find(h => h.date === date)?.isWeekend;

    if (!reservation) {
      // Célula vazia - disponível
      const isEmpty = room.is_operational && !room.is_out_of_order;
      
      return (
        <div
          key={date}
          onClick={() => onCellClick?.(room, date)}
          className={cn(
            "w-16 h-12 border-r border-gray-200 cursor-pointer transition-colors flex-shrink-0 min-w-[4rem]",
            "hover:bg-blue-50 flex items-center justify-center",
            isToday && "border-l-2 border-l-blue-500",
            isWeekend && "bg-gray-50",
            room.is_out_of_order && "bg-red-50 cursor-not-allowed",
            !room.is_operational && "bg-gray-100 cursor-not-allowed"
          )}
          title={
            room.is_out_of_order 
              ? "Quarto fora de funcionamento" 
              : !room.is_operational 
              ? "Quarto inativo" 
              : "Disponível - Clique para reservar"
          }
        >
          {room.is_out_of_order && (
            <Wrench className="h-3 w-3 text-red-500" />
          )}
        </div>
      );
    }

    // Determinar posição da reserva
    const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
    const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
    const currentDate = new Date(date + 'T00:00:00');
    
    const isFirstDay = format(checkIn, 'yyyy-MM-dd') === date;
    const isLastDay = format(checkOut, 'yyyy-MM-dd') === date;
    const isMiddleDay = currentDate > checkIn && currentDate < checkOut;

    if (!isFirstDay && !isLastDay && !isMiddleDay) return null;

    // Cores por status
    const getReservationColor = (status: string) => {
      switch (status) {
        case 'confirmed':
          return 'bg-blue-500 text-white';
        case 'checked_in':
          return 'bg-green-500 text-white';
        case 'pending':
          return 'bg-yellow-500 text-white';
        case 'cancelled':
          return 'bg-red-500 text-white';
        default:
          return 'bg-gray-500 text-white';
      }
    };

    return (
      <div
        key={`${date}-${reservation.id}`}
        onClick={() => onReservationClick?.(reservation, room)}
        className={cn(
          "w-16 h-12 border-r border-gray-200 cursor-pointer relative flex-shrink-0 min-w-[4rem]",
          "flex items-center justify-center text-xs font-medium",
          getReservationColor(reservation.status),
          isToday && "border-l-2 border-l-blue-600",
          isFirstDay && "rounded-l-sm",
          isLastDay && "rounded-r-sm"
        )}
        title={`${reservation.guest_name} - ${reservation.reservation_number}`}
      >
        {/* Conteúdo da reserva - apenas no primeiro dia */}
        {isFirstDay && (
          <div className="flex items-center justify-center px-1 text-center overflow-hidden">
            <span className="text-[10px] font-medium truncate leading-tight">
              {reservation.guest_name.split(' ')[0]}
            </span>
          </div>
        )}

        {/* Indicadores de chegada/saída */}
        {reservation.is_arrival && (
          <div className="absolute top-0 left-0 w-2 h-2 bg-green-400 rounded-full" />
        )}
        {reservation.is_departure && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-red-400 rounded-full" />
        )}
      </div>
    );
  };

  // Renderizar linha do quarto
  const renderRoomRow = (room: MapRoomData) => {
    // Mapear reservas por data
    const reservationsByDate: Record<string, MapReservationResponse | undefined> = {};
    
    room.reservations.forEach(reservation => {
      const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
      const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
      
      // Preencher todas as datas da reserva
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        if (dateHeaders.some(h => h.date === dateStr)) {
          reservationsByDate[dateStr] = reservation;
        }
      }
    });

    return (
      <div key={room.id} className="flex border-b border-gray-200">
        {/* Info do quarto */}
        <div 
          className="w-48 p-3 bg-white border-r border-gray-200 flex flex-col justify-center cursor-pointer hover:bg-gray-50 flex-shrink-0"
          onClick={() => onRoomClick?.(room)}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium text-sm">{room.room_number}</div>
            <div className="flex items-center gap-1">
              {!room.is_operational && (
                <AlertTriangle className="h-3 w-3 text-red-500" title="Inativo" />
              )}
              {room.is_out_of_order && (
                <Wrench className="h-3 w-3 text-red-500" title="Manutenção" />
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 truncate">{room.name}</div>
          {room.floor && (
            <div className="text-xs text-gray-400">Andar {room.floor}</div>
          )}
          <div className="text-xs text-gray-400 mt-1">
            {Math.round(room.occupancy_rate)}% ocupado
          </div>
        </div>

        {/* Células de data */}
        <div className="flex">
          {dateHeaders.map(header => 
            renderReservationCell(room, header.date, reservationsByDate[header.date])
          )}
        </div>
      </div>
    );
  };

  // Renderizar categoria
  const renderCategory = (category: MapCategoryData) => {
    if (category.rooms.length === 0) return null;

    return (
      <div key={category.room_type_id} className="mb-6">
        {/* Header da categoria */}
        <div className="bg-gray-50 border border-gray-200 rounded-t-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">{category.room_type_name}</h3>
              <Badge variant="outline">
                {category.rooms.length} quarto{category.rooms.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                {Math.round(category.average_occupancy_rate)}% ocupação
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                R$ {category.total_revenue.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Quartos da categoria */}
        <Card className="rounded-t-none">
          {category.rooms.map(room => renderRoomRow(room))}
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded mb-2"></div>
              <div className="flex gap-1">
                {[...Array(14)].map((_, j) => (
                  <div key={j} className="h-8 flex-1 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!mapData || !dateHeaders.length) {
    return (
      <div className="p-8 text-center">
        <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum dado encontrado
        </h3>
        <p className="text-gray-500">
          Selecione um período e propriedade para visualizar o mapa de quartos.
        </p>
      </div>
    );
  }

  // Calcular largura total do grid (largura das células + largura da coluna de quartos)  
  const totalWidth = useMemo(() => {
    const roomColumnWidth = 192; // 12rem = 192px (w-48)
    const cellWidth = 64; // 4rem = 64px (w-16)
    return roomColumnWidth + (dateHeaders.length * cellWidth);
  }, [dateHeaders.length]);

  return (
    <div className={cn("bg-white")} style={{ minWidth: `${totalWidth}px` }}>
      {/* Header das datas */}
      <div className="flex border-b border-gray-300 bg-gray-50 sticky top-0 z-10">
        <div className="w-48 p-3 border-r border-gray-300 bg-gray-50 flex-shrink-0">
          <div className="font-semibold text-sm">Quartos</div>
        </div>
        <div className="flex">
          {dateHeaders.map(header => (
            <div 
              key={header.date}
              className={cn(
                "w-16 p-2 text-center border-r border-gray-200 flex-shrink-0 min-w-[4rem]",
                header.isWeekend && "bg-gray-100",
                header.isToday && "bg-blue-100 border-l-2 border-l-blue-500"
              )}
            >
              <div className="text-xs font-medium">{header.dayOfWeek}</div>
              <div className="text-sm">{header.dayOfMonth}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorias e quartos */}
      <div className="max-h-[70vh] overflow-y-auto">
        {mapData.categories.length === 0 ? (
          <div className="p-8 text-center">
            <Bed className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum quarto encontrado
            </h3>
            <p className="text-gray-500">
              Não há quartos cadastrados para os filtros selecionados.
            </p>
          </div>
        ) : (
          mapData.categories.map(category => renderCategory(category))
        )}
      </div>
    </div>
  );
}