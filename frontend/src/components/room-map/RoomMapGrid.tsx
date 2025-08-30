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
  
  // ✅ Hook 1: Gerar cabeçalhos de data
  const dateHeaders = useMemo((): DateHeader[] => {
    if (!mapData?.date_headers) return [];
    
    return mapData.date_headers.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        date: dateStr,
        dayOfWeek: format(date, 'EEE', { locale: ptBR }),
        dayOfMonth: format(date, 'd'),
        isWeekend: date.getDay() === 5 || date.getDay() === 6,
        isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      };
    });
  }, [mapData]);

  // ✅ Hook 2: Calcular larguras responsivas
  const gridDimensions = useMemo(() => {
    const baseRoomColumnWidth = 160; // Reduzido para mobile
    const baseCellWidth = 48; // Reduzido para mobile
    
    // Responsivo baseado na viewport
    const roomColumnWidth = window.innerWidth < 640 ? 140 : 
                           window.innerWidth < 1024 ? 160 : 192;
    const cellWidth = window.innerWidth < 640 ? 44 : 
                     window.innerWidth < 1024 ? 52 : 64;
    
    const totalWidth = roomColumnWidth + (dateHeaders.length * cellWidth);
    
    return {
      roomColumnWidth,
      cellWidth,
      totalWidth
    };
  }, [dateHeaders.length]);

  // ✅ Hook 3: Calcular ocupação por dia
  const dailyOccupancy = useMemo(() => {
    if (!mapData?.categories) return {};
    
    const occupancyByDate: Record<string, { occupied: number; total: number; percentage: number }> = {};
    
    dateHeaders.forEach(header => {
      let totalRooms = 0;
      let occupiedRooms = 0;
      
      mapData.categories.forEach(category => {
        category.rooms.forEach(room => {
          if (room.is_operational && !room.is_out_of_order) {
            totalRooms++;
            
            // Verificar se há reserva nesta data
            const hasReservation = room.reservations.some(res => {
              const checkIn = new Date(res.check_in_date + 'T00:00:00');
              const checkOut = new Date(res.check_out_date + 'T00:00:00');
              const targetDate = new Date(header.date + 'T00:00:00');
              return targetDate >= checkIn && targetDate < checkOut;
            });
            
            if (hasReservation) {
              occupiedRooms++;
            }
          }
        });
      });
      
      occupancyByDate[header.date] = {
        occupied: occupiedRooms,
        total: totalRooms,
        percentage: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
      };
    });
    
    return occupancyByDate;
  }, [mapData, dateHeaders]);
  const renderRoomRow = (room: MapRoomData) => {
    return (
      <div key={room.id} className="flex border-b border-gray-100 last:border-b-0 border-b-[0.5px] relative min-w-0">
        {/* Info do quarto - RESPONSIVO */}
        <div 
          className="px-2 py-1.5 bg-white border-r border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 flex-shrink-0 h-7 sm:h-8"
          style={{ width: `${gridDimensions.roomColumnWidth}px` }}
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
              <AlertTriangle className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-red-500" title="Quarto inativo" />
            )}
            {room.is_out_of_order && (
              <Wrench className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-red-500" title="Quarto em manutenção" />
            )}
          </div>
        </div>

        {/* Container das células - RESPONSIVO */}
        <div className="relative grid-dates-container flex-1 min-w-0">
          {/* Grid das células de datas */}
          <div className="flex">
            {dateHeaders.map(header => {
              const isToday = header.isToday;
              const isWeekend = header.isWeekend;
              
              return (
                <div
                  key={header.date}
                  onClick={() => onCellClick?.(room, header.date)}
                  className={cn(
                    "border-r border-gray-200 cursor-pointer transition-colors flex-shrink-0 h-7 sm:h-8",
                    "hover:bg-blue-50 flex items-center justify-center",
                    isToday && "border-l-2 border-l-blue-500",
                    isWeekend && "room-map-cell-weekend",
                    room.is_out_of_order && "bg-red-50 cursor-not-allowed",
                    !room.is_operational && "bg-gray-100 cursor-not-allowed"
                  )}
                  style={{ width: `${gridDimensions.cellWidth}px` }}
                  title={
                    room.is_out_of_order 
                      ? "Quarto fora de funcionamento" 
                      : !room.is_operational 
                      ? "Quarto inativo" 
                      : "Disponível - Clique para reservar"
                  }
                >
                  {room.is_out_of_order && (
                    <Wrench className="h-1.5 w-1.5 sm:h-2 sm:w-2 text-red-500" />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Blocos contínuos de reservas - AJUSTADOS PARA RESPONSIVIDADE */}
          {room.reservations.map(reservation => {
            const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
            const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
            
            const startIndex = dateHeaders.findIndex(h => h.date === format(checkIn, 'yyyy-MM-dd'));
            const endIndex = dateHeaders.findIndex(h => h.date === format(checkOut, 'yyyy-MM-dd'));
            
            if (startIndex === -1) return null;
            
            const cellWidth = gridDimensions.cellWidth;
            
            let actualEndIndex = endIndex;
            if (endIndex === -1 || endIndex < startIndex) {
              actualEndIndex = dateHeaders.length - 1;
            }
            
            let blockLeft, blockWidth;
            
            if (startIndex === actualEndIndex) {
              blockLeft = startIndex * cellWidth + cellWidth / 2;
              blockWidth = cellWidth / 2;
            } else {
              blockLeft = startIndex * cellWidth + cellWidth / 2;
              const blockEnd = actualEndIndex * cellWidth + cellWidth / 2;
              blockWidth = blockEnd - blockLeft;
            }
            
            const clipPath = `polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)`;
            
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
                key={reservation.id}
                onClick={() => onReservationClick?.(reservation, room)}
                className={cn(
                  "absolute cursor-pointer text-[8px] sm:text-[10px] font-medium flex items-center justify-center",
                  getReservationColor(reservation.status)
                )}
                style={{
                  left: `${blockLeft}px`,
                  width: `${blockWidth}px`,
                  height: 'calc(100% - 12px)',
                  top: '6px',
                  zIndex: 1,
                  clipPath: clipPath,
                  borderRadius: '0px'
                }}
                title={`${reservation.guest_name} - ${reservation.reservation_number}`}
              >
                <span className="font-medium truncate leading-tight px-1 sm:px-2">
                  {reservation.guest_name.split(' ')[0].substring(0, window.innerWidth < 640 ? 4 : 8)}
                </span>
                
                {reservation.is_arrival && (
                  <div className="absolute top-0.5 left-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-400 rounded-full" />
                )}
                {reservation.is_departure && (
                  <div className="absolute top-0.5 right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-400 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderizar categoria
  const renderCategory = (category: MapCategoryData) => {
    if (category.rooms.length === 0) return null;

    return (
      <div key={category.room_type_id} className="mb-1">
        {/* Header da categoria */}
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

  // ✅ RENDER PRINCIPAL - TOTALMENTE RESPONSIVO
  return (
    <div 
      className="bg-white room-map-grid-container w-full"
      style={{ 
        minWidth: `${gridDimensions.totalWidth}px`
      }}
    >
      {/* ✅ Header das datas - RESPONSIVO E STICKY */}
      <div className="flex room-map-header sticky top-0 z-20 bg-white shadow-sm">
        {/* Coluna "Quartos" - RESPONSIVO */}
        <div 
          className="px-2 sm:px-3 py-2 room-map-header-title flex-shrink-0 flex items-center border-r border-gray-600 bg-slate-700"
          style={{ 
            width: `${gridDimensions.roomColumnWidth}px`,
            height: '48px'
          }}
        >
          <div className="font-bold text-xs sm:text-sm text-white truncate">Quartos</div>
        </div>
        
        {/* Células das datas - LAYOUT IGUAL AO EXEMPLO */}
        <div className="flex room-map-dates-header">
          {dateHeaders.map(header => {
            const occupancy = dailyOccupancy[header.date] || { occupied: 0, total: 0, percentage: 0 };
            const monthName = format(new Date(header.date + 'T00:00:00'), 'MMM', { locale: ptBR }).toUpperCase();
            
            return (
              <div 
                key={header.date}
                className={cn(
                  "border-r border-gray-600 flex-shrink-0 flex flex-col room-map-date-cell-enhanced relative",
                  header.isWeekend && "room-map-date-weekend-enhanced",
                  header.isToday && "room-map-date-today-enhanced"
                )}
                style={{ 
                  width: `${gridDimensions.cellWidth}px`,
                  height: '48px'
                }}
              >
                {/* Header com dia da semana e percentagem */}
                <div className="flex items-center justify-between px-1 py-0.5 bg-slate-700 text-white">
                  <span className="text-[8px] font-bold truncate flex-1">
                    {header.dayOfWeek.substring(0, 3).toUpperCase()}
                  </span>
                  <span className={cn(
                    "px-1 py-0 rounded text-[8px] font-bold min-w-[18px] text-center ml-1",
                    occupancy.percentage >= 80 ? 'bg-red-500' : 
                    occupancy.percentage >= 50 ? 'bg-yellow-500' : 
                    occupancy.percentage >= 25 ? 'bg-blue-500' : 'bg-green-500'
                  )}>
                    {occupancy.percentage}%
                  </span>
                </div>

                {/* Número do dia e mês lado a lado */}
                <div className="flex-1 bg-slate-600 text-white flex items-center justify-center px-1 gap-1">
                  <div className="text-lg font-bold leading-none">
                    {header.dayOfMonth.padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-medium opacity-90 leading-none">
                    {monthName}
                  </div>
                </div>

                {/* Indicador para hoje */}
                {header.isToday && (
                  <div className="absolute inset-0 border-2 border-orange-400 rounded-sm pointer-events-none"></div>
                )}

                {/* Indicador de fim de semana */}
                {header.isWeekend && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-blue-500"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Categorias e quartos - RESPONSIVOS */}
      <div className="room-map-content">
        {mapData.categories.length === 0 ? (
          <div className="p-4 sm:p-6 text-center">
            <Bed className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-1">
              Nenhum quarto encontrado
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
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