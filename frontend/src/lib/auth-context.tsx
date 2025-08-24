// src/lib/auth-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import type { UserResponse, TenantResponse, LoginRequest } from '@/types/api';

interface AuthContextType {
  user: UserResponse | null;
  tenant: TenantResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user && apiClient.isAuthenticated();

  // Inicializar dados do usuário ao carregar
  useEffect(() => {
    const initAuth = () => {
      try {
        if (apiClient.isAuthenticated()) {
          const userData = apiClient.getCurrentUser();
          const tenantData = apiClient.getCurrentTenant();
          
          if (userData && tenantData) {
            setUser(userData);
            setTenant(tenantData);
          } else {
            // Token existe mas dados não - fazer logout
            apiClient.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        apiClient.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      const response = await apiClient.login(credentials);
      
      setUser(response.user);
      setTenant(response.tenant);
      
      // Redirecionar para dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    setTenant(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}