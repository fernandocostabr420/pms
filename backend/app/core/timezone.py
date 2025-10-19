# backend/app/core/timezone.py

from datetime import datetime, timezone
import pytz

# Timezone de São Paulo
SP_TIMEZONE = pytz.timezone('America/Sao_Paulo')

def now_in_sp() -> datetime:
    """Retorna datetime atual no timezone de São Paulo"""
    return datetime.now(SP_TIMEZONE)

def utc_to_sp(utc_dt: datetime) -> datetime:
    """Converte datetime UTC para São Paulo"""
    if utc_dt.tzinfo is None:
        # Se não tem timezone, assume UTC
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(SP_TIMEZONE)

def sp_to_utc(sp_dt: datetime) -> datetime:
    """Converte datetime de São Paulo para UTC"""
    if sp_dt.tzinfo is None:
        # Se não tem timezone, assume São Paulo
        sp_dt = SP_TIMEZONE.localize(sp_dt)
    return sp_dt.astimezone(timezone.utc)

def naive_to_sp(naive_dt: datetime) -> datetime:
    """Converte datetime naive para São Paulo (assume que já está em SP)"""
    return SP_TIMEZONE.localize(naive_dt)

def format_datetime_br(dt: datetime, format_str: str = "%d/%m/%Y %H:%M") -> str:
    """Formata datetime para padrão brasileiro"""
    if dt.tzinfo is None:
        dt = naive_to_sp(dt)
    elif dt.tzinfo != SP_TIMEZONE:
        dt = dt.astimezone(SP_TIMEZONE)
    
    return dt.strftime(format_str)

def parse_date_br(date_str: str) -> datetime:
    """Parse de data brasileira (dd/mm/yyyy ou yyyy-mm-dd) para datetime SP"""
    try:
        if '/' in date_str:
            # Formato brasileiro dd/mm/yyyy
            dt = datetime.strptime(date_str, '%d/%m/%Y')
        else:
            # Formato ISO yyyy-mm-dd
            dt = datetime.strptime(date_str, '%Y-%m-%d')
        
        return SP_TIMEZONE.localize(dt)
    except ValueError as e:
        raise ValueError(f"Formato de data inválido: {date_str}. Use dd/mm/yyyy ou yyyy-mm-dd")