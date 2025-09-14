# backend/app/core/config.py

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
import pytz


class Settings(BaseSettings):
    """Configurações da aplicação"""
    
    # Básico
    APP_NAME: str = "TucaPMS - Property Management System"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Configuração de Timezone
    TIMEZONE: str = "America/Sao_Paulo"
    
    # Segurança
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # CORS - string separada por vírgulas
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://72.60.50.223:3000,http://72.60.50.223:8000"
    
    # Email (para futuro)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # ============== WUBOOK INTEGRATION ==============
    
    # WuBook API
    WUBOOK_TOKEN: Optional[str] = None
    WUBOOK_LCODE: Optional[int] = None
    WUBOOK_API_URL: str = "https://wired.wubook.net/xrws/"
    WUBOOK_API_TIMEOUT: int = 30  # segundos
    
    # ============== CELERY CONFIGURATION ==============
    
    # Celery Broker
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"
    CELERY_ENABLE_UTC: bool = True
    
    # Celery Task Settings
    CELERY_TASK_TIME_LIMIT: int = 1800  # 30 minutos
    CELERY_TASK_SOFT_TIME_LIMIT: int = 1500  # 25 minutos
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = 1
    CELERY_TASK_ACKS_LATE: bool = True
    CELERY_TASK_REJECT_ON_WORKER_LOST: bool = True
    CELERY_WORKER_MAX_TASKS_PER_CHILD: int = 1000
    
    # Celery Beat (Scheduled Tasks)
    CELERY_BEAT_SCHEDULE_FILENAME: str = "celerybeat-schedule"
    CELERY_BEAT_PERSIST: bool = True
    
    # ============== CHANNEL MANAGER SETTINGS ==============
    
    # Sincronização
    CHANNEL_MANAGER_SYNC_INTERVAL_MINUTES: int = 15
    CHANNEL_MANAGER_SYNC_TIMEOUT_SECONDS: int = 300  # 5 minutos
    CHANNEL_MANAGER_MAX_RETRY_ATTEMPTS: int = 3
    CHANNEL_MANAGER_RETRY_DELAY_SECONDS: int = 60
    CHANNEL_MANAGER_BATCH_SIZE: int = 50
    CHANNEL_MANAGER_MAX_BATCH_SIZE: int = 500
    
    # Disponibilidade
    AVAILABILITY_SYNC_DAYS_AHEAD: int = 60
    AVAILABILITY_SYNC_DAYS_BACK: int = 1
    AVAILABILITY_MAX_PERIOD_DAYS: int = 365
    AVAILABILITY_BULK_MAX_ROOMS: int = 100
    AVAILABILITY_BULK_MAX_DAYS: int = 366
    
    # Rate Limiting
    WUBOOK_API_RATE_LIMIT_PER_MINUTE: int = 100
    WUBOOK_API_RATE_LIMIT_BURST: int = 20
    WUBOOK_API_COOLDOWN_SECONDS: int = 1
    
    # Cache
    AVAILABILITY_CACHE_TTL_SECONDS: int = 300  # 5 minutos
    CONFIGURATION_CACHE_TTL_SECONDS: int = 600  # 10 minutos
    ROOM_MAPPING_CACHE_TTL_SECONDS: int = 1800  # 30 minutos
    
    # Logs e Limpeza
    SYNC_LOG_RETENTION_DAYS: int = 90
    SYNC_LOG_CLEANUP_HOUR: int = 3  # 3h da manhã
    ERROR_LOG_RETENTION_DAYS: int = 30
    PERFORMANCE_LOG_RETENTION_DAYS: int = 7
    
    # Health Check
    HEALTH_CHECK_INTERVAL_MINUTES: int = 30
    HEALTH_CHECK_TIMEOUT_SECONDS: int = 60
    HEALTH_WARNING_ERROR_RATE_PERCENT: float = 5.0
    HEALTH_CRITICAL_ERROR_RATE_PERCENT: float = 10.0
    HEALTH_WARNING_PENDING_RATE_PERCENT: float = 20.0
    HEALTH_CRITICAL_PENDING_RATE_PERCENT: float = 50.0
    
    # ============== PERFORMANCE SETTINGS ==============
    
    # Database Connection Pool
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600  # 1 hora
    
    # API Rate Limiting
    API_RATE_LIMIT_PER_MINUTE: int = 1000
    API_RATE_LIMIT_PER_HOUR: int = 10000
    API_BURST_LIMIT: int = 100
    
    # Background Tasks
    MAX_CONCURRENT_SYNC_TASKS: int = 5
    MAX_CONCURRENT_BULK_TASKS: int = 3
    MAX_CONCURRENT_REPORT_TASKS: int = 2
    
    # ============== SECURITY SETTINGS ==============
    
    # API Security
    API_KEY_HEADER: str = "X-API-Key"
    REQUIRE_API_KEY_FOR_SYNC: bool = False
    ALLOWED_HOSTS: List[str] = ["*"]  # Configurar em produção
    
    # WuBook Security
    WUBOOK_ENCRYPT_CREDENTIALS: bool = True
    WUBOOK_CREDENTIAL_ROTATION_DAYS: int = 90
    WUBOOK_LOG_SENSITIVE_DATA: bool = False
    
    # Session Security
    SESSION_TIMEOUT_MINUTES: int = 60
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    
    # ============== MONITORING SETTINGS ==============
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE_MAX_SIZE_MB: int = 100
    LOG_FILE_BACKUP_COUNT: int = 5
    
    # Metrics
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    METRICS_PATH: str = "/metrics"
    
    # Alerts
    ENABLE_ALERTS: bool = True
    ALERT_EMAIL_RECIPIENTS: str = ""  # Emails separados por vírgula
    ALERT_WEBHOOK_URL: Optional[str] = None
    ALERT_COOLDOWN_MINUTES: int = 30
    
    # ============== FEATURE FLAGS ==============
    
    # Channel Manager Features
    ENABLE_CHANNEL_MANAGER: bool = True
    ENABLE_AUTO_SYNC: bool = True
    ENABLE_BULK_OPERATIONS: bool = True
    ENABLE_RATE_SYNC: bool = True
    ENABLE_RESTRICTION_SYNC: bool = True
    ENABLE_BOOKING_SYNC: bool = True
    
    # Advanced Features
    ENABLE_YIELD_MANAGEMENT: bool = False
    ENABLE_DYNAMIC_PRICING: bool = False
    ENABLE_REVENUE_OPTIMIZATION: bool = False
    ENABLE_PREDICTIVE_ANALYTICS: bool = False
    
    # Beta Features
    ENABLE_MULTI_PROPERTY_SYNC: bool = False
    ENABLE_CHANNEL_ANALYTICS: bool = False
    ENABLE_AUTOMATED_REPORTING: bool = False
    
    # ============== DEVELOPMENT SETTINGS ==============
    
    # Debug
    DEBUG_SYNC_OPERATIONS: bool = False
    DEBUG_API_CALLS: bool = False
    DEBUG_CACHE_OPERATIONS: bool = False
    DEBUG_PERFORMANCE: bool = False
    
    # Testing
    TEST_MODE: bool = False
    TEST_WUBOOK_TOKEN: Optional[str] = None
    TEST_WUBOOK_LCODE: Optional[int] = None
    MOCK_WUBOOK_API: bool = False
    
    # Development Tools
    ENABLE_API_DOCS: bool = True
    ENABLE_ADMIN_PANEL: bool = False
    ENABLE_PROFILING: bool = False
    
    # ============== COMPUTED PROPERTIES ==============
    
    @property
    def tz(self):
        """Retorna objeto timezone configurado"""
        return pytz.timezone(self.TIMEZONE)
    
    @property
    def cors_origins_list(self):
        """Retorna lista de origens CORS"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def is_production(self) -> bool:
        """Verifica se está em ambiente de produção"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Verifica se está em ambiente de desenvolvimento"""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_testing(self) -> bool:
        """Verifica se está em ambiente de teste"""
        return self.ENVIRONMENT.lower() == "testing" or self.TEST_MODE
    
    @property
    def database_echo(self) -> bool:
        """Se deve fazer echo das queries SQL"""
        return self.DEBUG and self.is_development
    
    @property
    def celery_broker_url_computed(self) -> str:
        """URL do broker Celery (pode usar REDIS_URL como fallback)"""
        return self.CELERY_BROKER_URL or f"{self.REDIS_URL}/0"
    
    @property
    def celery_result_backend_computed(self) -> str:
        """Backend de resultados Celery (pode usar REDIS_URL como fallback)"""
        return self.CELERY_RESULT_BACKEND or f"{self.REDIS_URL}/1"
    
    @property
    def wubook_configured(self) -> bool:
        """Verifica se WuBook está configurado"""
        if self.is_testing and self.TEST_WUBOOK_TOKEN:
            return bool(self.TEST_WUBOOK_TOKEN and self.TEST_WUBOOK_LCODE)
        return bool(self.WUBOOK_TOKEN and self.WUBOOK_LCODE)
    
    @property
    def sync_enabled(self) -> bool:
        """Verifica se sincronização está habilitada"""
        return (
            self.ENABLE_CHANNEL_MANAGER and 
            self.ENABLE_AUTO_SYNC and 
            self.wubook_configured
        )
    
    @property
    def alert_email_list(self) -> List[str]:
        """Lista de emails para alertas"""
        if not self.ALERT_EMAIL_RECIPIENTS:
            return []
        return [email.strip() for email in self.ALERT_EMAIL_RECIPIENTS.split(",")]
    
    # ============== VALIDATION METHODS ==============
    
    def validate_wubook_config(self) -> bool:
        """Valida configuração WuBook"""
        if not self.wubook_configured:
            return False
        
        # Validar formato do token
        token = self.TEST_WUBOOK_TOKEN if self.is_testing else self.WUBOOK_TOKEN
        if not token or not token.startswith(('wr_', 'test_')):
            return False
        
        # Validar lcode
        lcode = self.TEST_WUBOOK_LCODE if self.is_testing else self.WUBOOK_LCODE
        if not lcode or lcode <= 0:
            return False
        
        return True
    
    def validate_celery_config(self) -> bool:
        """Valida configuração Celery"""
        try:
            # Verificar URL do broker
            if not self.celery_broker_url_computed:
                return False
            
            # Verificar configurações básicas
            if self.CELERY_TASK_TIME_LIMIT <= 0:
                return False
            
            if self.CHANNEL_MANAGER_SYNC_INTERVAL_MINUTES <= 0:
                return False
            
            return True
            
        except Exception:
            return False
    
    def get_effective_wubook_credentials(self) -> tuple:
        """Retorna credenciais WuBook efetivas (considerando ambiente de teste)"""
        if self.is_testing and self.TEST_WUBOOK_TOKEN:
            return self.TEST_WUBOOK_TOKEN, self.TEST_WUBOOK_LCODE
        return self.WUBOOK_TOKEN, self.WUBOOK_LCODE
    
    def get_cache_config(self) -> dict:
        """Retorna configuração de cache"""
        return {
            "availability_ttl": self.AVAILABILITY_CACHE_TTL_SECONDS,
            "configuration_ttl": self.CONFIGURATION_CACHE_TTL_SECONDS,
            "room_mapping_ttl": self.ROOM_MAPPING_CACHE_TTL_SECONDS,
            "redis_url": self.REDIS_URL
        }
    
    def get_health_thresholds(self) -> dict:
        """Retorna thresholds de health check"""
        return {
            "warning_error_rate": self.HEALTH_WARNING_ERROR_RATE_PERCENT,
            "critical_error_rate": self.HEALTH_CRITICAL_ERROR_RATE_PERCENT,
            "warning_pending_rate": self.HEALTH_WARNING_PENDING_RATE_PERCENT,
            "critical_pending_rate": self.HEALTH_CRITICAL_PENDING_RATE_PERCENT,
            "check_interval_minutes": self.HEALTH_CHECK_INTERVAL_MINUTES
        }
    
    def get_sync_config(self) -> dict:
        """Retorna configuração de sincronização"""
        return {
            "interval_minutes": self.CHANNEL_MANAGER_SYNC_INTERVAL_MINUTES,
            "timeout_seconds": self.CHANNEL_MANAGER_SYNC_TIMEOUT_SECONDS,
            "max_retries": self.CHANNEL_MANAGER_MAX_RETRY_ATTEMPTS,
            "retry_delay": self.CHANNEL_MANAGER_RETRY_DELAY_SECONDS,
            "batch_size": self.CHANNEL_MANAGER_BATCH_SIZE,
            "days_ahead": self.AVAILABILITY_SYNC_DAYS_AHEAD,
            "days_back": self.AVAILABILITY_SYNC_DAYS_BACK
        }
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
        # Permitir configuração via variáveis de ambiente
        @classmethod
        def customise_sources(
            cls,
            init_settings,
            env_settings,
            file_secret_settings,
        ):
            return (
                init_settings,
                env_settings,
                file_secret_settings,
            )


# Instância global das configurações
settings = Settings()


# ============== HELPER FUNCTIONS ==============

def get_wubook_credentials():
    """Função helper para obter credenciais WuBook"""
    return settings.get_effective_wubook_credentials()


def is_feature_enabled(feature_name: str) -> bool:
    """Verifica se uma feature está habilitada"""
    feature_attr = f"ENABLE_{feature_name.upper()}"
    return getattr(settings, feature_attr, False)


def get_environment_info() -> dict:
    """Retorna informações do ambiente"""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "timezone": settings.TIMEZONE,
        "wubook_configured": settings.wubook_configured,
        "sync_enabled": settings.sync_enabled,
        "features": {
            "channel_manager": settings.ENABLE_CHANNEL_MANAGER,
            "auto_sync": settings.ENABLE_AUTO_SYNC,
            "bulk_operations": settings.ENABLE_BULK_OPERATIONS,
            "yield_management": settings.ENABLE_YIELD_MANAGEMENT
        }
    }