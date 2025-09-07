// components/reservations/PaymentsSection.tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Receipt, 
  CreditCard, 
  Edit2, 
  Ban, 
  Eye,
  History,
  Calendar,
  User,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Loader2
} from 'lucide-react';
import { useReservationPayments } from '@/hooks/useReservationPayments';
import { PaymentResponse } from '@/types/payment';
import PaymentModal from '@/components/payments/PaymentModal';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentCancelModal from '@/components/payments/PaymentCancelModal';
import { useToast } from '@/hooks/use-toast';

// Labels para métodos de pagamento
const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito', 
  pix: 'PIX',
  bank_transfer: 'Transferência',
  cash: 'Dinheiro',
  check: 'Cheque',
  other: 'Outro'
};

// Labels para status
const STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  failed: 'Falhou',
  refunded: 'Estornado'
};

// Componente para badges de status
const StatusBadge = ({ status }: { status: string }) => {
  const configs = {
    pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    confirmed: { icon: CheckCircle, className: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { icon: XCircle, className: 'bg-red-100 text-red-800 border-red-200' },
    failed: { icon: AlertTriangle, className: 'bg-red-100 text-red-800 border-red-200' },
    refunded: { icon: ArrowUpDown, className: 'bg-blue-100 text-blue-800 border-blue-200' }
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
    </Badge>
  );
};

// Componente para badge de método de pagamento
const PaymentMethodBadge = ({ method }: { method: string }) => {
  const configs = {
    credit_card: { icon: CreditCard, className: 'bg-blue-100 text-blue-800' },
    debit_card: { icon: CreditCard, className: 'bg-green-100 text-green-800' },
    pix: { icon: DollarSign, className: 'bg-purple-100 text-purple-800' },
    bank_transfer: { icon: DollarSign, className: 'bg-gray-100 text-gray-800' },
    cash: { icon: DollarSign, className: 'bg-green-100 text-green-800' },
    check: { icon: DollarSign, className: 'bg-orange-100 text-orange-800' },
    other: { icon: DollarSign, className: 'bg-gray-100 text-gray-800' }
  };

  const config = configs[method as keyof typeof configs] || configs.other;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method}
    </Badge>
  );
};

