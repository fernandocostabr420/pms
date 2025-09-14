# backend/app/integrations/wubook/availability_mapper.py

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal
import logging

from app.models.room_availability import RoomAvailability
from app.models.wubook_room_mapping import WuBookRoomMapping

logger = logging.getLogger(__name__)


class AvailabilityMapper:
    """
    Classe responsável por converter dados de disponibilidade entre formatos PMS e WuBook.
    Gerencia mapeamento bidirecional mantendo integridade dos dados.
    """
    
    def __init__(self):
        self.logger = logger
    
    def pms_to_wubook_availability(
        self,
        availabilities: List[RoomAvailability],
        room_mappings: List[WuBookRoomMapping]
    ) -> List[Dict[str, Any]]:
        """
        Converte disponibilidades do PMS para formato WuBook.
        
        Args:
            availabilities: Lista de disponibilidades do PMS
            room_mappings: Lista de mapeamentos de quartos
            
        Returns:
            Lista de dicionários no formato WuBook
        """
        try:
            # Criar mapa de mapeamentos para busca rápida
            mapping_dict = {mapping.room_id: mapping for mapping in room_mappings}
            
            wubook_data = []
            
            for availability in availabilities:
                mapping = mapping_dict.get(availability.room_id)
                if not mapping or not mapping.sync_availability:
                    continue
                
                # Converter para formato WuBook
                wb_item = self._convert_pms_availability_to_wubook(availability, mapping)
                
                if wb_item:
                    wubook_data.append(wb_item)
            
            self.logger.info(f"Convertidas {len(wubook_data)} disponibilidades PMS -> WuBook")
            return wubook_data
            
        except Exception as e:
            self.logger.error(f"Erro ao converter PMS -> WuBook: {str(e)}")
            return []
    
    def _convert_pms_availability_to_wubook(
        self,
        availability: RoomAvailability,
        mapping: WuBookRoomMapping
    ) -> Optional[Dict[str, Any]]:
        """Converte uma disponibilidade PMS individual para formato WuBook"""
        
        try:
            # Estrutura básica WuBook
            wb_data = {
                'room_id': mapping.wubook_room_id,
                'date': availability.date.strftime('%Y-%m-%d')
            }
            
            # Status de disponibilidade
            # No WuBook: available = número de quartos disponíveis
            if availability.is_bookable:
                wb_data['available'] = 1
            else:
                wb_data['available'] = 0
            
            # Restrições de check-in/check-out
            wb_data['closed_to_arrival'] = 1 if availability.closed_to_arrival else 0
            wb_data['closed_to_departure'] = 1 if availability.closed_to_departure else 0
            
            # Estadia mínima e máxima
            wb_data['min_stay'] = availability.min_stay or 1
            
            if availability.max_stay:
                wb_data['max_stay'] = availability.max_stay
            
            # Tarifas (se habilitada sincronização)
            if mapping.sync_rates and availability.rate_override:
                rate = self._calculate_wubook_rate(
                    availability.rate_override,
                    mapping
                )
                if rate:
                    wb_data['rate'] = float(rate)
            
            # Metadados adicionais
            wb_data['_pms_metadata'] = {
                'room_id': availability.room_id,
                'availability_id': availability.id,
                'is_blocked': availability.is_blocked,
                'is_maintenance': availability.is_maintenance,
                'is_out_of_order': availability.is_out_of_order,
                'reason': availability.reason
            }
            
            return wb_data
            
        except Exception as e:
            self.logger.error(f"Erro ao converter disponibilidade {availability.id}: {str(e)}")
            return None
    
    def _calculate_wubook_rate(
        self,
        pms_rate: Decimal,
        mapping: WuBookRoomMapping
    ) -> Optional[Decimal]:
        """Calcula tarifa para WuBook aplicando multiplicadores"""
        
        try:
            rate = Decimal(str(pms_rate))
            
            # Aplicar override de tarifa base se configurado
            if mapping.base_rate_override:
                rate = mapping.base_rate_override
            
            # Aplicar multiplicador
            if mapping.rate_multiplier and mapping.rate_multiplier != 1.0:
                rate = rate * Decimal(str(mapping.rate_multiplier))
            
            # Arredondar para 2 casas decimais
            return rate.quantize(Decimal('0.01'))
            
        except Exception as e:
            self.logger.error(f"Erro ao calcular tarifa WuBook: {str(e)}")
            return None
    
    def wubook_to_pms_availability(
        self,
        wubook_data: List[Dict[str, Any]],
        room_mappings: List[WuBookRoomMapping],
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        Converte disponibilidades do WuBook para formato PMS.
        
        Args:
            wubook_data: Lista de dados do WuBook
            room_mappings: Lista de mapeamentos de quartos
            tenant_id: ID do tenant
            
        Returns:
            Lista de dicionários com dados para criar/atualizar RoomAvailability
        """
        try:
            # Criar mapa de mapeamentos WuBook -> PMS
            wb_mapping_dict = {mapping.wubook_room_id: mapping for mapping in room_mappings}
            
            pms_data = []
            
            for wb_item in wubook_data:
                mapping = wb_mapping_dict.get(wb_item.get('room_id'))
                if not mapping or not mapping.sync_availability:
                    continue
                
                # Converter para formato PMS
                pms_item = self._convert_wubook_availability_to_pms(
                    wb_item, mapping, tenant_id
                )
                
                if pms_item:
                    pms_data.append(pms_item)
            
            self.logger.info(f"Convertidas {len(pms_data)} disponibilidades WuBook -> PMS")
            return pms_data
            
        except Exception as e:
            self.logger.error(f"Erro ao converter WuBook -> PMS: {str(e)}")
            return []
    
    def _convert_wubook_availability_to_pms(
        self,
        wb_data: Dict[str, Any],
        mapping: WuBookRoomMapping,
        tenant_id: int
    ) -> Optional[Dict[str, Any]]:
        """Converte uma disponibilidade WuBook individual para formato PMS"""
        
        try:
            # Validar data
            try:
                availability_date = datetime.strptime(wb_data['date'], '%Y-%m-%d').date()
            except (ValueError, KeyError):
                self.logger.error(f"Data inválida no WuBook: {wb_data.get('date')}")
                return None
            
            # Estrutura básica PMS
            pms_data = {
                'tenant_id': tenant_id,
                'room_id': mapping.room_id,
                'date': availability_date
            }
            
            # Status de disponibilidade
            wb_available = wb_data.get('available', 0)
            pms_data['is_available'] = wb_available > 0
            
            # Se não disponível, assumir que está bloqueado
            if wb_available == 0:
                pms_data['is_blocked'] = True
                pms_data['reason'] = "Bloqueado via WuBook"
            else:
                pms_data['is_blocked'] = False
            
            # Restrições de check-in/check-out
            pms_data['closed_to_arrival'] = bool(wb_data.get('closed_to_arrival', 0))
            pms_data['closed_to_departure'] = bool(wb_data.get('closed_to_departure', 0))
            
            # Estadia mínima e máxima
            pms_data['min_stay'] = wb_data.get('min_stay', 1)
            
            if 'max_stay' in wb_data and wb_data['max_stay']:
                pms_data['max_stay'] = wb_data['max_stay']
            
            # Tarifas (se habilitada sincronização)
            if mapping.sync_rates and 'rate' in wb_data:
                rate = self._calculate_pms_rate(
                    Decimal(str(wb_data['rate'])),
                    mapping
                )
                if rate:
                    pms_data['rate_override'] = rate
            
            # Campos de sincronização
            pms_data['wubook_synced'] = True
            pms_data['sync_pending'] = False
            pms_data['last_wubook_sync'] = datetime.utcnow().isoformat()
            pms_data['wubook_sync_error'] = None
            
            # Metadados do WuBook
            wb_metadata = {
                'wubook_room_id': wb_data.get('room_id'),
                'wubook_available': wb_available,
                'sync_source': 'wubook',
                'sync_timestamp': datetime.utcnow().isoformat()
            }
            
            # Preservar metadados PMS existentes se houver
            if '_pms_metadata' in wb_data:
                wb_metadata['original_pms_data'] = wb_data['_pms_metadata']
            
            pms_data['metadata'] = wb_metadata
            
            return pms_data
            
        except Exception as e:
            self.logger.error(f"Erro ao converter item WuBook: {str(e)}")
            return None
    
    def _calculate_pms_rate(
        self,
        wubook_rate: Decimal,
        mapping: WuBookRoomMapping
    ) -> Optional[Decimal]:
        """Calcula tarifa para PMS removendo multiplicadores"""
        
        try:
            rate = Decimal(str(wubook_rate))
            
            # Remover multiplicador se aplicado
            if mapping.rate_multiplier and mapping.rate_multiplier != 1.0:
                rate = rate / Decimal(str(mapping.rate_multiplier))
            
            # Se há override de tarifa base, usar o valor original PMS
            if mapping.base_rate_override:
                # Neste caso, manter a tarifa como veio do WuBook
                # pois pode ter sido alterada manualmente lá
                pass
            
            # Arredondar para 2 casas decimais
            return rate.quantize(Decimal('0.01'))
            
        except Exception as e:
            self.logger.error(f"Erro ao calcular tarifa PMS: {str(e)}")
            return None
    
    def create_availability_update_batch(
        self,
        pms_availabilities: List[RoomAvailability],
        room_mappings: List[WuBookRoomMapping],
        batch_size: int = 100
    ) -> List[List[Dict[str, Any]]]:
        """
        Cria lotes de atualizações para WuBook.
        
        Args:
            pms_availabilities: Disponibilidades PMS
            room_mappings: Mapeamentos de quartos
            batch_size: Tamanho do lote
            
        Returns:
            Lista de lotes de atualizações
        """
        try:
            # Converter todas as disponibilidades
            wubook_data = self.pms_to_wubook_availability(pms_availabilities, room_mappings)
            
            # Dividir em lotes
            batches = []
            for i in range(0, len(wubook_data), batch_size):
                batch = wubook_data[i:i + batch_size]
                batches.append(batch)
            
            self.logger.info(f"Criados {len(batches)} lotes de até {batch_size} itens")
            return batches
            
        except Exception as e:
            self.logger.error(f"Erro ao criar lotes: {str(e)}")
            return []
    
    def validate_wubook_data(
        self,
        wubook_data: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Valida dados do WuBook antes da conversão.
        
        Returns:
            Tupla com (dados_válidos, lista_de_erros)
        """
        valid_data = []
        errors = []
        
        required_fields = ['room_id', 'date']
        
        for i, item in enumerate(wubook_data):
            item_errors = []
            
            # Verificar campos obrigatórios
            for field in required_fields:
                if field not in item or not item[field]:
                    item_errors.append(f"Campo '{field}' ausente ou vazio")
            
            # Validar formato de data
            if 'date' in item:
                try:
                    datetime.strptime(item['date'], '%Y-%m-%d')
                except ValueError:
                    item_errors.append(f"Formato de data inválido: {item['date']}")
            
            # Validar valores numéricos
            numeric_fields = ['available', 'min_stay', 'max_stay', 'rate']
            for field in numeric_fields:
                if field in item and item[field] is not None:
                    try:
                        float(item[field])
                    except (ValueError, TypeError):
                        item_errors.append(f"Valor numérico inválido para '{field}': {item[field]}")
            
            # Validar valores booleanos
            boolean_fields = ['closed_to_arrival', 'closed_to_departure']
            for field in boolean_fields:
                if field in item and item[field] not in [0, 1, True, False]:
                    item_errors.append(f"Valor booleano inválido para '{field}': {item[field]}")
            
            if item_errors:
                errors.append(f"Item {i}: {'; '.join(item_errors)}")
            else:
                valid_data.append(item)
        
        if errors:
            self.logger.warning(f"Encontrados {len(errors)} itens inválidos nos dados WuBook")
        
        return valid_data, errors
    
    def validate_pms_data(
        self,
        pms_availabilities: List[RoomAvailability]
    ) -> Tuple[List[RoomAvailability], List[str]]:
        """
        Valida disponibilidades PMS antes da conversão.
        
        Returns:
            Tupla com (dados_válidos, lista_de_erros)
        """
        valid_data = []
        errors = []
        
        for i, availability in enumerate(pms_availabilities):
            item_errors = []
            
            # Verificar campos obrigatórios
            if not availability.room_id:
                item_errors.append("room_id ausente")
            
            if not availability.date:
                item_errors.append("date ausente")
            
            if not availability.tenant_id:
                item_errors.append("tenant_id ausente")
            
            # Validar valores lógicos
            if availability.min_stay and availability.min_stay < 1:
                item_errors.append(f"min_stay inválido: {availability.min_stay}")
            
            if availability.max_stay and availability.min_stay and availability.max_stay < availability.min_stay:
                item_errors.append("max_stay menor que min_stay")
            
            # Validar tarifa
            if availability.rate_override and availability.rate_override < 0:
                item_errors.append(f"rate_override negativo: {availability.rate_override}")
            
            if item_errors:
                errors.append(f"Availability {availability.id or i}: {'; '.join(item_errors)}")
            else:
                valid_data.append(availability)
        
        if errors:
            self.logger.warning(f"Encontradas {len(errors)} disponibilidades inválidas no PMS")
        
        return valid_data, errors
    
    def create_sync_summary(
        self,
        pms_to_wubook_count: int,
        wubook_to_pms_count: int,
        errors: List[str],
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, Any]:
        """Cria resumo da sincronização"""
        
        duration = (end_time - start_time).total_seconds()
        
        return {
            "sync_summary": {
                "started_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "duration_seconds": duration,
                "pms_to_wubook_count": pms_to_wubook_count,
                "wubook_to_pms_count": wubook_to_pms_count,
                "total_processed": pms_to_wubook_count + wubook_to_pms_count,
                "error_count": len(errors),
                "success_rate": (
                    (pms_to_wubook_count + wubook_to_pms_count - len(errors)) /
                    max(pms_to_wubook_count + wubook_to_pms_count, 1) * 100
                ),
                "errors": errors[:10],  # Primeiros 10 erros
                "has_more_errors": len(errors) > 10
            }
        }
    
    def create_diff_report(
        self,
        pms_data: List[RoomAvailability],
        wubook_data: List[Dict[str, Any]],
        room_mappings: List[WuBookRoomMapping]
    ) -> Dict[str, Any]:
        """
        Cria relatório de diferenças entre PMS e WuBook.
        Útil para detectar inconsistências.
        """
        try:
            # Criar mapas para comparação
            mapping_dict = {m.wubook_room_id: m for m in room_mappings}
            reverse_mapping = {m.room_id: m for m in room_mappings}
            
            # Organizar dados PMS por chave (room_id, date)
            pms_dict = {}
            for avail in pms_data:
                key = (avail.room_id, avail.date.strftime('%Y-%m-%d'))
                pms_dict[key] = avail
            
            # Organizar dados WuBook por chave (room_id, date)
            wb_dict = {}
            for wb_item in wubook_data:
                mapping = mapping_dict.get(wb_item.get('room_id'))
                if mapping:
                    key = (mapping.room_id, wb_item.get('date'))
                    wb_dict[key] = wb_item
            
            # Encontrar diferenças
            differences = []
            all_keys = set(pms_dict.keys()) | set(wb_dict.keys())
            
            for key in all_keys:
                room_id, date_str = key
                pms_avail = pms_dict.get(key)
                wb_item = wb_dict.get(key)
                
                if pms_avail and wb_item:
                    # Comparar valores
                    diff = self._compare_availability_data(pms_avail, wb_item, reverse_mapping.get(room_id))
                    if diff:
                        differences.append({
                            "room_id": room_id,
                            "date": date_str,
                            "type": "value_difference",
                            "differences": diff
                        })
                elif pms_avail and not wb_item:
                    differences.append({
                        "room_id": room_id,
                        "date": date_str,
                        "type": "missing_in_wubook",
                        "pms_data": self._summarize_pms_availability(pms_avail)
                    })
                elif wb_item and not pms_avail:
                    differences.append({
                        "room_id": room_id,
                        "date": date_str,
                        "type": "missing_in_pms",
                        "wubook_data": self._summarize_wubook_availability(wb_item)
                    })
            
            return {
                "total_differences": len(differences),
                "missing_in_wubook": len([d for d in differences if d["type"] == "missing_in_wubook"]),
                "missing_in_pms": len([d for d in differences if d["type"] == "missing_in_pms"]),
                "value_differences": len([d for d in differences if d["type"] == "value_difference"]),
                "differences": differences[:50],  # Primeiras 50 diferenças
                "has_more_differences": len(differences) > 50
            }
            
        except Exception as e:
            self.logger.error(f"Erro ao criar diff report: {str(e)}")
            return {"error": str(e)}
    
    def _compare_availability_data(
        self,
        pms_avail: RoomAvailability,
        wb_item: Dict[str, Any],
        mapping: Optional[WuBookRoomMapping]
    ) -> List[Dict[str, Any]]:
        """Compara dados de disponibilidade entre PMS e WuBook"""
        
        differences = []
        
        # Comparar disponibilidade
        pms_available = pms_avail.is_bookable
        wb_available = wb_item.get('available', 0) > 0
        
        if pms_available != wb_available:
            differences.append({
                "field": "available",
                "pms_value": pms_available,
                "wubook_value": wb_available
            })
        
        # Comparar restrições
        if pms_avail.closed_to_arrival != bool(wb_item.get('closed_to_arrival', 0)):
            differences.append({
                "field": "closed_to_arrival",
                "pms_value": pms_avail.closed_to_arrival,
                "wubook_value": bool(wb_item.get('closed_to_arrival', 0))
            })
        
        if pms_avail.closed_to_departure != bool(wb_item.get('closed_to_departure', 0)):
            differences.append({
                "field": "closed_to_departure",
                "pms_value": pms_avail.closed_to_departure,
                "wubook_value": bool(wb_item.get('closed_to_departure', 0))
            })
        
        # Comparar min_stay
        if pms_avail.min_stay != wb_item.get('min_stay', 1):
            differences.append({
                "field": "min_stay",
                "pms_value": pms_avail.min_stay,
                "wubook_value": wb_item.get('min_stay', 1)
            })
        
        return differences
    
    def _summarize_pms_availability(self, avail: RoomAvailability) -> Dict[str, Any]:
        """Cria resumo de disponibilidade PMS"""
        return {
            "is_available": avail.is_available,
            "is_bookable": avail.is_bookable,
            "closed_to_arrival": avail.closed_to_arrival,
            "closed_to_departure": avail.closed_to_departure,
            "min_stay": avail.min_stay,
            "max_stay": avail.max_stay,
            "rate_override": float(avail.rate_override) if avail.rate_override else None
        }
    
    def _summarize_wubook_availability(self, wb_item: Dict[str, Any]) -> Dict[str, Any]:
        """Cria resumo de disponibilidade WuBook"""
        return {
            "available": wb_item.get('available', 0),
            "closed_to_arrival": wb_item.get('closed_to_arrival', 0),
            "closed_to_departure": wb_item.get('closed_to_departure', 0),
            "min_stay": wb_item.get('min_stay', 1),
            "max_stay": wb_item.get('max_stay'),
            "rate": wb_item.get('rate')
        }