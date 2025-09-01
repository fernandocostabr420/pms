// frontend/src/components/room-map/ReservationQuickView.tsx

import React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Users,
  Eye,
  Edit,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserCheck,
  LogOut
} from 'lucide-react';
import { MapReservationResponse, MapRoomData } from '@/types/room-map';
import { cn } from '@/lib/utils';

interface ReservationQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: MapReservationResponse | null;
  room: MapRoomData | null;
}

export function ReservationQuickView({
  isOpen,
  onClose,
  reservation,
  room
}: ReservationQuickViewProps) {
  const router = useRouter();

  if (!reservation || !room) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        label: 'Pendente',
        variant: 'outline' as const,
        className: 'border-yellow-300 text-yellow-700 bg-yellow-50',
        icon: Clock
      },
      confirmed: {
        label: 'Confirmada',
        variant: 'outline' as const,
        className: 'border-blue-300 text-blue-700 bg-blue-50',
        icon: CheckCircle2
      },
      checked_in: {
        label: 'Check-in Realizado',
        variant: 'outline' as const,
        className: 'border-green-300 text-green-700 bg-green-50',
        icon: UserCheck
      },
      checked_out: {
        label: 'Check-out Realizado',
        variant: 'outline' as const,
        className: 'border-gray-300 text-gray-700 bg-gray-50',
        icon: LogOut
      },
      cancelled: {
        label: 'Cancelada',
        variant: 'outline' as const,
        className: 'border-red-300 text-red-700 bg-red-50',
        icon: XCircle
      },
      no_show: {
        label: 'No Show',
        variant: 'outline' as const,
        className: 'border-orange-300 text-orange-700 bg-orange-50',
        icon: AlertCircle
      }
    };

    return configs[status as keyof typeof configs] || configs.pending;
  };

  const statusConfig = getStatusConfig(reservation.status);
  const StatusIcon = statusConfig.icon;

  const handleViewDetails = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}`);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}?edit=true`);
  };

  const balanceColor = reservation.balance_due > 0 ? 'text-red-600' : 'text-green-600';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {reservation.guest_name}
                </h2>
                <p className="text-sm text-gray-500 font-mono">
                  {reservation.reservation_number}
                </p>
              </div>
            </div>
            <Badge 
              variant={statusConfig.variant}
              className={cn("gap-1.5", statusConfig.className)}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Datas e Duração */}
          <div className="bg-gray-50 rounded-lg p-3 reservation-info-block">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Período</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium">
                  {format(new Date(reservation.check_in_date + 'T00:00:00'), 'dd/MM/yyyy (E)', { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-out:</span>
                <span className="font-medium">
                  {format(new Date(reservation.check_out_date + 'T00:00:00'), 'dd/MM/yyyy (E)', { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duração:</span>
                <span className="font-medium">
                  {reservation.nights} {reservation.nights === 1 ? 'noite' : 'noites'}
                </span>
              </div>
            </div>
          </div>

          {/* Quarto e Hóspedes */}
          <div className="grid grid-cols-2 gap-3 reservation-info-grid">
            <div className="bg-blue-50 rounded-lg p-3 reservation-info-block">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Quarto</span>
              </div>
              <p className="text-sm font-semibold text-blue-800">
                {room.room_number}
              </p>
              <p className="text-xs text-blue-600">
                {room.name}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-3 reservation-info-block">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Hóspedes</span>
              </div>
              <p className="text-sm font-semibold text-green-800">
                {reservation.total_guests} pessoa{reservation.total_guests !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Valores */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Financeiro</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">
                  {formatCurrency(Number(reservation.total_amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pago:</span>
                <span className="font-medium">
                  {formatCurrency(Number(reservation.paid_amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Saldo:</span>
                <span className={cn("font-medium", balanceColor)}>
                  {formatCurrency(Number(reservation.balance_due))}
                </span>
              </div>
            </div>
          </div>

          {/* Contato (se disponível) */}
          {reservation.guest_email && (
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Contato</span>
              </div>
              <p className="text-sm text-purple-800 truncate">
                {reservation.guest_email}
              </p>
            </div>
          )}

          {/* Indicadores de Chegada/Partida */}
          {(reservation.is_arrival || reservation.is_departure) && (
            <div className="flex gap-2">
              {reservation.is_arrival && (
                <div className="flex-1 arrival-indicator rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs font-medium text-green-800">
                      Chegada Hoje
                    </span>
                  </div>
                </div>
              )}
              {reservation.is_departure && (
                <div className="flex-1 departure-indicator rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-medium text-red-800">
                      Partida Hoje
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          {reservation.notes && (
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Observações</span>
              </div>
              <p className="text-sm text-yellow-800 line-clamp-2">
                {reservation.notes}
              </p>
            </div>
          )}

          {/* Canal de Origem */}
          {reservation.source && (
            <div className="text-center">
              <Badge variant="secondary" className="text-xs">
                Canal: {reservation.source}
              </Badge>
            </div>
          )}

          <Separator />

          {/* Botões de Ação */}
          <div className="flex gap-2 reservation-action-buttons">
            <Button
              onClick={handleViewDetails}
              className="flex-1 gap-2 reservation-action-button"
              variant="default"
            >
              <Eye className="h-4 w-4" />
              Ver Detalhes
            </Button>
            <Button
              onClick={handleEdit}
              className="flex-1 gap-2 reservation-action-button"
              variant="outline"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}