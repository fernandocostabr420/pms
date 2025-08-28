// frontend/src/components/room-types/RoomTypeCard.tsx
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
  Tag,
  Users,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Eye,
  Power,
  PowerOff,
  Star
} from 'lucide-react';
import { RoomTypeResponse } from '@/types/rooms';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RoomTypeCardProps {
  roomType: RoomTypeResponse;
  onEdit: (roomType: RoomTypeResponse) => void;
  onDelete: (roomType: RoomTypeResponse) => void;
  onView: (roomType: RoomTypeResponse) => void;
  onToggleBookable: (roomType: RoomTypeResponse) => void;
  loading?: boolean;
}

export default function RoomTypeCard({
  roomType,
  onEdit,
  onDelete,
  onView,
  onToggleBookable,
  loading = false
}: RoomTypeCardProps) {
  const getBookableColor = () => {
    return roomType.is_bookable 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const getBookableLabel = () => {
    return roomType.is_bookable ? 'Reservável' : 'Não Reservável';
  };

  const getBookableIcon = () => {
    return roomType.is_bookable ? CheckCircle : XCircle;
  };

  const BookableIcon = getBookableIcon();

  // Truncar descrição se for muito longa
  const truncateDescription = (text: string | null, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Card className={`hover:shadow-md transition-all duration-200 ${loading ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900 truncate">
                {roomType.name}
              </h3>
              {roomType.sort_order && roomType.sort_order < 10 && (
                <Star className="h-3 w-3 text-yellow-500" />
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                #{roomType.slug}
              </Badge>
              <Badge className={`text-xs ${getBookableColor()}`}>
                <BookableIcon className="mr-1 h-3 w-3" />
                {getBookableLabel()}
              </Badge>
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
              <DropdownMenuItem onClick={() => onView(roomType)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(roomType)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleBookable(roomType)}>
                {roomType.is_bookable ? (
                  <PowerOff className="mr-2 h-4 w-4" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                {roomType.is_bookable ? 'Desabilitar Reservas' : 'Habilitar Reservas'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(roomType)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Descrição */}
          {roomType.description && (
            <div className="text-sm text-gray-600">
              {truncateDescription(roomType.description)}
            </div>
          )}

          {/* Capacidades */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm font-medium">
                  {roomType.base_capacity}
                </div>
                <div className="text-xs text-gray-500">
                  Capacidade Base
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm font-medium">
                  {roomType.max_capacity}
                </div>
                <div className="text-xs text-gray-500">
                  Capacidade Máxima
                </div>
              </div>
            </div>
          </div>

          {/* Comodidades */}
          {roomType.base_amenities && roomType.base_amenities.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">
                Comodidades ({roomType.base_amenities.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {roomType.base_amenities.slice(0, 3).map((amenity) => (
                  <Badge key={amenity} variant="secondary" className="text-xs">
                    {amenity}
                  </Badge>
                ))}
                {roomType.base_amenities.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{roomType.base_amenities.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Comodidades adicionais */}
          {roomType.additional_amenities && roomType.additional_amenities.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-blue-700">
                Adicionais ({roomType.additional_amenities.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {roomType.additional_amenities.slice(0, 2).map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-xs border-blue-200 text-blue-700">
                    {amenity}
                  </Badge>
                ))}
                {roomType.additional_amenities.length > 2 && (
                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
                    +{roomType.additional_amenities.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Rodapé com ações */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="text-xs text-gray-500">
              Atualizado em {format(new Date(roomType.updated_at), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(roomType)}
                disabled={loading}
              >
                <Eye className="mr-1 h-3 w-3" />
                Ver
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => onEdit(roomType)}
                disabled={loading}
              >
                <Edit className="mr-1 h-3 w-3" />
                Editar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}