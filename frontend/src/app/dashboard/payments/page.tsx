// frontend/src/app/dashboard/payments/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  RefreshCw,
  AlertCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react';
import { usePayments } from '@/hooks/usePayments';
import { PaymentResponse } from '@/types/payment';
import PaymentStats from '@/components/payments/PaymentStats';
import PaymentFilters from '@/components/payments/PaymentFilters';
import PaymentCard from '@/components/payments/PaymentCard';
import PaymentModal from '@/components/payments/PaymentModal';
import PaymentEditModal from '@/components/payments/PaymentEditModal';
import PaymentCancelModal from '@/components/payments/PaymentCancelModal';
import { useToast } from '@/hooks/use-toast';

export default function PaymentsPage() {
  const {
    payments,
    loading,
    error,
    stats,
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
  } = usePayments();

  // Estados para modais (removidos estados de exclusão)
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  // Handlers para ações (removidos handlers de exclusão)
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
    // Implementar visualização detalhada
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
        // Aqui você pode implementar um modal para mostrar o histórico
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
          <div className="flex items-center gap-4 mt-2">
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats */}
      <PaymentStats stats={stats} loading={loading} />

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
                    <div className="h-24 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : payments.length === 0 ? (
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
              <div className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <div key={payment.id} className="p-4">
                    <PaymentCard
                      payment={payment}
                      onView={() => handleViewPayment(payment)}
                      onEdit={() => handleEditPayment(payment)}
                      onCancel={() => handleCancelPayment(payment)}
                      // ✅ REMOVIDO: onDelete prop - sem opção de excluir
                      actionLoading={getActionLoadingForPayment(payment.id)}
                      isAdmin={isAdmin}
                      onViewAuditLog={() => handleViewAuditLog(payment)}
                      showDeleteButton={false} // ✅ ADICIONADO: prop para ocultar botão de exclusão
                    />
                  </div>
                ))}
              </div>

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

      {/* ✅ REMOVIDOS: Todos os dialogs de exclusão (normal e administrativo) */}
    </div>
  );
}