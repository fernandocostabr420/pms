// frontend/src/components/ui/calendar.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface CalendarProps {
  mode?: "single" | "range"
  selected?: Date | Date[]
  onSelect?: (date: Date | Date[] | null) => void
  disabled?: (date: Date) => boolean
  className?: string
  initialFocus?: boolean
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, mode = "single", selected, onSelect, disabled, initialFocus, ...props }, ref) => {
    // ✅ CORREÇÃO 1: Todos os hooks SEMPRE executados, nunca condicionalmente
    const [currentMonth, setCurrentMonth] = React.useState(() => {
      if (mode === "single" && selected instanceof Date) {
        return new Date(selected.getFullYear(), selected.getMonth(), 1);
      }
      return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    });

    const [focusedDate, setFocusedDate] = React.useState<Date | null>(null);

    // ✅ CORREÇÃO 2: useEffect sempre executado
    React.useEffect(() => {
      if (initialFocus && !focusedDate) {
        setFocusedDate(selected instanceof Date ? selected : new Date());
      }
    }, [initialFocus, focusedDate, selected]);

    // ✅ CORREÇÃO 3: Handlers sempre definidos
    const goToPreviousMonth = React.useCallback(() => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);

    const goToNextMonth = React.useCallback(() => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }, []);

    const handleDateSelect = React.useCallback((date: Date) => {
      if (disabled && disabled(date)) {
        return;
      }

      if (onSelect) {
        if (mode === "single") {
          onSelect(date);
        } else if (mode === "range") {
          if (Array.isArray(selected)) {
            if (selected.length === 0 || selected.length === 2) {
              onSelect([date]);
            } else if (selected.length === 1) {
              const [start] = selected;
              if (date < start) {
                onSelect([date, start]);
              } else {
                onSelect([start, date]);
              }
            }
          } else {
            onSelect([date]);
          }
        }
      }
    }, [mode, selected, onSelect, disabled]);

    // ✅ CORREÇÃO 4: Gerar grid do calendário de forma estável
    const generateCalendarGrid = React.useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // Primeiro dia do mês
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
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
      
      return days;
    }, [currentMonth]);

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // ✅ CORREÇÃO 5: Helper para verificar se data está selecionada
    const isDateSelected = React.useCallback((date: Date): boolean => {
      if (!selected) return false;
      
      if (mode === "single" && selected instanceof Date) {
        return date.toDateString() === selected.toDateString();
      }
      
      if (mode === "range" && Array.isArray(selected)) {
        return selected.some(s => s.toDateString() === date.toDateString());
      }
      
      return false;
    }, [selected, mode]);

    const isDateInRange = React.useCallback((date: Date): boolean => {
      if (mode !== "range" || !Array.isArray(selected) || selected.length !== 2) {
        return false;
      }
      
      const [start, end] = selected.sort((a, b) => a.getTime() - b.getTime());
      return date >= start && date <= end;
    }, [selected, mode]);

    const isDateToday = React.useCallback((date: Date): boolean => {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }, []);

    const isDateDisabled = React.useCallback((date: Date): boolean => {
      return disabled ? disabled(date) : false;
    }, [disabled]);

    return (
      <div ref={ref} className={cn("p-3 bg-white border rounded-md", className)} {...props}>
        {/* Cabeçalho do calendário */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="text-sm font-medium">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          
          <button
            type="button"
            onClick={goToNextMonth}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="flex h-9 w-9 items-center justify-center text-xs font-normal text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid dos dias */}
        <div className="grid grid-cols-7 gap-1">
          {generateCalendarGrid.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isToday = isDateToday(date);
            const isDisabled = isDateDisabled(date);
            
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleDateSelect(date)}
                disabled={isDisabled}
                className={cn(
                  "h-9 w-9 p-0 font-normal text-center text-sm relative",
                  "inline-flex items-center justify-center rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !isCurrentMonth && "text-muted-foreground opacity-50",
                  isCurrentMonth && !isSelected && !isToday && "bg-transparent",
                  isToday && !isSelected && "bg-accent text-accent-foreground",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  isInRange && !isSelected && "bg-secondary text-secondary-foreground",
                  isDisabled && "text-muted-foreground opacity-50 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    )
  }
)

Calendar.displayName = "Calendar"

export { Calendar }