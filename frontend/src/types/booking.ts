// frontend/src/types/booking.ts

export interface PropertyPublicInfo {
  property: {
    id: number;
    name: string;
    slug: string;
    description: string;
    address: {
      full: string;
      city: string;
      state: string;
      country: string;
      postal_code: string;
    };
    contact: {
      phone: string;
      email: string;
      website?: string;
    };
    amenities: string[];
    check_in_time: string;
    check_out_time: string;
    has_parking: boolean;
  };
  booking_config: {
    slug: string;
    is_active: boolean;
    branding: {
      logo_url?: string;
      primary_color: string;
      secondary_color?: string;
    };
    content: {
      welcome_text?: string;
      about_text?: string;
      gallery_photos: string[];
      hero_photos: string[];
      testimonials: Array<{
        name: string;
        rating: number;
        text: string;
      }>;
    };
    social_links: {
      facebook?: string;
      instagram?: string;
      whatsapp?: string;
    };
    policies: {
      cancellation?: string;
      house_rules?: string;
      check_in_time: string;
      check_out_time: string;
    };
    booking_settings: {
      instant_booking: boolean;
      require_prepayment: boolean;
      prepayment_percentage?: number;
      default_min_stay: number;
      default_max_stay?: number;
      min_advance_booking_hours: number;
      max_advance_booking_days: number;
    };
    extras: Array<{
      name: string;
      price: number;
      type: string;
    }>;
  };
}

export interface SearchParams {
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  adults: number;
  children: number;
  rooms: number;
}

export interface RoomAvailable {
  room: {
    id: number;
    room_number: string;
    room_type_id: number;
    room_type_name: string;
    description?: string;
    max_occupancy: number;
    base_price: number;
    amenities: string[];
    photos: string[];
  };
  pricing: {
    base_rate: number;
    total_amount: number;
    nights: number;
    rate_per_night: number;
    taxes?: number;
    fees?: number;
  };
  rate_plan?: {
    id: number;
    name: string;
    description?: string;
  };
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
  full_name: string;
  email: string;
  phone: string;
  document_type: 'cpf' | 'rg' | 'passport' | 'other';
  document_number: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  special_requests?: string;
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
  extras?: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface BookingResponse {
  id: number;
  reservation_number: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  guest_name: string;
  guest_email: string;
  confirmation_token: string;
  message: string;
}