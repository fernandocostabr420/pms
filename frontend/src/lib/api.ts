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
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
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

  // ===== API METHODS =====
  
  // Properties
  async getProperties(params?: { page?: number; per_page?: number; search?: string }) {
    const response = await this.client.get<PropertyListResponse>('/properties', { params });
    return response.data;
  }

  // Reservations
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

  // Guests
  async getGuests(params?: { page?: number; per_page?: number; search?: string }) {
    const response = await this.client.get<GuestListResponse>('/guests', { params });
    return response.data;
  }

  // Dashboard Stats
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

  // Generic request method
  async request<T>(endpoint: string, options?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request({
      url: endpoint,
      ...options,
    });
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new PMSApiClient();
export default apiClient;