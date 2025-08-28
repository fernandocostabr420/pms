// frontend/src/components/room-availability/RoomAvailabilityModal.tsx
// 🔧 VERSÃO COMPLETAMENTE CORRIGIDA - Substituir o arquivo anterior

'use client';

import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle, Calendar, DollarSign } from 'lucide-react';
import { RoomAvailabilityResponse, RoomAvailabilityCreate, RoomAvailabilityUpdate } from '@/types/room-availability';
import { RoomResponse } from '@/types/api';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ✅ SCHEMA CORRIGIDO - Aceita strings que serão convertidas para números
const availabilitySchema = z.object({
  room_id: z.number().min(1, 'Quarto é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  
  // Status
  is_available: z.boolean().optional(),
  is_blocked: z.boolean().optional(),
  is_out_of_order: z.boolean().optional(),
  is_maintenance: z.boolean().optional(),
  
  // Preços como string (serão convertidos)
  rate_override: z.string().optional(),
  min_stay: z.string().optional(), 
  max_stay: z.string().optional(),
  
  // Restrições
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  
  // Informações
  reason: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface RoomAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availability?: RoomAvailabilityResponse | null;
  onSuccess: () => void;
  roomId?: number;
  date?: string;
}

export default function RoomAvailabilityModal({ 
  isOpen, 
  onClose, 
  availability, 
  onSuccess,
  roomId,
  date
}: RoomAvailabilityModalProps) {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const { toast } = useToast();

  const isEdit = !!availability;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      is_available: true,
      min_stay: '1',
      closed_to_arrival: false,
      closed_to_departure: false,
    },
  });

  const watchedValues = watch();

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        setLoadingData(true);
        const response = await apiClient.getRooms();
        setRooms(response.rooms);
      } catch (error) {
        console.error('Erro ao carregar quartos:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar quartos",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };

    if (isOpen) {
      loadRooms();
    }
  }, [isOpen, toast]);

  // ✅ POPULAÇÃO DE VALORES CORRIGIDA
  useEffect(() => {
    if (availability) {
      // Edit mode - populate with availability data
      setValue('room_id', availability.room_id);
      setValue('date', availability.date);
      setValue('is_available', availability.is_available);
      setValue('is_blocked', availability.is_blocked);
      setValue('is_out_of_order', availability.is_out_of_order);
      setValue('is_maintenance', availability.is_maintenance);
      
      // Converter números para string para o formulário
      setValue('rate_override', availability.rate_override ? availability.rate_override.toString() : '');
      setValue('min_stay', availability.min_stay ? availability.min_stay.toString() : '1');
      setValue('max_stay', availability.max_stay ? availability.max_stay.toString() : '');
      
      setValue('closed_to_arrival', availability.closed_to_arrival);
      setValue('closed_to_departure', availability.closed_to_departure);
      setValue('reason', availability.reason || '');
      setValue('notes', availability.notes || '');
    } else {
      // Create mode - set defaults
      reset({
        room_id: roomId || 0,
        date: date || '',
        is_available: true,
        is_blocked: false,
        is_out_of_order: false,
        is_maintenance: false,
        rate_override: '',
        min_stay: '1',
        max_stay: '',
        closed_to_arrival: false,
        closed_to_departure: false,
        reason: '',
        notes: '',
      });
    }
  }, [availability, roomId, date, setValue, reset]);

  // ✅ FUNÇÃO onSubmit CORRIGIDA
  const onSubmit = async (data: AvailabilityFormData) => {
    try {
      setLoading(true);

      // Converter e validar números
      const rate_override = data.rate_override && data.rate_override !== '' 
        ? Number(data.rate_override) 
        : undefined;

      const min_stay = data.min_stay && data.min_stay !== '' 
        ? Number(data.min_stay) 
        : 1;

      const max_stay = data.max_stay && data.max_stay !== '' 
        ? Number(data.max_stay) 
        : undefined;

      // Validações de números
      if (rate_override !== undefined && (isNaN(rate_override) || rate_override < 0)) {
        toast({
          title: "Erro",
          description: "Preço especial deve ser um número válido maior ou igual a 0",
          variant: "destructive",
        });
        return;
      }

      if (isNaN(min_stay) || min_stay < 1 || min_stay > 30) {
        toast({
          title: "Erro", 
          description: "Estadia mínima deve ser entre 1 e 30 noites",
          variant: "destructive",
        });
        return;
      }

      if (max_stay !== undefined && (isNaN(max_stay) || max_stay < 1 || max_stay > 365 || max_stay < min_stay)) {
        toast({
          title: "Erro",
          description: "Estadia máxima deve ser válida e maior que a mínima",
          variant: "destructive",
        });
        return;
      }

      // Dados limpos
      const cleanData = {
        room_id: data.room_id,
        date: data.date,
        is_available: data.is_available,
        is_blocked: data.is_blocked,
        is_out_of_order: data.is_out_of_order,
        is_maintenance: data.is_maintenance,
        rate_override,
        min_stay,
        max_stay,
        closed_to_arrival: data.closed_to_arrival,
        closed_to_departure: data.closed_to_departure,
        reason: data.reason || undefined,
        notes: data.notes || undefined,
      };

      if (isEdit) {
        await apiClient.updateRoomAvailability(availability!.id, cleanData);
        toast({
          title: "Sucesso!",
          description: "Disponibilidade atualizada com sucesso.",
        });
      } else {
        await apiClient.createRoomAvailability(cleanData as RoomAvailabilityCreate);
        toast({
          title: "Sucesso!",
          description: "Disponibilidade criada com sucesso.",
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar disponibilidade:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao salvar disponibilidade',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEdit ? 'Editar Disponibilidade' : 'Nova Disponibilidade'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações básicas */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Quarto */}
              <div>
                <Label htmlFor="room_id">Quarto *</Label>
                <Select
                  value={watchedValues.room_id?.toString() || 'none'}
                  onValueChange={(value) => setValue('room_id', value === 'none' ? 0 : parseInt(value))}
                  disabled={loading || loadingData || isEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o quarto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Selecione o quarto</SelectItem>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        Quarto {room.room_number} - {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.room_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.room_id.message}</p>
                )}
              </div>

              {/* Data */}
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  {...register('date')}
                  disabled={loading || isEdit}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="pricing">Preços</TabsTrigger>
              <TabsTrigger value="restrictions">Restrições</TabsTrigger>
            </TabsList>

            {/* Tab: Status */}
            <TabsContent value="status" className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_available"
                      checked={watchedValues.is_available}
                      onCheckedChange={(checked) => setValue('is_available', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="is_available" className="text-sm font-medium">Disponível</Label>
                      <p className="text-xs text-gray-500">Quarto disponível para reserva</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_blocked"
                      checked={watchedValues.is_blocked}
                      onCheckedChange={(checked) => setValue('is_blocked', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="is_blocked" className="text-sm font-medium">Bloqueado</Label>
                      <p className="text-xs text-gray-500">Bloqueado manualmente</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_maintenance"
                      checked={watchedValues.is_maintenance}
                      onCheckedChange={(checked) => setValue('is_maintenance', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="is_maintenance" className="text-sm font-medium">Manutenção</Label>
                      <p className="text-xs text-gray-500">Em processo de manutenção</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_out_of_order"
                      checked={watchedValues.is_out_of_order}
                      onCheckedChange={(checked) => setValue('is_out_of_order', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="is_out_of_order" className="text-sm font-medium">Fora de Ordem</Label>
                      <p className="text-xs text-gray-500">Fora de funcionamento</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Preços */}
            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="rate_override">Preço Especial</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="rate_override"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-10"
                      {...register('rate_override')}
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Deixe vazio para usar preço padrão</p>
                  {errors.rate_override && (
                    <p className="text-sm text-red-500 mt-1">{errors.rate_override.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="min_stay">Estadia Mínima</Label>
                  <Input
                    id="min_stay"
                    type="number"
                    min="1"
                    max="30"
                    placeholder="1"
                    {...register('min_stay')}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo de noites</p>
                  {errors.min_stay && (
                    <p className="text-sm text-red-500 mt-1">{errors.min_stay.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="max_stay">Estadia Máxima</Label>
                  <Input
                    id="max_stay"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Sem limite"
                    {...register('max_stay')}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Máximo de noites (opcional)</p>
                  {errors.max_stay && (
                    <p className="text-sm text-red-500 mt-1">{errors.max_stay.message}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Restrições */}
            <TabsContent value="restrictions" className="space-y-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="closed_to_arrival"
                      checked={watchedValues.closed_to_arrival}
                      onCheckedChange={(checked) => setValue('closed_to_arrival', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="closed_to_arrival" className="text-sm font-medium">Fechado para Chegada</Label>
                      <p className="text-xs text-gray-500">Não permite check-in nesta data</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="closed_to_departure"
                      checked={watchedValues.closed_to_departure}
                      onCheckedChange={(checked) => setValue('closed_to_departure', checked)}
                      disabled={loading}
                    />
                    <div>
                      <Label htmlFor="closed_to_departure" className="text-sm font-medium">Fechado para Saída</Label>
                      <p className="text-xs text-gray-500">Não permite check-out nesta data</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reason">Motivo</Label>
                    <Input
                      id="reason"
                      placeholder="Motivo do bloqueio/indisponibilidade"
                      maxLength={100}
                      {...register('reason')}
                      disabled={loading}
                    />
                    {errors.reason && (
                      <p className="text-sm text-red-500 mt-1">{errors.reason.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      placeholder="Observações adicionais..."
                      rows={3}
                      maxLength={1000}
                      {...register('notes')}
                      disabled={loading}
                    />
                    {errors.notes && (
                      <p className="text-sm text-red-500 mt-1">{errors.notes.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
              disabled={loading || loadingData}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}