// frontend/src/components/ui/ui-components-demo.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, 
  Star, 
  Filter, 
  Code, 
  Eye, 
  Copy,
  CheckCircle
} from 'lucide-react';
import ColorPicker from './color-picker';
import IconSelector from './icon-selector';
import AdvancedFilters, { FilterField, FilterCondition } from './advanced-filters';
import { useToast } from '@/hooks/use-toast';

// Exemplo de campos para o filtro avançado
const EXAMPLE_FILTER_FIELDS: FilterField[] = [
  {
    key: 'name',
    label: 'Nome',
    type: 'text',
    placeholder: 'Digite o nome...',
    description: 'Nome do item'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Ativo', value: 'active' },
      { label: 'Inativo', value: 'inactive' },
      { label: 'Pendente', value: 'pending' },
      { label: 'Cancelado', value: 'cancelled' }
    ]
  },
  {
    key: 'price',
    label: 'Preço',
    type: 'number',
    placeholder: '0.00',
    description: 'Valor em reais'
  },
  {
    key: 'created_date',
    label: 'Data de Criação',
    type: 'date',
    description: 'Data de criação do registro'
  },
  {
    key: 'is_featured',
    label: 'Em Destaque',
    type: 'boolean',
    description: 'Item em destaque'
  }
];

// Presets de exemplo para filtros
const EXAMPLE_FILTER_PRESETS = [
  {
    name: 'Ativos Recentes',
    description: 'Itens ativos criados nos últimos 7 dias',
    conditions: [
      {
        id: '1',
        field: 'status',
        operator: 'equals',
        value: 'active',
        enabled: true
      },
      {
        id: '2',
        field: 'created_date',
        operator: 'last_7_days',
        value: '',
        enabled: true
      }
    ] as FilterCondition[]
  },
  {
    name: 'Itens Caros',
    description: 'Itens com preço acima de R$ 1000',
    conditions: [
      {
        id: '3',
        field: 'price',
        operator: 'greater_than',
        value: 1000,
        enabled: true
      }
    ] as FilterCondition[]
  },
  {
    name: 'Em Destaque',
    description: 'Apenas itens marcados como destaque',
    conditions: [
      {
        id: '4',
        field: 'is_featured',
        operator: 'is_true',
        value: '',
        enabled: true
      }
    ] as FilterCondition[]
  }
];

// Utilitário para copiar código
export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => false);
}

// Componente de código copiável
function CodeBlock({ code, language = 'tsx' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    setCopied(true);
    
    if (success) {
      toast({
        title: 'Código copiado!',
        description: 'O código foi copiado para a área de transferência.',
      });
    }
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-8"
        onClick={handleCopy}
      >
        {copied ? (
          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 mr-1" />
        )}
        {copied ? 'Copiado!' : 'Copiar'}
      </Button>
    </div>
  );
}

