// frontend/src/components/calendar/ReservationCard.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { 
  CalendarReservation, 
  RESERVATION_STATUS_COLORS, 
  RESERVATION_STATUS_LABELS 
} from '@/types/calendar';
import { cn } from '@/lib/utils';
import { Users, Calendar } from 'lucide-react';

interface ReservationCardProps {
  reservation: CalendarReservation;
  onClick: (reservation: CalendarReservation) => void;
  compact?: boolean;
}

export default function ReservationCard({
  reservation,
  onClick,
  compact = false
}: ReservationCardProps) {
  const statusColor = RESERVATION_STATUS_COLORS[reservation.status];
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(reservation);
  };

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'p-1.5 rounded text-xs cursor-pointer transition-all hover:shadow-sm border',
          statusColor,
          'hover:scale-[1.02]'
        )}
        title={`${reservation.guest_name || reservation.reservation_number} - ${statusLabel}`}
      >
        <div className="font-medium truncate">
          {reservation.guest_name || reservation.reservation_number}
        </div>
        <div className="flex items-center justify-between text-xs opacity-90">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {reservation.total_guests}
          </span>
          <span>{reservation.nights}n</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]',
        statusColor
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm truncate">
          {reservation.guest_name || 'Sem nome'}
        </div>
        <Badge 
          variant="outline" 
          className="text-xs bg-white/50"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Detalhes */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Reserva:</span>
          <span className="font-mono">{reservation.reservation_number}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-gray-600">
            <Users className="h-3 w-3" />
            Hóspedes:
          </span>
          <span>{reservation.total_guests} ({reservation.adults}A + {reservation.children}C)</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-gray-600">
            <Calendar className="h-3 w-3" />
            Período:
          </span>
          <span>{reservation.nights} noites</span>
        </div>

        {reservation.total_amount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Valor:</span>
            <span className="font-medium">
              R$ {reservation.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {reservation.rooms && reservation.rooms.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Quartos:</span>
            <span className="font-medium">
              {reservation.rooms.map(room => room.room_number).join(', ')}
            </span>
          </div>
        )}

        {reservation.source && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Canal:</span>
            <span className="capitalize">{reservation.source}</span>
          </div>
        )}
      </div>

      {/* Actions para reservas que podem ser alteradas */}
      {(reservation.can_check_in || reservation.can_check_out || reservation.can_cancel) && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex gap-1">
            {reservation.can_check_in && (
              <div className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                Pode Check-in
              </div>
            )}
            {reservation.can_check_out && (
              <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                Pode Check-out
              </div>
            )}
            {reservation.can_cancel && (
              <div className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                Pode Cancelar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}