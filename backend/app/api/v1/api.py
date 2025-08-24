# backend/app/api/v1/api.py

from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, tenants

api_router = APIRouter()

# Incluir rotas de autenticação
api_router.include_router(
    auth.router, 
    prefix="/auth", 
    tags=["Autenticação"]
)

# Incluir rotas de usuários
api_router.include_router(
    users.router,
    prefix="/users", 
    tags=["Usuários"]
)

# Incluir rotas de tenants
api_router.include_router(
    tenants.router,
    prefix="/tenants", 
    tags=["Tenants"]
)