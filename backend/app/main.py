# backend/app/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import traceback
import os

from app.core.config import settings
from app.core.database import check_db_connection

# ✅ IMPORTAR MIDDLEWARES DA API PÚBLICA
from app.api.public.middleware import (
    RateLimitMiddleware,
    PublicAPILoggingMiddleware
)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ✅ MIDDLEWARE DE TIMEZONE
class TimezoneMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Definir timezone para a sessão
        os.environ['TZ'] = 'America/Sao_Paulo'
        
        response = await call_next(request)
        
        # Adicionar header com timezone
        response.headers["X-Timezone"] = "America/Sao_Paulo"
        
        return response

# Criar instância da aplicação
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ✅ CONFIGURAR UPLOADS - Criar diretório e montar arquivos estáticos
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
logger.info("✅ Pasta de uploads configurada: /uploads")

# ✅ ADICIONAR MIDDLEWARES (ORDEM IMPORTA!)
# 1. Timezone primeiro
app.add_middleware(TimezoneMiddleware)

# 2. Middlewares da API pública
app.add_middleware(PublicAPILoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

# 3. CORS por último (para interceptar todas as respostas)
cors_origins = settings.CORS_ORIGINS.split(",")
if settings.DEBUG:
    cors_origins.extend([
        "*", 
        "http://72.60.50.223:3000", 
        "http://72.60.50.223:8000",
        "http://localhost:3001",  # ✅ Frontend do booking engine
        "http://127.0.0.1:3001"   # ✅ Frontend do booking engine
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Handler específico para OPTIONS (CORS preflight)
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle CORS preflight requests"""
    return JSONResponse(
        content={"message": "CORS OK"},
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Dados inválidos", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Erro interno do servidor",
            "error": str(exc) if settings.DEBUG else "Internal server error"
        }
    )

# ✅ INCLUIR ROTAS DA API PRIVADA (V1) com tratamento de erro
try:
    from app.api.v1.api import api_router
    app.include_router(api_router, prefix="/api/v1")
    api_loaded = True
    logger.info("✅ API v1 routes carregadas com sucesso")
except Exception as e:
    logger.error(f"❌ Erro ao carregar API v1 routes: {e}")
    api_loaded = False

# ✅ INCLUIR ROTAS DA API PÚBLICA
try:
    from app.api.public import public_router
    app.include_router(public_router, prefix="/api/public")
    public_api_loaded = True
    logger.info("✅ API pública carregada com sucesso")
except Exception as e:
    logger.error(f"❌ Erro ao carregar API pública: {e}")
    logger.exception(e)  # Log completo do erro
    public_api_loaded = False

# Endpoints básicos
@app.get("/")
async def root():
    """Endpoint raiz"""
    return {
        "message": f"Bem-vindo ao {settings.APP_NAME}",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "api_v1_loaded": api_loaded,
        "public_api_loaded": public_api_loaded,
        "cors_origins": cors_origins[:5],
        "docs": "/docs" if settings.DEBUG else "Documentação não disponível em produção",
        "timezone": "America/Sao_Paulo",
        "uploads": "✅ Configurado em /uploads",
        "endpoints": {
            "private_api": "/api/v1",
            "public_api": "/api/public",
            "health": "/health",
            "uploads": "/uploads",
            "docs": "/docs" if settings.DEBUG else None
        }
    }

@app.get("/health")
async def health_check():
    """Health check da aplicação"""
    try:
        db_status = check_db_connection()
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        db_status = False
    
    return {
        "status": "healthy" if db_status else "unhealthy",
        "database": "connected" if db_status else "disconnected",
        "api_v1_loaded": api_loaded,
        "public_api_loaded": public_api_loaded,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timezone": "America/Sao_Paulo",
        "uploads": "active"
    }

# Event handlers
@app.on_event("startup")
async def startup_event():
    """Eventos de inicialização"""
    logger.info(f"🚀 {settings.APP_NAME} iniciado!")
    logger.info(f"📊 Ambiente: {settings.ENVIRONMENT}")
    logger.info(f"🔍 Debug: {settings.DEBUG}")
    logger.info(f"🌐 CORS configurado para: {len(cors_origins)} origens")
    logger.info(f"📡 API v1 carregada: {api_loaded}")
    logger.info(f"🌍 API Pública carregada: {public_api_loaded}")
    logger.info(f"🕐 Timezone: America/Sao_Paulo")
    logger.info(f"📁 Uploads: /uploads → uploads/")

@app.on_event("shutdown") 
async def shutdown_event():
    """Eventos de encerramento"""
    logger.info(f"⏹️  {settings.APP_NAME} encerrado!")

# Para executar diretamente
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=settings.DEBUG
    )