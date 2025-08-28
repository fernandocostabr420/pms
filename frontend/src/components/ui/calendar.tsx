"use client"

import * as React from "react"
import ReactCalendar from "react-calendar"
import 'react-calendar/dist/Calendar.css'
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
  ({ className, mode = "single", selected, onSelect, disabled, ...props }, ref) => {
    const handleChange = (value: any) => {
      if (onSelect) {
        if (mode === "single") {
          onSelect(value as Date)
        } else {
          onSelect(value as Date[])
        }
      }
    }

    return (
      <div ref={ref} className={cn("p-3", className)}>
        <ReactCalendar
          onChange={handleChange}
          value={selected}
          selectRange={mode === "range"}
          tileDisabled={disabled ? ({ date }) => disabled(date) : undefined}
          navigationLabel={({ date }) => (
            <span className="text-sm font-medium">
              {date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          )}
          prevLabel={<ChevronLeft className="h-4 w-4" />}
          nextLabel={<ChevronRight className="h-4 w-4" />}
          prev2Label={null}
          next2Label={null}
          className={cn(
            "w-full border-none font-sans",
            // Customização do tema
            "[&_.react-calendar__navigation]:flex [&_.react-calendar__navigation]:justify-between [&_.react-calendar__navigation]:items-center [&_.react-calendar__navigation]:mb-4",
            "[&_.react-calendar__navigation__label]:font-medium [&_.react-calendar__navigation__label]:text-sm",
            "[&_.react-calendar__navigation__arrow]:flex [&_.react-calendar__navigation__arrow]:items-center [&_.react-calendar__navigation__arrow]:justify-center [&_.react-calendar__navigation__arrow]:w-8 [&_.react-calendar__navigation__arrow]:h-8 [&_.react-calendar__navigation__arrow]:rounded-md [&_.react-calendar__navigation__arrow]:border [&_.react-calendar__navigation__arrow]:border-input [&_.react-calendar__navigation__arrow]:bg-background [&_.react-calendar__navigation__arrow]:hover:bg-accent [&_.react-calendar__navigation__arrow]:hover:text-accent-foreground [&_.react-calendar__navigation__arrow]:disabled:pointer-events-none [&_.react-calendar__navigation__arrow]:disabled:opacity-50",
            "[&_.react-calendar__month-view__weekdays]:grid [&_.react-calendar__month-view__weekdays]:grid-cols-7 [&_.react-calendar__month-view__weekdays]:mb-2",
            "[&_.react-calendar__month-view__weekdays__weekday]:flex [&_.react-calendar__month-view__weekdays__weekday]:items-center [&_.react-calendar__month-view__weekdays__weekday]:justify-center [&_.react-calendar__month-view__weekdays__weekday]:text-muted-foreground [&_.react-calendar__month-view__weekdays__weekday]:text-[0.8rem] [&_.react-calendar__month-view__weekdays__weekday]:font-normal [&_.react-calendar__month-view__weekdays__weekday]:h-9",
            "[&_.react-calendar__month-view__days]:grid [&_.react-calendar__month-view__days]:grid-cols-7 [&_.react-calendar__month-view__days]:gap-1",
            "[&_.react-calendar__tile]:flex [&_.react-calendar__tile]:items-center [&_.react-calendar__tile]:justify-center [&_.react-calendar__tile]:h-9 [&_.react-calendar__tile]:text-sm [&_.react-calendar__tile]:font-normal [&_.react-calendar__tile]:border-none [&_.react-calendar__tile]:bg-transparent [&_.react-calendar__tile]:cursor-pointer [&_.react-calendar__tile]:rounded-md [&_.react-calendar__tile]:hover:bg-accent [&_.react-calendar__tile]:hover:text-accent-foreground",
            "[&_.react-calendar__tile--active]:bg-primary [&_.react-calendar__tile--active]:text-primary-foreground [&_.react-calendar__tile--active]:hover:bg-primary [&_.react-calendar__tile--active]:hover:text-primary-foreground",
            "[&_.react-calendar__tile--now]:bg-accent [&_.react-calendar__tile--now]:text-accent-foreground",
            "[&_.react-calendar__tile--neighboringMonth]:text-muted-foreground [&_.react-calendar__tile--neighboringMonth]:opacity-50",
            "[&_.react-calendar__tile:disabled]:text-muted-foreground [&_.react-calendar__tile:disabled]:opacity-50 [&_.react-calendar__tile:disabled]:cursor-not-allowed"
          )}
          locale="pt-BR"
          {...props}
        />
      </div>
    )
  }
)

Calendar.displayName = "Calendar"

export { Calendar }