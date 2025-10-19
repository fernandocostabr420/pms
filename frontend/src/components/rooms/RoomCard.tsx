// frontend/src/components/rooms/RoomCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Bed,
  Users,
  Building,
  Edit,
  Trash2,
  MoreVertical,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  Eye,
  Power,
  PowerOff
} from 'lucide-react';
import { RoomResponse } from '@/types/rooms';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RoomCardProps {
  room: RoomResponse;
  onEdit: (room: RoomResponse) => void;
  onDelete: (room: RoomResponse) => void;
  onView: (room: RoomResponse) => void;
  onToggleOperational: (room: RoomResponse) => void;
  loading?: boolean;
}

export default function RoomCard({
  room,
  onEdit,
  onDelete,
  onView,
  onToggleOperational,
  loading = false
}: RoomCardProps) {
  const getStatusColor = () => {
    if (!room.is_operational) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (room.is_out_of_order) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (room.maintenance_notes) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusLabel = () => {
    if (!room.is_operational) return 'Inativo';
    if (room.is_out_of_order) return 'Fora de Ordem';
    if (room.maintenance_notes) return 'Manutenção';
    return 'Operacional';
  };

  const getStatusIcon = () => {
    if (!room.is_operational) return XCircle;
    if (room.is_out_of_order) return AlertTriangle;
    if (room.maintenance_notes) return Wrench;
    return CheckCircle;
  };

  const StatusIcon = getStatusIcon();

  return (
    <Card className={`hover:shadow-md transition-all duration-200 ${loading ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {room.name}
              </h3>
              <Badge variant="outline" className="text-xs">
                #{room.room_number}
              </Badge>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge className={`text-xs flex items-center gap-1 ${getStatusColor()}`}>
                <StatusIcon className="h-3 w-3" />
                {getStatusLabel()}
              </Badge>
              
              {room.is_available_for_booking && (
                <Badge variant="secondary" className="text-xs">
                  Reservável
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                disabled={loading}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(room)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(room)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onToggleOperational(room)}
                className={room.is_operational ? 'text-red-600' : 'text-green-600'}
              >
                {room.is_operational ? (
                  <>
                    <PowerOff className="mr-2 h-4 w-4" />
                    Desativar
                  </>
                ) : (
                  <>
                    <Power className="mr-2 h-4 w-4" />
                    Ativar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(room)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações básicas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>Máx: {room.max_occupancy} pessoas</span>
          </div>
          
          {room.floor !== null && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building className="h-4 w-4" />
              <span>Andar {room.floor}</span>
            </div>
          )}
        </div>

        {room.building && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{room.building}</span>
          </div>
        )}

        {/* Notas importantes */}
        {(room.maintenance_notes || room.housekeeping_notes) && (
          <div className="space-y-2">
            {room.maintenance_notes && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                <div className="flex items-start gap-2">
                  <Wrench className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-orange-800">
                      Manutenção
                    </div>
                    <div className="text-xs text-orange-700 mt-1">
                      {room.maintenance_notes}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {room.housekeeping_notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <div className="flex items-start gap-2">
                  <Bed className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-blue-800">
                      Limpeza
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      {room.housekeeping_notes}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rodapé com data de atualização */}
        <div className="pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Atualizado em {format(new Date(room.updated_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}