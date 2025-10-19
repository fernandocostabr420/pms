// frontend/src/components/room-map/RoomMapQuickBooking.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { Card, CardContent } from '@/components/ui/card';
import { 
  Loader2, 
  Users, 
  Calendar as CalendarIcon, 
  User, 
  Phone, 
  Mail,
  DollarSign,
  Bed,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  // ✅ CORREÇÃO 1: TODOS os hooks devem ser declarados SEMPRE, independente de condições
  const [submitting, setSubmitting] = useState(false);
  const [checkInDate, setCheckInDate] = useState<Date | undefined>();
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>();
  
  const { toast } = useToast();

  // ✅ CORREÇÃO 2: useForm SEMPRE executado, sem condições
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

  // ✅ CORREÇÃO 3: watch hooks SEMPRE executados
  const watchedRoomId = watch('room_id');
  const watchedAdults = watch('adults');
  const watchedChildren = watch('children');
  const watchedCheckIn = watch('check_in_date');
  const watchedCheckOut = watch('check_out_date');
  const watchedRate = watch('rate');

  // ✅ CORREÇÃO 4: useEffect para sincronizar datas com estado local
  useEffect(() => {
    if (watchedCheckIn) {
      setCheckInDate(new Date(watchedCheckIn));
    }
    if (watchedCheckOut) {
      setCheckOutDate(new Date(watchedCheckOut));
    }
  }, [watchedCheckIn, watchedCheckOut]);

  // ✅ CORREÇÃO 5: useEffect para definir quarto selecionado - executado sempre
  useEffect(() => {
    if (isOpen && selectedRoom && selectedRoom.id) {
      setValue('room_id', selectedRoom.id);
      clearErrors('room_id');
    }
  }, [isOpen, selectedRoom, setValue, clearErrors]);

  // ✅ CORREÇÃO 6: useEffect para sincronizar datas do props - executado sempre
  useEffect(() => {
    if (isOpen) {
      const defaultCheckIn = selectedDate ? new Date(selectedDate) : new Date();
      const defaultCheckOut = selectedDate 
        ? addDays(new Date(selectedDate), 1) 
        : addDays(new Date(), 1);

      setCheckInDate(defaultCheckIn);
      setCheckOutDate(defaultCheckOut);
      setValue('check_in_date', format(defaultCheckIn, 'yyyy-MM-dd'));
      setValue('check_out_date', format(defaultCheckOut, 'yyyy-MM-dd'));
    }
  }, [isOpen, selectedDate, setValue]);

  // ✅ CORREÇÃO 7: useEffect para calcular valor total - executado sempre
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

  // ✅ CORREÇÃO 8: useEffect para reset - executado sempre
  useEffect(() => {
    if (!isOpen) {
      const timeoutId = setTimeout(() => {
        reset();
        setCheckInDate(undefined);
        setCheckOutDate(undefined);
        setSubmitting(false);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, reset]);

  // ✅ CORREÇÃO 9: Cálculos sempre executados (não condicionais)
  const currentRoom = selectedRoom || (availableRooms.find(r => r.id === watchedRoomId) || null);
  const totalGuests = watchedAdults + watchedChildren;
  const isOverCapacity = currentRoom ? totalGuests > currentRoom.max_occupancy : false;
  const nights = checkInDate && checkOutDate 
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // ✅ CORREÇÃO 10: Handlers definidos sempre
  const handleCheckInSelect = (date: Date | undefined) => {
    setCheckInDate(date);
    if (date) {
      setValue('check_in_date', format(date, 'yyyy-MM-dd'));
      // Ajustar check-out para pelo menos 1 dia depois se necessário
      if (!checkOutDate || checkOutDate <= date) {
        const newCheckOut = addDays(date, 1);
        setCheckOutDate(newCheckOut);
        setValue('check_out_date', format(newCheckOut, 'yyyy-MM-dd'));
      }
    }
  };

  const handleCheckOutSelect = (date: Date | undefined) => {
    setCheckOutDate(date);
    if (date) {
      setValue('check_out_date', format(date, 'yyyy-MM-dd'));
    }
  };

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
      // O erro já é tratado no hook useRoomMap
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ RENDER - Sempre renderizar o JSX completo, sem early returns antes dos hooks
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
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
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4" />
                        Quarto {selectedRoom.room_number} - {selectedRoom.name}
                        <Badge variant="outline" className="ml-2">
                          {selectedRoom.max_occupancy} pessoas
                        </Badge>
                      </div>
                    </SelectItem>
                  ) : (
                    availableRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4" />
                          Quarto {room.room_number} - {room.name}
                          <Badge variant="outline" className="ml-2">
                            {room.max_occupancy} pessoas
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.room_id && (
                <p className="text-sm text-red-600 mt-1">{errors.room_id.message}</p>
              )}
            </div>
          </div>

          {/* Informações do Hóspede */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <User className="h-5 w-5" />
              Informações do Hóspede
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guest_name">Nome Completo *</Label>
                <Input
                  id="guest_name"
                  {...register('guest_name')}
                  disabled={submitting}
                  placeholder="Nome do hóspede"
                />
                {errors.guest_name && (
                  <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="guest_phone">Telefone</Label>
                <Input
                  id="guest_phone"
                  {...register('guest_phone')}
                  disabled={submitting}
                  placeholder="(11) 99999-9999"
                />
                {errors.guest_phone && (
                  <p className="text-sm text-red-600 mt-1">{errors.guest_phone.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="guest_email">Email</Label>
                <Input
                  id="guest_email"
                  type="email"
                  {...register('guest_email')}
                  disabled={submitting}
                  placeholder="email@exemplo.com"
                />
                {errors.guest_email && (
                  <p className="text-sm text-red-600 mt-1">{errors.guest_email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Datas da Reserva */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <CalendarIcon className="h-5 w-5" />
              Período da Estadia
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Check-in */}
              <div>
                <Label>Data de Check-in *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkInDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkInDate 
                        ? format(checkInDate, "dd/MM/yyyy", { locale: ptBR }) 
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkInDate}
                      onSelect={handleCheckInSelect}
                      disabled={(date) => date < new Date(new Date().toDateString())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.check_in_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.check_in_date.message}</p>
                )}
              </div>

              {/* Check-out */}
              <div>
                <Label>Data de Check-out *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkOutDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOutDate 
                        ? format(checkOutDate, "dd/MM/yyyy", { locale: ptBR }) 
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkOutDate}
                      onSelect={handleCheckOutSelect}
                      disabled={(date) => !checkInDate || date <= checkInDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.check_out_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.check_out_date.message}</p>
                )}
              </div>
            </div>

            {/* Resumo da estadia */}
            {nights > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Período da estadia:</span>
                    <span className="font-medium">
                      {nights} noite{nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ocupação */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <Users className="h-5 w-5" />
              Ocupação
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adults">Adultos *</Label>
                <Input
                  id="adults"
                  type="number"
                  min="1"
                  max="10"
                  {...register('adults', { valueAsNumber: true })}
                  disabled={submitting}
                />
                {errors.adults && (
                  <p className="text-sm text-red-600 mt-1">{errors.adults.message}</p>
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
                  disabled={submitting}
                />
                {errors.children && (
                  <p className="text-sm text-red-600 mt-1">{errors.children.message}</p>
                )}
              </div>
            </div>

            {/* Alerta de capacidade */}
            {isOverCapacity && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O número de hóspedes ({totalGuests}) excede a capacidade máxima do quarto ({currentRoom?.max_occupancy}).
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Valores */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <DollarSign className="h-5 w-5" />
              Valores
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rate">Taxa por Noite (R$)</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('rate', { valueAsNumber: true })}
                  disabled={submitting}
                  placeholder="0.00"
                />
                {errors.rate && (
                  <p className="text-sm text-red-600 mt-1">{errors.rate.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="total_amount">Valor Total (R$)</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('total_amount', { valueAsNumber: true })}
                  disabled={submitting}
                  placeholder="0.00"
                />
                {errors.total_amount && (
                  <p className="text-sm text-red-600 mt-1">{errors.total_amount.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              disabled={submitting}
              placeholder="Observações sobre a reserva..."
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600 mt-1">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
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
              disabled={submitting || isOverCapacity}
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}