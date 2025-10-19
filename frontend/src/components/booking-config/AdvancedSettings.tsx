// frontend/src/components/booking-config/AdvancedSettings.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap,
  Code,
  Plus,
  X,
  Globe,
  AlertTriangle,
  Info,
  Trash2
} from 'lucide-react';

interface AdvancedSettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function AdvancedSettings({ config, onChange }: AdvancedSettingsProps) {
  const [newExtra, setNewExtra] = useState({
    name: '',
    description: '',
    price: '',
    type: 'per_stay'
  });

  const [newLanguage, setNewLanguage] = useState('');

  // Extras/Serviços Adicionais
  const addExtra = () => {
    if (!newExtra.name.trim() || !newExtra.price) {
      alert('Preencha nome e preço do extra');
      return;
    }

    const currentExtras = config.available_extras || [];
    onChange('available_extras', [...currentExtras, {
      id: Date.now().toString(),
      ...newExtra,
      price: parseFloat(newExtra.price)
    }]);
    
    setNewExtra({ name: '', description: '', price: '', type: 'per_stay' });
  };

  const removeExtra = (id: string) => {
    const currentExtras = config.available_extras || [];
    onChange('available_extras', currentExtras.filter((e: any) => e.id !== id));
  };

  // Idiomas
  const getLanguageList = (): string[] => {
    return config.available_languages || ['pt-BR'];
  };

  const addLanguage = () => {
    if (!newLanguage.trim()) return;
    
    const currentLanguages = getLanguageList();
    if (currentLanguages.includes(newLanguage)) {
      alert('Este idioma já está adicionado');
      return;
    }

    onChange('available_languages', [...currentLanguages, newLanguage]);
    setNewLanguage('');
  };

  const removeLanguage = (lang: string) => {
    const currentLanguages = getLanguageList();
    if (currentLanguages.length === 1) {
      alert('É necessário ter pelo menos um idioma');
      return;
    }
    onChange('available_languages', currentLanguages.filter(l => l !== lang));
  };

  const languageOptions = [
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
  ];

