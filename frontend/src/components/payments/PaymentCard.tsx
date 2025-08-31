// frontend/src/components/payments/PaymentCard.tsx
'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  MoreHorizontal,
  CreditCard,
  Clock,
  User,
  Building,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { PaymentResponse } from '@/types/payment';
import { 
  PAYMENT_STATUS_LABELS, 
  PAYMENT_STATUS_COLORS, 
  PAYMENT_METHOD_LABELS,
  PaymentStatusEnum,
  PaymentMethodEnum 
} from '@/types/payment';
import { cn } from '@/lib/utils';

interface PaymentCardProps {
  payment: PaymentResponse;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateStatus?: (status: PaymentStatusEnum) => void;
  actionLoading?: string | null;
}

export default function PaymentCard({ 
  payment, 
  onView, 
  onEdit, 
  onDelete,
  onUpdateStatus,
  actionLoading 
}: PaymentCardProps) {
  
  const paymentDate = format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: ptBR });
  const paymentTime = format(new Date(payment.payment_date), 'HH:mm', { locale: ptBR });
  
  const statusBadgeClass = PAYMENT_STATUS_COLORS[payment.status as PaymentStatusEnum] || "bg-gray-100 text-gray-800";
  const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatusEnum] || payment.status;
  
  const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethodEnum] || 
                     payment.payment_method_display || payment.payment_method;

  const isActionLoading = (action: string) => actionLoading === action;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Informações principais */}
          <div className="flex-1 space-y-3">
            {/* Header com número e status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-900">#{payment.payment_number}</span>
              </div>
              <Badge className={cn("text-xs", statusBadgeClass)}>
                {statusLabel}
              </Badge>
              {payment.is_partial && (
                <Badge variant="outline" className="text-xs">
                  Parcial
                </Badge>
              )}
              {payment.is_refund && (
                <Badge variant="outline" className="text-xs border-red-200 text-red-700">
                  Estorno
                </Badge>
              )}
            </div>

            {/* Valor e método */}
            <div className="flex items-center gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                {payment.fee_amount && payment.fee_amount > 0 && (
                  <div className="text-xs text-gray-500">
                    Taxa: R$ {payment.fee_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CreditCard className="h-4 w-4" />
                {methodLabel}
              </div>
            </div>

            {/* Informações de data e reserva */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {paymentDate} às {paymentTime}
              </div>
              
              <div className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                Reserva #{payment.reservation_id}
              </div>
            </div>

            {/* Número de referência */}
            {payment.reference_number && (
              <div className="text-xs text-gray-500">
                Ref: {payment.reference_number}
              </div>
            )}

            {/* Notas */}
            {payment.notes && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {payment.notes}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="ml-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  disabled={!!actionLoading}
                >
                  <span className="sr-only">Abrir menu</span>
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                
                <DropdownMenuItem onClick={onView} disabled={!!actionLoading}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onEdit} disabled={!!actionLoading}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Ações de status */}
                {payment.status === 'pending' && (
                  <DropdownMenuItem 
                    onClick={() => onUpdateStatus?.(PaymentStatusEnum.CONFIRMED)}
                    disabled={isActionLoading('confirm')}
                    className="text-green-600"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {isActionLoading('confirm') ? 'Confirmando...' : 'Confirmar'}
                  </DropdownMenuItem>
                )}

                {payment.status === 'pending' && (
                  <DropdownMenuItem 
                    onClick={() => onUpdateStatus?.(PaymentStatusEnum.CANCELLED)}
                    disabled={isActionLoading('cancel')}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {isActionLoading('cancel') ? 'Cancelando...' : 'Cancelar'}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem 
                  onClick={onDelete} 
                  disabled={!!actionLoading}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}