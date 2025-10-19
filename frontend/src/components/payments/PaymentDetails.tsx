// frontend/src/components/payments/PaymentDetails.tsx
'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  CreditCard, 
  Calendar, 
  FileText, 
  User,
  Building,
  Clock,
  Hash,
  CheckCircle
} from 'lucide-react';
import { PaymentWithReservation } from '@/types/payment';
import { 
  PAYMENT_STATUS_LABELS, 
  PAYMENT_STATUS_COLORS, 
  PAYMENT_METHOD_LABELS,
  PaymentStatusEnum,
  PaymentMethodEnum 
} from '@/types/payment';
import { cn } from '@/lib/utils';

interface PaymentDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentWithReservation | null;
}

export default function PaymentDetails({ 
  isOpen, 
  onClose, 
  payment 
}: PaymentDetailsProps) {
  if (!payment) return null;

  const paymentDate = format(new Date(payment.payment_date), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  const createdDate = format(new Date(payment.created_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  const confirmedDate = payment.confirmed_date 
    ? format(new Date(payment.confirmed_date), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })
    : null;

  // ✅ Status sempre verde para pagamentos confirmados automaticamente
  const statusBadgeClass = payment.status === "confirmed" 
    ? "bg-green-100 text-green-800 border-green-200" 
    : PAYMENT_STATUS_COLORS[payment.status as PaymentStatusEnum] || "bg-gray-100 text-gray-800";
  
  const statusLabel = payment.status === "confirmed" 
    ? "Confirmado Automaticamente" 
    : PAYMENT_STATUS_LABELS[payment.status as PaymentStatusEnum] || payment.status;
  
  const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethodEnum] || 
                     payment.payment_method_display || payment.payment_method;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamento #{payment.payment_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="reservation">Reserva</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Informações principais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Informações do Pagamento</span>
                  <div className="flex items-center gap-2">
                    {/* ✅ Status com ícone de confirmação automática */}
                    <Badge className={cn("text-xs flex items-center gap-1", statusBadgeClass)}>
                      {payment.status === "confirmed" && <CheckCircle className="h-3 w-3" />}
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
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Valor Principal</div>
                    <div className="text-xl font-bold text-green-600">
                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  {payment.fee_amount && payment.fee_amount > 0 && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Taxa</div>
                      <div className="font-medium text-orange-600">
                        R$ {payment.fee_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}

                  {payment.net_amount && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Valor Líquido</div>
                      <div className="font-medium">
                        R$ {payment.net_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Método</div>
                    <div className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {methodLabel}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Data do Pagamento</div>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {paymentDate}
                    </div>
                  </div>

                  {payment.reference_number && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Referência</div>
                      <div className="font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {payment.reference_number}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ✅ Aviso sobre confirmação automática */}
            {payment.status === "confirmed" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Este pagamento foi confirmado automaticamente no momento da criação
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Observações */}
            {(payment.notes || payment.internal_notes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payment.notes && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Observações</div>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        {payment.notes}
                      </div>
                    </div>
                  )}
                  
                  {payment.internal_notes && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Notas Internas</div>
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
                        {payment.internal_notes}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reservation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Dados da Reserva
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {payment.reservation_number && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Número da Reserva</div>
                      <div className="font-medium">#{payment.reservation_number}</div>
                    </div>
                  )}
                  
                  {payment.guest_name && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Hóspede</div>
                      <div className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {payment.guest_name}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {payment.property_name && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Propriedade</div>
                      <div className="font-medium">{payment.property_name}</div>
                    </div>
                  )}
                  
                  {payment.check_in_date && payment.check_out_date && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Período da Estadia</div>
                      <div className="font-medium">
                        {format(new Date(payment.check_in_date), 'dd/MM/yyyy', { locale: ptBR })} - {' '}
                        {format(new Date(payment.check_out_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Alterações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Criado em</div>
                    <div className="font-medium">{createdDate}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Última atualização</div>
                    <div className="font-medium">
                      {format(new Date(payment.updated_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                    </div>
                  </div>
                </div>

                {/* ✅ Confirmação automática sempre destacada */}
                {confirmedDate && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <div className="text-sm text-green-700 mb-1 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {payment.status === "confirmed" ? "Confirmado automaticamente em" : "Confirmado em"}
                    </div>
                    <div className="font-medium text-green-800">{confirmedDate}</div>
                  </div>
                )}

                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Status atual</div>
                  <div className="font-medium capitalize flex items-center gap-2">
                    {payment.status === "confirmed" && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {statusLabel}
                  </div>
                </div>

                {/* ✅ Informação sobre política de auto-confirmação */}
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="text-sm text-blue-700">
                    <strong>Política do Sistema:</strong> Todos os pagamentos são confirmados automaticamente 
                    no momento da criação para agilizar o processo financeiro.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}