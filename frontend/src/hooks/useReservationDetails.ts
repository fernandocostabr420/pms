import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { ReservationDetailedResponse } from '@/types/reservation-details';

export function useReservationDetails(id: number) {
  const [data, setData] = useState<ReservationDetailedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getReservationDetailed(id);
      setData(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar detalhes da reserva');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  return { 
    data, 
    loading, 
    error, 
    refresh: fetchData 
  };
}