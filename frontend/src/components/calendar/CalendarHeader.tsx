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
  Filter,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarFilters } from '@/types/calendar';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { PropertyResponse } from '@/types/api';

interface CalendarHeaderProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  filters: CalendarFilters;
  onFiltersChange: (filters: Partial<CalendarFilters>) => void;
  loading: boolean;
}

export default function CalendarHeader({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  onToday,
  filters,
  onFiltersChange,
  loading
}: CalendarHeaderProps) {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Carregar propriedades para filtro
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoadingProperties(true);
        const response = await apiClient.getProperties({ page: 1, per_page: 100 });
        setProperties(response.properties);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
      } finally {
        setLoadingProperties(false);
      }
    };

    loadProperties();
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white border rounded-lg">
      {/* Navegação de Mês */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPreviousMonth}
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
            value={filters.status || 'active'}
            onValueChange={(value) => 
              onFiltersChange({ 
                status: value === 'active' ? undefined : value 
              })
            }
            disabled={loading}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativas</SelectItem>
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