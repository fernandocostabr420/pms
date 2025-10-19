// frontend/src/lib/api/booking.ts
import type {
  PropertyPublicInfo,
  SearchParams,
  AvailabilityResponse,
  BookingRequest,
  BookingResponse,
} from '@/types/booking';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Busca informações públicas da propriedade
 */
export async function getPropertyInfo(slug: string): Promise<PropertyPublicInfo> {
  const response = await fetch(`${API_BASE_URL}/api/public/properties/${slug}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erro ao buscar informações da propriedade');
  }

  return response.json();
}

/**
 * Busca disponibilidade de quartos
 */
export async function searchAvailability(
  slug: string,
  params: SearchParams
): Promise<AvailabilityResponse> {
  const queryParams = new URLSearchParams({
    slug,
    check_in: params.check_in,
    check_out: params.check_out,
    adults: params.adults.toString(),
    children: params.children.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/public/availability/search?${queryParams}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erro ao buscar disponibilidade');
  }

  return response.json();
}

/**
 * Cria uma nova reserva
 */
export async function createBooking(
  bookingData: BookingRequest
): Promise<BookingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/public/booking/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookingData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erro ao criar reserva');
  }

  return response.json();
}

/**
 * Busca status de uma reserva pelo token
 */
export async function getBookingStatus(token: string): Promise<BookingResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/public/booking/${token}/status`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erro ao buscar status da reserva');
  }

  return response.json();
}