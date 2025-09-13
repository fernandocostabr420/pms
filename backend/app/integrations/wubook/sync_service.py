from .wubook_client import WuBookClient
from app.core.config import settings
from typing import Dict, List

class WuBookSyncService:
    def __init__(self):
        # Usar credenciais do settings
        if not settings.WUBOOK_TOKEN or not settings.WUBOOK_LCODE:
            raise ValueError("WuBook credentials not configured")
            
        self.client = WuBookClient(
            token=settings.WUBOOK_TOKEN,
            lcode=settings.WUBOOK_LCODE
        )
    
    def sync_rooms(self) -> List[Dict]:
        """Sincronizar quartos do WuBook com PMS"""
        wubook_rooms = self.client.fetch_rooms()
        print(f"Sincronizando {len(wubook_rooms)} quartos...")
        return wubook_rooms
    
    def sync_availability(self, start_date: str, end_date: str):
        """Sincronizar disponibilidade"""
        rooms = self.client.fetch_rooms()
        room_ids = [r['id'] for r in rooms]
        
        availability = self.client.fetch_availability(
            start_date, end_date, room_ids
        )
        
        print(f"Disponibilidade obtida para {len(availability)} dias")
        return availability