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

  const statusOptions = [
    { value: '', label: 'Todos os Status' },
    { value: 'pending', label: 'Pendente' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'checked_in', label: 'Check-in Feito' },
    { value: 'checked_out', label: 'Check-out Feito' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'no_show', label: 'No-show' },
  ];

  const sourceOptions = [
    { value: '', label: 'Todos os Canais' },
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
                value={filters.status || ''}
                onValueChange={(value) => handleFilterChange('status', value)}
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
                value={filters.property_id?.toString() || ''}
                onValueChange={(value) => handleFilterChange('property_id', value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Propriedade" />
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

            {/* Advanced Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(showAdvanced && "bg-blue-50 border-blue-200")}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros Avançados
            </Button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={onClearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="border-t pt-4 space-y-4">
              {/* Date Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Check-in From */}
                <div>
                  <Label>Check-in A Partir De</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkInFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkInFrom ? format(checkInFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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
                </div>

                {/* Check-in To */}
                <div>
                  <Label>Check-in Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkInTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkInTo ? format(checkInTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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

                {/* Check-out From */}
                <div>
                  <Label>Check-out A Partir De</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkOutFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOutFrom ? format(checkOutFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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
                </div>

                {/* Check-out To */}
                <div>
                  <Label>Check-out Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkOutTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOutTo ? format(checkOutTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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

              {/* Additional Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Source */}
                <div>
                  <Label>Canal</Label>
                  <Select
                    value={filters.source || ''}
                    onValueChange={(value) => handleFilterChange('source', value)}
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
                    value={filters.is_paid?.toString() || ''}
                    onValueChange={(value) => handleFilterChange('is_paid', value ? value === 'true' : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="true">Pago</SelectItem>
                      <SelectItem value="false">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Group Reservation */}
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={filters.is_group_reservation?.toString() || ''}
                    onValueChange={(value) => handleFilterChange('is_group_reservation', value ? value === 'true' : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
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