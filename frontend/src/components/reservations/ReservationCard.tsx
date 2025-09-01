// frontend/src/components/reservations/ReservationCard.tsx

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Users,
  Phone,
  Mail,
  Building,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  MoreVertical,
  Eye,
  Edit,
  CreditCard,
  DollarSign,
  Globe,
  Hash,
  User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReservationResponse } from '@/types/reservation';

interface ReservationCardProps {
  reservation: ReservationResponse;
  onView: () => void;
  onEdit: () => void;
  onQuickAction: (action: string) => void;
  onClick?: (reservation: ReservationResponse) => void; // ✅ Nova prop para navegação
  actionLoading?: string | null;
}

export default function ReservationCard({
  reservation,
  onView,
  onEdit,
  onQuickAction,
  onClick, // ✅ Nova prop
  actionLoading
}: ReservationCardProps) {

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pending': { label: 'Pendente', variant: 'secondary' as const },
      'confirmed': { label: 'Confirmada', variant: 'default' as const },
      'checked_in': { label: 'Check-in', variant: 'success' as const },
      'checked_out': { label: 'Check-out', variant: 'outline' as const },
      'cancelled': { label: 'Cancelada', variant: 'destructive' as const },
      'no_show': { label: 'No-show', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || 
                      { label: status, variant: 'default' as const };
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getPaymentBadge = () => {
    if (reservation.balance_due === 0 || reservation.is_paid) {
      return <Badge variant="success" className="bg-green-100 text-green-800">Pago</Badge>;
    }
    
    if (reservation.paid_amount > 0) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Parcial</Badge>;
    }
    
    return <Badge variant="destructive" className="bg-red-100 text-red-800">Pendente</Badge>;
  };

  // ✅ Handler do clique no card
  const handleCardClick = (e: React.MouseEvent) => {
    // Ignorar clique se foi em um botão/dropdown/link
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('a')) {
      return;
    }
    
    // Chamar callback se disponível
    onClick?.(reservation);
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all duration-200 cursor-pointer" // ✅ Adicionar cursor pointer
      onClick={handleCardClick} // ✅ Handler do clique
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Seção Principal - Informações da Reserva */}
        <div className="lg:col-span-7">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  #{reservation.reservation_number}
                </h3>
                {getStatusBadge(reservation.status)}
                {getPaymentBadge()}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Criada: {formatDate(reservation.created_date)}
                </span>
                {reservation.confirmed_date && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Confirmada: {formatDate(reservation.confirmed_date)}
                  </span>
                )}
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2">
              {reservation.status === 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation(); // ✅ Prevenir propagação
                    onQuickAction('confirm');
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation(); // ✅ Prevenir propagação
                    onQuickAction('check-in');
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation(); // ✅ Prevenir propagação
                    onQuickAction('check-out');
                  }}
                  disabled={actionLoading === 'check-out'}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Check-out
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => e.stopPropagation()} // ✅ Prevenir propagação
                  >
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

          {/* Informações da Estadia */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs font-medium text-blue-600 mb-1">CHECK-IN</div>
              <div className="font-semibold text-blue-900">
                {formatDate(reservation.check_in_date)}
              </div>
              {reservation.checked_in_date && (
                <div className="text-xs text-blue-600 mt-1">
                  Realizado: {formatDateTime(reservation.checked_in_date)}
                </div>
              )}
            </div>

            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-xs font-medium text-orange-600 mb-1">CHECK-OUT</div>
              <div className="font-semibold text-orange-900">
                {formatDate(reservation.check_out_date)}
              </div>
              {reservation.checked_out_date && (
                <div className="text-xs text-orange-600 mt-1">
                  Realizado: {formatDateTime(reservation.checked_out_date)}
                </div>
              )}
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-xs font-medium text-purple-600 mb-1">ESTADIA</div>
              <div className="font-semibold text-purple-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {reservation.nights} noite{reservation.nights !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Informações dos Quartos */}
          {reservation.rooms && reservation.rooms.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="text-xs font-medium text-gray-600 mb-2">QUARTOS</div>
              <div className="space-y-2">
                {reservation.rooms.map((room, index) => (
                  <div key={room.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {room.room_number || `Quarto ${index + 1}`}
                    </span>
                    <span className="text-gray-600">
                      {room.room_type_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informações Financeiras */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-xs font-medium text-green-600 mb-1">VALOR TOTAL</div>
              <div className="font-semibold text-green-900 flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                R$ {Number(reservation.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className={`p-3 rounded-lg ${
              reservation.balance_due > 0 ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                reservation.balance_due > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {reservation.balance_due > 0 ? 'SALDO DEVEDOR' : 'PAGO'}
              </div>
              <div className={`font-semibold flex items-center gap-1 ${
                reservation.balance_due > 0 ? 'text-red-900' : 'text-green-900'
              }`}>
                <CreditCard className="h-4 w-4" />
                R$ {Math.abs(Number(reservation.balance_due || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Seção do Hóspede e Propriedade */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Informações do Hóspede */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-gray-700">HÓSPEDE</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-gray-900 text-lg">
                  {reservation.guest_name || 'Nome não informado'}
                </div>
                {reservation.guest && reservation.guest.document_number && (
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {reservation.guest.document_type?.toUpperCase()}: {reservation.guest.document_number}
                  </div>
                )}
              </div>

              {reservation.guest_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <a 
                    href={`mailto:${reservation.guest_email}`} 
                    className="text-blue-600 hover:underline break-all"
                    onClick={(e) => e.stopPropagation()} // ✅ Prevenir propagação para links
                  >
                    {reservation.guest_email}
                  </a>
                </div>
              )}

              {reservation.guest?.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <a 
                    href={`tel:${reservation.guest.phone}`}
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()} // ✅ Prevenir propagação para links
                  >
                    {reservation.guest.phone}
                  </a>
                </div>
              )}

              {reservation.guest?.nationality && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">{reservation.guest.nationality}</span>
                </div>
              )}

              {(reservation.guest?.city || reservation.guest?.country) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {[reservation.guest.city, reservation.guest.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">
                  {reservation.total_guests} pessoa{reservation.total_guests !== 1 ? 's' : ''} 
                  <span className="text-gray-500 ml-1">
                    ({reservation.adults} adulto{reservation.adults !== 1 ? 's' : ''} + {reservation.children} criança{reservation.children !== 1 ? 's' : ''})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Informações da Propriedade */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-700">PROPRIEDADE</span>
            </div>
            
            <div className="text-blue-900 font-semibold">
              {reservation.property_name || 'Propriedade não informada'}
            </div>
            
            {reservation.source && (
              <div className="text-sm text-blue-600 mt-2 capitalize">
                Canal: {reservation.source === 'direct' ? 'Direto' : reservation.source}
              </div>
            )}
          </div>

          {/* Status Especiais */}
          {(reservation.is_group_reservation || reservation.requires_deposit || 
            reservation.guest_requests || reservation.internal_notes) && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="space-y-2">
                {reservation.is_group_reservation && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    Reserva em Grupo
                  </Badge>
                )}
                
                {reservation.requires_deposit && (
                  <Badge variant="outline" className={
                    reservation.deposit_paid 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }>
                    Depósito {reservation.deposit_paid ? 'Pago' : 'Pendente'}
                  </Badge>
                )}
                
                {reservation.guest_requests && (
                  <div className="text-sm">
                    <span className="font-medium text-yellow-800">Pedidos:</span>
                    <p className="text-yellow-700 mt-1">{reservation.guest_requests}</p>
                  </div>
                )}
                
                {reservation.internal_notes && (
                  <div className="text-sm">
                    <span className="font-medium text-yellow-800">Notas:</span>
                    <p className="text-yellow-700 mt-1">{reservation.internal_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancelamento */}
          {reservation.status === 'cancelled' && reservation.cancelled_date && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-700">CANCELADA</span>
              </div>
              <div className="text-sm text-red-600">
                Em: {formatDateTime(reservation.cancelled_date)}
              </div>
              {reservation.cancellation_reason && (
                <div className="text-sm text-red-700 mt-2">
                  <span className="font-medium">Motivo:</span> {reservation.cancellation_reason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}