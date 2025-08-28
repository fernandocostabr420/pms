// frontend/src/components/room-availability/RoomAvailabilityCard.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Bed,
  Building
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RoomAvailabilityResponse, AVAILABILITY_STATUS_COLORS, AVAILABILITY_STATUS_LABELS } from '@/types/room-availability';
import { cn } from '@/lib/utils';

interface RoomAvailabilityCardProps {
  availability: RoomAvailabilityResponse;
  onEdit?: (availability: RoomAvailabilityResponse) => void;
  onView?: (availability: RoomAvailabilityResponse) => void;
  onDelete?: (availability: RoomAvailabilityResponse) => void;
  loading?: boolean;
  compact?: boolean;
}

export default function RoomAvailabilityCard({ 
  availability, 
  onEdit, 
  onView, 
  onDelete,
  loading,
  compact = false
}: RoomAvailabilityCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Determinar status principal
  const getMainStatus = () => {
    if (availability.is_reserved) return 'reserved';
    if (availability.is_blocked) return 'blocked';
    if (availability.is_maintenance) return 'maintenance';
    if (availability.is_out_of_order) return 'out_of_order';
    if (availability.is_available) return 'available';
    return 'blocked';
  };

  const mainStatus = getMainStatus();
  const statusColor = AVAILABILITY_STATUS_COLORS[mainStatus] || AVAILABILITY_STATUS_COLORS.blocked;
  const statusLabel = AVAILABILITY_STATUS_LABELS[mainStatus] || 'N/A';

  // Ícone do status
  const getStatusIcon = () => {
    switch (mainStatus) {
      case 'available':
        return <CheckCircle className="h-4 w-4" />;
      case 'reserved':
        return <Calendar className="h-4 w-4" />;
      case 'blocked':
        return <XCircle className="h-4 w-4" />;
      case 'maintenance':
        return <Settings className="h-4 w-4" />;
      case 'out_of_order':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  const handleAction = async (action: string, fn?: () => void) => {
    if (!fn) return;
    
    try {
      setActionLoading(action);
      await fn();
    } finally {
      setActionLoading(null);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge className={cn(statusColor, "text-xs")}>
              {statusLabel}
            </Badge>
          </div>
          
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {availability.room_number ? `Quarto ${availability.room_number}` : `ID ${availability.room_id}`}
            </span>
            <span className="text-xs text-gray-500">
              {format(parseISO(availability.date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
          
          {availability.rate_override && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <DollarSign className="h-3 w-3" />
              {availability.rate_override.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
              })}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onView && (
              <DropdownMenuItem onClick={() => handleAction('view', () => onView(availability))}>
                <Eye className="mr-2 h-4 w-4" />
                Visualizar
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => handleAction('edit', () => onEdit(availability))}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleAction('delete', () => onDelete(availability))}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge className={cn(statusColor)}>
              {statusLabel}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0"
                disabled={loading || actionLoading !== null}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={() => handleAction('view', () => onView(availability))}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => handleAction('edit', () => onEdit(availability))}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleAction('delete', () => onDelete(availability))}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Informações principais */}
        <div className="space-y-3">
          {/* Quarto e data */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bed className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                {availability.room_number ? `Quarto ${availability.room_number}` : `ID ${availability.room_id}`}
              </span>
              {availability.room_name && (
                <span className="text-sm text-gray-500">
                  ({availability.room_name})
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              {format(parseISO(availability.date), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          </div>

          {/* Propriedade e tipo */}
          {(availability.property_name || availability.room_type_name) && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {availability.property_name && (
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {availability.property_name}
                </div>
              )}
              {availability.room_type_name && (
                <div className="flex items-center gap-1">
                  <Bed className="h-3 w-3" />
                  {availability.room_type_name}
                </div>
              )}
            </div>
          )}

          {/* Preço e restrições */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {availability.rate_override && (
                <div className="flex items-center gap-1 text-sm font-medium text-green-700">
                  <DollarSign className="h-4 w-4" />
                  {availability.rate_override.toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  })}
                </div>
              )}
              
              {availability.min_stay > 1 && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  Mín. {availability.min_stay} noites
                </div>
              )}
            </div>

            <div className="flex gap-1">
              {availability.closed_to_arrival && (
                <Badge variant="outline" className="text-xs">
                  Sem Check-in
                </Badge>
              )}
              {availability.closed_to_departure && (
                <Badge variant="outline" className="text-xs">
                  Sem Check-out
                </Badge>
              )}
            </div>
          </div>

          {/* Observações */}
          {(availability.reason || availability.notes) && (
            <div className="pt-2 border-t">
              {availability.reason && (
                <div className="text-xs text-gray-600">
                  <strong>Motivo:</strong> {availability.reason}
                </div>
              )}
              {availability.notes && (
                <div className="text-xs text-gray-500 mt-1">
                  {availability.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}