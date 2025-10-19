// frontend/src/components/room-types/RoomTypeModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Plus, X, Users } from 'lucide-react';
import { RoomTypeResponse, RoomTypeCreate, RoomTypeUpdate } from '@/types/rooms';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const roomTypeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  base_capacity: z.number().min(1, 'Capacidade base deve ser pelo menos 1').max(20, 'Capacidade base não pode exceder 20'),
  max_capacity: z.number().min(1, 'Capacidade máxima deve ser pelo menos 1').max(20, 'Capacidade máxima não pode exceder 20'),
  base_amenities: z.array(z.string()).optional(),
  additional_amenities: z.array(z.string()).optional(),
  is_bookable: z.boolean().optional(),
  sort_order: z.number().min(0).max(999).optional(),
}).refine((data) => {
  return data.max_capacity >= data.base_capacity;
}, {
  message: "Capacidade máxima deve ser maior ou igual à capacidade base",
  path: ["max_capacity"],
});

type RoomTypeFormData = z.infer<typeof roomTypeSchema>;

interface RoomTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomType?: RoomTypeResponse | null;
  onSuccess: () => void;
}

export default function RoomTypeModal({ 
  isOpen, 
  onClose, 
  roomType, 
  onSuccess 
}: RoomTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [availableAmenities, setAvailableAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [showAddAmenity, setShowAddAmenity] = useState(false);
  const { toast } = useToast();

  const isEdit = !!roomType;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    getValues,
    control
  } = useForm<RoomTypeFormData>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      base_capacity: 2,
      max_capacity: 2,
      base_amenities: [],
      additional_amenities: [],
      is_bookable: true,
      sort_order: 100,
    }
  });

  const {
    fields: baseAmenitiesFields,
    append: appendBaseAmenity,
    remove: removeBaseAmenity
  } = useFieldArray({
    control,
    name: "base_amenities"
  });

  const {
    fields: additionalAmenitiesFields,
    append: appendAdditionalAmenity,
    remove: removeAdditionalAmenity
  } = useFieldArray({
    control,
    name: "additional_amenities"
  });

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      setLoadingData(true);
      Promise.all([
        loadAvailableAmenities(),
        isEdit && roomType ? loadRoomTypeData() : Promise.resolve()
      ]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [isOpen, isEdit]);

  const loadAvailableAmenities = async () => {
    try {
      const amenities = await apiClient.getAvailableAmenities();
      setAvailableAmenities(Array.isArray(amenities) ? amenities : []);
    } catch (error) {
      console.error('Erro ao carregar comodidades:', error);
      setAvailableAmenities([]); // Garantir que sempre seja um array
    }
  };

  const loadRoomTypeData = async () => {
    if (!roomType) return;
    
    try {
      // Carregar dados completos do room type
      const fullRoomType = await apiClient.getRoomType(roomType.id);
      
      reset({
        name: fullRoomType.name,
        description: fullRoomType.description || '',
        base_capacity: fullRoomType.base_capacity,
        max_capacity: fullRoomType.max_capacity,
        base_amenities: fullRoomType.base_amenities || [],
        additional_amenities: fullRoomType.additional_amenities || [],
        is_bookable: fullRoomType.is_bookable,
        sort_order: fullRoomType.sort_order,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do tipo de quarto:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do tipo de quarto",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: RoomTypeFormData) => {
    try {
      setLoading(true);

      // Gerar slug automaticamente se necessário
      const generateSlug = (name: string) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
          .replace(/\s+/g, '-') // Substitui espaços por hífens
          .replace(/-+/g, '-') // Remove hífens duplicados
          .replace(/^-|-$/g, ''); // Remove hífens do início/fim
      };

      // Preparar dados
      const submitData = {
        ...data,
        slug: generateSlug(data.name), // Gerar slug automaticamente
        base_amenities: data.base_amenities?.length ? data.base_amenities : undefined,
        additional_amenities: data.additional_amenities?.length ? data.additional_amenities : undefined,
        description: data.description?.trim() || undefined,
        sort_order: data.sort_order || undefined,
      };

      if (isEdit && roomType) {
        await apiClient.updateRoomType(roomType.id, submitData);
        toast({
          title: "Sucesso",
          description: "Tipo de quarto atualizado com sucesso",
        });
      } else {
        await apiClient.createRoomType(submitData);
        toast({
          title: "Sucesso",
          description: "Tipo de quarto criado com sucesso",
        });
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao salvar tipo de quarto:', error);
      
      const errorMessage = error.response?.data?.detail || 
        (isEdit ? 'Erro ao atualizar tipo de quarto' : 'Erro ao criar tipo de quarto');
        
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setNewAmenity('');
    setShowAddAmenity(false);
    onClose();
  };

  const handleAddAmenity = (type: 'base' | 'additional') => {
    const amenity = newAmenity.trim();
    if (!amenity) return;

    const currentAmenities = getValues(type === 'base' ? 'base_amenities' : 'additional_amenities') || [];
    
    if (!currentAmenities.includes(amenity)) {
      if (type === 'base') {
        setValue('base_amenities', [...currentAmenities, amenity]);
      } else {
        setValue('additional_amenities', [...currentAmenities, amenity]);
      }
    }
    
    setNewAmenity('');
    setShowAddAmenity(false);
  };

  const handleAddExistingAmenity = (amenity: string, type: 'base' | 'additional') => {
    if (!amenity || !amenity.trim()) return;
    
    const currentAmenities = getValues(type === 'base' ? 'base_amenities' : 'additional_amenities') || [];
    
    if (!currentAmenities.includes(amenity)) {
      const updatedAmenities = [...currentAmenities, amenity];
      if (type === 'base') {
        setValue('base_amenities', updatedAmenities);
      } else {
        setValue('additional_amenities', updatedAmenities);
      }
    }
  };

  const removeAmenity = (amenity: string, type: 'base' | 'additional') => {
    if (!amenity || !amenity.trim()) return;
    
    const currentAmenities = getValues(type === 'base' ? 'base_amenities' : 'additional_amenities') || [];
    const filtered = currentAmenities.filter(a => a !== amenity);
    
    if (type === 'base') {
      setValue('base_amenities', filtered);
    } else {
      setValue('additional_amenities', filtered);
    }
  };

  const currentBaseAmenities = watch('base_amenities') || [];
  const currentAdditionalAmenities = watch('additional_amenities') || [];
  
  // Garantir que availableAmenities seja sempre um array
  const safeAvailableAmenities = Array.isArray(availableAmenities) ? availableAmenities : [];
  
  const availableBaseAmenities = safeAvailableAmenities.filter(a => !currentBaseAmenities.includes(a));
  const availableAdditionalAmenities = safeAvailableAmenities.filter(a => 
    !currentAdditionalAmenities.includes(a) && !currentBaseAmenities.includes(a)
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Tipo de Quarto' : 'Novo Tipo de Quarto'}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="mt-2 text-gray-600">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informações Básicas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Tipo *</Label>
                  <Input
                    {...register('name')}
                    id="name"
                    placeholder="Ex: Standard Double"
                    disabled={loading}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="sort_order">Ordem de Exibição</Label>
                  <Input
                    {...register('sort_order', { valueAsNumber: true })}
                    id="sort_order"
                    type="number"
                    min="0"
                    max="999"
                    placeholder="100"
                    disabled={loading}
                  />
                  {errors.sort_order && (
                    <p className="text-sm text-red-600 mt-1">{errors.sort_order.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  {...register('description')}
                  id="description"
                  placeholder="Descrição detalhada do tipo de quarto..."
                  disabled={loading}
                  rows={3}
                />
                {errors.description && (
                  <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* Capacidades */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Capacidades</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_capacity">Capacidade Base *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      {...register('base_capacity', { valueAsNumber: true })}
                      id="base_capacity"
                      type="number"
                      min="1"
                      max="20"
                      placeholder="2"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  {errors.base_capacity && (
                    <p className="text-sm text-red-600 mt-1">{errors.base_capacity.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="max_capacity">Capacidade Máxima *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      {...register('max_capacity', { valueAsNumber: true })}
                      id="max_capacity"
                      type="number"
                      min="1"
                      max="20"
                      placeholder="4"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  {errors.max_capacity && (
                    <p className="text-sm text-red-600 mt-1">{errors.max_capacity.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Comodidades Base */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Comodidades Base</h3>
              <p className="text-sm text-gray-600">
                Comodidades padrão incluídas em todos os quartos deste tipo.
              </p>
              
              {/* Lista de comodidades base */}
              <div className="flex flex-wrap gap-2">
                {currentBaseAmenities.map((amenity) => (
                  <Badge key={amenity} variant="default" className="gap-1">
                    {amenity}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 w-4 h-4"
                      onClick={() => removeAmenity(amenity, 'base')}
                      disabled={loading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>

              {/* Adicionar comodidades base */}
              <div className="space-y-2">
                {availableBaseAmenities.length > 0 && (
                  <div>
                    <Label>Adicionar Comodidade Existente</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableBaseAmenities.slice(0, 10).map((amenity) => (
                        <Button
                          key={amenity}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddExistingAmenity(amenity, 'base')}
                          disabled={loading}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {amenity}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Nova comodidade base..."
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAmenity('base');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddAmenity('base')}
                    disabled={loading || !newAmenity.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Comodidades Adicionais */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Comodidades Adicionais</h3>
              <p className="text-sm text-gray-600">
                Comodidades opcionais ou premium que podem variar entre quartos.
              </p>
              
              {/* Lista de comodidades adicionais */}
              <div className="flex flex-wrap gap-2">
                {currentAdditionalAmenities.map((amenity) => (
                  <Badge key={amenity} variant="secondary" className="gap-1">
                    {amenity}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 w-4 h-4"
                      onClick={() => removeAmenity(amenity, 'additional')}
                      disabled={loading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>

              {/* Adicionar comodidades adicionais */}
              <div className="space-y-2">
                {availableAdditionalAmenities.length > 0 && (
                  <div>
                    <Label>Adicionar Comodidade Existente</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableAdditionalAmenities.slice(0, 10).map((amenity) => (
                        <Button
                          key={amenity}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddExistingAmenity(amenity, 'additional')}
                          disabled={loading}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {amenity}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Nova comodidade adicional..."
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAmenity('additional');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddAmenity('additional')}
                    disabled={loading || !newAmenity.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Configurações */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configurações</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Disponível para Reservas</Label>
                  <p className="text-sm text-gray-600">
                    Se desabilitado, este tipo não aparecerá nas opções de reserva.
                  </p>
                </div>
                <Switch
                  checked={watch('is_bookable')}
                  onCheckedChange={(checked) => setValue('is_bookable', checked)}
                  disabled={loading}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
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
                className="min-w-[100px]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}