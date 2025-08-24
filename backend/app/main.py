# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.core.database import check_db_connection
from app.api.v1.api import api_router

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Criar instância da aplicação
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas da API
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Endpoint raiz"""
    return {
        "message": f"Bem-vindo ao {settings.APP_NAME}",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.DEBUG else "Documentação não disponível em produção"
    }


@app.get("/health")
async def health_check():
    """Health check da aplicação"""
    db_status = check_db_connection()
    
    return {
        "status": "healthy" if db_status else "unhealthy",
        "database": "connected" if db_status else "disconnected",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@app.on_event("startup")
async def startup_event():
    """Eventos de inicialização"""
    logger.info(f"🚀 {settings.APP_NAME} iniciado!")
    logger.info(f"📊 Ambiente: {settings.ENVIRONMENT}")
    logger.info(f"🔍 Debug: {settings.DEBUG}")


@app.on_event("shutdown") 
async def shutdown_event():
    """Eventos de encerramento"""
    logger.info(f"⏹️  {settings.APP_NAME} encerrado!")