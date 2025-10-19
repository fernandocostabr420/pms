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
  Building,
  DollarSign,
  XCircle,
  RefreshCw,
  Shield,
  AlertTriangle,
  History
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
  onCancel?: () => void;
  onDelete?: () => void;
  actionLoading?: string | null;
  isAdmin?: boolean;
  onViewAuditLog?: () => void;
}

export default function PaymentCard({ 
  payment, 
  onView, 
  onEdit, 
  onCancel,
  onDelete,
  actionLoading,
  isAdmin = false,
  onViewAuditLog
}: PaymentCardProps) {
  
  const paymentDate = format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: ptBR });
  const paymentTime = format(new Date(payment.payment_date), 'HH:mm', { locale: ptBR });
  
  const statusBadgeClass = PAYMENT_STATUS_COLORS[payment.status as PaymentStatusEnum] || "bg-gray-100 text-gray-800";
  const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatusEnum] || payment.status;
  
  const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethodEnum] || 
                     payment.payment_method_display || payment.payment_method;

  const isActionLoading = (action: string) => actionLoading === action;
  
  // Verificações para ações disponíveis
  const isPending = payment.status === 'pending';
  const isConfirmed = payment.status === 'confirmed';
  const isCancelled = payment.status === 'cancelled';
  const isRefunded = payment.status === 'refunded';
  
  const canEdit = isPending || (isConfirmed && isAdmin);
  const canCancel = isPending || isConfirmed;
  const canDelete = isPending || (isConfirmed && isAdmin);
  const hasAdminChanges = payment.has_admin_changes || false;

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow",
      hasAdminChanges && "border-orange-200 bg-orange-50/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          {/* Informações principais */}
          <div className="flex-1 space-y-3">
            {/* Header com número e status */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-900">#{payment.payment_number}</span>
                {hasAdminChanges && (
                  <Shield className="h-4 w-4 text-orange-600" title="Pagamento com alterações administrativas" />
                )}
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

            {/* Última ação administrativa */}
            {hasAdminChanges && payment.last_admin_action && (
              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Alteração Administrativa:</span>
                </div>
                <div className="mt-1">{payment.last_admin_action}</div>
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                
                {/* Visualizar */}
                <DropdownMenuItem onClick={onView} disabled={!!actionLoading}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Editar - Condicional baseado no status */}
                {canEdit && onEdit && (
                  <DropdownMenuItem 
                    onClick={onEdit} 
                    disabled={!!actionLoading}
                    className={isConfirmed && isAdmin ? "text-orange-600" : ""}
                  >
                    {isConfirmed && isAdmin ? (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Editar (Admin)
                      </>
                    ) : (
                      <>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Editar
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {/* Cancelar - Apenas para pendentes e confirmados */}
                {canCancel && onCancel && !isCancelled && !isRefunded && (
                  <DropdownMenuItem 
                    onClick={onCancel} 
                    disabled={!!actionLoading}
                    className="text-yellow-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar Pagamento
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Histórico de alterações - Apenas se tem alterações administrativas */}
                {hasAdminChanges && onViewAuditLog && (
                  <DropdownMenuItem 
                    onClick={onViewAuditLog} 
                    disabled={!!actionLoading}
                  >
                    <History className="mr-2 h-4 w-4" />
                    Ver Histórico
                  </DropdownMenuItem>
                )}

                {/* Excluir - Condicional baseado no status e permissões */}
                {canDelete && onDelete && (
                  <DropdownMenuItem 
                    onClick={onDelete} 
                    disabled={!!actionLoading}
                    className="text-red-600"
                  >
                    {isConfirmed && isAdmin ? (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Excluir (Admin)
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {/* Mensagem se não há ações disponíveis */}
                {!canEdit && !canCancel && !canDelete && !hasAdminChanges && (
                  <DropdownMenuItem disabled>
                    <span className="text-gray-400">Nenhuma ação disponível</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}