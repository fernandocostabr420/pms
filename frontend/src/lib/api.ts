// src/lib/api.ts - ARQUIVO COMPLETO + NOVAS FUNCIONALIDADES
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import type { 
  LoginRequest, 
  AuthResponse, 
  PropertyListResponse,
  ReservationListResponse,
  GuestListResponse,
  MessageResponse,
  ReservationResponse,
  ReservationCreate,
  ReservationUpdate,
  ReservationWithDetails,
  GuestResponse,
  GuestCreate,
  GuestUpdate,
  GuestWithStats,
  GuestStats,
  GuestFilters,
  RoomResponse,
  RoomCreate,
  RoomUpdate,
  RoomListResponse,
  RoomFilters,
  RoomWithDetails,
  RoomBulkUpdate,
  RoomStats,
  RoomTypeResponse,
  RoomTypeCreate,
  RoomTypeUpdate,
  RoomTypeListResponse,
  RoomTypeFilters,
  TodaysReservationsResponse,
  CalendarStatsResponse,
  ReservationStats,
  ReservationFilters,
  AvailabilityCheckRequest,
  AvailabilityCheckResponse,
  CheckInRequest,
  CheckOutRequest,
  CancelReservationRequest,
  AvailabilityRequest
} from '@/types/api';

import {
  RoomAvailabilityResponse,
  RoomAvailabilityCreate,
  RoomAvailabilityUpdate,
  RoomAvailabilityListResponse,
  RoomAvailabilityFilters,
  BulkAvailabilityUpdate,
  CalendarAvailabilityRequest,
  CalendarAvailabilityResponse,
  AvailabilityStatsResponse,
  RoomAvailabilityCheckResponse,
} from '@/types/room-availability';

import {
  MapResponse,
  MapStatsResponse,
  MapFilters,
  MapBulkOperation,
  MapQuickBooking,
  RoomAvailabilityData,
  CategorySummaryData,
} from '@/types/room-map';

// Novos tipos adicionados para funcionalidades expandidas
import {
  ReservationFilters as ReservationFiltersNew,
  ReservationResponseWithGuestDetails,
  ReservationListResponseWithDetails,
  ReservationExportFilters,
  ReservationExportResponse,
  CheckInRequest as CheckInRequestNew,
  CheckOutRequest as CheckOutRequestNew,
  CancelReservationRequest as CancelReservationRequestNew,
  AvailabilityRequest as AvailabilityRequestNew,
  AvailabilityResponse,
  DashboardStats,
  GuestDetails,
  PropertyDetails
} from '@/types/reservation';

interface ReservationStatsExtended {
  total_reservations: number;
  total_revenue: number;
  avg_occupancy: number;
  avg_nights: number;
  avg_guests: number;
  status_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
  monthly_revenue: Array<{
    month: string;
    revenue: number;
    reservations: number;
  }>;
}

// ===== NOVOS TIPOS PARA DASHBOARD =====
export interface RecentReservationResponse {
  id: number;
  reservation_number: string;
  guest_name: string | null;
  guest_email: string | null;
  property_name: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  total_paid?: number;
  balance_due: string;
  nights: number;
  created_at: string;
  // Todos os outros campos de ReservationResponseWithGuestDetails
}

export interface CheckedInPendingPayment {
  reservation_id: number;
  guest_name: string;
  room_number: string;
  check_in_date: string;
  pending_amount: number;
  days_since_checkin: number;
  total_amount: number;
  paid_amount: number;
  total_paid?: number;
  payment_status: 'pending' | 'overdue';
}

export interface DashboardSummary {
  total_reservations: number;
  todays_checkins: number;
  todays_checkouts: number;
  current_guests: number;
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  checked_in_with_pending_payment: number;
  summary_date: string;
  property_id: number | null;
}

export interface TodaysReservationsImproved {
  date: string;
  arrivals_count: number;
  departures_count: number;
  current_guests_count: number;
  arrivals: any[];
  departures: any[];
  current_guests: any[];
}

// ✅ NOVOS IMPORTS PARA FUNCIONALIDADES ADMINISTRATIVAS DE PAGAMENTOS
import {
  PaymentResponse,
  PaymentListResponse, 
  PaymentCreate,
  PaymentUpdate,
  PaymentStatusUpdate,
  // ✅ NOVOS TIPOS PARA FUNCIONALIDADES ADMINISTRATIVAS
  PaymentConfirmedUpdate,
  PaymentDeleteConfirmed,
  PaymentPermissions,
  PaymentSecurityWarning
} from '@/types/payment';

class PMSApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://72.60.50.223:8000';
    
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - adiciona token JWT
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - trata erros e refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshToken();
            const token = this.getToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ===== TOKEN MANAGEMENT =====
  private getToken(): string | null {
    return Cookies.get('access_token') || null;
  }

  private getRefreshToken(): string | null {
    return Cookies.get('refresh_token') || null;
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    // Access token expira em expiresIn segundos
    const accessExpires = new Date(Date.now() + expiresIn * 1000);
    // Refresh token expira em 7 dias (como no backend)
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    Cookies.set('access_token', accessToken, { 
      expires: accessExpires,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    Cookies.set('refresh_token', refreshToken, { 
      expires: refreshExpires,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }

  private removeTokens() {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    Cookies.remove('user_data');
    Cookies.remove('tenant_data');
  }

  // ===== AUTH METHODS =====
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/auth/login', credentials);
      const { user, tenant, token } = response.data;
      
      // Salvar tokens
      this.setTokens(token.access_token, token.refresh_token, token.expires_in);
      
      // Salvar dados do usuário e tenant
      Cookies.set('user_data', JSON.stringify(user), { expires: 7 });
      Cookies.set('tenant_data', JSON.stringify(tenant), { expires: 7 });
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.client.post('/auth/refresh', {
        refresh_token: refreshToken
      });
      
      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
      this.setTokens(access_token, newRefreshToken, expires_in);
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  logout(): void {
    this.removeTokens();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser() {
    const userData = Cookies.get('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  getCurrentTenant() {
    const tenantData = Cookies.get('tenant_data');
    return tenantData ? JSON.parse(tenantData) : null;
  }

  // ✅ NOVO MÉTODO: Verificar se o usuário atual tem permissões de administrador
  async checkAdminPermissions(): Promise<boolean> {
    try {
      // Primeiro verificar no cache local
      const userData = this.getCurrentUser();
      if (userData && userData.is_superuser !== undefined) {
        return userData.is_superuser;
      }
      
      // Se não tem no cache, buscar do servidor
      const response = await this.get<{ is_superuser: boolean }>('/auth/me');
      return response.data.is_superuser;
    } catch (error) {
      console.error('Erro ao verificar permissões de admin:', error);
      return false;
    }
  }

  // ===== GENERIC HTTP METHODS =====
  
  async get<T>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, { params });
  }

  async post<T>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data);
  }

  async put<T>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data);
  }

  async delete<T>(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, options);
  }

  // ===== PROPERTIES API =====
  
  async getProperties(params?: { 
    page?: number; 
    per_page?: number; 
    search?: string;
    property_type?: string;
  }) {
    const response = await this.client.get<PropertyListResponse>('/properties/', { params });
    return response.data;
  }

  async getProperty(id: number) {
    const response = await this.client.get(`/properties/${id}`);
    return response.data;
  }

  // Novo método para compatibilidade com novas funcionalidades
  async getPropertyById(id: number, includeRooms = false): Promise<PropertyDetails> {
    const params = includeRooms ? { include_rooms: true } : {};
    const response = await this.client.get<PropertyDetails>(`/properties/${id}`, { params });
    return response.data;
  }

  async createProperty(data: any) {
    // Normalizar dados para compatibilidade com backend
    const normalizedData = {
      ...data,
      // Gerar slug automaticamente se não fornecido
      slug: data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      // Corrigir nome do campo de endereço
      address_line1: data.address_line_1 || data.address_line1,
    };
    
    // Remover campo com nome incorreto
    delete normalizedData.address_line_1;
    
    const response = await this.client.post('/properties/', normalizedData);
    return response.data;
  }

  async updateProperty(id: number, data: any) {
    const response = await this.client.put(`/properties/${id}`, data);
    return response.data;
  }

  async deleteProperty(id: number) {
    const response = await this.client.delete(`/properties/${id}`);
    return response.data;
  }

   // ===== RESERVATIONS API (MÉTODOS ORIGINAIS MANTIDOS + EXPANDIDOS) =====

  async getReservations(params?: { 
    page?: number; 
    per_page?: number; 
    status?: string;
    source?: string;
    property_id?: number;
    guest_id?: number;
    check_in_from?: string;
    check_in_to?: string;
    check_out_from?: string;
    check_out_to?: string;
    created_from?: string;
    created_to?: string;
    min_amount?: number;
    max_amount?: number;
    is_paid?: boolean;
    requires_deposit?: boolean;
    is_group_reservation?: boolean;
    search?: string;
    
    // ===== NOVOS PARÂMETROS ADICIONADOS =====
    guest_email?: string;
    guest_phone?: string;
    guest_nationality?: string;
    guest_city?: string;
    guest_country?: string;
    cancelled_from?: string;
    cancelled_to?: string;
    confirmed_from?: string;
    confirmed_to?: string;
    actual_checkin_from?: string;
    actual_checkin_to?: string;
    actual_checkout_from?: string;
    actual_checkout_to?: string;
    min_guests?: number;
    max_guests?: number;
    min_nights?: number;
    max_nights?: number;
    room_type_id?: number;
    room_number?: string;
    has_special_requests?: boolean;
    has_internal_notes?: boolean;
    deposit_paid?: boolean;
    payment_status?: string;
    include_guest_details?: boolean;
    include_room_details?: boolean;
    include_payment_summary?: boolean;
  }): Promise<ReservationListResponse | ReservationListResponseWithDetails> {
    // Limpar parâmetros nulos/vazios para os novos filtros
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, value]) => 
        value !== null && value !== undefined && value !== '' && value !== 'all'
      )
    );

    // Se tem parâmetros expandidos, usar a nova interface
    const hasExpandedParams = cleanParams.include_guest_details || 
                              cleanParams.include_room_details || 
                              cleanParams.guest_email ||
                              cleanParams.guest_phone;
    
    if (hasExpandedParams) {
      const response = await this.client.get<ReservationListResponseWithDetails>('/reservations/', { params: cleanParams });
      return response.data;
    } else {
      const response = await this.client.get<ReservationListResponse>('/reservations/', { params: cleanParams });
      return response.data;
    }
  }

  // ===== NOVO MÉTODO PRINCIPAL PARA A TABELA =====
  async getReservationsWithDetails(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    source?: string;
    property_id?: number;
    guest_id?: number;
    check_in_from?: string;
    check_in_to?: string;
    check_out_from?: string;
    check_out_to?: string;
    created_from?: string;
    created_to?: string;
    search?: string;
    guest_email?: string;
    guest_phone?: string;
    guest_document_type?: string;
    guest_nationality?: string;
    guest_city?: string;
    guest_state?: string;
    guest_country?: string;
    cancelled_from?: string;
    cancelled_to?: string;
    confirmed_from?: string;
    confirmed_to?: string;
    actual_checkin_from?: string;
    actual_checkin_to?: string;
    actual_checkout_from?: string;
    actual_checkout_to?: string;
    min_guests?: number;
    max_guests?: number;
    min_nights?: number;
    max_nights?: number;
    room_type_id?: number;
    room_number?: string;
    has_special_requests?: boolean;
    has_internal_notes?: boolean;
    deposit_paid?: boolean;
    payment_status?: string;
    marketing_source?: string;
    is_current?: boolean;
    can_check_in?: boolean;
    can_check_out?: boolean;
    can_cancel?: boolean;
    min_amount?: number;
    max_amount?: number;
    is_paid?: boolean;
    requires_deposit?: boolean;
    is_group_reservation?: boolean;
  }): Promise<ReservationListResponseWithDetails> {
    // Limpar parâmetros nulos/vazios
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, value]) => 
        value !== null && value !== undefined && value !== '' && value !== 'all'
      )
    );

    // Sempre incluir detalhes para este método
    cleanParams.include_guest_details = true;
    cleanParams.include_room_details = true;
    cleanParams.include_payment_details = true;

    try {
      const response = await this.client.get<ReservationListResponseWithDetails>('/reservations/detailed', { params: cleanParams });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao carregar reservas detalhadas:', error);
      
      // Fallback: tentar o endpoint padrão se o detalhado não existir
      try {
        const fallbackResponse = await this.getReservations({
          ...cleanParams,
          include_guest_details: true,
          include_room_details: true,
        });
        
        // Converter para o formato expandido se necessário
        if ('reservations' in fallbackResponse && Array.isArray(fallbackResponse.reservations)) {
          return {
            reservations: fallbackResponse.reservations.map(reservation => ({
              ...reservation,
              guest_phone: reservation.guest?.phone || undefined,
              guest_document_type: reservation.guest?.document_type || undefined,
              guest_document_number: reservation.guest?.document_number || undefined,
              guest_nationality: reservation.guest?.nationality || undefined,
              guest_city: reservation.guest?.city || undefined,
              guest_state: reservation.guest?.state || undefined,
              guest_country: reservation.guest?.country || undefined,
              property_address: reservation.property?.address || undefined,
              property_phone: reservation.property?.phone || undefined,
              property_city: reservation.property?.city || undefined,
            })) as ReservationResponseWithGuestDetails[],
            total: fallbackResponse.total,
            page: fallbackResponse.page,
            pages: fallbackResponse.pages,
            per_page: fallbackResponse.per_page,
            summary: {
              total_amount: 0,
              total_paid: 0,
              total_pending: 0,
              status_counts: {},
              source_counts: {},
              avg_nights: 0,
              avg_guests: 0,
              avg_amount: 0,
            }
          };
        }
        
        throw new Error('Formato de resposta inválido');
      } catch (fallbackError) {
        throw error; // Lançar o erro original se o fallback também falhar
      }
    }
  }

  async createReservation(data: ReservationCreate) {
    const response = await this.client.post<ReservationResponse>('/reservations/', data);
    return response.data;
  }

  async getReservation(id: number) {
    const response = await this.client.get<ReservationResponse>(`/reservations/${id}`);
    return response.data;
  }

  // Novo método expandido
  async getReservationById(id: number, includeDetails = true): Promise<ReservationResponseWithGuestDetails> {
    const params = includeDetails ? { include_details: true } : {};
    const response = await this.client.get<ReservationResponseWithGuestDetails>(`/reservations/${id}`, { params });
    return response.data;
  }

  async getReservationWithDetails(id: number) {
    const response = await this.client.get<ReservationWithDetails>(`/reservations/${id}/details`);
    return response.data;
  }

  async updateReservation(id: number, data: ReservationUpdate) {
    const response = await this.client.put<ReservationResponse>(`/reservations/${id}`, data);
    return response.data;
  }

  async getReservationByNumber(reservationNumber: string) {
    const response = await this.client.get<ReservationResponse>(`/reservations/number/${reservationNumber}`);
    return response.data;
  }

  async getTodaysReservations(propertyId?: number) {
    const params = propertyId ? { property_id: propertyId } : {};
    const response = await this.client.get('/reservations/today', { params });
    return response.data;
  }

  // Método original de disponibilidade
  async checkAvailability(data: AvailabilityRequest): Promise<AvailabilityResponse> {
    const response = await this.client.post<AvailabilityResponse>('/reservations/check-availability', data);
    return response.data;
  }

  // Novo método de disponibilidade expandido
  async checkAvailabilityNew(request: AvailabilityRequestNew): Promise<AvailabilityResponse> {
    const response = await this.client.post<AvailabilityResponse>('/reservations/availability', request);
    return response.data;
  }

  // ===== MÉTODOS DE AÇÕES RÁPIDAS ATUALIZADOS =====
  async confirmReservation(reservationId: number): Promise<ReservationResponseWithGuestDetails> {
    try {
      const response = await this.client.patch<ReservationResponseWithGuestDetails>(`/reservations/${reservationId}/confirm`);
      return response.data;
    } catch (error: any) {
      // Fallback para método original se o novo não existir
      try {
        const fallbackResponse = await this.client.patch<ReservationResponse>(`/reservations/${reservationId}/confirm`);
        return fallbackResponse.data as ReservationResponseWithGuestDetails;
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  async checkInReservation(
    reservationId: number,
    data: CheckInRequest | CheckInRequestNew
  ): Promise<ReservationResponseWithGuestDetails> {
    try {
      const response = await this.client.post<ReservationResponseWithGuestDetails>(`/reservations/${reservationId}/check-in`, data);
      return response.data;
    } catch (error: any) {
      // Fallback para método original
      try {
        const fallbackResponse = await this.client.post<ReservationResponse>(`/reservations/${reservationId}/check-in`, data);
        return fallbackResponse.data as ReservationResponseWithGuestDetails;
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  async checkOutReservation(
    reservationId: number,
    data: CheckOutRequest | CheckOutRequestNew
  ): Promise<ReservationResponseWithGuestDetails> {
    try {
      const response = await this.client.post<ReservationResponseWithGuestDetails>(`/reservations/${reservationId}/check-out`, data);
      return response.data;
    } catch (error: any) {
      // Fallback para método original
      try {
        const fallbackResponse = await this.client.post<ReservationResponse>(`/reservations/${reservationId}/check-out`, data);
        return fallbackResponse.data as ReservationResponseWithGuestDetails;
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  async cancelReservation(
    reservationId: number,
    data: CancelReservationRequest | CancelReservationRequestNew
  ): Promise<ReservationResponseWithGuestDetails> {
    try {
      const response = await this.client.post<ReservationResponseWithGuestDetails>(`/reservations/${reservationId}/cancel`, data);
      return response.data;
    } catch (error: any) {
      // Fallback para método original
      try {
        const fallbackResponse = await this.client.post<ReservationResponse>(`/reservations/${reservationId}/cancel`, data);
        return fallbackResponse.data as ReservationResponseWithGuestDetails;
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  // ===== MÉTODO DE EXPORTAÇÃO ATUALIZADO =====
  async exportReservations(filters?: ReservationExportFilters): Promise<Blob> {
    const cleanParams = Object.fromEntries(
      Object.entries(filters || {}).filter(([_, value]) => 
        value !== null && value !== undefined && value !== ''
      )
    );

    try {
      const response = await this.client.get('/reservations/export', {
        params: {
          ...cleanParams,
          format: 'xlsx',
        },
        responseType: 'blob',
      });

      return response.data;
    } catch (error: any) {
      // Fallback: usar endpoint alternativo ou método CSV
      try {
        const response = await this.client.post('/reservations/export', cleanParams, {
          responseType: 'blob',
        });
        return response.data;
      } catch (fallbackError) {
        console.error('Erro ao exportar reservas:', error);
        throw error;
      }
    }
  }

  // ===== MÉTODO DE DASHBOARD STATS ATUALIZADO =====
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await this.client.get<DashboardStats>('/reservations/dashboard/stats');
      return response.data;
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas do dashboard:', error);
      
      // Fallback: tentar endpoint original
      try {
        const fallbackResponse = await this.getDashboardStatsSimple();
        return {
          total_reservations: fallbackResponse.total_reservations || 0,
          total_revenue: fallbackResponse.total_revenue || 0,
          occupancy_rate: 0,
          pending_checkins: fallbackResponse.arrivals_today || 0,
          pending_checkouts: fallbackResponse.departures_today || 0,
          overdue_payments: 0,
          avg_nights: 0,
          avg_guests: 0,
          avg_amount: 0,
          this_month_reservations: 0,
          this_month_revenue: 0,
          last_month_reservations: 0,
          last_month_revenue: 0,
          status_distribution: {},
          source_distribution: {},
          recent_activity: [],
        };
      } catch (fallbackError) {
        // Retornar dados padrão em caso de erro completo
        return {
          total_reservations: 0,
          total_revenue: 0,
          occupancy_rate: 0,
          pending_checkins: 0,
          pending_checkouts: 0,
          overdue_payments: 0,
          avg_nights: 0,
          avg_guests: 0,
          avg_amount: 0,
          this_month_reservations: 0,
          this_month_revenue: 0,
          last_month_reservations: 0,
          last_month_revenue: 0,
          status_distribution: {},
          source_distribution: {},
          recent_activity: [],
        };
      }
    }
  }

  async getCalendarMonth(
    year: number,
    month: number,
    propertyId?: number
  ): Promise<ReservationResponse[]> {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });

    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }

    const response = await this.client.get(`/reservations/calendar/month?${params}`);
    return response.data;
  }

  async getCalendarRange(
    startDate: string,
    endDate: string,
    propertyId?: number,
    status?: string
  ): Promise<ReservationResponse[]> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }

    if (status) {
      params.append('status', status);
    }

    const response = await this.client.get(`/reservations/calendar/range?${params}`);
    return response.data;
  }

  async getReservationStats(propertyId?: number): Promise<ReservationStats> {
    const params = propertyId ? { property_id: propertyId } : {};
    const response = await this.client.get<ReservationStats>('/reservations/stats/general', { params });
    return response.data;
  }

  async getDashboardStatsOriginal(propertyId?: number, daysBack?: number): Promise<CalendarStatsResponse> {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }
    if (daysBack) {
      params.append('days_back', daysBack.toString());
    }

    const response = await this.client.get(`/reservations/stats/dashboard?${params}`);
    return response.data;
  }

  async advancedSearchReservations(
    filters: ReservationFilters | ReservationFiltersNew,
    page = 1,
    per_page = 20,
    order_by = 'created_date',
    order_direction = 'desc'
  ): Promise<ReservationListResponse | ReservationListResponseWithDetails> {
    const response = await this.client.post<ReservationListResponseWithDetails>(
      `/reservations/advanced-search?page=${page}&per_page=${per_page}&order_by=${order_by}&order_direction=${order_direction}`, 
      filters
    );
    return response.data;
  }

  // ===== NOVOS MÉTODOS DE RESERVA ADICIONADOS =====

  async exportReservationsCSV(filters: ReservationExportFilters): Promise<ReservationExportResponse> {
    const response = await this.client.post<ReservationExportResponse>('/reservations/export', filters);
    return response.data;
  }

  async getOccupancyAnalysis(
    propertyId?: number,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }
    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    const response = await this.client.get(`/reservations/analysis/occupancy?${params}`);
    return response.data;
  }

  // ===== GUESTS API (MÉTODOS ORIGINAIS MANTIDOS) =====
  
  async getGuests(params?: { 
    page?: number; 
    per_page?: number; 
    search?: string;
    has_email?: boolean;
    has_document?: boolean;
    nationality?: string;
    city?: string;
    state?: string;
    marketing_consent?: string;
  }) {
    const response = await this.client.get<GuestListResponse>('/guests/', { params });
    return response.data;
  }

  async createGuest(data: GuestCreate) {
    const response = await this.client.post<GuestResponse>('/guests/', data);
    return response.data;
  }

  async getGuest(id: number) {
    const response = await this.client.get<GuestResponse>(`/guests/${id}`);
    return response.data;
  }

  // Novo método expandido
  async getGuestById(id: number, includeStats = false): Promise<GuestDetails> {
    const params = includeStats ? { include_stats: true } : {};
    const response = await this.client.get<GuestDetails>(`/guests/${id}`, { params });
    return response.data;
  }

  async getGuestWithStats(id: number) {
    const response = await this.client.get<GuestWithStats>(`/guests/${id}/stats`);
    return response.data;
  }

  async updateGuest(id: number, data: GuestUpdate) {
    const response = await this.client.put<GuestResponse>(`/guests/${id}`, data);
    return response.data;
  }

  async deleteGuest(id: number) {
    await this.client.delete(`/guests/${id}`);
  }

  async searchGuests(query: string, limit: number = 10) {
    const response = await this.client.get<GuestResponse[]>('/guests/search', {
      params: { q: query, limit }
    });
    return response.data;
  }

  // Novos métodos de busca expandida
  async searchGuestsExpanded(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    has_email?: boolean;
    has_document?: boolean;
    nationality?: string;
    city?: string;
    state?: string;
    marketing_consent?: string;
  }): Promise<GuestListResponse> {
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, value]) => 
        value !== null && value !== undefined && value !== ''
      )
    );

    const response = await this.client.get<GuestListResponse>('/guests', { params: cleanParams });
    return response.data;
  }

  async checkEmailAvailability(email: string, excludeGuestId?: number) {
    try {
      if (!email || email.trim().length === 0) {
        return { available: true };
      }
      
      let url = `/guests/check/email?email=${encodeURIComponent(email.trim())}`;
      if (excludeGuestId) {
        url += `&exclude_guest_id=${excludeGuestId}`;
      }
      
      const response = await this.client.get<{ available: boolean }>(url);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao verificar email:', error);
      return { available: true };
    }
  }

  async checkDocumentAvailability(document: string, excludeGuestId?: number) {
    try {
      // Validação básica - não enviar se documento estiver vazio
      if (!document || document.trim().length === 0) {
        return { available: true };
      }
      
      const params = new URLSearchParams();
      params.append('document_number', document.trim());
      if (excludeGuestId) {
        params.append('exclude_guest_id', excludeGuestId.toString());
      }
      
      const response = await this.client.get<{ available: boolean }>(`/guests/check/document?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao verificar documento:', error);
      throw error;
    }
  }

  async getGuestStats() {
    const response = await this.client.get<GuestStats>('/guests/stats/general');
    return response.data;
  }

  async advancedSearchGuests(filters: GuestFilters, page = 1, per_page = 20) {
    const response = await this.client.post<GuestListResponse>(`/guests/advanced-search?page=${page}&per_page=${per_page}`, filters);
    return response.data;
  }

  async mergeGuests(primaryGuestId: number, secondaryGuestId: number) {
    const response = await this.client.post<GuestResponse>('/guests/merge', {
      primary_guest_id: primaryGuestId,
      secondary_guest_id: secondaryGuestId
    });
    return response.data;
  }

// ===== ROOM TYPES API (MÉTODOS ORIGINAIS MANTIDOS) =====

async getRoomTypes(params?: {
  page?: number;
  per_page?: number;
  is_bookable?: boolean;
  min_capacity?: number;
  max_capacity?: number;
  has_amenity?: string;
  search?: string;
}): Promise<RoomTypeListResponse> {
  const response = await this.get<RoomTypeListResponse>('/room-types/', params);
  return response.data;
}

async createRoomType(data: RoomTypeCreate): Promise<RoomTypeResponse> {
  const response = await this.post<RoomTypeResponse>('/room-types/', data);
  return response.data;
}

async getRoomType(id: number): Promise<RoomTypeResponse> {
  const response = await this.get<RoomTypeResponse>(`/room-types/${id}`);
  return response.data;
}

async updateRoomType(id: number, data: RoomTypeUpdate): Promise<RoomTypeResponse> {
  const response = await this.put<RoomTypeResponse>(`/room-types/${id}`, data);
  return response.data;
}

async deleteRoomType(id: number): Promise<void> {
  await this.delete(`/room-types/${id}`);
}

async getRoomTypeBySlug(slug: string): Promise<RoomTypeResponse> {
  const response = await this.get<RoomTypeResponse>(`/room-types/slug/${slug}`);
  return response.data;
}

async toggleRoomTypeBookable(id: number): Promise<RoomTypeResponse> {
  const response = await this.client.patch<RoomTypeResponse>(`/room-types/${id}/toggle-bookable`);
  return response.data;
}

async getRoomTypeStats(id: number): Promise<any> {
  const response = await this.get<any>(`/room-types/${id}/stats`);
  return response.data;
}

async getAvailableAmenities(): Promise<string[]> {
  const response = await this.get<{ amenities: string[] }>('/room-types/meta/amenities');
  return response.data.amenities;
}

async searchRoomTypes(filters: RoomTypeFilters, page = 1, per_page = 20): Promise<RoomTypeListResponse> {
  const response = await this.post<RoomTypeListResponse>(`/room-types/search?page=${page}&per_page=${per_page}`, filters);
  return response.data;
}

// ===== ROOMS API (MÉTODOS ORIGINAIS MANTIDOS) =====

async getRooms(params?: {
  page?: number;
  per_page?: number;
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
}): Promise<RoomListResponse> {
  const response = await this.get<RoomListResponse>('/rooms/', params);
  return response.data;
}

async createRoom(data: RoomCreate): Promise<RoomResponse> {
  const response = await this.post<RoomResponse>('/rooms/', data);
  return response.data;
}

async getRoom(id: number): Promise<RoomResponse> {
  const response = await this.get<RoomResponse>(`/rooms/${id}`);
  return response.data;
}

async getRoomWithDetails(id: number): Promise<RoomWithDetails> {
  const response = await this.get<RoomWithDetails>(`/rooms/${id}/details`);
  return response.data;
}

async updateRoom(id: number, data: RoomUpdate): Promise<RoomResponse> {
  const response = await this.put<RoomResponse>(`/rooms/${id}`, data);
  return response.data;
}

async deleteRoom(id: number): Promise<void> {
  await this.delete(`/rooms/${id}`);
}

async toggleRoomOperational(id: number): Promise<RoomResponse> {
  const response = await this.client.patch<RoomResponse>(`/rooms/${id}/toggle-operational`);
  return response.data;
}

async bulkUpdateRooms(data: RoomBulkUpdate): Promise<any> {
  const response = await this.post<any>('/rooms/bulk-update', data);
  return response.data;
}

async getRoomsByProperty(propertyId: number): Promise<RoomResponse[]> {
  const response = await this.get<RoomResponse[]>(`/rooms/by-property/${propertyId}`);
  return response.data;
}

async getRoomsByType(roomTypeId: number): Promise<RoomResponse[]> {
  const response = await this.get<RoomResponse[]>(`/rooms/by-type/${roomTypeId}`);
  return response.data;
}

async getRoomStats(propertyId?: number): Promise<RoomStats> {
  const params = propertyId ? { property_id: propertyId } : undefined;
  const response = await this.get<RoomStats>('/rooms/stats/general', params);
  return response.data;
}

async searchRooms(filters: RoomFilters, page = 1, per_page = 20): Promise<RoomListResponse> {
  const response = await this.post<RoomListResponse>(`/rooms/search?page=${page}&per_page=${per_page}`, filters);
  return response.data;
}

async checkRoomNumberAvailability(roomNumber: string, propertyId: number): Promise<{ available: boolean }> {
  const response = await this.get<{ available: boolean }>(`/rooms/check-number/${roomNumber}`, { property_id: propertyId });
  return response.data;
}

  // ===== ROOM AVAILABILITY METHODS (MÉTODOS ORIGINAIS MANTIDOS) =====
  
  async getRoomAvailabilities(params?: {
    page?: number;
    per_page?: number;
    room_id?: number;
    property_id?: number;
    room_type_id?: number;
    date_from?: string;
    date_to?: string;
    is_available?: boolean;
    is_blocked?: boolean;
    is_out_of_order?: boolean;
    is_maintenance?: boolean;
    is_reserved?: boolean;
    is_bookable?: boolean;
    closed_to_arrival?: boolean;
    closed_to_departure?: boolean;
    has_rate_override?: boolean;
    min_rate?: number;
    max_rate?: number;
    search?: string;
  }): Promise<RoomAvailabilityListResponse> {
    const response = await this.get<RoomAvailabilityListResponse>('/room-availability/', params);
    return response.data;
  }

  async createRoomAvailability(data: RoomAvailabilityCreate): Promise<RoomAvailabilityResponse> {
    const response = await this.post<RoomAvailabilityResponse>('/room-availability/', data);
    return response.data;
  }

  async getRoomAvailability(id: number): Promise<RoomAvailabilityResponse> {
    const response = await this.get<RoomAvailabilityResponse>(`/room-availability/${id}`);
    return response.data;
  }

  async updateRoomAvailability(id: number, data: RoomAvailabilityUpdate): Promise<RoomAvailabilityResponse> {
    const response = await this.put<RoomAvailabilityResponse>(`/room-availability/${id}`, data);
    return response.data;
  }

  async deleteRoomAvailability(id: number): Promise<void> {
    await this.delete(`/room-availability/${id}`);
  }

  async bulkUpdateAvailability(data: BulkAvailabilityUpdate): Promise<{ 
    updated: number; 
    created: number; 
    message: string; 
  }> {
    const response = await this.post<{ 
      updated: number; 
      created: number; 
      message: string; 
    }>('/room-availability/bulk-update', data);
    return response.data;
  }

  async getRoomCalendar(
    roomId: number, 
    dateFrom: string, 
    dateTo: string
  ): Promise<RoomAvailabilityResponse[]> {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    
    const response = await this.get<RoomAvailabilityResponse[]>(
      `/room-availability/room/${roomId}/calendar?${params}`
    );
    return response.data;
  }

  async getCalendarRange(data: CalendarAvailabilityRequest): Promise<CalendarAvailabilityResponse[]> {
    const response = await this.post<CalendarAvailabilityResponse[]>(
      '/room-availability/calendar/range', 
      data
    );
    return response.data;
  }

  async checkRoomAvailability(
    roomId: number,
    checkInDate: string,
    checkOutDate: string
  ): Promise<RoomAvailabilityCheckResponse> {
    const params = new URLSearchParams({
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
    });

    const response = await this.get<RoomAvailabilityCheckResponse>(
      `/room-availability/check/${roomId}?${params}`
    );
    return response.data;
  }

  async getAvailabilityStats(params?: {
    date_from?: string;
    date_to?: string;
    property_id?: number;
  }): Promise<AvailabilityStatsResponse> {
    const response = await this.get<AvailabilityStatsResponse>(
      '/room-availability/stats/general', 
      params
    );
    return response.data;
  }

  async getRoomAvailabilityByDate(
    roomId: number, 
    targetDate: string
  ): Promise<RoomAvailabilityResponse> {
    const response = await this.get<RoomAvailabilityResponse>(
      `/room-availability/room/${roomId}/date/${targetDate}`
    );
    return response.data;
  }

  async searchRoomAvailabilities(
    filters: RoomAvailabilityFilters, 
    page = 1, 
    per_page = 20
  ): Promise<RoomAvailabilityListResponse> {
    const response = await this.post<RoomAvailabilityListResponse>(
      `/room-availability/search?page=${page}&per_page=${per_page}`, 
      filters
    );
    return response.data;
  }

// ===== MAPA DE QUARTOS API (MÉTODOS ORIGINAIS MANTIDOS) =====

async getMapData(filters: MapFilters): Promise<MapResponse> {
  const params = new URLSearchParams();
  params.append('start_date', filters.start_date);
  params.append('end_date', filters.end_date);
  
  if (filters.property_id) {
    params.append('property_id', filters.property_id.toString());
  }
  
  if (filters.room_type_ids && filters.room_type_ids.length > 0) {
    params.append('room_type_ids', filters.room_type_ids.join(','));
  }
  
  if (filters.include_out_of_order !== undefined) {
    params.append('include_out_of_order', filters.include_out_of_order.toString());
  }
  
  if (filters.include_cancelled !== undefined) {
    params.append('include_cancelled', filters.include_cancelled.toString());
  }
  
  if (filters.status_filter && filters.status_filter.length > 0) {
    params.append('status_filter', filters.status_filter.join(','));
  }

  const response = await this.client.get<MapResponse>(`/map/data?${params}`);
  return response.data;
}

async getMapStats(
  startDate: string, 
  endDate: string, 
  propertyId?: number
): Promise<MapStatsResponse> {
  const params = new URLSearchParams();
  params.append('start_date', startDate);
  params.append('end_date', endDate);
  
  if (propertyId) {
    params.append('property_id', propertyId.toString());
  }

  const response = await this.client.get<MapStatsResponse>(`/map/stats?${params}`);
  return response.data;
}

async executeBulkOperation(operation: MapBulkOperation): Promise<any> {
  const response = await this.client.post('/map/bulk-operation', operation);
  return response.data;
}

async createQuickBooking(booking: MapQuickBooking): Promise<any> {
  const response = await this.client.post('/map/quick-booking', booking);
  return response.data;
}

async getRoomAvailabilityFromMap(
  roomId: number,
  startDate: string,
  endDate: string
): Promise<RoomAvailabilityData> {
  const params = new URLSearchParams();
  params.append('start_date', startDate);
  params.append('end_date', endDate);

  const response = await this.client.get<RoomAvailabilityData>(
    `/map/room-availability/${roomId}?${params}`
  );
  return response.data;
}

async getCategorySummary(
  startDate: string,
  endDate: string,
  propertyId?: number
): Promise<CategorySummaryData[]> {
  const params = new URLSearchParams();
  params.append('start_date', startDate);
  params.append('end_date', endDate);
  
  if (propertyId) {
    params.append('property_id', propertyId.toString());
  }

  const response = await this.client.get<CategorySummaryData[]>(`/map/category-summary?${params}`);
  return response.data;
}

  // ===== CALENDAR METHODS (MÉTODOS ORIGINAIS MANTIDOS) =====

  // Método original de disponibilidade para calendário
  async checkAvailabilityCalendar(data: AvailabilityCheckRequest): Promise<AvailabilityCheckResponse> {
    const response = await this.client.post('/reservations/check-availability', data);
    return response.data;
  }

  async getTodaysReservationsCalendar(propertyId?: number): Promise<TodaysReservationsResponse> {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }

    const response = await this.client.get(`/reservations/today?${params}`);
    return response.data;
  }

  // ===== DASHBOARD STATS (MÉTODOS ORIGINAIS MANTIDOS) =====
  
  async getDashboardStatsSimple() {
    try {
      const response = await this.client.get('/reservations/stats/dashboard');
      return response.data;
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        total_reservations: 0,
        arrivals_today: 0,
        departures_today: 0,
        current_guests: 0,
        total_revenue: 0,
        pending_revenue: 0
      };
    }
  }

// ===== NOVOS MÉTODOS PARA DASHBOARD (INSERIR APÓS getDashboardStatsSimple) =====

async getRecentReservations(limit: number = 5, propertyId?: number): Promise<RecentReservationResponse[]> {
  const params: any = { limit };
  if (propertyId) {
    params.property_id = propertyId;
  }
  
  const response = await this.get<RecentReservationResponse[]>('/reservations/recent', params);
  return response.data;
}

async getCheckedInPendingPayments(limit: number = 10, propertyId?: number): Promise<CheckedInPendingPayment[]> {
  const params: any = { limit };
  if (propertyId) {
    params.property_id = propertyId;
  }
  
  const response = await this.get<CheckedInPendingPayment[]>('/reservations/checked-in-pending-payment', params);
  return response.data;
}

async getDashboardSummary(propertyId?: number): Promise<DashboardSummary> {
  const params = propertyId ? { property_id: propertyId } : undefined;
  
  const response = await this.get<DashboardSummary>('/reservations/dashboard-summary', params);
  return response.data;
}

async getTodaysReservationsImproved(propertyId?: number, includeDetails: boolean = false): Promise<TodaysReservationsImproved> {
  const params: any = { include_details: includeDetails };
  if (propertyId) {
    params.property_id = propertyId;
  }
  
  const response = await this.get<TodaysReservationsImproved>('/reservations/today', params);
  return response.data;
}

  // ===== GENERIC REQUEST METHOD (MÉTODO ORIGINAL MANTIDO) =====

  async request<T>(endpoint: string, options?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request({
      url: endpoint,
      ...options,
    });
    return response.data;
  }

  // ===== PAYMENT METHODS (MÉTODOS ORIGINAIS + NOVOS ADMINISTRATIVOS) =====

async getPayments(params?: {
  page?: number;
  per_page?: number;
  reservation_id?: number;
  status?: string;
  payment_method?: string;
  payment_date_from?: string;
  payment_date_to?: string;
  min_amount?: number;
  max_amount?: number;
  is_partial?: boolean;
  is_refund?: boolean;
  search?: string;
}): Promise<PaymentListResponse> {
  const response = await this.get<PaymentListResponse>('/payments/', params);
  return response.data;
}

async createPayment(data: PaymentCreate): Promise<PaymentResponse> {
  const response = await this.post<PaymentResponse>('/payments/', data);
  return response.data;
}

async getPayment(id: number): Promise<PaymentResponse> {
  const response = await this.get<PaymentResponse>(`/payments/${id}`);
  return response.data;
}

// ✅ MÉTODO MODIFICADO: updatePayment - suporte para pagamentos confirmados
async updatePayment(
  id: number, 
  data: PaymentUpdate | PaymentConfirmedUpdate
): Promise<PaymentResponse> {
  // Verificar se é uma atualização de pagamento confirmado (tem admin_reason)
  if ('admin_reason' in data && data.admin_reason) {
    // Usar endpoint específico para pagamentos confirmados
    return await this.updateConfirmedPayment(id, data as PaymentConfirmedUpdate);
  } else {
    // Método original
    const response = await this.put<PaymentResponse>(`/payments/${id}`, data);
    return response.data;
  }
}

// ✅ MÉTODO MODIFICADO: deletePayment - suporte para justificativas
async deletePayment(
  id: number, 
  justification?: { admin_reason: string }
): Promise<void> {
  if (justification) {
    // Se tem justificativa, usar endpoint específico para pagamentos confirmados
    await this.delete(`/payments/${id}`, { data: justification });
  } else {
    // Método original para pagamentos não confirmados
    await this.delete(`/payments/${id}`);
  }
}

// ✅ MÉTODO CORRIGIDO: updatePaymentStatus - usar PATCH ao invés de PUT
async updatePaymentStatus(id: number, data: PaymentStatusUpdate): Promise<PaymentResponse> {
  // ✅ CORREÇÃO: Mudar de PUT para PATCH
  const response = await this.client.patch<PaymentResponse>(`/payments/${id}/status`, data);
  return response.data;
}

async getPaymentByNumber(paymentNumber: string): Promise<PaymentResponse> {
  const response = await this.get<PaymentResponse>(`/payments/by-number/${paymentNumber}`);
  return response.data;
}

async getPaymentsByReservation(reservationId: number): Promise<PaymentResponse[]> {
  const response = await this.get<PaymentResponse[]>(`/payments/by-reservation/${reservationId}`);
  return response.data;
}

// ===== ✅ NOVOS MÉTODOS ADMINISTRATIVOS PARA PAGAMENTOS CONFIRMADOS =====

/**
 * Verifica as permissões do usuário para um pagamento específico
 */
async getPaymentPermissions(id: number): Promise<PaymentPermissions> {
  const response = await this.get<PaymentPermissions>(`/payments/${id}/permissions`);
  return response.data;
}

/**
 * Obtém aviso de segurança para operações sensíveis
 */
async getPaymentSecurityWarning(
  id: number, 
  operation: 'edit_confirmed' | 'delete_confirmed'
): Promise<PaymentSecurityWarning> {
  const response = await this.get<PaymentSecurityWarning>(
    `/payments/${id}/security-warning`,
    { operation }
  );
  return response.data;
}

/**
 * Atualiza pagamento confirmado com justificativa obrigatória (apenas admin)
 */
async updateConfirmedPayment(
  id: number, 
  data: PaymentConfirmedUpdate
): Promise<PaymentResponse> {
  const response = await this.put<PaymentResponse>(`/payments/${id}/confirmed`, data);
  return response.data;
}

/**
 * Exclui pagamento confirmado com justificativa obrigatória (apenas admin)
 */
async deleteConfirmedPayment(
  id: number, 
  data: PaymentDeleteConfirmed
): Promise<void> {
  await this.delete(`/payments/${id}/confirmed`, { data });
}

/**
 * Obtém histórico de alterações administrativas em um pagamento
 */
async getPaymentAuditLog(id: number): Promise<any[]> {
  const response = await this.get<any[]>(`/payments/${id}/audit-log`);
  return response.data;
}

  // ===== CRIAR RESERVA RÁPIDA (MÉTODO ORIGINAL MANTIDO) =====

  async createQuickReservation(data: {
    guest_id?: number;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    property_id: number;
    check_in_date: string;
    check_out_date: string;
    adults: number;
    children: number;
    rooms: { room_id: number; rate_per_night?: number }[];
    total_amount?: number;
    source?: string;
    guest_requests?: string;
  }): Promise<ReservationResponse> {
    // Se não tem guest_id, cria o hóspede primeiro
    let guestId = data.guest_id;

    if (!guestId && data.guest_name) {
      const guest = await this.createGuest({
        first_name: data.guest_name.split(' ')[0] || data.guest_name,
        last_name: data.guest_name.split(' ').slice(1).join(' ') || '',
        email: data.guest_email || '',
        phone: data.guest_phone || '',
      });
      guestId = guest.id;
    }

    if (!guestId) {
      throw new Error('Guest ID or guest information is required');
    }

    const reservationData = {
      guest_id: guestId,
      property_id: data.property_id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      adults: data.adults,
      children: data.children,
      rooms: data.rooms,
      total_amount: data.total_amount || 0,
      source: data.source || 'direct',
      guest_requests: data.guest_requests,
    };

    return this.createReservation(reservationData);
  }

  // Método para buscar detalhes completos da reserva
  async getReservationDetailed(id: number): Promise<ReservationDetailedResponse> {
    const response = await this.client.get(`/reservations/${id}/detailed`);
    return response.data;
  }

  // ===== NOVOS MÉTODOS UTILITÁRIOS ADICIONADOS =====

  // Método para fazer download de arquivos
  async downloadFile(url: string, filename?: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao fazer download do arquivo');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download.csv';
      document.body.appendChild(link);
      link.click();

      // Limpar
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro no download:', error);
      throw error;
    }
  }

  // Método para formatar parâmetros de URL
  private buildQueryParams(params: Record<string, any>): URLSearchParams {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== 'all') {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v.toString()));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });
    
    return queryParams;
  }

  // Método para tratar erros de API
  private handleApiError(error: any): never {
    if (error.response) {
      // Erro da API com resposta
      const message = error.response.data?.detail || 
                      error.response.data?.message || 
                      'Erro na requisição';
      throw new Error(message);
    } else if (error.request) {
      // Erro de rede
      throw new Error('Erro de conexão. Verifique sua internet.');
    } else {
      // Outros erros
      throw new Error(error.message || 'Erro desconhecido');
    }
  }
}

// Export singleton instance
export const apiClient = new PMSApiClient();
export default apiClient;