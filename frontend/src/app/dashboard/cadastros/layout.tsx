// frontend/src/app/dashboard/cadastros/layout.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Store, 
  FolderOpen,
  ChevronRight,
  Home,
  Settings,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Definir navegação do módulo Cadastros
const cadastrosNavigation = [
  {
    name: 'Visão Geral',
    href: '/dashboard/cadastros',
    icon: FolderOpen,
    description: 'Dashboard dos cadastros'
  },
  {
    name: 'Métodos de Pagamento',
    href: '/dashboard/cadastros/metodos-pagamento',
    icon: CreditCard,
    description: 'Formas de pagamento aceitas',
    badge: 'API Ready'
  },
  {
    name: 'Canais de Venda',
    href: '/dashboard/cadastros/canais-venda',
    icon: Store,
    description: 'OTAs, site direto e parcerias',
    badge: 'API Ready'
  },
  {
    name: 'Usuários',
    href: '/dashboard/cadastros/usuarios',
    icon: Users,
    description: 'Gerenciar usuários do sistema',
    badge: 'Admin'
  }
];

// Função para obter o título da página baseado no pathname
function getPageTitle(pathname: string): string {
  const route = cadastrosNavigation.find(nav => nav.href === pathname);
  if (route) return route.name;
  
  if (pathname.includes('metodos-pagamento')) return 'Métodos de Pagamento';
  if (pathname.includes('canais-venda')) return 'Canais de Venda';
  if (pathname.includes('usuarios')) return 'Usuários';
  
  return 'Cadastros';
}

// Função para obter descrição da página
function getPageDescription(pathname: string): string {
  const route = cadastrosNavigation.find(nav => nav.href === pathname);
  if (route) return route.description;
  
  if (pathname.includes('metodos-pagamento')) return 'Configure as formas de pagamento aceitas pelo seu estabelecimento';
  if (pathname.includes('canais-venda')) return 'Gerencie canais de venda, OTAs e integrações';
  if (pathname.includes('usuarios')) return 'Gerencie usuários e permissões do sistema';
  
  return 'Gerencie métodos de pagamento e canais de venda';
}

// Breadcrumb component
function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
      <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      <ChevronRight className="h-4 w-4" />
      <Link href="/dashboard/cadastros" className="hover:text-gray-700 transition-colors">
        Cadastros
      </Link>
      
      {pathname !== '/dashboard/cadastros' && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">
            {getPageTitle(pathname)}
          </span>
        </>
      )}
    </nav>
  );
}

// Componente de navegação lateral (sidebar secundária)
function CadastrosSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-blue-600" />
          Cadastros
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Configurações básicas
        </p>
      </div>
      
      <nav className="p-2">
        {cadastrosNavigation.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <item.icon className={cn(
                'h-4 w-4 flex-shrink-0',
                isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
              )} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs px-1.5 py-0",
                        item.badge === 'Admin' && "bg-red-100 text-red-800"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {item.description}
                </p>
              </div>
              
              {isActive && (
                <div className="w-1 h-6 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* Seção de ações rápidas */}
      <div className="p-4 border-t border-gray-200 mt-4">
        <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide mb-3">
          Ações Rápidas
        </h4>
        
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs">
            <Settings className="h-3 w-3 mr-2" />
            Configurações
          </Button>
          
          <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs">
            <Search className="h-3 w-3 mr-2" />
            Busca Avançada
          </Button>
        </div>
      </div>
    </div>
  );
}

// Header do módulo
function CadastrosHeader({ pathname }: { pathname: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const pageTitle = getPageTitle(pathname);
  const pageDescription = getPageDescription(pathname);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {pageTitle}
          </h1>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {pageDescription}
          </p>
        </div>
        
        {/* Barra de busca global do módulo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar nos cadastros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}

// Layout principal
export default function CadastrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white px-6 pt-4">
        <Breadcrumb pathname={pathname} />
      </div>
      
      {/* Header do módulo */}
      <CadastrosHeader pathname={pathname} />
      
      <div className="flex min-h-[calc(100vh-200px)]">
        {/* Sidebar secundária */}
        <CadastrosSidebar pathname={pathname} />
        
        {/* Conteúdo principal */}
        <div className="flex-1">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
      
      {/* Footer opcional */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Módulo Cadastros • TucaPMS v1.0</span>
            <Badge variant="outline" className="text-xs">
              APIs Ativas
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span>Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}