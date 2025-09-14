#!/usr/bin/env python3
# debug_wubook.py - Script para identificar problema de relacionamento

import sys
import traceback

print("=" * 60)
print("DEBUG: Testando imports dos modelos WuBook")
print("=" * 60)

# Teste 1: Imports básicos
try:
    print("\n1. Testando imports do SQLAlchemy...")
    from sqlalchemy import Column, Integer, String, ForeignKey
    from sqlalchemy.orm import relationship, backref
    print("   ✅ SQLAlchemy imports OK")
except Exception as e:
    print(f"   ❌ Erro no SQLAlchemy: {e}")
    sys.exit(1)

# Teste 2: BaseModel e TenantMixin
try:
    print("\n2. Testando BaseModel e TenantMixin...")
    from app.models.base import BaseModel, TenantMixin
    print("   ✅ BaseModel e TenantMixin OK")
except Exception as e:
    print(f"   ❌ Erro em BaseModel/TenantMixin: {e}")
    traceback.print_exc()
    sys.exit(1)

# Teste 3: Modelos relacionados existentes
try:
    print("\n3. Testando modelos existentes relacionados...")
    from app.models.property import Property
    print("   ✅ Property OK")
    from app.models.room import Room
    print("   ✅ Room OK")
    from app.models.room_type import RoomType
    print("   ✅ RoomType OK")
    from app.models.sales_channel import SalesChannel
    print("   ✅ SalesChannel OK")
    from app.models.user import User
    print("   ✅ User OK")
except Exception as e:
    print(f"   ❌ Erro em modelos existentes: {e}")
    traceback.print_exc()
    sys.exit(1)

# Teste 4: WuBookConfiguration
try:
    print("\n4. Testando WuBookConfiguration...")
    from app.models.wubook_configuration import WuBookConfiguration
    print("   ✅ WuBookConfiguration importado")
    
    # Testar relacionamentos
    configs = dir(WuBookConfiguration)
    rels = [r for r in configs if 'room_mappings' in r or 'rate_plans' in r or 'sync_logs' in r]
    print(f"   Relacionamentos encontrados: {rels}")
    
except Exception as e:
    print(f"   ❌ Erro em WuBookConfiguration: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 5: WuBookRoomMapping
try:
    print("\n5. Testando WuBookRoomMapping...")
    from app.models.wubook_room_mapping import WuBookRoomMapping
    print("   ✅ WuBookRoomMapping importado")
    
    # Verificar relacionamentos
    mappings = dir(WuBookRoomMapping)
    rels = [r for r in mappings if 'configuration' in r or 'room' in r]
    print(f"   Relacionamentos encontrados: {rels}")
    
except Exception as e:
    print(f"   ❌ Erro em WuBookRoomMapping: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 6: WuBookRatePlan
try:
    print("\n6. Testando WuBookRatePlan...")
    from app.models.wubook_rate_plan import WuBookRatePlan
    print("   ✅ WuBookRatePlan importado")
    
    # Verificar relacionamento parent
    if hasattr(WuBookRatePlan, 'parent_rate_plan'):
        print("   ✅ parent_rate_plan existe")
        rel = getattr(WuBookRatePlan, 'parent_rate_plan')
        print(f"   Tipo: {type(rel)}")
    
except Exception as e:
    print(f"   ❌ Erro em WuBookRatePlan: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 7: WuBookSyncLog
try:
    print("\n7. Testando WuBookSyncLog...")
    from app.models.wubook_sync_log import WuBookSyncLog
    print("   ✅ WuBookSyncLog importado")
    
    # Verificar relacionamento parent
    if hasattr(WuBookSyncLog, 'parent_sync'):
        print("   ✅ parent_sync existe")
        rel = getattr(WuBookSyncLog, 'parent_sync')
        print(f"   Tipo: {type(rel)}")
    
except Exception as e:
    print(f"   ❌ Erro em WuBookSyncLog: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 8: Todos juntos via __init__
try:
    print("\n8. Testando import via __init__.py...")
    from app.models import (
        WuBookConfiguration,
        WuBookRoomMapping,
        WuBookRatePlan,
        WuBookSyncLog
    )
    print("   ✅ Todos os modelos importados via __init__")
except Exception as e:
    print(f"   ❌ Erro ao importar via __init__: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 9: Verificar API routes
try:
    print("\n9. Testando carregamento da API...")
    from app.api.v1.api import api_router
    print("   ✅ API router carregado")
    
    # Listar rotas
    routes = [r.path for r in api_router.routes if 'wubook' in r.path.lower()]
    print(f"   Rotas WuBook encontradas: {len(routes)}")
    for route in routes[:5]:
        print(f"      - {route}")
        
except Exception as e:
    print(f"   ❌ Erro ao carregar API: {e}")
    print("   Detalhes:")
    traceback.print_exc()

# Teste 10: Service
try:
    print("\n10. Testando WuBookConfigurationService...")
    from app.services.wubook_configuration_service import WuBookConfigurationService
    print("   ✅ WuBookConfigurationService importado")
except Exception as e:
    print(f"   ❌ Erro em WuBookConfigurationService: {e}")
    print("   Detalhes:")
    traceback.print_exc()

print("\n" + "=" * 60)
print("DEBUG CONCLUÍDO")
print("=" * 60)
