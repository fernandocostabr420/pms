# backend/app/integrations/wubook/wubook_client.py

import xmlrpc.client
from typing import Dict, List, Any, Optional
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)

class WuBookClient:
    def __init__(self, token: str, lcode: int):
        self.token = token
        self.lcode = lcode
        self.server = xmlrpc.client.ServerProxy('https://wired.wubook.net/xrws/')
    
    def _date_to_european_format(self, date_input) -> str:
        """Converte data para formato europeu DD/MM/YYYY"""
        if isinstance(date_input, str):
            # Se já está em formato ISO YYYY-MM-DD
            if len(date_input) == 10 and date_input[4] == '-':
                date_obj = datetime.strptime(date_input, '%Y-%m-%d').date()
                return date_obj.strftime('%d/%m/%Y')
            # Se já está em formato europeu DD/MM/YYYY
            elif '/' in date_input:
                return date_input
            else:
                raise ValueError(f"Formato de data não reconhecido: {date_input}")
        elif isinstance(date_input, date):
            return date_input.strftime('%d/%m/%Y')
        elif isinstance(date_input, datetime):
            return date_input.strftime('%d/%m/%Y')
        else:
            raise ValueError(f"Tipo de data inválido: {type(date_input)}")
    
    def fetch_rooms(self) -> List[Dict]:
        """Buscar quartos"""
        try:
            logger.debug(f"Buscando quartos do WuBook para lcode: {self.lcode}")
            result = self.server.fetch_rooms(self.token, self.lcode)
            if result[0] == 0:
                logger.info(f"Encontrados {len(result[1])} quartos no WuBook")
                return result[1]
            raise Exception(f"Erro WuBook: {result[1]}")
        except Exception as e:
            logger.error(f"Erro ao buscar quartos: {str(e)}")
            raise
    
    def fetch_availability(self, dfrom: str, dto: str, rooms: List[int] = None):
        """Buscar disponibilidade - CORRIGIDO para usar formato europeu"""
        try:
            # Converter datas para formato europeu
            dfrom_european = self._date_to_european_format(dfrom)
            dto_european = self._date_to_european_format(dto)
            
            logger.debug(f"Buscando disponibilidade: {dfrom_european} até {dto_european}")
            logger.debug(f"Quartos: {rooms or 'todos'}")
            
            result = self.server.fetch_rooms_values(
                self.token, self.lcode, dfrom_european, dto_european, rooms or []
            )
            if result[0] == 0:
                logger.info(f"Disponibilidade obtida com sucesso")
                return result[1]
            raise Exception(f"Erro WuBook: {result[1]}")
        except Exception as e:
            logger.error(f"Erro ao buscar disponibilidade: {str(e)}")
            raise
    
    def update_availability(self, availability_data: List[Dict]):
        """
        Atualizar disponibilidade - CORRIGIDO para usar formato correto do WuBook
        
        availability_data: Lista de dicts com:
        - room_id: ID do quarto no WuBook  
        - date: Data (será convertida para formato europeu)
        - available: 1 ou 0
        - closed_to_arrival: 1 ou 0 (opcional)
        - closed_to_departure: 1 ou 0 (opcional)
        - min_stay: número (opcional)
        - max_stay: número (opcional)
        - no_ota: 1 ou 0 (opcional)
        """
        try:
            # Agrupar dados por room_id
            rooms_grouped = {}
            for item in availability_data:
                room_id = str(item['room_id'])  # WuBook espera string
                if room_id not in rooms_grouped:
                    rooms_grouped[room_id] = []
                
                # Converter data para formato europeu
                date_european = self._date_to_european_format(item['date'])
                
                # Montar estrutura do dia conforme documentação WuBook
                day_data = {
                    'date': date_european,
                    'avail': item.get('available', 1)  # WuBook usa 'avail', não 'available'
                }
                
                # Campos opcionais - usando nomes corretos do WuBook
                if 'no_ota' in item:
                    day_data['no_ota'] = item['no_ota']
                if 'min_stay' in item:
                    day_data['min_stay'] = item['min_stay']
                if 'max_stay' in item:
                    day_data['max_stay'] = item['max_stay']
                if 'closed_to_arrival' in item:
                    day_data['closed_arrival'] = item['closed_to_arrival']  # WuBook usa 'closed_arrival'
                if 'closed_to_departure' in item:
                    day_data['closed_departure'] = item['closed_to_departure']  # WuBook usa 'closed_departure'
                
                rooms_grouped[room_id].append(day_data)
            
            # Montar estrutura final conforme documentação WuBook
            rooms_data = []
            for room_id, days in rooms_grouped.items():
                rooms_data.append({
                    'id': room_id,
                    'days': days
                })
            
            logger.debug(f"Enviando atualização para {len(rooms_data)} quartos")
            logger.debug(f"Total de {sum(len(r['days']) for r in rooms_data)} dias")
            
            # Enviar para WuBook usando update_sparse_avail
            result = self.server.update_sparse_avail(
                self.token, self.lcode, rooms_data
            )
            
            # WuBook retorna [0, None] para sucesso ou [erro_code, mensagem] para erro
            if result[0] == 0:
                logger.info("Disponibilidade atualizada com sucesso no WuBook")
                return {"success": True, "message": "Atualização realizada com sucesso"}
            else:
                error_msg = f"Erro WuBook: {result[1]}"
                logger.error(error_msg)
                return {"success": False, "message": error_msg}
                
        except Exception as e:
            logger.error(f"Erro ao atualizar disponibilidade: {str(e)}")
            return {"success": False, "message": str(e)}