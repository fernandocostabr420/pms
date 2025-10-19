// frontend/src/components/calendar/ReservationModal.tsx
'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Home,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  CalendarReservation, 
  RESERVATION_STATUS_COLORS, 
  RESERVATION_STATUS_LABELS 
} from '@/types/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: CalendarReservation | null;
  onReservationUpdated: () => void;
}

export default function ReservationModal({
  isOpen,
  onClose,
  reservation,
  onReservationUpdated
}: ReservationModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!reservation) return null;

  const statusColor = RESERVATION_STATUS_COLORS[reservation.status];
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status];

  // Handlers para ações da reserva
  const handleConfirm = async () => {
    try {
      setLoading(true);
      await apiClient.confirmReservation(reservation.id);
      toast({
        title: 'Reserva confirmada!',
        description: 'A reserva foi confirmada com sucesso.',
      });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao confirmar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      await apiClient.checkInReservation(reservation.id, {
        notes: 'Check-in realizado via calendário',
        actual_check_in_time: new Date().toISOString(),
      });
      toast({
        title: 'Check-in realizado!',
        description: 'Check-in realizado com sucesso.',
      });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro no check-in',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLoading(true);
      await apiClient.checkOutReservation(reservation.id, {
        notes: 'Check-out realizado via calendário',
        actual_check_out_time: new Date().toISOString(),
      });
      toast({
        title: 'Check-out realizado!',
        description: 'Check-out realizado com sucesso.',
      });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro no check-out',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = confirm('Tem certeza que deseja cancelar esta reserva?');
    if (!confirmed) return;

    try {
      setLoading(true);
      await apiClient.cancelReservation(reservation.id, {
        cancellation_reason: 'Cancelamento via calendário',
        notes: 'Cancelado pelo usuário via calendário',
      });
      toast({
        title: 'Reserva cancelada!',
        description: 'A reserva foi cancelada com sucesso.',
      });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Reserva {reservation.reservation_number}
            </DialogTitle>
            <Badge className={cn('px-3 py-1', statusColor)}>
              {statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Hóspede */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5" />
              Informações do Hóspede
            </h3>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Nome:</span>
                <span>{reservation.guest_name || 'Não informado'}</span>
              </div>
              
              {reservation.guest_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span>{reservation.guest_email}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span>
                  {reservation.total_guests} hóspede{reservation.total_guests !== 1 ? 's' : ''} 
                  ({reservation.adults} adulto{reservation.adults !== 1 ? 's' : ''} + {reservation.children} criança{reservation.children !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </div>

          {/* Informações da Estadia */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Informações da Estadia
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Check-in</div>
                <div className="font-medium">
                  {format(parseISO(reservation.check_in_date + 'T00:00:00'), 'dd/MM/yyyy - EEEE', { locale: ptBR })}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Check-out</div>
                <div className="font-medium">
                  {format(parseISO(reservation.check_out_date + 'T00:00:00'), 'dd/MM/yyyy - EEEE', { locale: ptBR })}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Noites</div>
                <div className="font-medium">{reservation.nights} noite{reservation.nights !== 1 ? 's' : ''}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Canal</div>
                <div className="font-medium capitalize">{reservation.source || 'Direto'}</div>
              </div>
            </div>
          </div>

          {/* Informações dos Quartos */}
          {reservation.rooms && reservation.rooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Home className="h-5 w-5" />
                Quartos
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reservation.rooms.map((room) => (
                  <div key={room.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Quarto {room.room_number}</div>
                      <Badge variant="outline" className="text-xs">
                        {room.status}
                      </Badge>
                    </div>
                    
                    {room.room_type_name && (
                      <div className="text-sm text-gray-600">
                        Tipo: {room.room_type_name}
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600">
                      {format(parseISO(room.check_in_date + 'T00:00:00'), 'dd/MM')} - {format(parseISO(room.check_out_date + 'T00:00:00'), 'dd/MM')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informações Financeiras */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Informações Financeiras
            </h3>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">Valor Total:</span>
                <span className="text-lg font-bold">
                  R$ {reservation.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Propriedade */}
          {reservation.property_name && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Propriedade
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium">{reservation.property_name}</div>
              </div>
            </div>
          )}

          <Separator />

          {/* Ações da Reserva */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Fechar
            </Button>

            {reservation.status === 'pending' && (
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Confirmar
              </Button>
            )}

            {reservation.can_check_in && (
              <Button
                onClick={handleCheckIn}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Check-in
              </Button>
            )}

            {reservation.can_check_out && (
              <Button
                onClick={handleCheckOut}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Check-out
              </Button>
            )}

            {reservation.can_cancel && (
              <Button
                onClick={handleCancel}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Cancelar
              </Button>
            )}
          </div>

          {/* Informações sobre ações possíveis */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">Status da reserva:</div>
                <ul className="space-y-1 text-xs">
                  {reservation.can_check_in && (
                    <li>• Esta reserva está pronta para check-in</li>
                  )}
                  {reservation.can_check_out && (
                    <li>• Esta reserva pode realizar check-out</li>
                  )}
                  {reservation.can_cancel && (
                    <li>• Esta reserva pode ser cancelada</li>
                  )}
                  {reservation.is_current && (
                    <li>• O hóspede está atualmente no hotel</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}