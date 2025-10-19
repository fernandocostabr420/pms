# backend/app/core/security.py

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Configuração do contexto de criptografia de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ LIMITE DE BYTES DO BCRYPT
BCRYPT_MAX_BYTES = 72


def create_password_hash(password: str) -> str:
    """
    Cria hash da senha usando bcrypt.
    ✅ CORRIGIDO: Trunca automaticamente senhas > 72 bytes.
    """
    # Truncar senha se necessário (bcrypt tem limite de 72 bytes)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > BCRYPT_MAX_BYTES:
        password = password_bytes[:BCRYPT_MAX_BYTES].decode('utf-8', errors='ignore')
    
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha corresponde ao hash.
    ✅ CORRIGIDO: Trunca automaticamente senhas > 72 bytes.
    """
    # Truncar senha se necessário (bcrypt tem limite de 72 bytes)
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > BCRYPT_MAX_BYTES:
        plain_password = password_bytes[:BCRYPT_MAX_BYTES].decode('utf-8', errors='ignore')
    
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Cria token de acesso JWT
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Cria refresh token JWT
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, expected_type: str = "access") -> Optional[Dict[str, Any]]:
    """
    Verifica e decodifica token JWT
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # Verificar se o tipo do token é o esperado
        if payload.get("type") != expected_type:
            return None
            
        return payload
    except JWTError:
        return None


def get_token_data(token: str) -> Optional[Dict[str, Any]]:
    """
    Extrai dados do token JWT sem verificar expiração
    (para debug ou logs)
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False}
        )
        return payload
    except JWTError:
        return None