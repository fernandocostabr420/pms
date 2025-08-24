# backend/app/core/database.py

from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configuração do engine com pool de conexões
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,  # Recicla conexões a cada 1 hora
    echo=settings.DEBUG,  # Log SQL queries em debug
)

# Session maker
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Metadata com naming convention para constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s", 
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

# Base class para todos os modelos
Base = declarative_base(metadata=metadata)


# Dependency para obter sessão do banco
def get_db():
    """
    Dependency que fornece uma sessão do banco de dados.
    Usado nos endpoints da API.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Erro na sessão do banco: {e}")
        db.rollback()
        raise
    finally:
        db.close()


# Função para verificar conectividade
def check_db_connection() -> bool:
    """
    Verifica se conseguimos conectar no banco de dados.
    Útil para health checks.
    """
    try:
        db = SessionLocal()
        # Executa um query simples (SQLAlchemy 2.0 way)
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        logger.error(f"Erro de conectividade com banco: {e}")
        return False


# Importar modelos para registro (deve vir depois da definição da Base)
def register_models():
    """Importa todos os modelos para registro no SQLAlchemy"""
    from app.models import Tenant, User  # noqa
    
# Chamar na inicialização
register_models()