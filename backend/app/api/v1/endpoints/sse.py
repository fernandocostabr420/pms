# backend/app/api/v1/endpoints/sse.py

import asyncio
import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


class SSEConnection:
    """Gerencia conexão SSE individual"""
    
    def __init__(self, tenant_id: int):
        self.tenant_id = tenant_id
        self.redis_client = None
        self.pubsub = None
        self.connected = True
    
    async def connect_redis(self):
        """Conecta ao Redis para Pub/Sub"""
        try:
            self.redis_client = await aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.pubsub = self.redis_client.pubsub()
            
            # Subscrever nos canais relevantes
            await self.pubsub.subscribe(
                "sync:pending-updated",
                "availability:updated",
                "reservation:updated"
            )
            
            logger.info(f"SSE: Cliente conectado ao Redis (tenant {self.tenant_id})")
            return True
            
        except Exception as e:
            logger.error(f"SSE: Erro ao conectar Redis: {e}")
            return False
    
    async def disconnect(self):
        """Desconecta do Redis"""
        self.connected = False
        
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info(f"SSE: Cliente desconectado (tenant {self.tenant_id})")
    
    async def listen(self) -> AsyncGenerator[str, None]:
        """
        Escuta mensagens do Redis e gera eventos SSE.
        
        Yields:
            Eventos SSE formatados
        """
        if not await self.connect_redis():
            yield self._format_sse_message(
                "error",
                {"message": "Falha ao conectar ao serviço de notificações"}
            )
            return
        
        # Enviar evento inicial de conexão
        yield self._format_sse_message(
            "connected",
            {"tenant_id": self.tenant_id, "timestamp": asyncio.get_event_loop().time()}
        )
        
        # Enviar heartbeat a cada 30 segundos
        heartbeat_interval = 30
        last_heartbeat = asyncio.get_event_loop().time()
        
        try:
            while self.connected:
                # Verificar se há mensagens (timeout de 1 segundo)
                try:
                    message = await asyncio.wait_for(
                        self.pubsub.get_message(ignore_subscribe_messages=True),
                        timeout=1.0
                    )
                    
                    if message and message['type'] == 'message':
                        # Processar mensagem
                        data = json.loads(message['data'])
                        
                        # Filtrar por tenant (segurança)
                        if data.get('tenant_id') == self.tenant_id:
                            event_type = data.get('event', 'update')
                            yield self._format_sse_message(event_type, data)
                
                except asyncio.TimeoutError:
                    # Timeout normal, continuar loop
                    pass
                
                # Enviar heartbeat se necessário
                current_time = asyncio.get_event_loop().time()
                if current_time - last_heartbeat >= heartbeat_interval:
                    yield self._format_sse_message("heartbeat", {})
                    last_heartbeat = current_time
                
                # Pequeno delay para não sobrecarregar CPU
                await asyncio.sleep(0.1)
        
        except asyncio.CancelledError:
            logger.info(f"SSE: Conexão cancelada (tenant {self.tenant_id})")
        
        except Exception as e:
            logger.error(f"SSE: Erro no loop de eventos: {e}")
            yield self._format_sse_message(
                "error",
                {"message": f"Erro na conexão: {str(e)}"}
            )
        
        finally:
            await self.disconnect()
    
    @staticmethod
    def _format_sse_message(event: str, data: dict) -> str:
        """
        Formata mensagem no padrão SSE.
        
        Args:
            event: Nome do evento
            data: Dados do evento
            
        Returns:
            Mensagem SSE formatada
        """
        message = f"event: {event}\n"
        message += f"data: {json.dumps(data)}\n\n"
        return message


@router.get("/events")
async def sse_events(
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint SSE para receber notificações em tempo real.
    
    O cliente deve conectar usando EventSource:
    ```javascript
    const eventSource = new EventSource('/api/v1/sse/events');
    ```
    
    Eventos emitidos:
    - `connected`: Conexão estabelecida
    - `sync_pending_updated`: Contagem de sync pendente atualizada
    - `sync_completed`: Sincronização concluída
    - `availability_updated`: Disponibilidade atualizada
    - `bulk_update_completed`: Atualização em massa concluída
    - `reservation_created`: Nova reserva criada
    - `reservation_updated`: Reserva atualizada
    - `heartbeat`: Heartbeat para manter conexão viva
    - `error`: Erro na conexão
    """
    
    # Criar conexão SSE para este tenant
    sse_conn = SSEConnection(tenant_id=current_user.tenant_id)
    
    # Retornar streaming response
    return StreamingResponse(
        sse_conn.listen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx
        }
    )


@router.get("/test")
async def test_sse(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint para testar notificações SSE.
    Envia uma notificação de teste que será recebida pelos clientes conectados.
    """
    from app.services.notification_service import notification_service
    
    success = notification_service.test_notification(current_user.tenant_id)
    
    if success:
        return {
            "success": True,
            "message": "Notificação de teste enviada. Clientes SSE devem recebê-la."
        }
    else:
        return {
            "success": False,
            "message": "Falha ao enviar notificação. Verifique se o Redis está rodando."
        }