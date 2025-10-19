// frontend/src/components/rooms/RoomModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Building } from 'lucide-react';
import { RoomResponse, RoomCreate, RoomUpdate } from '@/types/rooms';
import { RoomTypeResponse } from '@/types/api';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Hook personalizado para propriedade única
import { useProperty } from '@/hooks/useProperty';

const roomSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  room_number: z.string().min(1, 'Número do quarto é obrigatório'),
  property_id: z.number().min(1, 'Propriedade é obrigatória'),
  room_type_id: z.number().min(1, 'Tipo de quarto é obrigatório'),
  floor: z.number().min(0).max(50).optional().or(z.literal('')),
  building: z.string().optional(),
  max_occupancy: z.number().min(1).max(10).optional().or(z.literal('')),
  housekeeping_notes: z.string().optional(),
  maintenance_notes: z.string().optional(),
  notes: z.string().optional(),
  is_operational: z.boolean().optional(),
  is_out_of_order: z.boolean().optional(),
});

type RoomFormData = z.infer<typeof roomSchema>;

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room?: RoomResponse | null;
  onSuccess: () => void;
}

// Hook personalizado para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function RoomModal({ 
  isOpen, 
  onClose, 
  room, 
  onSuccess 
}: RoomModalProps) {
  // Hook personalizado para propriedade única
  const { property: tenantProperty, loading: loadingProperty, error: propertyError } = useProperty();
  
  const [roomTypes, setRoomTypes] = useState<RoomTypeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [roomNumberAvailable, setRoomNumberAvailable] = useState<boolean | null>(null);
  const [checkingRoomNumber, setCheckingRoomNumber] = useState(false);
  const { toast } = useToast();

  // Refs para controle de requisições e timeouts
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCheckedRef = useRef<string>('');

  const isEdit = !!room;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors,
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: '',
      room_number: '',
      property_id: undefined,
      room_type_id: undefined,
      floor: '',
      building: '',
      max_occupancy: '',
      housekeeping_notes: '',
      maintenance_notes: '',
      notes: '',
      is_operational: true,
      is_out_of_order: false,
    },
  });

  // Observar mudanças nos campos relevantes
  const roomNumber = watch('room_number');
  const propertyId = watch('property_id');

  // Aplicar debounce no número do quarto
  const debouncedRoomNumber = useDebounce(roomNumber, 500);

  // Função para verificar disponibilidade com controle de requisições
  const checkRoomNumberAvailability = useCallback(async (
    roomNum: string, 
    propId: number,
    signal?: AbortSignal
  ) => {
    try {
      setCheckingRoomNumber(true);
      
      const result = await apiClient.checkRoomNumberAvailability(roomNum, propId, {
        signal // Passar o signal para cancelar a requisição se necessário
      });
      
      // Verificar se a requisição não foi cancelada
      if (!signal?.aborted) {
        setRoomNumberAvailable(result.available);
        lastCheckedRef.current = roomNum;
        
        if (!result.available) {
          // Não é necessário setError pois o visual já mostra
        } else {
          clearErrors('room_number');
        }
      }
    } catch (error: any) {
      // Ignorar erros de requisições canceladas
      if (!signal?.aborted) {
        console.error('Erro ao verificar disponibilidade:', error);
        setRoomNumberAvailable(null);
        lastCheckedRef.current = '';
      }
    } finally {
      if (!signal?.aborted) {
        setCheckingRoomNumber(false);
      }
    }
  }, [clearErrors]);

  // Effect para verificar disponibilidade com debounce
  useEffect(() => {
    // Cancelar requisição pendente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Limpar estado se não há dados suficientes ou se está editando
    if (!debouncedRoomNumber || !propertyId || isEdit) {
      setRoomNumberAvailable(null);
      setCheckingRoomNumber(false);
      return;
    }

    // Não verificar se é o mesmo número já verificado
    if (lastCheckedRef.current === debouncedRoomNumber) {
      return;
    }

    // Criar novo AbortController
    abortControllerRef.current = new AbortController();
    
    // Verificar disponibilidade
    checkRoomNumberAvailability(
      debouncedRoomNumber, 
      propertyId, 
      abortControllerRef.current.signal
    );

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedRoomNumber, propertyId, isEdit, checkRoomNumberAvailability]);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Definir property_id automaticamente quando propriedade carregar
  useEffect(() => {
    if (tenantProperty && !propertyId) {
      setValue('property_id', tenantProperty.id);
    }
  }, [tenantProperty, setValue, propertyId]);

  // Preencher formulário ao editar
  useEffect(() => {
    if (room && isOpen) {
      setValue('name', room.name);
      setValue('room_number', room.room_number);
      setValue('property_id', room.property_id);
      setValue('room_type_id', room.room_type_id);
      setValue('floor', room.floor || '');
      setValue('building', room.building || '');
      setValue('max_occupancy', room.max_occupancy || '');
      setValue('housekeeping_notes', room.housekeeping_notes || '');
      setValue('maintenance_notes', room.maintenance_notes || '');
      setValue('notes', room.notes || '');
      setValue('is_operational', room.is_operational);
      setValue('is_out_of_order', room.is_out_of_order);
      
      // Resetar estado de verificação ao editar
      setRoomNumberAvailable(null);
      lastCheckedRef.current = room.room_number;
    }
  }, [room, isOpen, setValue]);

  // Cleanup ao fechar modal
  useEffect(() => {
    if (!isOpen) {
      // Cancelar requisições pendentes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Limpar estados
      setRoomNumberAvailable(null);
      setCheckingRoomNumber(false);
      lastCheckedRef.current = '';
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      // Carregar apenas tipos de quarto (propriedade vem do hook)
      const roomTypesRes = await apiClient.getRoomTypes({ page: 1, per_page: 100 });
      setRoomTypes(roomTypesRes.room_types.filter(rt => rt.is_bookable));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados necessários",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  // ✅ CORREÇÃO FINAL: onSubmit com sequência correta
  const onSubmit = async (data: RoomFormData) => {
    // Verificar disponibilidade final antes de submeter (apenas para criação)
    if (!isEdit) {
      // Se ainda está verificando, aguardar
      if (checkingRoomNumber) {
        toast({
          title: "Aguarde",
          description: "Verificando disponibilidade do número do quarto...",
          variant: "default",
        });
        return;
      }

      // Se número não está disponível
      if (roomNumberAvailable === false) {
        toast({
          title: "Erro",
          description: "Número do quarto já está em uso nesta propriedade",
          variant: "destructive",
        });
        return;
      }

      // Se não foi verificado ainda, fazer verificação final
      if (roomNumberAvailable === null && data.room_number && data.property_id) {
        try {
          setCheckingRoomNumber(true);
          const result = await apiClient.checkRoomNumberAvailability(
            data.room_number, 
            data.property_id
          );
          
          if (!result.available) {
            setRoomNumberAvailable(false);
            toast({
              title: "Erro",
              description: "Número do quarto já está em uso nesta propriedade",
              variant: "destructive",
            });
            return;
          }
          
          setRoomNumberAvailable(true);
        } catch (error) {
          console.error('Erro na verificação final:', error);
          toast({
            title: "Erro",
            description: "Erro ao verificar disponibilidade. Tente novamente.",
            variant: "destructive",
          });
          return;
        } finally {
          setCheckingRoomNumber(false);
        }
      }
    }

    let success = false; // ✅ Flag para controlar sucesso

    try {
      setLoading(true);
      
      // Preparar dados
      const roomData = {
        name: data.name,
        room_number: data.room_number,
        property_id: data.property_id,
        room_type_id: data.room_type_id,
        floor: data.floor ? Number(data.floor) : undefined,
        building: data.building || undefined,
        max_occupancy: data.max_occupancy ? Number(data.max_occupancy) : undefined,
        housekeeping_notes: data.housekeeping_notes || undefined,
        maintenance_notes: data.maintenance_notes || undefined,
        notes: data.notes || undefined,
      };

      let result;
      if (isEdit && room) {
        // Adicionar campos específicos da edição
        const updateData: RoomUpdate = {
          ...roomData,
          is_operational: data.is_operational,
          is_out_of_order: data.is_out_of_order,
        };
        result = await apiClient.updateRoom(room.id, updateData);
        
        toast({
          title: "Sucesso",
          description: "Quarto atualizado com sucesso",
        });
      } else {
        result = await apiClient.createRoom(roomData as RoomCreate);
        
        toast({
          title: "Sucesso",
          description: "Quarto criado com sucesso",
        });
      }

      success = true; // ✅ Marca como sucesso
      
    } catch (error: any) {
      console.error('Erro ao salvar quarto:', error);
      
      // Tratamento específico para erros de duplicação
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('número')) {
        setRoomNumberAvailable(false);
        toast({
          title: "Erro",
          description: "Número do quarto já está em uso nesta propriedade",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.response?.data?.detail || 'Erro ao salvar quarto',
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false); // ✅ Reseta loading PRIMEIRO
      
      // ✅ SÓ DEPOIS fecha modal e chama callback se teve sucesso
      if (success) {
        handleClose();  // ✅ Fecha modal ANTES
        onSuccess();     // ✅ Callback da página POR ÚLTIMO
      }
    }
  };

  const handleClose = () => {
    // Cancelar requisições pendentes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Resetar formulário e estados
    reset();
    setRoomNumberAvailable(null);
    setCheckingRoomNumber(false);
    lastCheckedRef.current = '';
    
    onClose();
  };

  // Se erro ao carregar propriedade
  if (propertyError && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-red-600">
              <AlertCircle className="h-5 w-5" />
              Erro - Propriedade Necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {propertyError}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-gray-600">
              Para criar quartos, você precisa ter pelo menos uma propriedade cadastrada no sistema.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Quarto' : 'Novo Quarto'}
          </DialogTitle>
        </DialogHeader>

        {loadingProperty || loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">
              {loadingProperty ? 'Carregando propriedade...' : 'Carregando dados...'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Banner da propriedade selecionada automaticamente */}
            {tenantProperty && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800 font-medium">
                    Propriedade: <strong>{tenantProperty.name}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informações Básicas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Quarto *</Label>
                  <Input
                    {...register('name')}
                    id="name"
                    placeholder="Ex: Suíte Master"
                    disabled={loading}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="room_number">Número do Quarto *</Label>
                  <div className="relative">
                    <Input
                      {...register('room_number')}
                      id="room_number"
                      placeholder="101"
                      disabled={loading}
                      className={
                        !isEdit && roomNumberAvailable === false ? 'border-red-500' :
                        !isEdit && roomNumberAvailable === true ? 'border-green-500' : ''
                      }
                    />
                    {checkingRoomNumber && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                    {!isEdit && !checkingRoomNumber && roomNumberAvailable === true && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!isEdit && !checkingRoomNumber && roomNumberAvailable === false && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {errors.room_number && (
                    <p className="text-sm text-red-600 mt-1">{errors.room_number.message}</p>
                  )}
                  {!isEdit && roomNumberAvailable === false && (
                    <p className="text-sm text-red-600 mt-1">Número já está em uso nesta propriedade</p>
                  )}
                  {!isEdit && checkingRoomNumber && (
                    <p className="text-sm text-gray-500 mt-1">Verificando disponibilidade...</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="room_type_id">Tipo de Quarto *</Label>
                  <Select
                    value={watch('room_type_id')?.toString() || ''}
                    onValueChange={(value) => setValue('room_type_id', parseInt(value))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((roomType) => (
                        <SelectItem key={roomType.id} value={roomType.id.toString()}>
                          {roomType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.room_type_id && (
                    <p className="text-sm text-red-600 mt-1">{errors.room_type_id.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Localização */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Localização</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="floor">Andar</Label>
                  <Input
                    {...register('floor', { valueAsNumber: true })}
                    id="floor"
                    type="number"
                    placeholder="0"
                    min="0"
                    max="50"
                    disabled={loading}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="building">Edifício</Label>
                  <Input
                    {...register('building')}
                    id="building"
                    placeholder="Ex: Torre A"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Capacidade */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Capacidade</h3>
              
              <div>
                <Label htmlFor="max_occupancy">Ocupação Máxima</Label>
                <Input
                  {...register('max_occupancy', { valueAsNumber: true })}
                  id="max_occupancy"
                  type="number"
                  placeholder="2"
                  min="1"
                  max="10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Status (apenas na edição) */}
            {isEdit && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Status</h3>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_operational">Quarto Operacional</Label>
                  <Switch
                    id="is_operational"
                    checked={watch('is_operational')}
                    onCheckedChange={(value) => setValue('is_operational', value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_out_of_order">Fora de Ordem</Label>
                  <Switch
                    id="is_out_of_order"
                    checked={watch('is_out_of_order')}
                    onCheckedChange={(value) => setValue('is_out_of_order', value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Observações</h3>
              
              <div>
                <Label htmlFor="housekeeping_notes">Notas de Limpeza</Label>
                <Textarea
                  {...register('housekeeping_notes')}
                  id="housekeeping_notes"
                  placeholder="Observações para a equipe de limpeza..."
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="maintenance_notes">Notas de Manutenção</Label>
                <Textarea
                  {...register('maintenance_notes')}
                  id="maintenance_notes"
                  placeholder="Observações sobre manutenção..."
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="notes">Observações Gerais</Label>
                <Textarea
                  {...register('notes')}
                  id="notes"
                  placeholder="Outras observações sobre o quarto..."
                  disabled={loading}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
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
                disabled={
                  loading || 
                  checkingRoomNumber || 
                  (!isEdit && roomNumberAvailable === false) || 
                  loadingProperty
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : checkingRoomNumber ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  isEdit ? 'Atualizar' : 'Criar Quarto'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}