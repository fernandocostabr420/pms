// frontend/src/hooks/useProperty.ts
'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api';
import { PropertyResponse } from '@/types/api';

interface UsePropertyReturn {
  property: PropertyResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para obter automaticamente a propriedade única do tenant atual.
 * Como cada tenant pode ter apenas uma propriedade, este hook simplifica
 * a seleção automática em modais e formulários.
 */
export function useProperty(): UsePropertyReturn {
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProperty();
  }, []);

  const loadProperty = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar todas as propriedades do tenant (deve retornar apenas 1)
      const response = await apiClient.getProperties({ per_page: 1 });
      
      if (response.properties && response.properties.length > 0) {
        setProperty(response.properties[0]);
      } else {
        setError('Nenhuma propriedade encontrada. Cadastre uma propriedade primeiro.');
        setProperty(null);
      }
    } catch (err: any) {
      console.error('Erro ao carregar propriedade:', err);
      setError('Erro ao carregar propriedade');
      setProperty(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    property,
    loading,
    error
  };
}