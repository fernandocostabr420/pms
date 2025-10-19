# backend/app/middleware/timezone.py

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import os

class TimezoneMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Definir timezone para a sessão
        os.environ['TZ'] = 'America/Sao_Paulo'
        
        response = await call_next(request)
        
        # Adicionar header com timezone
        response.headers["X-Timezone"] = "America/Sao_Paulo"
        
        return response