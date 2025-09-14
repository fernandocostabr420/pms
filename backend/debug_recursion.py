#!/usr/bin/env python3
# backend/debug_recursion.py

"""
Script para diagnosticar o erro de recursão máxima no carregamento da API.
Execute este script para identificar imports circulares e problemas de recursão.
"""

import sys
import traceback
import importlib
from pathlib import Path
import os

# Adicionar o diretório backend ao PATH
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("🔍 DIAGNÓSTICO DE RECURSÃO - CHANNEL MANAGER PMS")
print("="*80)
print(f"📁 Diretório: {backend_dir}")
print(f"🐍 Python: {sys.version}")
print(f"📦 Módulos carregados: {len(sys.modules)}")
print("="*80)

def test_import(module_name, description=""):
    """Testa import de um módulo e captura erros"""
    print(f"\n{'='*60}")
    print(f"🔍 TESTANDO: {module_name}")
    if description:
        print(f"📝 {description}")
    print('='*60)
    
    try:
        # Limpar módulo do cache se já estiver carregado
        if module_name in sys.modules:
            print(f"🧹 Removendo {module_name} do cache")
            del sys.modules[module_name]
        
        print(f"📥 Importando {module_name}...")
        module = importlib.import_module(module_name)
        print(f"✅ SUCESSO: {module_name} importado")
        
        # Verificar atributos importantes
        attrs = dir(module)
        important_attrs = [attr for attr in attrs if not attr.startswith('_')]
        print(f"📦 Atributos: {len(important_attrs)}")
        if important_attrs:
            print(f"   🔑 Principais: {important_attrs[:5]}")
        
        return True, module
        
    except RecursionError as e:
        print(f"🔄 ERRO DE RECURSÃO: {module_name}")
        print(f"   💥 Detalhes: {str(e)[:200]}...")
        print(f"   📊 Profundidade atual: {sys.getrecursionlimit()}")
        return False, None
        
    except ImportError as e:
        print(f"❌ ERRO DE IMPORT: {module_name}")
        print(f"   💥 Detalhes: {e}")
        return False, None
        
    except Exception as e:
        print(f"⚠️ ERRO INESPERADO: {module_name}")
        print(f"   🔥 Tipo: {type(e).__name__}")
        print(f"   💥 Detalhes: {e}")
        # Mostrar apenas as últimas linhas do traceback
        print("   📋 Traceback (últimas 5 linhas):")
        tb_lines = traceback.format_exc().split('\n')
        for line in tb_lines[-7:-1]:  # Últimas linhas relevantes
            if line.strip():
                print(f"      {line}")
        return False, None


def check_file_exists(file_path):
    """Verifica se arquivo existe"""
    path = Path(file_path)
    exists = path.exists()
    print(f"📁 {file_path}: {'✅ EXISTS' if exists else '❌ NOT FOUND'}")
    return exists


def check_critical_files():
    """Verifica se arquivos críticos existem"""
    print(f"\n{'='*80}")
    print("📁 VERIFICANDO ARQUIVOS CRÍTICOS")
    print('='*80)
    
    critical_files = [
        "app/__init__.py",
        "app/main.py",
        "app/core/__init__.py", 
        "app/core/config.py",
        "app/core/database.py",
        "app/core/celery_app.py",
        "app/models/__init__.py",
        "app/tasks/__init__.py",
        "app/api/__init__.py",
        "app/api/v1/__init__.py",
        "app/api/v1/api.py",
    ]
    
    missing_files = []
    for file_path in critical_files:
        if not check_file_exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n❌ ARQUIVOS AUSENTES ({len(missing_files)}):")
        for file in missing_files:
            print(f"   • {file}")
    else:
        print(f"\n✅ TODOS OS ARQUIVOS CRÍTICOS ENCONTRADOS")
    
    return missing_files


def test_core_modules():
    """Testa módulos core primeiro"""
    print(f"\n{'='*80}")
    print("🔧 TESTANDO MÓDULOS CORE")
    print('='*80)
    
    core_modules = [
        ("app.core.config", "Configurações da aplicação"),
        ("app.core.database", "Conexão com banco de dados"),
        ("app.models", "Modelos principais"),
        ("app.schemas", "Schemas Pydantic"),
    ]
    
    results = {}
    for module, desc in core_modules:
        success, mod = test_import(module, desc)
        results[module] = success
    
    return results


