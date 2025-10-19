// frontend/src/components/guests/GuestFilters.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  RefreshCw
} from 'lucide-react';
import { GuestFilters } from '@/types/guest';

interface GuestFiltersProps {
  filters: GuestFilters;
  onFiltersChange: (filters: GuestFilters) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

const MARKETING_OPTIONS = [
  { value: 'yes', label: 'Aceita marketing' },
  { value: 'no', label: 'Não aceita marketing' },
  { value: 'not_asked', label: 'Não perguntado' },
];

export default function GuestFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading = false
}: GuestFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  const handleFilterChange = (key: keyof GuestFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', searchTerm);
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== '' && value !== null
    ).length;
  };

  const activeCount = getActiveFiltersCount();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Menos' : 'Mais'} Filtros
            </Button>
            {activeCount > 0 && (
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
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Busca principal */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar hóspedes por nome, email, documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              variant="outline" 
              disabled={loading}
              className="shrink-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t">
              {/* Switches de presença */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-email" className="text-sm">
                    Tem Email
                  </Label>
                  <Switch
                    id="has-email"
                    checked={filters.has_email === true}
                    onCheckedChange={(checked) => 
                      handleFilterChange('has_email', checked ? true : undefined)
                    }
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="has-document" className="text-sm">
                    Tem Documento
                  </Label>
                  <Switch
                    id="has-document"
                    checked={filters.has_document === true}
                    onCheckedChange={(checked) => 
                      handleFilterChange('has_document', checked ? true : undefined)
                    }
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Localização */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="city" className="text-sm">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="São Paulo"
                    value={filters.city || ''}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    disabled={loading}
                    size="sm"
                  />
                </div>

                <div>
                  <Label htmlFor="state" className="text-sm">Estado</Label>
                  <Input
                    id="state"
                    placeholder="SP"
                    value={filters.state || ''}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                    disabled={loading}
                    size="sm"
                  />
                </div>
              </div>

              {/* Marketing e Nacionalidade */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="nationality" className="text-sm">Nacionalidade</Label>
                  <Input
                    id="nationality"
                    placeholder="Brasil"
                    value={filters.nationality || ''}
                    onChange={(e) => handleFilterChange('nationality', e.target.value)}
                    disabled={loading}
                    size="sm"
                  />
                </div>

                <div>
                  <Label htmlFor="marketing" className="text-sm">Marketing</Label>
                  <Select
                    value={filters.marketing_consent || 'all'}
                    onValueChange={(value) => handleFilterChange('marketing_consent', value === 'all' ? undefined : value)}
                    disabled={loading}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {MARKETING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
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