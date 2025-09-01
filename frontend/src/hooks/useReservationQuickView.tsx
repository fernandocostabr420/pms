// frontend/src/hooks/useReservationQuickView.tsx

import { useState, useCallback } from 'react';
import { MapReservationResponse, MapRoomData } from '@/types/room-map';

interface ReservationQuickViewState {
  isOpen: boolean;
  reservation: MapReservationResponse | null;
  room: MapRoomData | null;
}

export function useReservationQuickView() {
  const [state, setState] = useState<ReservationQuickViewState>({
    isOpen: false,
    reservation: null,
    room: null
  });

  const openQuickView = useCallback((reservation: MapReservationResponse, room: MapRoomData) => {
    setState({
      isOpen: true,
      reservation,
      room
    });
  }, []);

  const closeQuickView = useCallback(() => {
    setState({
      isOpen: false,
      reservation: null,
      room: null
    });
  }, []);

  return {
    isOpen: state.isOpen,
    reservation: state.reservation,
    room: state.room,
    openQuickView,
    closeQuickView
  };
}