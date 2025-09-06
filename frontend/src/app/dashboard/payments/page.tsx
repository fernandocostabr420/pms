'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  RefreshCw,
  AlertCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  Edit,
  Ban,
  History,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  List,
  Table as TableIcon
} from 'lucide-react';
import { usePayments } from '@/hooks/usePayments';
import { PaymentResponse } from '@/types/payment';
import PaymentFilters from '@/components/payments/PaymentFilters';
import PaymentCard from '@/components/payments/PaymentCard';
import PaymentModal from '@/components/payments/PaymentModal';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentCancelModal from '@/components/payments/PaymentCancelModal';
import { useToast } from '@/hooks/use-toast';

// Labels para status
const STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  failed: 'Falhou',
  refunded: 'Estornado'
};

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

// Componente da tabela
const PaymentTable = ({ 
  payments, 
  onSort, 
  sortConfig, 
  onView, 
  onEdit, 
  onCancel, 
  onViewAuditLog, 
  isAdmin, 
  getActionLoadingForPayment 
}: {
  payments: PaymentResponse[];
  onSort: (column: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onView: (payment: PaymentResponse) => void;
  onEdit: (payment: PaymentResponse) => void;
  onCancel: (payment: PaymentResponse) => void;
  onViewAuditLog: (payment: PaymentResponse) => void;
  isAdmin: boolean;
  getActionLoadingForPayment: (id: number) => string | null;
}) => {
  // Componente SortButton
  const SortButton = ({ children, columnKey }: { children: React.ReactNode; columnKey: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 font-semibold hover:bg-transparent -ml-2"
      onClick={() => onSort(columnKey)}
    >
      {children}
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );

  // Formatação simples
  const formatCurrency = (value: number | null | undefined) => {
    if (!value || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    const numValue = Number(value);
    return `R$ ${numValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  return (
    <div className="overflow-x-auto">
      <style jsx global>{`
        .payment-table {
          min-width: 100%;
          border-collapse: collapse;
        }
        
        .payment-table th,
        .payment-table td {
          border-bottom: 1px solid #e5e7eb;
          padding: 12px 8px;
          text-align: left;
          vertical-align: middle;
        }
        
        .payment-table th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        
        .payment-table td {
          font-size: 14px;
        }
        
        .payment-table tbody tr:hover {
          background-color: #f9fafb;
        }
        
        .truncate-text {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      
      <table className="payment-table">
        <thead>
          <tr>
            <th style={{ width: '140px' }}>
              <SortButton columnKey="payment_number">Número</SortButton>
            </th>
            <th style={{ width: '120px' }}>
              <SortButton columnKey="payment_date">Data</SortButton>
            </th>
            <th style={{ width: '120px' }}>
              <SortButton columnKey="amount">Valor</SortButton>
            </th>
            <th style={{ width: '130px' }}>
              <SortButton columnKey="status">Status</SortButton>
            </th>
            <th style={{ width: '150px' }}>
              <SortButton columnKey="payment_method">Método</SortButton>
            </th>
            <th style={{ width: '100px' }}>
              <SortButton columnKey="reservation_id">Reserva</SortButton>
            </th>
            <th style={{ width: '150px' }}>
              Observações
            </th>
            <th style={{ width: '140px' }}>
              <SortButton columnKey="created_at">Criado em</SortButton>
            </th>
            <th style={{ width: '120px' }}>
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="font-medium">{payment.payment_number}</span>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{formatDate(payment.payment_date)}</span>
                </div>
              </td>
              <td>
                <div>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </div>
                  {payment.is_partial && (
                    <div className="text-xs text-orange-600">Parcial</div>
                  )}
                  {payment.is_refund && (
                    <div className="text-xs text-blue-600">Estorno</div>
                  )}
                </div>
              </td>
              <td>
                <StatusBadge status={payment.status} />
              </td>
              <td>
                <PaymentMethodBadge method={payment.payment_method} />
              </td>
              <td>
                {payment.reservation_id ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">#{payment.reservation_id}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td>
                {payment.notes ? (
                  <div className="truncate-text text-sm text-gray-600" title={payment.notes}>
                    {payment.notes}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td>
                <div className="text-sm text-gray-600">
                  {formatDateTime(payment.created_at)}
                </div>
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(payment)}
                    disabled={!!getActionLoadingForPayment(payment.id)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(payment)}
                    disabled={!!getActionLoadingForPayment(payment.id)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  {payment.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(payment)}
                      disabled={!!getActionLoadingForPayment(payment.id)}
                      title="Cancelar"
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewAuditLog(payment)}
                      disabled={getActionLoadingForPayment(payment.id) === 'audit'}
                      title="Histórico"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PaymentsPage() {
  const {
    payments,
    loading,
    error,
    pagination,
    loadPayments,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    filters,
    currentPage,
    perPage,
    clearFilters,
    isAdmin,
    loadingPermissions,
    getPaymentAuditLog,
    sortConfig,
    setSortConfig,
  } = usePayments();

  // Estados para modais
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const { toast } = useToast();

  // Função para comparar valores na ordenação
  const compareValues = (a: any, b: any, direction: 'asc' | 'desc') => {
    const valueA = a === null || a === undefined ? '' : a;
    const valueB = b === null || b === undefined ? '' : b;
    
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }
    
    if (valueA instanceof Date && valueB instanceof Date) {
      return direction === 'asc' ? valueA.getTime() - valueB.getTime() : valueB.getTime() - valueA.getTime();
    }
    
    const stringA = String(valueA).toLowerCase();
    const stringB = String(valueB).toLowerCase();
    
    if (direction === 'asc') {
      return stringA.localeCompare(stringB);
    } else {
      return stringB.localeCompare(stringA);
    }
  };

  // Função para obter valor de ordenação
  const getSortValue = (payment: PaymentResponse, key: string) => {
    switch (key) {
      case 'payment_number':
        return payment.payment_number || '';
      case 'payment_date':
        return new Date(payment.payment_date);
      case 'amount':
        return payment.amount || 0;
      case 'status':
        return payment.status || '';
      case 'payment_method':
        return payment.payment_method || '';
      case 'reservation_id':
        return payment.reservation_id || 0;
      case 'created_at':
        return new Date(payment.created_at);
      default:
        return '';
    }
  };

  // Pagamentos ordenados
  const sortedPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    
    return [...payments].sort((a, b) => {
      const valueA = getSortValue(a, sortConfig.key);
      const valueB = getSortValue(b, sortConfig.key);
      return compareValues(valueA, valueB, sortConfig.direction);
    });
  }, [payments, sortConfig]);

  // Handler para ordenação
  const handleSort = useCallback((column: string) => {
    if (sortConfig.key === column) {
      setSortConfig({
        key: column,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key: column, direction: 'asc' });
    }
  }, [sortConfig, setSortConfig]);

  // Handlers para ações
  const handleCreatePayment = () => {
    setSelectedPayment(null);
    setIsCreateModalOpen(true);
  };

  const handleEditPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleCancelPayment = (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsCancelModalOpen(true);
  };

  const handleViewPayment = (payment: PaymentResponse) => {
    toast({
      title: "Visualizar Pagamento",
      description: `Funcionalidade de visualização será implementada para o pagamento #${payment.payment_number}`,
    });
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

  const handleModalSuccess = (updatedPayment?: PaymentResponse) => {
    refreshData();
    
    if (updatedPayment) {
      toast({
        title: "Sucesso",
        description: `Pagamento #${updatedPayment.payment_number} foi atualizado com sucesso.`,
      });
    }
  };

  const handleCreateSuccess = () => {
    refreshData();
  };

  // Obter loading de ação para um pagamento específico
  const getActionLoadingForPayment = (paymentId: number): string | null => {
    if (!actionLoading) return null;
    
    const [action, id] = actionLoading.split('-');
    return parseInt(id) === paymentId ? action : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
          <p className="text-gray-600">Gerencie todos os pagamentos das reservas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de visualização */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleCreatePayment} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pagamento
          </Button>
        </div>
      </div>

      {/* Filters */}
      <PaymentFilters 
        filters={filters}
        onFiltersChange={setFilters}
        loading={loading}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : sortedPayments.length === 0 ? (
            <div className="p-8 text-center">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum pagamento encontrado
              </h3>
              <p className="text-gray-600 mb-4">
                {Object.values(filters).some(v => v && v !== '') 
                  ? 'Tente ajustar os filtros para encontrar pagamentos.'
                  : 'Comece criando seu primeiro pagamento.'
                }
              </p>
              {Object.values(filters).some(v => v && v !== '') && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Renderização condicional baseada no modo de visualização */}
              {viewMode === 'table' ? (
                <PaymentTable
                  payments={sortedPayments}
                  onSort={handleSort}
                  sortConfig={sortConfig}
                  onView={handleViewPayment}
                  onEdit={handleEditPayment}
                  onCancel={handleCancelPayment}
                  onViewAuditLog={handleViewAuditLog}
                  isAdmin={isAdmin}
                  getActionLoadingForPayment={getActionLoadingForPayment}
                />
              ) : (
                <div className="divide-y divide-gray-200">
                  {sortedPayments.map((payment) => (
                    <div key={payment.id} className="p-4">
                      <PaymentCard
                        payment={payment}
                        onView={() => handleViewPayment(payment)}
                        onEdit={() => handleEditPayment(payment)}
                        onCancel={() => handleCancelPayment(payment)}
                        actionLoading={getActionLoadingForPayment(payment.id)}
                        isAdmin={isAdmin}
                        onViewAuditLog={() => handleViewAuditLog(payment)}
                        showDeleteButton={false}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Mostrando {((currentPage - 1) * perPage) + 1} até{' '}
                      {Math.min(currentPage * perPage, pagination.total)} de{' '}
                      {pagination.total} pagamentos
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPage(pageNum)}
                              disabled={loading}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(currentPage + 1)}
                        disabled={currentPage >= pagination.pages || loading}
                      >
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal para criar pagamento */}
      <PaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        payment={null}
        onSuccess={handleCreateSuccess}
      />

      {/* Modal para editar pagamento */}
      <PaymentEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payment={selectedPayment}
        onSuccess={handleModalSuccess}
        isAdmin={isAdmin}
      />

      {/* Modal para cancelar pagamento */}
      <PaymentCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        payment={selectedPayment}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}