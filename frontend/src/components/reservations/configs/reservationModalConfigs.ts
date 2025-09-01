// frontend/src/components/reservations/configs/reservationModalConfigs.ts

/**
 * Configurações pré-definidas para o StandardReservationModal
 * Facilita o uso consistente do componente unificado
 */

export interface ReservationModalConfig {
  mode: 'full' | 'quick' | 'map';
  title: string;
  allowGuestSelection: boolean;
  allowMultipleRooms: boolean;
  showAdvancedFields: boolean;
}

// ===== CONFIGURAÇÕES PRÉ-DEFINIDAS =====

export const RESERVATION_MODAL_CONFIGS = {
  // Página principal de reservas - formulário completo
  FULL_RESERVATION: {
    mode: 'full' as const,
    title: 'Nova Reserva',
    allowGuestSelection: true,
    allowMultipleRooms: true,
    showAdvancedFields: true,
  },

  // Modal de edição de reserva existente
  EDIT_RESERVATION: {
    mode: 'full' as const,
    title: 'Editar Reserva',
    allowGuestSelection: true,
    allowMultipleRooms: true,
    showAdvancedFields: true,
  },

  // Reserva rápida genérica (calendário, etc.)
  QUICK_BOOKING: {
    mode: 'quick' as const,
    title: 'Reserva Rápida',
    allowGuestSelection: false, // Sempre cria novo hóspede
    allowMultipleRooms: true,
    showAdvancedFields: false,
  },

  // Reserva do mapa de quartos (quarto e data pré-selecionados)
  ROOM_MAP_BOOKING: {
    mode: 'map' as const,
    title: 'Reserva Rápida',
    allowGuestSelection: false, // Sempre cria novo hóspede
    allowMultipleRooms: false,  // Apenas 1 quarto
    showAdvancedFields: false,
  },
} as const;

// ===== HELPERS PARA USO =====

/**
 * Helper para criar props do StandardReservationModal
 */
export const createReservationModalProps = (
  configName: keyof typeof RESERVATION_MODAL_CONFIGS,
  baseProps: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    reservation?: any;
    prefilledData?: any;
  }
) => {
  const config = RESERVATION_MODAL_CONFIGS[configName];
  
  return {
    ...baseProps,
    ...config,
    isEditing: !!baseProps.reservation,
  };
};
