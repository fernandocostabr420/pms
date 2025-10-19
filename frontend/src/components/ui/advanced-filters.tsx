// frontend/src/components/ui/advanced-filters.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { 
  Filter,
  Plus,
  X,
  Search,
  Save,
  Download,
  Upload,
  RotateCcw,
  Settings,
  ChevronDown,
  Calendar as CalendarIcon,
  Trash2,
  Copy,
  Star,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Tipos de operadores para cada tipo de campo
export const FILTER_OPERATORS = {
  text: [
    { value: 'contains', label: 'Contém', symbol: '∋' },
    { value: 'equals', label: 'Igual a', symbol: '=' },
    { value: 'not_equals', label: 'Diferente de', symbol: '≠' },
    { value: 'starts_with', label: 'Começa com', symbol: '↦' },
    { value: 'ends_with', label: 'Termina com', symbol: '↤' },
    { value: 'is_empty', label: 'Está vazio', symbol: '∅' },
    { value: 'not_empty', label: 'Não está vazio', symbol: '≠∅' }
  ],
  number: [
    { value: 'equals', label: 'Igual a', symbol: '=' },
    { value: 'not_equals', label: 'Diferente de', symbol: '≠' },
    { value: 'greater_than', label: 'Maior que', symbol: '>' },
    { value: 'less_than', label: 'Menor que', symbol: '<' },
    { value: 'greater_equal', label: 'Maior ou igual', symbol: '≥' },
    { value: 'less_equal', label: 'Menor ou igual', symbol: '≤' },
    { value: 'between', label: 'Entre', symbol: '⬌' },
    { value: 'is_empty', label: 'Está vazio', symbol: '∅' }
  ],
  date: [
    { value: 'equals', label: 'Na data', symbol: '=' },
    { value: 'before', label: 'Antes de', symbol: '<' },
    { value: 'after', label: 'Depois de', symbol: '>' },
    { value: 'between', label: 'Entre', symbol: '⬌' },
    { value: 'today', label: 'Hoje', symbol: '📅' },
    { value: 'yesterday', label: 'Ontem', symbol: '📅-1' },
    { value: 'last_7_days', label: 'Últimos 7 dias', symbol: '7d' },
    { value: 'last_30_days', label: 'Últimos 30 dias', symbol: '30d' },
    { value: 'this_month', label: 'Este mês', symbol: 'M' },
    { value: 'last_month', label: 'Mês passado', symbol: 'M-1' }
  ],
  select: [
    { value: 'equals', label: 'Igual a', symbol: '=' },
    { value: 'not_equals', label: 'Diferente de', symbol: '≠' },
    { value: 'in', label: 'Em', symbol: '∈' },
    { value: 'not_in', label: 'Não em', symbol: '∉' }
  ],
  boolean: [
    { value: 'is_true', label: 'Verdadeiro', symbol: '✓' },
    { value: 'is_false', label: 'Falso', symbol: '✗' }
  ]
};

// Definição de um filtro
export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: Array<{ label: string; value: string | number | boolean }>;
  placeholder?: string;
  description?: string;
}

// Condição de filtro individual
export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
  value2?: any; // Para operadores como "between"
  enabled: boolean;
}

// Grupo de filtros salvos
export interface SavedFilterGroup {
  id: string;
  name: string;
  description?: string;
  conditions: FilterCondition[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdvancedFiltersProps {
  fields: FilterField[];
  conditions: FilterCondition[];
  onConditionsChange: (conditions: FilterCondition[]) => void;
  onApply?: (conditions: FilterCondition[]) => void;
  onClear?: () => void;
  className?: string;
  
  // Configurações
  showSaveLoad?: boolean;
  showPresets?: boolean;
  showExportImport?: boolean;
  allowGrouping?: boolean;
  maxConditions?: number;
  
  // Filtros salvos
  savedFilters?: SavedFilterGroup[];
  onSaveFilter?: (group: Omit<SavedFilterGroup, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onLoadFilter?: (groupId: string) => void;
  onDeleteFilter?: (groupId: string) => void;
  
  // Presets pré-definidos por módulo
  presets?: Array<{
    name: string;
    description: string;
    conditions: FilterCondition[];
  }>;
}

export default function AdvancedFilters({
  fields = [],
  conditions = [],
  onConditionsChange,
  onApply,
  onClear,
  className,
  
  showSaveLoad = true,
  showPresets = true,
  showExportImport = false,
  allowGrouping = false,
  maxConditions = 10,
  
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  
  presets = []
}: AdvancedFiltersProps) {
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterDescription, setNewFilterDescription] = useState('');

  // Gerar ID único para nova condição
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  // Adicionar nova condição
  const addCondition = () => {
    if (conditions.length >= maxConditions) return;
    
    const newCondition: FilterCondition = {
      id: generateId(),
      field: fields[0]?.key || '',
      operator: 'equals',
      value: '',
      enabled: true
    };
    
    onConditionsChange([...conditions, newCondition]);
  };

  // Remover condição
  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter(c => c.id !== id));
  };

