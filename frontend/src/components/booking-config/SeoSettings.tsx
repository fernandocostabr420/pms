// frontend/src/components/booking-config/SeoSettings.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  TrendingUp,
  FileCode,
  Info,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeoSettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function SeoSettings({ config, onChange }: SeoSettingsProps) {
  // ✅ CORRIGIDO: Usando meta_title em vez de seo_title
  const getMetaTitleLength = () => (config.meta_title || '').length;
  const getMetaDescriptionLength = () => (config.meta_description || '').length;

  const isMetaTitleOptimal = () => {
    const len = getMetaTitleLength();
    return len >= 50 && len <= 60;
  };

  const isMetaDescriptionOptimal = () => {
    const len = getMetaDescriptionLength();
    return len >= 150 && len <= 160;
  };

  return (
    <div className="space-y-6">
      {/* Meta Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Meta Tags (SEO)
          </CardTitle>
          <CardDescription>
            Configure as meta tags para melhorar o posicionamento no Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ✅ CORRIGIDO: Meta Title usando meta_title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta_title">
                Meta Title (Título da Página)
              </Label>
              <div className="flex items-center gap-2">
                {isMetaTitleOptimal() ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ótimo
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {getMetaTitleLength() < 50 ? 'Muito curto' : 'Muito longo'}
                  </Badge>
                )}
              </div>
            </div>
            <Input
              id="meta_title"
              placeholder="Pousada Exemplo | Hospedagem Confortável em [Cidade]"
              value={config.meta_title || ''}
              onChange={(e) => onChange('meta_title', e.target.value || null)}
              maxLength={70}
            />
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Aparece no título da aba do navegador e nos resultados do Google
              </span>
              <span className={`font-medium ${
                isMetaTitleOptimal() ? 'text-green-600' : 'text-amber-600'
              }`}>
                {getMetaTitleLength()}/60 (ideal: 50-60)
              </span>
            </div>
          </div>

          {/* ✅ CORRIGIDO: Meta Description usando meta_description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta_description">
                Meta Description (Descrição da Página)
              </Label>
              <div className="flex items-center gap-2">
                {isMetaDescriptionOptimal() ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ótimo
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {getMetaDescriptionLength() < 150 ? 'Muito curto' : 'Muito longo'}
                  </Badge>
                )}
              </div>
            </div>
            <Textarea
              id="meta_description"
              placeholder="Reserve sua estadia na Pousada Exemplo. Quartos confortáveis, café da manhã incluso e localização privilegiada. Faça sua reserva online agora!"
              value={config.meta_description || ''}
              onChange={(e) => onChange('meta_description', e.target.value || null)}
              rows={4}
              maxLength={200}
            />
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                Aparece abaixo do título nos resultados de busca do Google
              </span>
              <span className={`font-medium ${
                isMetaDescriptionOptimal() ? 'text-green-600' : 'text-amber-600'
              }`}>
                {getMetaDescriptionLength()}/160 (ideal: 150-160)
              </span>
            </div>
          </div>

          {/* ✅ CORRIGIDO: Meta Keywords usando meta_keywords */}
          <div className="space-y-2">
            <Label htmlFor="meta_keywords">
              Palavras-chave (opcional)
            </Label>
            <Input
              id="meta_keywords"
              placeholder="pousada, hotel, hospedagem, [cidade], acomodação"
              value={config.meta_keywords || ''}
              onChange={(e) => onChange('meta_keywords', e.target.value || null)}
              maxLength={500}
            />
            <p className="text-xs text-gray-600">
              Separe as palavras-chave com vírgulas. Use termos que seus clientes buscariam.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Dicas de SEO:</strong> Use palavras-chave relevantes, seja específico 
              sobre sua localização e destaque seus diferenciais. Evite repetir palavras 
              excessivamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Google Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Google Analytics
          </CardTitle>
          <CardDescription>
            Rastreie visitantes e comportamento com Google Analytics 4
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google_analytics_id">
              Google Analytics Measurement ID
            </Label>
            <Input
              id="google_analytics_id"
              placeholder="G-XXXXXXXXXX"
              value={config.google_analytics_id || ''}
              onChange={(e) => onChange('google_analytics_id', e.target.value || null)}
              maxLength={50}
            />
            <p className="text-xs text-gray-600">
              ID de medição do Google Analytics 4 (começa com "G-")
            </p>
          </div>

          {config.google_analytics_id ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Google Analytics configurado. Os dados serão coletados automaticamente.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure o Google Analytics para rastrear visitantes, páginas mais 
                acessadas e taxas de conversão.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Como obter o ID do Google Analytics:</h4>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Acesse <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">analytics.google.com</a></li>
              <li>Crie uma propriedade GA4 (se ainda não tiver)</li>
              <li>Vá em Admin → Fluxos de dados</li>
              <li>Copie o "ID de medição" (formato: G-XXXXXXXXXX)</li>
              <li>Cole aqui no campo acima</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Facebook Pixel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Facebook Pixel
          </CardTitle>
          <CardDescription>
            Rastreie conversões e crie públicos personalizados para anúncios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="facebook_pixel_id">
              Facebook Pixel ID
            </Label>
            <Input
              id="facebook_pixel_id"
              placeholder="1234567890123456"
              value={config.facebook_pixel_id || ''}
              onChange={(e) => onChange('facebook_pixel_id', e.target.value || null)}
              maxLength={50}
            />
            <p className="text-xs text-gray-600">
              ID do pixel do Facebook (apenas números, 15-16 dígitos)
            </p>
          </div>

          {config.facebook_pixel_id ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Facebook Pixel configurado. Eventos de conversão serão rastreados 
                automaticamente.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure o Facebook Pixel se você faz anúncios no Facebook/Instagram 
                para rastrear conversões e otimizar campanhas.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Como obter o Facebook Pixel ID:</h4>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Acesse o <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Gerenciador de Eventos</a></li>
              <li>Selecione seu pixel ou crie um novo</li>
              <li>Clique em "Configurar o pixel"</li>
              <li>Copie o ID do pixel (apenas os números)</li>
              <li>Cole aqui no campo acima</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Google Search Console */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Google Search Console
          </CardTitle>
          <CardDescription>
            Monitore o desempenho do seu site nos resultados de busca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Próximos passos:</strong> Após publicar seu motor de reservas, 
              adicione-o ao Google Search Console para monitorar como ele aparece 
              nas buscas e identificar oportunidades de melhoria.
            </AlertDescription>
          </Alert>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Benefícios do Search Console:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Ver quais palavras-chave trazem visitantes</li>
              <li>Identificar erros de indexação</li>
              <li>Monitorar posição nos resultados de busca</li>
              <li>Enviar sitemaps para melhor indexação</li>
              <li>Ver quantas páginas estão indexadas</li>
            </ul>
            <Button variant="outline" asChild className="w-full mt-3">
              <a 
                href="https://search.google.com/search-console" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Acessar Search Console
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SEO Preview - ✅ CORRIGIDO: Usando meta_title e meta_description */}
      <Card>
        <CardHeader>
          <CardTitle>Preview nos Resultados do Google</CardTitle>
          <CardDescription>
            Veja como seu site aparecerá nas buscas do Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-white">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>www.seusite.com</span>
                <span>›</span>
                <span>{config.custom_slug || 'reservas'}</span>
              </div>
              
              <h3 className="text-xl text-blue-600 hover:underline cursor-pointer">
                {config.meta_title || 'Adicione um título meta...'}
              </h3>
              
              <p className="text-sm text-gray-700 line-clamp-2">
                {config.meta_description || 'Adicione uma descrição meta para aparecer aqui nos resultados de busca do Google...'}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Título:</span>
              <span className={`font-medium ${
                isMetaTitleOptimal() ? 'text-green-600' : 'text-amber-600'
              }`}>
                {isMetaTitleOptimal() ? '✓ Otimizado' : '⚠ Precisa ajustar'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Descrição:</span>
              <span className={`font-medium ${
                isMetaDescriptionOptimal() ? 'text-green-600' : 'text-amber-600'
              }`}>
                {isMetaDescriptionOptimal() ? '✓ Otimizado' : '⚠ Precisa ajustar'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}