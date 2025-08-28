// frontend/src/hooks/useRooms.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { RoomResponse, RoomListResponse, RoomFilters, RoomStats } from '@/types/rooms';
import apiClient from '@/lib/api';

interface UseRoomsResult {
  rooms: RoomResponse[];
  loading: boolean;
  error: string | null;
  stats: RoomStats | null;
  pagination: {
    page: number;
    pages: number;
    total: number;
    per_page: number;
  } | null;
  
  // Actions
  loadRooms: () => Promise<void>;
  refreshData: () => Promise<void>;
  setFilters: (filters: Partial<RoomFilters>) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  
  // Current state
  filters: RoomFilters;
  currentPage: number;
  perPage: number;
}

export function useRooms(initialFilters: RoomFilters = {}): UseRoomsResult {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [filters, setFiltersState] = useState<RoomFilters>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPageState] = useState(20);
  const [pagination, setPagination] = useState<{
    page: number;
    pages: number;
    total: number;
    per_page: number;
  } | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        ...filters,
        page: currentPage,
        per_page: perPage,
      };

      const response: RoomListResponse = await apiClient.getRooms(params);

      setRooms(response.rooms);
      setPagination({
        page: response.page,
        pages: response.pages,
        total: response.total,
        per_page: response.per_page,
      });

      // Carregar estatísticas em paralelo
      try {
        const statsData = await apiClient.getRoomStats(filters.property_id);
        setStats(statsData);
      } catch (statsError) {
        console.warn('Erro ao carregar estatísticas:', statsError);
      }

    } catch (err: any) {
      console.error('Erro ao carregar quartos:', err);
      setError(err.response?.data?.detail || 'Erro ao carregar quartos');
      setRooms([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, perPage]);

  const refreshData = useCallback(async () => {
    await loadRooms();
  }, [loadRooms]);

  const setFilters = useCallback((newFilters: Partial<RoomFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset para primeira página ao filtrar
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setPerPage = useCallback((newPerPage: number) => {
    setPerPageState(newPerPage);
    setCurrentPage(1); // Reset para primeira página ao mudar itens por página
  }, []);

  // Effect para carregar dados quando filtros/página mudam
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return {
    rooms,
    loading,
    error,
    stats,
    pagination,
    
    // Actions
    loadRooms,
    refreshData,
    setFilters,
    setPage,
    setPerPage,
    
    // Current state
    filters,
    currentPage,
    perPage,
  };
}