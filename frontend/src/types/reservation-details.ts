export interface ReservationDetailedResponse {
  id: number;
  reservation_number: string;
  status: string;
  status_display: string;
  created_date: string;
  confirmed_date?: string;
  checked_in_date?: string;
  checked_out_date?: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  adults: number;
  children: number;
  total_guests: number;
  source: string;
  guest_requests?: string;
  is_group_reservation: boolean;
  requires_deposit: boolean;
  is_current: boolean;
  days_since_checkout?: number;
  
  guest: {
    id: number;
    full_name: string;
    email: string;
    phone?: string;
    document_type?: string;
    document_number?: string;
    nationality?: string;
    full_address?: string;
    total_reservations: number;
    completed_stays: number;
    total_nights: number;
    total_spent: string;
  };
  
  property: {
    id: number;
    name: string;
    full_address: string;
    phone?: string;
    email?: string;
    total_rooms: number;
  };
  
  rooms: Array<{
    id: number;
    room_number: string;
    room_type_name: string;
    max_occupancy: number;
    floor?: number;
    rate_per_night: string;
    total_amount: string;
  }>;
  
  payment: {
    total_amount: string;
    paid_amount: string;
    balance_due: string;
    is_overdue: boolean;
    payment_status: string;
    deposit_required: boolean;
  };
  
  actions: {
    can_edit: boolean;
    can_check_in: boolean;
    can_check_out: boolean;
    can_cancel: boolean;
    can_add_payment: boolean;
    edit_blocked_reason?: string;
  };
  
  audit_history: Array<{
    id: number;
    timestamp: string;
    user: { name: string };
    action: string;
    description: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
  }>;
}