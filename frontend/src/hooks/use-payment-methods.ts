// frontend/src/hooks/use-payment-methods.ts

import { useState, useEffect, useCallback, useReducer } from 'react';
import { useToast } from '@/hooks/use-toast';
import PaymentMethodsAPI from '@/lib/api/payment-methods';
import type {
  PaymentMethod,
  PaymentMethodCreate,
  PaymentMethodUpdate,
  PaymentMethodsFilters,
  PaymentMethodsState,
  PaymentMethodsAction
} from '@/types/payment-methods';

// Reducer para gerenciar estado dos métodos de pagamento
function paymentMethodsReducer(
  state: PaymentMethodsState,
  action: PaymentMethodsAction
): PaymentMethodsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_PAYMENT_METHODS':
      return {
        ...state,
        paymentMethods: action.payload.payment_methods,
        total: action.payload.total,
        page: action.payload.page,
        per_page: action.payload.per_page,
        total_pages: action.payload.total_pages,
        loading: false,
        error: null
      };
    
    case 'ADD_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: [action.payload, ...state.paymentMethods],
        total: state.total + 1
      };
    
    case 'UPDATE_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: state.paymentMethods.map(pm =>
          pm.id === action.payload.id ? action.payload : pm
        )
      };
    
    case 'REMOVE_PAYMENT_METHOD':
      return {
        ...state,
        paymentMethods: state.paymentMethods.filter(pm => pm.id !== action.payload),
        total: state.total - 1
      };
    
    case 'TOGGLE_PAYMENT_METHOD_STATUS':
      return {
        ...state,
        paymentMethods: state.paymentMethods.map(pm =>
          pm.id === action.payload.id
            ? { ...pm, is_active: action.payload.is_active }
            : pm
        )
      };
    
    default:
      return state;
  }
}

const initialState: PaymentMethodsState = {
  paymentMethods: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  per_page: 10,
  total_pages: 0
};

export function usePaymentMethods(initialFilters?: PaymentMethodsFilters) {
  const [state, dispatch] = useReducer(paymentMethodsReducer, initialState);
  const [filters, setFilters] = useState<PaymentMethodsFilters>(initialFilters || {});
  const { toast } = useToast();

  // Carregar métodos de pagamento
  const loadPaymentMethods = useCallback(async (newFilters?: PaymentMethodsFilters) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const finalFilters = newFilters || filters;
      const response = await PaymentMethodsAPI.list(finalFilters);
      dispatch({ type: 'SET_PAYMENT_METHODS', payload: response });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Erro ao carregar métodos de pagamento',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [filters, toast]);

  // Carregar apenas métodos ativos
  const loadActivePaymentMethods = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await PaymentMethodsAPI.listActive();
      dispatch({ 
        type: 'SET_PAYMENT_METHODS', 
        payload: {
          payment_methods: response.payment_methods,
          total: response.total,
          page: 1,
          per_page: response.total,
          total_pages: 1
        }
      });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Erro ao carregar métodos de pagamento ativos',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Criar método de pagamento
  const createPaymentMethod = useCallback(async (data: PaymentMethodCreate) => {
    try {
      const newPaymentMethod = await PaymentMethodsAPI.create(data);
      dispatch({ type: 'ADD_PAYMENT_METHOD', payload: newPaymentMethod });
      
      toast({
        title: 'Método de pagamento criado',
        description: `${newPaymentMethod.name} foi criado com sucesso.`
      });
      
      return newPaymentMethod;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar método de pagamento',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Atualizar método de pagamento
  const updatePaymentMethod = useCallback(async (id: number, data: PaymentMethodUpdate) => {
    try {
      const updatedPaymentMethod = await PaymentMethodsAPI.update(id, data);
      dispatch({ type: 'UPDATE_PAYMENT_METHOD', payload: updatedPaymentMethod });
      
      toast({
        title: 'Método de pagamento atualizado',
        description: `${updatedPaymentMethod.name} foi atualizado com sucesso.`
      });
      
      return updatedPaymentMethod;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar método de pagamento',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Deletar método de pagamento
  const deletePaymentMethod = useCallback(async (id: number, name: string) => {
    try {
      await PaymentMethodsAPI.delete(id);
      dispatch({ type: 'REMOVE_PAYMENT_METHOD', payload: id });
      
      toast({
        title: 'Método de pagamento removido',
        description: `${name} foi removido com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover método de pagamento',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Alternar status (ativar/desativar)
  const togglePaymentMethodStatus = useCallback(async (id: number, isActive: boolean, name: string) => {
    try {
      await PaymentMethodsAPI.toggleStatus(id, isActive);
      dispatch({ 
        type: 'TOGGLE_PAYMENT_METHOD_STATUS', 
        payload: { id, is_active: isActive } 
      });
      
      toast({
        title: `Método de pagamento ${isActive ? 'ativado' : 'desativado'}`,
        description: `${name} foi ${isActive ? 'ativado' : 'desativado'} com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  // Configurar dados padrão
  const setupDefaults = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await PaymentMethodsAPI.setupDefaults();
      
      toast({
        title: 'Dados padrão criados',
        description: `${response.created_count} métodos de pagamento foram criados.`
      });
      
      // Recarregar a lista após criar os padrões
      await loadPaymentMethods();
      
      return response;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Erro ao criar dados padrão',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
  }, [loadPaymentMethods, toast]);

  // Aplicar filtros
  const applyFilters = useCallback((newFilters: PaymentMethodsFilters) => {
    setFilters(newFilters);
    loadPaymentMethods(newFilters);
  }, [loadPaymentMethods]);

  // Limpar filtros
  const clearFilters = useCallback(() => {
    const clearedFilters = { page: 1, per_page: 10 };
    setFilters(clearedFilters);
    loadPaymentMethods(clearedFilters);
  }, [loadPaymentMethods]);

  // Carregar dados iniciais
  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  return {
    // Estado
    ...state,
    filters,
    
    // Ações
    loadPaymentMethods,
    loadActivePaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    togglePaymentMethodStatus,
    setupDefaults,
    applyFilters,
    clearFilters,
    
    // Utilitários
    refresh: () => loadPaymentMethods(),
    hasMore: state.page < state.total_pages,
    isEmpty: state.paymentMethods.length === 0 && !state.loading
  };
}

// Hook simplificado para apenas buscar por ID
export function usePaymentMethod(id?: number) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadPaymentMethod = useCallback(async (paymentMethodId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const pm = await PaymentMethodsAPI.getById(paymentMethodId);
      setPaymentMethod(pm);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Erro ao carregar método de pagamento',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (id) {
      loadPaymentMethod(id);
    }
  }, [id, loadPaymentMethod]);

  return {
    paymentMethod,
    loading,
    error,
    loadPaymentMethod,
    refresh: () => id && loadPaymentMethod(id)
  };
}