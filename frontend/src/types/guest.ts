// frontend/src/types/guest.ts

export interface GuestResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
  date_of_birth: string | null;
  nationality: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  preferences: Record<string, any> | null;
  notes: string | null;
  marketing_consent: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Campos computados
  full_name: string;
  display_document: string | null;
  full_address: string | null;
}

export interface GuestWithStats extends GuestResponse {
  total_reservations: number;
  completed_stays: number;
  cancelled_reservations: number;
  total_nights: number;
  last_stay_date: string | null;
}

export interface GuestCreate {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  document_type?: string;
  document_number?: string;
  date_of_birth?: string;
  nationality: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  preferences?: Record<string, any>;
  notes?: string;
  marketing_consent: string;
}

export interface GuestUpdate extends Partial<GuestCreate> {}

export interface GuestFilters {
  has_email?: boolean;
  has_document?: boolean;
  nationality?: string;
  city?: string;
  state?: string;
  marketing_consent?: string;
  search?: string;
}

export interface GuestListResponse {
  guests: GuestResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface GuestStats {
  total_guests: number;
  guests_with_email: number;
  guests_with_document: number;
  email_percentage: number;
  document_percentage: number;
  marketing_consent: {
    yes: number;
    no: number;
    not_asked: number;
  };
}