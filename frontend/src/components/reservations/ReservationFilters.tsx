// frontend/src/components/reservations/ReservationFilters.tsx

import { useState, useEffect } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  Building,
  User,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReservationFilters } from '@/types/reservation';
import apiClient from '@/lib/api';

interface ReservationFiltersProps {
  filters: ReservationFilters;
  onFiltersChange: (filters: ReservationFilters) => void;
  onClearFilters: () => void;
  loading?: boolean;
}

export default function ReservationFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading
}: ReservationFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [checkInFrom, setCheckInFrom] = useState<Date>();
  const [checkInTo, setCheckInTo] = useState<Date>();
  const [checkOutFrom, setCheckOutFrom] = useState<Date>();
  const [checkOutTo, setCheckOutTo] = useState<Date>();

  // Carregar propriedades para filtro
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const response = await apiClient.getProperties({ per_page: 100 });
        setProperties(response.properties || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
      }
    };
    loadProperties();
  }, []);

  // Sincronizar datas com filtros
  useEffect(() => {
    if (filters.check_in_from) {
      setCheckInFrom(new Date(filters.check_in_from));
    }
    if (filters.check_in_to) {
      setCheckInTo(new Date(filters.check_in_to));
    }
    if (filters.check_out_from) {
      setCheckOutFrom(new Date(filters.check_out_from));
    }
    if (filters.check_out_to) {
      setCheckOutTo(new Date(filters.check_out_to));
    }
  }, [filters]);

  const handleFilterChange = (key: keyof ReservationFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleDateChange = (key: string, date: Date | undefined) => {
    const dateStr = date ? format(date, 'yyyy-MM-dd') : undefined;
    
    switch (key) {
      case 'check_in_from':
        setCheckInFrom(date);
        handleFilterChange('check_in_from', dateStr);
        break;
      case 'check_in_to':
        setCheckInTo(date);
        handleFilterChange('check_in_to', dateStr);
        break;
      case 'check_out_from':
        setCheckOutFrom(date);
        handleFilterChange('check_out_from', dateStr);
        break;
      case 'check_out_to':
        setCheckOutTo(date);
        handleFilterChange('check_out_to', dateStr);
        break;
    }
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== null && value !== ''
  );

  // ✅ CORRIGIDO - Usar valores válidos ao invés de string vazia
  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'pending', label: 'Pendente' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'checked_in', label: 'Check-in Feito' },
    { value: 'checked_out', label: 'Check-out Feito' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'no_show', label: 'No-show' },
  ];

  const sourceOptions = [
    { value: 'all', label: 'Todos os Canais' },
    { value: 'direct', label: 'Direto' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'E-mail' },
    { value: 'walk_in', label: 'Walk-in' },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Basic Filters Row */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Número, hóspede, email..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status */}
            <div className="min-w-[160px]">
              <Label>Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property */}
            <div className="min-w-[160px]">
              <Label>Propriedade</Label>
              <Select
                value={filters.property_id?.toString() || 'all'}
                onValueChange={(value) => handleFilterChange('property_id', value === 'all' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Propriedade" />
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

            {/* Toggle Advanced */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={loading}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Menos' : 'Mais'} Filtros
            </Button>

            {/* Clear Filters */}
            {hasActiveFilters && (
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
              {/* Date Ranges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Check-in Range */}
                <div className="space-y-2">
                  <Label>Período de Check-in</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !checkInFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkInFrom ? format(checkInFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkInFrom}
                          onSelect={(date) => handleDateChange('check_in_from', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !checkInTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkInTo ? format(checkInTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkInTo}
                          onSelect={(date) => handleDateChange('check_in_to', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Check-out Range */}
                <div className="space-y-2">
                  <Label>Período de Check-out</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !checkOutFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkOutFrom ? format(checkOutFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkOutFrom}
                          onSelect={(date) => handleDateChange('check_out_from', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !checkOutTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkOutTo ? format(checkOutTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkOutTo}
                          onSelect={(date) => handleDateChange('check_out_to', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Additional Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Source */}
                <div>
                  <Label>Canal</Label>
                  <Select
                    value={filters.source || 'all'}
                    onValueChange={(value) => handleFilterChange('source', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Amount */}
                <div>
                  <Label htmlFor="min-amount">Valor Mínimo</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="min-amount"
                      type="number"
                      placeholder="0,00"
                      value={filters.min_amount || ''}
                      onChange={(e) => handleFilterChange('min_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Max Amount */}
                <div>
                  <Label htmlFor="max-amount">Valor Máximo</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="max-amount"
                      type="number"
                      placeholder="0,00"
                      value={filters.max_amount || ''}
                      onChange={(e) => handleFilterChange('max_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Is Paid */}
                <div>
                  <Label>Pagamento</Label>
                  <Select
                    value={filters.is_paid === undefined ? 'all' : filters.is_paid.toString()}
                    onValueChange={(value) => handleFilterChange('is_paid', value === 'all' ? undefined : value === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Pago</SelectItem>
                      <SelectItem value="false">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Group Reservation */}
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={filters.is_group_reservation === undefined ? 'all' : filters.is_group_reservation.toString()}
                    onValueChange={(value) => handleFilterChange('is_group_reservation', value === 'all' ? undefined : value === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="false">Individual</SelectItem>
                      <SelectItem value="true">Grupo</SelectItem>
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