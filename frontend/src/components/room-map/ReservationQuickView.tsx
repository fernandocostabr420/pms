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
  LogOut,
  Loader2,
  DollarSign,
  MessageSquare,
  FileText
} from 'lucide-react';
import { MapReservationResponse, MapRoomData } from '@/types/room-map';
import { cn } from '@/lib/utils';
import { useReservationDetails } from '@/hooks/useReservationDetails';

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
  
  const { data: fullReservationData, loading: loadingDetails } = useReservationDetails(
    reservation?.id || 0
  );

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
        className: 'border-amber-200 text-amber-700 bg-amber-50',
        icon: Clock,
        dotColor: 'bg-amber-400'
      },
      confirmed: {
        label: 'Confirmada',
        className: 'border-blue-200 text-blue-700 bg-blue-50',
        icon: CheckCircle2,
        dotColor: 'bg-blue-400'
      },
      checked_in: {
        label: 'Check-in',
        className: 'border-emerald-200 text-emerald-700 bg-emerald-50',
        icon: UserCheck,
        dotColor: 'bg-emerald-400'
      },
      checked_out: {
        label: 'Check-out',
        className: 'border-slate-200 text-slate-700 bg-slate-50',
        icon: LogOut,
        dotColor: 'bg-slate-400'
      },
      cancelled: {
        label: 'Cancelada',
        className: 'border-red-200 text-red-700 bg-red-50',
        icon: XCircle,
        dotColor: 'bg-red-400'
      },
      no_show: {
        label: 'No Show',
        className: 'border-orange-200 text-orange-700 bg-orange-50',
        icon: AlertCircle,
        dotColor: 'bg-orange-400'
      }
    };

    return configs[status as keyof typeof configs] || configs.pending;
  };

  const statusConfig = getStatusConfig(reservation.status);
  const StatusIcon = statusConfig.icon;

  // ✅ HANDLERS - Todos definidos corretamente
  const handleViewDetails = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}`);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}?edit=true`);
  };

  const handleCheckIn = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}?checkin=true`);
  };

  const handleCheckOut = () => {
    onClose();
    router.push(`/dashboard/reservations/${reservation.id}?checkout=true`);
  };

  // Cálculos financeiros
  const totalAmount = Number(reservation.total_amount) || 0;
  const paidAmount = Number(reservation.paid_amount) || 0;
  const balanceDue = Number(reservation.balance_due) || 0;
  
  const calculatedBalance = totalAmount - paidAmount;
  const finalBalanceDue = balanceDue !== 0 ? balanceDue : calculatedBalance;
  const balanceColor = finalBalanceDue > 0 ? 'text-red-600' : finalBalanceDue < 0 ? 'text-green-600' : 'text-slate-600';

  const formatCreatedDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
    } catch {
      return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR });
    }
  };

  const guestPhone = fullReservationData?.guest?.phone;
  const createdDate = fullReservationData?.created_date;
  const guestRequests = fullReservationData?.guest_requests;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4">
        {/* Header Compacto */}
        <DialogHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center border">
                  <User className="h-6 w-6 text-slate-600" />
                </div>
                <div className={cn("absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white", statusConfig.dotColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {reservation.guest_name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border">
                    #{reservation.reservation_number}
                  </span>
                  {reservation.source && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {reservation.source}
                    </Badge>
                  )}
                  {createdDate ? (
                    <span className="text-slate-500">
                      • Criada em {formatCreatedDate(createdDate)}
                    </span>
                  ) : loadingDetails ? (
                    <span className="inline-block w-24 h-3 bg-slate-200 rounded animate-pulse"></span>
                  ) : null}
                </div>
              </div>
            </div>
            <Badge className={cn("gap-1.5 px-3 py-1 text-xs font-medium rounded-lg", statusConfig.className)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Grid Principal 2x2 */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Período */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Período</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Check-in:</span>
                  <span className="font-semibold text-slate-900">
                    {format(new Date(reservation.check_in_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Check-out:</span>
                  <span className="font-semibold text-slate-900">
                    {format(new Date(reservation.check_out_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-blue-300">
                  <span className="text-slate-600">Duração:</span>
                  <span className="font-bold text-blue-700">
                    {reservation.nights} {reservation.nights === 1 ? 'noite' : 'noites'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financeiro */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">Financeiro</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Pago:</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-300">
                  <span className="text-slate-600">Saldo:</span>
                  <span className={cn("font-bold text-xs", balanceColor)}>
                    {formatCurrency(finalBalanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quarto e Hóspedes */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-900">Acomodação</span>
              </div>
              <div className="space-y-2">
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-800 mb-1">
                    {room.room_number}
                  </div>
                  <div className="text-xs text-purple-700 font-medium">
                    {room.name}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 pt-2 border-t border-purple-300">
                  <Users className="h-3 w-3 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-800">
                    {reservation.total_guests} {reservation.total_guests === 1 ? 'hóspede' : 'hóspedes'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-900">Contato</span>
                {loadingDetails && (
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                )}
              </div>
              <div className="space-y-2 text-xs">
                {reservation.guest_email && (
                  <div className="truncate">
                    <span className="text-slate-600">Email: </span>
                    <span className="font-medium text-indigo-800">
                      {reservation.guest_email}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-600">Telefone: </span>
                  {guestPhone ? (
                    <span className="font-medium text-indigo-800">{guestPhone}</span>
                  ) : loadingDetails ? (
                    <span className="inline-block w-16 h-3 bg-indigo-200 rounded animate-pulse"></span>
                  ) : (
                    <span className="text-slate-500 italic">Não informado</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Indicadores de Hoje */}
          {(reservation.is_arrival || reservation.is_departure) && (
            <div className="flex gap-3 justify-center">
              {reservation.is_arrival && (
                <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-emerald-800">Chegada Hoje</span>
                  </div>
                </div>
              )}
              {reservation.is_departure && (
                <div className="bg-red-100 border border-red-300 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-red-800">Partida Hoje</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pedidos do Hóspede */}
          {guestRequests && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">Pedidos do Hóspede</span>
                {loadingDetails && (
                  <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
                )}
              </div>
              <p className="text-xs text-orange-800 leading-relaxed">
                {guestRequests}
              </p>
            </div>
          )}

          {/* Loading placeholder para pedidos do hóspede */}
          {loadingDetails && !guestRequests && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">Pedidos do Hóspede</span>
                <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-orange-200 rounded animate-pulse"></div>
                <div className="h-3 bg-orange-200 rounded w-3/4 animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Observações */}
          {reservation.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">Observações</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {reservation.notes}
              </p>
            </div>
          )}

          <Separator />

          {/* ✅ BOTÕES DE AÇÃO ATUALIZADOS - Com Check-out diferenciado */}
          <div className="flex gap-3">
            {/* Botão Ver Detalhes - sempre presente */}
            <Button
              onClick={handleViewDetails}
              className="flex-1 gap-2 h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <Eye className="h-4 w-4" />
              Ver Detalhes
            </Button>
            
            {/* Botão de Check-in - para reservas pendentes e confirmadas E data é hoje ou passado */}
            {(reservation.status === 'confirmed' || reservation.status === 'pending') && 
             new Date(reservation.check_in_date) <= new Date(new Date().toDateString()) && (
              <Button
                onClick={handleCheckIn}
                className="flex-1 gap-2 h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700"
              >
                <UserCheck className="h-4 w-4" />
                Check-in
              </Button>
            )}

            {/* ✅ MODIFICADO: Botão de Check-out diferenciado - cor laranja */}
            {reservation.status === 'checked_in' && (
              <Button
                onClick={handleCheckOut}
                className="flex-1 gap-2 h-10 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              >
                <LogOut className="h-4 w-4" />
                Check-out
              </Button>
            )}
            
            {/* Botão Editar - sempre presente */}
            <Button
              onClick={handleEdit}
              className="flex-1 gap-2 h-10 text-sm font-semibold"
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