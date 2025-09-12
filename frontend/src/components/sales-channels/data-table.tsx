// frontend/src/components/ui/data-table.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Types para as colunas da tabela
export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  minWidth?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

// Types para filtros
export interface DataTableFilter {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'boolean';
  options?: { label: string; value: string | boolean }[];
  placeholder?: string;
}

// Types para ações
export interface DataTableAction<T = any> {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  onClick: (row: T) => void;
  show?: (row: T) => boolean;
  loading?: (row: T) => boolean;
}

// Types para ações em massa
export interface DataTableBulkAction<T = any> {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  onClick: (selectedRows: T[]) => void;
  show?: (selectedRows: T[]) => boolean;
}

// Types para ordenação
export interface DataTableSort {
  column: string;
  direction: 'asc' | 'desc';
}

// Props principais do componente
export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  
  // Configurações de exibição
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  
  // Paginação
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  
  // Ordenação
  sorting?: {
    sort: DataTableSort | null;
    onSortChange: (sort: DataTableSort | null) => void;
  };
  
  // Filtros
  filters?: DataTableFilter[];
  onFilterChange?: (filters: Record<string, any>) => void;
  
  // Seleção
  selection?: {
    selectedRows: T[];
    onSelectionChange: (selectedRows: T[]) => void;
    getRowId: (row: T) => string | number;
  };
  
  // Ações
  actions?: DataTableAction<T>[];
  bulkActions?: DataTableBulkAction<T>[];
  
  // Callbacks
  onCreate?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  
  // Configurações
  searchable?: boolean;
  exportable?: boolean;
  importable?: boolean;
  refreshable?: boolean;
  showHeader?: boolean;
  showPagination?: boolean;
  showFilters?: boolean;
  compact?: boolean;
  striped?: boolean;
  bordered?: boolean;
  
  // Estados de loading específicos
  loadingActions?: Record<string | number, string>;
  
  // Customizações
  emptyState?: React.ReactNode;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  data = [],
  columns,
  title,
  description,
  loading = false,
  error = null,
  pagination,
  sorting,
  filters = [],
  onFilterChange,
  selection,
  actions = [],
  bulkActions = [],
  onCreate,
  onExport,
  onImport,
  onRefresh,
  searchable = true,
  exportable = false,
  importable = false,
  refreshable = false,
  showHeader = true,
  showPagination = true,
  showFilters = true,
  compact = false,
  striped = true,
  bordered = true,
  loadingActions = {},
  emptyState,
  className
}: DataTableProps<T>) {
  
  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(col => col.key))
  );

  // Utilitários de seleção
  const hasSelection = selection && selection.selectedRows.length > 0;
  const selectedCount = selection?.selectedRows.length || 0;
  const allSelected = selection && selection.selectedRows.length === data.length && data.length > 0;

  // Manipular busca
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    // Implementar busca local ou chamar callback
  };

  // Manipular filtros
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    onFilterChange?.(newFilters);
  };

  // Manipular ordenação
  const handleSort = (column: string) => {
    if (!sorting) return;
    
    let newSort: DataTableSort | null = null;
    
    if (!sorting.sort || sorting.sort.column !== column) {
      newSort = { column, direction: 'asc' };
    } else if (sorting.sort.direction === 'asc') {
      newSort = { column, direction: 'desc' };
    } else {
      newSort = null; // Remove sorting
    }
    
    sorting.onSortChange(newSort);
  };

  // Manipular seleção
  const handleSelectAll = () => {
    if (!selection) return;
    
    const newSelection = allSelected ? [] : data;
    selection.onSelectionChange(newSelection);
  };

  const handleSelectRow = (row: T) => {
    if (!selection) return;
    
    const rowId = selection.getRowId(row);
    const isSelected = selection.selectedRows.some(
      selectedRow => selection.getRowId(selectedRow) === rowId
    );
    
    const newSelection = isSelected
      ? selection.selectedRows.filter(
          selectedRow => selection.getRowId(selectedRow) !== rowId
        )
      : [...selection.selectedRows, row];
    
    selection.onSelectionChange(newSelection);
  };

  // Manipular visibilidade de colunas
  const toggleColumnVisibility = (columnKey: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
  };

  // Obter ícone de ordenação
  const getSortIcon = (columnKey: string) => {
    if (!sorting?.sort || sorting.sort.column !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    
    return sorting.sort.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  // Filtrar colunas visíveis
  const visibleColumnsData = columns.filter(col => visibleColumns.has(col.key));

  return (
    <div className={cn("space-y-4", className)}>
      
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
            {hasSelection && (
              <p className="text-sm text-blue-600 mt-1">
                {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Ações em massa */}
            {hasSelection && bulkActions.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                {bulkActions.map(action => (
                  action.show?.(selection!.selectedRows) !== false && (
                    <Button
                      key={action.key}
                      size="sm"
                      variant={action.variant || 'outline'}
                      onClick={() => action.onClick(selection!.selectedRows)}
                    >
                      {action.icon && <action.icon className="h-3 w-3 mr-1" />}
                      {action.label}
                    </Button>
                  )
                ))}
              </div>
            )}
            
            {/* Ações gerais */}
            {refreshable && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <Loader2 className={cn("h-4 w-4 mr-2", !loading && "hidden")} />
                Atualizar
              </Button>
            )}
            
            {exportable && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
            
            {importable && (
              <Button variant="outline" size="sm" onClick={onImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
            )}
            
            {onCreate && (
              <Button size="sm" onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (searchable || filters.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Busca */}
              {searchable && (
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              
              {/* Filtros específicos */}
              <div className="flex items-center gap-3">
                {filters.map(filter => (
                  <div key={filter.key}>
                    {filter.type === 'select' ? (
                      <Select 
                        value={filterValues[filter.key] || ''} 
                        onValueChange={(value) => handleFilterChange(filter.key, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder={filter.label} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todos</SelectItem>
                          {filter.options?.map(option => (
                            <SelectItem 
                              key={String(option.value)} 
                              value={String(option.value)}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={filter.placeholder || filter.label}
                        value={filterValues[filter.key] || ''}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                        className="w-40"
                      />
                    )}
                  </div>
                ))}
                
                {/* Controle de colunas */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Colunas
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Mostrar/Ocultar Colunas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map(column => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.has(column.key)}
                        onCheckedChange={() => toggleColumnVisibility(column.key)}
                      >
                        {column.header}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-center text-red-600 bg-red-50 border-b">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className={cn("p-8 text-center", compact && "p-4")}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Carregando dados...</p>
            </div>
          ) : data.length === 0 ? (
            <div className={cn("p-8 text-center", compact && "p-4")}>
              {emptyState || (
                <>
                  <div className="text-gray-400 mb-4">
                    <Search className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum item encontrado
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Não há dados para exibir no momento
                  </p>
                  {onCreate && (
                    <Button onClick={onCreate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeiro Item
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={cn(
                  "bg-gray-50 border-b border-gray-200",
                  compact && "text-sm"
                )}>
                  <tr>
                    {/* Checkbox de seleção */}
                    {selection && (
                      <th className="w-12 px-4 py-3">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                    )}
                    
                    {/* Headers das colunas */}
                    {visibleColumnsData.map(column => (
                      <th
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-left font-medium text-gray-700",
                          column.headerClassName,
                          column.sortable && "cursor-pointer hover:bg-gray-100"
                        )}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth
                        }}
                        onClick={() => column.sortable && handleSort(column.key)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{column.header}</span>
                          {column.sortable && getSortIcon(column.key)}
                        </div>
                      </th>
                    ))}
                    
                    {/* Coluna de ações */}
                    {actions.length > 0 && (
                      <th className="w-12 px-4 py-3"></th>
                    )}
                  </tr>
                </thead>
                
                <tbody>
                  {data.map((row, index) => (
                    <tr
                      key={selection?.getRowId(row) || index}
                      className={cn(
                        "border-b border-gray-200 hover:bg-gray-50 transition-colors",
                        striped && index % 2 === 0 && "bg-gray-25",
                        compact && "text-sm"
                      )}
                    >
                      {/* Checkbox de seleção */}
                      {selection && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selection.selectedRows.some(
                              selectedRow => selection.getRowId(selectedRow) === selection.getRowId(row)
                            )}
                            onCheckedChange={() => handleSelectRow(row)}
                          />
                        </td>
                      )}
                      
                      {/* Células de dados */}
                      {visibleColumnsData.map(column => (
                        <td
                          key={column.key}
                          className={cn(
                            "px-4 py-3",
                            column.className
                          )}
                        >
                          {column.render 
                            ? column.render(row[column.key], row, index)
                            : row[column.key]
                          }
                        </td>
                      ))}
                      
                      {/* Menu de ações */}
                      {actions.length > 0 && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {loadingActions[selection?.getRowId(row) || index] && (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={!!loadingActions[selection?.getRowId(row) || index]}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {actions.map(action => (
                                  action.show?.(row) !== false && (
                                    <DropdownMenuItem 
                                      key={action.key}
                                      onClick={() => action.onClick(row)}
                                      className={cn(
                                        action.variant === 'destructive' && 'text-red-600'
                                      )}
                                    >
                                      {action.icon && (
                                        <action.icon className="mr-2 h-4 w-4" />
                                      )}
                                      {action.label}
                                    </DropdownMenuItem>
                                  )
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {showPagination && pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-700">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
                </p>
                
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => pagination.onPageSizeChange(Number(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                
                <span className="text-sm text-gray-500">por página</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => pagination.onPageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(pagination.totalPages)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}