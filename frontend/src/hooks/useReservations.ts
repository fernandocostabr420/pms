// frontend/src/hooks/useReservations.ts

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { 
  ReservationResponse, 
  ReservationListResponse, 
  ReservationFilters,
  ReservationStats 
} from '@/types/reservation';
import { useToast } from '@/hooks/use-toast';

interface UseReservationsReturn {
  // Estado
  reservations: ReservationResponse[];
  loading: boolean;
  error: string | null;
  stats: ReservationStats | null;
  
  // Paginação
  pagination: {
    total: number;
    page: number;
    pages: number;
    per_page: number;
  };
  
  // Filtros
  filters: ReservationFilters;
  currentPage: number;
  perPage: number;
  
  // Ações
  loadReservations: () => Promise<void>;
  refreshData: () => Promise<void>;
  setFilters: (filters: ReservationFilters) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  clearFilters: () => void;
  
  // Operações CRUD
  confirmReservation: (id: number) => Promise<ReservationResponse | null>;
  checkInReservation: (id: number, data: any) => Promise<ReservationResponse | null>;
  checkOutReservation: (id: number, data: any) => Promise<ReservationResponse | null>;
  cancelReservation: (id: number, data: any) => Promise<ReservationResponse | null>;
}

const initialFilters: ReservationFilters = {
  search: '',
  status: '',
  source: '',
  property_id: undefined,
  guest_id: undefined,
};

export function useReservations(): UseReservationsReturn {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReservationStats | null>(null);
  const [filters, setFiltersState] = useState<ReservationFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    per_page: 20,
  });

  const { toast } = useToast();

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getReservations({
        page: currentPage,
        per_page: perPage,
        ...filters,
      });
      
      setReservations(response.reservations);
      setPagination({
        total: response.total,
        page: response.page,
        pages: response.pages,
        per_page: response.per_page,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar reservas:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar reservas');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filters]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await apiClient.getDashboardStats();
      setStats(statsData);
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadReservations(), loadStats()]);
  }, [loadReservations, loadStats]);

  const setFilters = useCallback((newFilters: ReservationFilters) => {
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

  // Operações específicas de reserva
  const confirmReservation = useCallback(async (id: number) => {
    try {
      const response = await apiClient.confirmReservation(id);
      
      // Atualizar a reserva na lista
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === id ? response : reservation
        )
      );
      
      toast({
        title: "Reserva confirmada",
        description: "A reserva foi confirmada com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao confirmar reserva:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao confirmar reserva',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const checkInReservation = useCallback(async (id: number, data: any) => {
    try {
      const response = await apiClient.checkInReservation(id, data);
      
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === id ? response : reservation
        )
      );
      
      toast({
        title: "Check-in realizado",
        description: "O check-in foi realizado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao fazer check-in:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao fazer check-in',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const checkOutReservation = useCallback(async (id: number, data: any) => {
    try {
      const response = await apiClient.checkOutReservation(id, data);
      
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === id ? response : reservation
        )
      );
      
      toast({
        title: "Check-out realizado",
        description: "O check-out foi realizado com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao fazer check-out:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao fazer check-out',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const cancelReservation = useCallback(async (id: number, data: any) => {
    try {
      const response = await apiClient.cancelReservation(id, data);
      
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === id ? response : reservation
        )
      );
      
      toast({
        title: "Reserva cancelada",
        description: "A reserva foi cancelada com sucesso.",
      });
      
      return response;
    } catch (err: any) {
      console.error('Erro ao cancelar reserva:', err);
      toast({
        title: "Erro",
        description: err.response?.data?.detail || 'Erro ao cancelar reserva',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Carregar dados inicial
  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    reservations,
    loading,
    error,
    stats,
    pagination,
    filters,
    currentPage,
    perPage,
    loadReservations,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    clearFilters,
    confirmReservation,
    checkInReservation,
    checkOutReservation,
    cancelReservation,
  };
}