// frontend/src/hooks/useDateRangeSelection.ts
// Hook para gerenciar seleção de intervalos de datas

import { useState, useCallback, useMemo } from 'react';
import { addDays, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PartialDateRange {
  from?: Date;
  to?: Date;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

interface UseDateRangeSelectionOptions {
  initialRange?: DateRange;
  maxDays?: number;
  minDays?: number;
  presets?: DateRangePreset[];
  onRangeChange?: (range: DateRange | null) => void;
  disabledDates?: (date: Date) => boolean;
}

interface UseDateRangeSelectionReturn {
  // Estado atual
  selectedRange: PartialDateRange;
  isComplete: boolean;
  
  // Handlers
  selectDate: (date: Date) => void;
  selectRange: (range: PartialDateRange) => void;
  clearSelection: () => void;
  reset: () => void;
  
  // Validações
  isValidRange: (range: PartialDateRange) => boolean;
  validateRange: (range: PartialDateRange) => string[];
  getRangeDays: () => number;
  
  // Presets
  presets: DateRangePreset[];
  applyPreset: (preset: DateRangePreset) => void;
  
  // Estado interno para UI
  rangeStart: Date | null;
  hoverDate: Date | null;
  setHoverDate: (date: Date | null) => void;
}

export function useDateRangeSelection({
  initialRange,
  maxDays = 366,
  minDays = 1,
  presets: customPresets,
  onRangeChange,
  disabledDates
}: UseDateRangeSelectionOptions = {}): UseDateRangeSelectionReturn {
  
  // ============== ESTADO ==============
  
  const [selectedRange, setSelectedRange] = useState<PartialDateRange>(() => {
    if (initialRange) {
      return { from: initialRange.from, to: initialRange.to };
    }
    return {};
  });
  
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  
  // ============== PRESETS PADRÃO ==============
  
  const defaultPresets: DateRangePreset[] = useMemo(() => [
    {
      label: 'Próximos 7 dias',
      getValue: () => ({
        from: startOfDay(new Date()),
        to: startOfDay(addDays(new Date(), 6))
      })
    },
    {
      label: 'Próximos 14 dias',
      getValue: () => ({
        from: startOfDay(new Date()),
        to: startOfDay(addDays(new Date(), 13))
      })
    },
    {
      label: 'Próximo mês',
      getValue: () => ({
        from: startOfDay(new Date()),
        to: startOfDay(addDays(new Date(), 30))
      })
    },
    {
      label: 'Próximos 60 dias',
      getValue: () => ({
        from: startOfDay(new Date()),
        to: startOfDay(addDays(new Date(), 59))
      })
    }
  ], []);
  
  const presets = customPresets || defaultPresets;
  
  // ============== VALIDAÇÕES ==============
  
  const isValidRange = useCallback((range: PartialDateRange): boolean => {
    if (!range.from || !range.to) return false;
    
    // Verificar ordem
    if (isAfter(range.from, range.to)) return false;
    
    // Verificar número de dias
    const days = differenceInDays(range.to, range.from) + 1;
    if (days < minDays || days > maxDays) return false;
    
    // Verificar datas desabilitadas
    if (disabledDates) {
      if (disabledDates(range.from) || disabledDates(range.to)) {
        return false;
      }
    }
    
    return true;
  }, [minDays, maxDays, disabledDates]);
  
  const validateRange = useCallback((range: PartialDateRange): string[] => {
    const errors: string[] = [];
    
    if (!range.from) {
      errors.push('Data inicial é obrigatória');
      return errors;
    }
    
    if (!range.to) {
      errors.push('Data final é obrigatória');
      return errors;
    }
    
    if (isAfter(range.from, range.to)) {
      errors.push('Data final deve ser posterior à data inicial');
    }
    
    const days = differenceInDays(range.to, range.from) + 1;
    
    if (days < minDays) {
      errors.push(`Período mínimo é de ${minDays} dia(s)`);
    }
    
    if (days > maxDays) {
      errors.push(`Período máximo é de ${maxDays} dias`);
    }
    
    if (disabledDates) {
      if (disabledDates(range.from)) {
        errors.push('Data inicial está desabilitada');
      }
      if (disabledDates(range.to)) {
        errors.push('Data final está desabilitada');
      }
    }
    
    return errors;
  }, [minDays, maxDays, disabledDates]);
  
  const getRangeDays = useCallback((): number => {
    if (!selectedRange.from || !selectedRange.to) return 0;
    return differenceInDays(selectedRange.to, selectedRange.from) + 1;
  }, [selectedRange]);
  
  const isComplete = useMemo(() => {
    return !!(selectedRange.from && selectedRange.to);
  }, [selectedRange]);
  
  // ============== HANDLERS ==============
  
  const selectDate = useCallback((date: Date) => {
    const normalizedDate = startOfDay(date);
    
    // Verificar se data está desabilitada
    if (disabledDates && disabledDates(normalizedDate)) {
      return;
    }
    
    // Se não tem início, define o início
    if (!rangeStart) {
      setRangeStart(normalizedDate);
      setSelectedRange({ from: normalizedDate, to: undefined });
      return;
    }
    
    // Se tem início, completa o range
    const start = isBefore(normalizedDate, rangeStart) ? normalizedDate : rangeStart;
    const end = isAfter(normalizedDate, rangeStart) ? normalizedDate : rangeStart;
    
    const newRange: DateRange = { from: start, to: end };
    
    // Validar antes de aplicar
    if (isValidRange(newRange)) {
      setSelectedRange(newRange);
      setRangeStart(null);
      setHoverDate(null);
      onRangeChange?.(newRange);
    } else {
      // Se inválido, começa um novo range a partir dessa data
      setRangeStart(normalizedDate);
      setSelectedRange({ from: normalizedDate, to: undefined });
    }
  }, [rangeStart, disabledDates, isValidRange, onRangeChange]);
  
  const selectRange = useCallback((range: PartialDateRange) => {
    const normalizedRange = {
      from: range.from ? startOfDay(range.from) : undefined,
      to: range.to ? startOfDay(range.to) : undefined
    };
    
    setSelectedRange(normalizedRange);
    
    // Se o range está completo e válido, notifica
    if (normalizedRange.from && normalizedRange.to) {
      const fullRange = normalizedRange as DateRange;
      if (isValidRange(fullRange)) {
        setRangeStart(null);
        onRangeChange?.(fullRange);
      } else {
        setRangeStart(normalizedRange.from);
      }
    } else {
      setRangeStart(normalizedRange.from || null);
    }
  }, [isValidRange, onRangeChange]);
  
  const clearSelection = useCallback(() => {
    setSelectedRange({});
    setRangeStart(null);
    setHoverDate(null);
    onRangeChange?.(null);
  }, [onRangeChange]);
  
  const reset = useCallback(() => {
    if (initialRange) {
      setSelectedRange({ from: initialRange.from, to: initialRange.to });
      setRangeStart(null);
      setHoverDate(null);
      onRangeChange?.(initialRange);
    } else {
      clearSelection();
    }
  }, [initialRange, onRangeChange, clearSelection]);
  
  const applyPreset = useCallback((preset: DateRangePreset) => {
    const range = preset.getValue();
    setSelectedRange(range);
    setRangeStart(null);
    setHoverDate(null);
    onRangeChange?.(range);
  }, [onRangeChange]);
  
  // ============== RETURN ==============
  
  return {
    // Estado
    selectedRange,
    isComplete,
    
    // Handlers
    selectDate,
    selectRange,
    clearSelection,
    reset,
    
    // Validações
    isValidRange,
    validateRange,
    getRangeDays,
    
    // Presets
    presets,
    applyPreset,
    
    // Estado interno
    rangeStart,
    hoverDate,
    setHoverDate
  };
}