// Componente para item de pagamento
const PaymentItem = ({ 
  payment, 
  onView, 
  onEdit, 
  onCancel, 
  onViewAuditLog,
  actionLoading,
  isAdmin 
}: {
  payment: PaymentResponse;
  onView: (payment: PaymentResponse) => void;
  onEdit: (payment: PaymentResponse) => void;
  onCancel: (payment: PaymentResponse) => void;
  onViewAuditLog: (payment: PaymentResponse) => void;
  actionLoading: string | null;
  isAdmin: boolean;
}) => {
  const formatCurrency = (value: number | null | undefined) => {
    if (!value || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    const numValue = Number(value);
    return `R$ ${numValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-1.5 bg-green-100 rounded">
            <CreditCard className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg text-green-600">
                {formatCurrency(payment.amount)}
              </span>
              <StatusBadge status={payment.status} />
            </div>
            <div className="flex items-center gap-2">
              <PaymentMethodBadge method={payment.payment_method} />
              {payment.payment_number && (
                <span className="text-sm text-gray-600 font-mono">
                  #{payment.payment_number}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateTime(payment.payment_date)}
          </span>
          {payment.payer_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {payment.payer_name}
            </span>
          )}
          {payment.reference_number && (
            <span className="text-gray-400">
              Ref: {payment.reference_number}
            </span>
          )}
        </div>
        
        {payment.notes && (
          <p className="text-sm text-gray-600 mt-2 italic line-clamp-2">
            {payment.notes}
          </p>
        )}

        {/* Indicadores especiais */}
        <div className="flex items-center gap-2 mt-2">
          {payment.is_partial && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              Parcial
            </Badge>
          )}
          {payment.is_refund && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
              Estorno
            </Badge>
          )}
        </div>
      </div>
      
      <div className="flex gap-2 ml-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onView(payment)}
          disabled={!!actionLoading}
          title="Visualizar"
          className="h-8 w-8 p-0"
        >
          <Eye className="h-3 w-3" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(payment)}
          disabled={!!actionLoading}
          title="Editar"
          className="h-8 w-8 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        
        {payment.status !== 'cancelled' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(payment)}
            disabled={!!actionLoading}
            title="Cancelar"
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Ban className="h-3 w-3" />
          </Button>
        )}
        
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewAuditLog(payment)}
            disabled={actionLoading === `audit-${payment.id}`}
            title="Histórico"
            className="h-8 w-8 p-0"
          >
            {actionLoading === `audit-${payment.id}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <History className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

interface PaymentsSectionProps {
  reservationId: number;
  reservationNumber: string;
  totalAmount: number;
  balanceDue: number;
  onPaymentUpdate?: () => void;
}

export default function PaymentsSection({ 
  reservationId, 
  reservationNumber,
  totalAmount,
  balanceDue,
  onPaymentUpdate 
}: PaymentsSectionProps) {
  const {
    payments,
    loading,
    error,
    refreshPayments,
    createPayment,
    updatePayment,
    cancelPayment,
    getPaymentAuditLog,
  } = useReservationPayments(reservationId);

  // Estados para modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  // Handlers para ações
  const handleAddPayment = () => {
    setSelectedPayment(null);
    setIsCreateModalOpen(true);
  };

  const handleViewPayment = (payment: PaymentResponse) => {
    toast({
      title: "Detalhes do Pagamento",
      description: `Pagamento #${payment.payment_number} - ${formatCurrency(payment.amount)}`,
    });
  };

  const handleEditPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleCancelPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsCancelModalOpen(true);
  };

  const handleViewAuditLog = async (payment: PaymentResponse) => {
    try {
      setActionLoading(`audit-${payment.id}`);
      const auditData = await getPaymentAuditLog(payment.id);
      
      if (auditData.length === 0) {
        toast({
          title: "Histórico Vazio",
          description: "Nenhuma alteração registrada para este pagamento.",
        });
      } else {
        toast({
          title: "Histórico Carregado",
          description: `${auditData.length} alterações encontradas para o pagamento #${payment.payment_number}`,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar log de auditoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de alterações",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSuccess = async () => {
    setIsCreateModalOpen(false);
    await refreshPayments();
    onPaymentUpdate?.();
    toast({
      title: 'Pagamento Registrado',
      description: 'Pagamento registrado com sucesso!',
      variant: 'default',
    });
  };

  const handleEditSuccess = async (updatedPayment?: PaymentResponse) => {
    setIsEditModalOpen(false);
    await refreshPayments();
    onPaymentUpdate?.();
    
    if (updatedPayment) {
      toast({
        title: "Sucesso",
        description: `Pagamento #${updatedPayment.payment_number} foi atualizado com sucesso.`,
      });
    }
  };

  const handleCancelSuccess = async (updatedPayment?: PaymentResponse) => {
    setIsCancelModalOpen(false);
    await refreshPayments();
    onPaymentUpdate?.();
    
    if (updatedPayment) {
      toast({
        title: "Pagamento Cancelado",
        description: `Pagamento #${updatedPayment.payment_number} foi cancelado com sucesso.`,
      });
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    const numValue = Number(value);
    return `R$ ${numValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  // Cálculo de estatísticas
  const paidAmount = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingAmount = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading && payments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-green-600" />
            Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-green-600" />
            Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshPayments}
                className="ml-2"
              >
                Tentar Novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-green-600" />
              Pagamentos
            </CardTitle>
            <Button onClick={handleAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="mb-2">Nenhum pagamento registrado</p>
            <p className="text-sm text-gray-400 mb-4">
              Registre os pagamentos desta reserva para controlar o saldo
            </p>
            <Button 
              onClick={handleAddPayment} 
              variant="outline" 
              className="mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primeiro Pagamento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-green-600" />
              Pagamentos ({confirmedPayments.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPayments}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={handleAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Container com altura fixa e scroll */}
          <div className="h-96 overflow-y-auto overflow-x-hidden">
            <div className="space-y-3 pr-2">
              {confirmedPayments.map((payment) => (
                <PaymentItem
                  key={payment.id}
                  payment={payment}
                  onEdit={handleEditPayment}
                  onCancel={handleCancelPayment}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <PaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        reservationId={reservationId}
        reservationNumber={reservationNumber}
        totalAmount={totalAmount}
        balanceDue={balanceDue}
      />

      <PaymentEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payment={selectedPayment}
        onSuccess={handleEditSuccess}
        isAdmin={true} // TODO: pegar do contexto de usuário
      />

      <PaymentCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        payment={selectedPayment}
        onSuccess={handleCancelSuccess}
      />
    </>
  );
}