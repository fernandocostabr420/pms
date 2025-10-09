// frontend/src/components/channel-manager/CalendarGrid.tsx
// Path: frontend/src/components/channel-manager/CalendarGrid.tsx

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  Building, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  XCircle,
  AlertTriangle
} from 'lucide-react';

import { 
  SimpleAvailabilityView, 
  RoomSummary 
} from '@/types/channel-manager';

interface CalendarGridProps {
  rooms: RoomSummary[];
  dates: string[];
  calendarMatrix: (SimpleAvailabilityView | null)[][];
  onCellUpdate: (roomId: number, date: string, field: string, value: any) => Promise<void>;
  getCellStatus: (roomId: number, date: string, field: string) => 'idle' | 'updating' | 'error';
  getCellError: (roomId: number, date: string, field: string) => string | undefined;
  renderCell: (availability: SimpleAvailabilityView | null, roomId: number, date: string) => React.ReactNode;
}

export function CalendarGrid({
  rooms,
  dates,
  calendarMatrix,
  onCellUpdate,
  getCellStatus,
  getCellError,
  renderCell
}: CalendarGridProps) {

  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<{ roomId: number; date: string } | null>(null);

  // ============== ROOM SELECTION ==============

  const handleRoomSelection = (roomId: number, checked: boolean) => {
    setSelectedRooms(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(roomId);
      } else {
        newSet.delete(roomId);
      }
      return newSet;
    });
  };

  const handleSelectAllRooms = (checked: boolean) => {
    if (checked) {
      setSelectedRooms(new Set(rooms.map(r => r.room_id)));
    } else {
      setSelectedRooms(new Set());
    }
  };

  const isAllRoomsSelected = selectedRooms.size === rooms.length;
  const isSomeRoomsSelected = selectedRooms.size > 0 && selectedRooms.size < rooms.length;

  // ============== ROOM STATS ==============

  const getRoomStats = (roomIndex: number) => {
    const roomData = calendarMatrix[roomIndex];
    const available = roomData.filter(cell => cell?.is_available).length;
    const blocked = roomData.filter(cell => cell && !cell.is_available).length;
    const synced = roomData.filter(cell => cell?.sync_status === 'synced').length;
    const pending = roomData.filter(cell => cell?.sync_pending).length;
    const errors = roomData.filter(cell => cell?.sync_error).length;

    return { available, blocked, synced, pending, errors, total: roomData.length };
  };

  // ============== SYNC STATUS HELPERS ==============

  const getSyncStatusIcon = (room: RoomSummary) => {
    if (!room.has_channel_mapping) {
      return <WifiOff className="h-4 w-4 text-gray-400" title="Não mapeado" />;
    }
    
    if (room.sync_enabled) {
      return <Wifi className="h-4 w-4 text-green-600" title="Sincronização ativa" />;
    }
    
    return <WifiOff className="h-4 w-4 text-orange-500" title="Sincronização desabilitada" />;
  };

  const getRoomStatusBadge = (roomIndex: number) => {
    const stats = getRoomStats(roomIndex);
    
    if (stats.errors > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          {stats.errors} erro(s)
        </Badge>
      );
    }
    
    if (stats.pending > 0) {
      return (
        <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {stats.pending} pendente(s)
        </Badge>
      );
    }
    
    if (stats.synced === stats.total) {
      return (
        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sincronizado
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs">
        {stats.synced}/{stats.total}
      </Badge>
    );
  };

  // ============== RENDER ==============

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        
        {/* ===== BULK SELECTION HEADER ===== */}
        {selectedRooms.size > 0 && (
          <div className="sticky top-0 z-20 bg-blue-50 border-b border-blue-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedRooms.size} quarto(s) selecionado(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRooms(new Set())}
                  className="text-blue-700 border-blue-300"
                >
                  Limpar seleção
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default">
                  Edição em massa
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== ROOM ROWS ===== */}
        <div className="space-y-px bg-gray-200">
          
          {rooms.map((room, roomIndex) => {
            const isSelected = selectedRooms.has(room.room_id);
            const stats = getRoomStats(roomIndex);
            
            return (
              <div
                key={room.room_id}
                className={cn(
                  "flex bg-white",
                  isSelected && "bg-blue-50"
                )}
              >
                
                {/* ===== ROOM INFO COLUMN ===== */}
                <div className={cn(
                  "flex-none w-64 border-r p-4 bg-gray-50",
                  isSelected && "bg-blue-100 border-blue-200"
                )}>
                  <div className="space-y-3">
                    
                    {/* Room Selection & Basic Info */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => 
                          handleRoomSelection(room.room_id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {room.room_number}
                          </h4>
                          {getSyncStatusIcon(room)}
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate">
                          {room.room_name}
                        </p>
                      </div>
                    </div>

                    {/* Room Stats */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-green-600">{stats.available}</div>
                          <div className="text-gray-500">Disponível</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{stats.blocked}</div>
                          <div className="text-gray-500">Bloqueado</div>
                        </div>
                      </div>
                      
                      {/* Sync Status Badge */}
                      <div className="flex justify-center">
                        {getRoomStatusBadge(roomIndex)}
                      </div>
                    </div>

                    {/* Channel Mapping Info */}
                    {room.has_channel_mapping && (
                      <div className="text-xs text-gray-500 text-center">
                        <Building className="h-3 w-3 inline mr-1" />
                        Mapeado para canal
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== DATE CELLS ===== */}
                <div className="flex-1 flex">
                  {dates.map((date, dateIndex) => {
                    const availability = calendarMatrix[roomIndex][dateIndex];
                    const isHovered = hoveredCell?.roomId === room.room_id && hoveredCell?.date === date;
                    
                    return (
                      <div
                        key={`${room.room_id}-${date}`}
                        className={cn(
                          "flex-none w-32 border-r relative",
                          isHovered && "bg-blue-50",
                          isSelected && "bg-blue-25"
                        )}
                        onMouseEnter={() => setHoveredCell({ roomId: room.room_id, date })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {renderCell(availability, room.room_id, date)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== SELECT ALL FOOTER ===== */}
        <div className="bg-gray-50 border-t p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllRoomsSelected}
                ref={(ref) => {
                  if (ref) ref.indeterminate = isSomeRoomsSelected;
                }}
                onCheckedChange={handleSelectAllRooms}
              />
              <span className="text-sm font-medium text-gray-700">
                {isAllRoomsSelected 
                  ? 'Desmarcar todos os quartos'
                  : isSomeRoomsSelected
                  ? `Selecionar todos (${rooms.length - selectedRooms.size} restantes)`
                  : `Selecionar todos os quartos (${rooms.length})`
                }
              </span>
            </div>
            
            <div className="text-sm text-gray-500">
              {rooms.length} quartos • {dates.length} dias • {rooms.length * dates.length} células
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}