// frontend/src/lib/api/users.ts

import apiClient from '../api';

export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  tenant_id: number;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  password: string;
  is_superuser?: boolean;
  tenant_id?: number;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  is_active?: boolean;
  is_superuser?: boolean;
}

export interface AdminResetPassword {
  new_password: string;
  must_change_password?: boolean;
}

export interface UserChangePassword {
  current_password: string;
  new_password: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface UserFilters {
  search?: string;
  is_active?: boolean;
  is_superuser?: boolean;
  page?: number;
  per_page?: number;
}

export class UsersAPI {
  async list(params?: UserFilters): Promise<UserResponse[]> {
    try {
      const response = await apiClient.get('/users/', { params });
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw error;
    }
  }

  async create(data: UserCreate): Promise<UserResponse> {
    const response = await apiClient.post('/users/', data);
    return response.data;
  }

  async getById(id: number): Promise<UserResponse> {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  }

  async update(id: number, data: UserUpdate): Promise<UserResponse> {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }

  async adminResetPassword(id: number, data: AdminResetPassword): Promise<{ message: string; success: boolean }> {
    const response = await apiClient.post(`/users/${id}/admin-reset-password`, data);
    return response.data;
  }

  async changePassword(id: number, data: UserChangePassword): Promise<{ message: string }> {
    const response = await apiClient.post(`/users/${id}/change-password`, data);
    return response.data;
  }
}

export const usersAPI = new UsersAPI();
export default usersAPI;