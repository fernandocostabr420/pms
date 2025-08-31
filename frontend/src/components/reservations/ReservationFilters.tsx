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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  Building,
  User,
  DollarSign,
  Mail,
  FileText,
  RefreshCw
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

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'checked_in', label: 'Check-in Realizado' },
  { value: 'checked_out', label: 'Check-out Realizado' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No-show' }
];

const sourceOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'direct', label: 'Direto' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'walk_in', label: 'Walk-in' }
];

const balanceOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'pending', label: 'Pendente' },
  { value: 'partial', label: 'Parcial' },
  { value: 'overdue', label: 'Em atraso' }
];

export default function ReservationFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  loading = false
}: ReservationFiltersProps) {
  const [properties, setProperties] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Estados para os seletores de data
  const [reservationDateFrom, setReservationDateFrom] = useState<Date>();
  const [reservationDateTo, setReservationDateTo] = useState<Date>();
  const [checkInFrom, setCheckInFrom] = useState<Date>();
  const [checkInTo, setCheckInTo] = useState<Date>();
  const [checkOutFrom, setCheckOutFrom] = useState<Date>();
  const [checkOutTo, setCheckOutTo] = useState<Date>();
  const [cancelDateFrom, setCancelDateFrom] = useState<Date>();
  const [cancelDateTo, setCancelDateTo] = useState<Date>();

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
    if (filters.created_from) {
      setReservationDateFrom(new Date(filters.created_from));
    }
    if (filters.created_to) {
      setReservationDateTo(new Date(filters.created_to));
    }
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
      case 'reservation_from':
        setReservationDateFrom(date);
        handleFilterChange('created_from', dateStr);
        break;
      case 'reservation_to':
        setReservationDateTo(date);
        handleFilterChange('created_to', dateStr);
        break;
      case 'checkin_from':
        setCheckInFrom(date);
        handleFilterChange('check_in_from', dateStr);
        break;
      case 'checkin_to':
        setCheckInTo(date);
        handleFilterChange('check_in_to', dateStr);
        break;
      case 'checkout_from':
        setCheckOutFrom(date);
        handleFilterChange('check_out_from', dateStr);
        break;
      case 'checkout_to':
        setCheckOutTo(date);
        handleFilterChange('check_out_to', dateStr);
        break;
      case 'cancel_from':
        setCancelDateFrom(date);
        // Adicionar campo no schema se necessário
        break;
      case 'cancel_to':
        setCancelDateTo(date);
        // Adicionar campo no schema se necessário
        break;
    }
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== null && value !== undefined && value !== '' && value !== 'all'
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Filtros de Busca
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Filtros Principais - Primeira linha */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca Textual */}
          <div className="lg:col-span-2">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Número da reserva, nome, e-mail..."
                className="pl-10"
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Status */}
          <div>
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

          {/* Propriedade */}
          <div>
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
        </div>

        {/* Filtros de Data - Segunda linha */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data da Reserva */}
          <div className="space-y-2">
            <Label>Data da Reserva</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !reservationDateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {reservationDateFrom ? format(reservationDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reservationDateFrom}
                    onSelect={(date) => handleDateChange('reservation_from', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !reservationDateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {reservationDateTo ? format(reservationDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reservationDateTo}
                    onSelect={(date) => handleDateChange('reservation_to', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Check-in */}
          <div className="space-y-2">
            <Label>Check-in</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkInFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {checkInFrom ? format(checkInFrom, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInFrom}
                    onSelect={(date) => handleDateChange('checkin_from', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkInTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {checkInTo ? format(checkInTo, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInTo}
                    onSelect={(date) => handleDateChange('checkin_to', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Check-out */}
          <div className="space-y-2">
            <Label>Check-out</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkOutFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {checkOutFrom ? format(checkOutFrom, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutFrom}
                    onSelect={(date) => handleDateChange('checkout_from', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkOutTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {checkOutTo ? format(checkOutTo, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutTo}
                    onSelect={(date) => handleDateChange('checkout_to', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Canal/Origem */}
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
        </div>

        {/* Filtros Avançados */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* E-mail */}
              <div>
                <Label htmlFor="email">E-mail do Hóspede</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    placeholder="email@exemplo.com"
                    className="pl-10"
                    value={filters.guest_email || ''}
                    onChange={(e) => handleFilterChange('guest_email', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Saldo */}
              <div>
                <Label>Status do Pagamento</Label>
                <Select
                  value={filters.is_paid === true ? 'paid' : filters.is_paid === false ? 'pending' : 'all'}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      handleFilterChange('is_paid', undefined);
                    } else {
                      handleFilterChange('is_paid', value === 'paid');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Saldo" />
                  </SelectTrigger>
                  <SelectContent>
                    {balanceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor Mínimo */}
              <div>
                <Label htmlFor="min_amount">Valor Mínimo (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="min_amount"
                    type="number"
                    placeholder="0,00"
                    className="pl-10"
                    value={filters.min_amount || ''}
                    onChange={(e) => handleFilterChange('min_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Segunda linha de filtros avançados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Valor Máximo */}
              <div>
                <Label htmlFor="max_amount">Valor Máximo (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="max_amount"
                    type="number"
                    placeholder="0,00"
                    className="pl-10"
                    value={filters.max_amount || ''}
                    onChange={(e) => handleFilterChange('max_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Reserva em Grupo */}
              <div>
                <Label>Tipo de Reserva</Label>
                <Select
                  value={filters.is_group_reservation === true ? 'group' : filters.is_group_reservation === false ? 'individual' : 'all'}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      handleFilterChange('is_group_reservation', undefined);
                    } else {
                      handleFilterChange('is_group_reservation', value === 'group');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="group">Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Cancelamento */}
              <div className="space-y-2">
                <Label>Data de Cancelamento</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal text-xs",
                          !cancelDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {cancelDateFrom ? format(cancelDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={cancelDateFrom}
                        onSelect={(date) => handleDateChange('cancel_from', date)}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal text-xs",
                          !cancelDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {cancelDateTo ? format(cancelDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={cancelDateTo}
                        onSelect={(date) => handleDateChange('cancel_to', date)}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={loading}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showAdvanced ? 'Menos' : 'Mais'} Filtros
          </Button>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={onClearFilters}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Exportar CSV
          </Button>

          <div className="ml-auto text-sm text-gray-500">
            {hasActiveFilters && (
              <span>{Object.values(filters).filter(v => v !== null && v !== undefined && v !== '' && v !== 'all').length} filtros ativos</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}