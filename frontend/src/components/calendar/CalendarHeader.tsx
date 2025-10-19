// frontend/src/components/calendar/CalendarHeader.tsx

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
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PropertyResponse } from '@/types/api';

interface CalendarFilters {
  property_id?: number;
  status?: string;
}

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  filters: CalendarFilters;
  onFiltersChange: (filters: Partial<CalendarFilters>) => void;
  properties: PropertyResponse[];
  loading?: boolean;
  loadingProperties?: boolean;
}

export default function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  filters,
  onFiltersChange,
  properties,
  loading = false,
  loadingProperties = false
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      {/* Navegação do calendário */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevMonth}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onNextMonth}
          disabled={loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          disabled={loading}
        >
          Hoje
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        {/* Filtro por Propriedade */}
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-500" />
          <Select
            value={filters.property_id?.toString() || 'all'}
            onValueChange={(value) => 
              onFiltersChange({ 
                property_id: value === 'all' ? undefined : parseInt(value) 
              })
            }
            disabled={loading || loadingProperties}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as propriedades" />
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

        {/* Filtro por Status */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => 
              onFiltersChange({ 
                status: value === 'all' ? undefined : value 
              })
            }
            disabled={loading}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmada</SelectItem>
              <SelectItem value="checked_in">Check-in</SelectItem>
              <SelectItem value="checked_out">Check-out</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Indicador de filtros ativos */}
        {(filters.property_id || filters.status) && (
          <div className="flex items-center">
            <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
}