// frontend/src/components/room-map/RoomMapQuickBooking.tsx
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
import { 
  Loader2, 
  Users, 
  Calendar, 
  User, 
  Phone, 
  Mail,
  DollarSign,
  Bed
} from 'lucide-react';
import { MapRoomData, MapQuickBooking } from '@/types/room-map';
import { PropertyResponse } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

const quickBookingSchema = z.object({
  room_id: z.number().min(1, 'Selecione um quarto'),
  guest_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  guest_email: z.string().email('Email inválido').optional().or(z.literal('')),
  guest_phone: z.string().optional(),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  adults: z.number().min(1, 'Deve ter pelo menos 1 adulto').max(10),
  children: z.number().min(0).max(10),
  rate: z.number().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  notes: z.string().optional(),
  source: z.string().optional()
});

type QuickBookingFormData = z.infer<typeof quickBookingSchema>;

interface RoomMapQuickBookingProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (booking: MapQuickBooking) => Promise<any>;
  selectedRoom?: MapRoomData | null;
  selectedDate?: string | null;
  availableRooms?: MapRoomData[];
  properties?: PropertyResponse[];
  loading?: boolean;
}

export default function RoomMapQuickBooking({
  isOpen,
  onClose,
  onSubmit,
  selectedRoom,
  selectedDate,
  availableRooms = [],
  properties = [],
  loading = false
}: RoomMapQuickBookingProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
    clearErrors
  } = useForm<QuickBookingFormData>({
    resolver: zodResolver(quickBookingSchema),
    defaultValues: {
      check_in_date: selectedDate || format(new Date(), 'yyyy-MM-dd'),
      check_out_date: selectedDate 
        ? format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd')
        : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      adults: 1,
      children: 0,
      source: 'room_map'
    }
  });

  const watchedRoomId = watch('room_id');
  const watchedAdults = watch('adults');
  const watchedChildren = watch('children');
  const watchedCheckIn = watch('check_in_date');
  const watchedCheckOut = watch('check_out_date');
  const watchedRate = watch('rate');

  // Definir quarto selecionado quando o modal abre
  useEffect(() => {
    if (isOpen && selectedRoom) {
      setValue('room_id', selectedRoom.id);
      clearErrors('room_id');
    }
  }, [isOpen, selectedRoom, setValue, clearErrors]);

  // Calcular valor total automaticamente
  useEffect(() => {
    if (watchedRate && watchedCheckIn && watchedCheckOut) {
      const checkIn = new Date(watchedCheckIn);
      const checkOut = new Date(watchedCheckOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      if (nights > 0) {
        setValue('total_amount', watchedRate * nights);
      }
    }
  }, [watchedRate, watchedCheckIn, watchedCheckOut, setValue]);

  // Reset form quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        reset();
      }, 300); // Aguarda animação do modal
    }
  }, [isOpen, reset]);

  const currentRoom = selectedRoom || availableRooms.find(r => r.id === watchedRoomId);
  const totalGuests = watchedAdults + watchedChildren;
  const isOverCapacity = currentRoom && totalGuests > currentRoom.max_occupancy;

  const onFormSubmit = async (data: QuickBookingFormData) => {
    try {
      setSubmitting(true);

      // Validações adicionais
      const checkIn = new Date(data.check_in_date);
      const checkOut = new Date(data.check_out_date);
      
      if (checkOut <= checkIn) {
        toast({
          title: "Erro",
          description: "Data de check-out deve ser posterior ao check-in",
          variant: "destructive",
        });
        return;
      }

      if (checkIn < new Date(new Date().toDateString())) {
        toast({
          title: "Erro",
          description: "Data de check-in não pode ser no passado",
          variant: "destructive",
        });
        return;
      }

      // Converter para o formato esperado pela API
      const booking: MapQuickBooking = {
        room_id: data.room_id,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        guest_name: data.guest_name,
        guest_email: data.guest_email || undefined,
        guest_phone: data.guest_phone || undefined,
        adults: data.adults,
        children: data.children,
        rate: data.rate || undefined,
        total_amount: data.total_amount || undefined,
        notes: data.notes || undefined,
        source: data.source || 'room_map'
      };

      await onSubmit(booking);
      onClose();

    } catch (error: any) {
      console.error('Erro ao criar reserva:', error);
      // O erro já é tratado no hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reserva Rápida
            {currentRoom && (
              <Badge variant="outline">
                Quarto {currentRoom.room_number}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Quarto */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="room_id" className="flex items-center gap-2">
                <Bed className="h-4 w-4" />
                Quarto *
              </Label>
              <Select
                value={watchedRoomId?.toString() || ''}
                onValueChange={(value) => setValue('room_id', parseInt(value))}
                disabled={!!selectedRoom}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um quarto" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoom ? (
                    <SelectItem value={selectedRoom.id.toString()}>
                      {selectedRoom.room_number} - {selectedRoom.name}
                      <Badge variant="outline" className="ml-2">
                        Max {selectedRoom.max_occupancy}
                      </Badge>
                    </SelectItem>
                  ) : (
                    availableRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        {room.room_number} - {room.name}
                        <Badge variant="outline" className="ml-2">
                          Max {room.max_occupancy}
                        </Badge>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.room_id && (
                <p className="text-sm text-red-600">{errors.room_id.message}</p>
              )}
            </div>
          </div>

          {/* Hóspede */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Hóspede
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guest_name">Nome Completo *</Label>
                <Input
                  id="guest_name"
                  {...register('guest_name')}
                  placeholder="Nome do hóspede"
                />
                {errors.guest_name && (
                  <p className="text-sm text-red-600">{errors.guest_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guest_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="guest_email"
                  type="email"
                  {...register('guest_email')}
                  placeholder="email@exemplo.com"
                />
                {errors.guest_email && (
                  <p className="text-sm text-red-600">{errors.guest_email.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="guest_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </Label>
              <Input
                id="guest_phone"
                {...register('guest_phone')}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {/* Reserva */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Detalhes da Reserva
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="check_in_date">Check-in *</Label>
                <Input
                  id="check_in_date"
                  type="date"
                  {...register('check_in_date')}
                />
                {errors.check_in_date && (
                  <p className="text-sm text-red-600">{errors.check_in_date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="check_out_date">Check-out *</Label>
                <Input
                  id="check_out_date"
                  type="date"
                  {...register('check_out_date')}
                />
                {errors.check_out_date && (
                  <p className="text-sm text-red-600">{errors.check_out_date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="adults" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Adultos *
                </Label>
                <Input
                  id="adults"
                  type="number"
                  min="1"
                  max="10"
                  {...register('adults', { valueAsNumber: true })}
                />
                {errors.adults && (
                  <p className="text-sm text-red-600">{errors.adults.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="children">Crianças</Label>
                <Input
                  id="children"
                  type="number"
                  min="0"
                  max="10"
                  {...register('children', { valueAsNumber: true })}
                />
                {errors.children && (
                  <p className="text-sm text-red-600">{errors.children.message}</p>
                )}
              </div>

              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  Total: {totalGuests} hóspede{totalGuests !== 1 ? 's' : ''}
                  {currentRoom && (
                    <div className="text-xs">
                      Capacidade: {currentRoom.max_occupancy}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isOverCapacity && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Número de hóspedes ({totalGuests}) excede a capacidade do quarto ({currentRoom?.max_occupancy})
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Valores */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rate">Tarifa por Noite</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('rate', { valueAsNumber: true })}
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label htmlFor="total_amount">Valor Total</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('total_amount', { valueAsNumber: true })}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Observações adicionais sobre a reserva..."
              rows={3}
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4">
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
              disabled={submitting || loading || isOverCapacity}
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