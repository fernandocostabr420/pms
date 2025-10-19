// frontend/src/types/rooms.ts

// ===== ROOM TYPES =====
export interface RoomResponse {
  id: number;
  name: string;
  room_number: string;
  property_id: number;
  room_type_id: number;
  floor: number | null;
  building: string | null;
  is_operational: boolean;
  is_out_of_order: boolean;
  is_available_for_booking: boolean;
  max_occupancy: number;
  effective_max_occupancy: number;
  housekeeping_notes: string | null;
  maintenance_notes: string | null;
  notes: string | null;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

export interface RoomWithDetails extends RoomResponse {
  property_name: string | null;
  room_type_name: string | null;
  room_type?: RoomTypeResponse;
  property_obj?: any;
}

export interface RoomListResponse {
  rooms: RoomResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface RoomCreate {
  name: string;
  room_number: string;
  property_id: number;
  room_type_id: number;
  floor?: number;
  building?: string;
  max_occupancy?: number;
  housekeeping_notes?: string;
  maintenance_notes?: string;
  notes?: string;
}

export interface RoomUpdate {
  name?: string;
  room_number?: string;
  room_type_id?: number;
  floor?: number;
  building?: string;
  max_occupancy?: number;
  housekeeping_notes?: string;
  maintenance_notes?: string;
  notes?: string;
  is_operational?: boolean;
  is_out_of_order?: boolean;
}

export interface RoomFilters {
  property_id?: number;
  room_type_id?: number;
  floor?: number;
  building?: string;
  is_operational?: boolean;
  is_out_of_order?: boolean;
  is_available_for_booking?: boolean;
  min_occupancy?: number;
  max_occupancy?: number;
  has_amenity?: string;
  search?: string;
}

export interface RoomBulkUpdate {
  room_ids: number[];
  updates: Record<string, any>;
}

export interface RoomStats {
  total_rooms: number;
  operational_rooms: number;
  out_of_order_rooms: number;
  maintenance_rooms: number;
  occupancy_rate: number;
}

// ===== ROOM TYPE TYPES =====
export interface RoomTypeResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  base_capacity: number;
  max_capacity: number;
  base_amenities: string[] | null;
  additional_amenities: string[] | null;
  removed_amenities: string[] | null;
  is_bookable: boolean;
  sort_order: number;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

export interface RoomTypeWithStats extends RoomTypeResponse {
  rooms_count: number;
  operational_rooms: number;
  out_of_order_rooms: number;
  average_occupancy?: number;
}

export interface RoomTypeListResponse {
  room_types: RoomTypeResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface RoomTypeCreate {
  name: string;
  description?: string;
  base_capacity: number;
  max_capacity: number;
  base_amenities?: string[];
  additional_amenities?: string[];
  is_bookable?: boolean;
  sort_order?: number;
}

export interface RoomTypeUpdate {
  name?: string;
  description?: string;
  base_capacity?: number;
  max_capacity?: number;
  base_amenities?: string[];
  additional_amenities?: string[];
  removed_amenities?: string[];
  is_bookable?: boolean;
  sort_order?: number;
}

export interface RoomTypeFilters {
  is_bookable?: boolean;
  min_capacity?: number;
  max_capacity?: number;
  has_amenity?: string;
  search?: string;
}