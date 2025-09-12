// frontend/src/app/dashboard/cadastros/canais-venda/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus,
  Search,
  Filter,
  Download,
  Settings,
  Store,
  Globe,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Percent
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
import type { SalesChannelResponse, SalesChannelFilters } from '@/lib/api/sales-channels';
import { getSalesChannelTypeLabel, SALES_CHANNEL_TYPES } from '@/types/sales-channels';

export default function CanaisVendaPage() {
  const {
    salesChannels,
    loading,
    error,
    pagination: { total, page, pages: total_pages, per_page },
    filters,
    loadSalesChannels,
    setFilters,
    setPage,
    clearFilters: clearHookFilters,
    createSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    bulkOperation
  } = useSalesChannels();

  const { toast } = useToast();
  
  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterChannelType, setFilterChannelType] = useState<string>('all');
  const [filterExternal, setFilterExternal] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSalesChannel, setEditingSalesChannel] = useState<SalesChannelResponse | null>(null);
  const [loadingActions, setLoadingActions] = useState<{ [key: number]: string }>({});

  // Aplicar filtros
  const handleApplyFilters = useCallback(() => {
    const newFilters: SalesChannelFilters = {};

    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }

    if (filterActive !== 'all') {
      newFilters.is_active = filterActive === 'active';
    }

    if (filterChannelType !== 'all') {
      newFilters.channel_type = filterChannelType;
    }

    if (filterExternal !== 'all') {
      newFilters.is_external = filterExternal === 'external';
    }

    setFilters(newFilters);
    setPage(1);
  }, [searchTerm, filterActive, filterChannelType, filterExternal, setFilters, setPage]);

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterActive('all');
    setFilterChannelType('all');
    setFilterExternal('all');
    clearHookFilters();
  };

  // Abrir modal para criar novo
  const handleCreate = () => {
    setEditingSalesChannel(null);
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEdit = (salesChannel: SalesChannelResponse) => {
    setEditingSalesChannel(salesChannel);
    setShowModal(true);
  };

  // Deletar canal de venda
  const handleDelete = async (salesChannel: SalesChannelResponse) => {
    if (!confirm(`Tem certeza que deseja remover "${salesChannel.name}"?`)) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [salesChannel.id]: 'deleting' }));
    
    try {
      const success = await deleteSalesChannel(salesChannel.id);
      if (success) {
        toast({
          title: 'Canal removido',
          description: `${salesChannel.name} foi removido com sucesso.`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao remover canal',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[salesChannel.id];
        return newState;
      });
    }
  };

  // Alternar status
  const handleToggleStatus = async (salesChannel: SalesChannelResponse) => {
    const newStatus = !salesChannel.is_active;
    setLoadingActions(prev => ({ ...prev, [salesChannel.id]: 'toggling' }));
    
    try {
      const updatedChannel = await updateSalesChannel(salesChannel.id, { 
        is_active: newStatus 
      });
      
      if (updatedChannel) {
        toast({
          title: newStatus ? 'Canal ativado' : 'Canal desativado',
          description: `${salesChannel.name} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[salesChannel.id];
        return newState;
      });
    }
  };

  // Configurar dados padrão
  const handleSetupDefaults = async () => {
    if (!confirm('Isso criará canais de venda padrão. Continuar?')) {
      return;
    }

    try {
      // Criar canais padrão
      const defaultChannels = [
        { 
          name: 'Site Oficial', 
          code: 'DIRECT', 
          channel_type: 'direct', 
          is_external: false,
          commission_percentage: 0
        },
        { 
          name: 'Telefone', 
          code: 'PHONE', 
          channel_type: 'phone', 
          is_external: false,
          commission_percentage: 0
        },
        { 
          name: 'Walk-in', 
          code: 'WALKIN', 
          channel_type: 'walk_in', 
          is_external: false,
          commission_percentage: 0
        },
        { 
          name: 'Booking.com', 
          code: 'BOOKING', 
          channel_type: 'ota', 
          is_external: true,
          commission_percentage: 15
        }
      ];

      for (const channelData of defaultChannels) {
        await createSalesChannel(channelData as any);
      }

      toast({
        title: 'Canais criados',
        description: 'Canais de venda padrão foram criados com sucesso.'
      });
      
      loadSalesChannels();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar canais padrão',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    }
  };

  // Paginação
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
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
              'Configure os canais de venda da sua propriedade'
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleSetupDefaults}>
            <Settings className="h-4 w-4 mr-2" />
            Dados Padrão
          </Button>
          
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
              
              <Select value={filterChannelType} onValueChange={setFilterChannelType}>
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
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="external">Externos</SelectItem>
                  <SelectItem value="internal">Internos</SelectItem>
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
            <Store className="h-5 w-5" />
            Canais Cadastrados
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
                {searchTerm || filterActive !== 'all' || filterChannelType !== 'all' || filterExternal !== 'all'
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
                    {/* Ícone/Avatar */}
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
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
                        <Badge 
                          variant={salesChannel.is_active ? "default" : "secondary"}
                          className="flex-shrink-0"
                        >
                          {salesChannel.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {salesChannel.is_external && (
                          <Badge variant="outline" className="flex-shrink-0">
                            <Globe className="h-3 w-3 mr-1" />
                            Externo
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Código: {salesChannel.code}</span>
                        <span>Tipo: {getSalesChannelTypeLabel(salesChannel.channel_type as any)}</span>
                        {salesChannel.commission_percentage && salesChannel.commission_percentage > 0 && (
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {salesChannel.commission_percentage}%
                          </span>
                        )}
                        <span>
                          Criado em {new Date(salesChannel.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      {salesChannel.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {salesChannel.description}
                        </p>
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