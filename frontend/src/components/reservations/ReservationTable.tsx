// frontend/src/components/reservations/ReservationTable.tsx

'use client';

import { useState } from 'react';
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
  Building,
  DollarSign,
  CreditCard,
  Globe,
  Home,
  Hash,
  BedDouble,
  CalendarCheck,
  CalendarX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReservationResponseWithGuestDetails } from '@/types/reservation';

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
  actionLoading?: { [key: number]: string | null };
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  checked_in: { label: 'Check-in', color: 'bg-green-100 text-green-800 border-green-200' },
  checked_out: { label: 'Check-out', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200' },
  no_show: { label: 'No-show', color: 'bg-orange-100 text-orange-800 border-orange-200' },
};

const sourceConfig = {
  direct: { label: 'Direta', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Home },
  'booking.com': { label: 'Booking', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe },
  airbnb: { label: 'Airbnb', color: 'bg-red-100 text-red-800 border-red-200', icon: Globe },
  expedia: { label: 'Expedia', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Globe },
  agoda: { label: 'Agoda', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Globe },
  phone: { label: 'Telefone', color: 'bg-green-100 text-green-800 border-green-200', icon: Phone },
  email: { label: 'Email', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Mail },
  website: { label: 'Site', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Globe },
  walk_in: { label: 'Walk-in', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Home },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
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

  if (['pending', 'confirmed'].includes(reservation.status)) {
    actions.push({
      key: 'cancel',
      label: 'Cancelar',
      icon: XCircle,
      variant: 'destructive',
    });
  }

  return actions;
};

export default function ReservationTable({
  reservations,
  loading = false,
  onView,
  onEdit,
  onQuickAction,
  actionLoading = {},
}: ReservationTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'id', direction: 'desc' });

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

  const SortButton = ({ children, columnKey }: { children: React.ReactNode; columnKey: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 font-semibold hover:bg-transparent"
      onClick={() => handleSort(columnKey)}
    >
      {children}
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
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

  if (!reservations?.length) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-8">
        <div className="text-center text-gray-500">
          <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Nenhuma reserva encontrada</h3>
          <p className="text-sm">
            Não há reservas que correspondam aos filtros selecionados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold text-gray-700 w-16">
                <SortButton columnKey="id">ID</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="guest_name">Hóspede</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Contato
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="check_in_date">Check In</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="check_out_date">Check Out</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                <SortButton columnKey="total_guests">Hóspedes</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="property_name">Propriedade</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Quarto(s)
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="status">Status</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="created_date">Data Criação</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="source">Origem</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="total_amount">Valor</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Pagamento
              </TableHead>
              <TableHead className="font-semibold text-gray-700 w-24">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((reservation) => {
              const nights = calculateNights(reservation.check_in_date, reservation.check_out_date);
              const rooms = formatRooms(reservation.rooms);
              const status = statusConfig[reservation.status as keyof typeof statusConfig] || 
                           { label: reservation.status, color: 'bg-gray-100 text-gray-800' };
              const source = sourceConfig[reservation.source as keyof typeof sourceConfig];
              const quickActions = getQuickActions(reservation);
              const isActionLoading = actionLoading[reservation.id];

              return (
                <TableRow key={reservation.id} className="hover:bg-gray-50/50">
                  {/* ID */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3 text-gray-400" />
                      <span>{reservation.id}</span>
                    </div>
                  </TableCell>

                  {/* Hóspede */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {reservation.guest_name || 'N/A'}
                      </span>
                      <span className="text-xs text-gray-500">
                        #{reservation.reservation_number}
                      </span>
                    </div>
                  </TableCell>

                  {/* Contato */}
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      {reservation.guest_email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-32">
                            {reservation.guest_email}
                          </span>
                        </div>
                      )}
                      {reservation.guest_phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{reservation.guest_phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Check In */}
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <CalendarCheck className="h-3 w-3 text-green-600" />
                        <span>{formatShortDate(reservation.check_in_date)}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(reservation.check_in_date), 'EEEE', { locale: ptBR })}
                      </span>
                    </div>
                  </TableCell>

                  {/* Check Out */}
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <CalendarX className="h-3 w-3 text-red-600" />
                        <span>{formatShortDate(reservation.check_out_date)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>{nights} {nights === 1 ? 'noite' : 'noites'}</span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Hóspedes */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{reservation.total_guests}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {reservation.adults}A + {reservation.children}C
                      </span>
                    </div>
                  </TableCell>

                  {/* Propriedade */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3 text-gray-400" />
                      <span className="truncate max-w-32">
                        {reservation.property_name || 'N/A'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Quartos */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <BedDouble className="h-3 w-3 text-gray-400" />
                      <span className="truncate max-w-32" title={rooms.display}>
                        {rooms.display}
                      </span>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', status.color)}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>

                  {/* Data Criação */}
                  <TableCell>
                    <div className="text-sm">
                      {formatShortDate(reservation.created_date)}
                    </div>
                  </TableCell>

                  {/* Origem */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {source ? (
                        <>
                          <source.icon className="h-3 w-3" />
                          <Badge
                            variant="outline"
                            className={cn('text-xs', source.color)}
                          >
                            {source.label}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 capitalize">
                          {reservation.source || 'N/A'}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Valor */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">
                        {formatCurrency(reservation.total_amount)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Pagamento */}
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(reservation.paid_amount || 0)}
                        </span>
                      </div>
                      {(reservation.total_amount - (reservation.paid_amount || 0)) > 0 && (
                        <div className="text-xs text-red-600">
                          Saldo: {formatCurrency(reservation.total_amount - (reservation.paid_amount || 0))}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Ações */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => onView(reservation)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {(onEdit || (onQuickAction && quickActions.length > 0)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={!!isActionLoading}
                            >
                              {isActionLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(reservation)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            
                            {onQuickAction && quickActions.map((action) => {
                              const IconComponent = action.icon;
                              return (
                                <DropdownMenuItem
                                  key={action.key}
                                  onClick={() => onQuickAction(reservation, action.key)}
                                  className={cn(
                                    action.variant === 'destructive' && 'text-red-600 focus:text-red-600'
                                  )}
                                  disabled={action.disabled || !!isActionLoading}
                                >
                                  <IconComponent className="mr-2 h-4 w-4" />
                                  {action.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}