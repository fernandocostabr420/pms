// frontend/src/app/dashboard/payments/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
    deletePayment,
    isAdmin,
    loadingPermissions,
    deleteConfirmedPayment,
    getPaymentAuditLog,
  } = usePayments();

  // Estados para modais
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

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

  const handleDeletePayment = (payment: PaymentResponse) => {
    setPaymentToDelete(payment);
    setIsDeleteDialogOpen(true);
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

  const confirmDelete = async () => {
    if (!paymentToDelete) return;

    try {
      setActionLoading('delete');
      const success = await deletePayment(paymentToDelete.id);
      
      if (success) {
        setIsDeleteDialogOpen(false);
        setPaymentToDelete(null);
      }
    } catch (error) {
      console.error('Erro ao excluir pagamento:', error);
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
            <p className="text-sm text-green-600">
              ✅ Todos os pagamentos são confirmados automaticamente
            </p>
            {!loadingPermissions && isAdmin && (
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <Shield className="h-4 w-4" />
                <span>Modo Administrador Ativo</span>
              </div>
            )}
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
                      onDelete={() => handleDeletePayment(payment)}
                      actionLoading={getActionLoadingForPayment(payment.id)}
                      isAdmin={isAdmin}
                      onViewAuditLog={() => handleViewAuditLog(payment)}
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

      {/* Dialog de confirmação para excluir (normal) */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pagamento {paymentToDelete?.payment_number}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === 'delete'}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={actionLoading === 'delete'}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === 'delete' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✅ NOVO: Dialog de confirmação para exclusão administrativa */}
      <AlertDialog open={isAdminDeleteDialogOpen} onOpenChange={setIsAdminDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Excluir Pagamento Confirmado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    <strong>ATENÇÃO:</strong> Você está prestes a excluir permanentemente um pagamento confirmado.
                    Esta operação é IRREVERSÍVEL e pode causar problemas contábeis.
                  </AlertDescription>
                </Alert>

                <p className="text-sm text-gray-600">
                  Pagamento: <strong>{paymentToDelete?.payment_number}</strong><br />
                  Valor: <strong>R$ {paymentToDelete?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong><br />
                  Reserva: <strong>#{paymentToDelete?.reservation_id}</strong>
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="admin_delete_reason" className="text-red-700 font-medium">
                    Justificativa Obrigatória *
                  </Label>
                  <Textarea
                    id="admin_delete_reason"
                    value={adminDeleteReason}
                    onChange={(e) => setAdminDeleteReason(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo para excluir este pagamento confirmado..."
                    rows={4}
                    disabled={actionLoading === 'admin-delete'}
                    className="border-red-200 focus:border-red-400"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Mínimo {ADMIN_REASON_MIN_LENGTH} caracteres</span>
                    <span>{adminDeleteReason.length}/{ADMIN_REASON_MAX_LENGTH}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={actionLoading === 'admin-delete'}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAdminDelete}
              disabled={actionLoading === 'admin-delete' || adminDeleteReason.trim().length < ADMIN_REASON_MIN_LENGTH}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === 'admin-delete' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Excluir Permanentemente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}