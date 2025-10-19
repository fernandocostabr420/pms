// frontend/src/components/channel-manager/PriceEditor.tsx
// Path: frontend/src/components/channel-manager/PriceEditor.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Calculator,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  Check,
  X,
  Loader2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceEditorProps {
  currentPrice?: number;
  roomId: number;
  date: string;
  onSave: (newPrice: number) => Promise<void>;
  onCancel?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  status?: 'idle' | 'saving' | 'error';
  error?: string;
  showCurrency?: boolean;
  showCalculator?: boolean;
  minPrice?: number;
  maxPrice?: number;
  suggestedPrices?: {
    label: string;
    value: number;
    description?: string;
  }[];
}

export function PriceEditor({
  currentPrice = 0,
  roomId,
  date,
  onSave,
  onCancel,
  isOpen = false,
  onOpenChange,
  disabled = false,
  status = 'idle',
  error,
  showCurrency = true,
  showCalculator = true,
  minPrice = 0,
  maxPrice = 9999,
  suggestedPrices = []
}: PriceEditorProps) {

  // ============== STATE ==============

  const [value, setValue] = useState(currentPrice.toString());
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [operation, setOperation] = useState<'add' | 'subtract' | 'multiply' | 'divide' | null>(null);
  const [operationValue, setOperationValue] = useState('');
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const operationInputRef = useRef<HTMLInputElement>(null);

  // ============== EFFECTS ==============

  // Sync with current price changes
  useEffect(() => {
    setValue(currentPrice.toString());
  }, [currentPrice]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  // Focus operation input when calculator opens
  useEffect(() => {
    if (isCalculatorOpen && operationInputRef.current) {
      setTimeout(() => {
        operationInputRef.current?.focus();
      }, 100);
    }
  }, [isCalculatorOpen, operation]);

  // ============== VALIDATION ==============

  const parsePrice = useCallback((priceString: string): number | null => {
    const cleaned = priceString.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) return null;
    if (parsed < minPrice || parsed > maxPrice) return null;
    
    return Math.round(parsed * 100) / 100; // Round to 2 decimals
  }, [minPrice, maxPrice]);

  const isValidPrice = useCallback((priceString: string): boolean => {
    return parsePrice(priceString) !== null;
  }, [parsePrice]);

  // ============== HANDLERS ==============

  const handleSave = async () => {
    const newPrice = parsePrice(value);
    if (newPrice === null) return;

    try {
      await onSave(newPrice);
      onOpenChange?.(false);
    } catch (error) {
      console.error('Erro ao salvar preço:', error);
    }
  };

  const handleCancel = () => {
    setValue(currentPrice.toString());
    setOperation(null);
    setOperationValue('');
    setIsCalculatorOpen(false);
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidPrice(value)) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleQuickSet = (price: number) => {
    setValue(price.toString());
    handleSave();
  };

  // ============== CALCULATOR OPERATIONS ==============

  const applyOperation = () => {
    const currentVal = parsePrice(value) || 0;
    const opVal = parseFloat(operationValue) || 0;
    
    if (opVal === 0) return;

    let result = currentVal;
    
    switch (operation) {
      case 'add':
        result = currentVal + opVal;
        break;
      case 'subtract':
        result = currentVal - opVal;
        break;
      case 'multiply':
        result = currentVal * (opVal / 100 + 1); // Percentage increase
        break;
      case 'divide':
        result = currentVal * (1 - opVal / 100); // Percentage decrease
        break;
    }

    const finalResult = Math.max(minPrice, Math.min(maxPrice, Math.round(result * 100) / 100));
    setValue(finalResult.toString());
    setOperation(null);
    setOperationValue('');
    setIsCalculatorOpen(false);
  };

  const startOperation = (op: 'add' | 'subtract' | 'multiply' | 'divide') => {
    setOperation(op);
    setOperationValue('');
    setIsCalculatorOpen(true);
  };

  // ============== SUGGESTED PRICES ==============

  const defaultSuggestions = [
    { label: 'Base', value: currentPrice, description: 'Preço atual' },
    { label: '+10%', value: Math.round(currentPrice * 1.1 * 100) / 100, description: 'Aumento de 10%' },
    { label: '+20%', value: Math.round(currentPrice * 1.2 * 100) / 100, description: 'Aumento de 20%' },
    { label: '-10%', value: Math.round(currentPrice * 0.9 * 100) / 100, description: 'Desconto de 10%' },
  ].filter(s => s.value >= minPrice && s.value <= maxPrice);

  const allSuggestions = [...suggestedPrices, ...defaultSuggestions];

  // ============== RENDER HELPERS ==============

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getOperationIcon = (op: string) => {
    switch (op) {
      case 'add': return <TrendingUp className="h-3 w-3" />;
      case 'subtract': return <TrendingDown className="h-3 w-3" />;
      case 'multiply': return <Percent className="h-3 w-3" />;
      case 'divide': return <Percent className="h-3 w-3" />;
      default: return <Calculator className="h-3 w-3" />;
    }
  };

  const getOperationLabel = (op: string) => {
    switch (op) {
      case 'add': return 'Somar valor';
      case 'subtract': return 'Subtrair valor';
      case 'multiply': return 'Aumentar %';
      case 'divide': return 'Diminuir %';
      default: return '';
    }
  };

  // ============== MAIN RENDER ==============

  if (!isOpen) {
    return (
      <button
        onClick={() => onOpenChange?.(true)}
        disabled={disabled}
        className={cn(
          "text-center hover:bg-blue-100 rounded p-1 transition-colors w-full",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {showCurrency ? (
          <div>
            <div className="text-xs text-gray-500">R$</div>
            <div className="font-medium text-sm">
              {currentPrice > 0 ? Math.round(currentPrice) : '--'}
            </div>
          </div>
        ) : (
          <div className="font-medium text-sm">
            {currentPrice > 0 ? formatCurrency(currentPrice) : '--'}
          </div>
        )}
      </button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div /> {/* Hidden trigger */}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Editar Preço
            </h4>
            {status === 'saving' && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>

          {/* Main Input */}
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                R$
              </div>
              <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="0,00"
                className={cn(
                  "pl-10 text-right font-medium",
                  !isValidPrice(value) && value.length > 0 && "border-red-300 bg-red-50",
                  isValidPrice(value) && "border-green-300 bg-green-50"
                )}
                disabled={status === 'saving'}
              />
              {value.length > 0 && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {isValidPrice(value) ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              )}
            </div>
            
            {/* Validation Message */}
            {value.length > 0 && !isValidPrice(value) && (
              <p className="text-xs text-red-600">
                Valor deve estar entre {formatCurrency(minPrice)} e {formatCurrency(maxPrice)}
              </p>
            )}
            
            {/* Current vs New */}
            {isValidPrice(value) && parsePrice(value) !== currentPrice && (
              <div className="text-xs text-gray-600 flex items-center justify-between">
                <span>Atual: {formatCurrency(currentPrice)}</span>
                <span>Novo: {formatCurrency(parsePrice(value)!)}</span>
              </div>
            )}
          </div>

          {/* Calculator Operations */}
          {showCalculator && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                Calculadora
              </div>
              
              {!operation ? (
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startOperation('add')}
                    className="text-xs h-8"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +R$
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startOperation('subtract')}
                    className="text-xs h-8"
                  >
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -R$
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startOperation('multiply')}
                    className="text-xs h-8"
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    +%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startOperation('divide')}
                    className="text-xs h-8"
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    -%
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    {getOperationIcon(operation)}
                    {getOperationLabel(operation)}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      ref={operationInputRef}
                      type="number"
                      value={operationValue}
                      onChange={(e) => setOperationValue(e.target.value)}
                      placeholder={operation === 'add' || operation === 'subtract' ? 'Valor' : 'Percentual'}
                      className="text-sm h-8"
                    />
                    <Button
                      size="sm"
                      onClick={applyOperation}
                      disabled={!operationValue}
                      className="h-8"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOperation(null);
                        setOperationValue('');
                        setIsCalculatorOpen(false);
                      }}
                      className="h-8"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggested Prices */}
          {allSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">Sugestões</div>
              <div className="grid grid-cols-2 gap-1">
                {allSuggestions.slice(0, 6).map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSet(suggestion.value)}
                    className="text-xs h-8 justify-start"
                    title={suggestion.description}
                  >
                    <span className="font-medium">{suggestion.label}</span>
                    <span className="ml-auto text-gray-500">
                      {Math.round(suggestion.value)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={status === 'saving'}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isValidPrice(value) || status === 'saving'}
              className="flex-1"
            >
              {status === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Use Enter para salvar ou Escape para cancelar. 
              Alterações serão sincronizadas automaticamente.
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}