// src/app/dashboard/layout.tsx
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
  Map
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Calendário', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Mapa de Quartos', href: '/dashboard/room-map', icon: Map },
  { name: 'Reservas', href: '/dashboard/reservations', icon: Calendar },
  { name: 'Hóspedes', href: '/dashboard/guests', icon: Users },
  { name: 'Propriedades', href: '/dashboard/properties', icon: Building },
  { name: 'Tipos de Quartos', href: '/dashboard/room-types', icon: Tag },
  { name: 'Quartos', href: '/dashboard/rooms', icon: Bed },
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

      {/* Main content - ALTURA COMPLETA */}
      <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top header */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
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

            <div className="ml-4 flex items-center md:ml-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt={user?.full_name || ''} />
                      <AvatarFallback>
                        {user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.full_name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content - ALTURA COMPLETA SEM PADDING */}
        <main className="flex-1 overflow-hidden">
          {children}
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