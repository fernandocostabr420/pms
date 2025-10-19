// frontend/src/components/room-availability/RoomAvailabilityFilters.tsx

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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X, 
  CalendarDays, 
  Building, 
  Bed,
  DollarSign,
} from 'lucide-react';
import { RoomAvailabilityFilters } from '@/types/room-availability';
import { PropertyResponse, RoomTypeResponse } from '@/types/api';
import apiClient from '@/lib/api';
import { format } from 'date-fns';

interface RoomAvailabilityFiltersProps {
  filters: RoomAvailabilityFilters;
  onFiltersChange: (filters: Partial<RoomAvailabilityFilters>) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

export default function RoomAvailabilityFiltersComponent({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  loading 
}: RoomAvailabilityFiltersProps) {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeResponse[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load properties and room types
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const [propertiesData, roomTypesData] = await Promise.all([
          apiClient.getProperties(),
          apiClient.getRoomTypes(),
        ]);
        
        setProperties(propertiesData.properties);
        setRoomTypes(roomTypesData.room_types);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Count active filters
  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof RoomAvailabilityFilters];
    return value !== undefined && value !== null && value !== '';
  }).length;

  const handleDateChange = (field: 'date_from' | 'date_to', value: string) => {
    onFiltersChange({ [field]: value || undefined });
  };

  const handleStatusChange = (field: string, checked: boolean) => {
    onFiltersChange({ [field]: checked ? true : undefined });
  };

  const handleNumberChange = (field: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value);
    onFiltersChange({ [field]: numValue });
  };

  const handlePriceChange = (field: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    onFiltersChange({ [field]: numValue });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Basic Filters Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date Range */}
            <div className="flex gap-2">
              <div>
                <Label htmlFor="date-from">Data Inicial</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleDateChange('date_from', e.target.value)}
                  disabled={loading}
                  className="w-40"
                />
              </div>
              <div>
                <Label htmlFor="date-to">Data Final</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleDateChange('date_to', e.target.value)}
                  disabled={loading}
                  className="w-40"
                />
              </div>
            </div>

            {/* Property */}
            <div>
              <Label htmlFor="property">Propriedade</Label>
              <Select
                value={filters.property_id?.toString() || 'all'}
                onValueChange={(value) => onFiltersChange({ 
                  property_id: value === 'all' ? undefined : parseInt(value)
                })}
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todas as propriedades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as propriedades</SelectItem>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Type */}
            <div>
              <Label htmlFor="room-type">Tipo de Quarto</Label>
              <Select
                value={filters.room_type_id?.toString() || 'all'}
                onValueChange={(value) => onFiltersChange({ 
                  room_type_id: value === 'all' ? undefined : parseInt(value)
                })}
                disabled={loading || loadingData}
              >
                <SelectTrigger>
                  <Bed className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {roomTypes.map(roomType => (
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

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              {/* Status Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Status dos Quartos</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="available"
                      checked={filters.is_available || false}
                      onCheckedChange={(checked) => handleStatusChange('is_available', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="available" className="text-sm">Disponível</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="occupied"
                      checked={filters.is_occupied || false}
                      onCheckedChange={(checked) => handleStatusChange('is_occupied', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="occupied" className="text-sm">Ocupado</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="blocked"
                      checked={filters.is_blocked || false}
                      onCheckedChange={(checked) => handleStatusChange('is_blocked', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="blocked" className="text-sm">Bloqueado</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="maintenance"
                      checked={filters.is_maintenance || false}
                      onCheckedChange={(checked) => handleStatusChange('is_maintenance', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="maintenance" className="text-sm">Manutenção</Label>
                  </div>
                </div>
              </div>

              {/* Capacity and Price Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="min-capacity">Capacidade Mín.</Label>
                  <Input
                    id="min-capacity"
                    type="number"
                    placeholder="Pessoas"
                    value={filters.min_capacity || ''}
                    onChange={(e) => handleNumberChange('min_capacity', e.target.value)}
                    disabled={loading}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="max-capacity">Capacidade Máx.</Label>
                  <Input
                    id="max-capacity"
                    type="number"
                    placeholder="Pessoas"
                    value={filters.max_capacity || ''}
                    onChange={(e) => handleNumberChange('max_capacity', e.target.value)}
                    disabled={loading}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="min-price">Preço Mínimo</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="min-price"
                      type="number"
                      placeholder="0,00"
                      value={filters.min_price || ''}
                      onChange={(e) => handlePriceChange('min_price', e.target.value)}
                      disabled={loading}
                      className="pl-10"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="max-price">Preço Máximo</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="max-price"
                      type="number"
                      placeholder="0,00"
                      value={filters.max_price || ''}
                      onChange={(e) => handlePriceChange('max_price', e.target.value)}
                      disabled={loading}
                      className="pl-10"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Opções Adicionais</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-rates"
                      checked={filters.show_rates || false}
                      onCheckedChange={(checked) => handleStatusChange('show_rates', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="show-rates" className="text-sm">Mostrar Tarifas</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="group-by-type"
                      checked={filters.group_by_type || false}
                      onCheckedChange={(checked) => handleStatusChange('group_by_type', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="group-by-type" className="text-sm">Agrupar por Tipo</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-weekends"
                      checked={filters.show_weekends_only || false}
                      onCheckedChange={(checked) => handleStatusChange('show_weekends_only', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="show-weekends" className="text-sm">Apenas Fins de Semana</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}