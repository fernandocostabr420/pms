# backend/app/services/notification_service.py

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisConnectionError(Exception):
    """Exceção customizada para erros de conexão Redis"""
    pass


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
        self.redis_client = None
        self._connection_attempts = 0
        self._max_connection_attempts = 3
        self._connect_to_redis()
    
    def _connect_to_redis(self):
        """Tenta conectar ao Redis"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )
            # Testar conexão
            self.redis_client.ping()
            logger.info("✅ NotificationService: Conectado ao Redis com sucesso")
            self._connection_attempts = 0
        except Exception as e:
            self._connection_attempts += 1
            logger.error(
                f"❌ NotificationService: Erro ao conectar ao Redis (tentativa {self._connection_attempts}): {e}"
            )
            self.redis_client = None
            
            # Se falhar após máximo de tentativas, logar aviso crítico
            if self._connection_attempts >= self._max_connection_attempts:
                logger.critical(
                    f"🔴 CRÍTICO: NotificationService não conseguiu conectar ao Redis após "
                    f"{self._max_connection_attempts} tentativas. SSE não funcionará!"
                )
    
    def _is_available(self) -> bool:
        """
        Verifica se o Redis está disponível.
        Tenta reconectar se desconectado.
        """
        if not self.redis_client:
            # Tentar reconectar se ainda não atingiu o máximo de tentativas
            if self._connection_attempts < self._max_connection_attempts:
                logger.info("🔄 Tentando reconectar ao Redis...")
                self._connect_to_redis()
            return self.redis_client is not None
        
        try:
            self.redis_client.ping()
            return True
        except Exception as e:
            logger.warning(f"⚠️ Redis ping falhou: {e}. Tentando reconectar...")
            self.redis_client = None
            
            # Tentar reconectar
            if self._connection_attempts < self._max_connection_attempts:
                self._connect_to_redis()
            
            return self.redis_client is not None
    
    def _publish(self, channel: str, data: Dict[str, Any], critical: bool = False) -> bool:
        """
        Publica mensagem em um canal Redis.
        
        Args:
            channel: Nome do canal
            data: Dados a publicar
            critical: Se True, lança exceção quando Redis não disponível
            
        Returns:
            True se publicado com sucesso, False caso contrário
            
        Raises:
            RedisConnectionError: Se critical=True e Redis não disponível
        """
        if not self._is_available():
            error_msg = f"Redis não disponível. Notificação não enviada: {channel}"
            
            if critical:
                logger.error(f"🔴 CRÍTICO: {error_msg}")
                raise RedisConnectionError(error_msg)
            else:
                logger.warning(f"⚠️ {error_msg}")
                return False
        
        try:
            # Adicionar timestamp e metadados
            data["timestamp"] = datetime.utcnow().isoformat()
            data["service"] = "notification_service"
            data["channel"] = channel
            
            # Publicar no Redis
            message = json.dumps(data)
            subscribers = self.redis_client.publish(channel, message)
            
            logger.debug(
                f"📤 Notificação publicada no canal '{channel}' "
                f"(subscribers: {subscribers}): {data.get('event', 'unknown')}"
            )
            
            # Alertar se não há subscribers
            if subscribers == 0:
                logger.warning(
                    f"⚠️ Nenhum subscriber conectado no canal '{channel}'. "
                    f"Evento: {data.get('event', 'unknown')}"
                )
            
            return True
            
        except redis.RedisError as e:
            logger.error(f"❌ Erro Redis ao publicar notificação no canal '{channel}': {e}")
            self.redis_client = None  # Marcar para reconexão
            
            if critical:
                raise RedisConnectionError(f"Erro ao publicar notificação: {e}")
            return False
            
        except Exception as e:
            logger.error(
                f"❌ Erro inesperado ao publicar notificação no canal '{channel}': {e}",
                exc_info=True
            )
            
            if critical:
                raise RedisConnectionError(f"Erro ao publicar notificação: {e}")
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
        
        # ✅ CRÍTICO: Este evento é importante para UX
        success = self._publish(self.CHANNEL_SYNC_UPDATE, data, critical=False)
        
        if success:
            logger.info(f"✅ sync_pending_updated enviado - tenant={tenant_id}, total={total}")
        else:
            logger.error(f"❌ FALHA ao enviar sync_pending_updated - tenant={tenant_id}, total={total}")
        
        return success
    
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
        
        # ✅ CRÍTICO: Este evento é importante para UX
        result = self._publish(self.CHANNEL_SYNC_UPDATE, data, critical=False)
        
        if result:
            logger.info(
                f"✅ sync_completed enviado - tenant={tenant_id}, "
                f"synced={synced_count}, success={success}"
            )
        else:
            logger.error(
                f"❌ FALHA ao enviar sync_completed - tenant={tenant_id}, "
                f"synced={synced_count}"
            )
        
        return result
    
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
        
        result = self._publish(self.CHANNEL_AVAILABILITY_UPDATE, data, critical=False)
        
        if result:
            logger.debug(
                f"✅ availability_updated enviado - tenant={tenant_id}, "
                f"rooms={len(room_ids)}, count={updated_count}"
            )
        
        return result
    
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
        
        # ✅ CRÍTICO: Este evento é importante para UX
        result = self._publish(self.CHANNEL_AVAILABILITY_UPDATE, data, critical=False)
        
        if result:
            logger.info(
                f"✅ bulk_update_completed enviado - tenant={tenant_id}, "
                f"records={affected_records}, success={success}"
            )
        else:
            logger.error(
                f"❌ FALHA ao enviar bulk_update_completed - tenant={tenant_id}, "
                f"records={affected_records}"
            )
        
        return result
    
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
        
        result = self._publish(self.CHANNEL_RESERVATION_UPDATE, data, critical=False)
        
        if result:
            logger.info(
                f"✅ reservation_created enviado - tenant={tenant_id}, "
                f"reservation={reservation_id}"
            )
        
        return result
    
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
        
        result = self._publish(self.CHANNEL_RESERVATION_UPDATE, data, critical=False)
        
        if result:
            logger.debug(
                f"✅ reservation_updated enviado - tenant={tenant_id}, "
                f"reservation={reservation_id}, status={status}"
            )
        
        return result
    
    # ============== MÉTODO AUXILIAR PARA TESTES ==============
    
    def test_notification(self, tenant_id: int) -> bool:
        """
        Envia notificação de teste.
        Útil para verificar se o sistema de notificações está funcionando.
        """
        data = {
            "event": "test",
            "tenant_id": tenant_id,
            "message": "Notificação de teste enviada com sucesso",
            "test_timestamp": datetime.utcnow().isoformat()
        }
        
        result = self._publish("test:notifications", data, critical=False)
        
        if result:
            logger.info(f"✅ Notificação de teste enviada com sucesso - tenant={tenant_id}")
        else:
            logger.error(f"❌ Falha ao enviar notificação de teste - tenant={tenant_id}")
        
        return result
    
    # ============== MÉTODOS DE DIAGNÓSTICO ==============
    
    def get_connection_status(self) -> Dict[str, Any]:
        """
        Retorna status da conexão Redis.
        Útil para diagnóstico e monitoramento.
        """
        return {
            "is_connected": self._is_available(),
            "redis_url": settings.REDIS_URL.split('@')[-1] if hasattr(settings, 'REDIS_URL') else "unknown",
            "connection_attempts": self._connection_attempts,
            "max_connection_attempts": self._max_connection_attempts,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def force_reconnect(self) -> bool:
        """
        Força reconexão ao Redis.
        Útil para recuperação de falhas.
        """
        logger.info("🔄 Forçando reconexão ao Redis...")
        self.redis_client = None
        self._connection_attempts = 0
        self._connect_to_redis()
        return self._is_available()


# ✅ Instância global do serviço
notification_service = NotificationService()


# ✅ Função auxiliar para verificar se Redis está disponível
def is_redis_available() -> bool:
    """
    Verifica se o serviço de notificações está disponível.
    
    Returns:
        True se Redis está conectado e funcionando
    """
    return notification_service._is_available()


# ✅ Função auxiliar para obter status da conexão
def get_notification_status() -> Dict[str, Any]:
    """
    Retorna status do serviço de notificações.
    
    Returns:
        Dicionário com informações de status
    """
    return notification_service.get_connection_status()