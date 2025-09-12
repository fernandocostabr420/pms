// frontend/src/app/dashboard/properties/parking/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Car,
  Building,
  Search,
  Settings,
  Edit,
  Check,
  X,
  AlertCircle,
  Info,
  Users,
  Calendar,
  BarChart3,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import apiClient from '@/lib/api';
import { PropertyResponse, ParkingConfigResponse, ParkingUpdateRequest } from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema para validação do formulário de estacionamento
const parkingSchema = z.object({
  parking_enabled: z.boolean(),
  parking_spots_total: z.number().min(0, 'Número de vagas deve ser maior ou igual a 0').max(999, 'Máximo 999 vagas'),
  parking_policy: z.enum(['integral', 'flexible'], {
    errorMap: () => ({ message: 'Selecione uma política válida' })
  }),
});

type ParkingFormData = z.infer<typeof parkingSchema>;

// Componente de estatísticas
interface ParkingStatsProps {
  totalProperties: number;
  propertiesWithParking: number;
  totalSpots: number;
  averageSpotsPerProperty: number;
}

function ParkingStats({ totalProperties, propertiesWithParking, totalSpots, averageSpotsPerProperty }: ParkingStatsProps) {
  const percentageWithParking = totalProperties > 0 ? (propertiesWithParking / totalProperties) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Propriedades com Estacionamento</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{propertiesWithParking}</div>
          <p className="text-xs text-muted-foreground">
            {percentageWithParking.toFixed(1)}% do total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Vagas</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSpots}</div>
          <p className="text-xs text-muted-foreground">
            Todas as propriedades
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Média por Propriedade</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageSpotsPerProperty.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">
            Vagas por propriedade
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Propriedades</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProperties}</div>
          <p className="text-xs text-muted-foreground">
            No sistema
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente do modal de edição
interface ParkingEditModalProps {
  isOpen: boolean;
  onClose: (needsRefresh?: boolean) => void;
  property: PropertyResponse | null;
}

