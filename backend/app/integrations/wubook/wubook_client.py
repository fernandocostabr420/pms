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
            
            # CORREÇÃO: Verificar se result é uma lista/tupla com pelo menos 2 elementos
            if not isinstance(result, (list, tuple)) or len(result) < 2:
                raise Exception(f"Resposta WuBook inválida: {result}")
                
            if result[0] == 0:
                logger.info(f"Encontrados {len(result[1])} quartos no WuBook")
                return result[1]
            else:
                raise Exception(f"Erro WuBook (código {result[0]}): {result[1]}")
                
        except xmlrpc.client.Fault as fault:
            error_msg = f"Erro XML-RPC: {fault.faultCode} - {fault.faultString}"
            logger.error(error_msg)
            raise Exception(error_msg)
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
            
            # CORREÇÃO: Verificar estrutura da resposta
            if not isinstance(result, (list, tuple)) or len(result) < 2:
                raise Exception(f"Resposta WuBook inválida: {result}")
                
            if result[0] == 0:
                logger.info(f"Disponibilidade obtida com sucesso")
                return result[1]
            else:
                raise Exception(f"Erro WuBook (código {result[0]}): {result[1]}")
                
        except xmlrpc.client.Fault as fault:
            error_msg = f"Erro XML-RPC: {fault.faultCode} - {fault.faultString}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Erro ao buscar disponibilidade: {str(e)}")
            raise
    
    def update_availability(self, availability_data: List[Dict]) -> Dict[str, Any]:
        """
        Atualizar disponibilidade - CORRIGIDO para garantir retorno consistente
        
        SEMPRE retorna um dicionário com 'success' e 'message'
        """
        try:
            # Verificar se há dados para enviar
            if not availability_data:
                logger.warning("Nenhum dado de disponibilidade para atualizar")
                return {"success": True, "message": "Nenhum dado para atualizar"}
            
            # Agrupar dados por room_id
            rooms_grouped = {}
            for item in availability_data:
                room_id = str(item['room_id'])  # WuBook espera string
                if room_id not in rooms_grouped:
                    rooms_grouped[room_id] = []
                
                # Converter data para formato europeu
                try:
                    date_european = self._date_to_european_format(item['date'])
                except Exception as e:
                    logger.error(f"Erro ao converter data {item['date']}: {e}")
                    continue
                
                # Montar estrutura do dia conforme documentação WuBook
                day_data = {
                    'date': date_european,
                    'avail': item.get('available', 1)  # WuBook usa 'avail'
                }
                
                # Campos opcionais - usando nomes corretos do WuBook
                if 'no_ota' in item:
                    day_data['no_ota'] = item['no_ota']
                if 'min_stay' in item:
                    day_data['min_stay'] = item['min_stay']
                if 'max_stay' in item:
                    day_data['max_stay'] = item['max_stay']
                if 'closed_to_arrival' in item:
                    day_data['closed_arrival'] = item['closed_to_arrival']
                if 'closed_to_departure' in item:
                    day_data['closed_departure'] = item['closed_to_departure']
                
                rooms_grouped[room_id].append(day_data)
            
            # Verificar se há dados válidos após processamento
            if not rooms_grouped:
                return {"success": False, "message": "Nenhum dado válido para sincronizar"}
            
            # Montar estrutura final conforme documentação WuBook
            rooms_data = []
            for room_id, days in rooms_grouped.items():
                if days:  # Só adicionar se há dias válidos
                    rooms_data.append({
                        'id': room_id,
                        'days': days
                    })
            
            if not rooms_data:
                return {"success": False, "message": "Nenhum quarto com dados válidos"}
            
            logger.debug(f"Enviando atualização para {len(rooms_data)} quartos")
            logger.debug(f"Total de {sum(len(r['days']) for r in rooms_data)} dias")
            
            # CORREÇÃO PRINCIPAL: Enviar para WuBook com tratamento robusto de erros
            try:
                result = self.server.update_sparse_avail(
                    self.token, self.lcode, rooms_data
                )
                
                # IMPORTANTE: Verificar se result é uma lista/tupla
                if not isinstance(result, (list, tuple)) or len(result) < 1:
                    error_msg = f"Resposta WuBook inesperada: {type(result)} - {result}"
                    logger.error(error_msg)
                    return {"success": False, "message": error_msg}
                
                # WuBook retorna [0, None] para sucesso ou [erro_code, mensagem] para erro
                status_code = result[0]
                response_data = result[1] if len(result) > 1 else None
                
                if status_code == 0:
                    logger.info("Disponibilidade atualizada com sucesso no WuBook")
                    return {
                        "success": True, 
                        "message": "Atualização realizada com sucesso",
                        "rooms_updated": len(rooms_data),
                        "days_updated": sum(len(r['days']) for r in rooms_data)
                    }
                else:
                    error_msg = f"Erro WuBook (código {status_code}): {response_data}"
                    logger.error(error_msg)
                    return {"success": False, "message": error_msg}
                    
            except xmlrpc.client.Fault as fault:
                error_msg = f"Erro XML-RPC: {fault.faultCode} - {fault.faultString}"
                logger.error(error_msg)
                return {"success": False, "message": error_msg}
                
        except Exception as e:
            error_msg = f"Erro ao atualizar disponibilidade: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "message": error_msg}
    
    def test_connection(self) -> Dict[str, Any]:
        """Testa conexão com WuBook"""
        try:
            rooms = self.fetch_rooms()
            return {
                "success": True, 
                "message": f"Conexão OK. {len(rooms)} quartos encontrados.",
                "rooms_count": len(rooms)
            }
        except Exception as e:
            return {
                "success": False, 
                "message": f"Erro na conexão: {str(e)}"
            }