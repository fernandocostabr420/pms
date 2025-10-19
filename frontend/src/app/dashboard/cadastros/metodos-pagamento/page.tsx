// frontend/src/app/dashboard/cadastros/metodos-pagamento/page.tsx
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
  Upload,
  Settings,
  CreditCard,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2
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
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { useToast } from '@/hooks/use-toast';
import PaymentMethodModal from '@/components/payment-methods/PaymentMethodModal';
import type { PaymentMethod, PaymentMethodsFilters } from '@/types/payment-methods';

export default function MetodosPagamentoPage() {
  const {
    paymentMethods,
    loading,
    error,
    total,
    page,
    per_page,
    total_pages,
    loadPaymentMethods,
    deletePaymentMethod,
    togglePaymentMethodStatus,
    setupDefaults,
    applyFilters,
    clearFilters
  } = usePaymentMethods();

  const { toast } = useToast();
  
  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterFee, setFilterFee] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loadingActions, setLoadingActions] = useState<{ [key: number]: string }>({});

  // Aplicar filtros
  const handleApplyFilters = useCallback(() => {
    const filters: PaymentMethodsFilters = {
      page: 1,
      per_page: 10
    };

    if (searchTerm.trim()) {
      filters.search = searchTerm.trim();
    }

    if (filterActive !== 'all') {
      filters.is_active = filterActive === 'active';
    }

    if (filterFee !== 'all') {
      filters.has_fee = filterFee === 'with_fee';
    }

    applyFilters(filters);
  }, [searchTerm, filterActive, filterFee, applyFilters]);

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterActive('all');
    setFilterFee('all');
    clearFilters();
  };

  // Abrir modal para criar novo
  const handleCreate = () => {
    setEditingPaymentMethod(null);
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleEdit = (paymentMethod: PaymentMethod) => {
    setEditingPaymentMethod(paymentMethod);
    setShowModal(true);
  };

  // Deletar método de pagamento
  const handleDelete = async (paymentMethod: PaymentMethod) => {
    if (!confirm(`Tem certeza que deseja remover "${paymentMethod.name}"?`)) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [paymentMethod.id]: 'deleting' }));
    
    try {
      await deletePaymentMethod(paymentMethod.id, paymentMethod.name);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[paymentMethod.id];
        return newState;
      });
    }
  };

  // Alternar status
  const handleToggleStatus = async (paymentMethod: PaymentMethod) => {
    const newStatus = !paymentMethod.is_active;
    setLoadingActions(prev => ({ ...prev, [paymentMethod.id]: 'toggling' }));
    
    try {
      await togglePaymentMethodStatus(paymentMethod.id, newStatus, paymentMethod.name);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoadingActions(prev => {
        const newState = { ...prev };
        delete newState[paymentMethod.id];
        return newState;
      });
    }
  };

  // Configurar dados padrão
  const handleSetupDefaults = async () => {
    if (!confirm('Isso criará métodos de pagamento padrão. Continuar?')) {
      return;
    }

    try {
      await setupDefaults();
    } catch (error) {
      // Erro já tratado no hook
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
          <h2 className="text-xl font-semibold text-gray-900">Métodos de Pagamento</h2>
          <p className="text-sm text-gray-600 mt-1">
            {total > 0 ? (
              <>Exibindo {paymentMethods.length} de {total} métodos de pagamento</>
            ) : (
              'Configure as formas de pagamento aceitas'
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
            Novo Método
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de métodos de pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Métodos Cadastrados
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
              <p className="text-gray-500 mt-2">Carregando métodos de pagamento...</p>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="p-8 text-center">
              <CreditCard className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum método encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filterActive !== 'all' || filterFee !== 'all'
                  ? 'Tente ajustar os filtros ou criar um novo método'
                  : 'Comece criando seu primeiro método de pagamento'
                }
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Método
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {paymentMethods.map((paymentMethod) => (
                <div key={paymentMethod.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Ícone/Avatar */}
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: paymentMethod.color || '#3B82F6' }}
                    >
                      {paymentMethod.icon ? (
                        <span className="text-lg">{paymentMethod.icon}</span>
                      ) : (
                        paymentMethod.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    
                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {paymentMethod.name}
                        </h3>
                        <Badge 
                          variant={paymentMethod.is_active ? "default" : "secondary"}
                          className="flex-shrink-0"
                        >
                          {paymentMethod.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Código: {paymentMethod.code}</span>
                        {paymentMethod.fee_percentage && (
                          <span>Taxa: {paymentMethod.fee_percentage}%</span>
                        )}
                        <span>
                          Criado em {new Date(paymentMethod.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      {paymentMethod.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {paymentMethod.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Ações */}
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
                          
                          <DropdownMenuItem onClick={() => handleEdit(paymentMethod)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(paymentMethod)}
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
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(paymentMethod)}
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
      <PaymentMethodModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingPaymentMethod(null);
        }}
        paymentMethod={editingPaymentMethod}
        onSave={() => {
          setShowModal(false);
          setEditingPaymentMethod(null);
          loadPaymentMethods(); // Recarregar lista
        }}
      />
    </div>
  );
}