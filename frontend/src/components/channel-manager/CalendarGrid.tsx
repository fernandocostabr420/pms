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

import { CalendarCell } from './CalendarCell';
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
}

type FieldType = 'rate' | 'availability' | 'min_stay' | 'closed_to_arrival' | 'closed_to_departure';

const FIELDS: FieldType[] = [
  'rate',
  'availability', 
  'min_stay',
  'closed_to_arrival',
  'closed_to_departure'
];

const FIELD_LABELS: Record<FieldType, string> = {
  'rate': 'Preço',
  'availability': 'Unidades',
  'min_stay': 'Estadia Mínima',
  'closed_to_arrival': 'Fechado p/ Chegada',
  'closed_to_departure': 'Fechado p/ Saída'
};

export function CalendarGrid({
  rooms,
  dates,
  calendarMatrix,
  onCellUpdate,
  getCellStatus,
  getCellError
}: CalendarGridProps) {

  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());

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
      return <WifiOff className="h-3 w-3 text-gray-400" title="Não mapeado" />;
    }
    
    if (room.sync_enabled) {
      return <Wifi className="h-3 w-3 text-green-600" title="Sincronização ativa" />;
    }
    
    return <WifiOff className="h-3 w-3 text-orange-500" title="Sincronização desabilitada" />;
  };

  const getRoomStatusBadge = (roomIndex: number) => {
    const stats = getRoomStats(roomIndex);
    
    if (stats.errors > 0) {
      return (
        <Badge variant="destructive" className="text-xs py-0">
          <XCircle className="h-2 w-2 mr-1" />
          {stats.errors}
        </Badge>
      );
    }
    
    if (stats.pending > 0) {
      return (
        <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 py-0">
          <AlertTriangle className="h-2 w-2 mr-1" />
          {stats.pending}
        </Badge>
      );
    }
    
    if (stats.synced === stats.total) {
      return (
        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 py-0">
          <CheckCircle className="h-2 w-2 mr-1" />
          OK
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs py-0">
        {stats.synced}/{stats.total}
      </Badge>
    );
  };

  // ============== RENDER ==============

  return (
    <div className="relative w-full">
      
      {/* ===== BULK SELECTION HEADER ===== */}
      {selectedRooms.size > 0 && (
        <div className="sticky top-0 z-20 bg-blue-50 border-b border-blue-200 p-3 mb-2">
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

      {/* ===== MAIN GRID WITH HORIZONTAL SCROLL ===== */}
      <div className="w-full overflow-x-auto border rounded-lg">
        <div className="inline-flex flex-col min-w-full">{rooms.map((room, roomIndex) => {
            const isSelected = selectedRooms.has(room.room_id);
            const stats = getRoomStats(roomIndex);
            
            return (
              <div
                key={room.room_id}
                className={cn(
                  "flex border-b border-gray-200",
                  isSelected && "bg-blue-50"
                )}
              >
                
                {/* ===== ROOM INFO SIDEBAR ===== */}
                <div className={cn(
                  "w-48 flex-shrink-0 border-r bg-gray-50 sticky left-0 z-10",
                  isSelected && "bg-blue-100 border-blue-200"
                )}>
                  
                  {/* Room Header compacto */}
                  <div className="px-3 py-2 flex items-center gap-2 border-b bg-white">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => 
                        handleRoomSelection(room.room_id, checked as boolean)
                      }
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-xs text-gray-900 truncate">
                          {room.room_number}
                        </h4>
                        {getSyncStatusIcon(room)}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {room.room_name}
                      </p>
                    </div>
                  </div>

                  {/* Field rows com labels */}
                  <div>
                    {FIELDS.map((field, fieldIndex) => (
                      <div 
                        key={field}
                        className="h-8 px-3 flex items-center justify-between border-b bg-gray-50"
                      >
                        <span className="text-xs font-medium text-gray-700">
                          {FIELD_LABELS[field]}
                        </span>
                        {fieldIndex === 0 && (
                          <div className="flex items-center gap-1">
                            {getRoomStatusBadge(roomIndex)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== DATE COLUMNS (cada coluna tem 5 células verticais) ===== */}
                <div className="flex overflow-x-auto">
                  {dates.map((date, dateIndex) => {
                    const availability = calendarMatrix[roomIndex][dateIndex];
                    
                    return (
                      <div key={`${room.room_id}-${date}`} className="w-24 flex-shrink-0 border-r">
                        {/* Stack vertical das 5 células */}
                        
                        {/* Linha 1: Preço */}
                        <CalendarCell
                          availability={availability}
                          roomId={room.room_id}
                          date={date}
                          field="rate"
                          onUpdate={onCellUpdate}
                          status={getCellStatus(room.room_id, date, 'rate')}
                          error={getCellError(room.room_id, date, 'rate')}
                          isSelected={isSelected}
                        />
                        
                        {/* Linha 2: Unidades */}
                        <CalendarCell
                          availability={availability}
                          roomId={room.room_id}
                          date={date}
                          field="availability"
                          onUpdate={onCellUpdate}
                          status={getCellStatus(room.room_id, date, 'availability')}
                          error={getCellError(room.room_id, date, 'availability')}
                          isSelected={isSelected}
                        />
                        
                        {/* Linha 3: Estadia Mínima */}
                        <CalendarCell
                          availability={availability}
                          roomId={room.room_id}
                          date={date}
                          field="min_stay"
                          onUpdate={onCellUpdate}
                          status={getCellStatus(room.room_id, date, 'min_stay')}
                          error={getCellError(room.room_id, date, 'min_stay')}
                          isSelected={isSelected}
                        />
                        
                        {/* Linha 4: Fechado p/ Chegada */}
                        <CalendarCell
                          availability={availability}
                          roomId={room.room_id}
                          date={date}
                          field="closed_to_arrival"
                          onUpdate={onCellUpdate}
                          status={getCellStatus(room.room_id, date, 'closed_to_arrival')}
                          error={getCellError(room.room_id, date, 'closed_to_arrival')}
                          isSelected={isSelected}
                        />
                        
                        {/* Linha 5: Fechado p/ Saída */}
                        <CalendarCell
                          availability={availability}
                          roomId={room.room_id}
                          date={date}
                          field="closed_to_departure"
                          onUpdate={onCellUpdate}
                          status={getCellStatus(room.room_id, date, 'closed_to_departure')}
                          error={getCellError(room.room_id, date, 'closed_to_departure')}
                          isSelected={isSelected}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ===== SELECT ALL FOOTER ===== */}
          <div className="bg-gray-50 border-t p-3 sticky left-0">
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
                {rooms.length} quartos × {dates.length} dias × 5 campos = {rooms.length * dates.length * 5} células
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}