// frontend/src/app/dashboard/layout.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  X,
  Search,
  Loader2,
  FolderOpen,
  Car, // ✅ ÍCONE - ESTACIONAMENTO
  Radio // ✅ NOVO ÍCONE - CHANNEL MANAGER
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

// ✅ MODIFICAÇÃO: Adicionado Channel Manager e removido Calendário do menu lateral
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mapa de Quartos', href: '/dashboard/room-map', icon: Map },
  { name: 'Reservas', href: '/dashboard/reservations', icon: Calendar },
  { name: 'Pagamentos', href: '/dashboard/payments', icon: DollarSign },
  { name: 'Hóspedes', href: '/dashboard/guests', icon: Users },
  { name: 'Disponibilidade', href: '/dashboard/room-availability', icon: Calendar },
  { name: 'Channel Manager', href: '/dashboard/channel-manager', icon: Radio }, // ✅ NOVA ENTRADA
];

// Tipo para resultados da busca
interface SearchResult {
  id: number;
  reservation_number: string;
  guest_name: string;
  guest_email: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount: number;
  room_info?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, isAuthenticated, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Estados para busca global
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Refs para controle de foco e clique fora
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('Layout Debug:', { user, tenant, isAuthenticated, isLoading });
  }, [user, tenant, isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fechar busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [searchOpen]);

  // Focar no input quando abrir a busca
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Debounce para busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Função para realizar a busca
  const performSearch = async (term: string) => {
    if (!term.trim()) return;

    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await apiClient.getReservations({
        search: term,
        page: 1,
        per_page: 10
      });

      // Mapear resultados para o formato esperado
      const results: SearchResult[] = response.reservations.map((reservation: any) => ({
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        guest_name: reservation.guest_name || `${reservation.guest?.first_name || ''} ${reservation.guest?.last_name || ''}`.trim(),
        guest_email: reservation.guest?.email || '',
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        status: reservation.status,
        total_amount: reservation.total_amount || 0,
        room_info: reservation.room_info || ''
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSearchError('Erro ao buscar reservas');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Função para abrir busca
  const handleSearchClick = () => {
    setSearchOpen(true);
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
  };

  // Função para selecionar uma reserva
  const handleSelectReservation = (reservation: SearchResult) => {
    setSearchOpen(false);
    setSearchTerm('');
    setSearchResults([]);
    router.push(`/dashboard/reservations/${reservation.id}`);
  };

  // Função para formatar status
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmada',
      checked_in: 'Check-in',
      checked_out: 'Check-out',
      cancelled: 'Cancelada',
      no_show: 'No Show'
    };
    return statusMap[status] || status;
  };

  // Função para formatar valor
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

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

            {/* Busca Global e User menu */}
            <div className="flex items-center space-x-3">
              {/* Busca Global */}
              <div className="relative" ref={searchContainerRef}>
                {!searchOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSearchClick}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                ) : (
                  <div className="relative">
                    {/* Input de busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Buscar reservas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-80 pl-10 pr-10 h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchOpen(false)}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Dropdown de resultados */}
                    {searchOpen && (searchTerm.length > 0 || searchLoading) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                        {searchLoading && (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            <span className="ml-2 text-sm text-gray-600">Buscando...</span>
                          </div>
                        )}

                        {searchError && (
                          <div className="px-4 py-3 text-sm text-red-600">
                            {searchError}
                          </div>
                        )}

                        {!searchLoading && !searchError && searchResults.length === 0 && searchTerm.length > 0 && (
                          <div className="px-4 py-3 text-sm text-gray-600">
                            Nenhuma reserva encontrada
                          </div>
                        )}

                        {!searchLoading && searchResults.length > 0 && (
                          <div className="py-1">
                            {searchResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => handleSelectReservation(result)}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-gray-900">
                                        #{result.reservation_number}
                                      </span>
                                      <span className={cn(
                                        "px-2 py-0.5 text-xs font-medium rounded-full",
                                        result.status === 'confirmed' && "bg-green-100 text-green-700",
                                        result.status === 'pending' && "bg-yellow-100 text-yellow-700",
                                        result.status === 'checked_in' && "bg-blue-100 text-blue-700",
                                        result.status === 'checked_out' && "bg-gray-100 text-gray-700",
                                        result.status === 'cancelled' && "bg-red-100 text-red-700"
                                      )}>
                                        {getStatusLabel(result.status)}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 truncate">
                                      {result.guest_name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {formatDate(result.check_in_date)} - {formatDate(result.check_out_date)}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {formatCurrency(result.total_amount)}
                                    </div>
                                    {result.room_info && (
                                      <div className="text-xs text-gray-500">
                                        {result.room_info}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User menu */}
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
                  
                  {/* ✅ MODIFICAÇÃO: Cadastros movido para o User Menu */}
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/cadastros" className="flex items-center">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Cadastros
                    </Link>
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
                  
                  {/* ✅ ITEM - ESTACIONAMENTO */}
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/properties/parking" className="flex items-center">
                      <Car className="mr-2 h-4 w-4" />
                      Estacionamento
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