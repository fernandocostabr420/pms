// frontend/src/components/rooms/RoomFilters.tsx
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
import { 
  Search, 
  Filter, 
  X,
  Building,
  Bed,
  Users,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { RoomFilters as RoomFiltersType } from '@/types/rooms';
import { PropertyResponse, RoomTypeResponse } from '@/types/api';
import apiClient from '@/lib/api';

interface RoomFiltersProps {
  filters: RoomFiltersType;
  onFiltersChange: (filters: Partial<RoomFiltersType>) => void;
  loading?: boolean;
}

export default function RoomFilters({ 
  filters, 
  onFiltersChange,
  loading = false 
}: RoomFiltersProps) {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeResponse[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Carregar propriedades e tipos de quarto
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        setLoadingData(true);
        const [propertiesRes, roomTypesRes] = await Promise.all([
          apiClient.getProperties({ page: 1, per_page: 100 }),
          apiClient.getRoomTypes({ page: 1, per_page: 100 })
        ]);
        
        setProperties(propertiesRes.properties);
        setRoomTypes(roomTypesRes.room_types);
      } catch (error) {
        console.error('Erro ao carregar dados dos filtros:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadFilterData();
  }, []);

  const handleFilterChange = (key: keyof RoomFiltersType, value: any) => {
    onFiltersChange({ [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      property_id: undefined,
      room_type_id: undefined,
      floor: undefined,
      building: undefined,
      is_operational: undefined,
      is_out_of_order: undefined,
      is_available_for_booking: undefined,
      min_occupancy: undefined,
      max_occupancy: undefined,
      has_amenity: undefined,
      search: undefined,
    });
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== null && value !== ''
    ).length;
  };

  const getActiveFiltersBadges = () => {
    const badges = [];
    
    if (filters.property_id) {
      const property = properties.find(p => p.id === filters.property_id);
      if (property) {
        badges.push({
          key: 'property_id',
          label: `Propriedade: ${property.name}`,
          value: filters.property_id
        });
      }
    }
    
    if (filters.room_type_id) {
      const roomType = roomTypes.find(rt => rt.id === filters.room_type_id);
      if (roomType) {
        badges.push({
          key: 'room_type_id',
          label: `Tipo: ${roomType.name}`,
          value: filters.room_type_id
        });
      }
    }

    if (filters.floor !== undefined) {
      badges.push({
        key: 'floor',
        label: `Andar: ${filters.floor}`,
        value: filters.floor
      });
    }

    if (filters.building) {
      badges.push({
        key: 'building',
        label: `Edifício: ${filters.building}`,
        value: filters.building
      });
    }

    if (filters.is_operational === true) {
      badges.push({
        key: 'is_operational',
        label: 'Operacional',
        value: filters.is_operational
      });
    }

    if (filters.is_operational === false) {
      badges.push({
        key: 'is_operational',
        label: 'Não Operacional',
        value: filters.is_operational
      });
    }

    if (filters.is_out_of_order === true) {
      badges.push({
        key: 'is_out_of_order',
        label: 'Fora de Ordem',
        value: filters.is_out_of_order
      });
    }

    return badges;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Barra de pesquisa e botão de filtro */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, número do quarto..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2"
              disabled={loading}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
            
            {getActiveFiltersCount() > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Badges dos filtros ativos */}
        {getActiveFiltersCount() > 0 && (
          <div className="flex flex-wrap gap-2">
            {getActiveFiltersBadges().map((badge) => (
              <Badge
                key={badge.key}
                variant="secondary"
                className="flex items-center gap-1 cursor-pointer hover:bg-gray-200"
                onClick={() => handleFilterChange(badge.key as keyof RoomFiltersType, undefined)}
              >
                {badge.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* Filtros expandidos */}
        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            {/* Propriedade */}
            <div className="space-y-2">
              <Label>Propriedade</Label>
              <Select
                value={filters.property_id?.toString() || ''}
                onValueChange={(value) => 
                  handleFilterChange('property_id', value ? parseInt(value) : undefined)
                }
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Quarto */}
            <div className="space-y-2">
              <Label>Tipo de Quarto</Label>
              <Select
                value={filters.room_type_id?.toString() || ''}
                onValueChange={(value) => 
                  handleFilterChange('room_type_id', value ? parseInt(value) : undefined)
                }
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {roomTypes.map((roomType) => (
                    <SelectItem key={roomType.id} value={roomType.id.toString()}>
                      {roomType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  filters.is_operational === false ? 'false' : ''
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
                  <SelectItem value="">Todos</SelectItem>
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
                  filters.is_out_of_order === false ? 'false' : ''
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
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Fora de Ordem</SelectItem>
                  <SelectItem value="false">Em Funcionamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Capacidade Mínima */}
            <div className="space-y-2">
              <Label>Capacidade Mínima</Label>
              <Input
                type="number"
                placeholder="Min"
                value={filters.min_occupancy?.toString() || ''}
                onChange={(e) => 
                  handleFilterChange('min_occupancy', e.target.value ? parseInt(e.target.value) : undefined)
                }
                disabled={loading}
                min="1"
                max="10"
              />
            </div>

            {/* Capacidade Máxima */}
            <div className="space-y-2">
              <Label>Capacidade Máxima</Label>
              <Input
                type="number"
                placeholder="Max"
                value={filters.max_occupancy?.toString() || ''}
                onChange={(e) => 
                  handleFilterChange('max_occupancy', e.target.value ? parseInt(e.target.value) : undefined)
                }
                disabled={loading}
                min="1"
                max="10"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}