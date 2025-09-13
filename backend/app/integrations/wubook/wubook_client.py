import xmlrpc.client
from typing import Dict, List, Any, Optional
from datetime import datetime

class WuBookClient:
    def __init__(self, token: str, lcode: int):
        self.token = token
        self.lcode = lcode
        self.server = xmlrpc.client.ServerProxy('https://wired.wubook.net/xrws/')
    
    def fetch_rooms(self) -> List[Dict]:
        """Buscar quartos"""
        result = self.server.fetch_rooms(self.token, self.lcode)
        if result[0] == 0:
            return result[1]
        raise Exception(f"Erro WuBook: {result[1]}")
    
    def fetch_availability(self, dfrom: str, dto: str, rooms: List[int] = None):
        """Buscar disponibilidade"""
        result = self.server.fetch_rooms_values(
            self.token, self.lcode, dfrom, dto, rooms or []
        )
        if result[0] == 0:
            return result[1]
        raise Exception(f"Erro WuBook: {result[1]}")
    
    def update_availability(self, rooms_values: Dict):
        """Atualizar disponibilidade"""
        result = self.server.update_sparse_avail(
            self.token, self.lcode, rooms_values
        )
        if result[0] == 0:
            return True
        raise Exception(f"Erro WuBook: {result[1]}")
