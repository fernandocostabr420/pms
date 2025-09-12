// frontend/src/components/ui/color-picker.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Pipette, 
  RotateCcw, 
  Eye, 
  Check,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Cores predefinidas organizadas por categoria
const COLOR_PALETTES = {
  primary: {
    name: 'Cores Principais',
    colors: [
      { name: 'Azul Principal', value: '#3B82F6', description: 'Cor padrão do sistema' },
      { name: 'Verde Sucesso', value: '#10B981', description: 'Para ações positivas' },
      { name: 'Amarelo Atenção', value: '#F59E0B', description: 'Para avisos' },
      { name: 'Vermelho Erro', value: '#EF4444', description: 'Para erros e exclusões' },
      { name: 'Roxo Premium', value: '#8B5CF6', description: 'Para recursos premium' },
      { name: 'Ciano Destaque', value: '#06B6D4', description: 'Para destaques' }
    ]
  },
  business: {
    name: 'Cores de Negócio',
    colors: [
      { name: 'Dourado Premium', value: '#D97706', description: 'Clientes VIP' },
      { name: 'Prata Executivo', value: '#6B7280', description: 'Categoria executiva' },
      { name: 'Bronze Standard', value: '#92400E', description: 'Categoria padrão' },
      { name: 'Verde Dinheiro', value: '#059669', description: 'Pagamentos à vista' },
      { name: 'Azul Corporativo', value: '#1D4ED8', description: 'Clientes corporativos' },
      { name: 'Rosa Marketing', value: '#EC4899', description: 'Campanhas especiais' }
    ]
  },
  status: {
    name: 'Cores de Status',
    colors: [
      { name: 'Ativo/Confirmado', value: '#16A34A', description: 'Status positivo' },
      { name: 'Pendente', value: '#CA8A04', description: 'Aguardando ação' },
      { name: 'Cancelado', value: '#DC2626', description: 'Status negativo' },
      { name: 'Processando', value: '#2563EB', description: 'Em andamento' },
      { name: 'Inativo', value: '#9CA3AF', description: 'Desabilitado' },
      { name: 'Rascunho', value: '#64748B', description: 'Não finalizado' }
    ]
  },
  seasonal: {
    name: 'Cores Sazonais',
    colors: [
      { name: 'Vermelho Natal', value: '#B91C1C', description: 'Dezembro' },
      { name: 'Verde Natal', value: '#166534', description: 'Dezembro' },
      { name: 'Laranja Halloween', value: '#EA580C', description: 'Outubro' },
      { name: 'Rosa Valentines', value: '#E11D48', description: 'Fevereiro' },
      { name: 'Azul Verão', value: '#0EA5E9', description: 'Dezembro-Março' },
      { name: 'Marrom Outono', value: '#A3532B', description: 'Março-Junho' }
    ]
  }
};

