// frontend/src/components/channel-manager/CalendarCell.tsx
// Path: frontend/src/components/channel-manager/CalendarCell.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

import { SimpleAvailabilityView } from '@/types/channel-manager';

type FieldType = 'rate' | 'availability' | 'min_stay' | 'closed_to_arrival' | 'closed_to_departure';

interface CalendarCellProps {
  availability: SimpleAvailabilityView | null;
  roomId: number;
  date: string;
  field: FieldType;
  onUpdate: (roomId: number, date: string, field: string, value: any) => Promise<void>;
  status: 'idle' | 'updating' | 'error';
  error?: string;
  isSelected: boolean;
}

export function CalendarCell({
  availability,
  roomId,
  date,
  field,
  onUpdate,
  status,
  error,
  isSelected
}: CalendarCellProps) {

  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ============== EFFECTS ==============

  useEffect(() => {
    if (availability) {
      switch (field) {
        case 'rate':
          setLocalValue(availability.rate?.toString() || '');
          break;
        case 'availability':
          setLocalValue(availability.is_available ? '1' : '0');
          break;
        case 'min_stay':
          setLocalValue(availability.min_stay?.toString() || '1');
          break;
      }
    }
  }, [availability, field]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // ============== HANDLERS ==============

  const handleEdit = () => {
    if (['rate', 'availability', 'min_stay'].includes(field)) {
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      let processedValue: any;
      let fieldName = field;

      switch (field) {
        case 'rate':
          processedValue = localValue ? parseFloat(localValue) : null;
          break;
        case 'availability':
          processedValue = localValue === '1';
          fieldName = 'is_available';
          break;
        case 'min_stay':
          processedValue = parseInt(localValue) || 1;
          break;
      }

      await onUpdate(roomId, date, fieldName, processedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      // Reset em caso de erro
      if (availability) {
        switch (field) {
          case 'rate':
            setLocalValue(availability.rate?.toString() || '');
            break;
          case 'availability':
            setLocalValue(availability.is_available ? '1' : '0');
            break;
          case 'min_stay':
            setLocalValue(availability.min_stay?.toString() || '1');
            break;
        }
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleCheckboxToggle = async (checkboxField: 'closed_to_arrival' | 'closed_to_departure') => {
    try {
      const currentValue = availability?.[checkboxField] || false;
      await onUpdate(roomId, date, checkboxField, !currentValue);
    } catch (error) {
      console.error('Erro ao atualizar checkbox:', error);
    }
  };

  // ============== RENDER HELPERS ==============

  const getCellBackgroundClass = () => {
    if (status === 'error') return 'bg-red-50 border-red-200';
    if (status === 'updating') return 'bg-blue-50 border-blue-200';
    if (isSelected) return 'bg-blue-50';
    if (!availability) return 'bg-gray-50';
    
    switch (field) {
      case 'availability':
        return availability.is_available ? 'bg-white' : 'bg-gray-100';
      default:
        return 'bg-white';
    }
  };

  const getSyncIndicator = () => {
    if (field !== 'rate') return null; // Mostrar apenas na primeira linha
    
    if (status === 'updating') {
      return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
    }
    if (status === 'error') {
      return <AlertTriangle className="h-3 w-3 text-red-600" />;
    }
    if (availability?.sync_pending) {
      return <Clock className="h-3 w-3 text-yellow-600" />;
    }
    if (availability?.sync_status === 'synced') {
      return <CheckCircle className="h-3 w-3 text-green-600" />;
    }
    return null;
  };

  const getRateAsNumber = (rate: any): number | null => {
    if (rate === null || rate === undefined) return null;
    const numRate = typeof rate === 'string' ? parseFloat(rate) : Number(rate);
    return !isNaN(numRate) && numRate >= 0 ? numRate : null;
  };

  // ============== EMPTY CELL ==============

  if (!availability) {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r flex items-center justify-center w-full",
        getCellBackgroundClass()
      )}>
        <span className="text-xs text-gray-400">--</span>
      </div>
    );
  }

  // ============== FIELD-SPECIFIC RENDERING ==============

  // PREÇO
  if (field === 'rate') {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r relative group w-full",
        getCellBackgroundClass()
      )}>
        <div className="flex items-center justify-between h-full">
          {isEditing ? (
            <Input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleSave}
              className="h-6 text-xs p-1 w-full"
              placeholder="0.00"
            />
          ) : (
            <button
              onClick={handleEdit}
              disabled={status === 'updating'}
              className="w-full h-full text-left hover:bg-blue-50 transition-colors text-xs"
            >
              {(() => {
                const rateValue = getRateAsNumber(availability.rate);
                return rateValue !== null 
                  ? `R$ ${rateValue.toFixed(2)}`
                  : '--';
              })()}
            </button>
          )}
          
          {/* Sync indicator */}
          <div className="absolute top-1 right-1">
            {getSyncIndicator()}
          </div>
        </div>
      </div>
    );
  }

  // DISPONIBILIDADE (UNIDADES)
  if (field === 'availability') {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r w-full",
        getCellBackgroundClass()
      )}>
        <div className="flex items-center justify-center h-full">
          {isEditing ? (
            <Input
              ref={inputRef}
              type="number"
              min="0"
              max="99"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleSave}
              className="h-6 text-xs p-1 w-full text-center"
            />
          ) : (
            <button
              onClick={handleEdit}
              disabled={status === 'updating'}
              className="w-full h-full text-center hover:bg-blue-50 transition-colors"
            >
              <span className={cn(
                "text-xs font-medium",
                availability.is_available ? "text-gray-900" : "text-red-600"
              )}>
                {availability.is_available ? '1' : '0'}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ESTADIA MÍNIMA
  if (field === 'min_stay') {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r w-full",
        getCellBackgroundClass()
      )}>
        <div className="flex items-center justify-center h-full">
          {isEditing ? (
            <Input
              ref={inputRef}
              type="number"
              min="1"
              max="30"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleSave}
              className="h-6 text-xs p-1 w-full text-center"
            />
          ) : (
            <button
              onClick={handleEdit}
              disabled={status === 'updating'}
              className="w-full h-full text-center hover:bg-blue-50 transition-colors text-xs"
            >
              {availability.min_stay || 1}
            </button>
          )}
        </div>
      </div>
    );
  }

  // FECHADO PARA CHEGADA
  if (field === 'closed_to_arrival') {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r w-full",
        getCellBackgroundClass()
      )}>
        <div className="flex items-center justify-center h-full">
          <Checkbox
            checked={availability.closed_to_arrival}
            onCheckedChange={() => handleCheckboxToggle('closed_to_arrival')}
            disabled={status === 'updating'}
            className="h-4 w-4"
          />
        </div>
      </div>
    );
  }

  // FECHADO PARA SAÍDA
  if (field === 'closed_to_departure') {
    return (
      <div className={cn(
        "h-8 px-2 border-b border-r w-full",
        getCellBackgroundClass()
      )}>
        <div className="flex items-center justify-center h-full">
          <Checkbox
            checked={availability.closed_to_departure}
            onCheckedChange={() => handleCheckboxToggle('closed_to_departure')}
            disabled={status === 'updating'}
            className="h-4 w-4"
          />
        </div>
      </div>
    );
  }

  return null;
}