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
        isWeekend: date.getDay() === 5 || date.getDay() === 6, // sexta = 5, sábado = 6
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
  
  // Renderizar linha do quarto com blocos contínuos
  const renderRoomRow = (room: MapRoomData) => {
    return (
      <div key={room.id} className="flex border-b border-gray-100 last:border-b-0 border-b-[0.5px] relative">
        {/* Info do quarto - ALTURA AUMENTADA MAIS 10% */}
        <div 
          className="w-48 px-2 py-1.5 bg-white border-r border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 flex-shrink-0 h-8"
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

        {/* Container para células vazias e reservas */}
        <div className="flex relative">
          {/* Células vazias de fundo */}
          {dateHeaders.map(header => {
            const isToday = header.isToday;
            const isWeekend = header.isWeekend;
            
            return (
              <div
                key={header.date}
                onClick={() => onCellClick?.(room, header.date)}
                className={cn(
                  "w-16 h-8 border-r border-gray-200 cursor-pointer transition-colors flex-shrink-0 min-w-[4rem]",
                  "hover:bg-blue-50 flex items-center justify-center",
                  isToday && "border-l-2 border-l-blue-500",
                  isWeekend && "room-map-cell-weekend",
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
          })}
          
          {/* Blocos contínuos de reservas posicionados absolutamente */}
          {room.reservations.map(reservation => {
            const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
            const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
            
            // Encontrar índices das datas de início e fim
            const startIndex = dateHeaders.findIndex(h => h.date === format(checkIn, 'yyyy-MM-dd'));
            const endIndex = dateHeaders.findIndex(h => h.date === format(checkOut, 'yyyy-MM-dd'));
            
            // Se a reserva não está no período visível, não renderizar
            if (startIndex === -1) {
              return null;
            }
            
            // Calcular posição e largura como um bloco único contínuo
            const cellWidth = 64; // 64px = w-16
            
            // Determinar quais dias mostrar
            let actualEndIndex = endIndex;
            if (endIndex === -1 || endIndex < startIndex) {
              // Check-out fora do período visível, mostrar até o final visível
              actualEndIndex = dateHeaders.length - 1;
            }
            
            // Calcular início e largura do bloco contínuo
            let blockLeft, blockWidth;
            
            if (startIndex === actualEndIndex) {
              // Caso especial: mesmo dia (não deveria acontecer em hotéis normais)
              blockLeft = startIndex * cellWidth + cellWidth / 2;
              blockWidth = cellWidth / 2;
            } else {
              // Bloco contínuo do meio do primeiro dia ao meio do último dia
              blockLeft = startIndex * cellWidth + cellWidth / 2; // Começar do meio do primeiro dia
              
              // Calcular até onde vai: meio do último dia
              const blockEnd = actualEndIndex * cellWidth + cellWidth / 2;
              blockWidth = blockEnd - blockLeft;
            }
            
            // Criar clip-path para bordas diagonais
            const clipPath = `polygon(
              8px 0%, 
              100% 0%, 
              calc(100% - 8px) 100%, 
              0% 100%
            )`;
            
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
                key={reservation.id}
                onClick={() => onReservationClick?.(reservation, room)}
                className={cn(
                  "absolute cursor-pointer text-[10px] font-medium flex items-center justify-center",
                  getReservationColor(reservation.status)
                )}
                style={{
                  left: `${blockLeft}px`,
                  width: `${blockWidth}px`,
                  height: 'calc(100% - 20px)', // Mais margem para separação
                  top: '10px', // Mais margem superior
                  zIndex: 1,
                  clipPath: clipPath,
                  borderRadius: '0px' // Remove border-radius para clip-path funcionar
                }}
                title={`${reservation.guest_name} - ${reservation.reservation_number}`}
              >
                {/* Nome do hóspede */}
                <span className="text-[8px] font-medium truncate leading-tight px-2">
                  {reservation.guest_name.split(' ')[0].substring(0, 8)}
                </span>
                
                {/* Indicadores de chegada/saída */}
                {reservation.is_arrival && (
                  <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
                {reservation.is_departure && (
                  <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-red-400 rounded-full" />
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

  // ✅ RENDER PRINCIPAL - MANTENDO ESTRUTURA ORIGINAL
  return (
    <div className={cn("bg-white")} style={{ minWidth: `${totalWidth}px` }}>
      {/* ✅ Header das datas - AUMENTADO EM 20% E ESTILIZADO */}
      <div className="flex room-map-header sticky top-0 z-10">
        {/* Coluna "Quartos" - AUMENTADO PARA h-10 */}
        <div className="w-48 px-3 py-2 room-map-header-title flex-shrink-0 h-10 flex items-center">
          <div className="font-bold text-sm text-gray-800">Quartos</div>
        </div>
        
        {/* Células das datas - AUMENTADO PARA h-10 */}
        <div className="flex">
          {dateHeaders.map(header => (
            <div 
              key={header.date}
              className={cn(
                "w-16 px-2 py-2 text-center border-r border-gray-300 flex-shrink-0 min-w-[4rem] h-10 flex flex-col items-center justify-center room-map-date-cell",
                header.isWeekend && "room-map-date-weekend",
                header.isToday && "room-map-date-today"
              )}
            >
              {/* Dia da semana */}
              <div className="room-map-day-name">
                {header.dayOfWeek.toUpperCase()}
              </div>
              
              {/* Número do dia */}
              <div className="room-map-day-number">
                {header.dayOfMonth}
              </div>
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