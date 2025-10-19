// frontend/src/components/room-map/RoomMapHeader.tsx
'use client';

import { Button } from '@/components/ui/button';
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
  Building,
  Filter,
  RefreshCw,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PropertyResponse } from '@/types/api';
import { MapFilters } from '@/types/room-map';
import { Badge } from '@/components/ui/badge';

interface RoomMapHeaderProps {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onRefresh: () => void;
  filters: MapFilters;
  onFiltersChange: (filters: Partial<MapFilters>) => void;
  properties: PropertyResponse[];
  loading?: boolean;
  loadingProperties?: boolean;
  onQuickBooking?: () => void;
}

export default function RoomMapHeader({
  dateRange,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onRefresh,
  filters,
  onFiltersChange,
  properties,
  loading = false,
  loadingProperties = false,
  onQuickBooking
}: RoomMapHeaderProps) {
  
  const formatDateRange = () => {
    const start = format(dateRange.startDate, 'dd/MM', { locale: ptBR });
    const end = format(dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR });
    return `${start} - ${end}`;
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'start_date' || key === 'end_date') return false;
    if (key === 'include_out_of_order' && value === true) return false;
    if (key === 'include_cancelled' && value === false) return false;
    return value !== undefined && value !== null && value !== '';
  }).length;

  return (
    <div className="flex flex-col gap-4 p-4 border-b bg-white">
      {/* Linha principal */}
      <div className="flex items-center justify-between">
        {/* Navegação de datas */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousWeek}
            disabled={loading}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
              {formatDateRange()}
            </h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onNextWeek}
            disabled={loading}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            disabled={loading}
            className="h-8"
          >
            Hoje
          </Button>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {onQuickBooking && (
            <Button
              size="sm"
              onClick={onQuickBooking}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Reserva Rápida
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Propriedade */}
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-500" />
          <Select
            value={filters.property_id?.toString() || 'all'}
            onValueChange={(value) => 
              onFiltersChange({ 
                property_id: value === 'all' ? undefined : parseInt(value)
              })
            }
            disabled={loadingProperties || loading}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Propriedade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as propriedades</SelectItem>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id.toString()}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status das reservas */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select
            value={filters.status_filter?.join(',') || 'all'}
            onValueChange={(value) => 
              onFiltersChange({ 
                status_filter: value === 'all' ? undefined : value.split(',')
              })
            }
            disabled={loading}
          >
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="confirmed">Confirmadas</SelectItem>
              <SelectItem value="checked_in">Check-in</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quartos fora de funcionamento */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.include_out_of_order || false}
            onChange={(e) => 
              onFiltersChange({ include_out_of_order: e.target.checked })
            }
            disabled={loading}
            className="rounded border-gray-300"
          />
          Incluir quartos inativos
        </label>

        {/* Reservas canceladas */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.include_cancelled || false}
            onChange={(e) => 
              onFiltersChange({ include_cancelled: e.target.checked })
            }
            disabled={loading}
            className="rounded border-gray-300"
          />
          Incluir canceladas
        </label>

        {/* Badge de filtros ativos */}
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="h-6">
            {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}