// frontend/src/hooks/usePayments.ts

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { 
  PaymentResponse, 
  PaymentListResponse, 
  PaymentFilters,
  PaymentStats,
  PaymentCreate,
  PaymentUpdate,
  PaymentStatusUpdate,
  // ✅ NOVOS IMPORTS PARA FUNCIONALIDADES ADMINISTRATIVAS
  PaymentConfirmedUpdate,
  PaymentDeleteConfirmed,
  PaymentPermissions,
  PaymentSecurityWarning,
  PaymentAuditLog
} from '@/types/payment';
import { useToast } from '@/hooks/use-toast';

interface UsePaymentsReturn {
  // Estado
  payments: PaymentResponse[];
  loading: boolean;
  error: string | null;
  stats: PaymentStats | null;
  
  // Paginação
  pagination: {
    total: number;
    page: number;
    pages: number;
    per_page: number;
  };
  
  // Filtros
  filters: PaymentFilters;
  currentPage: number;
  perPage: number;
  
  // ✅ NOVO: Estado para permissões e administração
  isAdmin: boolean;
  loadingPermissions: boolean;
  
  // Ações
  loadPayments: () => Promise<void>;
  refreshData: () => Promise<void>;
  setFilters: (filters: PaymentFilters) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  clearFilters: () => void;
  
  // Operações CRUD
  createPayment: (data: PaymentCreate) => Promise<PaymentResponse | null>;
  updatePayment: (id: number, data: PaymentUpdate) => Promise<PaymentResponse | null>;
  deletePayment: (id: number, justification?: PaymentDeleteConfirmed) => Promise<boolean>;
  updatePaymentStatus: (id: number, data: PaymentStatusUpdate) => Promise<PaymentResponse | null>;
  getPaymentByNumber: (paymentNumber: string) => Promise<PaymentResponse | null>;
  
  // ✅ NOVAS OPERAÇÕES ADMINISTRATIVAS
  updateConfirmedPayment: (id: number, data: PaymentConfirmedUpdate) => Promise<PaymentResponse | null>;
  deleteConfirmedPayment: (id: number, data: PaymentDeleteConfirmed) => Promise<boolean>;
  getPaymentPermissions: (id: number) => Promise<PaymentPermissions | null>;
  getPaymentSecurityWarning: (id: number, operation: 'edit_confirmed' | 'delete_confirmed') => Promise<PaymentSecurityWarning | null>;
  getPaymentAuditLog: (id: number) => Promise<PaymentAuditLog[]>;
  checkAdminPermissions: () => Promise<boolean>;
}

const initialFilters: PaymentFilters = {
  search: '',
};

