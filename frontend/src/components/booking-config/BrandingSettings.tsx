// frontend/src/components/booking-config/BrandingSettings.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Palette, 
  Upload,
  X,
  Image as ImageIcon,
  Info,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface BrandingSettingsProps {
  config: any;
  propertyId: number;
  onChange: (field: string, value: any) => void;
}

export default function BrandingSettings({ config, propertyId, onChange }: BrandingSettingsProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleColorChange = (field: string, value: string) => {
    // Garantir que sempre tenha o # no início
    const color = value.startsWith('#') ? value : `#${value}`;
    onChange(field, color);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido');
      return;
    }

    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      return;
    }

    try {
      setUploadingLogo(true);

      // Upload real para o servidor usando a instância singleton
      const result = await apiClient.uploadBookingEngineImage(
        propertyId,
        file,
        'logo'
      );
      
      // Atualizar config com a URL retornada pelo servidor
      onChange('logo_url', result.url);
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    onChange('logo_url', null);
  };

  const resetColors = () => {
    onChange('primary_color', '#2563eb');
    onChange('secondary_color', '#1e40af');
  };

  return (
    <div className="space-y-6">
      {/* ==================== LOGO ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo da Propriedade
          </CardTitle>
          <CardDescription>
            Faça upload da logo que aparecerá no topo do motor de reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.logo_url ? (
            // Logo já existe - mostrar preview e opção de substituir
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="h-24 w-auto object-contain border rounded-lg p-2 bg-white"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={removeLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <label htmlFor="logo-upload-replace" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Substituir Logo
                    <input
                      id="logo-upload-replace"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                </Button>
              </div>
            </div>
          ) : (
            // Nenhuma logo - mostrar área de upload
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-gray-400" />
              </div>
              <Button variant="outline" asChild disabled={uploadingLogo}>
                <label htmlFor="logo-upload" className="cursor-pointer">
                  {uploadingLogo ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Fazer Upload da Logo
                    </>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                PNG, JPG ou SVG até 2MB
              </p>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Para melhores resultados, use uma logo com fundo transparente (PNG) e dimensões de pelo menos 200x60 pixels.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ==================== CORES DO TEMA ==================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Cores do Tema
              </CardTitle>
              <CardDescription>
                Personalize as cores do seu motor de reservas
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={resetColors}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Restaurar Padrão
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cor Primária */}
          <div className="space-y-3">
            <Label htmlFor="primary_color">
              Cor Primária
            </Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="color"
                  id="primary_color"
                  value={config.primary_color}
                  onChange={(e) => handleColorChange('primary_color', e.target.value)}
                  className="h-12 w-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
              </div>
              <div className="flex-1 max-w-xs">
                <Input
                  type="text"
                  value={config.primary_color}
                  onChange={(e) => handleColorChange('primary_color', e.target.value)}
                  placeholder="#2563eb"
                  maxLength={7}
                />
              </div>
              <div className="flex-1">
                <div 
                  className="h-12 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: config.primary_color }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Usada em botões, links e elementos principais da interface
            </p>
          </div>

          {/* Cor Secundária */}
          <div className="space-y-3">
            <Label htmlFor="secondary_color">
              Cor Secundária (opcional)
            </Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="color"
                  id="secondary_color"
                  value={config.secondary_color || '#1e40af'}
                  onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                  className="h-12 w-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
              </div>
              <div className="flex-1 max-w-xs">
                <Input
                  type="text"
                  value={config.secondary_color || ''}
                  onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                  placeholder="#1e40af"
                  maxLength={7}
                />
              </div>
              <div className="flex-1">
                <div 
                  className="h-12 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: config.secondary_color || '#1e40af' }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Usada em elementos secundários e variações de hover
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Escolha cores que tenham bom contraste com texto branco para garantir legibilidade.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ==================== PREVIEW DE CORES ==================== */}
      <Card>
        <CardHeader>
          <CardTitle>Preview das Cores</CardTitle>
          <CardDescription>
            Veja como as cores escolhidas ficarão nos elementos principais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Botão Primário */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Botão Primário</Label>
              <button
                className="w-full px-4 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ 
                  backgroundColor: config.primary_color,
                  opacity: 1
                }}
              >
                Reservar Agora
              </button>
            </div>

            {/* Botão Hover */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Botão Hover</Label>
              <button
                className="w-full px-4 py-2 rounded-lg text-white font-medium"
                style={{ 
                  backgroundColor: config.secondary_color || config.primary_color,
                  opacity: 0.9
                }}
              >
                Ver Disponibilidade
              </button>
            </div>

            {/* Link */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Links</Label>
              <p>
                <a 
                  href="#" 
                  className="font-medium underline"
                  style={{ color: config.primary_color }}
                >
                  Ver mais informações
                </a>
              </p>
            </div>

            {/* Badge */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Badges e Tags</Label>
              <div>
                <span 
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: config.primary_color }}
                >
                  Disponível
                </span>
              </div>
            </div>
          </div>

          {/* Header Simulado */}
          <div className="border rounded-lg overflow-hidden">
            <div 
              className="p-4 text-white"
              style={{ backgroundColor: config.primary_color }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {config.logo_url ? (
                    <img 
                      src={config.logo_url} 
                      alt="Logo" 
                      className="h-8 w-auto object-contain bg-white/10 rounded px-2"
                    />
                  ) : (
                    <div className="h-8 w-24 bg-white/20 rounded" />
                  )}
                  <span className="font-semibold">Minha Pousada</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white'
                    }}
                  >
                    Menu
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-sm text-gray-600">
                Esta é uma prévia de como o cabeçalho do seu site ficará com as cores escolhidas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}