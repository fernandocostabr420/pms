// frontend/src/components/sales-channels/SalesChannelsList.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Store,
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
  Calculator,
  Globe,
  Users,
  CheckSquare,
  Square
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
import type { 
  SalesChannel, 
  SalesChannelsFilters, 
  SalesChannelType,
  BulkOperationRequest 
} from '@/types/sales-channels';
import { getSalesChannelTypeLabel, SALES_CHANNEL_TYPES } from '@/types/sales-channels';

interface SalesChannelsListProps {
  salesChannels: SalesChannel[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
  filters?: SalesChannelsFilters;
  
  // Seleção
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  
  // Callbacks
  onFilterChange?: (filters: SalesChannelsFilters) => void;
  onClearFilters?: () => void;
  onCreate?: () => void;
  onEdit?: (salesChannel: SalesChannel) => void;
  onDelete?: (salesChannel: SalesChannel) => void;
  onToggleStatus?: (salesChannel: SalesChannel) => void;
  onView?: (salesChannel: SalesChannel) => void;
  onCalculateCommission?: (salesChannel: SalesChannel) => void;
  onBulkOperation?: (request: BulkOperationRequest) => void;
  onPageChange?: (page: number) => void;
  
  // Estados de loading para ações específicas
  loadingActions?: { [key: number]: string };
  bulkLoading?: boolean;
  
  // Configurações de exibição
  showFilters?: boolean;
  showPagination?: boolean;
  showActions?: boolean;
  showBulkActions?: boolean;
  compact?: boolean;
  selectable?: boolean;
}

export default function SalesChannelsList({
  salesChannels = [],
  loading = false,
  error = null,
  total = 0,
  page = 1,
  per_page = 10,
  total_pages = 0,
  filters = {},
  
  selectedIds = [],
  onSelectionChange,
  
  onFilterChange,
  onClearFilters,
  onCreate,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  onCalculateCommission,
  onBulkOperation,
  onPageChange,
  
  loadingActions = {},
  bulkLoading = false,
  
  showFilters = true,
  showPagination = true,
  showActions = true,
  showBulkActions = true,
  compact = false,
  selectable = true
}: SalesChannelsListProps) {
  
  // Estados locais dos filtros
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [filterType, setFilterType] = useState<string>(filters.channel_type || 'all');
  const [filterExternal, setFilterExternal] = useState<string>(
    filters.is_external !== undefined ? (filters.is_external ? 'external' : 'internal') : 'all'
  );
  const [filterActive, setFilterActive] = useState<string>(
    filters.is_active !== undefined ? (filters.is_active ? 'active' : 'inactive') : 'all'
  );

  // Utilitários de seleção
  const hasSelected = selectedIds.length > 0;
  const selectedCount = selectedIds.length;
  const allSelected = selectedIds.length === salesChannels.length && salesChannels.length > 0;

  // Aplicar filtros
  const handleApplyFilters = () => {
    if (!onFilterChange) return;

    const newFilters: SalesChannelsFilters = {
      page: 1,
      per_page
    };

    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }

    if (filterType !== 'all') {
      newFilters.channel_type = filterType as SalesChannelType;
    }

    if (filterExternal !== 'all') {
      newFilters.is_external = filterExternal === 'external';
    }

    if (filterActive !== 'all') {
      newFilters.is_active = filterActive === 'active';
    }

    onFilterChange(newFilters);
  };

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterExternal('all');
    setFilterActive('all');
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
    
