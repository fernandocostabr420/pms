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
  
  /**
   * 🆕 Token de autenticação (opcional - se não informado, busca do localStorage)
   */
  token?: string | null;
  
  /**
   * 🆕 Nome da chave do token no localStorage (padrão: 'token')
   */
  tokenStorageKey?: string;
}

/**
 * Hook para consumir Server-Sent Events (SSE) do backend.
 * 
 * @example
 * ```tsx
 * const { connectionState, lastEvent, isConnected } = useServerSentEvents({
 *   onError: (error) => console.error('SSE error:', error),
 *   onConnected: () => console.log('SSE Connected!'),
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
    token: providedToken,
    tokenStorageKey = 'token',
  } = options;

  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🔧 Refs para callbacks (evita recriar connect/disconnect)
  const onErrorRef = useRef(onError);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);

  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onErrorRef.current = onError;
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
  }, [onError, onConnected, onDisconnected]);

  /**
   * 🔑 Obtém o token de autenticação
   */
  const getAuthToken = useCallback((): string | null => {
    // 1. Usar token fornecido como prop (prioridade)
    if (providedToken) {
      return providedToken;
    }

    // 2. Buscar no localStorage com chave configurável
    const storedToken = localStorage.getItem(tokenStorageKey);
    if (storedToken && storedToken !== 'null' && storedToken !== 'undefined') {
      return storedToken;
    }

    // 3. Tentar outras chaves comuns como fallback
    const fallbackKeys = ['authToken', 'access_token', 'jwt', 'auth_token'];
    for (const key of fallbackKeys) {
      const token = localStorage.getItem(key);
      if (token && token !== 'null' && token !== 'undefined') {
        console.warn(`⚠️ SSE: Token encontrado em '${key}' ao invés de '${tokenStorageKey}'`);
        return token;
      }
    }

    // 4. Tentar sessionStorage
    const sessionToken = sessionStorage.getItem(tokenStorageKey);
    if (sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined') {
      return sessionToken;
    }

    console.error(`❌ SSE: Token de autenticação não encontrado em localStorage['${tokenStorageKey}']`);
    return null;
  }, [providedToken, tokenStorageKey]);

  /**
   * Desconecta do endpoint SSE
   */
  const disconnect = useCallback(() => {
    console.log('🔌 SSE: Desconectando...');
    
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
    onDisconnectedRef.current?.();
  }, []);

  /**
   * Conecta ao endpoint SSE
   */
  const connect = useCallback(() => {
    // Se já está conectado, não fazer nada
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('⚠️ SSE: Já está conectado, ignorando nova tentativa');
      return;
    }

    // Limpar conexão anterior se existir
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setConnectionState('connecting');
      
      // 🔑 Obter token de autenticação
      const token = getAuthToken();
      
      if (!token) {
        console.error('❌ SSE: Não foi possível conectar - token ausente');
        setConnectionState('error');
        setLastEvent({
          type: 'error',
          data: {
            message: 'Token de autenticação não encontrado',
            detail: `Certifique-se de que o token está em localStorage['${tokenStorageKey}']`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      // Construir URL com token
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const fullUrl = `${baseUrl}${url}`;
      const urlWithAuth = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
      
      console.log('🔌 SSE: Conectando ao endpoint...', fullUrl);
      console.log('🔑 SSE: Token (primeiros 20 chars):', token.substring(0, 20) + '...');
      
      // Criar nova conexão EventSource
      const eventSource = new EventSource(urlWithAuth);
      eventSourceRef.current = eventSource;

      // 📡 Listener para evento 'connected'
      eventSource.addEventListener('connected', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('✅ SSE: Conectado com sucesso!', data);
          setConnectionState('connected');
          setReconnectAttempts(0);
          setLastEvent({ type: 'connected', data });
          onConnectedRef.current?.();
        } catch (err) {
          console.error('Erro ao parsear evento connected:', err);
        }
      });

      // 📊 Listener para evento 'sync_pending_updated'
      eventSource.addEventListener('sync_pending_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📊 SSE: sync_pending_updated', data);
          setLastEvent({ type: 'sync_pending_updated', data });
        } catch (err) {
          console.error('Erro ao parsear evento sync_pending_updated:', err);
        }
      });

      // ✅ Listener para evento 'sync_completed'
      eventSource.addEventListener('sync_completed', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('✅ SSE: sync_completed', data);
          setLastEvent({ type: 'sync_completed', data });
        } catch (err) {
          console.error('Erro ao parsear evento sync_completed:', err);
        }
      });

      // 🔄 Listener para evento 'availability_updated'
      eventSource.addEventListener('availability_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('🔄 SSE: availability_updated', data);
          setLastEvent({ type: 'availability_updated', data });
        } catch (err) {
          console.error('Erro ao parsear evento availability_updated:', err);
        }
      });

      // 📦 Listener para evento 'bulk_update_completed'
      eventSource.addEventListener('bulk_update_completed', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📦 SSE: bulk_update_completed', data);
          setLastEvent({ type: 'bulk_update_completed', data });
        } catch (err) {
          console.error('Erro ao parsear evento bulk_update_completed:', err);
        }
      });

      // 📝 Listener para evento 'reservation_created'
      eventSource.addEventListener('reservation_created', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📝 SSE: reservation_created', data);
          setLastEvent({ type: 'reservation_created', data });
        } catch (err) {
          console.error('Erro ao parsear evento reservation_created:', err);
        }
      });

      // 📝 Listener para evento 'reservation_updated'
      eventSource.addEventListener('reservation_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('📝 SSE: reservation_updated', data);
          setLastEvent({ type: 'reservation_updated', data });
        } catch (err) {
          console.error('Erro ao parsear evento reservation_updated:', err);
        }
      });

      // 💓 Listener para heartbeat (apenas para manter conexão viva)
      eventSource.addEventListener('heartbeat', () => {
        // Não fazer nada, apenas confirmar que está vivo
        // console.log('💓 SSE: heartbeat');
      });

      // ❌ Listener para evento de erro customizado do backend
      eventSource.addEventListener('error', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data || '{}');
          console.error('❌ SSE: Erro do backend', data);
          setLastEvent({ type: 'error', data });
        } catch (err) {
          // Ignorar se não conseguir parsear
        }
      });

      // ❌ Listener de erro nativo do EventSource
      eventSource.onerror = (error) => {
        console.error('❌ SSE: Erro de conexão', error);
        
        // Verificar se é erro de autenticação (403)
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('❌ SSE: Conexão fechada pelo servidor (possível erro 403)');
        }
        
        setConnectionState('error');
        onErrorRef.current?.(error);

        // Tentar reconectar se habilitado
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          const nextAttempt = reconnectAttempts + 1;
          console.log(`🔄 SSE: Tentativa de reconexão ${nextAttempt}/${maxReconnectAttempts} em ${reconnectInterval}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(nextAttempt);
            connect();
          }, reconnectInterval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error(`❌ SSE: Máximo de tentativas de reconexão atingido (${maxReconnectAttempts})`);
          setConnectionState('disconnected');
          onDisconnectedRef.current?.();
        }
      };

      // 🔓 Listener quando a conexão é aberta
      eventSource.onopen = () => {
        console.log('🔓 SSE: Conexão aberta (readyState: OPEN)');
      };

    } catch (error) {
      console.error('❌ SSE: Falha ao criar conexão EventSource:', error);
      setConnectionState('error');
      setLastEvent({
        type: 'error',
        data: {
          message: 'Falha ao criar conexão SSE',
          error: String(error),
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [
    url,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
    reconnectAttempts,
    getAuthToken,
    tokenStorageKey
  ]);

  /**
   * Tenta reconectar manualmente
   */
  const reconnect = useCallback(() => {
    console.log('🔄 SSE: Reconexão manual solicitada');
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // 🔧 Conectar ao montar - SEM dependências para evitar loop
  useEffect(() => {
    connect();

    // Desconectar ao desmontar
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ Intencionalmente vazio - conecta apenas uma vez

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