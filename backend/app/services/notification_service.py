# backend/app/services/notification_service.py

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Serviço para publicar notificações em tempo real via Redis Pub/Sub.
    Usado para notificar o frontend sobre mudanças via SSE.
    """
    
    # Canais Redis
    CHANNEL_SYNC_UPDATE = "sync:pending-updated"
    CHANNEL_AVAILABILITY_UPDATE = "availability:updated"
    CHANNEL_RESERVATION_UPDATE = "reservation:updated"
    
    def __init__(self):
        """Inicializa conexão com Redis"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Testar conexão
            self.redis_client.ping()
            logger.info("NotificationService: Conectado ao Redis com sucesso")
        except Exception as e:
            logger.error(f"NotificationService: Erro ao conectar ao Redis: {e}")
            self.redis_client = None
    
    def _is_available(self) -> bool:
        """Verifica se o Redis está disponível"""
        if not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except:
            return False
    
    def _publish(self, channel: str, data: Dict[str, Any]) -> bool:
        """
        Publica mensagem em um canal Redis.
        
        Args:
            channel: Nome do canal
            data: Dados a publicar
            
        Returns:
            True se publicado com sucesso, False caso contrário
        """
        if not self._is_available():
            logger.warning(f"Redis não disponível. Notificação não enviada: {channel}")
            return False
        
        try:
            # Adicionar timestamp
            data["timestamp"] = datetime.utcnow().isoformat()
            
            # Publicar no Redis
            message = json.dumps(data)
            self.redis_client.publish(channel, message)
            
            logger.debug(f"Notificação publicada no canal '{channel}': {data}")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao publicar notificação no canal '{channel}': {e}")
            return False
    
    # ============== NOTIFICAÇÕES DE SINCRONIZAÇÃO ==============
    
    def notify_sync_pending_updated(
        self,
        tenant_id: int,
        total: int,
        by_property: Optional[Dict[int, int]] = None,
        oldest_date: Optional[str] = None
    ) -> bool:
        """
        Notifica que a contagem de itens pendentes foi atualizada.
        
        Args:
            tenant_id: ID do tenant
            total: Total de itens pendentes
            by_property: Contagem por propriedade
            oldest_date: Data do item mais antigo pendente
        """
        data = {
            "event": "sync_pending_updated",
            "tenant_id": tenant_id,
            "total": total,
            "by_property": by_property or {},
            "oldest_date": oldest_date
        }
        return self._publish(self.CHANNEL_SYNC_UPDATE, data)
    
    def notify_sync_completed(
        self,
        tenant_id: int,
        configuration_id: int,
        synced_count: int,
        success: bool,
        error: Optional[str] = None
    ) -> bool:
        """
        Notifica que uma sincronização foi concluída.
        
        Args:
            tenant_id: ID do tenant
            configuration_id: ID da configuração
            synced_count: Número de registros sincronizados
            success: Se a sincronização foi bem-sucedida
            error: Mensagem de erro (se houver)
        """
        data = {
            "event": "sync_completed",
            "tenant_id": tenant_id,
            "configuration_id": configuration_id,
            "synced_count": synced_count,
            "success": success,
            "error": error
        }
        return self._publish(self.CHANNEL_SYNC_UPDATE, data)
    
    # ============== NOTIFICAÇÕES DE DISPONIBILIDADE ==============
    
    def notify_availability_updated(
        self,
        tenant_id: int,
        room_ids: list[int],
        date_from: str,
        date_to: str,
        updated_count: int
    ) -> bool:
        """
        Notifica que disponibilidades foram atualizadas.
        
        Args:
            tenant_id: ID do tenant
            room_ids: IDs dos quartos afetados
            date_from: Data inicial
            date_to: Data final
            updated_count: Número de registros atualizados
        """
        data = {
            "event": "availability_updated",
            "tenant_id": tenant_id,
            "room_ids": room_ids,
            "date_from": date_from,
            "date_to": date_to,
            "updated_count": updated_count
        }
        return self._publish(self.CHANNEL_AVAILABILITY_UPDATE, data)
    
    def notify_bulk_update_completed(
        self,
        tenant_id: int,
        affected_records: int,
        success: bool
    ) -> bool:
        """
        Notifica que uma atualização em massa foi concluída.
        
        Args:
            tenant_id: ID do tenant
            affected_records: Número de registros afetados
            success: Se a operação foi bem-sucedida
        """
        data = {
            "event": "bulk_update_completed",
            "tenant_id": tenant_id,
            "affected_records": affected_records,
            "success": success
        }
        return self._publish(self.CHANNEL_AVAILABILITY_UPDATE, data)
    
    # ============== NOTIFICAÇÕES DE RESERVAS ==============
    
    def notify_reservation_created(
        self,
        tenant_id: int,
        reservation_id: int,
        room_ids: list[int]
    ) -> bool:
        """
        Notifica que uma reserva foi criada.
        
        Args:
            tenant_id: ID do tenant
            reservation_id: ID da reserva
            room_ids: IDs dos quartos reservados
        """
        data = {
            "event": "reservation_created",
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "room_ids": room_ids
        }
        return self._publish(self.CHANNEL_RESERVATION_UPDATE, data)
    
    def notify_reservation_updated(
        self,
        tenant_id: int,
        reservation_id: int,
        status: Optional[str] = None
    ) -> bool:
        """
        Notifica que uma reserva foi atualizada.
        
        Args:
            tenant_id: ID do tenant
            reservation_id: ID da reserva
            status: Novo status (se aplicável)
        """
        data = {
            "event": "reservation_updated",
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "status": status
        }
        return self._publish(self.CHANNEL_RESERVATION_UPDATE, data)
    
    # ============== MÉTODO AUXILIAR PARA TESTES ==============
    
    def test_notification(self, tenant_id: int) -> bool:
        """
        Envia notificação de teste.
        Útil para verificar se o sistema de notificações está funcionando.
        """
        data = {
            "event": "test",
            "tenant_id": tenant_id,
            "message": "Notificação de teste enviada com sucesso"
        }
        return self._publish("test:notifications", data)


# Instância global do serviço
notification_service = NotificationService()