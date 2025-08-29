// frontend/src/components/calendar/QuickBookingModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Calendar, Home, Phone, Mail } from 'lucide-react';
import apiClient from '@/lib/api';
import { PropertyResponse, AvailableRoom } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

const quickBookingSchema = z.object({
  // Hóspede
  guest_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  guest_email: z.string().email('Email inválido').optional().or(z.literal('')),
  guest_phone: z.string().optional(),
  
  // Reserva
  property_id: z.number().min(1, 'Propriedade é obrigatória'),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  adults: z.number().min(1, 'Deve ter pelo menos 1 adulto').max(10),
  children: z.number().min(0).max(10),
  
  // Detalhes
  total_amount: z.number().min(0).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  
  // Quartos
  selected_rooms: z.array(z.number()).min(1, 'Selecione pelo menos 1 quarto'),
});

type QuickBookingFormData = z.infer<typeof quickBookingSchema>;

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date | null;
  onSuccess: () => void;
}

export default function QuickBookingModal({
  isOpen,
  onClose,
  selectedDate,
  onSuccess
}: QuickBookingModalProps) {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<QuickBookingFormData>({
    resolver: zodResolver(quickBookingSchema),
    defaultValues: {
      check_in_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      check_out_date: selectedDate ? format(addDays(selectedDate, 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      adults: 1,
      children: 0,
      source: 'direct',
      selected_rooms: []
    }
  });

  const watchedValues = watch();

  // Carregar propriedades
  useEffect(() => {
    if (isOpen) {
      loadProperties();
    }
  }, [isOpen]);

  // Reset form quando modal abre/fecha
  useEffect(() => {
    if (isOpen) {
      reset({
        check_in_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        check_out_date: selectedDate ? format(addDays(selectedDate, 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        adults: 1,
        children: 0,
        source: 'direct',
        selected_rooms: []
      });
      setAvailableRooms([]);
    }
  }, [isOpen, selectedDate, reset]);

  // Buscar quartos disponíveis quando dados relevantes mudam
  useEffect(() => {
    if (
      watchedValues.property_id &&
      watchedValues.check_in_date &&
      watchedValues.check_out_date
    ) {
      checkAvailability();
    }
  }, [watchedValues.property_id, watchedValues.check_in_date, watchedValues.check_out_date]);

  const loadProperties = async () => {
    try {
      setLoadingProperties(true);
      const response = await apiClient.getProperties({ page: 1, per_page: 100 });
      setProperties(response.properties);
    } catch (error) {
      console.error('Erro ao carregar propriedades:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar propriedades',
        variant: 'destructive',
      });
    } finally {
      setLoadingProperties(false);
    }
  };

  const checkAvailability = async () => {
    try {
      setLoadingRooms(true);
      const response = await apiClient.checkAvailability({
        property_id: watchedValues.property_id,
        check_in_date: watchedValues.check_in_date,
        check_out_date: watchedValues.check_out_date,
        adults: watchedValues.adults,
        children: watchedValues.children,
      });

      setAvailableRooms(response.available_rooms);

      if (!response.available) {
        toast({
          title: 'Sem disponibilidade',
          description: 'Não há quartos disponíveis para o período selecionado',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      setAvailableRooms([]);
      toast({
        title: 'Erro',
        description: 'Erro ao verificar disponibilidade',
        variant: 'destructive',
      });
    } finally {
      setLoadingRooms(false);
    }
  };

  const onSubmit = async (data: QuickBookingFormData) => {
    try {
      setSubmitting(true);

      // CORREÇÃO: Incluir as datas de check-in e check-out para cada quarto
      const rooms = data.selected_rooms.map(roomId => ({
        room_id: roomId,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date
      }));

      await apiClient.createQuickReservation({
        guest_name: data.guest_name,
        guest_email: data.guest_email || undefined,
        guest_phone: data.guest_phone || undefined,
        property_id: data.property_id,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        adults: data.adults,
        children: data.children,
        rooms: rooms, // Agora com as datas incluídas
        total_amount: data.total_amount || 0,
        source: data.source || 'direct',
        guest_requests: data.notes || undefined,
      });

      toast({
        title: 'Reserva criada!',
        description: 'Nova reserva criada com sucesso',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar reserva:', error);
      toast({
        title: 'Erro ao criar reserva',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRoomSelection = (roomId: number) => {
    const currentSelected = watchedValues.selected_rooms || [];
    const newSelected = currentSelected.includes(roomId)
      ? currentSelected.filter(id => id !== roomId)
      : [...currentSelected, roomId];
    setValue('selected_rooms', newSelected);
  };

  const totalGuests = (watchedValues.adults || 0) + (watchedValues.children || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Reserva Rápida</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações do Hóspede */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5" />
              Informações do Hóspede
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guest_name">Nome do Hóspede *</Label>
                <Input
                  {...register('guest_name')}
                  placeholder="Nome completo"
                  disabled={submitting}
                />
                {errors.guest_name && (
                  <p className="text-sm text-red-600">{errors.guest_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guest_email">Email</Label>
                <Input
                  {...register('guest_email')}
                  type="email"
                  placeholder="email@exemplo.com"
                  disabled={submitting}
                />
                {errors.guest_email && (
                  <p className="text-sm text-red-600">{errors.guest_email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guest_phone">Telefone</Label>
                <Input
                  {...register('guest_phone')}
                  placeholder="(11) 99999-9999"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Informações da Reserva */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Reserva
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="property_id">Propriedade *</Label>
                <Select
                  value={watchedValues.property_id?.toString()}
                  onValueChange={(value) => setValue('property_id', parseInt(value))}
                  disabled={submitting || loadingProperties}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma propriedade" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.property_id && (
                  <p className="text-sm text-red-600">{errors.property_id.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="source">Canal</Label>
                <Select
                  value={watchedValues.source}
                  onValueChange={(value) => setValue('source', value)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direto</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="check_in_date">Check-in *</Label>
                <Input
                  {...register('check_in_date')}
                  type="date"
                  disabled={submitting}
                />
                {errors.check_in_date && (
                  <p className="text-sm text-red-600">{errors.check_in_date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="check_out_date">Check-out *</Label>
                <Input
                  {...register('check_out_date')}
                  type="date"
                  disabled={submitting}
                />
                {errors.check_out_date && (
                  <p className="text-sm text-red-600">{errors.check_out_date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="adults">Adultos *</Label>
                <Input
                  {...register('adults', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="10"
                  disabled={submitting}
                />
                {errors.adults && (
                  <p className="text-sm text-red-600">{errors.adults.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="children">Crianças</Label>
                <Input
                  {...register('children', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="10"
                  disabled={submitting}
                />
                {errors.children && (
                  <p className="text-sm text-red-600">{errors.children.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="total_amount">Valor Total (R$)</Label>
                <Input
                  {...register('total_amount', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Seleção de Quartos */}
          {watchedValues.property_id && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Home className="h-5 w-5" />
                Quartos Disponíveis
                {totalGuests > 0 && (
                  <Badge variant="outline">
                    {totalGuests} hóspede{totalGuests !== 1 ? 's' : ''}
                  </Badge>
                )}
              </h3>

              {loadingRooms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Verificando disponibilidade...</span>
                </div>
              ) : availableRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => toggleRoomSelection(room.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        (watchedValues.selected_rooms || []).includes(room.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{room.room_number}</div>
                          <div className="text-sm text-gray-600">
                            {room.room_type_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Máx: {room.max_occupancy} hóspedes
                          </div>
                          {room.floor && (
                            <div className="text-xs text-gray-400">
                              Andar: {room.floor}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={(watchedValues.selected_rooms || []).includes(room.id)}
                            onChange={() => toggleRoomSelection(room.id)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : watchedValues.check_in_date && watchedValues.check_out_date ? (
                <Alert>
                  <AlertDescription>
                    Nenhum quarto disponível para o período selecionado.
                  </AlertDescription>
                </Alert>
              ) : null}

              {errors.selected_rooms && (
                <p className="text-sm text-red-600">{errors.selected_rooms.message}</p>
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              {...register('notes')}
              placeholder="Pedidos especiais ou observações..."
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || availableRooms.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Reserva'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}