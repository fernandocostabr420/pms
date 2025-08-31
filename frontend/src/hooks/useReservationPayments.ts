// frontend/src/hooks/useReservationPayments.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { ReservationPaymentSummary } from '@/types/payment';
import { useToast } from '@/hooks/use-toast';

interface UseReservationPaymentsReturn {
  summary: ReservationPaymentSummary | null;
  loading: boolean;
  error: string | null;
  loadSummary: () => Promise<void>;
  refreshSummary: () => Promise<void>;
}

export function useReservationPayments(reservationId: number): UseReservationPaymentsReturn {
  const [summary, setSummary] = useState<ReservationPaymentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getReservationPaymentSummary(reservationId);
      setSummary(response);
      
    } catch (err: any) {
      console.error('Erro ao carregar resumo de pagamentos:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar resumo de pagamentos');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  const refreshSummary = useCallback(async () => {
    await loadSummary();
  }, [loadSummary]);

  // Carregar dados inicial
  useEffect(() => {
    if (reservationId) {
      loadSummary();
    }
  }, [reservationId, loadSummary]);

  return {
    summary,
    loading,
    error,
    loadSummary,
    refreshSummary,
  };
}