def test_wubook_modules():
    """Testa módulos WuBook especificamente"""
    print(f"\n{'='*80}")
    print("📊 TESTANDO MÓDULOS WUBOOK")
    print('='*80)
    
    wubook_modules = [
        ("app.models.wubook_configuration", "Configuração WuBook"),
        ("app.models.wubook_room_mapping", "Mapeamento de quartos"),
        ("app.models.wubook_rate_plan", "Planos tarifários"),
        ("app.models.wubook_sync_log", "Logs de sincronização"),
        ("app.services.wubook_configuration_service", "Serviço de configuração"),
        ("app.integrations.wubook.wubook_client", "Cliente WuBook"),
        ("app.integrations.wubook.sync_service", "Serviço de sincronização"),
    ]
    
    results = {}
    for module, desc in wubook_modules:
        success, mod = test_import(module, desc)
        results[module] = success
        
        # Se passou, testar algumas funcionalidades
        if success and mod:
            print(f"   🔍 Verificando funcionalidades de {module}...")
            
            # Verificar classes principais
            classes = [attr for attr in dir(mod) if attr[0].isupper() and not attr.startswith('_')]
            if classes:
                print(f"   📦 Classes encontradas: {classes[:3]}")
    
    return results


def test_tasks_modules():
    """Testa módulos de tasks - PRINCIPAL SUSPEITO"""
    print(f"\n{'='*80}")
    print("📋 TESTANDO MÓDULOS TASKS (PRINCIPAL SUSPEITO)")
    print('='*80)
    
    # Primeiro limpar cache de todos os módulos tasks
    tasks_modules = [mod for mod in list(sys.modules.keys()) if mod.startswith('app.tasks')]
    if tasks_modules:
        print(f"🧹 Limpando cache de {len(tasks_modules)} módulos tasks...")
        for mod in tasks_modules:
            del sys.modules[mod]
    
    # Testar individualmente
    task_modules = [
        ("app.tasks.wubook_sync_tasks", "WuBook Sync Tasks"),
        ("app.tasks.availability_sync_job", "Availability Sync Job"),
    ]
    
    results = {}
    for module, desc in task_modules:
        success, mod = test_import(module, desc)
        results[module] = success
    
    # Agora testar o principal suspeito
    print(f"\n{'🔥'*60}")
    print("🎯 TESTANDO APP.TASKS (PRINCIPAL SUSPEITO)")
    print('🔥'*60)
    
    success, mod = test_import("app.tasks", "Tasks main module - PRINCIPAL SUSPEITO")
    results["app.tasks"] = success
    
    if success and mod:
        print("   🎉 app.tasks carregou sem recursão!")
        
        # Testar funcionalidades
        try:
            if hasattr(mod, 'get_available_tasks'):
                print("   🧪 Testando get_available_tasks()...")
                tasks = mod.get_available_tasks()
                print(f"   ✅ {len(tasks)} tasks disponíveis")
            
            if hasattr(mod, 'validate_tasks_health'):
                print("   🧪 Testando validate_tasks_health()...")
                health = mod.validate_tasks_health()
                print(f"   ✅ Status: {health.get('status', 'unknown')}")
                
        except Exception as e:
            print(f"   ⚠️ Erro ao testar funcionalidades: {e}")
    
    return results


def test_celery_module():
    """Testa módulo Celery"""
    print(f"\n{'='*80}")
    print("⚙️ TESTANDO MÓDULO CELERY")
    print('='*80)
    
    # Limpar cache do Celery
    celery_modules = [mod for mod in list(sys.modules.keys()) if 'celery' in mod.lower()]
    for mod in celery_modules:
        if mod.startswith('app.'):
            print(f"🧹 Limpando {mod}")
            del sys.modules[mod]
    
    success, mod = test_import("app.core.celery_app", "Configuração Celery")
    
    if success and mod:
        print("   🧪 Verificando configuração Celery...")
        
        if hasattr(mod, 'celery_app'):
            print("   ✅ celery_app encontrado")
        
        if hasattr(mod, 'create_celery_tasks'):
            print("   ✅ create_celery_tasks encontrado")
            try:
                print("   🧪 Testando create_celery_tasks()...")
                tasks = mod.create_celery_tasks()
                print(f"   ✅ {len(tasks)} tasks Celery criadas")
            except Exception as e:
                print(f"   ⚠️ Erro em create_celery_tasks(): {e}")
    
    return success


def test_api_modules():
    """Testa módulos da API"""
    print(f"\n{'='*80}")
    print("🚀 TESTANDO MÓDULOS DA API")
    print('='*80)
    
    # Testar endpoints individuais primeiro
    endpoints = [
        "app.api.v1.endpoints.auth",
        "app.api.v1.endpoints.users",
        "app.api.v1.endpoints.wubook",
        "app.api.v1.endpoints.channel_manager",
    ]
    
    results = {}
    for endpoint in endpoints:
        success, mod = test_import(endpoint, f"Endpoint: {endpoint}")
        results[endpoint] = success
    
    # Testar API principal
    print(f"\n{'🎯'*60}")
    print("🎯 TESTANDO API PRINCIPAL")
    print('🎯'*60)
    
    success, mod = test_import("app.api.v1.api", "Router principal da API")
    results["app.api.v1.api"] = success
    
    if success and mod:
        print("   🧪 Verificando router...")
        if hasattr(mod, 'api_router'):
            router = mod.api_router
            print(f"   ✅ Router encontrado com {len(router.routes)} rotas")
            
            # Mostrar algumas rotas
            wubook_routes = [r for r in router.routes if hasattr(r, 'path') and 'wubook' in r.path.lower()]
            if wubook_routes:
                print(f"   📍 Rotas WuBook: {len(wubook_routes)}")
                for route in wubook_routes[:3]:
                    print(f"      • {route.path}")
    
    return results