export default function UIComponentsDemo() {
  // Estados para demonstração
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [selectedIcon, setSelectedIcon] = useState('credit-card');
  const [iconType, setIconType] = useState<'lucide' | 'emoji'>('lucide');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

  // Exemplos de código para cada componente
  const colorPickerCode = `import ColorPicker from '@/components/ui/color-picker';

function MyComponent() {
  const [color, setColor] = useState('#3B82F6');
  
  return (
    <ColorPicker
      value={color}
      onChange={setColor}
      label="Cor do Tema"
      showPreview={true}
      showGradients={true}
      showRecentColors={true}
    />
  );
}`;

  const iconSelectorCode = `import IconSelector from '@/components/ui/icon-selector';

function MyComponent() {
  const [icon, setIcon] = useState('credit-card');
  const [iconType, setIconType] = useState<'lucide' | 'emoji'>('lucide');
  
  return (
    <IconSelector
      value={icon}
      onChange={(iconName, type) => {
        setIcon(iconName);
        setIconType(type);
      }}
      label="Ícone do Método"
      showEmojiTab={true}
      showFavorites={true}
      showRecent={true}
    />
  );
}`;

  const advancedFiltersCode = `import AdvancedFilters, { FilterField, FilterCondition } from '@/components/ui/advanced-filters';

const fields: FilterField[] = [
  {
    key: 'name',
    label: 'Nome',
    type: 'text',
    placeholder: 'Digite o nome...'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Ativo', value: 'active' },
      { label: 'Inativo', value: 'inactive' }
    ]
  }
];

function MyComponent() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  
  return (
    <AdvancedFilters
      fields={fields}
      conditions={conditions}
      onConditionsChange={setConditions}
      onApply={(activeConditions) => console.log(activeConditions)}
      showSaveLoad={true}
      showPresets={true}
      presets={[
        {
          name: 'Ativos',
          description: 'Apenas itens ativos',
          conditions: [...]
        }
      ]}
    />
  );
}`;

  return (
    <div className="space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Componentes UI Avançados</h1>
        <p className="text-gray-600">
          Demonstração dos componentes personalizados criados para o PMS
        </p>
      </div>

      <Tabs defaultValue="color-picker" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="color-picker" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Color Picker
          </TabsTrigger>
          <TabsTrigger value="icon-selector" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Icon Selector
          </TabsTrigger>
          <TabsTrigger value="advanced-filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Advanced Filters
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Integração
          </TabsTrigger>
        </TabsList>

        {/* Tab: Color Picker */}
        <TabsContent value="color-picker" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Demonstração */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Demonstração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPicker
                  value={selectedColor}
                  onChange={setSelectedColor}
                  label="Cor Selecionada"
                  showPreview={true}
                  showGradients={true}
                  showRecentColors={true}
                />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Preview da Cor:</h4>
                  <div 
                    className="w-full h-24 rounded-lg border-2 border-gray-200 flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: selectedColor }}
                  >
                    {selectedColor}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-medium">HEX</div>
                      <div className="font-mono">{selectedColor}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-medium">RGB</div>
                      <div className="font-mono text-xs">
                        {(() => {
                          const r = parseInt(selectedColor.slice(1, 3), 16);
                          const g = parseInt(selectedColor.slice(3, 5), 16);
                          const b = parseInt(selectedColor.slice(5, 7), 16);
                          return `${r}, ${g}, ${b}`;
                        })()}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-medium">HSL</div>
                      <div className="font-mono text-xs">Auto</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Código */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Código de Uso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={colorPickerCode} />
              </CardContent>
            </Card>
          </div>

          {/* Recursos */}
          <Card>
            <CardHeader>
              <CardTitle>Recursos do Color Picker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Paletas Organizadas</h4>
                  <p className="text-sm text-gray-600">Cores organizadas por categoria (principais, negócio, status, sazonais)</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Cores Recentes</h4>
                  <p className="text-sm text-gray-600">Salva automaticamente as cores mais usadas</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Preview em Tempo Real</h4>
                  <p className="text-sm text-gray-600">Visualização instantânea da cor selecionada</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Cores Aleatórias</h4>
                  <p className="text-sm text-gray-600">Gerador de cores aleatórias para inspiração</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Gradientes</h4>
                  <p className="text-sm text-gray-600">Suporte a gradientes populares (opcional)</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Validação HEX</h4>
                  <p className="text-sm text-gray-600">Validação automática do formato hexadecimal</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Icon Selector */}
        <TabsContent value="icon-selector" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Demonstração */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Demonstração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <IconSelector
                  value={selectedIcon}
                  onChange={(iconName, type) => {
                    setSelectedIcon(iconName);
                    setIconType(type);
                  }}
                  label="Ícone Selecionado"
                  showEmojiTab={true}
                  showFavorites={true}
                  showRecent={true}
                />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Preview do Ícone:</h4>
                  <div className="flex items-center justify-center w-full h-24 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <div className="text-center">
                      <div className="text-4xl mb-2">
                        {iconType === 'emoji' ? (
                          <span>{selectedIcon.includes('emoji') ? '💳' : selectedIcon}</span>
                        ) : (
                          '🔧' // Placeholder para ícone Lucide
                        )}
                      </div>
                      <Badge variant="outline">
                        {iconType} • {selectedIcon}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Código */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Código de Uso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={iconSelectorCode} />
              </CardContent>
            </Card>
          </div>

          {/* Recursos */}
          <Card>
            <CardHeader>
              <CardTitle>Recursos do Icon Selector</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Ícones Categorizados</h4>
                  <p className="text-sm text-gray-600">Organizados por pagamento, canais, status, ações, etc.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Busca Inteligente</h4>
                  <p className="text-sm text-gray-600">Busca por nome ou categoria do ícone</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Ícones + Emojis</h4>
                  <p className="text-sm text-gray-600">Suporte a ícones Lucide e emojis populares</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Favoritos</h4>
                  <p className="text-sm text-gray-600">Sistema de favoritos persistente</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Histórico</h4>
                  <p className="text-sm text-gray-600">Ícones recentemente utilizados</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Grid Visual</h4>
                  <p className="text-sm text-gray-600">Interface visual com tooltips informativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Advanced Filters */}
        <TabsContent value="advanced-filters" className="space-y-6">
          
          {/* Demonstração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Demonstração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdvancedFilters
                fields={EXAMPLE_FILTER_FIELDS}
                conditions={filterConditions}
                onConditionsChange={setFilterConditions}
                onApply={(conditions) => console.log('Filtros aplicados:', conditions)}
                onClear={() => setFilterConditions([])}
                showSaveLoad={true}
                showPresets={true}
                presets={EXAMPLE_FILTER_PRESETS}
                maxConditions={8}
              />
            </CardContent>
          </Card>

          {/* Código */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Código de Uso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={advancedFiltersCode} />
            </CardContent>
          </Card>

          {/* Recursos */}
          <Card>
            <CardHeader>
              <CardTitle>Recursos do Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Múltiplos Tipos</h4>
                  <p className="text-sm text-gray-600">Texto, número, data, seleção, booleano</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Operadores Avançados</h4>
                  <p className="text-sm text-gray-600">Contém, igual, maior, menor, entre, etc.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Filtros Salvos</h4>
                  <p className="text-sm text-gray-600">Salvar e carregar configurações de filtros</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Presets Rápidos</h4>
                  <p className="text-sm text-gray-600">Filtros pré-configurados por módulo</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Export/Import</h4>
                  <p className="text-sm text-gray-600">Exportar/importar configurações JSON</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600">✅ Interface Intuitiva</h4>
                  <p className="text-sm text-gray-600">Drag & drop, toggle ativo/inativo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Integração */}
        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Como Usar nos Formulários Existentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Integração com PaymentMethodModal */}
              <div>
                <h3 className="text-lg font-medium mb-3">1. PaymentMethodModal.tsx</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Substitua os campos de cor e ícone pelos novos componentes:
                </p>
                
                <CodeBlock code={`// Substitua este código no PaymentMethodModal.tsx

// De:
<Input 
  type="color"
  className="w-16 h-10 p-1 border rounded cursor-pointer"
  {...field}
/>

// Para:
<ColorPicker
  value={field.value}
  onChange={field.onChange}
  label="Cor do Método"
  showPreview={true}
  showRecentColors={true}
/>

// E de:
<Select onValueChange={field.onChange} defaultValue={field.value}>
  {/* ícones... */}
</Select>

// Para:
<IconSelector
  value={field.value}
  onChange={(iconName, type) => field.onChange(iconName)}
  label="Ícone do Método"
  showEmojiTab={true}
  showFavorites={true}
/>`} />
              </div>

              {/* Integração com listas */}
              <div>
                <h3 className="text-lg font-medium mb-3">2. Páginas de Listagem</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Adicione filtros avançados nas páginas de métodos de pagamento e canais:
                </p>
                
                <CodeBlock code={`// Em metodos-pagamento/page.tsx e canais-venda/page.tsx

const FILTER_FIELDS = [
  {
    key: 'name',
    label: 'Nome',
    type: 'text' as const,
    placeholder: 'Nome do método...'
  },
  {
    key: 'is_active',
    label: 'Status',
    type: 'boolean' as const
  },
  {
    key: 'fee_percentage',
    label: 'Taxa',
    type: 'number' as const,
    placeholder: 'Valor da taxa...'
  }
];

// Substitua os filtros simples por:
<AdvancedFilters
  fields={FILTER_FIELDS}
  conditions={filterConditions}
  onConditionsChange={setFilterConditions}
  onApply={handleApplyFilters}
  showPresets={true}
  presets={[
    {
      name: 'Ativos com Taxa',
      description: 'Métodos ativos que cobram taxa',
      conditions: [...]
    }
  ]}
/>`} />
              </div>

              {/* Dicas de performance */}
              <div>
                <h3 className="text-lg font-medium mb-3">3. Otimizações de Performance</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">💡 Lazy Loading</h4>
                    <p className="text-sm text-blue-700">
                      Os componentes são carregados sob demanda. Use lazy loading para páginas que não sempre precisam deles.
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">⚡ LocalStorage</h4>
                    <p className="text-sm text-yellow-700">
                      Cores recentes, ícones favoritos e filtros salvos são automaticamente persistidos no localStorage.
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">🔄 Reutilização</h4>
                    <p className="text-sm text-green-700">
                      Todos os componentes são totalmente reutilizáveis em qualquer parte do sistema.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist de implementação */}
          <Card>
            <CardHeader>
              <CardTitle>Checklist de Implementação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  'Instalar dependências (date-fns se ainda não tiver)',
                  'Copiar componentes para /components/ui/',
                  'Verificar se o componente Calendar existe',
                  'Atualizar imports nos formulários existentes',
                  'Testar localStorage permissions',
                  'Configurar filtros específicos por módulo',
                  'Ajustar cores e ícones nas paletas',
                  'Criar presets de filtros por contexto'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-400">{index + 1}</span>
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}