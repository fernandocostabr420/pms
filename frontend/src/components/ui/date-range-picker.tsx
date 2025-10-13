// frontend/src/components/ui/date-range-picker.tsx
// Componente base para seleção de intervalos de datas

'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { startOfDay, isSameDay, addMonths, subMonths } from 'date-fns';

export interface DateRangePickerProps {
  selected?: { from?: Date; to?: Date };
  onSelect?: (range: { from?: Date; to?: Date } | null) => void;
  disabled?: (date: Date) => boolean;
  defaultMonth?: Date;
  numberOfMonths?: number;
  locale?: {
    monthNames?: string[];
    weekDays?: string[];
  };
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  showOutsideDays?: boolean;
}

export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      selected,
      onSelect,
      disabled,
      defaultMonth,
      numberOfMonths = 2,
      locale,
      className,
      minDate,
      maxDate,
      showOutsideDays = true,
      ...props
    },
    ref
  ) => {
    // ============== ESTADO ==============

    // Mês atual exibido
    const [currentMonth, setCurrentMonth] = React.useState(() => {
      if (defaultMonth) return startOfDay(new Date(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1));
      if (selected?.from) return startOfDay(new Date(selected.from.getFullYear(), selected.from.getMonth(), 1));
      return startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    });

    // Estado interno para controle da seleção em andamento
    const [rangeStart, setRangeStart] = React.useState<Date | null>(null);
    const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

    // ============== LOCALE ==============

    const monthNames = locale?.monthNames || [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    const weekDays = locale?.weekDays || ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // ============== NAVEGAÇÃO ==============

    const goToPreviousMonth = React.useCallback(() => {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }, []);

    const goToNextMonth = React.useCallback(() => {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }, []);

    // ============== SELEÇÃO ==============

    const handleDateClick = React.useCallback(
      (date: Date) => {
        const normalizedDate = startOfDay(date);

        // Verificar se está desabilitada
        if (disabled && disabled(normalizedDate)) return;

        // Verificar limites
        if (minDate && normalizedDate < startOfDay(minDate)) return;
        if (maxDate && normalizedDate > startOfDay(maxDate)) return;

        // Lógica de seleção de range
        if (!rangeStart) {
          // Primeiro clique - define início
          setRangeStart(normalizedDate);
          onSelect?.({ from: normalizedDate, to: undefined });
        } else {
          // Segundo clique - completa o range
          const start = rangeStart < normalizedDate ? rangeStart : normalizedDate;
          const end = rangeStart < normalizedDate ? normalizedDate : rangeStart;

          onSelect?.({ from: start, to: end });
          setRangeStart(null);
          setHoverDate(null);
        }
      },
      [rangeStart, onSelect, disabled, minDate, maxDate]
    );

    // ============== GRID DO CALENDÁRIO ==============

    const generateCalendarGrid = React.useCallback(
      (monthOffset: number = 0) => {
        const targetMonth = addMonths(currentMonth, monthOffset);
        const year = targetMonth.getFullYear();
        const month = targetMonth.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);

        // Começar no domingo da primeira semana
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

        // Gerar 42 dias (6 semanas × 7 dias)
        const days: Date[] = [];
        const current = new Date(startDate);

        for (let i = 0; i < 42; i++) {
          days.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }

        return { days, month, year };
      },
      [currentMonth]
    );

    // ============== VERIFICAÇÕES DE ESTADO ==============

    const isDateSelected = React.useCallback(
      (date: Date): boolean => {
        if (!selected) return false;

        const normalizedDate = startOfDay(date);

        if (selected.from && isSameDay(normalizedDate, startOfDay(selected.from))) return true;
        if (selected.to && isSameDay(normalizedDate, startOfDay(selected.to))) return true;

        return false;
      },
      [selected]
    );

    const isDateInRange = React.useCallback(
      (date: Date): boolean => {
        const normalizedDate = startOfDay(date);

        // Range completo selecionado
        if (selected?.from && selected?.to) {
          const start = startOfDay(selected.from);
          const end = startOfDay(selected.to);

          if (normalizedDate > start && normalizedDate < end) {
            return true;
          }
        }

        // Preview durante hover
        if (rangeStart && hoverDate) {
          const start = rangeStart < hoverDate ? rangeStart : hoverDate;
          const end = rangeStart < hoverDate ? hoverDate : rangeStart;

          if (normalizedDate > start && normalizedDate < end) {
            return true;
          }
        }

        return false;
      },
      [selected, rangeStart, hoverDate]
    );

    const isRangeStart = React.useCallback(
      (date: Date): boolean => {
        if (!selected?.from) return false;
        return isSameDay(startOfDay(date), startOfDay(selected.from));
      },
      [selected]
    );

    const isRangeEnd = React.useCallback(
      (date: Date): boolean => {
        if (!selected?.to) return false;
        return isSameDay(startOfDay(date), startOfDay(selected.to));
      },
      [selected]
    );

    const isDateToday = React.useCallback((date: Date): boolean => {
      const today = new Date();
      return isSameDay(startOfDay(date), startOfDay(today));
    }, []);

    const isDateDisabled = React.useCallback(
      (date: Date): boolean => {
        const normalizedDate = startOfDay(date);

        if (disabled && disabled(normalizedDate)) return true;
        if (minDate && normalizedDate < startOfDay(minDate)) return true;
        if (maxDate && normalizedDate > startOfDay(maxDate)) return true;

        return false;
      },
      [disabled, minDate, maxDate]
    );

    const isDateInCurrentMonth = React.useCallback((date: Date, month: number): boolean => {
      return date.getMonth() === month;
    }, []);

    // ============== RENDER MONTH ==============

    const renderMonth = (monthOffset: number = 0) => {
      const { days, month, year } = generateCalendarGrid(monthOffset);

      return (
        <div key={monthOffset} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between px-2">
            {monthOffset === 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {monthOffset > 0 && <div className="h-7 w-7" />}

            <div className="text-sm font-medium">
              {monthNames[month]} {year}
            </div>

            {monthOffset === numberOfMonths - 1 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {monthOffset < numberOfMonths - 1 && <div className="h-7 w-7" />}
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day) => (
              <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              const isSelected = isDateSelected(date);
              const inRange = isDateInRange(date);
              const isStart = isRangeStart(date);
              const isEnd = isRangeEnd(date);
              const isToday = isDateToday(date);
              const isDisabled = isDateDisabled(date);
              const isCurrentMonth = isDateInCurrentMonth(date, month);

              const shouldShow = showOutsideDays || isCurrentMonth;

              if (!shouldShow) {
                return <div key={index} className="h-9 w-9" />;
              }

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => rangeStart && setHoverDate(date)}
                  onMouseLeave={() => setHoverDate(null)}
                  disabled={isDisabled}
                  className={cn(
                    'h-9 w-9 p-0 font-normal text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'transition-colors',
                    !isCurrentMonth && 'text-muted-foreground opacity-50',
                    isToday && !isSelected && 'bg-accent font-semibold',
                    (isStart || isEnd) &&
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold',
                    inRange && !isStart && !isEnd && 'bg-accent/50',
                    isStart && 'rounded-l-md',
                    isEnd && 'rounded-r-md',
                    !isStart && !isEnd && !inRange && 'rounded-md'
                  )}
                >
                  <time dateTime={date.toISOString()}>{date.getDate()}</time>
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    // ============== RENDER ==============

    return (
      <div ref={ref} className={cn('p-3', className)} {...props}>
        <div className={cn('flex gap-4', numberOfMonths > 1 ? 'flex-row' : 'flex-col')}>
          {Array.from({ length: numberOfMonths }).map((_, index) => renderMonth(index))}
        </div>
      </div>
    );
  }
);

DateRangePicker.displayName = 'DateRangePicker';