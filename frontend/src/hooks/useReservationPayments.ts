// hooks/useReservationPayments.ts
import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { PaymentResponse } from '@/types/payment';

interface UseReservationPaymentsReturn {
  payments: PaymentResponse[];
  loading: boolean;
  error: string | null;
  refreshPayments: () => Promise<void>;
  createPayment: (paymentData: any) => Promise<PaymentResponse>;
  updatePayment: (id: number, paymentData: any) => Promise<PaymentResponse>;
  cancelPayment: (id: number, reason?: string) => Promise<PaymentResponse>;
  getPaymentAuditLog: (id: number) => Promise<any[]>;
}

export const useReservationPayments = (reservationId: number): UseReservationPaymentsReturn => {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar pagamentos específicos da reserva
      const response = await apiClient.getPayments({
        reservation_id: reservationId,
        per_page: 100 // Buscar todos os pagamentos da reserva
      });
      
      setPayments(response.payments || []);
    } catch (err: any) {
      console.error('Erro ao carregar pagamentos da reserva:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  const refreshPayments = useCallback(async () => {
    await loadPayments();
  }, [loadPayments]);

  const createPayment = useCallback(async (paymentData: any): Promise<PaymentResponse> => {
    try {
      const response = await apiClient.createPayment({
        ...paymentData,
        reservation_id: reservationId
      });
      
      // Atualizar lista local
      await refreshPayments();
      
      return response;
    } catch (error: any) {
      console.error('Erro ao criar pagamento:', error);
      throw error;
    }
  }, [reservationId, refreshPayments]);

  const updatePayment = useCallback(async (id: number, paymentData: any): Promise<PaymentResponse> => {
    try {
      const response = await apiClient.updatePayment(id, paymentData);
      
      // Atualizar lista local
      await refreshPayments();
      
      return response;
    } catch (error: any) {
      console.error('Erro ao atualizar pagamento:', error);
      throw error;
    }
  }, [refreshPayments]);

  const cancelPayment = useCallback(async (id: number, reason?: string): Promise<PaymentResponse> => {
    try {
      const response = await apiClient.cancelPayment(id, { reason });
      
      // Atualizar lista local
      await refreshPayments();
      
      return response;
    } catch (error: any) {
      console.error('Erro ao cancelar pagamento:', error);
      throw error;
    }
  }, [refreshPayments]);

  const getPaymentAuditLog = useCallback(async (id: number): Promise<any[]> => {
    try {
      const response = await apiClient.getPaymentAuditLog(id);
      return response.audit_logs || [];
    } catch (error: any) {
      console.error('Erro ao carregar audit log:', error);
      throw error;
    }
  }, []);

  // Carregar pagamentos na inicialização
  useEffect(() => {
    if (reservationId) {
      loadPayments();
    }
  }, [reservationId, loadPayments]);

  return {
    payments,
    loading,
    error,
    refreshPayments,
    createPayment,
    updatePayment,
    cancelPayment,
    getPaymentAuditLog,
  };
};