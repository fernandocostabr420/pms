// frontend/src/hooks/useGuests.ts

import { useState, useEffect, useCallback } from 'react';
import { GuestResponse, GuestListResponse, GuestFilters, GuestStats } from '@/types/guest';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export function useGuests() {
  const [guests, setGuests] = useState<GuestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GuestStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [filters, setFilters] = useState<GuestFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const { toast } = useToast();

  const loadGuests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        per_page: perPage,
        ...filters
      };
      
      const response = await apiClient.get<GuestListResponse>('/guests/', { params });
      
      setGuests(response.data.guests);
      setPagination({
        total: response.data.total,
        page: response.data.page,
        pages: response.data.pages,
        per_page: response.data.per_page,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao carregar hóspedes';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filters, toast]);

  const loadStats = useCallback(async () => {
    try {
      const response = await apiClient.get<GuestStats>('/guests/stats/general');
      setStats(response.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  }, []);

  const refreshData = useCallback(() => {
    loadGuests();
    loadStats();
  }, [loadGuests, loadStats]);

  const deleteGuest = useCallback(async (guestId: number) => {
    try {
      await apiClient.delete(`/guests/${guestId}`);
      toast({
        title: "Sucesso",
        description: "Hóspede removido com sucesso",
      });
      refreshData();
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao remover hóspede';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [toast, refreshData]);

  const searchGuests = useCallback(async (query: string, limit: number = 10) => {
    try {
      const response = await apiClient.get<GuestResponse[]>('/guests/search', {
        params: { q: query, limit }
      });
      return response.data;
    } catch (err) {
      console.error('Erro na busca rápida:', err);
      return [];
    }
  }, []);

  const checkEmailAvailability = useCallback(async (email: string, excludeGuestId?: number) => {
    try {
      const response = await apiClient.get<{ available: boolean }>('/guests/check/email', {
        params: { email, exclude_guest_id: excludeGuestId }
      });
      return response.data.available;
    } catch (err) {
      console.error('Erro ao verificar email:', err);
      return false;
    }
  }, []);

  const checkDocumentAvailability = useCallback(async (document: string, excludeGuestId?: number) => {
    try {
      const response = await apiClient.get<{ available: boolean }>('/guests/check/document', {
        params: { document_number: document, exclude_guest_id: excludeGuestId }
      });
      return response.data.available;
    } catch (err) {
      console.error('Erro ao verificar documento:', err);
      return false;
    }
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    guests,
    loading,
    error,
    stats,
    pagination,
    filters,
    currentPage,
    perPage,
    loadGuests,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    clearFilters,
    deleteGuest,
    searchGuests,
    checkEmailAvailability,
    checkDocumentAvailability,
  };
}