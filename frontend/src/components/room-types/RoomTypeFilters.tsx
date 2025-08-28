// frontend/src/components/room-types/RoomTypeFilters.tsx
'use client';

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
import { Search, Filter, X, Users, CheckCircle } from 'lucide-react';
import { RoomTypeFilters } from '@/types/rooms';
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
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="true">Reserváveis</SelectItem>
                  <SelectItem value="false">Não Reserváveis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão filtros avançados */}
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={loading}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Limpar filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                disabled={loading}
                size="sm"
              >
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Capacidade Mínima */}
                <div className="space-y-2">
                  <Label htmlFor="min_capacity">Capacidade Mínima</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="min_capacity"
                      type="number"
                      min="1"
                      max="20"
                      placeholder="Mín."
                      value={filters.min_capacity || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                        onFiltersChange({ min_capacity: value });
                      }}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Capacidade Máxima */}
                <div className="space-y-2">
                  <Label htmlFor="max_capacity">Capacidade Máxima</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="max_capacity"
                      type="number"
                      min="1"
                      max="20"
                      placeholder="Máx."
                      value={filters.max_capacity || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                        onFiltersChange({ max_capacity: value });
                      }}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Comodidade */}
                <div className="space-y-2">
                  <Label htmlFor="amenity">Tem Comodidade</Label>
                  <Select
                    value={filters.has_amenity || 'all'}
                    onValueChange={(value) => {
                      onFiltersChange({
                        has_amenity: value === 'all' ? undefined : value
                      });
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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

                {/* Espaço reservado para futuras expansões */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Mais filtros em breve</Label>
                  <div className="text-xs text-gray-500">
                    Novos filtros serão adicionados conforme necessário.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumo dos filtros ativos */}
          {activeFiltersCount > 0 && (
            <div className="border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Filtros ativos:</span>
                
                {filters.search && (
                  <Badge variant="secondary">
                    Busca: "{filters.search}"
                  </Badge>
                )}
                
                {filters.is_bookable !== undefined && (
                  <Badge variant="secondary">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {filters.is_bookable ? 'Reserváveis' : 'Não Reserváveis'}
                  </Badge>
                )}
                
                {filters.min_capacity && (
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3 w-3" />
                    Min: {filters.min_capacity}
                  </Badge>
                )}
                
                {filters.max_capacity && (
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3 w-3" />
                    Max: {filters.max_capacity}
                  </Badge>
                )}
                
                {filters.has_amenity && (
                  <Badge variant="secondary">
                    Comodidade: {filters.has_amenity}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}