  return (
    <div className="space-y-6">
      {/* Extras/Serviços Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Extras e Serviços Adicionais
          </CardTitle>
          <CardDescription>
            Ofereça serviços extras que os hóspedes podem adicionar à reserva
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lista de Extras */}
          {config.available_extras && config.available_extras.length > 0 && (
            <div className="space-y-3">
              {config.available_extras.map((extra: any) => (
                <div key={extra.id} className="bg-gray-50 rounded-lg p-4 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => removeExtra(extra.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="pr-10">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{extra.name}</h4>
                      <Badge variant="outline">
                        R$ {extra.price.toFixed(2)} 
                        {extra.type === 'per_night' ? '/noite' : '/estadia'}
                      </Badge>
                    </div>
                    {extra.description && (
                      <p className="text-sm text-gray-600">{extra.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar Novo Extra */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 space-y-4">
            <h4 className="font-medium">Adicionar Novo Serviço</h4>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="extra_name">Nome do Serviço</Label>
                <Input
                  id="extra_name"
                  placeholder="Ex: Café da manhã"
                  value={newExtra.name}
                  onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extra_price">Preço (R$)</Label>
                <Input
                  id="extra_price"
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={newExtra.price}
                  onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_description">Descrição (opcional)</Label>
              <Textarea
                id="extra_description"
                placeholder="Descreva o serviço..."
                value={newExtra.description}
                onChange={(e) => setNewExtra({ ...newExtra, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Cobrança</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="extra_type"
                    value="per_stay"
                    checked={newExtra.type === 'per_stay'}
                    onChange={(e) => setNewExtra({ ...newExtra, type: e.target.value })}
                  />
                  <span className="text-sm">Por estadia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="extra_type"
                    value="per_night"
                    checked={newExtra.type === 'per_night'}
                    onChange={(e) => setNewExtra({ ...newExtra, type: e.target.value })}
                  />
                  <span className="text-sm">Por noite</span>
                </label>
              </div>
            </div>

            <Button onClick={addExtra}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Os extras aparecerão como opções durante o processo de reserva. 
              O valor será adicionado automaticamente ao total.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Idiomas Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Idiomas Disponíveis
          </CardTitle>
          <CardDescription>
            Configure quais idiomas estarão disponíveis no motor de reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {getLanguageList().map((lang) => {
              const langInfo = languageOptions.find(l => l.code === lang);
              return (
                <Badge
                  key={lang}
                  variant={lang === config.default_language ? 'default' : 'secondary'}
                  className="pl-3 pr-1 py-1"
                >
                  {langInfo?.name || lang}
                  {lang === config.default_language && (
                    <span className="ml-2 text-xs">(Padrão)</span>
                  )}
                  {getLanguageList().length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-2 hover:bg-red-100"
                      onClick={() => removeLanguage(lang)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              );
            })}
          </div>

          <div className="flex gap-2">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
            >
              <option value="">Selecione um idioma...</option>
              {languageOptions
                .filter(lang => !getLanguageList().includes(lang.code))
                .map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
            </select>
            <Button onClick={addLanguage} disabled={!newLanguage}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Os visitantes poderão alternar entre os idiomas disponíveis. 
              Certifique-se de traduzir todo o conteúdo para cada idioma.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Custom CSS/JS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Código Personalizado
            <Badge variant="outline" className="ml-2">Avançado</Badge>
          </CardTitle>
          <CardDescription>
            Adicione CSS e JavaScript personalizados (use com cuidado)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="css">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="css">CSS Customizado</TabsTrigger>
              <TabsTrigger value="js">JavaScript Customizado</TabsTrigger>
            </TabsList>

            <TabsContent value="css" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom_css">
                  CSS Personalizado
                </Label>
                <Textarea
                  id="custom_css"
                  placeholder=".custom-header { background: #000; }"
                  value={config.custom_css || ''}
                  onChange={(e) => onChange('custom_css', e.target.value || null)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-600">
                  Adicione estilos CSS customizados que serão aplicados ao motor de reservas
                </p>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> CSS incorreto pode quebrar o layout do site. 
                  Teste sempre em ambiente de desenvolvimento primeiro.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="js" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom_js">
                  JavaScript Personalizado
                </Label>
                <Textarea
                  id="custom_js"
                  placeholder="console.log('Custom script');"
                  value={config.custom_js || ''}
                  onChange={(e) => onChange('custom_js', e.target.value || null)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-600">
                  Adicione scripts JavaScript que serão executados no motor de reservas
                </p>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> JavaScript incorreto pode quebrar funcionalidades 
                  do site. Use apenas se você tem conhecimento técnico.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Configurações Customizadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Configurações Personalizadas (JSON)
            <Badge variant="outline" className="ml-2">Avançado</Badge>
          </CardTitle>
          <CardDescription>
            Configurações avançadas em formato JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom_settings">
              Configurações JSON
            </Label>
            <Textarea
              id="custom_settings"
              placeholder='{"key": "value"}'
              value={JSON.stringify(config.custom_settings || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange('custom_settings', parsed);
                } catch (err) {
                  // Ignora erros de parse enquanto digita
                }
              }}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-600">
              Configurações avançadas para desenvolvedores
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              JSON inválido será ignorado. Use este campo apenas se você tem 
              conhecimento técnico específico.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Zona de Perigo */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Zona de Perigo
          </CardTitle>
          <CardDescription>
            Ações irreversíveis - use com extremo cuidado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              As ações abaixo são irreversíveis e podem resultar em perda de dados.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              Resetar Todas as Configurações
            </Button>

            <Button variant="destructive" className="w-full" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              Desativar Motor de Reservas Permanentemente
            </Button>
          </div>

          <p className="text-xs text-gray-600 text-center">
            Funcionalidades desabilitadas para proteção. Entre em contato com o suporte 
            se precisar executar estas ações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}