    const newSelection = allSelected ? [] : salesChannels.map(sc => sc.id);
    onSelectionChange(newSelection);
  };

  const handleClearSelection = () => {
    onSelectionChange?.([]);
  };

  // Operações em massa
  const handleBulkOperation = (operation: 'activate' | 'deactivate' | 'delete') => {
    if (!onBulkOperation || selectedIds.length === 0) return;
    
    onBulkOperation({
      operation,
      channel_ids: selectedIds
    });
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
                    placeholder="Buscar canais de venda..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {SALES_CHANNEL_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterExternal} onValueChange={setFilterExternal}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Local" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="external">Externos</SelectItem>
                    <SelectItem value="internal">Internos</SelectItem>
                  </SelectContent>
                </Select>
                
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

      {/* Ações em massa */}
      {showBulkActions && hasSelected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {selectedCount} {selectedCount === 1 ? 'canal selecionado' : 'canais selecionados'}
                </span>
                
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkOperation('activate')}
                    disabled={bulkLoading}
                  >
                    <Power className="h-3 w-3 mr-1" />
                    Ativar
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkOperation('deactivate')}
                    disabled={bulkLoading}
                  >
                    <PowerOff className="h-3 w-3 mr-1" />
                    Desativar
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkOperation('delete')}
                    disabled={bulkLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
              
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Cancelar seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className={cn(compact && "pb-2")}>
          <CardTitle className="flex items-center gap-2">
            {selectable && salesChannels.length > 0 && (
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                className="mr-2"
              />
            )}
            <Store className="h-5 w-5" />
            Canais de Venda
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            {hasSelected && (
              <Badge variant="secondary" className="ml-2">
                {selectedCount} selecionados
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
              <p className="text-gray-500 mt-2">Carregando canais...</p>
            </div>
          ) : salesChannels.length === 0 ? (
            <div className={cn("p-8 text-center", compact && "p-4")}>
              <Store className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum canal encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                Não há canais de venda cadastrados
              </p>
              {onCreate && (
                <Button onClick={onCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Canal
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {salesChannels.map((salesChannel) => (
                <div 
                  key={salesChannel.id} 
                  className={cn(
                    "p-4 hover:bg-gray-50 transition-colors",
                    compact && "p-3"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Seleção */}
                    {selectable && (
                      <Checkbox
                        checked={selectedIds.includes(salesChannel.id)}
                        onCheckedChange={() => handleToggleSelection(salesChannel.id)}
                      />
                    )}
                    
                    {/* Ícone/Avatar */}
                    <div className={cn(
                      "w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center",
                      compact && "w-10 h-10"
                    )}>
                      {salesChannel.is_external ? (
                        <Globe className="h-6 w-6 text-blue-600" />
                      ) : (
                        <Store className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                    
                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={cn(
                          "font-medium text-gray-900 truncate",
                          compact && "text-sm"
                        )}>
                          {salesChannel.name}
                        </h3>
                        
                        <div className="flex gap-2">
                          <Badge variant="outline" className={cn(compact && "text-xs")}>
                            {getSalesChannelTypeLabel(salesChannel.channel_type)}
                          </Badge>
                          
                          {salesChannel.is_external && (
                            <Badge variant="secondary" className={cn(compact && "text-xs")}>
                              Externo
                            </Badge>
                          )}
                          
                          <Badge 
                            variant={salesChannel.is_active ? "default" : "secondary"}
                            className={cn("flex-shrink-0", compact && "text-xs")}
                          >
                            {salesChannel.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-4 text-sm text-gray-500",
                        compact && "text-xs gap-3"
                      )}>
                        <span>Código: {salesChannel.code}</span>
                        {salesChannel.commission_percentage && (
                          <span>Comissão: {salesChannel.commission_percentage}%</span>
                        )}
                        {!compact && (
                          <span>
                            Criado em {new Date(salesChannel.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      
                      {salesChannel.webhook_url && !compact && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Globe className="h-3 w-3" />
                          <span className="truncate">Webhook configurado</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
                    {showActions && (
                      <div className="flex items-center gap-2">
                        {loadingActions[salesChannel.id] && (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={!!loadingActions[salesChannel.id]}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {onView && (
                              <DropdownMenuItem onClick={() => onView(salesChannel)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                              </DropdownMenuItem>
                            )}
                            
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(salesChannel)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            
                            {onCalculateCommission && salesChannel.commission_percentage && (
                              <DropdownMenuItem 
                                onClick={() => onCalculateCommission(salesChannel)}
                              >
                                <Calculator className="mr-2 h-4 w-4" />
                                Calcular Comissão
                              </DropdownMenuItem>
                            )}
                            
                            {onToggleStatus && (
                              <DropdownMenuItem 
                                onClick={() => onToggleStatus(salesChannel)}
                              >
                                {salesChannel.is_active ? (
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
                                  onClick={() => onDelete(salesChannel)}
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