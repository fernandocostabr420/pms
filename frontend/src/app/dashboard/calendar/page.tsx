// frontend/src/app/dashboard/calendar/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight,
  Plus,
  Filter,
  Users,
  ArrowRight,
  ArrowLeft,
  Home,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarData } from '@/hooks/useCalendarData';
import CalendarView from '@/components/calendar/CalendarView';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import QuickBookingModal from '@/components/calendar/QuickBookingModal';
import { CalendarFilters } from '@/types/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CalendarPage() {
  const {
    currentDate,
    calendarMonth,
    stats,
    loading,
    error,
    filters,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    updateFilters,
    refreshData
  } = useCalendarData();

  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Handler para abrir modal de reserva rápida
  const handleQuickBooking = (date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
    setIsQuickBookingOpen(true);
  };

  // Handler para mudança de filtros
  const handleFilterChange = (newFilters: Partial<CalendarFilters>) => {
    updateFilters(newFilters);
  };

  if (loading && !calendarMonth) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
          <p className="text-gray-600">Visualização de ocupação hoteleira</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-96 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <CalendarIcon className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar calendário</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={refreshData} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
          <p className="text-gray-600">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button
            onClick={() => handleQuickBooking()}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_reservations}
                </div>
                <div className="text-xs text-gray-600">Total Reservas</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.checked_in}
                </div>
                <div className="text-xs text-gray-600">Ocupados</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.arriving_today}
                </div>
                <div className="text-xs text-gray-600">Chegadas Hoje</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.departing_today}
                </div>
                <div className="text-xs text-gray-600">Saídas Hoje</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.available_rooms}
                </div>
                <div className="text-xs text-gray-600">Disponíveis</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {Math.round(stats.occupancy_rate)}%
                </div>
                <div className="text-xs text-gray-600">Ocupação</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Header Controls */}
      <CalendarHeader
        currentDate={currentDate}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        filters={filters}
        onFiltersChange={handleFilterChange}
        loading={loading}
      />

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <CalendarView
            calendarMonth={calendarMonth}
            loading={loading}
            onDayClick={handleQuickBooking}
            onReservationClick={(reservation) => {
              console.log('Clicked reservation:', reservation);
              // TODO: Abrir modal de detalhes da reserva
            }}
          />
        </CardContent>
      </Card>

      {/* Quick Booking Modal */}
      <QuickBookingModal
        isOpen={isQuickBookingOpen}
        onClose={() => {
          setIsQuickBookingOpen(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        onSuccess={() => {
          setIsQuickBookingOpen(false);
          setSelectedDate(null);
          refreshData(); // Atualizar calendário após criar reserva
        }}
      />
    </div>
  );
}