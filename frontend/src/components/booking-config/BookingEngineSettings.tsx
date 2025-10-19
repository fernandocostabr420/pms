// frontend/src/components/booking-config/BookingEngineSettings.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Settings,
  Palette,
  FileText,
  Shield,
  Bell,
  Search,
  Zap,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BasicSettings from './BasicSettings';
import BrandingSettings from './BrandingSettings';
import ContentSettings from './ContentSettings';
import PolicySettings from './PolicySettings';
import NotificationSettings from './NotificationSettings';
import SeoSettings from './SeoSettings';
import AdvancedSettings from './AdvancedSettings';
import PreviewModal from './PreviewModal';

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

interface BookingEngineSettingsProps {
  propertyId: number;
  config: BookingEngineConfig;
  onBack: () => void;
  onUpdate: () => void;
}

export default function BookingEngineSettings({
  propertyId,
  config,
  onBack,
  onUpdate
}: BookingEngineSettingsProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState<BookingEngineConfig>(config);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleChange = (field: keyof BookingEngineConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/${propertyId}/booking-engine`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${document.cookie.split('access_token=')[1]?.split(';')[0]}`
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao salvar configurações');
      }

      setHasChanges(false);
      onUpdate();

      toast({
        title: 'Configurações salvas!',
        description: 'As alterações foram aplicadas com sucesso.',
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Básico', icon: Settings },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'content', label: 'Conteúdo', icon: FileText },
    { id: 'policies', label: 'Políticas', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'seo', label: 'SEO', icon: Search },
    { id: 'advanced', label: 'Avançado', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Configurações do Motor de Reservas
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Personalize a aparência e comportamento do seu site de reservas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-7 mb-6">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <BasicSettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="branding" className="space-y-6">
              <BrandingSettings
                config={formData}
                propertyId={propertyId}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <ContentSettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="policies" className="space-y-6">
              <PolicySettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <NotificationSettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="seo" className="space-y-6">
              <SeoSettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <AdvancedSettings
                config={formData}
                onChange={handleChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          config={formData}
          propertyId={propertyId}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Save className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Alterações não salvas</p>
              <p className="text-xs text-gray-600 mt-1">
                Você tem alterações pendentes. Clique em "Salvar Alterações" para aplicá-las.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}