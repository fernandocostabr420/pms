# backend/app/api/public/middleware.py

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import time
import logging
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


# ============== RATE LIMITING ==============

class RateLimiter:
    """
    Sistema simples de rate limiting em memória.
    Para produção, considere usar Redis.
    """
    def __init__(self):
        self.requests = defaultdict(list)
        self.max_requests = 100  # Máximo de requisições
        self.window = 60  # Janela de tempo em segundos (1 minuto)
    
    def is_allowed(self, identifier: str) -> bool:
        """
        Verifica se o identificador (IP) está dentro do limite.
        
        Args:
            identifier: IP do cliente
            
        Returns:
            True se permitido, False se excedeu o limite
        """
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window)
        
        # Remover requisições antigas
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > cutoff
        ]
        
        # Verificar se excedeu o limite
        if len(self.requests[identifier]) >= self.max_requests:
            return False
        
        # Registrar nova requisição
        self.requests[identifier].append(now)
        return True
    
    def get_remaining(self, identifier: str) -> int:
        """Retorna quantas requisições restam"""
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window)
        
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > cutoff
        ]
        
        return max(0, self.max_requests - len(self.requests[identifier]))


# Instância global do rate limiter
rate_limiter = RateLimiter()


# ============== MIDDLEWARE DE RATE LIMITING ==============

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware para aplicar rate limiting em rotas públicas.
    """
    async def dispatch(self, request: Request, call_next: Callable):
        # Aplicar apenas em rotas públicas
        if not request.url.path.startswith("/api/public"):
            return await call_next(request)
        
        # Identificar cliente pelo IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Verificar rate limit
        if not rate_limiter.is_allowed(client_ip):
            logger.warning(f"Rate limit excedido para IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Muitas requisições. Tente novamente em alguns instantes.",
                    "retry_after": rate_limiter.window
                },
                headers={
                    "Retry-After": str(rate_limiter.window),
                    "X-RateLimit-Limit": str(rate_limiter.max_requests),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        # Adicionar headers de rate limit na resposta
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(rate_limiter.get_remaining(client_ip))
        response.headers["X-RateLimit-Window"] = str(rate_limiter.window)
        
        return response


# ============== MIDDLEWARE DE LOGGING ==============

class PublicAPILoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware para logging de requisições públicas.
    """
    async def dispatch(self, request: Request, call_next: Callable):
        # Aplicar apenas em rotas públicas
        if not request.url.path.startswith("/api/public"):
            return await call_next(request)
        
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        # Log da requisição
        logger.info(f"[PUBLIC API] {request.method} {request.url.path} | IP: {client_ip}")
        
        # Processar requisição
        response = await call_next(request)
        
        # Calcular tempo de processamento
        process_time = time.time() - start_time
        
        # Log da resposta
        logger.info(
            f"[PUBLIC API] {request.method} {request.url.path} | "
            f"Status: {response.status_code} | "
            f"Time: {process_time:.3f}s | "
            f"IP: {client_ip}"
        )
        
        # Adicionar header de tempo de processamento
        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        
        return response


# ============== DEPENDENCY PARA VERIFICAÇÃO DE ACESSO ==============

def verify_public_access() -> bool:
    """
    Dependency para verificar acesso público.
    
    Por enquanto apenas retorna True, mas pode ser expandido para:
    - Verificar tokens de API por propriedade
    - Validar origem da requisição
    - Bloquear IPs suspeitos
    - Etc.
    
    Returns:
        True se acesso permitido
    """
    # TODO: Implementar verificações adicionais conforme necessário
    return True


# ============== VALIDAÇÃO DE ORIGEM (CORS) ==============

def get_cors_origins() -> list:
    """
    Retorna lista de origens permitidas para CORS.
    
    Em produção, deve ser configurado via variáveis de ambiente.
    """
    from app.core.config import settings
    
    # Origens padrão permitidas
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    
    # Adicionar origem do frontend se configurada
    if hasattr(settings, 'FRONTEND_URL') and settings.FRONTEND_URL:
        allowed_origins.append(settings.FRONTEND_URL)
    
    # Em produção, adicionar domínios reais
    if hasattr(settings, 'ENVIRONMENT') and settings.ENVIRONMENT == 'production':
        # TODO: Adicionar domínios de produção
        pass
    
    return allowed_origins


# ============== VALIDAÇÃO DE SLUG ==============

def validate_property_slug(slug: str) -> bool:
    """
    Valida formato do slug da propriedade.
    
    Args:
        slug: Slug a ser validado
        
    Returns:
        True se válido, False caso contrário
    """
    import re
    
    # Slug deve ter entre 3 e 100 caracteres
    if not slug or len(slug) < 3 or len(slug) > 100:
        return False
    
    # Slug deve conter apenas letras minúsculas, números e hífens
    pattern = r'^[a-z0-9-]+$'
    
    return bool(re.match(pattern, slug))


# ============== SANITIZAÇÃO DE INPUTS ==============

def sanitize_public_input(data: str) -> str:
    """
    Sanitiza inputs públicos para prevenir XSS e injeção.
    
    Args:
        data: String a ser sanitizada
        
    Returns:
        String sanitizada
    """
    if not data:
        return data
    
    # Remover caracteres perigosos
    dangerous_chars = ['<', '>', '"', "'", '&', '\\']
    sanitized = data
    
    for char in dangerous_chars:
        sanitized = sanitized.replace(char, '')
    
    return sanitized.strip()


# ============== FUNÇÕES AUXILIARES ==============

def get_client_info(request: Request) -> dict:
    """
    Extrai informações do cliente da requisição.
    
    Args:
        request: Objeto Request do FastAPI
        
    Returns:
        Dicionário com informações do cliente
    """
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    referer = request.headers.get("referer", "direct")
    
    return {
        "ip": client_ip,
        "user_agent": user_agent,
        "referer": referer,
        "timestamp": datetime.now().isoformat()
    }


def log_suspicious_activity(request: Request, reason: str):
    """
    Registra atividade suspeita.
    
    Args:
        request: Objeto Request
        reason: Motivo da suspeita
    """
    client_info = get_client_info(request)
    
    logger.warning(
        f"[SECURITY] Atividade suspeita detectada | "
        f"Reason: {reason} | "
        f"IP: {client_info['ip']} | "
        f"Path: {request.url.path} | "
        f"UA: {client_info['user_agent']}"
    )