export function usePayments(): UsePaymentsReturn {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [filters, setFiltersState] = useState<PaymentFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    per_page: 20,
  });

  // ✅ NOVOS ESTADOS PARA ADMINISTRAÇÃO
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const { toast } = useToast();

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getPayments({
        page: currentPage,
        per_page: perPage,
        ...filters,
      });
      
      setPayments(response.payments);
      setPagination({
        total: response.total,
        page: response.page,
        pages: response.pages,
        per_page: response.per_page,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar pagamentos:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filters]);

  const loadStats = useCallback(async () => {
    try {
      // Como não há endpoint específico para stats de pagamentos no backend,
      // vamos calcular baseado nos dados carregados
      if (payments.length > 0) {
        const totalPayments = payments.length;
        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        
        const pendingPayments = payments.filter(p => p.status === 'pending');
        const confirmedPayments = payments.filter(p => p.status === 'confirmed');
        const refundedPayments = payments.filter(p => p.is_refund);
        
        setStats({
          total_payments: totalPayments,
          total_amount: totalAmount,
          pending_payments: pendingPayments.length,
          pending_amount: pendingPayments.reduce((sum, p) => sum + p.amount, 0),
          confirmed_payments: confirmedPayments.length,
          confirmed_amount: confirmedPayments.reduce((sum, p) => sum + p.amount, 0),
          refunded_payments: refundedPayments.length,
          refunded_amount: refundedPayments.reduce((sum, p) => sum + p.amount, 0),
        });
      }
    } catch (err: any) {
      console.error('Erro ao calcular estatísticas:', err);
    }
  }, [payments]);

  // ✅ NOVA FUNÇÃO: Verificar permissões de administrador
  const checkAdminPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setLoadingPermissions(true);
      const isAdminUser = await apiClient.checkAdminPermissions();
      setIsAdmin(isAdminUser);
      return isAdminUser;
    } catch (error) {
      console.error('Erro ao verificar permissões de admin:', error);
      setIsAdmin(false);
      return false;
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadPayments();
  }, [loadPayments]);

  const setFilters = useCallback((newFilters: PaymentFilters) => {
    setFiltersState(newFilters);
    setCurrentPage(1); // Reset para primeira página
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setPerPage = useCallback((newPerPage: number) => {
    setPerPageState(newPerPage);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setCurrentPage(1);
  }, []);

  // Operações específicas de pagamento
  const createPayment = useCallback(async (data: PaymentCreate) => {
    try {
      const response = await apiClient.createPayment(data);
      
      // Atualizar a lista
      await loadPayments();
      
      toast({
        title: "Pagamento criado",
        description: "O pagamento foi criado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao criar pagamento:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao criar pagamento',
        variant: "destructive",
      });
      return null;
    }
  }, [loadPayments, toast]);

  const updatePayment = useCallback(async (id: number, data: PaymentUpdate) => {
    try {
      const response = await apiClient.updatePayment(id, data);
      
      // Atualizar o pagamento na lista
      setPayments(prev => 
        prev.map(payment => 
          payment.id === id ? response : payment
        )
      );
      
      toast({
        title: "Pagamento atualizado",
        description: "O pagamento foi atualizado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao atualizar pagamento:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao atualizar pagamento',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // ✅ MÉTODO MODIFICADO: deletePayment - suporte para justificativas
  const deletePayment = useCallback(async (id: number, justification?: PaymentDeleteConfirmed) => {
    try {
      await apiClient.deletePayment(id, justification);
      
      // Remover da lista
      setPayments(prev => prev.filter(payment => payment.id !== id));
      
      toast({
        title: "Pagamento excluído",
        description: "O pagamento foi excluído com sucesso.",
      });
      
      return true;
    } catch (err: any) {
      console.error('Erro ao excluir pagamento:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao excluir pagamento',
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const updatePaymentStatus = useCallback(async (id: number, data: PaymentStatusUpdate) => {
    try {
      const response = await apiClient.updatePaymentStatus(id, data);
      
      // Atualizar o pagamento na lista
      setPayments(prev => 
        prev.map(payment => 
          payment.id === id ? response : payment
        )
      );
      
      toast({
        title: "Status atualizado",
        description: "O status do pagamento foi atualizado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao atualizar status',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const getPaymentByNumber = useCallback(async (paymentNumber: string) => {
    try {
      const response = await apiClient.getPaymentByNumber(paymentNumber);
      return response;
    } catch (err: any) {
      console.error('Erro ao buscar pagamento:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao buscar pagamento',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // ✅ NOVAS OPERAÇÕES ADMINISTRATIVAS

  const updateConfirmedPayment = useCallback(async (id: number, data: PaymentConfirmedUpdate) => {
    try {
      const response = await apiClient.updateConfirmedPayment(id, data);
      
      // Atualizar o pagamento na lista
      setPayments(prev => 
        prev.map(payment => 
          payment.id === id ? response : payment
        )
      );
      
      toast({
        title: "Pagamento confirmado atualizado",
        description: `Pagamento #${response.payment_number} foi atualizado administrativamente.`,
        variant: "default",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao atualizar pagamento confirmado:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao atualizar pagamento confirmado',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const deleteConfirmedPayment = useCallback(async (id: number, data: PaymentDeleteConfirmed) => {
    try {
      await apiClient.deleteConfirmedPayment(id, data);
      
      // Remover da lista
      setPayments(prev => prev.filter(payment => payment.id !== id));
      
      toast({
        title: "Pagamento confirmado excluído",
        description: "O pagamento confirmado foi excluído administrativamente.",
        variant: "default",
      });
      
      return true;
    } catch (err: any) {
      console.error('Erro ao excluir pagamento confirmado:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao excluir pagamento confirmado',
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const getPaymentPermissions = useCallback(async (id: number): Promise<PaymentPermissions | null> => {
    try {
      const permissions = await apiClient.getPaymentPermissions(id);
      return permissions;
    } catch (err: any) {
      console.error('Erro ao verificar permissões do pagamento:', err);
      return null;
    }
  }, []);

  const getPaymentSecurityWarning = useCallback(async (
    id: number, 
    operation: 'edit_confirmed' | 'delete_confirmed'
  ): Promise<PaymentSecurityWarning | null> => {
    try {
      const warning = await apiClient.getPaymentSecurityWarning(id, operation);
      return warning;
    } catch (err: any) {
      console.error('Erro ao obter aviso de segurança:', err);
      return null;
    }
  }, []);

  const getPaymentAuditLog = useCallback(async (id: number): Promise<PaymentAuditLog[]> => {
    try {
      const auditLog = await apiClient.getPaymentAuditLog(id);
      return auditLog;
    } catch (err: any) {
      console.error('Erro ao carregar log de auditoria:', err);
      return [];
    }
  }, []);

  // Carregar dados inicial
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ✅ NOVO: Verificar permissões de admin ao inicializar
  useEffect(() => {
    checkAdminPermissions();
  }, [checkAdminPermissions]);

  return {
    payments,
    loading,
    error,
    stats,
    pagination,
    filters,
    currentPage,
    perPage,
    
    // ✅ NOVOS RETORNOS ADMINISTRATIVOS
    isAdmin,
    loadingPermissions,
    
    loadPayments,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    clearFilters,
    createPayment,
    updatePayment,
    deletePayment,
    updatePaymentStatus,
    getPaymentByNumber,
    
    // ✅ NOVAS OPERAÇÕES ADMINISTRATIVAS
    updateConfirmedPayment,
    deleteConfirmedPayment,
    getPaymentPermissions,
    getPaymentSecurityWarning,
    getPaymentAuditLog,
    checkAdminPermissions,
  };
}