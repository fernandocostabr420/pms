// frontend/src/components/reservations/ReservationFilters.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Calendar as CalendarIcon,
  Filter,
  X,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReservationFilters } from '@/types/reservation';
import MultiSelect, { MultiSelectOption } from '@/components/ui/multi-select';

interface ReservationFiltersProps {
  filters: ReservationFilters;
  onFiltersChange: (filters: ReservationFilters) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

const statusOptions: MultiSelectOption[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'checked_in', label: 'Check-in Realizado' },
  { value: 'checked_out', label: 'Check-out Realizado' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No-show' }
];

const sourceOptions: MultiSelectOption[] = [
  { value: 'direct', label: 'Direto' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'hotels', label: 'Hotels.com' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Site' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'referral', label: 'Indicação' }
];

export default function ReservationFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading = false
}: ReservationFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ReservationFilters>(filters);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [reservationFrom, setReservationFrom] = useState<Date>();
  const [reservationTo, setReservationTo] = useState<Date>();
  const [checkInFrom, setCheckInFrom] = useState<Date>();
  const [checkInTo, setCheckInTo] = useState<Date>();
  const [checkOutFrom, setCheckOutFrom] = useState<Date>();
  const [checkOutTo, setCheckOutTo] = useState<Date>();

  useEffect(() => {
    setLocalFilters(filters);
    
    if (filters.status_list?.length) {
      setSelectedStatuses(filters.status_list);
    } else if (filters.status) {
      const statusArray = filters.status.includes(',') 
        ? filters.status.split(',').map(s => s.trim())
        : [filters.status];
      setSelectedStatuses(statusArray);
    } else {
      setSelectedStatuses([]);
    }
    
    if (filters.source_list?.length) {
      setSelectedSources(filters.source_list);
    } else if (filters.source) {
      const sourceArray = filters.source.includes(',') 
        ? filters.source.split(',').map(s => s.trim())
        : [filters.source];
      setSelectedSources(sourceArray);
    } else {
      setSelectedSources([]);
    }
    
    setReservationFrom(filters.created_from ? new Date(filters.created_from.split('T')[0]) : undefined);
    setReservationTo(filters.created_to ? new Date(filters.created_to.split('T')[0]) : undefined);
    setCheckInFrom(filters.check_in_from ? new Date(filters.check_in_from) : undefined);
    setCheckInTo(filters.check_in_to ? new Date(filters.check_in_to) : undefined);
    setCheckOutFrom(filters.check_out_from ? new Date(filters.check_out_from) : undefined);
    setCheckOutTo(filters.check_out_to ? new Date(filters.check_out_to) : undefined);
  }, [filters]);

