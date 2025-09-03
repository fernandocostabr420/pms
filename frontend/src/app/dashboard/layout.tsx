// frontend/src/app/dashboard/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Hotel, 
  LayoutDashboard, 
  Calendar,
  Users,
  Building,
  Bed,
  Tag,
  Settings,
  LogOut,
  User,
  Menu,
  Map,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Calendário', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Mapa de Quartos', href: '/dashboard/room-map', icon: Map },
  { name: 'Reservas', href: '/dashboard/reservations', icon: Calendar },
  { name: 'Pagamentos', href: '/dashboard/payments', icon: DollarSign },
  { name: 'Hóspedes', href: '/dashboard/guests', icon: Users },
  { name: 'Disponibilidade', href: '/dashboard/room-availability', icon: Calendar },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, isAuthenticated, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Debug: Verificar se os dados estão chegando
  useEffect(() => {
    console.log('Layout Debug:', { user, tenant, isAuthenticated, isLoading });
  }, [user, tenant, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/tucapms-logo.png" 
            alt="TucaPMS" 
            className="h-12 w-12 mx-auto animate-pulse object-contain"
          />
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 flex z-40 md:hidden"
          role="dialog" 
          aria-modal="true"
        >
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <SidebarContent />
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top header - LIMPO */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          {/* Mobile menu button */}
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex items-center">
              <h1 className="text-lg font-semibold text-gray-900">
                {tenant?.name || 'PMS Dashboard'}
              </h1>
            </div>

            {/* User menu - APENAS DROPDOWN SIMPLES */}
            <div className="ml-4 flex items-center md:ml-6">
              {/* Debug visual - remover depois */}
              <div className="mr-2 text-xs text-gray-500">
                {user?.full_name ? `Logado: ${user.full_name}` : 'Sem usuário'}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-8 w-8 rounded-full border-2 border-blue-200"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt={user?.full_name || 'User'} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.full_name || 'Nome não disponível'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email || 'Email não disponível'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {tenant?.name || 'Tenant não disponível'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => alert('Funcionalidade em desenvolvimento')}>
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alert('Funcionalidade em desenvolvimento')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/properties" className="flex items-center">
                      <Building className="mr-2 h-4 w-4" />
                      Propriedades
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/room-types" className="flex items-center">
                      <Tag className="mr-2 h-4 w-4" />
                      Tipos de Quartos
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/rooms" className="flex items-center">
                      <Bed className="mr-2 h-4 w-4" />
                      Unidades Habitacionais
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      console.log('Logout clicado');
                      logout();
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden p-4">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent() {
  return (
    <div className="flex flex-col h-full bg-white shadow-md">
      <div className="flex items-center flex-shrink-0 px-4 py-4">
        <img 
          src="/tucapms-logo.png" 
          alt="TucaPMS" 
          className="h-10 w-10 object-contain"
        />
        <span className="ml-2 text-xl font-bold text-gray-900">TucaPMS</span>
      </div>
      
      <div className="mt-8 flex-grow flex flex-col">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}