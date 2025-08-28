// src/lib/api.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import type { 
  LoginRequest, 
  AuthResponse, 
  PropertyListResponse,
  ReservationListResponse,
  GuestListResponse,
  MessageResponse 
} from '@/types/api';

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

  async delete<T>(url: string): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url);
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

  // ===== RESERVATIONS API =====
  
  async getReservations(params?: { 
    page?: number; 
    per_page?: number; 
    status?: string;
    search?: string;
  }) {
    const response = await this.client.get<ReservationListResponse>('/reservations', { params });
    return response.data;
  }

  async getTodaysReservations(propertyId?: number) {
    const params = propertyId ? { property_id: propertyId } : {};
    const response = await this.client.get('/reservations/today', { params });
    return response.data;
  }

  // ===== GUESTS API =====
  
  async getGuests(params?: { 
    page?: number; 
    per_page?: number; 
    search?: string;
  }) {
    const response = await this.client.get<GuestListResponse>('/guests', { params });
    return response.data;
  }

  // ===== DASHBOARD STATS =====
  
  async getDashboardStats() {
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

  // ===== GENERIC REQUEST METHOD =====

  async request<T>(endpoint: string, options?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request({
      url: endpoint,
      ...options,
    });
    return response.data;
  }

  // ===== CALENDAR METHODS =====

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

  async checkAvailability(data: AvailabilityCheckRequest): Promise<AvailabilityCheckResponse> {
    const response = await this.client.post('/reservations/check-availability', data);
    return response.data;
  }

  async getDashboardStats(propertyId?: number): Promise<CalendarStatsResponse> {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }

    const response = await this.client.get(`/reservations/stats/dashboard?${params}`);
    return response.data;
  }

  async getTodaysReservations(propertyId?: number): Promise<TodaysReservationsResponse> {
    const params = new URLSearchParams();
    if (propertyId) {
      params.append('property_id', propertyId.toString());
    }

    const response = await this.client.get(`/reservations/today?${params}`);
    return response.data;
  }

  async confirmReservation(reservationId: number): Promise<ReservationResponse> {
    const response = await this.client.patch(`/reservations/${reservationId}/confirm`);
    return response.data;
  }

  async checkInReservation(
    reservationId: number,
    data: { notes?: string; actual_check_in_time?: string }
  ): Promise<ReservationResponse> {
    const response = await this.client.post(`/reservations/${reservationId}/check-in`, data);
    return response.data;
  }

  async checkOutReservation(
    reservationId: number,
    data: { notes?: string; actual_check_out_time?: string; final_charges?: number }
  ): Promise<ReservationResponse> {
    const response = await this.client.post(`/reservations/${reservationId}/check-out`, data);
    return response.data;
  }

  async cancelReservation(
    reservationId: number,
    data: { cancellation_reason: string; refund_amount?: number; notes?: string }
  ): Promise<ReservationResponse> {
    const response = await this.client.post(`/reservations/${reservationId}/cancel`, data);
    return response.data;
  }

  // Criar reserva rápida (usando endpoint existente)
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
}

// Export singleton instance
export const apiClient = new PMSApiClient();
export default apiClient;