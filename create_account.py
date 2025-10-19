import sys
import os

# Adicionar path da aplicação
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

def create_new_account():
    from app.core.database import SessionLocal
    from app.services.tenant_service import TenantService
    from app.services.user_service import UserService
    from app.schemas.tenant import TenantCreate
    from app.schemas.user import UserCreate
    
    print("=== Criação de Nova Conta ===")
    
    # Dados da conta
    company_name = input("Nome da empresa: ").strip()
    if not company_name:
        print("❌ Nome da empresa é obrigatório")
        return
    
    slug = input("Slug da empresa (deixe vazio para gerar automaticamente): ").strip()
    if not slug:
        import re
        import secrets
        slug_base = re.sub(r'[^a-zA-Z0-9]', '-', company_name.lower())
        slug_base = re.sub(r'-+', '-', slug_base).strip('-')
        slug = f"{slug_base}-{secrets.token_hex(3)}"
    
    admin_name = input("Nome do administrador: ").strip()
    if not admin_name:
        print("❌ Nome do administrador é obrigatório")
        return
    
    admin_email = input("Email do administrador: ").strip()
    if not admin_email:
        print("❌ Email é obrigatório")
        return
    
    admin_password = input("Senha do administrador: ").strip()
    if len(admin_password) < 6:
        print("❌ Senha deve ter pelo menos 6 caracteres")
        return
    
    # Criar conta
    db = SessionLocal()
    try:
        print(f"\n🔄 Criando tenant '{company_name}' (slug: {slug})...")
        
        # 1. Criar tenant
        tenant_service = TenantService(db)
        tenant_data = TenantCreate(name=company_name, slug=slug)
        tenant = tenant_service.create_tenant(tenant_data)
        
        print(f"✅ Tenant criado - ID: {tenant.id}")
        
        # 2. Criar usuário administrador
        print(f"🔄 Criando usuário administrador...")
        
        user_service = UserService(db)
        user_data = UserCreate(
            email=admin_email,
            password=admin_password,
            full_name=admin_name,
            tenant_id=tenant.id,
            is_superuser=False,
            is_active=True
        )
        
        user = user_service.create_user(user_data)
        
        print(f"✅ Usuário criado - ID: {user.id}")
        
        print(f"""
╔══════════════════════════════════════╗
║          CONTA CRIADA COM SUCESSO!    ║
╠══════════════════════════════════════╣
║ Empresa: {company_name:<25} ║
║ Slug: {slug:<30} ║
║ Admin: {admin_name:<28} ║
║ Email: {admin_email:<28} ║
║ Tenant ID: {tenant.id:<26} ║
║ User ID: {user.id:<28} ║
╚══════════════════════════════════════╝

🎉 Agora você pode fazer login em: http://localhost:3000/login
        """)
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao criar conta: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_new_account()
