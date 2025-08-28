// frontend/src/components/room-availability/RoomAvailabilityFilters.tsx
// 🔧 VERSÃO CORRIGIDA - Substituir o arquivo anterior por este
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
    onFiltersChange({ [field]: value || undefined });  // ✅ Converter string vazia para undefined
  };

  const handleStatusChange = (field: string, checked: boolean) => {
    onFiltersChange({ [field]: checked ? true : undefined });
  };

  const handleNumberChange = (field: string, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    onFiltersChange({ [field]: numValue });
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium">Filtros</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Simples' : 'Avançado'}
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Busca textual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Busca</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Buscar por quarto, propriedade..."
                  value={filters.search || ''}
                  onChange={(e) => onFiltersChange({ search: e.target.value || undefined })}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Filtros básicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Propriedade - ✅ CORRIGIDO */}
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

            {/* Tipo de Quarto - ✅ CORRIGIDO */}
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
                  {roomTypes.map(type => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros de data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_from">Data Inicial</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="date_from"
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleDateChange('date_from', e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="date_to">Data Final</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="date_to"
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleDateChange('date_to', e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Filtros avançados */}
          {showAdvanced && (
            <>
              {/* Status de disponibilidade */}
              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Status de Disponibilidade</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_available"
                      checked={filters.is_available === true}
                      onCheckedChange={(checked) => handleStatusChange('is_available', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="is_available" className="text-sm">Disponível</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_blocked"
                      checked={filters.is_blocked === true}
                      onCheckedChange={(checked) => handleStatusChange('is_blocked', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="is_blocked" className="text-sm">Bloqueado</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_reserved"
                      checked={filters.is_reserved === true}
                      onCheckedChange={(checked) => handleStatusChange('is_reserved', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="is_reserved" className="text-sm">Reservado</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_maintenance"
                      checked={filters.is_maintenance === true}
                      onCheckedChange={(checked) => handleStatusChange('is_maintenance', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="is_maintenance" className="text-sm">Manutenção</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_out_of_order"
                      checked={filters.is_out_of_order === true}
                      onCheckedChange={(checked) => handleStatusChange('is_out_of_order', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="is_out_of_order" className="text-sm">Fora de Ordem</Label>
                  </div>
                </div>
              </div>

              {/* Restrições */}
              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Restrições</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="closed_to_arrival"
                      checked={filters.closed_to_arrival === true}
                      onCheckedChange={(checked) => handleStatusChange('closed_to_arrival', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="closed_to_arrival" className="text-sm">Fechado para Chegada</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="closed_to_departure"
                      checked={filters.closed_to_departure === true}
                      onCheckedChange={(checked) => handleStatusChange('closed_to_departure', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="closed_to_departure" className="text-sm">Fechado para Saída</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="has_rate_override"
                      checked={filters.has_rate_override === true}
                      onCheckedChange={(checked) => handleStatusChange('has_rate_override', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="has_rate_override" className="text-sm">Com Preço Especial</Label>
                  </div>
                </div>
              </div>

              {/* Filtros de preço */}
              <div className="border-t pt-4">
                <Label className="text-base font-medium mb-3 block">Faixa de Preço</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_rate">Preço Mínimo</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="min_rate"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={filters.min_rate || ''}
                        onChange={(e) => handleNumberChange('min_rate', e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="max_rate">Preço Máximo</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="max_rate"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="999.99"
                        value={filters.max_rate || ''}
                        onChange={(e) => handleNumberChange('max_rate', e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}