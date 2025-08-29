// frontend/src/app/dashboard/calendar/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
import { PropertyResponse } from '@/types/api';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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

  // Estados para modal de reserva rápida
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Estados para propriedades
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  
  const { toast } = useToast();

  // Carregar propriedades no carregamento inicial
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoadingProperties(true);
        const response = await apiClient.getProperties({ per_page: 100 });
        setProperties(response.properties || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
        setProperties([]);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as propriedades",
          variant: "destructive",
        });
      } finally {
        setLoadingProperties(false);
      }
    };

    loadProperties();
  }, [toast]);

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

  // Renderização do estado de loading inicial
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

  // Renderização do estado de erro
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

      {/* Cards de Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reservas Totais</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total_reservations || 0}
                  </p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-ins Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.arriving_today || 0}
                  </p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Check-outs Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.departing_today || 0}
                  </p>
                </div>
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <ArrowLeft className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Ocupação</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.occupancy_rate ? `${stats.occupancy_rate}%` : '0%'}
                  </p>
                </div>
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Home className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Header Controls - CORRIGIDO */}
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        filters={filters}
        onFiltersChange={handleFilterChange}
        properties={properties}
        loading={loading}
        loadingProperties={loadingProperties}
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