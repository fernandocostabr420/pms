// frontend/src/app/dashboard/motor-reservas/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/hooks/useProperty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Globe,
  Settings,
  Loader2,
  AlertCircle,
  ExternalLink,
  Eye,
  TrendingUp,
  Users,
  Link as LinkIcon,
  Copy,
  Check
} from 'lucide-react';
import BookingEngineSettings from '@/components/booking-config/BookingEngineSettings';
import { useToast } from '@/hooks/use-toast';

interface BookingEngineConfig {
  id: number;
  property_id: number;
  is_active: boolean;
  custom_slug: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  welcome_text: string | null;
  about_text: string | null;
  gallery_photos: string[];
  hero_photos: string[];
  testimonials: any[];
  social_links: Record<string, string>;
  cancellation_policy: string | null;
  house_rules: string | null;
  terms_and_conditions: string | null;
  privacy_policy: string | null;
  check_in_time: string;
  check_out_time: string;
  require_prepayment: boolean;
  prepayment_percentage: number | null;
  instant_booking: boolean;
  default_min_stay: number;
  default_max_stay: number | null;
  min_advance_booking_hours: number;
  max_advance_booking_days: number;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  notification_emails: string | null;
  send_sms_confirmation: boolean;
  send_whatsapp_confirmation: boolean;
  available_extras: any[];
  available_languages: string[];
  default_language: string;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  custom_settings: Record<string, any>;
  custom_css: string | null;
  custom_js: string | null;
  total_visits: number;
  total_bookings: number;
  created_at: string;
  updated_at: string;
  tenant_id: number;
}

export default function MotorReservasPage() {
  const { property, loading: loadingProperty, error: propertyError } = useProperty();
  const { toast } = useToast();

  const [config, setConfig] = useState<BookingEngineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ✅ MUDANÇA: Sempre mostra as configurações quando tem config
  const [showSettings, setShowSettings] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (property) {
      loadConfig();
    }
  }, [property]);

  const loadConfig = async () => {
    if (!property) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/${property.id}/booking-engine`,
        {
          headers: {
            'Authorization': `Bearer ${document.cookie.split('access_token=')[1]?.split(';')[0]}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        // ✅ MUDANÇA: Automaticamente ativa o modo de configurações
        setShowSettings(true);
      } else if (response.status === 404) {
        setConfig(null);
        setShowSettings(false);
      } else {
        throw new Error('Erro ao carregar configuração');
      }
    } catch (err: any) {
      console.error('Erro ao carregar config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    if (!property) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/${property.id}/booking-engine`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${document.cookie.split('access_token=')[1]?.split(';')[0]}`
          },
          body: JSON.stringify({
            is_active: true,
            primary_color: '#2563eb',
            check_in_time: '14:00',
            check_out_time: '12:00',
            default_min_stay: 1,
            min_advance_booking_hours: 2,
            max_advance_booking_days: 365,
            instant_booking: true,
            default_language: 'pt'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao criar configuração');
      }

      const data = await response.json();
      setConfig(data);
      setShowSettings(true);

      toast({
        title: 'Motor de reservas criado!',
        description: 'Configure agora as opções do seu motor de reservas.',
      });
    } catch (err: any) {
      console.error('Erro ao criar config:', err);
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    const url = getPublicUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({
      title: 'URL copiada!',
      description: 'Link do motor de reservas copiado para a área de transferência.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getPublicUrl = () => {
    if (!property) return '';
    const slug = config?.custom_slug || property.slug;
    return `${process.env.NEXT_PUBLIC_BOOKING_ENGINE_URL || 'http://localhost:3001'}/${slug}`;
  };

  if (loadingProperty || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (propertyError || error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {propertyError || error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!property) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Cadastre uma propriedade antes de configurar o motor de reservas.
        </AlertDescription>
      </Alert>
    );
  }

  // ✅ MUDANÇA: Mostra as configurações direto se existir config
  if (showSettings && config) {
    return (
      <BookingEngineSettings
        propertyId={property.id}
        config={config}
        onBack={() => setShowSettings(false)}
        onUpdate={loadConfig}
      />
    );
  }

  // Tela inicial quando não tem config ainda
  if (!config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Motor de Reservas</h1>
            <p className="text-gray-600 mt-1">
              Configure seu site de reservas online
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Comece Agora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Motor de Reservas não configurado
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Crie seu site de reservas personalizado para receber reservas diretas
                dos seus clientes, sem comissões de intermediários.
              </p>
              <Button onClick={handleCreateConfig} size="lg">
                <Settings className="h-4 w-4 mr-2" />
                Criar Motor de Reservas
              </Button>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-3">Recursos inclusos:</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Site Completo</p>
                    <p className="text-sm text-gray-600">
                      Página com fotos, descrição e informações da propriedade
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Reservas Online</p>
                    <p className="text-sm text-gray-600">
                      Sistema completo de busca, seleção e confirmação
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Personalização Total</p>
                    <p className="text-sm text-gray-600">
                      Cores, textos, fotos e políticas personalizadas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">SEO Otimizado</p>
                    <p className="text-sm text-gray-600">
                      Configurações para melhor posicionamento no Google
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Integração Automática</p>
                    <p className="text-sm text-gray-600">
                      Reservas entram direto no seu sistema
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Analytics</p>
                    <p className="text-sm text-gray-600">
                      Google Analytics e Facebook Pixel integrados
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Overview do motor (só aparece se clicar em "Voltar" nas configurações)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Motor de Reservas</h1>
          <p className="text-gray-600 mt-1">
            Gerencie seu site de reservas online
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={config.is_active ? 'default' : 'secondary'}>
            {config.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
          <Button onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Visitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{config.total_visits.toLocaleString()}</div>
                <p className="text-xs text-gray-500 mt-1">Acessos ao site</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Reservas Geradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{config.total_bookings.toLocaleString()}</div>
                <p className="text-xs text-gray-500 mt-1">Reservas diretas</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {config.total_visits > 0
                    ? ((config.total_bookings / config.total_visits) * 100).toFixed(1)
                    : '0.0'}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Visitas → Reservas</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link do Motor de Reservas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-sm">
              {getPublicUrl()}
            </div>
            <Button variant="outline" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button asChild>
              <a href={getPublicUrl()} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir
              </a>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Check-in / Check-out</p>
              <p className="text-sm text-gray-600">
                {config.check_in_time} / {config.check_out_time}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Estadia Mínima</p>
              <p className="text-sm text-gray-600">
                {config.default_min_stay} {config.default_min_stay === 1 ? 'noite' : 'noites'}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Antecedência Mínima</p>
              <p className="text-sm text-gray-600">
                {config.min_advance_booking_hours} horas
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Reserva Instantânea</p>
              <p className="text-sm text-gray-600">
                {config.instant_booking ? 'Ativada' : 'Desativada'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t">
            <Button onClick={() => setShowSettings(true)} variant="outline" className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Editar Configurações
            </Button>
            <Button asChild className="flex-1">
              <a href={getPublicUrl()} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Site
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}