  const updateLocalFilter = (key: keyof ReservationFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleStatusChange = (newStatuses: string[]) => {
    setSelectedStatuses(newStatuses);
    updateLocalFilter('status_list', newStatuses.length > 0 ? newStatuses : undefined);
    updateLocalFilter('status', undefined);
  };

  const handleSourceChange = (newSources: string[]) => {
    setSelectedSources(newSources);
    updateLocalFilter('source_list', newSources.length > 0 ? newSources : undefined);
    updateLocalFilter('source', undefined);
  };

  const handleDateChange = (type: string, date: Date | undefined) => {
    let dateStr: string | undefined;
    
    if (type.startsWith('reservation')) {
      if (date) {
        dateStr = type === 'reservation_from' 
          ? format(date, 'yyyy-MM-dd') + 'T00:00:00'
          : format(date, 'yyyy-MM-dd') + 'T23:59:59';
      }
    } else {
      dateStr = date ? format(date, 'yyyy-MM-dd') : undefined;
    }
    
    switch (type) {
      case 'reservation_from':
        setReservationFrom(date);
        updateLocalFilter('created_from', dateStr);
        break;
      case 'reservation_to':
        setReservationTo(date);
        updateLocalFilter('created_to', dateStr);
        break;
      case 'checkin_from':
        setCheckInFrom(date);
        updateLocalFilter('check_in_from', dateStr);
        break;
      case 'checkin_to':
        setCheckInTo(date);
        updateLocalFilter('check_in_to', dateStr);
        break;
      case 'checkout_from':
        setCheckOutFrom(date);
        updateLocalFilter('check_out_from', dateStr);
        break;
      case 'checkout_to':
        setCheckOutTo(date);
        updateLocalFilter('check_out_to', dateStr);
        break;
    }
  };

  const applyFilters = () => {
    const filtersToSend = { ...localFilters };
    
    if (selectedStatuses.length > 0) {
      filtersToSend.status = selectedStatuses.length === 1 ? selectedStatuses[0] : selectedStatuses.join(',');
      delete filtersToSend.status_list;
    } else {
      delete filtersToSend.status;
      delete filtersToSend.status_list;
    }
    
    if (selectedSources.length > 0) {
      filtersToSend.source = selectedSources.length === 1 ? selectedSources[0] : selectedSources.join(',');
      delete filtersToSend.source_list;
    } else {
      delete filtersToSend.source;
      delete filtersToSend.source_list;
    }
    
    onFiltersChange(filtersToSend);
  };

  const clearAll = () => {
    setLocalFilters({
      status: undefined,
      source: undefined,
      status_list: undefined,
      source_list: undefined,
      guest_id: undefined,
      check_in_from: undefined,
      check_in_to: undefined,
      check_out_from: undefined,
      check_out_to: undefined,
      created_from: undefined,
      created_to: undefined,
      search: undefined,
      is_paid: undefined,
      requires_deposit: undefined,
      is_group_reservation: undefined,
    });
    
    setSelectedStatuses([]);
    setSelectedSources([]);
    setReservationFrom(undefined);
    setReservationTo(undefined);
    setCheckInFrom(undefined);
    setCheckInTo(undefined);
    setCheckOutFrom(undefined);
    setCheckOutTo(undefined);
    
    onClearFilters();
  };

  const hasChanges = JSON.stringify(localFilters) !== JSON.stringify(filters);
  const hasActiveFilters = Object.values(localFilters).some(v => v && v !== '') || 
                          selectedStatuses.length > 0 || 
                          selectedSources.length > 0;
  
  const activeCount = selectedStatuses.length + 
                     selectedSources.length + 
                     (localFilters.search ? 1 : 0) +
                     (localFilters.check_in_from || localFilters.check_in_to ? 1 : 0) +
                     (localFilters.check_out_from || localFilters.check_out_to ? 1 : 0) +
                     (localFilters.created_from || localFilters.created_to ? 1 : 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Filtros de Busca</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        
        {hasChanges && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            <div className="w-1 h-1 bg-amber-400 rounded-full"></div>
            Modificados
          </div>
        )}
      </div>

      {/* Filtros Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Número, nome, e-mail..."
              className="pl-8 h-8 text-sm border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={localFilters.search || ''}
              onChange={(e) => updateLocalFilter('search', e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
          <MultiSelect
            options={statusOptions}
            value={selectedStatuses}
            onChange={handleStatusChange}
            placeholder="Selecione status..."
            disabled={loading}
            allowSelectAll={true}
            searchable={true}
            className="h-8 text-sm border-gray-300 focus:border-blue-500"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Canal</Label>
          <MultiSelect
            options={sourceOptions}
            value={selectedSources}
            onChange={handleSourceChange}
            placeholder="Selecione canais..."
            disabled={loading}
            allowSelectAll={true}
            searchable={true}
            className="h-8 text-sm border-gray-300 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filtros de Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data da Reserva</Label>
          <div className="grid grid-cols-2 gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !reservationFrom && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {reservationFrom ? format(reservationFrom, "dd/MM", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reservationFrom}
                  onSelect={(date) => handleDateChange('reservation_from', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !reservationTo && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {reservationTo ? format(reservationTo, "dd/MM", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reservationTo}
                  onSelect={(date) => handleDateChange('reservation_to', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data Check-in</Label>
          <div className="grid grid-cols-2 gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !checkInFrom && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {checkInFrom ? format(checkInFrom, "dd/MM", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkInFrom}
                  onSelect={(date) => handleDateChange('checkin_from', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !checkInTo && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {checkInTo ? format(checkInTo, "dd/MM", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkInTo}
                  onSelect={(date) => handleDateChange('checkin_to', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data Check-out</Label>
          <div className="grid grid-cols-2 gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !checkOutFrom && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {checkOutFrom ? format(checkOutFrom, "dd/MM", { locale: ptBR }) : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOutFrom}
                  onSelect={(date) => handleDateChange('checkout_from', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 px-2 justify-start text-xs border-gray-300 hover:border-gray-400",
                    !checkOutTo && "text-gray-400"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {checkOutTo ? format(checkOutTo, "dd/MM", { locale: ptBR }) : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOutTo}
                  onSelect={(date) => handleDateChange('checkout_to', date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearAll}
              disabled={loading}
              className="h-7 px-3 text-xs text-gray-600 hover:text-gray-900"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-gray-600">Clique em "Aplicar"</span>
          )}
          
          <Button
            onClick={applyFilters}
            disabled={loading}
            size="sm"
            className={cn(
              "h-7 px-4 text-xs",
              hasChanges 
                ? "bg-blue-600 hover:bg-blue-700" 
                : "bg-gray-600 hover:bg-gray-700"
            )}
          >
            {loading ? (
              "Buscando..."
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Aplicar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}