// frontend/src/components/channel-manager/ChannelManagerCalendar.tsx
// Path: frontend/src/components/channel-manager/ChannelManagerCalendar.tsx

'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Building, Loader2 } from 'lucide-react';

import { CalendarGrid } from './CalendarGrid';
import { CalendarCell } from './CalendarCell';
import { 
  AvailabilityCalendarResponse, 
  SimpleAvailabilityView,
  CalendarUIState 
} from '@/types/channel-manager';

interface ChannelManagerCalendarProps {
  data?: AvailabilityCalendarResponse | null;
  loading: boolean;
  onUpdateCell: (roomId: number, date: string, field: string, value: any) => Promise<void>;
  uiState: CalendarUIState;
  getAvailabilityByRoomDate: (roomId: number, date: string) => Promise<SimpleAvailabilityView | null>;
}

export function ChannelManagerCalendar({
  data,
  loading,
  onUpdateCell,
  uiState,
  getAvailabilityByRoomDate
}: ChannelManagerCalendarProps) {

  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());
  const [errorCells, setErrorCells] = useState<Map<string, string>>(new Map());

  // ============== MEMOIZED DATA ==============

  const { rooms, dates, calendarMatrix } = useMemo(() => {
    if (!data) {
      return { rooms: [], dates: [], calendarMatrix: [] };
    }

    const rooms = data.rooms_summary;
    const dates = data.calendar_data.map(d => d.date);
    
    // Criar matriz: rooms x dates
    const matrix = rooms.map(room => {
      return dates.map(date => {
        const dayData = data.calendar_data.find(d => d.date === date);
        return dayData?.availabilities.find(a => a.room_id === room.room_id) || null;
      });
    });

    return { rooms, dates, calendarMatrix: matrix };
  }, [data]);

  // ============== HANDLERS ==============

  const handleCellUpdate = async (
    roomId: number, 
    date: string, 
    field: string, 
    value: any
  ) => {
    const cellKey = `${roomId}-${date}-${field}`;
    
    try {
      setUpdatingCells(prev => new Set(prev).add(cellKey));
      setErrorCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });

      await onUpdateCell(roomId, date, field, value);
      
    } catch (error: any) {
      console.error('Erro ao atualizar célula:', error);
      setErrorCells(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, error.message || 'Erro ao atualizar');
        return newMap;
      });
    } finally {
      setUpdatingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }
  };

  const getCellStatus = (roomId: number, date: string, field: string) => {
    const cellKey = `${roomId}-${date}-${field}`;
    
    if (updatingCells.has(cellKey)) return 'updating';
    if (errorCells.has(cellKey)) return 'error';
    return 'idle';
  };

  const getCellError = (roomId: number, date: string, field: string) => {
    const cellKey = `${roomId}-${date}-${field}`;
    return errorCells.get(cellKey);
  };

  // ============== LOADING STATE ==============

  if (loading && !data) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex">
          <div className="w-64 p-4 border-r">
            <Skeleton className="h-6 w-20 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex-1 flex">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="w-32 p-3 border-r">
                <Skeleton className="h-4 w-8 mx-auto mb-2" />
                <Skeleton className="h-6 w-6 mx-auto mb-1" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Rows skeleton */}
        {[1, 2, 3, 4, 5].map(row => (
          <div key={row} className="flex border-t">
            <div className="w-64 p-4 border-r">
              <Skeleton className="h-5 w-20 mb-1" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1 flex">
              {[1, 2, 3, 4, 5, 6, 7].map(col => (
                <div key={col} className="w-32 p-2 border-r">
                  <div className="grid grid-cols-3 gap-1">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============== EMPTY STATE ==============

  if (!data || rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Building className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum quarto encontrado
        </h3>
        <p className="text-gray-600 text-center max-w-md mb-6">
          Não há quartos disponíveis para o período selecionado ou os filtros aplicados não retornaram resultados.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recarregar página
        </Button>
      </div>
    );
  }

  // ============== ERROR SUMMARY ==============

  const hasErrors = errorCells.size > 0;

  // ============== MAIN RENDER ==============

  return (
    <div className="relative">
      
      {/* Error Alert */}
      {hasErrors && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {errorCells.size} célula(s) com erro de sincronização. 
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto ml-2 text-red-600"
              onClick={() => setErrorCells(new Map())}
            >
              Limpar erros
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Grid */}
      <CalendarGrid
        rooms={rooms}
        dates={dates}
        calendarMatrix={calendarMatrix}
        onCellUpdate={handleCellUpdate}
        getCellStatus={getCellStatus}
        getCellError={getCellError}
        renderCell={(availability, roomId, date) => (
          <CalendarCell
            key={`${roomId}-${date}`}
            availability={availability}
            roomId={roomId}
            date={date}
            onUpdate={handleCellUpdate}
            status={getCellStatus(roomId, date, 'general')}
            error={getCellError(roomId, date, 'general')}
            isSelected={uiState.selectedRooms.includes(roomId)}
            isEditing={
              uiState.editingCell?.roomId === roomId && 
              uiState.editingCell?.date === date
            }
          />
        )}
      />

      {/* Loading Overlay */}
      {loading && data && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="bg-white border rounded-lg shadow-lg p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Atualizando dados...</span>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      {data && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span>
                <strong>{rooms.length}</strong> quartos
              </span>
              <span>
                <strong>{dates.length}</strong> dias
              </span>
              <span>
                <strong>{rooms.length * dates.length}</strong> células total
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {data.statistics.synced_records}/{data.statistics.total_records} sincronizados
              </Badge>
              
              {data.statistics.pending_sync > 0 && (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  {data.statistics.pending_sync} pendentes
                </Badge>
              )}
              
              {updatingCells.size > 0 && (
                <Badge variant="default" className="bg-blue-600">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {updatingCells.size} atualizando
                </Badge>
              )}
              
              {errorCells.size > 0 && (
                <Badge variant="destructive">
                  {errorCells.size} erros
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}