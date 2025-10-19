// frontend/src/components/rooms/RoomFilters.tsx

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
  Bed,
  Settings,
} from 'lucide-react';
import { RoomFilters } from '@/types/room';
import apiClient from '@/lib/api';

interface RoomFiltersProps {
  filters: RoomFilters;
  onFiltersChange: (filters: Partial<RoomFilters>) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

export default function RoomFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading
}: RoomFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Carregar propriedades e tipos de quarto
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const [propertiesData, roomTypesData] = await Promise.all([
          apiClient.getProperties({ per_page: 100 }),
          apiClient.getRoomTypes({ per_page: 100 }),
        ]);
        
        setProperties(propertiesData.properties || []);
        setRoomTypes(roomTypesData.room_types || []);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const handleFilterChange = (key: keyof RoomFilters, value: any) => {
    onFiltersChange({ [key]: value });
  };

  // Contar filtros ativos
  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof RoomFilters];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Filtros Básicos */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Busca textual */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Número do quarto, nome..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Propriedade */}
            <div className="min-w-[160px]">
              <Label>Propriedade</Label>
              <Select
                value={filters.property_id?.toString() || 'all'}
                onValueChange={(value) => 
                  handleFilterChange('property_id', value === 'all' ? undefined : parseInt(value))
                }
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Quarto */}
            <div className="min-w-[160px]">
              <Label>Tipo de Quarto</Label>
              <Select
                value={filters.room_type_id?.toString() || 'all'}
                onValueChange={(value) => 
                  handleFilterChange('room_type_id', value === 'all' ? undefined : parseInt(value))
                }
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {roomTypes.map((roomType) => (
                    <SelectItem key={roomType.id} value={roomType.id.toString()}>
                      {roomType.name}
                    </SelectItem>
                  ))}
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
                onClick={onClearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filtros Avançados */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Andar */}
                <div className="space-y-2">
                  <Label>Andar</Label>
                  <Input
                    type="number"
                    placeholder="Andar"
                    value={filters.floor?.toString() || ''}
                    onChange={(e) => 
                      handleFilterChange('floor', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    disabled={loading}
                    min="0"
                    max="50"
                  />
                </div>

                {/* Edifício */}
                <div className="space-y-2">
                  <Label>Edifício</Label>
                  <Input
                    placeholder="Nome do edifício"
                    value={filters.building || ''}
                    onChange={(e) => handleFilterChange('building', e.target.value || undefined)}
                    disabled={loading}
                  />
                </div>

                {/* Status Operacional */}
                <div className="space-y-2">
                  <Label>Status Operacional</Label>
                  <Select
                    value={
                      filters.is_operational === true ? 'true' :
                      filters.is_operational === false ? 'false' : 'all'
                    }
                    onValueChange={(value) => 
                      handleFilterChange('is_operational', 
                        value === 'true' ? true : value === 'false' ? false : undefined
                      )
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Operacional</SelectItem>
                      <SelectItem value="false">Não Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fora de Ordem */}
                <div className="space-y-2">
                  <Label>Fora de Ordem</Label>
                  <Select
                    value={
                      filters.is_out_of_order === true ? 'true' :
                      filters.is_out_of_order === false ? 'false' : 'all'
                    }
                    onValueChange={(value) => 
                      handleFilterChange('is_out_of_order', 
                        value === 'true' ? true : value === 'false' ? false : undefined
                      )
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Fora de Ordem</SelectItem>
                      <SelectItem value="false">Disponível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Capacidade Mínima */}
                <div className="space-y-2">
                  <Label>Capacidade Mínima</Label>
                  <Input
                    type="number"
                    placeholder="Pessoas"
                    value={filters.min_capacity?.toString() || ''}
                    onChange={(e) => 
                      handleFilterChange('min_capacity', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    disabled={loading}
                    min="1"
                    max="20"
                  />
                </div>

                {/* Capacidade Máxima */}
                <div className="space-y-2">
                  <Label>Capacidade Máxima</Label>
                  <Input
                    type="number"
                    placeholder="Pessoas"
                    value={filters.max_capacity?.toString() || ''}
                    onChange={(e) => 
                      handleFilterChange('max_capacity', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    disabled={loading}
                    min="1"
                    max="20"
                  />
                </div>

                {/* Status de Limpeza */}
                <div className="space-y-2">
                  <Label>Limpeza</Label>
                  <Select
                    value={filters.housekeeping_status || 'all'}
                    onValueChange={(value) => 
                      handleFilterChange('housekeeping_status', value === 'all' ? undefined : value)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="clean">Limpo</SelectItem>
                      <SelectItem value="dirty">Sujo</SelectItem>
                      <SelectItem value="inspected">Inspecionado</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tem Varanda */}
                <div className="space-y-2">
                  <Label>Varanda</Label>
                  <Select
                    value={
                      filters.has_balcony === true ? 'true' :
                      filters.has_balcony === false ? 'false' : 'all'
                    }
                    onValueChange={(value) => 
                      handleFilterChange('has_balcony', 
                        value === 'true' ? true : value === 'false' ? false : undefined
                      )
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Com Varanda</SelectItem>
                      <SelectItem value="false">Sem Varanda</SelectItem>
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