// frontend/src/components/room-types/RoomTypeFilters.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X, 
  Building, 
  Users,
  DollarSign,
} from 'lucide-react';
import { RoomTypeFilters } from '@/types/room-type';
import apiClient from '@/lib/api';

interface RoomTypeFiltersProps {
  filters: RoomTypeFilters;
  onFiltersChange: (filters: Partial<RoomTypeFilters>) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

export default function RoomTypeFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading = false
}: RoomTypeFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [availableAmenities, setAvailableAmenities] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  // Carregar comodidades disponíveis
  useEffect(() => {
    const loadAmenities = async () => {
      try {
        const amenities = await apiClient.getAvailableAmenities();
        setAvailableAmenities(amenities);
      } catch (error) {
        console.error('Erro ao carregar comodidades:', error);
      }
    };

    loadAmenities();
  }, []);

  // Debounce da busca textual
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFiltersChange({ search: localSearch || undefined });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, filters.search, onFiltersChange]);

  // Contar filtros ativos
  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof RoomTypeFilters];
    return value !== undefined && value !== '' && value !== null;
  }).length;

  const handleClearFilters = () => {
    setLocalSearch('');
    onClearFilters();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Linha principal de filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Busca textual */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar tipos de quartos..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Status de reserva */}
            <div className="w-full sm:w-48">
              <Select
                value={filters.is_bookable === undefined ? 'all' : filters.is_bookable.toString()}
                onValueChange={(value) => {
                  onFiltersChange({
                    is_bookable: value === 'all' ? undefined : value === 'true'
                  });
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Disponível para Reserva</SelectItem>
                  <SelectItem value="false">Indisponível</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Advanced */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={loading}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Menos' : 'Mais'} Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              {/* Capacidade e preços */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="min-capacity">Capacidade Mínima</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="min-capacity"
                      type="number"
                      placeholder="Pessoas"
                      value={filters.min_capacity?.toString() || ''}
                      onChange={(e) => onFiltersChange({ 
                        min_capacity: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      className="pl-10"
                      disabled={loading}
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="max-capacity">Capacidade Máxima</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="max-capacity"
                      type="number"
                      placeholder="Pessoas"
                      value={filters.max_capacity?.toString() || ''}
                      onChange={(e) => onFiltersChange({ 
                        max_capacity: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      className="pl-10"
                      disabled={loading}
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="min-base-rate">Tarifa Mínima</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="min-base-rate"
                      type="number"
                      placeholder="0,00"
                      value={filters.min_base_rate?.toString() || ''}
                      onChange={(e) => onFiltersChange({ 
                        min_base_rate: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      className="pl-10"
                      disabled={loading}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="max-base-rate">Tarifa Máxima</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="max-base-rate"
                      type="number"
                      placeholder="0,00"
                      value={filters.max_base_rate?.toString() || ''}
                      onChange={(e) => onFiltersChange({ 
                        max_base_rate: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      className="pl-10"
                      disabled={loading}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Comodidades */}
              {availableAmenities.length > 0 && (
                <div>
                  <Label>Comodidades</Label>
                  <Select
                    value={filters.has_amenity || 'all'}
                    onValueChange={(value) => onFiltersChange({ 
                      has_amenity: value === 'all' ? undefined : value 
                    })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar comodidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Comodidades</SelectItem>
                      {availableAmenities.map((amenity) => (
                        <SelectItem key={amenity} value={amenity}>
                          {amenity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Outros filtros específicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Quartos Ativos</Label>
                  <Select
                    value={filters.has_active_rooms === undefined ? 'all' : filters.has_active_rooms.toString()}
                    onValueChange={(value) => onFiltersChange({ 
                      has_active_rooms: value === 'all' ? undefined : value === 'true'
                    })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Com Quartos Ativos</SelectItem>
                      <SelectItem value="false">Sem Quartos Ativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Ordem</Label>
                  <Select
                    value={filters.sort_by || 'name'}
                    onValueChange={(value) => onFiltersChange({ sort_by: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nome</SelectItem>
                      <SelectItem value="capacity">Capacidade</SelectItem>
                      <SelectItem value="base_rate">Tarifa Base</SelectItem>
                      <SelectItem value="created_date">Data de Criação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Direção</Label>
                  <Select
                    value={filters.sort_direction || 'asc'}
                    onValueChange={(value) => onFiltersChange({ sort_direction: value as 'asc' | 'desc' })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Direção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Crescente</SelectItem>
                      <SelectItem value="desc">Decrescente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}