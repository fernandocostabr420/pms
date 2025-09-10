// frontend/src/components/reservations/ReservationTable.tsx - CORRIGIDO PARA MAPEAMENTOS

'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  LogIn,
  LogOut,
  XCircle,
  Phone,
  Mail,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  Globe,
  Home,
  Hash,
  BedDouble,
  CalendarCheck,
  CalendarX,
  Clock,
  Building2,
  Map,
  Settings,
  UserPlus,
  MessageSquare,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReservationResponseWithGuestDetails } from '@/types/reservation';
import { formatReservationDate } from '@/lib/calendar-utils';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface ReservationTableProps {
  reservations: ReservationResponseWithGuestDetails[];
  loading?: boolean;
  onView?: (reservation: ReservationResponseWithGuestDetails) => void;
  onEdit?: (reservation: ReservationResponseWithGuestDetails) => void;
  onQuickAction?: (reservation: ReservationResponseWithGuestDetails, action: string) => void;
  onReservationClick?: (reservation: ReservationResponseWithGuestDetails) => void;
  actionLoading?: { [key: number]: string | null };
}

// ✅ CORRIGIDO: Mapeamento completo de status (sincronizado com backend)
const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  checked_in: { label: 'Check-in', color: 'bg-green-100 text-green-800 border-green-200' },
  checked_out: { label: 'Check-out', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200' },
  no_show: { label: 'No-show', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  // ✅ NOVO: Status para reservas externas não confirmadas
  booking: { label: 'Reserva Externa', color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

// ✅ CORRIGIDO: Mapeamento completo de origens (sincronizado com backend)
const sourceConfig = {
  // Canais diretos
  direct: { label: 'Reserva Direta', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Building2 },
  direct_booking: { label: 'Reserva Direta', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Building2 },
  website: { label: 'Site Próprio', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe },
  phone: { label: 'Telefone', color: 'bg-green-100 text-green-800 border-green-200', icon: Phone },
  email: { label: 'Email', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Mail },
  walk_in: { label: 'Walk-in', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Home },
  
  // OTAs principais
  booking: { label: 'Booking.com', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe },
  'booking.com': { label: 'Booking.com', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe },
  airbnb: { label: 'Airbnb', color: 'bg-red-100 text-red-800 border-red-200', icon: Globe },
  expedia: { label: 'Expedia', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Globe },
  'hotels.com': { label: 'Hotels.com', color: 'bg-red-100 text-red-800 border-red-200', icon: Globe },
  agoda: { label: 'Agoda', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Globe },
  despegar: { label: 'Despegar', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Globe },
  trivago: { label: 'Trivago', color: 'bg-green-100 text-green-800 border-green-200', icon: Globe },
  
  // ✅ NOVOS: Canais internos do sistema
  room_map: { label: 'Mapa de Quartos', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Map },
  dashboard: { label: 'Dashboard', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Settings },
  admin: { label: 'Administração', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Settings },
  
  // Outros canais
  agent: { label: 'Agente/Operadora', color: 'bg-teal-100 text-teal-800 border-teal-200', icon: UserPlus },
  social_media: { label: 'Redes Sociais', color: 'bg-pink-100 text-pink-800 border-pink-200', icon: Share2 },
  referral: { label: 'Indicação', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: Users },
  corporate: { label: 'Corporativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Building2 },
  group: { label: 'Grupo', color: 'bg-violet-100 text-violet-800 border-violet-200', icon: Users },
};

// ✅ FUNÇÃO HELPER PARA FALLBACK DE STATUS
const getStatusDisplay = (status: string) => {
  const config = statusConfig[status as keyof typeof statusConfig];
  if (config) {
    return config;
  }
  
  // Fallback para status não mapeados
  return {
    label: status.replace('_', ' ').toUpperCase(),
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  };
};

// ✅ FUNÇÃO HELPER PARA FALLBACK DE ORIGEM
const getSourceDisplay = (source: string) => {
  if (!source) {
    return {
      label: 'Não Informado',
      color: 'bg-gray-100 text-gray-500 border-gray-200',
      icon: Globe
    };
  }
  
  // Tentar encontrar configuração exata
  const config = sourceConfig[source as keyof typeof sourceConfig];
  if (config) {
    return config;
  }
  
  // Tentar buscar por aliases comuns
  const lowerSource = source.toLowerCase();
  const aliases: { [key: string]: keyof typeof sourceConfig } = {
    'booking.com': 'booking',
    'bookingcom': 'booking',
    'room_map': 'room_map',
    'roommap': 'room_map',
    'mapa_quartos': 'room_map',
    'direct_booking': 'direct',
    'direto': 'direct',
    'telefone': 'phone',
    'e-mail': 'email',
    'walk-in': 'walk_in',
    'walkin': 'walk_in',
  };
  
  const aliasKey = aliases[lowerSource];
  if (aliasKey && sourceConfig[aliasKey]) {
    return sourceConfig[aliasKey];
  }
  
  // Fallback para origens não mapeadas
  return {
    label: source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: Globe
  };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatCreatedDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateString;
  }
};

const formatShortDate = (dateString: string) => {
  try {
    return format(new Date(dateString), 'dd/MM/yy', { locale: ptBR });
  } catch {
    return dateString;
  }
};

const calculateNights = (checkIn: string, checkOut: string) => {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
};

const formatRooms = (rooms: any[] | undefined) => {
  if (!rooms || rooms.length === 0) {
    return { display: 'N/A', count: 0 };
  }

  if (rooms.length === 1) {
    const room = rooms[0];
    const roomNumber = room.room_number || 'N/A';
    const roomType = room.room_type_name || '';
    return {
      display: roomType ? `${roomNumber} - ${roomType}` : roomNumber,
      count: 1,
    };
  }

  const roomNumbers = rooms.map(r => r.room_number || 'N/A').join(', ');
  return {
    display: `${rooms.length} quartos (${roomNumbers})`,
    count: rooms.length,
  };
};

const getQuickActions = (reservation: ReservationResponseWithGuestDetails) => {
  const actions: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
  }> = [];

  if (reservation.status === 'pending') {
    actions.push({
      key: 'confirm',
      label: 'Confirmar',
      icon: CheckCircle,
    });
  }

  if (reservation.status === 'confirmed') {
    actions.push({
      key: 'checkin',
      label: 'Check-in',
      icon: LogIn,
    });
  }

  if (reservation.status === 'checked_in') {
    actions.push({
      key: 'checkout',
      label: 'Check-out',
      icon: LogOut,
    });
  }

  // ✅ CORRIGIDO: Incluir status "booking" nas ações disponíveis
  if (['pending', 'confirmed', 'booking'].includes(reservation.status)) {
    actions.push({
      key: 'cancel',
      label: 'Cancelar',
      icon: XCircle,
      variant: 'destructive',
    });
  }

  return actions;
};

const compareValues = (a: any, b: any, direction: 'asc' | 'desc') => {
  const valueA = a === null || a === undefined ? '' : a;
  const valueB = b === null || b === undefined ? '' : b;
  
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    return direction === 'asc' ? valueA - valueB : valueB - valueA;
  }
  
  if (valueA instanceof Date && valueB instanceof Date) {
    return direction === 'asc' ? valueA.getTime() - valueB.getTime() : valueB.getTime() - valueA.getTime();
  }
  
  const stringA = String(valueA).toLowerCase();
  const stringB = String(valueB).toLowerCase();
  
  if (direction === 'asc') {
    return stringA.localeCompare(stringB);
  } else {
    return stringB.localeCompare(stringA);
  }
};

const getSortValue = (reservation: ReservationResponseWithGuestDetails, key: string) => {
  switch (key) {
    case 'id':
      return reservation.id;
    case 'guest_name':
      return reservation.guest_name || '';
    case 'check_in_date':
      return new Date(reservation.check_in_date);
    case 'check_out_date':
      return new Date(reservation.check_out_date);
    case 'total_guests':
      return reservation.total_guests;
    case 'status':
      return reservation.status || '';
    case 'created_date':
      return new Date(reservation.created_date);
    case 'source':
      return reservation.source || '';
    case 'total_amount':
      return reservation.total_amount || 0;
    default:
      return '';
  }
};

export default function ReservationTable({
  reservations,
  loading = false,
  onView,
  onEdit,
  onQuickAction,
  onReservationClick,
  actionLoading = {},
}: ReservationTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'id', direction: 'desc' });

  const sortedReservations = useMemo(() => {
    if (!reservations || reservations.length === 0) return [];
    
    return [...reservations].sort((a, b) => {
      const valueA = getSortValue(a, sortConfig.key);
      const valueB = getSortValue(b, sortConfig.key);
      return compareValues(valueA, valueB, sortConfig.direction);
    });
  }, [reservations, sortConfig]);

  const handleSort = (key: string) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const handleRowClick = (reservation: ReservationResponseWithGuestDetails, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menuitem"]')) {
      return;
    }
    
    onReservationClick?.(reservation);
  };

  const SortButton = ({ children, columnKey }: { children: React.ReactNode; columnKey: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 font-semibold hover:bg-transparent text-sm"
      onClick={() => handleSort(columnKey)}
    >
      {children}
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  if (loading) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Carregando reservas...</span>
        </div>
      </div>
    );
  }

  if (!sortedReservations?.length) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8">
        <div className="text-center text-gray-500">
          <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma reserva encontrada
          </h3>
          <p className="text-sm">
            Não há reservas que correspondam aos filtros selecionados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <Table fixedScroll={true}>
        <TableHeader>
          <TableRow className="bg-gray-50/50 border-b">
            <TableHead className="font-semibold text-gray-700 w-16 px-2 py-2">
              <SortButton columnKey="id">ID</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="guest_name">Hóspede</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              Contato
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="created_date">Data Criação</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="check_in_date">Check In</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="check_out_date">Check Out</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2 text-center">
              <SortButton columnKey="total_guests">Hóspedes</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              Quarto(s)
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="status">Status</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="source">Origem</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              <SortButton columnKey="total_amount">Valor</SortButton>
            </TableHead>
            <TableHead className="font-semibold text-gray-700 px-2 py-2">
              Pagamento
            </TableHead>
            <TableHead className="font-semibold text-gray-700 w-16 px-2 py-2">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedReservations.map((reservation) => {
            const nights = calculateNights(reservation.check_in_date, reservation.check_out_date);
            const rooms = formatRooms(reservation.rooms);
            
            // ✅ USAR FUNÇÕES DE FALLBACK
            const statusDisplay = getStatusDisplay(reservation.status);
            const sourceDisplay = getSourceDisplay(reservation.source);
            
            const quickActions = getQuickActions(reservation);
            
            return (
              <TableRow 
                key={reservation.id} 
                className="hover:bg-gray-50/50 transition-colors cursor-pointer border-b"
                onClick={(e) => handleRowClick(reservation, e)}
              >
                <TableCell className="px-2 py-3 font-mono text-sm text-gray-600">
                  <div className="flex items-center">
                    <Hash className="h-3 w-3 mr-1 text-gray-400" />
                    {reservation.id}
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="font-medium text-gray-900">
                    {reservation.guest_name || 'N/A'}
                  </div>
                  {reservation.guest_email && (
                    <div className="text-sm text-gray-500 truncate max-w-[160px]">
                      {reservation.guest_email}
                    </div>
                  )}
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex flex-col space-y-1">
                    {reservation.guest_phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-3 w-3 mr-1" />
                        {reservation.guest_phone}
                      </div>
                    )}
                    {reservation.guest_email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-3 w-3 mr-1" />
                        <span className="truncate max-w-[120px]">{reservation.guest_email}</span>
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    {formatCreatedDate(reservation.created_date)}
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex items-center text-sm">
                    <CalendarCheck className="h-4 w-4 mr-2 text-green-600" />
                    <div>
                      <div className="font-medium">{formatReservationDate(reservation.check_in_date)}</div>
                      <div className="text-xs text-gray-500">{formatShortDate(reservation.check_in_date)}</div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex items-center text-sm">
                    <CalendarX className="h-4 w-4 mr-2 text-red-600" />
                    <div>
                      <div className="font-medium">{formatReservationDate(reservation.check_out_date)}</div>
                      <div className="text-xs text-gray-500">
                        {nights} {nights === 1 ? 'Diária' : 'Diárias'}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <Users className="h-4 w-4 mr-1 text-gray-500" />
                    <span className="font-medium">{reservation.total_guests}</span>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex items-center">
                    <BedDouble className="h-4 w-4 mr-2 text-gray-500" />
                    <div className="text-sm">
                      <div className="font-medium">{rooms.display}</div>
                      {rooms.count > 1 && (
                        <div className="text-xs text-gray-500">{rooms.count} quartos</div>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs font-medium border", statusDisplay.color)}
                  >
                    {statusDisplay.label}
                  </Badge>
                </TableCell>

                <TableCell className="px-2 py-3">
                  {/* ✅ USAR sourceDisplay COM FALLBACK */}
                  <div className="flex items-center">
                    <sourceDisplay.icon className="h-4 w-4 mr-2 text-gray-500" />
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs font-medium border", sourceDisplay.color)}
                    >
                      {sourceDisplay.label}
                    </Badge>
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex items-center font-medium">
                    <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                    {formatCurrency(reservation.total_amount || 0)}
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <div className="flex flex-col space-y-1">
                    {reservation.is_paid ? (
                      <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Pago
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                    {reservation.requires_deposit && (
                      <div className="text-xs text-gray-500">Requer depósito</div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-2 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        disabled={actionLoading[reservation.id] !== undefined}
                      >
                        {actionLoading[reservation.id] ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => onView?.(reservation)}
                        className="cursor-pointer"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEdit?.(reservation)}
                        className="cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      
                      {quickActions.map((action) => (
                        <DropdownMenuItem
                          key={action.key}
                          onClick={() => onQuickAction?.(reservation, action.key)}
                          className={cn(
                            "cursor-pointer",
                            action.variant === 'destructive' && "text-red-600 focus:text-red-600"
                          )}
                          disabled={action.disabled}
                        >
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}