  // Atualizar condição
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    onConditionsChange(
      conditions.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  };

  // Limpar todas as condições
  const clearAllConditions = () => {
    onConditionsChange([]);
    onClear?.();
  };

  // Aplicar filtros
  const applyFilters = () => {
    const enabledConditions = conditions.filter(c => c.enabled);
    onApply?.(enabledConditions);
  };

  // Salvar grupo de filtros
  const saveFilterGroup = () => {
    if (!newFilterName.trim() || !onSaveFilter) return;
    
    onSaveFilter({
      name: newFilterName.trim(),
      description: newFilterDescription.trim() || undefined,
      conditions: conditions.filter(c => c.enabled)
    });
    
    setNewFilterName('');
    setNewFilterDescription('');
    setShowSaveModal(false);
  };

  // Carregar grupo de filtros
  const loadFilterGroup = (groupId: string) => {
    const group = savedFilters.find(f => f.id === groupId);
    if (group) {
      onConditionsChange(group.conditions.map(c => ({ ...c, id: generateId() })));
      onLoadFilter?.(groupId);
    }
  };

  // Aplicar preset
  const applyPreset = (preset: typeof presets[0]) => {
    onConditionsChange(preset.conditions.map(c => ({ ...c, id: generateId() })));
  };

  // Exportar filtros
  const exportFilters = () => {
    const data = {
      conditions,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtros-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Importar filtros
  const importFilters = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.conditions && Array.isArray(data.conditions)) {
          onConditionsChange(data.conditions.map((c: any) => ({ ...c, id: generateId() })));
        }
      } catch (error) {
        console.error('Erro ao importar filtros:', error);
      }
    };
    reader.readAsText(file);
  };

  // Obter operadores para um tipo de campo
  const getOperatorsForType = (type: FilterField['type']) => {
    return FILTER_OPERATORS[type] || FILTER_OPERATORS.text;
  };

  // Renderizar campo de valor baseado no tipo e operador
  const renderValueField = (condition: FilterCondition) => {
    const field = fields.find(f => f.key === condition.field);
    if (!field) return null;

    const operator = getOperatorsForType(field.type).find(op => op.value === condition.operator);
    
    // Operadores que não precisam de valor
    if (['is_empty', 'not_empty', 'is_true', 'is_false', 'today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month'].includes(condition.operator)) {
      return <div className="text-sm text-gray-500 italic">Sem valor necessário</div>;
    }

    // Campo de data
    if (field.type === 'date') {
      if (condition.operator === 'between') {
        return (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-32">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {condition.value ? format(new Date(condition.value), 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={condition.value ? new Date(condition.value) : undefined}
                  onSelect={(date) => updateCondition(condition.id, { value: date?.toISOString() })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-32">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {condition.value2 ? format(new Date(condition.value2), 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={condition.value2 ? new Date(condition.value2) : undefined}
                  onSelect={(date) => updateCondition(condition.id, { value2: date?.toISOString() })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      }
      
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-40">
              <CalendarIcon className="h-4 w-4 mr-2" />
              {condition.value ? format(new Date(condition.value), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={condition.value ? new Date(condition.value) : undefined}
              onSelect={(date) => updateCondition(condition.id, { value: date?.toISOString() })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );
    }

    // Campo de seleção
    if (field.type === 'select') {
      if (['in', 'not_in'].includes(condition.operator)) {
        return (
          <Select value={condition.value} onValueChange={(value) => updateCondition(condition.id, { value })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
      return (
        <Select value={condition.value} onValueChange={(value) => updateCondition(condition.id, { value })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(option => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Campo booleano
    if (field.type === 'boolean') {
      return <div className="text-sm text-gray-500 italic">Valor automático</div>;
    }

    // Campo numérico
    if (field.type === 'number') {
      if (condition.operator === 'between') {
        return (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="De"
              className="w-20"
              value={condition.value || ''}
              onChange={(e) => updateCondition(condition.id, { value: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Até"
              className="w-20"
              value={condition.value2 || ''}
              onChange={(e) => updateCondition(condition.id, { value2: Number(e.target.value) })}
            />
          </div>
        );
      }
      
      return (
        <Input
          type="number"
          placeholder={field.placeholder}
          className="w-40"
          value={condition.value || ''}
          onChange={(e) => updateCondition(condition.id, { value: Number(e.target.value) })}
        />
      );
    }

    // Campo de texto (padrão)
    return (
      <Input
        placeholder={field.placeholder}
        className="w-40"
        value={condition.value || ''}
        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
      />
    );
  };

  const activeFiltersCount = conditions.filter(c => c.enabled && c.value).length;

  return (
    <Card className={cn("border-gray-200", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros Avançados
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </CardTitle>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={applyFilters}>
                  Aplicar ({activeFiltersCount})
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllConditions}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Opções</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {showSaveLoad && (
                  <>
                    <DropdownMenuItem onClick={() => setShowSaveModal(true)} disabled={conditions.length === 0}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Filtros
                    </DropdownMenuItem>
                    
                    {savedFilters.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center w-full px-2 py-1.5 text-sm hover:bg-gray-100 rounded">
                          <Download className="mr-2 h-4 w-4" />
                          Carregar Filtros
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="left">
                          {savedFilters.map(filter => (
                            <DropdownMenuItem key={filter.id} onClick={() => loadFilterGroup(filter.id)}>
                              {filter.isDefault && <Star className="mr-2 h-3 w-3 text-yellow-500" />}
                              {filter.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
                
                {showExportImport && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportFilters} disabled={conditions.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => document.getElementById('import-filters')?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar
                    </DropdownMenuItem>
                    <input
                      id="import-filters"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={importFilters}
                    />
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Presets */}
          {showPresets && presets.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Filtros Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map(preset => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    title={preset.description}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Condições de filtro */}
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                {/* Drag handle */}
                {allowGrouping && (
                  <div className="cursor-move text-gray-400">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                
                {/* Conectivo lógico */}
                {index > 0 && (
                  <Badge variant="outline" className="text-xs">
                    E
                  </Badge>
                )}
                
                {/* Toggle ativo/inativo */}
                <Switch
                  checked={condition.enabled}
                  onCheckedChange={(enabled) => updateCondition(condition.id, { enabled })}
                />
                
                {/* Campo */}
                <Select
                  value={condition.field}
                  onValueChange={(field) => {
                    const fieldObj = fields.find(f => f.key === field);
                    const defaultOperator = getOperatorsForType(fieldObj?.type || 'text')[0].value;
                    updateCondition(condition.id, { field, operator: defaultOperator, value: '', value2: undefined });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Campo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map(field => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Operador */}
                <Select
                  value={condition.operator}
                  onValueChange={(operator) => updateCondition(condition.id, { operator, value: '', value2: undefined })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Operador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getOperatorsForType(fields.find(f => f.key === condition.field)?.type || 'text').map(operator => (
                      <SelectItem key={operator.value} value={operator.value}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs">{operator.symbol}</span>
                          {operator.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Valor */}
                <div className="flex-1 min-w-0">
                  {renderValueField(condition)}
                </div>
                
                {/* Botões de ação */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateCondition(condition.id, { enabled: !condition.enabled })}
                    className="p-1 h-8 w-8"
                  >
                    {condition.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Botão adicionar condição */}
          {conditions.length < maxConditions && (
            <Button
              variant="dashed"
              onClick={addCondition}
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Condição
            </Button>
          )}
          
          {/* Ações principais */}
          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-sm text-gray-500">
              {conditions.length} de {maxConditions} condições •{' '}
              {conditions.filter(c => c.enabled).length} ativas
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={clearAllConditions} disabled={conditions.length === 0}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
              <Button onClick={applyFilters} disabled={conditions.filter(c => c.enabled).length === 0}>
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      )}
      
      {/* Modal de salvar filtro */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Salvar Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="filter-name">Nome *</Label>
                <Input
                  id="filter-name"
                  placeholder="Ex: Reservas Pendentes"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-description">Descrição</Label>
                <Input
                  id="filter-description"
                  placeholder="Descrição opcional..."
                  value={newFilterDescription}
                  onChange={(e) => setNewFilterDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowSaveModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveFilterGroup} disabled={!newFilterName.trim()}>
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}