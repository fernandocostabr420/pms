// frontend/src/components/room-map/RoomMapGrid.tsx
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  Car  // ✅ ADICIONADO: Ícone de estacionamento
} from 'lucide-react';
// ✅ NOVAS IMPORTAÇÕES - Modal de reserva
import { ReservationQuickView } from './ReservationQuickView';
import { useReservationQuickView } from '@/hooks/useReservationQuickView';

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
  
  // ✅ NOVO: Hook para o modal de reservas
  const { 
    isOpen, 
    reservation, 
    room, 
    openQuickView, 
    closeQuickView 
  } = useReservationQuickView();

  // ✅ NOVO: Handler para lidar com clique na reserva
  const handleReservationClick = useCallback((
    clickedReservation: MapReservationResponse, 
    clickedRoom: MapRoomData
  ) => {
    openQuickView(clickedReservation, clickedRoom);
  }, [openQuickView]);
  
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
    // Larguras aumentadas para acomodar nomes completos dos quartos
    const roomColumnWidth = window.innerWidth < 640 ? 180 :   // Mobile: 180px (antes 140px)
                           window.innerWidth < 1024 ? 220 :   // Tablet: 220px (antes 160px)  
                           260;                               // Desktop: 260px (antes 192px)
    
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

  // ✅ Hook 4: Estado para controlar categorias expandidas/recolhidas
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Função para toggle de categoria
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Inicializar todas as categorias como expandidas
  useEffect(() => {
    if (mapData?.categories && expandedCategories.size === 0) {
      const allCategories = new Set(mapData.categories.map(cat => cat.room_type_id.toString()));
      setExpandedCategories(allCategories);
    }
  }, [mapData, expandedCategories.size]);

  // ✅ Hook 5: Calcular disponibilidade por categoria por dia
  const categoryDailyAvailability = useMemo(() => {
    if (!mapData?.categories) return {};
    
    const availabilityByCategory: Record<string, Record<string, number>> = {};
    
    mapData.categories.forEach(category => {
      const categoryId = category.room_type_id.toString();
      availabilityByCategory[categoryId] = {};
      
      dateHeaders.forEach(header => {
        let availableRooms = 0;
        
        category.rooms.forEach(room => {
          if (room.is_operational && !room.is_out_of_order) {
            // Verificar se não há reserva nesta data
            const hasReservation = room.reservations.some(res => {
              const checkIn = new Date(res.check_in_date + 'T00:00:00');
              const checkOut = new Date(res.check_out_date + 'T00:00:00');
              const targetDate = new Date(header.date + 'T00:00:00');
              return targetDate >= checkIn && targetDate < checkOut;
            });
            
            if (!hasReservation) {
              availableRooms++;
            }
          }
        });
        
        availabilityByCategory[categoryId][header.date] = availableRooms;
      });
    });
    
    return availabilityByCategory;
  }, [mapData, dateHeaders]);

  const renderRoomRow = (room: MapRoomData) => {
    return (
      <div key={room.id} className="flex border-b border-gray-200 last:border-b-0 relative min-w-0 hover:bg-gray-50 transition-colors duration-150">
        {/* Info do quarto - Estilo lista com cinza escuro */}
        <div 
          className="px-4 py-3 bg-white flex items-center justify-between cursor-pointer flex-shrink-0"
          style={{ width: `${gridDimensions.roomColumnWidth}px` }}
          onClick={() => onRoomClick?.(room)}
          title={`${room.name}${room.floor ? ` - Andar ${room.floor}` : ''} - ${Math.round(room.occupancy_rate)}% ocupado`}
        >
          {/* Nome do quarto - Cinza escuro mas não preto */}
          <div className="flex items-center gap-2">
            <div className="font-normal text-sm text-gray-700">
              {room.name}
            </div>
            
            {/* Ícones de status compactos */}
            {(!room.is_operational || room.is_out_of_order) && (
              <div className="flex items-center gap-1">
                {!room.is_operational && (
                  <AlertTriangle className="h-3 w-3 text-red-500" title="Quarto inativo" />
                )}
                {room.is_out_of_order && (
                  <Wrench className="h-3 w-3 text-red-500" title="Quarto em manutenção" />
                )}
              </div>
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
                    "border-r border-gray-200 cursor-pointer transition-colors flex-shrink-0",
                    "hover:bg-blue-50 flex items-center justify-center",
                    isToday && "border-l-2 border-l-blue-500",
                    isWeekend && "room-map-cell-weekend",
                    room.is_out_of_order && "bg-red-50 cursor-not-allowed",
                    !room.is_operational && "bg-gray-100 cursor-not-allowed"
                  )}
                  style={{ 
                    width: `${gridDimensions.cellWidth}px`,
                    height: '40px'
                  }}
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
            })}
          </div>
          
          {/* ✅ CORREÇÃO PRINCIPAL: Blocos contínuos de reservas com lógica corrigida */}
          {room.reservations.map(reservation => {
            const checkIn = new Date(reservation.check_in_date + 'T00:00:00');
            const checkOut = new Date(reservation.check_out_date + 'T00:00:00');
            
            const startIndex = dateHeaders.findIndex(h => h.date === format(checkIn, 'yyyy-MM-dd'));
            const endIndex = dateHeaders.findIndex(h => h.date === format(checkOut, 'yyyy-MM-dd'));
            
            // ✅ CORREÇÃO: Nova lógica para calcular índices considerando reservas que atravessam o período
            let actualStartIndex = startIndex;
            let actualEndIndex = endIndex;
            
            // Se check-in é anterior ao período visível, começar do primeiro dia visível
            if (startIndex === -1) {
              const firstVisibleDate = new Date(dateHeaders[0].date + 'T00:00:00');
              if (checkOut < firstVisibleDate) {
                return null; // Reserva já terminou antes do período visível
              }
              actualStartIndex = 0; // Começar do primeiro dia visível
            }
            
            // Se check-out é posterior ao período visível, terminar no último dia visível  
            if (endIndex === -1) {
              const lastVisibleDate = new Date(dateHeaders[dateHeaders.length - 1].date + 'T00:00:00');
              if (checkIn >= lastVisibleDate) {
                return null; // Reserva ainda não começou no período visível
              }
              actualEndIndex = dateHeaders.length - 1; // Terminar no último dia visível
            }
            
            // Se ainda assim os índices são inválidos, não renderizar
            if (actualStartIndex < 0 || actualEndIndex < 0 || actualStartIndex > actualEndIndex) {
              return null;
            }
            
            // ✅ CORREÇÃO: Determinar tipo de corte baseado na posição da reserva
            const reservationStartsInPeriod = startIndex !== -1;
            const reservationEndsInPeriod = endIndex !== -1;
            
            const cellWidth = gridDimensions.cellWidth;
            
            let blockLeft, blockWidth;
            
            if (actualStartIndex === actualEndIndex) {
              // Reserva em uma única célula
              if (reservationStartsInPeriod && reservationEndsInPeriod) {
                // ✅ CASO 1: Reserva começa E termina na mesma célula visível (check-in e check-out no mesmo dia do período)
                blockLeft = actualStartIndex * cellWidth + cellWidth / 2;
                blockWidth = cellWidth / 2;
              } else if (reservationStartsInPeriod && !reservationEndsInPeriod) {
                // ✅ CASO 2: Reserva começa na célula mas termina depois (do meio ao fim)
                blockLeft = actualStartIndex * cellWidth + cellWidth / 2;
                blockWidth = cellWidth / 2;
              } else if (!reservationStartsInPeriod && reservationEndsInPeriod) {
                // ✅ CASO 3: Reserva começou antes mas termina na célula (do início ao meio)
                blockLeft = actualStartIndex * cellWidth;
                blockWidth = cellWidth / 2;
              } else {
                // ✅ CASO 4: Reserva atravessa toda a célula (do início ao fim)
                blockLeft = actualStartIndex * cellWidth;
                blockWidth = cellWidth;
              }
            } else {
              // Reserva em múltiplas células
              if (reservationStartsInPeriod) {
                // Reserva começa no período visível: do meio da primeira célula
                blockLeft = actualStartIndex * cellWidth + cellWidth / 2;
              } else {
                // Reserva já estava em andamento: do início da primeira célula
                blockLeft = actualStartIndex * cellWidth;
              }
              
              if (reservationEndsInPeriod) {
                // Reserva termina no período visível: até o meio da última célula
                const blockEnd = actualEndIndex * cellWidth + cellWidth / 2;
                blockWidth = blockEnd - blockLeft;
              } else {
                // Reserva continua após o período: até o final da última célula
                const blockEnd = (actualEndIndex + 1) * cellWidth;
                blockWidth = blockEnd - blockLeft;
              }
            }
            
            let clipPath;
            if (reservationStartsInPeriod && reservationEndsInPeriod) {
              // Reserva começa e termina no período visível: corte dos dois lados
              clipPath = `polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)`;
            } else if (reservationStartsInPeriod && !reservationEndsInPeriod) {
              // Reserva começa no período mas termina depois: corte só à esquerda
              clipPath = `polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%)`;
            } else if (!reservationStartsInPeriod && reservationEndsInPeriod) {
              // Reserva começou antes mas termina no período: corte só à direita
              clipPath = `polygon(0% 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)`;
            } else {
              // Reserva atravessa todo o período: sem corte (retângulo)
              clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)`;
            }
            
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
                onClick={() => handleReservationClick(reservation, room)}
                className={cn(
                  "absolute cursor-pointer text-[9px] sm:text-[10px] font-medium flex items-center justify-center",
                  getReservationColor(reservation.status)
                )}
                style={{
                  left: `${blockLeft}px`,
                  width: `${blockWidth}px`,
                  height: 'calc(60% - 4px)', // Aumentado 20% (de 50% para 60%)
                  top: '50%', // Centralizado verticalmente
                  transform: 'translateY(-50%)', // Ajuste fino para centralização
                  zIndex: 1,
                  clipPath: clipPath,
                  borderRadius: '0px'
                }}
                title={`${reservation.guest_name} - ${reservation.reservation_number} - Clique para detalhes`}
              >
                {/* ✅ CORRIGIDO: NOME DO HÓSPEDE COM ÍCONE DE ESTACIONAMENTO */}
                <span className="font-medium truncate leading-tight px-2 flex items-center gap-1">
                  {reservation.guest_name}
                  {/* ✅ ÍCONE DE ESTACIONAMENTO */}
                  {reservation.parking_requested && (
                    <Car className="h-2 w-2 flex-shrink-0 text-white opacity-90" title="Estacionamento solicitado" />
                  )}
                </span>
                
                {/* Indicadores existentes (chegada/partida) */}
                {reservation.is_arrival && (
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
                {reservation.is_departure && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-400 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderizar categoria com estilo hierárquico e disponibilidade por dia
  const renderCategory = (category: MapCategoryData) => {
    if (category.rooms.length === 0) return null;

    const categoryId = category.room_type_id.toString();
    const isExpanded = expandedCategories.has(categoryId);
    const categoryAvailability = categoryDailyAvailability[categoryId] || {};

    return (
      <div key={category.room_type_id}>
        {/* Linha da categoria com disponibilidade por dia */}
        <div className="flex border-b border-gray-200">
          {/* Header da categoria - Nome */}
          <div 
            className="bg-gray-100 hover:bg-gray-200 transition-colors duration-200 cursor-pointer flex items-center justify-between px-4 py-2 border-r border-gray-200"
            style={{ width: `${gridDimensions.roomColumnWidth}px` }}
            onClick={() => toggleCategory(categoryId)}
          >
            <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">
              {category.room_type_name.replace(/\s+\d+$/, '')}
            </h3>
            
            {/* Seta indicadora */}
            <div className={cn(
              "transform transition-transform duration-200 text-gray-600",
              isExpanded ? "rotate-180" : "rotate-0"
            )}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* Células de disponibilidade por dia */}
          <div className="flex">
            {dateHeaders.map(header => {
              const availableRooms = categoryAvailability[header.date] || 0;
              const isWeekend = header.isWeekend;
              
              return (
                <div
                  key={header.date}
                  className={cn(
                    "bg-gray-100 border-r border-gray-200 flex items-center justify-center",
                    isWeekend && "room-map-cell-weekend"
                  )}
                  style={{ 
                    width: `${gridDimensions.cellWidth}px`,
                    height: '40px'
                  }}
                >
                  {/* Número de quartos disponíveis - Estilo minimalista reduzido */}
                  <div className="text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 px-1.5 py-0.5 min-w-[20px] text-center shadow-sm">
                    {availableRooms}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quartos da categoria - Expansível */}
        {isExpanded && (
          <div className="bg-white">
            {category.rooms.map(room => renderRoomRow(room))}
          </div>
        )}
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

  // ✅ RENDER PRINCIPAL - TOTALMENTE RESPONSIVO COM MODAL
  return (
    <>
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

      {/* ✅ NOVO: Modal de detalhes rápidos da reserva */}
      <ReservationQuickView
        isOpen={isOpen}
        onClose={closeQuickView}
        reservation={reservation}
        room={room}
      />
    </>
  );
}