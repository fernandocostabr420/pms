// frontend/src/components/payments/ReservationPaymentSummary.tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  Plus, 
  RefreshCw, 
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useReservationPayments } from '@/hooks/useReservationPayments';
import { 
  PAYMENT_STATUS_LABELS, 
  PAYMENT_STATUS_COLORS, 
  PAYMENT_METHOD_LABELS,
  PaymentStatusEnum,
  PaymentMethodEnum 
} from '@/types/payment';
import PaymentModal from './PaymentModal';
import { cn } from '@/lib/utils';

interface ReservationPaymentSummaryProps {
  reservationId: number;
  onPaymentCreated?: () => void;
}

export default function ReservationPaymentSummary({ 
  reservationId, 
  onPaymentCreated 
}: ReservationPaymentSummaryProps) {
  const { summary, loading, error, refreshSummary } = useReservationPayments(reservationId);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const handlePaymentSuccess = () => {
    refreshSummary();
    onPaymentCreated?.();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Erro ao carregar informações financeiras</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshSummary}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const balanceStatus = summary.balance_due > 0 ? 'pending' : 
                       summary.balance_due < 0 ? 'overpaid' : 'paid';

  const balanceColor = balanceStatus === 'pending' ? 'text-red-600' :
                      balanceStatus === 'overpaid' ? 'text-orange-600' : 'text-green-600';

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resumo Financeiro
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={refreshSummary}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resumo de valores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-xs text-blue-600 mb-1">Total</div>
            <div className="text-sm font-bold text-blue-800">
              {formatCurrency(summary.total_amount)}
            </div>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <div className="text-xs text-green-600 mb-1">Pago</div>
            <div className="text-sm font-bold text-green-800">
              {formatCurrency(summary.total_paid)}
            </div>
          </div>
          
          {summary.total_refunded > 0 && (
            <div className="bg-orange-50 p-3 rounded-lg text-center">
              <div className="text-xs text-orange-600 mb-1">Estornado</div>
              <div className="text-sm font-bold text-orange-800">
                {formatCurrency(summary.total_refunded)}
              </div>
            </div>
          )}
          
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-xs text-gray-600 mb-1">Saldo</div>
            <div className={cn("text-sm font-bold", balanceColor)}>
              {formatCurrency(Math.abs(summary.balance_due))}
              {summary.balance_due < 0 && ' (a favor)'}
            </div>
          </div>
        </div>

        {/* Status do pagamento */}
        <div className="flex items-center gap-2">
          {balanceStatus === 'paid' && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Totalmente pago</span>
            </>
          )}
          {balanceStatus === 'pending' && (
            <>
              <Clock className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-700">Pagamento pendente</span>
            </>
          )}
          {balanceStatus === 'overpaid' && (
            <>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">Valor pago em excesso</span>
            </>
          )}
          
          <div className="text-xs text-gray-500 ml-auto">
            {summary.payment_count} pagamento{summary.payment_count !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Lista de pagamentos */}
        {summary.payments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Histórico de Pagamentos
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {summary.payments.map((payment) => {
                const paymentDate = format(new Date(payment.payment_date), 'dd/MM/yy', { locale: ptBR });
                const statusBadgeClass = PAYMENT_STATUS_COLORS[payment.status as PaymentStatusEnum] || "bg-gray-100 text-gray-800";
                const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatusEnum] || payment.status;
                const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethodEnum] || 
                                   payment.payment_method_display || payment.payment_method;

                return (
                  <div key={payment.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">#{payment.payment_number}</span>
                      <span className="text-gray-600">{paymentDate}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatCurrency(payment.amount)}
                      </span>
                      <Badge className={cn("text-xs px-1.5 py-0.5", statusBadgeClass)}>
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Última atualização */}
        {summary.last_payment_date && (
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            Último pagamento em {' '}
            {format(new Date(summary.last_payment_date), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
          </div>
        )}
      </CardContent>

      {/* Modal para novo pagamento */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        reservationId={reservationId}
        onSuccess={handlePaymentSuccess}
      />
    </Card>
  );
}