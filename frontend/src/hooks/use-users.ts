// frontend/src/hooks/use-users.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import usersAPI, {
  UserResponse,
  UserCreate,
  UserUpdate,
  AdminResetPassword,
  UserFilters
} from '@/lib/api/users';

interface UseUsersReturn {
  users: UserResponse[];
  loading: boolean;
  error: string | null;
  filters: UserFilters;
  
  loadUsers: () => Promise<void>;
  createUser: (data: Omit<UserCreate, 'tenant_id'>) => Promise<UserResponse | null>;
  updateUser: (id: number, data: UserUpdate) => Promise<UserResponse | null>;
  deleteUser: (id: number) => Promise<boolean>;
  adminResetPassword: (id: number, data: AdminResetPassword) => Promise<boolean>;
  setFilters: (filters: UserFilters) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export function useUsers(initialFilters?: UserFilters): UseUsersReturn {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<UserFilters>(initialFilters || {});
  const { toast } = useToast();
  const { tenant } = useAuth();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await usersAPI.list(filters);
      setUsers(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao carregar usuários';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const createUser = useCallback(async (data: Omit<UserCreate, 'tenant_id'>) => {
    try {
      // ✅ CORREÇÃO: Adicionar tenant_id do usuário logado
      if (!tenant?.id) {
        toast({
          title: 'Erro',
          description: 'Tenant não identificado. Faça login novamente.',
          variant: 'destructive'
        });
        return null;
      }

      const userDataWithTenant: UserCreate = {
        ...data,
        tenant_id: tenant.id
      };

      const newUser = await usersAPI.create(userDataWithTenant);
      setUsers(prev => [newUser, ...prev]);
      
      toast({
        title: 'Usuário criado',
        description: `${newUser.full_name} foi criado com sucesso.`
      });
      
      return newUser;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao criar usuário';
      toast({
        title: 'Erro ao criar usuário',
        description: errorMessage,
        variant: 'destructive'
      });
      return null;
    }
  }, [toast, tenant]);

  const updateUser = useCallback(async (id: number, data: UserUpdate) => {
    try {
      const updatedUser = await usersAPI.update(id, data);
      setUsers(prev => prev.map(u => u.id === id ? updatedUser : u));
      
      toast({
        title: 'Usuário atualizado',
        description: `${updatedUser.full_name} foi atualizado com sucesso.`
      });
      
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao atualizar usuário';
      toast({
        title: 'Erro ao atualizar usuário',
        description: errorMessage,
        variant: 'destructive'
      });
      return null;
    }
  }, [toast]);

  const deleteUser = useCallback(async (id: number) => {
    try {
      await usersAPI.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      
      toast({
        title: 'Usuário desativado',
        description: 'Usuário foi desativado com sucesso.'
      });
      
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao desativar usuário';
      toast({
        title: 'Erro ao desativar usuário',
        description: errorMessage,
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  const adminResetPassword = useCallback(async (id: number, data: AdminResetPassword) => {
    try {
      const response = await usersAPI.adminResetPassword(id, data);
      
      toast({
        title: 'Senha resetada',
        description: response.message
      });
      
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao resetar senha';
      toast({
        title: 'Erro ao resetar senha',
        description: errorMessage,
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  const setFilters = useCallback((newFilters: UserFilters) => {
    setFiltersState(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    loading,
    error,
    filters,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    adminResetPassword,
    setFilters,
    clearFilters,
    refresh: loadUsers
  };
}