// frontend/src/components/payment-methods/PaymentMethodsList.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CreditCard,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Eye,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PaymentMethod, PaymentMethodsFilters } from '@/types/payment-methods';

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethod[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
  filters?: PaymentMethodsFilters;
  
  // Callbacks
  onFilterChange?: (filters: PaymentMethodsFilters) => void;
  onClearFilters?: () => void;
  onCreate?: () => void;
  onEdit?: (paymentMethod: PaymentMethod) => void;
  onDelete?: (paymentMethod: PaymentMethod) => void;
  onToggleStatus?: (paymentMethod: PaymentMethod) => void;
  onView?: (paymentMethod: PaymentMethod) => void;
  onPageChange?: (page: number) => void;
  
  // Estados de loading para ações específicas
  loadingActions?: { [key: number]: string };
  
  // Configurações de exibição
  showFilters?: boolean;
  showPagination?: boolean;
  showActions?: boolean;
  compact?: boolean;
  selectable?: boolean;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
}

export default function PaymentMethodsList({
  paymentMethods = [],
  loading = false,
  error = null,
  total = 0,
  page = 1,
  per_page = 10,
  total_pages = 0,
  filters = {},
  
  onFilterChange,
  onClearFilters,
  onCreate,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  onPageChange,
  
  loadingActions = {},
  
  showFilters = true,
  showPagination = true,
  showActions = true,
  compact = false,
  selectable = false,
  selectedIds = [],
  onSelectionChange
}: PaymentMethodsListProps) {
  
  // Estados locais dos filtros
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [filterActive, setFilterActive] = useState<string>(
    filters.is_active !== undefined ? (filters.is_active ? 'active' : 'inactive') : 'all'
  );
  const [filterFee, setFilterFee] = useState<string>(
    filters.has_fee !== undefined ? (filters.has_fee ? 'with_fee' : 'without_fee') : 'all'
  );

  // Aplicar filtros
  const handleApplyFilters = () => {
    if (!onFilterChange) return;

    const newFilters: PaymentMethodsFilters = {
      page: 1,
      per_page
    };

    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }

    if (filterActive !== 'all') {
      newFilters.is_active = filterActive === 'active';
    }

    if (filterFee !== 'all') {
      newFilters.has_fee = filterFee === 'with_fee';
    }

    onFilterChange(newFilters);
  };

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterActive('all');
    setFilterFee('all');
    onClearFilters?.();
  };

  // Seleção
  const handleToggleSelection = (id: number) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    
    const allSelected = selectedIds.length === paymentMethods.length;
    const newSelection = allSelected ? [] : paymentMethods.map(pm => pm.id);
    
    onSelectionChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar métodos de pagamento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={filterActive} onValueChange={setFilterActive}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterFee} onValueChange={setFilterFee}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Taxa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="with_fee">Com Taxa</SelectItem>
                    <SelectItem value="without_fee">Sem Taxa</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" size="sm" onClick={handleApplyFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrar
                </Button>
                
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Limpar
                </Button>
                
                {onCreate && (
                  <Button size="sm" onClick={onCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className={cn(compact && "pb-2")}>
          <CardTitle className="flex items-center gap-2">
            {selectable && paymentMethods.length > 0 && (
              <input
                type="checkbox"
                checked={selectedIds.length === paymentMethods.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300"
              />
            )}
            <CreditCard className="h-5 w-5" />
            Métodos de Pagamento
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectable && selectedIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedIds.length} selecionados
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-center text-red-600 bg-red-50 border-b">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className={cn("p-8 text-center", compact && "p-4")}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Carregando métodos...</p>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className={cn("p-8 text-center", compact && "p-4")}>
              <CreditCard className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum método encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                Não há métodos de pagamento cadastrados
              </p>
              {onCreate && (
                <Button onClick={onCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Método
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {paymentMethods.map((paymentMethod) => (
                <div 
                  key={paymentMethod.id} 
                  className={cn(
                    "p-4 hover:bg-gray-50 transition-colors",
                    compact && "p-3"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Seleção */}
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(paymentMethod.id)}
                        onChange={() => handleToggleSelection(paymentMethod.id)}
                        className="rounded border-gray-300"
                      />
                    )}
                    
                    {/* Ícone/Avatar */}
                    <div 
                      className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center text-white font-medium",
                        compact && "w-10 h-10"
                      )}
                      style={{ backgroundColor: paymentMethod.color || '#3B82F6' }}
                    >
                      {paymentMethod.icon ? (
                        <span className={cn("text-lg", compact && "text-base")}>
                          {paymentMethod.icon}
                        </span>
                      ) : (
                        paymentMethod.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    
                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={cn(
                          "font-medium text-gray-900 truncate",
                          compact && "text-sm"
                        )}>
                          {paymentMethod.name}
                        </h3>
                        <Badge 
                          variant={paymentMethod.is_active ? "default" : "secondary"}
                          className={cn("flex-shrink-0", compact && "text-xs")}
                        >
                          {paymentMethod.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-4 text-sm text-gray-500",
                        compact && "text-xs gap-3"
                      )}>
                        <span>Código: {paymentMethod.code}</span>
                        {paymentMethod.fee_percentage && (
                          <span>Taxa: {paymentMethod.fee_percentage}%</span>
                        )}
                        {!compact && (
                          <span>
                            Criado em {new Date(paymentMethod.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      
                      {paymentMethod.description && !compact && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {paymentMethod.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Ações */}
                    {showActions && (
                      <div className="flex items-center gap-2">
                        {loadingActions[paymentMethod.id] && (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={!!loadingActions[paymentMethod.id]}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {onView && (
                              <DropdownMenuItem onClick={() => onView(paymentMethod)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                              </DropdownMenuItem>
                            )}
                            
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(paymentMethod)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            
                            {onToggleStatus && (
                              <DropdownMenuItem 
                                onClick={() => onToggleStatus(paymentMethod)}
                              >
                                {paymentMethod.is_active ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            
                            {onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => onDelete(paymentMethod)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remover
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {showPagination && total_pages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Página {page} de {total_pages} ({total} total)
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(page - 1)}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, total_pages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => onPageChange?.(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(page + 1)}
                  disabled={page >= total_pages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}