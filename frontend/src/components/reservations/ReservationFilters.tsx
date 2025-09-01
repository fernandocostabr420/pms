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
  RefreshCw,
  Check
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
  { value: 'booking.com', label: 'Booking.com' },
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
  
  // 🎯 ESTADO LOCAL - Não dispara busca automaticamente
  const [localFilters, setLocalFilters] = useState<ReservationFilters>(filters);
  
  // Estados para os seletores de data (locais)
  const [reservationDateFrom, setReservationDateFrom] = useState<Date>();
  const [reservationDateTo, setReservationDateTo] = useState<Date>();
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

  // Sincronizar estado local com filtros recebidos (apenas quando filters externos mudam)
  useEffect(() => {
    setLocalFilters(filters);
    
    // Sincronizar datas
    if (filters.created_from) {
      // created_from pode vir como datetime, extrair apenas a data
      const dateOnly = filters.created_from.split('T')[0];
      setReservationDateFrom(new Date(dateOnly));
    } else {
      setReservationDateFrom(undefined);
    }
    
    if (filters.created_to) {
      // created_to pode vir como datetime, extrair apenas a data
      const dateOnly = filters.created_to.split('T')[0];
      setReservationDateTo(new Date(dateOnly));
    } else {
      setReservationDateTo(undefined);
    }
    
    if (filters.check_in_from) {
      setCheckInFrom(new Date(filters.check_in_from));
    } else {
      setCheckInFrom(undefined);
    }
    
    if (filters.check_in_to) {
      setCheckInTo(new Date(filters.check_in_to));
    } else {
      setCheckInTo(undefined);
    }
    
    if (filters.check_out_from) {
      setCheckOutFrom(new Date(filters.check_out_from));
    } else {
      setCheckOutFrom(undefined);
    }
    
    if (filters.check_out_to) {
      setCheckOutTo(new Date(filters.check_out_to));
    } else {
      setCheckOutTo(undefined);
    }
  }, [filters]);

  // 🔄 Função para atualizar filtros LOCAIS (não dispara busca)
  const handleLocalFilterChange = (key: keyof ReservationFilters, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 📅 Função para mudanças de data (atualiza estado local)
  const handleDateChange = (key: string, date: Date | undefined) => {
    let dateStr: string | undefined;
    
    // Para created_from e created_to, usar formato datetime
    // Para as outras datas, usar formato date
    if (key === 'reservation_from' || key === 'reservation_to') {
      if (date) {
        // Para datas de criação, enviar como datetime
        dateStr = key === 'reservation_from' 
          ? format(date, 'yyyy-MM-dd') + 'T00:00:00'  // Início do dia
          : format(date, 'yyyy-MM-dd') + 'T23:59:59'; // Final do dia
      }
    } else {
      // Para check-in e check-out, usar formato date normal
      dateStr = date ? format(date, 'yyyy-MM-dd') : undefined;
    }
    
    switch (key) {
      case 'reservation_from':
        setReservationDateFrom(date);
        handleLocalFilterChange('created_from', dateStr);
        break;
      case 'reservation_to':
        setReservationDateTo(date);
        handleLocalFilterChange('created_to', dateStr);
        break;
      case 'checkin_from':
        setCheckInFrom(date);
        handleLocalFilterChange('check_in_from', dateStr);
        break;
      case 'checkin_to':
        setCheckInTo(date);
        handleLocalFilterChange('check_in_to', dateStr);
        break;
      case 'checkout_from':
        setCheckOutFrom(date);
        handleLocalFilterChange('check_out_from', dateStr);
        break;
      case 'checkout_to':
        setCheckOutTo(date);
        handleLocalFilterChange('check_out_to', dateStr);
        break;
    }
  };

  // ✅ APLICAR FILTROS - Única função que dispara a busca
  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  // 🧹 LIMPAR FILTROS 
  const clearFilters = () => {
    const emptyFilters: ReservationFilters = {
      status: undefined,
      source: undefined,
      property_id: undefined,
      guest_id: undefined,
      check_in_from: undefined,
      check_in_to: undefined,
      check_out_from: undefined,
      check_out_to: undefined,
      created_from: undefined,
      created_to: undefined,
      search: undefined,
      guest_email: undefined,
      min_amount: undefined,
      max_amount: undefined,
      is_paid: undefined,
      requires_deposit: undefined,
      is_group_reservation: undefined,
    };
    
    setLocalFilters(emptyFilters);
    setReservationDateFrom(undefined);
    setReservationDateTo(undefined);
    setCheckInFrom(undefined);
    setCheckInTo(undefined);
    setCheckOutFrom(undefined);
    setCheckOutTo(undefined);
    
    onClearFilters();
  };

  // 🔍 Verificar se há filtros ativos (comparando local com aplicado)
  const hasUnappliedChanges = JSON.stringify(localFilters) !== JSON.stringify(filters);
  const hasActiveFilters = Object.values(localFilters).some(value => 
    value !== null && value !== undefined && value !== '' && value !== 'all'
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtros de Busca
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {Object.values(localFilters).filter(v => v && v !== 'all').length}
              </span>
            )}
          </CardTitle>
          
          {/* Indicador de mudanças não aplicadas */}
          {hasUnappliedChanges && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              Filtros modificados
            </div>
          )}
        </div>
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
                value={localFilters.search || ''}
                onChange={(e) => handleLocalFilterChange('search', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select
              value={localFilters.status || 'all'}
              onValueChange={(value) => handleLocalFilterChange('status', value === 'all' ? undefined : value)}
              disabled={loading}
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
              value={localFilters.property_id?.toString() || 'all'}
              onValueChange={(value) => handleLocalFilterChange('property_id', value === 'all' ? undefined : parseInt(value))}
              disabled={loading}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    disabled={loading}
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
                    disabled={loading}
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

          {/* Data Check-in */}
          <div className="space-y-2">
            <Label>Data Check-in</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkInFrom && "text-muted-foreground"
                    )}
                    disabled={loading}
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
                    disabled={loading}
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

          {/* Data Check-out */}
          <div className="space-y-2">
            <Label>Data Check-out</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal text-xs",
                      !checkOutFrom && "text-muted-foreground"
                    )}
                    disabled={loading}
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
                      !checkOutTo && "text-muted-foregreen"
                    )}
                    disabled={loading}
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
        </div>

        {/* Filtros Avançados */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Canal/Origem */}
              <div>
                <Label>Canal</Label>
                <Select
                  value={localFilters.source || 'all'}
                  onValueChange={(value) => handleLocalFilterChange('source', value === 'all' ? undefined : value)}
                  disabled={loading}
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

              {/* E-mail do Hóspede */}
              <div>
                <Label htmlFor="guest-email">E-mail do Hóspede</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="guest-email"
                    placeholder="email@exemplo.com"
                    className="pl-10"
                    value={localFilters.guest_email || ''}
                    onChange={(e) => handleLocalFilterChange('guest_email', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Valor Mínimo */}
              <div>
                <Label htmlFor="min-amount">Valor Mínimo</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="min-amount"
                    type="number"
                    placeholder="0,00"
                    className="pl-10"
                    value={localFilters.min_amount || ''}
                    onChange={(e) => handleLocalFilterChange('min_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Valor Máximo */}
              <div>
                <Label htmlFor="max-amount">Valor Máximo</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="max-amount"
                    type="number"
                    placeholder="0,00"
                    className="pl-10"
                    value={localFilters.max_amount || ''}
                    onChange={(e) => handleLocalFilterChange('max_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={loading}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Filtros Básicos' : 'Filtros Avançados'}
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={clearFilters}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Botão Principal - APLICAR */}
          <div className="flex items-center gap-3">
            {hasUnappliedChanges && (
              <span className="text-sm text-gray-600">
                Clique em "Aplicar" para buscar
              </span>
            )}
            
            <Button
              onClick={applyFilters}
              disabled={loading}
              className={cn(
                "min-w-[120px]",
                hasUnappliedChanges && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}