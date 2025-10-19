// frontend/src/app/dashboard/motor-reservas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Globe, Settings, BarChart3, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import BookingEngineSettings from '@/components/booking-config/BookingEngineSettings';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { BookingEngineConfig } from '@/types/booking-engine';

export default function MotorReservasPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BookingEngineConfig | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Carregar propriedades
  useEffect(() => {
    loadProperties();
  }, []);

  // Carregar configuração quando propriedade for selecionada
  useEffect(() => {
    if (selectedPropertyId) {
      loadConfig(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  const loadProperties = async () => {
    try {
      const response = await apiClient.get('/properties/', { params: { per_page: 100 } });
      const propertiesList = response.data.properties || [];
      setProperties(propertiesList);
      
      // Selecionar primeira propriedade por padrão
      if (propertiesList.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(propertiesList[0].id);
      }
    } catch (err: any) {
      setError('Erro ao carregar propriedades');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async (propertyId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/properties/${propertyId}/booking-engine`);
      setConfig(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Configuração não existe ainda
        setConfig(null);
      } else {
        setError('Erro ao carregar configuração do motor de reservas');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    if (!selectedPropertyId) return;

    try {
      setLoading(true);
      
      const response = await apiClient.post(`/properties/${selectedPropertyId}/booking-engine`, {
        property_id: selectedPropertyId,
        is_active: true
      });
      
      setConfig(response.data);
      
      toast({
        title: 'Motor de reservas ativado!',
        description: 'Configure agora as opções do seu motor de reservas.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar motor',
        description: err.response?.data?.detail || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updatedConfig: Partial<BookingEngineConfig>) => {
    if (!selectedPropertyId) return;

    try {
      const response = await apiClient.put(
        `/properties/${selectedPropertyId}/booking-engine`,
        updatedConfig
      );
      
      setConfig(response.data);
      
      toast({
        title: 'Configuração salva!',
        description: 'As alterações foram salvas com sucesso.',
      });
      
      return response.data;
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.response?.data?.detail || 'Erro desconhecido',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleCopyUrl = async () => {
    if (!config?.booking_url) return;

    try {
      await navigator.clipboard.writeText(config.booking_url);
      setCopySuccess(true);
      
      toast({
        title: 'URL copiada!',
        description: 'A URL foi copiada para a área de transferência.',
      });

      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar a URL.',
        variant: 'destructive',
      });
    }
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  if (loading && properties.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você precisa criar uma propriedade antes de configurar o motor de reservas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Motor de Reservas</h1>
        <p className="text-gray-600 mt-1">
          Configure seu site de reservas públicas
        </p>
      </div>

      {/* Seletor de Propriedade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Propriedade
          </CardTitle>
          <CardDescription>
            Selecione a propriedade para configurar o motor de reservas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedPropertyId || ''}
            onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name} - {property.city}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Conteúdo */}
      {!config && !loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Motor de Reservas Inativo</CardTitle>
            <CardDescription>
              Ative o motor de reservas para {selectedProperty?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              O motor de reservas permite que seus clientes façam reservas diretamente
              através de uma página pública personalizada.
            </p>
            <Button onClick={handleCreateConfig} size="lg">
              <Globe className="mr-2 h-5 w-5" />
              Ativar Motor de Reservas
            </Button>
          </CardContent>
        </Card>
      ) : config ? (
        <>
          {/* URL Pública */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                URL Pública
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.booking_url}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg"
                />
                <Button variant="outline" onClick={handleCopyUrl}>
                  {copySuccess ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <a href={config.booking_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {config.total_visits}
                  </div>
                  <div className="text-sm text-gray-600">Visitas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {config.total_bookings}
                  </div>
                  <div className="text-sm text-gray-600">Reservas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {config.conversion_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Conversão</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações */}
          <BookingEngineSettings
            config={config}
            onUpdate={handleUpdateConfig}
            propertyId={selectedPropertyId!}
          />
        </>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : null}
    </div>
  );
}