// Cores gradientes populares
const GRADIENT_COLORS = [
  { name: 'Sunset', values: ['#FF6B6B', '#4ECDC4'], css: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)' },
  { name: 'Ocean', values: ['#667eea', '#764ba2'], css: 'linear-gradient(45deg, #667eea, #764ba2)' },
  { name: 'Forest', values: ['#11998e', '#38ef7d'], css: 'linear-gradient(45deg, #11998e, #38ef7d)' },
  { name: 'Fire', values: ['#f093fb', '#f5576c'], css: 'linear-gradient(45deg, #f093fb, #f5576c)' },
  { name: 'Sky', values: ['#4facfe', '#00f2fe'], css: 'linear-gradient(45deg, #4facfe, #00f2fe)' },
  { name: 'Purple', values: ['#a8edea', '#fed6e3'], css: 'linear-gradient(45deg, #a8edea, #fed6e3)' }
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
  placeholder?: string;
  showPreview?: boolean;
  showGradients?: boolean;
  showRecentColors?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function ColorPicker({
  value = '#3B82F6',
  onChange,
  label = 'Cor',
  placeholder = 'Selecione uma cor',
  showPreview = true,
  showGradients = false,
  showRecentColors = true,
  className,
  disabled = false
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Carregar cores recentes do localStorage
  useEffect(() => {
    if (showRecentColors) {
      const saved = localStorage.getItem('color-picker-recent');
      if (saved) {
        try {
          setRecentColors(JSON.parse(saved));
        } catch (error) {
          console.error('Erro ao carregar cores recentes:', error);
        }
      }
    }
  }, [showRecentColors]);

  // Atualizar cor customizada quando o valor muda
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  // Salvar cor nas recentes
  const addToRecentColors = (color: string) => {
    if (!showRecentColors) return;
    
    const updated = [color, ...recentColors.filter(c => c !== color)].slice(0, 8);
    setRecentColors(updated);
    localStorage.setItem('color-picker-recent', JSON.stringify(updated));
  };

  // Selecionar cor
  const handleColorSelect = (color: string) => {
    onChange(color);
    addToRecentColors(color);
    setIsOpen(false);
  };

  // Validar e aplicar cor customizada
  const handleCustomColorApply = () => {
    if (isValidHexColor(customColor)) {
      handleColorSelect(customColor);
    }
  };

  // Validar cor hexadecimal
  const isValidHexColor = (color: string): boolean => {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  };

  // Gerar cores aleatórias
  const generateRandomColor = () => {
    const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
    handleColorSelect(color);
  };

  // Reset para cor padrão
  const resetToDefault = () => {
    handleColorSelect('#3B82F6');
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-10"
            disabled={disabled}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-6 h-6 rounded border-2 border-white shadow-sm"
                style={{ backgroundColor: value }}
              />
              <span className="font-mono text-sm">{value}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="start">
          <Tabs defaultValue="palettes" className="w-full">
            <div className="border-b border-gray-200 px-4 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="palettes">Paletas</TabsTrigger>
                <TabsTrigger value="custom">Customizada</TabsTrigger>
                {showGradients && <TabsTrigger value="gradients">Gradientes</TabsTrigger>}
              </TabsList>
            </div>

            {/* Tab: Paletas Predefinidas */}
            <TabsContent value="palettes" className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {/* Cores recentes */}
              {showRecentColors && recentColors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cores Recentes</h4>
                  <div className="grid grid-cols-8 gap-2">
                    {recentColors.map((color, index) => (
                      <button
                        key={index}
                        className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorSelect(color)}
                      >
                        {value === color && (
                          <Check className="h-3 w-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Paletas por categoria */}
              {Object.entries(COLOR_PALETTES).map(([key, palette]) => (
                <div key={key}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{palette.name}</h4>
                  <div className="grid grid-cols-6 gap-2">
                    {palette.colors.map((color) => (
                      <div key={color.value} className="relative group">
                        <button
                          className="w-10 h-10 rounded border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
                          style={{ backgroundColor: color.value }}
                          onClick={() => handleColorSelect(color.value)}
                          title={`${color.name}\n${color.description}`}
                        >
                          {value === color.value && (
                            <Check className="h-3 w-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" />
                          )}
                        </button>
                        
                        {/* Tooltip com informações */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {color.name}
                          <br />
                          <span className="text-gray-300 font-mono">{color.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Tab: Cor Customizada */}
            <TabsContent value="custom" className="p-4 space-y-4">
              {/* Preview da cor atual */}
              {showPreview && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div 
                        className="w-full h-16 rounded-lg border-2 border-gray-200"
                        style={{ backgroundColor: customColor }}
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Eye className="h-4 w-4" />
                        <span>Cor selecionada: </span>
                        <Badge variant="outline" className="font-mono">
                          {customColor}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Seletor de cor nativo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Seletor Visual</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-16 h-10 border border-gray-200 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="font-mono"
                    />
                  </div>
                </div>
                
                {!isValidHexColor(customColor) && (
                  <p className="text-xs text-red-600">
                    Formato inválido. Use formato hexadecimal (ex: #3B82F6)
                  </p>
                )}
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRandomColor}
                  className="flex-1"
                >
                  <Pipette className="h-4 w-4 mr-2" />
                  Aleatória
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefault}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Padrão
                </Button>
              </div>

              <Button
                onClick={handleCustomColorApply}
                disabled={!isValidHexColor(customColor)}
                className="w-full"
              >
                <Palette className="h-4 w-4 mr-2" />
                Aplicar Cor
              </Button>
            </TabsContent>

            {/* Tab: Gradientes */}
            {showGradients && (
              <TabsContent value="gradients" className="p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Gradientes Populares</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {GRADIENT_COLORS.map((gradient) => (
                      <button
                        key={gradient.name}
                        className="h-16 rounded-lg border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 relative overflow-hidden"
                        style={{ background: gradient.css }}
                        onClick={() => handleColorSelect(gradient.values[0])} // Usar primeira cor do gradiente
                      >
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 px-2">
                          {gradient.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500">
                  *Gradientes selecionam a primeira cor. Para gradientes completos, use CSS customizado.
                </p>
              </TabsContent>
            )}
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}