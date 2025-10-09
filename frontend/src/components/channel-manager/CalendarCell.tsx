// frontend/src/components/channel-manager/CalendarCell.tsx
// Path: frontend/src/components/channel-manager/CalendarCell.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Check,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';

import { SimpleAvailabilityView } from '@/types/channel-manager';

interface CalendarCellProps {
  availability: SimpleAvailabilityView | null;
  roomId: number;
  date: string;
  onUpdate: (roomId: number, date: string, field: string, value: any) => Promise<void>;
  status: 'idle' | 'updating' | 'error';
  error?: string;
  isSelected: boolean;
  isEditing: boolean;
}

export function CalendarCell({
  availability,
  roomId,
  date,
  onUpdate,
  status,
  error,
  isSelected,
  isEditing
}: CalendarCellProps) {

  // ============== LOCAL STATE ==============
  
  const [editingField, setEditingField] = useState<'rate' | 'availability' | 'min_stay' | null>(null);
  const [localValues, setLocalValues] = useState({
    rate: availability?.rate?.toString() || '',
    availability: availability?.is_available ? '1' : '0',
    min_stay: availability?.min_stay?.toString() || '1'
  });

  // Refs for inputs
  const rateInputRef = useRef<HTMLInputElement>(null);
  const availabilityInputRef = useRef<HTMLSelectElement>(null);
  const minStayInputRef = useRef<HTMLInputElement>(null);

  // ============== EFFECTS ==============

  // Update local values when availability changes
  useEffect(() => {
    if (availability) {
      setLocalValues({
        rate: availability.rate?.toString() || '',
        availability: availability.is_available ? '1' : '0',
        min_stay: availability.min_stay?.toString() || '1'
      });
    }
  }, [availability]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingField === 'rate' && rateInputRef.current) {
      rateInputRef.current.focus();
      rateInputRef.current.select();
    }
    if (editingField === 'min_stay' && minStayInputRef.current) {
      minStayInputRef.current.focus();
      minStayInputRef.current.select();
    }
  }, [editingField]);

  // ============== HANDLERS ==============

  const handleFieldEdit = (field: 'rate' | 'availability' | 'min_stay') => {
    setEditingField(field);
  };

  const handleFieldSave = async (field: 'rate' | 'availability' | 'min_stay') => {
    try {
      const value = localValues[field];
      let processedValue: any;

      switch (field) {
        case 'rate':
          processedValue = value ? parseFloat(value) : null;
          break;
        case 'availability':
          processedValue = value === '1';
          break;
        case 'min_stay':
          processedValue = parseInt(value) || 1;
          break;
      }

      await onUpdate(roomId, date, field === 'availability' ? 'is_available' : field, processedValue);
      setEditingField(null);
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      // Resetar valor local em caso de erro
      if (availability) {
        setLocalValues(prev => ({
          ...prev,
          [field]: field === 'rate' ? availability.rate?.toString() || '' :
                  field === 'availability' ? (availability.is_available ? '1' : '0') :
                  availability.min_stay?.toString() || '1'
        }));
      }
    }
  };

  const handleFieldCancel = (field: 'rate' | 'availability' | 'min_stay') => {
    setEditingField(null);
    // Resetar valor local
    if (availability) {
      setLocalValues(prev => ({
        ...prev,
        [field]: field === 'rate' ? availability.rate?.toString() || '' :
                field === 'availability' ? (availability.is_available ? '1' : '0') :
                availability.min_stay?.toString() || '1'
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, field: 'rate' | 'availability' | 'min_stay') => {
    if (e.key === 'Enter') {
      handleFieldSave(field);
    } else if (e.key === 'Escape') {
      handleFieldCancel(field);
    }
  };

  const handleRestrictionToggle = async (restriction: 'closed_to_arrival' | 'closed_to_departure') => {
    try {
      const currentValue = availability?.[restriction] || false;
      await onUpdate(roomId, date, restriction, !currentValue);
    } catch (error) {
      console.error('Erro ao atualizar restrição:', error);
    }
  };

  // ============== RENDER HELPERS ==============

  const getCellBackgroundClass = () => {
    if (status === 'error') return 'bg-red-50 border-red-200';
    if (status === 'updating') return 'bg-blue-50 border-blue-200';
    if (isSelected) return 'bg-blue-100 border-blue-300';
    if (!availability?.is_available) return 'bg-gray-100 border-gray-200';
    if (availability?.sync_pending) return 'bg-yellow-50 border-yellow-200';
    if (availability?.sync_status === 'synced') return 'bg-green-50 border-green-200';
    return 'bg-white border-gray-200';
  };

  const getSyncStatusIndicator = () => {
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
    if (availability?.mapped_channels.length > 0) {
      return <Wifi className="h-3 w-3 text-blue-600" />;
    }
    return <WifiOff className="h-3 w-3 text-gray-400" />;
  };

  // ============== EMPTY CELL ==============

  if (!availability) {
    return (
      <div className="h-20 p-2 border-b bg-gray-50">
        <div className="h-full flex items-center justify-center text-xs text-gray-400">
          Sem dados
        </div>
      </div>
    );
  }

  // ============== MAIN RENDER ==============

  return (
    <div className={cn(
      "h-20 p-2 border-b transition-colors relative group",
      getCellBackgroundClass()
    )}>
      
      {/* Status Indicator */}
      <div className="absolute top-1 right-1">
        {getSyncStatusIndicator()}
      </div>

      {/* Main Content Grid */}
      <div className="h-full grid grid-cols-3 gap-1 text-xs">
        
        {/* ===== RATE COLUMN ===== */}
        <div className="flex flex-col justify-center">
          {editingField === 'rate' ? (
            <div className="relative">
              <Input
                ref={rateInputRef}
                type="number"
                step="0.01"
                min="0"
                value={localValues.rate}
                onChange={(e) => setLocalValues(prev => ({ ...prev, rate: e.target.value }))}
                onKeyDown={(e) => handleKeyPress(e, 'rate')}
                onBlur={() => handleFieldSave('rate')}
                className="h-6 text-xs p-1 text-center"
                placeholder="0"
              />
              <div className="absolute -bottom-4 left-0 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-3 w-3 p-0"
                  onClick={() => handleFieldSave('rate')}
                >
                  <Check className="h-2 w-2" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-3 w-3 p-0"
                  onClick={() => handleFieldCancel('rate')}
                >
                  <X className="h-2 w-2" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleFieldEdit('rate')}
              className="text-center hover:bg-blue-100 rounded p-1 transition-colors"
              disabled={status === 'updating'}
            >
              {availability.rate ? (
                <div>
                  <div className="font-medium">R$</div>
                  <div className="text-xs">{availability.rate.toFixed(0)}</div>
                </div>
              ) : (
                <div className="text-gray-400">--</div>
              )}
            </button>
          )}
        </div>

        {/* ===== AVAILABILITY COLUMN ===== */}
        <div className="flex flex-col justify-center">
          {editingField === 'availability' ? (
            <Select
              value={localValues.availability}
              onValueChange={(value) => {
                setLocalValues(prev => ({ ...prev, availability: value }));
                handleFieldSave('availability');
              }}
            >
              <SelectTrigger className="h-6 text-xs p-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Disponível</SelectItem>
                <SelectItem value="0">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <button
              onClick={() => handleFieldEdit('availability')}
              className="text-center hover:bg-blue-100 rounded p-1 transition-colors"
              disabled={status === 'updating'}
            >
              <div className={cn(
                "w-6 h-6 rounded border-2 mx-auto flex items-center justify-center",
                availability.is_available 
                  ? "bg-green-100 border-green-300 text-green-700"
                  : "bg-red-100 border-red-300 text-red-700"
              )}>
                {availability.is_available ? "✓" : "✗"}
              </div>
            </button>
          )}
        </div>

        {/* ===== RESTRICTIONS COLUMN ===== */}
        <div className="flex flex-col justify-center space-y-1">
          
          {/* MinStay */}
          {editingField === 'min_stay' ? (
            <Input
              ref={minStayInputRef}
              type="number"
              min="1"
              max="30"
              value={localValues.min_stay}
              onChange={(e) => setLocalValues(prev => ({ ...prev, min_stay: e.target.value }))}
              onKeyDown={(e) => handleKeyPress(e, 'min_stay')}
              onBlur={() => handleFieldSave('min_stay')}
              className="h-4 text-xs p-1 text-center"
            />
          ) : (
            <button
              onClick={() => handleFieldEdit('min_stay')}
              className="text-center hover:bg-blue-100 rounded px-1 transition-colors"
              disabled={status === 'updating'}
            >
              <span className="text-xs">
                {availability.min_stay || 1}n
              </span>
            </button>
          )}

          {/* CTA & CTD Checkboxes */}
          <div className="flex justify-center gap-1">
            <Checkbox
              checked={availability.closed_to_arrival}
              onCheckedChange={() => handleRestrictionToggle('closed_to_arrival')}
              className="h-3 w-3"
              title="Closed to Arrival"
              disabled={status === 'updating'}
            />
            <Checkbox
              checked={availability.closed_to_departure}
              onCheckedChange={() => handleRestrictionToggle('closed_to_departure')}
              className="h-3 w-3"
              title="Closed to Departure"
              disabled={status === 'updating'}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-100 border-t border-red-200 p-1">
          <div className="text-xs text-red-700 truncate" title={error}>
            {error}
          </div>
        </div>
      )}

      {/* Sync Info on Hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-1 rounded-b opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="truncate">
          {availability.sync_status === 'synced' ? 'Sincronizado' : 
           availability.sync_pending ? 'Pendente' :
           availability.sync_error ? 'Erro de sync' :
           'Não sincronizado'}
        </div>
      </div>
    </div>
  );
}