// frontend/src/components/payments/PaymentFilters.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  PaymentFilters as PaymentFiltersType, 
  PaymentStatusEnum, 
  PaymentMethodEnum, 
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS
} from '@/types/payment';
import { ReservationResponse } from '@/types/reservation';
import apiClient from '@/lib/api';

interface PaymentFiltersProps {
  filters: PaymentFiltersType;
  onFiltersChange: (filters: PaymentFiltersType) => void;
  loading?: boolean;
}

export default function PaymentFilters({ 
  filters, 
  onFiltersChange, 
  loading = false 
}: PaymentFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Carregar reservas para o filtro
  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      const response = await apiClient.getReservations({ per_page: 100 });
      setReservations(response.reservations);
    } catch (error) {
      console.error('Erro ao carregar reservas:', error);
    }
  };

  const handleFilterChange = (key: keyof PaymentFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => {
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'boolean') return value;
    return value != null;
  });

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => {
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number') return value > 0;
      if (typeof value === 'boolean') return value;
      return value != null;
    }).length;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {getActiveFiltersCount()}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              disabled={loading}
            >
              {isExpanded ? 'Menos filtros' : 'Mais filtros'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros principais (sempre visíveis) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Número, referência, observações..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                disabled={loading}
                className="pl-8"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={filters.status || 'all'} 
              onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label>Método</Label>
            <Select 
              value={filters.payment_method || 'all'} 
              onValueChange={(value) => handleFilterChange('payment_method', value === 'all' ? undefined : value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os métodos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os métodos</SelectItem>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtros expandidos */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Reserva */}
            <div className="space-y-2">
              <Label>Reserva</Label>
              <Select 
                value={filters.reservation_id?.toString() || 'all'} 
                onValueChange={(value) => handleFilterChange('reservation_id', value === 'all' ? undefined : parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as reservas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as reservas</SelectItem>
                  {reservations.map((reservation) => (
                    <SelectItem key={reservation.id} value={reservation.id.toString()}>
                      #{reservation.reservation_number} - {reservation.guest_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período de Pagamento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.payment_date_from && "text-muted-foreground"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.payment_date_from 
                        ? format(new Date(filters.payment_date_from), 'dd/MM/yyyy', { locale: ptBR })
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.payment_date_from ? new Date(filters.payment_date_from) : undefined}
                      onSelect={(date) => {
                        handleFilterChange('payment_date_from', date ? format(date, 'yyyy-MM-dd') : undefined);
                        setStartDateOpen(false);
                      }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data final</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.payment_date_to && "text-muted-foreground"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.payment_date_to 
                        ? format(new Date(filters.payment_date_to), 'dd/MM/yyyy', { locale: ptBR })
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.payment_date_to ? new Date(filters.payment_date_to) : undefined}
                      onSelect={(date) => {
                        handleFilterChange('payment_date_to', date ? format(date, 'yyyy-MM-dd') : undefined);
                        setEndDateOpen(false);
                      }}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor mínimo (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={filters.min_amount || ''}
                    onChange={(e) => handleFilterChange('min_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor máximo (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={filters.max_amount || ''}
                    onChange={(e) => handleFilterChange('max_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Switches */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_partial"
                  checked={filters.is_partial || false}
                  onCheckedChange={(checked) => handleFilterChange('is_partial', checked || undefined)}
                  disabled={loading}
                />
                <Label htmlFor="is_partial">Apenas parciais</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_refund"
                  checked={filters.is_refund || false}
                  onCheckedChange={(checked) => handleFilterChange('is_refund', checked || undefined)}
                  disabled={loading}
                />
                <Label htmlFor="is_refund">Apenas estornos</Label>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}