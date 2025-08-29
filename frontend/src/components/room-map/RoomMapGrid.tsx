// frontend/src/components/room-map/RoomMapGrid.tsx
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  
  // ✅ CORREÇÃO 1: TODOS os hooks no topo do componente, na ordem correta
  
  // Hook 1: Gerar cabeçalhos de data
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

  // ✅ CORREÇÃO 2: Hook totalWidth MOVIDO para o topo (era o problema!)
  const totalWidth = useMemo(() => {
    const roomColumnWidth = 192; // 12rem = 192px (w-48)
    const cellWidth = 64; // 4rem = 64px (w-16)
    return roomColumnWidth + (dateHeaders.length * cellWidth);
  }, [dateHeaders.length]);

  // ✅ CORREÇÃO 3: Funções render APÓS todos os hooks
  
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
            "w-16 h-5 border-r border-gray-200 cursor-pointer transition-colors flex-shrink-0 min-w-[4rem]",
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
            <Wrench className="h-2 w-2 text-red-500" />
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
          "w-16 h-5 border-r border-gray-200 cursor-pointer relative flex-shrink-0 min-w-[4rem]",
          "flex items-center justify-center text-[10px] font-medium",
          getReservationColor(reservation.status),
          isToday && "border-l-2 border-l-blue-600",
          isFirstDay && "rounded-l-sm",
          isLastDay && "rounded-r-sm"
        )}
        title={`${reservation.guest_name} - ${reservation.reservation_number}`}
      >
        {/* Conteúdo da reserva - apenas no primeiro dia */}
        {isFirstDay && (
          <div className="flex items-center justify-center px-0.5 text-center overflow-hidden">
            <span className="text-[8px] font-medium truncate leading-tight">
              {reservation.guest_name.split(' ')[0].substring(0, 4)}
            </span>
          </div>
        )}

        {/* Indicadores de chegada/saída - menores */}
        {reservation.is_arrival && (
          <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-green-400 rounded-full" />
        )}
        {reservation.is_departure && (
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-400 rounded-full" />
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
      <div key={room.id} className="flex border-b border-gray-100 last:border-b-0 border-b-[0.5px]">
        {/* ✅ Info do quarto - ALTURA AUMENTADA EM 20% */}
        <div 
          className="w-48 px-2 py-1.5 bg-white border-r border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 flex-shrink-0 h-6"
          onClick={() => onRoomClick?.(room)}
          title={`${room.name}${room.floor ? ` - Andar ${room.floor}` : ''} - ${Math.round(room.occupancy_rate)}% ocupado`}
        >
          {/* Nome do quarto */}
          <div className="font-medium text-xs text-gray-900 truncate">
            {room.name}
          </div>
          
          {/* Ícones de status */}
          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
            {!room.is_operational && (
              <AlertTriangle className="h-2.5 w-2.5 text-red-500" title="Quarto inativo" />
            )}
            {room.is_out_of_order && (
              <Wrench className="h-2.5 w-2.5 text-red-500" title="Quarto em manutenção" />
            )}
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
      <div key={category.room_type_id} className="mb-1">
        {/* Header da categoria - SEM NÚMEROS */}
        <div className="bg-gray-50 border border-gray-200 rounded-t-lg px-2 py-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-xs">
                {category.room_type_name.replace(/\s+\d+$/, '')}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <div className="flex items-center gap-0.5">
                <Bed className="h-2.5 w-2.5" />
                <span>{category.operational_rooms}/{category.total_rooms}</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{Math.round(category.average_occupancy_rate)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quartos da categoria */}
        <div className="border-x border-b border-gray-200 rounded-b-lg">
          {category.rooms.map(room => renderRoomRow(room))}
        </div>
      </div>
    );
  };

  // ✅ VERIFICAÇÃO: Loading ou dados vazios
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando quartos...</span>
      </div>
    );
  }

  if (!mapData) {
    return (
      <div className="p-8 text-center">
        <Bed className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum dado disponível
        </h3>
        <p className="text-gray-500">
          Aguarde o carregamento dos dados ou verifique os filtros.
        </p>
      </div>
    );
  }

  // ✅ RENDER PRINCIPAL
  return (
    <div className={cn("bg-white")} style={{ minWidth: `${totalWidth}px` }}>
      {/* Header das datas - AJUSTADO PARA NOVA ALTURA DOS QUARTOS */}
      <div className="flex border-b border-gray-300 bg-gray-50 sticky top-0 z-10">
        <div className="w-48 px-2 py-1.5 border-r border-gray-300 bg-gray-50 flex-shrink-0 h-6 flex items-center">
          <div className="font-semibold text-xs">Quartos</div>
        </div>
        <div className="flex">
          {dateHeaders.map(header => (
            <div 
              key={header.date}
              className={cn(
                "w-16 px-0.5 py-0.5 text-center border-r border-gray-200 flex-shrink-0 min-w-[4rem] h-5 flex flex-col items-center justify-center",
                header.isWeekend && "bg-gray-100",
                header.isToday && "bg-blue-100 border-l-2 border-l-blue-500"
              )}
            >
              <div className="text-[8px] font-medium leading-2">{header.dayOfWeek}</div>
              <div className="text-xs leading-2">{header.dayOfMonth}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorias e quartos - ALTURA COMPLETA */}
      <div className="h-full overflow-y-auto">
        {mapData.categories.length === 0 ? (
          <div className="p-6 text-center">
            <Bed className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">
              Nenhum quarto encontrado
            </h3>
            <p className="text-sm text-gray-500">
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