// frontend/src/app/dashboard/layout.tsx
'use client';

import { useEffect, useState } from 'react';
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
  DollarSign,
  X
} from 'lucide-react';
import Link from 'next/link';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
    <div className="dashboard-container bg-gray-50">
      {/* ===== SIDEBAR MOBILE OVERLAY ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className={`dashboard-sidebar mobile-open bg-white shadow-xl`}>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* ===== SIDEBAR DESKTOP ===== */}
      <div className="hidden md:block dashboard-sidebar bg-white shadow-lg border-r border-gray-200">
        <SidebarContent />
      </div>

      {/* ===== MAIN CONTENT WRAPPER ===== */}
      <div className="dashboard-main-wrapper">
        {/* ===== HEADER ===== */}
        <header className="dashboard-header bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Title */}
            <div className="flex-1 flex items-center">
              <h1 className="text-lg font-semibold text-gray-900 ml-2 md:ml-0">
                {tenant?.name || 'PMS Dashboard'}
              </h1>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-8 w-8 rounded-full border-2 border-blue-200 hover:border-blue-300"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt={user?.full_name || 'User'} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
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
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/properties" className="flex items-center">
                      <Building className="mr-2 h-4 w-4" />
                      Propriedades
                    </Link>
                  </DropdownMenuItem>
                  
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
        </header>

        {/* ===== MAIN CONTENT ===== */}
        <main className="dashboard-content">
          <div className="card-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <img 
            src="/tucapms-logo.png" 
            alt="TucaPMS" 
            className="h-10 w-10 object-contain"
          />
          <span className="ml-2 text-xl font-bold text-gray-900">TucaPMS</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <div className="flex-grow flex flex-col mt-4">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-2 py-4 border-t border-gray-200 mt-auto">
          <div className="text-xs text-gray-500 text-center">
            TucaPMS v1.0
          </div>
        </div>
      </div>
    </div>
  );
}