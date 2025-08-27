// src/components/properties/PropertyModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { PropertyResponse } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

const propertySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres'),
  property_type: z.string().min(1, 'Tipo é obrigatório'),
  description: z.string().optional(),
  address_line_1: z.string().min(1, 'Endereço é obrigatório'),
  address_line_2: z.string().optional(),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(1, 'Estado é obrigatório'),
  postal_code: z.string().min(1, 'CEP é obrigatório'),
  country: z.string().min(1, 'País é obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface PropertyModalProps {
  isOpen: boolean;
  onClose: (needsRefresh?: boolean) => void;
  property?: PropertyResponse | null;
}

const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'pousada', label: 'Pousada' },
  { value: 'resort', label: 'Resort' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'apart_hotel', label: 'Apart Hotel' },
];

export default function PropertyModal({ isOpen, onClose, property }: PropertyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      country: 'Brasil',
      check_in_time: '14:00',
      check_out_time: '12:00',
    },
  });

  // Resetar form quando modal abrir/fechar ou propriedade mudar
  useEffect(() => {
    if (isOpen) {
      if (property) {
        // Preencher form com dados da propriedade existente
        Object.keys(property).forEach((key) => {
          const value = property[key as keyof PropertyResponse];
          if (value !== null && value !== undefined) {
            setValue(key as keyof PropertyFormData, value as any);
          }
        });
      } else {
        // Resetar para valores padrão
        reset({
          country: 'Brasil',
          check_in_time: '14:00',
          check_out_time: '12:00',
        });
      }
      setError(null);
    }
  }, [isOpen, property, reset, setValue]);

  const onSubmit = async (data: PropertyFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Limpar campos vazios
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      );

      if (property) {
        // Atualizar propriedade existente
        await apiClient.put(`/api/v1/properties/${property.id}`, cleanData);
        toast({
          title: "Sucesso",
          description: "Propriedade atualizada com sucesso",
        });
      } else {
        // Criar nova propriedade
        await apiClient.post('/api/v1/properties', cleanData);
        toast({
          title: "Sucesso",
          description: "Propriedade criada com sucesso",
        });
      }

      onClose(true); // Indicar que precisa atualizar a lista
    } catch (err: any) {
      console.error('Erro ao salvar propriedade:', err);
      const errorMessage = err.response?.data?.detail || 'Erro ao salvar propriedade';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {property ? 'Editar Propriedade' : 'Nova Propriedade'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Informações Básicas */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome da Propriedade *</Label>
                <Input
                  {...register('name')}
                  id="name"
                  placeholder="Ex: Hotel Cinco Estrelas"
                  disabled={loading}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="property_type">Tipo *</Label>
                <select
                  {...register('property_type')}
                  id="property_type"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Selecione o tipo</option>
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.property_type && (
                  <p className="text-sm text-red-600 mt-1">{errors.property_type.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                {...register('description')}
                id="description"
                placeholder="Descrição da propriedade..."
                rows={3}
                disabled={loading}
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Endereço</h3>
            
            <div>
              <Label htmlFor="address_line_1">Endereço Principal *</Label>
              <Input
                {...register('address_line_1')}
                id="address_line_1"
                placeholder="Rua, número"
                disabled={loading}
              />
              {errors.address_line_1 && (
                <p className="text-sm text-red-600 mt-1">{errors.address_line_1.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address_line_2">Complemento</Label>
              <Input
                {...register('address_line_2')}
                id="address_line_2"
                placeholder="Apartamento, bloco, etc."
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  {...register('city')}
                  id="city"
                  placeholder="São Paulo"
                  disabled={loading}
                />
                {errors.city && (
                  <p className="text-sm text-red-600 mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="state">Estado *</Label>
                <Input
                  {...register('state')}
                  id="state"
                  placeholder="SP"
                  disabled={loading}
                />
                {errors.state && (
                  <p className="text-sm text-red-600 mt-1">{errors.state.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postal_code">CEP *</Label>
                <Input
                  {...register('postal_code')}
                  id="postal_code"
                  placeholder="00000-000"
                  disabled={loading}
                />
                {errors.postal_code && (
                  <p className="text-sm text-red-600 mt-1">{errors.postal_code.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="country">País *</Label>
                <Input
                  {...register('country')}
                  id="country"
                  disabled={loading}
                />
                {errors.country && (
                  <p className="text-sm text-red-600 mt-1">{errors.country.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Contato</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  {...register('phone')}
                  id="phone"
                  placeholder="(11) 99999-9999"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="contato@hotel.com"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                {...register('website')}
                id="website"
                placeholder="https://www.hotel.com"
                disabled={loading}
              />
              {errors.website && (
                <p className="text-sm text-red-600 mt-1">{errors.website.message}</p>
              )}
            </div>
          </div>

          {/* Check-in/out */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Horários</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="check_in_time">Check-in</Label>
                <Input
                  {...register('check_in_time')}
                  id="check_in_time"
                  type="time"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="check_out_time">Check-out</Label>
                <Input
                  {...register('check_out_time')}
                  id="check_out_time"
                  type="time"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Coordenadas (Opcional) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Localização (Opcional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  {...register('latitude', { valueAsNumber: true })}
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="-23.5505"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  {...register('longitude', { valueAsNumber: true })}
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="-46.6333"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                property ? 'Atualizar' : 'Criar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}