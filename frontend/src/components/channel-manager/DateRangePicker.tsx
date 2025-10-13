// frontend/src/components/channel-manager/DateRangePicker.tsx
// Wrapper do date-range-picker específico para Channel Manager

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRangePicker as BaseDateRangePicker } from '@/components/ui/date-range-picker';
import { useDateRangeSelection, DateRange } from '@/hooks/useDateRangeSelection';

export interface ChannelManagerDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDays?: number;
  maxDays?: number;
  showPresets?: boolean;
  numberOfMonths?: number;
  disabledDates?: (date: Date) => boolean;
}

export function ChannelManagerDateRangePicker({
  value,
  onChange,
  placeholder = 'Selecione o período',
  className,
  disabled = false,
  minDays = 1,
  maxDays = 366,
  showPresets = true,
  numberOfMonths = 2,
  disabledDates,
}: ChannelManagerDateRangePickerProps) {
  
  const [isOpen, setIsOpen] = React.useState(false);
  
  // ============== HOOK DE SELEÇÃO ==============
  
  const {
    selectedRange,
    isComplete,
    selectRange,
    clearSelection,
    validateRange,
    getRangeDays,
    presets,
    applyPreset,
  } = useDateRangeSelection({
    initialRange: value,
    maxDays,
    minDays,
    onRangeChange: (range) => {
      // Apenas notificar mudanças, sem causar re-render do componente
      if (range && onChange) {
        onChange(range);
      }
    },
    disabledDates,
  });
  
  // ============== HANDLERS ==============
  
  const handleSelect = React.useCallback((range: { from?: Date; to?: Date } | null) => {
    if (!range) {
      clearSelection();
      return;
    }
    
    selectRange(range);
    
    // Fechar popover quando o range estiver completo
    if (range.from && range.to) {
      const errors = validateRange(range as DateRange);
      if (errors.length === 0) {
        setIsOpen(false);
      }
    }
  }, [selectRange, clearSelection, validateRange]);
  
  const handlePresetClick = React.useCallback((preset: typeof presets[0]) => {
    applyPreset(preset);
    setIsOpen(false);
  }, [applyPreset]);
  
  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearSelection();
    onChange?.(null);
  }, [clearSelection, onChange]);
  
  // ============== FORMATAÇÃO ==============
  
  const formattedRange = React.useMemo(() => {
    if (!selectedRange.from) return null;
    
    if (!selectedRange.to) {
      return format(selectedRange.from, "dd/MM/yyyy", { locale: ptBR });
    }
    
    return `${format(selectedRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(
      selectedRange.to,
      "dd/MM/yyyy",
      { locale: ptBR }
    )}`;
  }, [selectedRange]);
  
  const rangeDays = getRangeDays();
  
  // ============== VALIDAÇÕES ==============
  
  const validationErrors = React.useMemo(() => {
    if (!isComplete) return [];
    return validateRange(selectedRange as DateRange);
  }, [isComplete, selectedRange, validateRange]);
  
  const hasErrors = validationErrors.length > 0;
  
  // ============== RENDER ==============
  
  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !formattedRange && "text-muted-foreground",
              hasErrors && "border-red-500"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formattedRange || placeholder}
            
            {isComplete && !hasErrors && (
              <Badge variant="secondary" className="ml-auto">
                {rangeDays} {rangeDays === 1 ? 'dia' : 'dias'}
              </Badge>
            )}
            
            {formattedRange && !disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            {showPresets && (
              <div className="border-r p-3 space-y-2 min-w-[140px]">
                <div className="text-sm font-medium mb-2">Períodos</div>
                {presets.map((preset, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs font-normal"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Calendário */}
            <div>
              <BaseDateRangePicker
                selected={selectedRange}
                onSelect={handleSelect}
                disabled={disabledDates}
                numberOfMonths={numberOfMonths}
                defaultMonth={selectedRange.from || new Date()}
              />
              
              {/* Validações */}
              {hasErrors && (
                <div className="px-3 pb-3 pt-0">
                  <div className="text-xs text-red-600 space-y-1">
                    {validationErrors.map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Info */}
              {isComplete && !hasErrors && (
                <div className="px-3 pb-3 pt-0 border-t">
                  <div className="text-xs text-muted-foreground flex items-center justify-between pt-3">
                    <span>
                      {rangeDays} {rangeDays === 1 ? 'dia selecionado' : 'dias selecionados'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="h-7 text-xs"
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Mensagens de erro externas */}
      {hasErrors && (
        <div className="text-xs text-red-600">
          {validationErrors[0]}
        </div>
      )}
    </div>
  );
}