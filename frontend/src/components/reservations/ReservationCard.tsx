// frontend/src/components/reservations/ReservationCard.tsx

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calendar, 
  User, 
  MapPin, 
  DollarSign, 
  MoreVertical,
  Eye,
  Edit,
  CheckCircle,
  LogIn,
  LogOut,
  XCircle,
  Clock,
  Users
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReservationResponse } from '@/types/reservation';

interface ReservationCardProps {
  reservation: ReservationResponse;
  onView: () => void;
  onEdit: () => void;
  onQuickAction: (action: string) => void;
  actionLoading?: string | null;
}

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'checked_in':
      return 'secondary';
    case 'checked_out':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'text-amber-600 bg-amber-50';
    case 'confirmed':
      return 'text-green-600 bg-green-50';
    case 'checked_in':
      return 'text-blue-600 bg-blue-50';
    case 'checked_out':
      return 'text-gray-600 bg-gray-50';
    case 'cancelled':
      return 'text-red-600 bg-red-50';
    case 'no_show':
      return 'text-orange-600 bg-orange-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function ReservationCard({
  reservation,
  onView,
  onEdit,
  onQuickAction,
  actionLoading
}: ReservationCardProps) {
  const checkInDate = format(parseISO(reservation.check_in_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const checkOutDate = format(parseISO(reservation.check_out_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {/* Status Badge */}
            <Badge className={`${getStatusColor(reservation.status)} border-0`}>
              {reservation.status_display || reservation.status}
            </Badge>
            
            {/* Reservation Number */}
            <span className="text-sm font-mono text-gray-600">
              #{reservation.reservation_number}
            </span>
            
            {/* Guest Name */}
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {reservation.guest_name}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Dates */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="text-sm">
                <div className="text-gray-600">Check-in</div>
                <div className="font-medium">{checkInDate}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="text-sm">
                <div className="text-gray-600">Check-out</div>
                <div className="font-medium">{checkOutDate}</div>
              </div>
            </div>

            {/* Guests */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <div className="text-sm">
                <div className="text-gray-600">Hóspedes</div>
                <div className="font-medium">
                  {reservation.total_guests} ({reservation.adults}A + {reservation.children}C)
                </div>
              </div>
            </div>

            {/* Value */}
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <div className="text-sm">
                <div className="text-gray-600">Total</div>
                <div className="font-medium">
                  {reservation.total_amount ? formatCurrency(reservation.total_amount) : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Property & Source */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
            {reservation.property_name && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {reservation.property_name}
              </div>
            )}
            
            {reservation.source && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {reservation.source}
              </div>
            )}
            
            {reservation.nights && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {reservation.nights} noite{reservation.nights !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            {reservation.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickAction('confirm')}
                disabled={actionLoading === 'confirm'}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Confirmar
              </Button>
            )}
            
            {reservation.can_check_in && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickAction('check-in')}
                disabled={actionLoading === 'check-in'}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <LogIn className="h-3 w-3 mr-1" />
                Check-in
              </Button>
            )}
            
            {reservation.can_check_out && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onQuickAction('check-out')}
                disabled={actionLoading === 'check-out'}
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Check-out
              </Button>
            )}
          </div>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {reservation.can_cancel && (
                <DropdownMenuItem 
                  onClick={() => onQuickAction('cancel')}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}