'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReservationDetails } from '@/hooks/useReservationDetails';
import CancelReservationModal from '@/components/reservations/CancelReservationModal';
import EditReservationModal from '@/components/reservations/EditReservationModal';
import CheckInModal from '@/components/reservations/CheckInModal';
import CheckOutModal from '@/components/reservations/CheckOutModal';
import PaymentModal from '@/components/reservations/PaymentModal';
import { useReservationPayments } from '@/hooks/useReservationPayments';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentCancelModal from '@/components/payments/PaymentCancelModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  Bed, 
  Edit2, 
  DollarSign,
  TrendingUp,
  Clock,
  Receipt,
  Plus,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Calendar,
  Ban,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  LogOut,
  LogIn,
  UserCheck,
  FileText,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';
import { formatReservationDate } from '@/lib/calendar-utils';
import { PaymentResponse } from '@/types/payment';

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

// ===== UTILITÁRIOS PARA HISTÓRICO DE AUDITORIA =====

// Função para obter ícone baseado na descrição/ação
const getAuditIcon = (description: string, action: string, tableName: string) => {
  const desc = description.toLowerCase();
  
  // Ícones específicos por conteúdo da descrição
  if (desc.includes('check-in')) return { icon: LogIn, color: 'text-green-600' };
  if (desc.includes('check-out')) return { icon: LogOut, color: 'text-blue-600' };
  if (desc.includes('pagamento')) return { icon: CreditCard, color: 'text-green-600' };
  if (desc.includes('cancelad')) return { icon: Ban, color: 'text-red-600' };
  if (desc.includes('confirmad')) return { icon: CheckCircle, color: 'text-blue-600' };
  if (desc.includes('hóspede') || desc.includes('guest')) return { icon: UserCheck, color: 'text-purple-600' };
  
  // Ícones por tabela
  if (tableName === 'payments') return { icon: CreditCard, color: 'text-green-600' };
  if (tableName === 'guests') return { icon: User, color: 'text-purple-600' };
  if (tableName === 'reservations') return { icon: Calendar, color: 'text-blue-600' };
  
  // Ícones por ação
  if (action === 'CREATE') return { icon: Plus, color: 'text-green-600' };
  if (action === 'UPDATE') return { icon: Edit2, color: 'text-orange-600' };
  if (action === 'DELETE') return { icon: Ban, color: 'text-red-600' };
  
  // Padrão
  return { icon: FileText, color: 'text-gray-600' };
};

