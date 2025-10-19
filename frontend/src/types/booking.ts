// frontend/src/types/booking.ts

/**
 * Interface baseada na resposta REAL da API:
 * GET /api/public/properties/{slug}
 */
export interface PropertyPublicInfo {
  property: {
    id: number;
    name: string;
    slug: string;
    description: string;
    address: {
      street: string | null;
      city: string;
      state: string;
      country: string;
      postal_code: string;
      full_address: string;
    };
    contact: {
      phone: string;
      email: string;
      website?: string;
    };
    settings: Record<string, any>;
  };
  // ✅ NOME CORRETO: booking_engine (como vem da API)
  booking_engine: {
    logo_url: string | null;
    primary_color: string;
    welcome_text: string | null;
    gallery_photos: string[];
    testimonials: Array<{
      name: string;
      rating: number;
      text: string;
    }>;
    social_links: Record<string, string>;
    cancellation_policy: string | null;
    house_rules: string | null;
    check_in_time: string;
    check_out_time: string;
  };
  room_types: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
    base_capacity: number;
    max_capacity: number;
    size_m2: number | null;
    bed_configuration: Record<string, any> | null;
    amenities: string[];
  }>;
  amenities: string[];
  policies: {
    cancellation: string | null;
    house_rules: string | null;
    check_in: string;
    check_out: string;
  };
}

export interface SearchParams {
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  adults: number;
  children: number;
}

/**
 * Interface baseada na resposta REAL da API:
 * POST /api/public/availability/search
 */
export interface RoomAvailable {
  room_id: number;
  room_number: string;
  room_name: string;
  room_type: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    base_capacity: number;
    max_capacity: number;
    size_m2: number | null;
    bed_configuration: Record<string, any> | null;
    amenities: string[];
  };
  max_occupancy: number;
  additional_amenities: string[];
  pricing: {
    total_amount: number;
    nights: number;
    average_per_night: number;
    currency: string;
  };
  rate_plan: any | null;
  availability: {
    is_available: boolean;
    check_in: string;
    check_out: string;
  };
}

export interface AvailabilityResponse {
  property_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  total_guests: number;
  available_rooms: RoomAvailable[];
  total_results: number;
}

export interface GuestData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_type?: 'cpf' | 'rg' | 'passport' | 'other';
  document_number?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  date_of_birth?: string;
}

export interface BookingRequest {
  property_slug: string;
  room_id: number;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  guest: GuestData;
  payment_method: string;
  special_requests?: string;
  accepts_terms: boolean;
  accepts_privacy_policy: boolean;
  subscribe_newsletter?: boolean;
  promo_code?: string;
  source?: string;
  referrer?: string;
  extras?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
}

export interface BookingResponse {
  id: number;
  reservation_number: string;
  public_token: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  adults: number;
  children: number;
  total_guests: number;
  total_amount: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  room_info: {
    room_id: number;
    room_number: string;
    room_name: string;
    room_type_name: string;
  };
  payment_method: string;
  special_requests?: string;
  tracking_url: string;
  property_info: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  created_at: string;
  message: string;
}