# backend/app/utils/pagination.py

from typing import Tuple
from fastapi import Query


def get_pagination_params(
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página")
) -> Tuple[int, int]:
    """
    Função utilitária para parâmetros de paginação padronizados.
    
    Args:
        page: Número da página (mínimo 1)
        per_page: Itens por página (mínimo 1, máximo 100)
    
    Returns:
        Tupla com (page, per_page) validados
    """
    return page, per_page


def calculate_pagination_info(total: int, page: int, per_page: int) -> dict:
    """
    Calcula informações de paginação.
    
    Args:
        total: Total de registros
        page: Página atual
        per_page: Itens por página
    
    Returns:
        Dict com informações de paginação
    """
    if per_page <= 0:
        per_page = 20
    
    pages = (total + per_page - 1) // per_page if per_page > 0 else 1
    has_next = page < pages
    has_previous = page > 1
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "has_next": has_next,
        "has_previous": has_previous,
        "start_index": (page - 1) * per_page + 1,
        "end_index": min(page * per_page, total)
    }