// Função para obter badge de tipo de operação
const getOperationBadge = (description: string, tableName: string) => {
  const desc = description.toLowerCase();
  
  if (desc.includes('check-in')) {
    return { label: 'Check-in', className: 'bg-green-100 text-green-800 border-green-200' };
  }
  if (desc.includes('check-out')) {
    return { label: 'Check-out', className: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (desc.includes('pagamento')) {
    return { label: 'Pagamento', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }
  if (desc.includes('cancelad')) {
    return { label: 'Cancelamento', className: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (desc.includes('confirmad')) {
    return { label: 'Confirmação', className: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (desc.includes('administrativa')) {
    return { label: 'Admin', className: 'bg-orange-100 text-orange-800 border-orange-200' };
  }
  
  if (tableName === 'payments') {
    return { label: 'Financeiro', className: 'bg-green-100 text-green-800 border-green-200' };
  }
  if (tableName === 'guests') {
    return { label: 'Hóspede', className: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  
  return { label: 'Atualização', className: 'bg-gray-100 text-gray-800 border-gray-200' };
};

// Função para timestamp relativo
const getRelativeTime = (timestamp: string) => {
  try {
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true, 
      locale: ptBR 
    });
  } catch {
    return 'Data inválida';
  }
};

// Função para obter nome legível do campo
const getFieldLabel = (key: string) => {
  const labels: Record<string, string> = {
    'room_id': 'Quarto',
    'adults': 'Adultos',
    'children': 'Crianças',
    'total_guests': 'Total de Hóspedes',
    'check_in_date': 'Data Check-in',
    'check_out_date': 'Data Check-out',
    'total_amount': 'Valor Total',
    'room_rate': 'Tarifa do Quarto',
    'status': 'Status',
    'guest_requests': 'Solicitações',
    'internal_notes': 'Observações Internas',
    'payment_method': 'Método de Pagamento',
    'amount': 'Valor',
    'reference_number': 'Referência',
    'payment_date': 'Data do Pagamento',
    'confirmed_date': 'Data de Confirmação',
    'checked_in_date': 'Data do Check-in',
    'checked_out_date': 'Data do Check-out'
  };
  
  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Função para formatar valores de mudança
const formatChangeValue = (key: string, value: any) => {
  if (value === null || value === undefined) return 'N/A';
  
  // Valores monetários
  if (key.includes('amount') || key.includes('value') || key.includes('price')) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    }
  }
  
  // Datas
  if (key.includes('date') || key.includes('_at')) {
    try {
      return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return value;
    }
  }
  
  // Booleanos
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  
  return String(value);
};

// Componente para entrada individual do histórico - COMPACTADO
const AuditTimelineEntry = ({ audit, onRefresh }: { audit: any; onRefresh: () => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { icon: Icon, color } = getAuditIcon(audit.description, audit.action, audit.table_name, audit.old_values, audit.new_values);
  const badge = getOperationBadge(audit.description, audit.table_name, audit.old_values, audit.new_values);
  
  const hasDetails = audit.old_values || audit.new_values;
  const relativeTime = getRelativeTime(audit.timestamp);
  const exactTime = format(new Date(audit.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR });

  // Detectar mudanças específicas importantes
  const significantChanges = [];
  if (audit.old_values && audit.new_values) {
    for (const key of Object.keys(audit.new_values)) {
      const oldValue = audit.old_values[key];
      const newValue = audit.new_values[key];
      
      if (oldValue !== newValue && oldValue !== null && oldValue !== undefined) {
        significantChanges.push({
          field: key,
          fieldLabel: getFieldLabel(key),
          oldValue: formatChangeValue(key, oldValue),
          newValue: formatChangeValue(key, newValue)
        });
      }
    }
  }

  return (
    <div className="relative">
      {/* Linha da timeline */}
      <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
      
      <div className="flex gap-3 pb-4">
        {/* Ícone da timeline - MENOR */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10 ${color}`}>
          <Icon className="h-3 w-3" />
        </div>
        
        {/* Conteúdo - COMPACTADO */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
            {/* Header da entrada */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900 flex-1 text-sm">
                    {audit.description}
                  </p>
                  <Badge variant="outline" className={`${badge.className} text-xs`}>
                    {badge.label}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>por {audit.user?.name || 'Sistema'}</span>
                  <span>•</span>
                  <span title={exactTime}>{relativeTime}</span>
                </div>
                
                {/* Mostrar mudanças importantes diretamente */}
                {significantChanges.length > 0 && significantChanges.length <= 2 && (
                  <div className="mt-1 text-xs text-gray-700">
                    {significantChanges.map((change, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <span className="font-medium">{change.fieldLabel}:</span>
                        <span className="text-gray-500 line-through">{change.oldValue}</span>
                        <span>→</span>
                        <span className="font-medium text-gray-900">{change.newValue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Botão para expandir detalhes */}
            {hasDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>
            )}
            
            {/* Detalhes expandidos - COMPACTADOS */}
            {isExpanded && hasDetails && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="space-y-2">
                  {/* Mudanças específicas */}
                  {significantChanges.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2 text-xs">Alterações Realizadas</h5>
                      <div className="space-y-1">
                        {significantChanges.map((change, index) => (
                          <div key={index} className="grid grid-cols-3 gap-2 text-xs p-1 bg-gray-50 rounded">
                            <div className="font-medium text-gray-700">
                              {change.fieldLabel}
                            </div>
                            <div className="text-gray-500">
                              <span className="line-through">{change.oldValue}</span>
                            </div>
                            <div className="text-gray-900 font-medium">
                              {change.newValue}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Apenas novos valores (para criações) */}
                  {!audit.old_values && audit.new_values && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2 text-xs">Dados Criados</h5>
                      <div className="space-y-1">
                        {Object.entries(audit.new_values).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-2 gap-2 text-xs p-1 bg-green-50 rounded">
                            <div className="font-medium text-gray-700">
                              {getFieldLabel(key)}
                            </div>
                            <div className="text-gray-900 font-medium">
                              {formatChangeValue(key, value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Dados técnicos (em formato JSON colapsado) */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      Dados técnicos
                    </summary>
                    <div className="mt-1 p-2 bg-gray-50 rounded border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {audit.old_values && (
                          <div>
                            <p className="font-medium mb-1 text-gray-700">Valores Anteriores:</p>
                            <pre className="whitespace-pre-wrap text-gray-600 text-xs overflow-auto max-h-24">
                              {JSON.stringify(audit.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="font-medium mb-1 text-gray-700">Novos Valores:</p>
                          <pre className="whitespace-pre-wrap text-gray-600 text-xs overflow-auto max-h-24">
                            {JSON.stringify(audit.new_values, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para badge de método de pagamento - COMPACTADO
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
    <Badge variant="outline" className={`${config.className} text-xs`}>
      <Icon className="w-3 h-3 mr-1" />
      {PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method}
    </Badge>
  );
};

// Componente para item de pagamento - COMPACTADO
const PaymentItem = ({ 
  payment, 
  onEdit, 
  onCancel,
  actionLoading
}: {
  payment: PaymentResponse;
  onEdit: (payment: PaymentResponse) => void;
  onCancel: (payment: PaymentResponse) => void;
  actionLoading: string | null;
}) => {
  const formatCurrency = (value: number | null | undefined) => {
    if (!value || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    const numValue = Number(value);
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="p-1 bg-green-100 rounded">
          <CreditCard className="h-3 w-3 text-green-600" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-green-600 text-sm">
              {formatCurrency(payment.amount)}
            </span>
            <PaymentMethodBadge method={payment.payment_method} />
            {payment.payment_number && (
              <span className="text-xs text-gray-500 font-mono">
                #{payment.payment_number}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(payment.payment_date)}
            </span>
            {payment.reference_number && (
              <span>Ref: {payment.reference_number}</span>
            )}
            {payment.is_partial && (
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                Parcial
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex gap-1 ml-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(payment)}
          disabled={!!actionLoading}
          title="Editar"
          className="h-6 w-6 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCancel(payment)}
          disabled={!!actionLoading}
          title="Cancelar"
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Ban className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// Componente de Pagamentos compacto - COMPACTADO
function PaymentsSection({ 
  reservationId, 
  reservationNumber,
  totalAmount,
  balanceDue,
  onPaymentUpdate,
  onAddPayment
}: {
  reservationId: number;
  reservationNumber: string;
  totalAmount: number;
  balanceDue: number;
  onPaymentUpdate?: () => void;
  onAddPayment: () => void;
}) {
  const {
    payments,
    loading,
    error,
    refreshPayments,
  } = useReservationPayments(reservationId);

  // Estados apenas para modais de edição/cancelamento
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtrar apenas pagamentos confirmados
  const confirmedPayments = payments.filter(payment => payment.status === 'confirmed');

  const handleEditPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleCancelPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsCancelModalOpen(true);
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

  if (loading && payments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-green-600" />
            Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-green-600" />
            Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
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

  if (confirmedPayments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-green-600" />
              Pagamentos
            </CardTitle>
            <Button onClick={onAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-1 text-sm">Nenhum pagamento confirmado</p>
            <p className="text-xs text-gray-400 mb-3">
              Registre os pagamentos desta reserva para controlar o saldo
            </p>
            <Button 
              onClick={onAddPayment} 
              variant="outline" 
              className="mt-2"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
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
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-green-600" />
              Pagamentos ({confirmedPayments.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPayments}
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={onAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          <div className="max-h-64 overflow-y-auto overflow-x-hidden border border-gray-100 rounded-lg bg-gray-50">
            <div className="space-y-2 p-2">
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

      {/* Modais apenas para edição e cancelamento */}
      <PaymentEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payment={selectedPayment}
        onSuccess={handleEditSuccess}
        isAdmin={true}
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

// Modal de confirmação de reserva - COMPACTADO
const ConfirmReservationModal = ({
  isOpen,
  onClose,
  onConfirm,
  reservationNumber,
  loading
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reservationNumber: string;
  loading: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-blue-100 rounded-full">
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold">Confirmar Reserva</h2>
        </div>
        
        <p className="text-gray-600 mb-4 text-sm">
          Tem certeza que deseja confirmar a reserva <strong>{reservationNumber}</strong>?
        </p>
        
        <div className="flex gap-3 justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
            size="sm"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Confirmar Reserva
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ✅ COMPONENTE Header CORRIGIDO - Com validação de data para check-in
function ImprovedReservationHeader({ data, onAction }: { data: any; onAction: (action: string) => void }) {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      checked_in: 'bg-green-100 text-green-800 border-green-200',
      checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const roomsDisplay = data.rooms?.map(room => `${room.room_number} (${room.room_type_name})`).join(', ') || 'Quartos não informados';

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {data.guest?.full_name || 'Hóspede não informado'}
                </h1>
                <p className="text-gray-600 font-medium text-sm">
                  Reserva: {data.reservation_number}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 bg-green-100 rounded">
                <Bed className="h-3 w-3 text-green-600" />
              </div>
              <p className="text-base text-gray-700 font-medium">
                {roomsDisplay}
              </p>
            </div>

            {/* Pedidos do Hóspede */}
            {data.guest_requests && (
              <div className="flex items-start gap-2 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="p-1 bg-amber-100 rounded flex-shrink-0 mt-0.5">
                  <FileText className="h-3 w-3 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-800 mb-0.5">Pedidos do Hóspede</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {data.guest_requests}
                  </p>
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-600">
              Criada em {format(new Date(data.created_date), 'PPP', { locale: ptBR })} às {format(new Date(data.created_date), 'HH:mm')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(data.status)} variant="outline">
              {data.status_display}
            </Badge>
            
            <div className="flex gap-2 flex-wrap">
              {/* ✅ CORRIGIDO: Botão de Confirmar - apenas para reservas pendentes */}
              {data.status === 'pending' && (
                <Button 
                  onClick={() => onAction('confirm')} 
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              )}
              
              {/* ✅ CORRIGIDO: Check-in - para reservas pendentes ou confirmadas E data é hoje ou passado */}
              {(data.status === 'pending' || data.status === 'confirmed') && 
               new Date(data.check_in_date) <= new Date(new Date().toDateString()) && (
                <Button onClick={() => onAction('checkin')} className="bg-green-600 hover:bg-green-700" size="sm">
                  <LogIn className="h-4 w-4 mr-2" />
                  Check-in
                </Button>
              )}
              
              {/* ✅ CORRIGIDO: Check-out - SEMPRE visível após check-in ter sido realizado */}
              {data.status === 'checked_in' && (
                <Button onClick={() => onAction('checkout')} className="bg-orange-600 hover:bg-orange-700" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Check-out
                </Button>
              )}
              
              {/* ✅ CORRIGIDO: Editar - SEMPRE visível independente do status */}
              {data.status !== 'cancelled' && (
                <Button variant="outline" onClick={() => onAction('edit')} size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              
              {/* ✅ CORRIGIDO: Pagamento - SEMPRE visível independente do status */}
              {data.status !== 'cancelled' && (
                <Button variant="outline" onClick={() => onAction('payment')} className="border-green-200 text-green-700 hover:bg-green-50" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pagamento
                </Button>
              )}
              
              {/* ✅ CORRIGIDO: Cancelar - SEMPRE visível independente do status (exceto cancelada) */}
              {data.status !== 'cancelled' && (
                <Button 
                  variant="destructive" 
                  onClick={() => onAction('cancel')}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Check-in</p>
            <p className="font-semibold text-gray-900 text-sm">{formatReservationDate(data.check_in_date, 'dd/MM')}</p>
            <p className="text-xs text-gray-600">{formatReservationDate(data.check_in_date, 'EEE')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Check-out</p>
            <p className="font-semibold text-gray-900 text-sm">{formatReservationDate(data.check_out_date, 'dd/MM')}</p>
            <p className="text-xs text-gray-600">{formatReservationDate(data.check_out_date, 'EEE')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Noites</p>
            <p className="font-semibold text-gray-900 text-base">{data.nights}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Hóspedes</p>
            <p className="font-semibold text-gray-900 text-base">{data.total_guests}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReservationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationId = parseInt(params.id as string);
  
  const { data, loading, error, refresh } = useReservationDetails(reservationId);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // ✅ IMPLEMENTAÇÃO CONDICIONAL: Detectar parâmetros da URL e abrir modais APENAS do QuickView
  useEffect(() => {
    if (!data || loading) return;

    // ✅ NOVO: Detectar ?edit=true
    if (searchParams.get('edit') === 'true') {
      setEditModalOpen(true);
      // Limpar o parâmetro da URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // ✅ IMPLEMENTAÇÃO CONDICIONAL: Check-in APENAS se vier do QuickView
    if (searchParams.get('checkin') === 'true') {
      // Verificar se a reserva permite check-in (status + data)
      const isStatusValid = data.status === 'confirmed' || data.status === 'pending';
      const isDateValid = new Date(data.check_in_date) <= new Date(new Date().toDateString());
      
      if (isStatusValid && isDateValid) {
        setCheckInModalOpen(true);
        // Limpar o parâmetro da URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        // Mostrar toast informativo se não pode fazer check-in
        let message = `Não é possível fazer check-in para reservas com status: ${getStatusLabel(data.status)}`;
        if (isStatusValid && !isDateValid) {
          message = 'Check-in só é permitido na data da reserva ou após.';
        }
        
        toast({
          title: "Check-in não disponível",
          description: message,
          variant: "destructive",
        });
      }
    }

    // ✅ BONUS: Detectar outros parâmetros também
    if (searchParams.get('checkout') === 'true') {
      if (data.status === 'checked_in') {
        setCheckOutModalOpen(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        toast({
          title: "Check-out não disponível",
          description: `Não é possível fazer check-out para reservas com status: ${getStatusLabel(data.status)}`,
          variant: "destructive",
        });
      }
    }

    if (searchParams.get('payment') === 'true') {
      setPaymentModalOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

  }, [data, loading, searchParams]);

  // ✅ FUNÇÃO AUXILIAR: Obter label do status
  const getStatusLabel = (status: string) => {
    const statusLabels = {
      'pending': 'Pendente',
      'confirmed': 'Confirmada',
      'checked_in': 'Check-in realizado',
      'checked_out': 'Check-out realizado',
      'cancelled': 'Cancelada',
      'no_show': 'No Show'
    };
    return statusLabels[status as keyof typeof statusLabels] || status;
  };

  // Função para formatação correta de moeda brasileira
  const formatCurrency = (value: string | number | null | undefined): string => {
    if (!value || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    
    const numValue = Number(value);
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAction = async (action: string) => {
    switch (action) {
      case 'cancel':
        setCancelModalOpen(true);
        break;
      case 'edit':
        setEditModalOpen(true);
        break;
      case 'checkin':
        setCheckInModalOpen(true);
        break;
      case 'checkout':
        setCheckOutModalOpen(true);
        break;
      case 'payment':
        setPaymentModalOpen(true);
        break;
      case 'confirm':
        setConfirmModalOpen(true);
        break;
      default:
        console.log('Ação não implementada:', action);
    }
  };

  // Handler para confirmar reserva
  const handleConfirmReservation = async () => {
    if (!data) return;

    try {
      setActionLoading('confirm');
      
      await apiClient.confirmReservation(data.id);
      
      setConfirmModalOpen(false);
      await refresh();
      
      toast({
        title: 'Reserva Confirmada',
        description: `A reserva ${data.reservation_number} foi confirmada com sucesso.`,
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao Confirmar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSuccess = async () => {
    setEditModalOpen(false);
    await refresh();
    toast({
      title: 'Sucesso',
      description: 'Reserva atualizada com sucesso',
      variant: 'default',
    });
  };

  const handleCheckInSuccess = async () => {
    setCheckInModalOpen(false);
    await refresh();
    toast({
      title: 'Check-in Realizado',
      description: 'Check-in realizado com sucesso!',
      variant: 'default',
    });
  };

  const handleCheckOutSuccess = async () => {
    setCheckOutModalOpen(false);
    await refresh();
    toast({
      title: 'Check-out Realizado',
      description: 'Check-out realizado com sucesso!',
      variant: 'default',
    });
  };

  const handlePaymentSuccess = async () => {
    setPaymentModalOpen(false);
    await refresh();
    toast({
      title: 'Pagamento Registrado',
      description: 'Pagamento registrado com sucesso!',
      variant: 'default',
    });
  };

  // Handler para quando um pagamento é atualizado no novo componente
  const handlePaymentUpdate = async () => {
    await refresh(); // Atualiza dados da reserva para manter sincronizado
  };

  const handleCancelConfirm = async (cancelData: {
    cancellation_reason: string;
    refund_amount?: number;
    notes?: string;
  }) => {
    if (!data) return;

    try {
      setActionLoading('cancel');
      await apiClient.cancelReservation(data.id, cancelData);
      toast({
        title: 'Reserva Cancelada',
        description: `A reserva ${data.reservation_number} foi cancelada com sucesso.`,
        variant: 'default',
      });
      await refresh();
    } catch (error: any) {
      toast({
        title: 'Erro ao Cancelar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const getExistingGuestData = () => {
    if (!data?.guest) return undefined;
    return {
      first_name: data.guest.full_name?.split(' ')[0] || '',
      last_name: data.guest.full_name?.split(' ').slice(1).join(' ') || '',
      email: data.guest.email || '',
      phone: data.guest.phone || '',
      document_number: data.guest.document_number || '',
      country: data.guest.nationality || 'Brasil',
    };
  };

  // Handler para atualizar histórico
  const handleRefreshAudit = async () => {
    setAuditLoading(true);
    try {
      await refresh();
      toast({
        title: 'Histórico Atualizado',
        description: 'Histórico de alterações foi atualizado com sucesso.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar histórico de alterações.',
        variant: 'destructive',
      });
    } finally {
      setAuditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800">{error}</p>
            <Button onClick={refresh} className="mt-3" variant="outline" size="sm">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500">Reserva não encontrada</p>
            <Button 
              onClick={() => router.push('/dashboard/reservations')} 
              className="mt-3" 
              variant="outline"
              size="sm"
            >
              Voltar para Reservas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Breadcrumb - COMPACTADO */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600 text-sm">Reservas</span>
        <span className="text-gray-400">/</span>
        <span className="font-medium text-sm">{data.guest?.full_name || data.reservation_number}</span>
      </div>

      {/* Header melhorado e corrigido */}
      <ImprovedReservationHeader data={data} onAction={handleAction} />

      {/* Grid principal - COMPACTADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna principal - 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dados do Hóspede - COMPACTADO */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-blue-600" />
                Dados do Hóspede
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nome</p>
                  <p className="font-semibold text-sm">{data.guest.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-medium text-sm">{data.guest.email}</p>
                </div>
                {data.guest.phone && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Telefone</p>
                    <p className="font-medium text-sm">{data.guest.phone}</p>
                  </div>
                )}
                {data.guest.nationality && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Nacionalidade</p>
                    <p className="font-medium text-sm">{data.guest.nationality}</p>
                  </div>
                )}
                {data.guest.document_type && data.guest.document_number && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {data.guest.document_type?.toUpperCase()}
                    </p>
                    <p className="font-medium text-sm">{data.guest.document_number}</p>
                  </div>
                )}
                {data.guest.full_address && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Endereço</p>
                    <p className="font-medium text-sm">{data.guest.full_address}</p>
                  </div>
                )}
              </div>
              
              {/* Estatísticas do hóspede - COMPACTADAS */}
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Histórico do Hóspede</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Total Reservas</p>
                    <p className="font-bold text-blue-600 text-lg">{data.guest.total_reservations}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Estadias</p>
                    <p className="font-bold text-green-600 text-lg">{data.guest.completed_stays}</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Noites</p>
                    <p className="font-bold text-purple-600 text-lg">{data.guest.total_nights}</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Total Gasto</p>
                    <p className="font-bold text-yellow-600 text-lg">{formatCurrency(data.guest.total_spent)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de Pagamentos - COMPACTADA */}
          <PaymentsSection 
            reservationId={reservationId}
            reservationNumber={data.reservation_number}
            totalAmount={parseFloat(data.payment.total_amount) || 0}
            balanceDue={parseFloat(data.payment.balance_due) || 0}
            onPaymentUpdate={handlePaymentUpdate}
            onAddPayment={() => handleAction('payment')}
          />
        </div>

        {/* Sidebar - 1/3 - COMPACTADA */}
        <div className="space-y-4">
          {/* Resumo Financeiro - COMPACTADO */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total da Reserva</span>
                  <span className="font-bold text-base">{formatCurrency(data.payment.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Valor Pago</span>
                  <span className="font-semibold text-green-600 text-sm">{formatCurrency(data.payment.paid_amount)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Saldo Restante</span>
                    <span className={`font-bold text-base ${
                      parseFloat(data.payment.balance_due) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(data.payment.balance_due)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Badge 
                  variant="outline"
                  className={
                    data.payment.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-800 border-green-200 text-xs' 
                      : data.payment.payment_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200 text-xs'
                      : 'bg-red-100 text-red-800 border-red-200 text-xs'
                  }
                >
                  {data.payment.payment_status === 'paid' ? 'Totalmente Pago' 
                   : data.payment.payment_status === 'pending' ? 'Pagamento Pendente'
                   : 'Pagamento em Atraso'}
                </Badge>
              </div>

              {data.payment.is_overdue && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-xs font-medium">⚠️ Pagamento em atraso</p>
                </div>
              )}

              {data.payment.deposit_required && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-xs font-medium">💰 Depósito obrigatório</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações - COMPACTADAS */}
          {data.guest_requests && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Solicitações do Hóspede</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <p className="text-gray-700 text-sm">{data.guest_requests}</p>
              </CardContent>
            </Card>
          )}

          {/* Informações da Reserva - COMPACTADAS */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Informações da Reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Código da Reserva</p>
                <p className="font-mono font-semibold text-sm">{data.reservation_number}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Canal de Origem</p>
                <p className="font-medium capitalize text-sm">
                  {data.source === 'direct' ? 'Direto' : data.source || 'Não informado'}
                </p>
              </div>
              
              {data.is_group_reservation && (
                <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 text-xs font-medium">👥 Reserva em Grupo</p>
                </div>
              )}

              <div className="pt-2 border-t space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Criada em</p>
                  <p className="font-medium text-sm">
                    {format(new Date(data.created_date), 'PPp', { locale: ptBR })}
                  </p>
                </div>

                {data.confirmed_date && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Confirmada em</p>
                    <p className="font-medium text-sm">
                      {format(new Date(data.confirmed_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}

                {data.checked_in_date && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Check-in realizado</p>
                    <p className="font-medium text-sm">
                      {format(new Date(data.checked_in_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}

                {data.checked_out_date && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Check-out realizado</p>
                    <p className="font-medium text-sm">
                      {format(new Date(data.checked_out_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Alterações - COMPACTADO */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-gray-600" />
              Histórico de Alterações
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAudit}
              disabled={auditLoading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${auditLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {data.audit_history && data.audit_history.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-0">
                {data.audit_history.map((audit, index) => (
                  <AuditTimelineEntry
                    key={audit.id}
                    audit={audit}
                    onRefresh={handleRefreshAudit}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-base font-medium mb-1">Nenhum histórico disponível</p>
              <p className="text-xs text-gray-400">
                As alterações feitas nesta reserva aparecerão aqui
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== TODOS OS MODAIS ===== */}
      
      {/* Modal de Cancelamento */}
      <CancelReservationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        reservationNumber={data.reservation_number}
        loading={actionLoading === 'cancel'}
      />

      {/* Modal de Edição */}
      <EditReservationModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        reservation={data}
      />

      {/* ✅ Modal de Check-in - Abertura condicional implementada */}
      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        onSuccess={handleCheckInSuccess}
        reservationId={data.id.toString()}
        existingGuestData={getExistingGuestData()}
      />

      {/* Modal de Check-out */}
      <CheckOutModal
        isOpen={checkOutModalOpen}
        onClose={() => setCheckOutModalOpen(false)}
        onSuccess={handleCheckOutSuccess}
        reservationId={data.id}
        reservationNumber={data.reservation_number}
        balanceDue={parseFloat(data.payment.balance_due) || 0}
        totalAmount={parseFloat(data.payment.total_amount) || 0}
      />

      {/* Modal de Pagamento - CENTRALIZADO */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        reservationId={data.id}
        reservationNumber={data.reservation_number}
        totalAmount={parseFloat(data.payment.total_amount) || 0}
        balanceDue={parseFloat(data.payment.balance_due) || 0}
      />

      {/* Modal de Confirmação de Reserva */}
      <ConfirmReservationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmReservation}
        reservationNumber={data.reservation_number}
        loading={actionLoading === 'confirm'}
      />
    </div>
  );
}