function ParkingEditModal({ isOpen, onClose, property }: ParkingEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ParkingConfigResponse | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ParkingFormData>({
    resolver: zodResolver(parkingSchema),
    defaultValues: {
      parking_enabled: false,
      parking_spots_total: 0,
      parking_policy: 'integral',
    },
  });

  const parkingEnabled = watch('parking_enabled');

  // Carregar configuração atual quando o modal abrir
  useEffect(() => {
    if (isOpen && property) {
      loadCurrentConfig();
    }
  }, [isOpen, property]);

  const loadCurrentConfig = async () => {
    if (!property) return;

    try {
      setLoadingConfig(true);
      const config = await apiClient.getParkingConfiguration(property.id);
      setCurrentConfig(config);
      
      // Preencher o formulário com os dados atuais
      reset({
        parking_enabled: config.parking_enabled,
        parking_spots_total: config.parking_spots_total || 0,
        parking_policy: config.parking_policy,
      });
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração de estacionamento",
        variant: "destructive",
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  const onSubmit = async (data: ParkingFormData) => {
    if (!property) return;

    try {
      setLoading(true);

      const updateData: ParkingUpdateRequest = {
        parking_enabled: data.parking_enabled,
        parking_spots_total: data.parking_enabled ? data.parking_spots_total : 0,
        parking_policy: data.parking_policy,
      };

      await apiClient.updateParkingConfiguration(property.id, updateData);

      toast({
        title: "Sucesso",
        description: "Configuração de estacionamento atualizada com sucesso",
      });

      onClose(true); // Indica que precisa atualizar a lista
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar configuração",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setCurrentConfig(null);
    onClose();
  };

  if (!property) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-600" />
            Configurar Estacionamento
          </DialogTitle>
          <p className="text-sm text-gray-600">
            {property.name}
          </p>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando configuração...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Switch para habilitar estacionamento */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="parking_enabled" className="text-base">
                  Habilitar Estacionamento
                </Label>
                <div className="text-sm text-gray-500">
                  Permitir solicitações de estacionamento
                </div>
              </div>
              <Switch
                id="parking_enabled"
                {...register('parking_enabled')}
                disabled={loading}
              />
            </div>

            {/* Configurações (só aparece se habilitado) */}
            {parkingEnabled && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <Label htmlFor="parking_spots_total">
                    Número Total de Vagas *
                  </Label>
                  <Input
                    {...register('parking_spots_total', { valueAsNumber: true })}
                    id="parking_spots_total"
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    placeholder="Ex: 10"
                    disabled={loading}
                    className="mt-1"
                  />
                  {errors.parking_spots_total && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.parking_spots_total.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="parking_policy">
                    Política de Liberação *
                  </Label>
                  <select
                    {...register('parking_policy')}
                    id="parking_policy"
                    disabled={loading}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="integral">Política Integral</option>
                    <option value="flexible">Política Flexível</option>
                  </select>
                  {errors.parking_policy && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.parking_policy.message}
                    </p>
                  )}
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="space-y-1">
                      <div>
                        <strong>Integral:</strong> Só permite reserva se houver vagas para toda a estadia.
                      </div>
                      <div>
                        <strong>Flexível:</strong> Permite reservar mesmo sem vagas em todos os dias.
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Componente principal da página
export default function ParkingPage() {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<PropertyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithParking, setShowOnlyWithParking] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Carregar propriedades
  useEffect(() => {
    loadProperties();
  }, []);

  // Filtrar propriedades quando os filtros mudarem
  useEffect(() => {
    filterProperties();
  }, [properties, searchTerm, showOnlyWithParking]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProperties({ per_page: 100 });
      setProperties(response.properties || []);
    } catch (error: any) {
      console.error('Erro ao carregar propriedades:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar propriedades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProperties = () => {
    let filtered = [...properties];

    // Filtro de busca textual
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(property =>
        property.name.toLowerCase().includes(term) ||
        property.city?.toLowerCase().includes(term) ||
        property.property_type?.toLowerCase().includes(term)
      );
    }

    // Filtro para mostrar apenas com estacionamento
    if (showOnlyWithParking) {
      filtered = filtered.filter(property => property.parking_enabled);
    }

    setFilteredProperties(filtered);
  };

  const handleEditParking = (property: PropertyResponse) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const handleCloseModal = (needsRefresh?: boolean) => {
    setIsModalOpen(false);
    setSelectedProperty(null);
    
    if (needsRefresh) {
      loadProperties();
    }
  };

  // Calcular estatísticas
  const stats = {
    totalProperties: properties.length,
    propertiesWithParking: properties.filter(p => p.parking_enabled).length,
    totalSpots: properties.reduce((sum, p) => sum + (p.parking_spots_total || 0), 0),
    averageSpotsPerProperty: properties.length > 0 
      ? properties.reduce((sum, p) => sum + (p.parking_spots_total || 0), 0) / properties.length 
      : 0,
  };

  const getPolicyBadge = (policy: string) => {
    return policy === 'integral' ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Integral
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Flexível
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Car className="h-8 w-8 text-blue-600" />
            Gestão de Estacionamento
          </h1>
          <p className="text-gray-600">
            Configure e gerencie o estacionamento de suas propriedades
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <ParkingStats {...stats} />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar propriedades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-parking-only"
                checked={showOnlyWithParking}
                onCheckedChange={setShowOnlyWithParking}
              />
              <Label htmlFor="show-parking-only" className="text-sm">
                Apenas com estacionamento
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Propriedades */}
      <div className="grid gap-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Carregando propriedades...</span>
          </div>
        ) : filteredProperties.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma propriedade encontrada
                </h3>
                <p className="text-gray-600">
                  {searchTerm || showOnlyWithParking
                    ? 'Tente ajustar os filtros de busca'
                    : 'Cadastre uma propriedade para começar'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredProperties.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {property.name}
                      </h3>
                      <Badge variant="outline">
                        {property.property_type || 'N/A'}
                      </Badge>
                      {property.parking_enabled ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Car className="mr-1 h-3 w-3" />
                          Estacionamento Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Sem Estacionamento
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1 mb-1">
                        <Building className="h-4 w-4" />
                        {property.city}, {property.state}
                      </div>
                    </div>

                    {property.parking_enabled && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-blue-900">Vagas:</span>
                            <span className="ml-2 text-blue-700">
                              {property.parking_spots_total || 0}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-blue-900">Política:</span>
                            <span className="ml-2">
                              {getPolicyBadge(property.parking_policy || 'integral')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <Button
                      onClick={() => handleEditParking(property)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Edição */}
      <ParkingEditModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        property={selectedProperty}
      />
    </div>
  );
}