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

const formatDateRange = (checkIn: string, checkOut: string) => {
  try {
    const checkInDate = format(new Date(checkIn), 'dd/MM', { locale: ptBR });
    const checkOutDate = format(new Date(checkOut), 'dd/MM/yy', { locale: ptBR });
    return `${checkInDate} - ${checkOutDate}`;
  } catch {
    return `${checkIn} - ${checkOut}`;
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

export default function ReservationTable({
  reservations,
  loading = false,
  onView,
  onEdit,
  onQuickAction,
  actionLoading = {},
}: ReservationTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'check_in_date',
    direction: 'desc',
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedReservations = () => {
    if (!reservations.length) return [];

    return [...reservations].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'guest_name':
          aValue = (a.guest_name || '').toLowerCase();
          bValue = (b.guest_name || '').toLowerCase();
          break;
        case 'check_in_date':
          aValue = new Date(a.check_in_date).getTime();
          bValue = new Date(b.check_in_date).getTime();
          break;
        case 'check_out_date':
          aValue = new Date(a.check_out_date).getTime();
          bValue = new Date(b.check_out_date).getTime();
          break;
        case 'total_guests':
          aValue = a.total_guests || 0;
          bValue = b.total_guests || 0;
          break;
        case 'total_amount':
          aValue = parseFloat(a.total_amount.toString()) || 0;
          bValue = parseFloat(b.total_amount.toString()) || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'property_name':
          aValue = (a.property_name || '').toLowerCase();
          bValue = (b.property_name || '').toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'paid_amount':
          aValue = parseFloat(a.paid_amount.toString()) || 0;
          bValue = parseFloat(b.paid_amount.toString()) || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortButton = ({ columnKey, children }: { columnKey: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(columnKey)}
      className="h-auto p-0 font-semibold hover:bg-transparent hover:text-blue-600"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortConfig.key === columnKey ? (
          sortConfig.direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </Button>
  );

  const getQuickActions = (reservation: ReservationResponseWithGuestDetails) => {
    const actions = [];

    if (reservation.status === 'pending') {
      actions.push({
        key: 'confirm',
        label: 'Confirmar',
        icon: CheckCircle,
        color: 'text-green-600',
      });
    }

    if (reservation.can_check_in) {
      actions.push({
        key: 'check-in',
        label: 'Check-in',
        icon: LogIn,
        color: 'text-blue-600',
      });
    }

    if (reservation.can_check_out) {
      actions.push({
        key: 'check-out',
        label: 'Check-out',
        icon: LogOut,
        color: 'text-purple-600',
      });
    }

    if (reservation.can_cancel) {
      actions.push({
        key: 'cancel',
        label: 'Cancelar',
        icon: XCircle,
        color: 'text-red-600',
      });
    }

    return actions;
  };

  const sortedReservations = getSortedReservations();

  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sortedReservations.length) {
    return (
      <div className="border rounded-lg bg-white">
        <div className="p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma reserva encontrada
          </h3>
          <p className="text-gray-600">
            Não há reservas que correspondam aos filtros aplicados.
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
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="guest_name">Hóspede</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Contato
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="check_in_date">Período</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                <SortButton columnKey="total_guests">Hóspedes</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="property_name">Propriedade</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                <SortButton columnKey="status">Status</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">
                <SortButton columnKey="total_amount">Valor</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">
                <SortButton columnKey="paid_amount">Pago</SortButton>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-center">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReservations.map((reservation) => {
              const statusInfo = statusConfig[reservation.status as keyof typeof statusConfig] || statusConfig.pending;
              const nights = calculateNights(reservation.check_in_date, reservation.check_out_date);
              const quickActions = getQuickActions(reservation);
              const isLoading = actionLoading[reservation.id];

              return (
                <TableRow
                  key={reservation.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  {/* Hóspede */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">
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

                  {/* Período */}
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span>
                          {formatDateRange(reservation.check_in_date, reservation.check_out_date)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {nights} {nights === 1 ? 'noite' : 'noites'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Hóspedes */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{reservation.total_guests}</span>
                    </div>
                  </TableCell>

                  {/* Propriedade */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3 text-gray-400" />
                      <span className="font-medium text-sm">
                        {reservation.property_name || 'N/A'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium border px-2 py-1',
                        statusInfo.color
                      )}
                    >
                      {statusInfo.label}
                    </Badge>
                  </TableCell>

                  {/* Valor Total */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-gray-400" />
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(reservation.total_amount.toString()))}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Valor Pago */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-gray-400" />
                        <span className="font-medium text-green-600">
                          {formatCurrency(parseFloat(reservation.paid_amount.toString()))}
                        </span>
                      </div>
                      {reservation.balance_due && parseFloat(reservation.balance_due.toString()) > 0 && (
                        <span className="text-xs text-red-500">
                          Saldo: {formatCurrency(parseFloat(reservation.balance_due.toString()))}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={!!isLoading}
                        >
                          {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(reservation)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                        )}
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(reservation)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {quickActions.length > 0 && <div className="border-t my-1" />}
                        {quickActions.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            onClick={() => onQuickAction?.(reservation, action.key)}
                            className={action.color}
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
    </div>
  );
}