def generate_report(all_results):
    """Gera relatório final"""
    print(f"\n{'='*80}")
    print("📊 RELATÓRIO FINAL DE DIAGNÓSTICO")
    print('='*80)
    
    # Contar sucessos e falhas
    total_modules = sum(len(results) for results in all_results.values())
    successful_modules = sum(
        sum(1 for success in results.values() if success) 
        for results in all_results.values()
    )
    failed_modules = total_modules - successful_modules
    
    print(f"📈 ESTATÍSTICAS:")
    print(f"   • Total de módulos testados: {total_modules}")
    print(f"   • Sucessos: {successful_modules}")
    print(f"   • Falhas: {failed_modules}")
    print(f"   • Taxa de sucesso: {(successful_modules/total_modules*100):.1f}%")
    
    # Identificar módulos problemáticos
    failed_list = []
    for category, results in all_results.items():
        for module, success in results.items():
            if not success:
                failed_list.append(f"{module} ({category})")
    
    if failed_list:
        print(f"\n❌ MÓDULOS COM PROBLEMA ({len(failed_list)}):")
        for module in failed_list:
            print(f"   • {module}")
        
        # Análise específica
        print(f"\n🔍 ANÁLISE:")
        
        if any('app.tasks' in module for module in failed_list):
            print("   🎯 PROBLEMA PRINCIPAL: Módulo app.tasks")
            print("      ➡️ SOLUÇÃO: Aplicar correção do tasks/__init__.py")
        
        if any('celery' in module.lower() for module in failed_list):
            print("   ⚙️ PROBLEMA: Configuração Celery")
            print("      ➡️ SOLUÇÃO: Simplificar celery_app.py")
        
        if any('wubook' in module.lower() for module in failed_list):
            print("   📊 PROBLEMA: Módulos WuBook")
            print("      ➡️ VERIFICAR: Imports circulares em models/services")
        
        if any('api' in module.lower() for module in failed_list):
            print("   🚀 PROBLEMA: API")
            print("      ➡️ VERIFICAR: Endpoints com dependências problemáticas")
            
    else:
        print(f"\n🎉 TODOS OS MÓDULOS CARREGARAM COM SUCESSO!")
        print("   ✅ Não há problemas de recursão detectados")
        print("   ✅ Sistema pronto para funcionar")
    
    return failed_list


def main():
    """Função principal do diagnóstico"""
    
    print("\n🔍 INICIANDO DIAGNÓSTICO COMPLETO...")
    
    # 1. Verificar arquivos
    print("\n📁 FASE 1: Verificação de Arquivos")
    missing_files = check_critical_files()
    
    if missing_files:
        print("❌ ERRO: Arquivos críticos ausentes. Verifique a estrutura do projeto.")
        return
    
    # 2. Testar módulos core
    print("\n🔧 FASE 2: Módulos Core")
    core_results = test_core_modules()
    
    # 3. Testar Celery
    print("\n⚙️ FASE 3: Celery")
    celery_success = test_celery_module()
    celery_results = {"app.core.celery_app": celery_success}
    
    # 4. Testar WuBook
    print("\n📊 FASE 4: Módulos WuBook")
    wubook_results = test_wubook_modules()
    
    # 5. Testar Tasks
    print("\n📋 FASE 5: Módulos Tasks")
    tasks_results = test_tasks_modules()
    
    # 6. Testar API
    print("\n🚀 FASE 6: API")
    api_results = test_api_modules()
    
    # 7. Relatório final
    all_results = {
        "Core": core_results,
        "Celery": celery_results,
        "WuBook": wubook_results,
        "Tasks": tasks_results,
        "API": api_results,
    }
    
    failed_modules = generate_report(all_results)
    
    # 8. Próximos passos
    print(f"\n{'='*80}")
    print("🎯 PRÓXIMOS PASSOS")
    print('='*80)
    
    if failed_modules:
        print("1. ✏️ Aplicar correções nos módulos problemáticos")
        print("2. 🔄 Re-executar este diagnóstico")
        print("3. 🚀 Testar inicialização da aplicação")
        print("4. 📝 Verificar logs de erro específicos")
    else:
        print("1. 🚀 Tentar inicializar a aplicação")
        print("2. 🧪 Executar testes unitários")
        print("3. 📊 Verificar funcionalidades do Channel Manager")
    
    print(f"\n{'='*80}")
    print("✅ DIAGNÓSTICO CONCLUÍDO")
    print('='*80)


if __name__ == "__main__":
    main()