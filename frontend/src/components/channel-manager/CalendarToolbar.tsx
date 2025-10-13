// frontend/src/components/channel-manager/CalendarToolbar.tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  RotateCcw,
  Edit3,
  RefreshCw,
  Building,
  Users,
  Download,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ChannelManagerFilters, 
  AvailabilityCalendarResponse
} from '@/types/channel-manager';
import { ChannelManagerDateRangePicker } from '@/components/channel-manager/DateRangePicker';

interface CalendarToolbarProps {
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToToday: () => void;
  filters: ChannelManagerFilters;
  setFilters: (filters: ChannelManagerFilters) => void;
  onBulkEdit: () => void;
  onRefresh: () => void;
  data?: AvailabilityCalendarResponse | null;
  loading: boolean;
}

export function CalendarToolbar({
  dateRange,
  setDateRange,
  goToPreviousWeek,
  goToNextWeek,
  goToToday,
  filters,
  setFilters,
  onBulkEdit,
  onRefresh,
  data,
  loading
}: CalendarToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  // ============== ROOM FILTER OPTIONS ==============
  
  const roomOptions = data?.rooms_summary.map(room => ({
    value: room.room_id.toString(),
    label: `${room.room_number} - ${room.room_name}`
  })) || [];

  // ============== HANDLERS ==============

  const handleRoomFilter = (roomIds: string[]) => {
    setFilters({
      ...filters,
      room_ids: roomIds.length > 0 ? roomIds.map(id => parseInt(id)) : undefined
    });
  };

  const clearFilters = () => {
    setFilters({
      property_id: filters.property_id // Manter apenas property_id
    });
  };

  const hasActiveFilters = !!(
    filters.room_ids?.length ||
    filters.sync_status ||
    filters.has_errors ||
    filters.search
  );

  // ============== RENDER ==============

  return (
    <div className="space-y-4">
      {/* ===== MAIN TOOLBAR ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Left side - Navigation */}
        <div className="flex items-center gap-2">
          
          {/* Week Navigation */}
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousWeek}
              className="h-8 w-8 p-0 border-r"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 text-xs font-medium"
            >
              Hoje
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextWeek}
              className="h-8 w-8 p-0 border-l"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Date Range Picker - NOVO COMPONENTE */}
          <ChannelManagerDateRangePicker
            value={dateRange}
            onChange={(range) => range && setDateRange(range)}
            numberOfMonths={2}
            showPresets={true}
            maxDays={366}
          />

        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          
          {/* Filters Toggle */}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                {(filters.room_ids?.length || 0) + (filters.sync_status ? 1 : 0) + (filters.has_errors ? 1 : 0)}
              </Badge>
            )}
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>

          {/* Bulk Edit */}
          <Button
            onClick={onBulkEdit}
            size="sm"
            disabled={!data || data.rooms_summary.length === 0}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edição em Massa
          </Button>

        </div>
      </div>

      {/* ===== FILTERS PANEL ===== */}
      {showFilters && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Filtros</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Room Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Quartos
              </Label>
              <Select
                value={filters.room_ids?.join(',') || 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleRoomFilter([]);
                  } else {
                    handleRoomFilter(value.split(','));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os quartos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os quartos</SelectItem>
                  {roomOptions.map(room => (
                    <SelectItem key={room.value} value={room.value}>
                      {room.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status de Sincronização</Label>
              <Select
                value={filters.sync_status || 'all'}
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    sync_status: value === 'all' ? undefined : value as any
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="connected">Conectado</SelectItem>
                  <SelectItem value="syncing">Sincronizando</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="error">Com erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtrar Problemas</Label>
              <Select
                value={filters.has_errors ? 'errors' : 'all'}
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    has_errors: value === 'errors' ? true : undefined
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="errors">Apenas com erros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Buscar</Label>
              <Input
                placeholder="Buscar quartos..."
                value={filters.search || ''}
                onChange={(e) => {
                  setFilters({
                    ...filters,
                    search: e.target.value || undefined
                  });
                }}
                className="h-9"
              />
            </div>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {filters.room_ids?.length && (
                <Badge variant="secondary" className="text-xs">
                  {filters.room_ids.length} quarto(s) selecionado(s)
                </Badge>
              )}
              {filters.sync_status && (
                <Badge variant="secondary" className="text-xs">
                  Status: {filters.sync_status}
                </Badge>
              )}
              {filters.has_errors && (
                <Badge variant="destructive" className="text-xs">
                  Apenas com erros
                </Badge>
              )}
              {filters.search && (
                <Badge variant="secondary" className="text-xs">
                  Busca: "{filters.search}"
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== PERIOD SUMMARY ===== */}
      {data && (
        <div className="flex items-center justify-between text-sm text-gray-600 py-2 border-t border-b bg-gray-50 px-4 rounded">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(dateRange.from, "dd 'de' MMMM", { locale: ptBR })} - {format(dateRange.to, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              {data.rooms_summary.length} quartos
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {data.total_days} dias
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span>{data.statistics.synced_records}/{data.statistics.total_records} sincronizados</span>
            <Badge variant={data.statistics.sync_rate > 95 ? "default" : data.statistics.sync_rate > 80 ? "secondary" : "destructive"}>
              {Math.round(data.statistics.sync_rate)}% sync
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}