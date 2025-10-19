// frontend/src/hooks/use-booking.ts
'use client';

import { useState, useCallback } from 'react';
import {
  getPropertyInfo,
  searchAvailability,
  createBooking,
} from '@/lib/api/booking';
import type {
  PropertyPublicInfo,
  SearchParams,
  AvailabilityResponse,
  BookingRequest,
  BookingResponse,
  RoomAvailable,
} from '@/types/booking';

export function useBooking(slug: string) {
  // Estados
  const [propertyInfo, setPropertyInfo] = useState<PropertyPublicInfo | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomAvailable[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomAvailable | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    check_in: '',
    check_out: '',
    adults: 2,
    children: 0,
    rooms: 1,
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [bookingSuccess, setBookingSuccess] = useState<BookingResponse | null>(null);

  // Carregar informações da propriedade
  const loadPropertyInfo = useCallback(async () => {
    setLoadingProperty(true);
    setError(null);
    
    try {
      const data = await getPropertyInfo(slug);
      setPropertyInfo(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar propriedade';
      setError(errorMessage);
      throw err;
    } finally {
      setLoadingProperty(false);
    }
  }, [slug]);

  // Buscar disponibilidade
  const search = useCallback(async (params: SearchParams) => {
    if (!params.check_in || !params.check_out) {
      setError('Por favor, selecione as datas de check-in e check-out');
      return;
    }

    setLoadingSearch(true);
    setError(null);
    setAvailableRooms([]);
    
    try {
      const data = await searchAvailability(slug, params);
      setAvailableRooms(data.available_rooms);
      setSearchParams(params);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar disponibilidade';
      setError(errorMessage);
      throw err;
    } finally {
      setLoadingSearch(false);
    }
  }, [slug]);

  // Selecionar quarto
  const selectRoom = useCallback((room: RoomAvailable | null) => {
    setSelectedRoom(room);
  }, []);

  // Criar reserva
  const book = useCallback(async (bookingData: BookingRequest) => {
    setLoadingBooking(true);
    setError(null);
    
    try {
      const response = await createBooking(bookingData);
      setBookingSuccess(response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar reserva';
      setError(errorMessage);
      throw err;
    } finally {
      setLoadingBooking(false);
    }
  }, []);

  // Resetar busca
  const resetSearch = useCallback(() => {
    setAvailableRooms([]);
    setSelectedRoom(null);
    setError(null);
  }, []);

  // Resetar tudo
  const reset = useCallback(() => {
    setAvailableRooms([]);
    setSelectedRoom(null);
    setBookingSuccess(null);
    setError(null);
    setSearchParams({
      check_in: '',
      check_out: '',
      adults: 2,
      children: 0,
      rooms: 1,
    });
  }, []);

  return {
    // Estados
    propertyInfo,
    availableRooms,
    selectedRoom,
    searchParams,
    bookingSuccess,
    
    // Loading states
    loading: loadingProperty || loadingSearch || loadingBooking,
    loadingProperty,
    loadingSearch,
    loadingBooking,
    error,
    
    // Ações
    loadPropertyInfo,
    search,
    selectRoom,
    book,
    resetSearch,
    reset,
    
    // Helpers
    hasResults: availableRooms.length > 0,
    hasSearch: !!searchParams.check_in && !!searchParams.check_out,
  };
}