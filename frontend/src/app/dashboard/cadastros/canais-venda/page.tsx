// frontend/src/app/dashboard/cadastros/canais-venda/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  Store,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
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
import { useSalesChannels } from '@/hooks/use-sales-channels';
import { useToast } from '@/hooks/use-toast';
import SalesChannelModal from '@/components/sales-channels/SalesChannelModal';
import type { SalesChannel, SalesChannelsFilters, SalesChannelType } from '@/types/sales-channels';
import { getSalesChannelTypeLabel, SALES_CHANNEL_TYPES } from '@/types/sales-channels';

export default function CanaisVendaPage() {
  const {
    salesChannels,
    loading,
    error,
    total,
    page,
    per_page,
    total_pages,
    selectedIds,
    loadSalesChannels,
    deleteSalesChannel,
    toggleSalesChannelStatus,
    performBulkOperation,
    calculateCommission,
    applyFilters,
    clearFilters,
    toggleSelection,
    selectAll,
    clearSelection,
    hasSelected,
    selectedCount
  } = useSalesChannels();

  const { toast } = useToast();
  
  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterExternal, setFilterExternal] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSalesChannel, setEditingSalesChannel] = useState<SalesChannel | null>(null);
  const [loadingActions, setLoadingActions] = useState<{ [key: number]: string }>({});
  const [bulkLoading, setBulkLoading] = useState(false);

  // Aplicar filtros
  const handleApplyFilters = useCallback(() => {
    const filters: SalesChannelsFilters = {
      page: 1,
      per_page: 10
    };

    if (searchTerm.trim()) {
      filters.search = searchTerm.trim();
    }

    if (filterType !== 'all') {
      filters.channel_type = filterType as SalesChannelType;
    }

    if (filterExternal !== 'all') {
      filters.is_external = filterExternal === 'external';
    }

    if (filterActive !== 'all') {
      filters.is_active = filterActive === 'active';
    }

    applyFilters(filters);
  }, [searchTerm, filterType, filterExternal, filterActive, applyFilters]);

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterExternal('all');
    setFilterActive('all');
    clearFilters();
  };

  // Abrir modal para criar novo
  const handleCreate = () => {
    setEditingSalesChannel(null);
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEdit = (salesChannel: SalesChannel) => {
    setEditingSalesChannel(salesChannel);
    setShowModal(true);
  };

  // Deletar canal de venda
  const handleDelete = async (salesChannel: SalesChannel) => {
    if (!confirm(`Tem certeza que deseja remover "${salesChannel.name}"?`)) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [salesChannel.id]: 'deleting' }));
    
    try {
      await deleteSalesChannel(salesChannel.id, salesChannel.name);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[salesChannel.id];
        return newState;
      });
    }
  };

  // Alternar status
  const handleToggleStatus = async (salesChannel: SalesChannel) => {
    const newStatus = !salesChannel.is_active;
    setLoadingActions(prev => ({ ...prev, [salesChannel.id]: 'toggling' }));
    
    try {
      await toggleSalesChannelStatus(salesChannel.id, newStatus, salesChannel.name);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[salesChannel.id];
        return newState;
      });
    }
  };

  // Calcular comissão
  const handleCalculateCommission = async (salesChannel: SalesChannel) => {
    const amount = prompt('Digite o valor para calcular a comissão:');
    if (!amount || isNaN(Number(amount))) return;

    setLoadingActions(prev => ({ ...prev, [salesChannel.id]: 'calculating' }));
    
    try {
      const result = await calculateCommission(salesChannel.id, { 
        amount: Number(amount) 
      });
      
      toast({
        title: 'Cálculo de Comissão',
        description: `Valor original: R$ ${result.original_amount.toFixed(2)} | Comissão: R$ ${result.commission_amount.toFixed(2)} | Líquido: R$ ${result.net_amount.toFixed(2)}`
      });
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[salesChannel.id];
        return newState;
      });
    }
  };

  // Operações em massa
  const handleBulkOperation = async (operation: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.length === 0) return;

    const actionNames = {
      activate: 'ativar',
      deactivate: 'desativar', 
      delete: 'remover'
    };

    if (!confirm(`Tem certeza que deseja ${actionNames[operation]} ${selectedIds.length} canais selecionados?`)) {
      return;
    }

    setBulkLoading(true);
    
    try {
      await performBulkOperation({
        operation,
        channel_ids: selectedIds
      });
      clearSelection();
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setBulkLoading(false);
    }
  };

  // Seleção
  const handleSelectAll = () => {
    if (selectedIds.length === salesChannels.length) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  // Paginação
  const handlePageChange = (newPage: number) => {
    applyFilters({ page: newPage, per_page });
  };

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Canais de Venda</h2>
          <p className="text-sm text-gray-600 mt-1">
            {total > 0 ? (
              <>Exibindo {salesChannels.length} de {total} canais de venda</>
            ) : (
              'Configure os canais de venda e OTAs'
            )}
            {hasSelected && (
              <span className="ml-2 text-blue-600">• {selectedCount} selecionados</span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Ações em massa */}
          {hasSelected && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-700">
                {selectedCount} selecionados
              </span>
              
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
              
              <Button 
                size="sm" 
                variant="ghost"
                onClick={clearSelection}
              >
                Cancelar
              </Button>
            </div>
          )}
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Canal
          </Button>
        </div>
      </div>

      {/* Filtros */}
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de canais de venda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.length === salesChannels.length && salesChannels.length > 0}
              onCheckedChange={handleSelectAll}
              className="mr-2"
            />
            <Store className="h-5 w-5" />
            Canais Cadastrados
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-center text-red-600 bg-red-50 border-b">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Carregando canais de venda...</p>
            </div>
          ) : salesChannels.length === 0 ? (
            <div className="p-8 text-center">
              <Store className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum canal encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filterType !== 'all' || filterExternal !== 'all' || filterActive !== 'all'
                  ? 'Tente ajustar os filtros ou criar um novo canal'
                  : 'Comece criando seu primeiro canal de venda'
                }
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Canal
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {salesChannels.map((salesChannel) => (
                <div key={salesChannel.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Checkbox seleção */}
                    <Checkbox
                      checked={selectedIds.includes(salesChannel.id)}
                      onCheckedChange={() => toggleSelection(salesChannel.id)}
                    />
                    
                    {/* Ícone/Avatar */}
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      {salesChannel.is_external ? (
                        <Globe className="h-6 w-6 text-blue-600" />
                      ) : (
                        <Store className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                    
                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {salesChannel.name}
                        </h3>
                        
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {getSalesChannelTypeLabel(salesChannel.channel_type)}
                          </Badge>
                          
                          {salesChannel.is_external && (
                            <Badge variant="secondary">
                              Externo
                            </Badge>
                          )}
                          
                          <Badge 
                            variant={salesChannel.is_active ? "default" : "secondary"}
                            className="flex-shrink-0"
                          >
                            {salesChannel.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Código: {salesChannel.code}</span>
                        {salesChannel.commission_percentage && (
                          <span>Comissão: {salesChannel.commission_percentage}%</span>
                        )}
                        <span>
                          Criado em {new Date(salesChannel.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      {salesChannel.webhook_url && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Globe className="h-3 w-3" />
                          <span className="truncate">Webhook configurado</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
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
                          
                          <DropdownMenuItem onClick={() => handleEdit(salesChannel)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          
                          {salesChannel.commission_percentage && (
                            <DropdownMenuItem 
                              onClick={() => handleCalculateCommission(salesChannel)}
                            >
                              <Calculator className="mr-2 h-4 w-4" />
                              Calcular Comissão
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(salesChannel)}
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
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(salesChannel)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {total_pages > 1 && (
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
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                
                {/* Números das páginas */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, total_pages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= total_pages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Criar/Editar */}
      <SalesChannelModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingSalesChannel(null);
        }}
        salesChannel={editingSalesChannel}
        onSave={() => {
          setShowModal(false);
          setEditingSalesChannel(null);
          loadSalesChannels(); // Recarregar lista
        }}
      />
    </div>
  );
}