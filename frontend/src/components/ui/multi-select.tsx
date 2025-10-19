// frontend/src/components/ui/multi-select.tsx - VERSÃO SIMPLIFICADA SEM COMMAND

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxSelections?: number;
  allowSelectAll?: boolean;
  searchable?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  disabled = false,
  maxSelections,
  allowSelectAll = true,
  searchable = true,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filtrar opções excluindo "all" se existir
  const selectableOptions = options.filter(option => option.value !== 'all');
  
  // Verificar se todos os itens selecionáveis estão selecionados
  const allSelected = selectableOptions.length > 0 && 
    selectableOptions.every(option => value.includes(option.value));

  // Filtrar opções baseado na busca
  const filteredOptions = searchable && searchTerm
    ? selectableOptions.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : selectableOptions;

  // Handler para toggle de seleção
  const handleSelect = (optionValue: string) => {
    if (disabled) return;

    let newValue: string[];
    
    if (value.includes(optionValue)) {
      // Remover item
      newValue = value.filter(v => v !== optionValue);
    } else {
      // Adicionar item
      if (maxSelections && value.length >= maxSelections) {
        return; // Não adicionar se atingiu o limite
      }
      newValue = [...value, optionValue];
    }
    
    onChange(newValue);
  };

  // Handler para selecionar/deselecionar todos
  const handleSelectAll = () => {
    if (disabled) return;
    
    if (allSelected) {
      // Deselecionar todos
      onChange([]);
    } else {
      // Selecionar todos os disponíveis
      const allValues = selectableOptions
        .filter(option => !option.disabled)
        .map(option => option.value);
      onChange(allValues);
    }
  };

  // Handler para remover item específico
  const handleRemove = (optionValue: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    const newValue = value.filter(v => v !== optionValue);
    onChange(newValue);
  };

  // Obter labels dos itens selecionados
  const selectedLabels = value
    .map(v => options.find(option => option.value === v)?.label)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[40px] px-3 py-2",
            value.length === 0 && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {value.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              selectedLabels.map((label, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={(e) => {
                    const valueToRemove = value[selectedLabels.indexOf(label)];
                    if (valueToRemove) {
                      handleRemove(valueToRemove, e);
                    }
                  }}
                >
                  {label}
                  <X className="ml-1 h-3 w-3 hover:bg-gray-200 rounded-full" />
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex flex-col">
          {/* Campo de busca */}
          {searchable && (
            <div className="p-2 border-b">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
          )}
          
          {/* Lista de opções */}
          <div className="max-h-64 overflow-auto">
            {/* Opção Selecionar Todos */}
            {allowSelectAll && selectableOptions.length > 1 && (
              <>
                <div
                  onClick={handleSelectAll}
                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      allSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium">
                    {allSelected ? "Deselecionar Todos" : "Selecionar Todos"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({selectableOptions.length} itens)
                  </span>
                </div>
                <div className="border-t mx-2" />
              </>
            )}
            
            {/* Verificar se há opções filtradas */}
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  className={cn(
                    "flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm",
                    option.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))
            )}
          </div>
          
          {/* Footer com contador */}
          {value.length > 0 && (
            <div className="border-t p-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {value.length} de {selectableOptions.length} selecionado
                  {value.length !== 1 ? 's' : ''}
                </span>
                {maxSelections && (
                  <span>
                    Máximo: {maxSelections}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Componente de Multi-Select simplificado para casos mais básicos
export function SimpleMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  disabled = false,
  className,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <MultiSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      allowSelectAll={false}
      searchable={false}
    />
  );
}

export default MultiSelect;