// frontend/src/hooks/useServerSentEvents.ts

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Tipos de eventos SSE que podem ser recebidos
 */
export type SSEEventType = 
  | 'connected'
  | 'sync_pending_updated'
  | 'sync_completed'
  | 'availability_updated'
  | 'bulk_update_completed'
  | 'reservation_created'
  | 'reservation_updated'
  | 'heartbeat'
  | 'error';

/**
 * Estrutura base de dados de um evento SSE
 */
export interface SSEEventData {
  timestamp?: string;
  tenant_id?: number;
  [key: string]: any;
}

/**
 * Evento SSE completo
 */
export interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
}

/**
 * Estado da conexão SSE
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Opções do hook useServerSentEvents
 */
export interface UseSSEOptions {
  /**
   * URL do endpoint SSE (padrão: /api/v1/sse/events)
   */
  url?: string;
  
  /**
   * Se deve reconectar automaticamente em caso de erro (padrão: true)
   */
  autoReconnect?: boolean;
  
  /**
   * Intervalo entre tentativas de reconexão em ms (padrão: 3000)
   */
  reconnectInterval?: number;
  
  /**
   * Número máximo de tentativas de reconexão (padrão: 10)
   */
  maxReconnectAttempts?: number;
  
  /**
   * Callback chamado quando há erro de conexão
   */
  onError?: (error: Event) => void;
  
  /**
   * Callback chamado quando a conexão é estabelecida
   */
  onConnected?: () => void;
  
  /**
   * Callback chamado quando a conexão é perdida
   */
  onDisconnected?: () => void;
}

/**
 * Hook para consumir Server-Sent Events (SSE) do backend.
 * 
 * @example
 * ```tsx
 * const { connectionState, lastEvent } = useServerSentEvents({
 *   onError: (error) => console.error('SSE error:', error),
 * });
 * 
 * useEffect(() => {
 *   if (lastEvent?.type === 'sync_pending_updated') {
 *     console.log('Sync updated:', lastEvent.data);
 *   }
 * }, [lastEvent]);
 * ```
 */
export function useServerSentEvents(options: UseSSEOptions = {}) {
  const {
    url = '/api/v1/sse/events',
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onError,
    onConnected,
    onDisconnected,
  } = options;

  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Conecta ao endpoint SSE
   */
  const connect = useCallback(() => {
    // Se já está conectado, não fazer nada
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Limpar conexão anterior se existir
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      setConnectionState('connecting');
      
      // Obter token de autenticação do localStorage
      const token = localStorage.getItem('token');
      
      // Construir URL com token
      const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`;
      const urlWithAuth = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${token}`;
      
      // Criar nova conexão EventSource
      const eventSource = new EventSource(urlWithAuth);
      eventSourceRef.current = eventSource;

      // Listener para evento 'connected'
      eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        setConnectionState('connected');
        setReconnectAttempts(0);
        setLastEvent({ type: 'connected', data });
        onConnected?.();
      });

      // Listener para evento 'sync_pending_updated'
      eventSource.addEventListener('sync_pending_updated', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'sync_pending_updated', data });
      });

      // Listener para evento 'sync_completed'
      eventSource.addEventListener('sync_completed', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'sync_completed', data });
      });

      // Listener para evento 'availability_updated'
      eventSource.addEventListener('availability_updated', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'availability_updated', data });
      });

      // Listener para evento 'bulk_update_completed'
      eventSource.addEventListener('bulk_update_completed', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'bulk_update_completed', data });
      });

      // Listener para evento 'reservation_created'
      eventSource.addEventListener('reservation_created', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'reservation_created', data });
      });

      // Listener para evento 'reservation_updated'
      eventSource.addEventListener('reservation_updated', (e) => {
        const data = JSON.parse(e.data);
        setLastEvent({ type: 'reservation_updated', data });
      });

      // Listener para heartbeat (apenas para manter conexão viva)
      eventSource.addEventListener('heartbeat', () => {
        // Não fazer nada, apenas confirmar que está vivo
      });

      // Listener para erros
      eventSource.addEventListener('error', (e) => {
        const data = JSON.parse((e as MessageEvent).data || '{}');
        setLastEvent({ type: 'error', data });
      });

      // Listener de erro do EventSource
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setConnectionState('error');
        onError?.(error);

        // Tentar reconectar se habilitado
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setConnectionState('disconnected');
          onDisconnected?.();
        }
      };

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      setConnectionState('error');
    }
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts, onError, onConnected, onDisconnected]);

  /**
   * Desconecta do endpoint SSE
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState('disconnected');
    setReconnectAttempts(0);
    onDisconnected?.();
  }, [onDisconnected]);

  /**
   * Tenta reconectar manualmente
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Conectar ao montar o componente
  useEffect(() => {
    connect();

    // Desconectar ao desmontar
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    /**
     * Estado atual da conexão SSE
     */
    connectionState,
    
    /**
     * Último evento recebido
     */
    lastEvent,
    
    /**
     * Número de tentativas de reconexão
     */
    reconnectAttempts,
    
    /**
     * Função para reconectar manualmente
     */
    reconnect,
    
    /**
     * Função para desconectar
     */
    disconnect,
    
    /**
     * Se está conectado
     */
    isConnected: connectionState === 'connected',
    
    /**
     * Se está conectando
     */
    isConnecting: connectionState === 'connecting',
    
    /**
     * Se está com erro
     */
    hasError: connectionState === 'error',
  };
}