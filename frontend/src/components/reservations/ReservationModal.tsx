// frontend/src/components/reservations/ReservationModal.tsx

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CalendarIcon, 
  Users, 
  Search,
  Plus,
  Trash2,
  AlertCircle,
  User,
  Building,
  Bed
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReservationResponse, ReservationCreate, ReservationUpdate } from '@/types/reservation';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const reservationSchema = z.object({
  guest_id: z.number().min(1, 'Selecione um hóspede'),
  property_id: z.number().min(1, 'Selecione uma propriedade'),
  check_in_date: z.string().min(1, 'Selecione a data de check-in'),
  check_out_date: z.string().min(1, 'Selecione a data de check-out'),
  adults: z.number().min(1, 'Mínimo 1 adulto').max(10, 'Máximo 10 adultos'),
  children: z.number().min(0, 'Mínimo 0 crianças').max(10, 'Máximo 10 crianças'),
  total_amount: z.number().min(0, 'Valor deve ser positivo').optional(),
  source: z.string().optional(),
  guest_requests: z.string().optional(),
  internal_notes: z.string().optional(),
  rooms: z.array(z.object({
    room_id: z.number().min(1, 'Selecione um quarto'),
    rate_per_night: z.number().min(0, 'Tarifa deve ser positiva').optional(),
    // ADICIONADO: datas para cada quarto (serão preenchidas automaticamente)
    check_in_date: z.string().optional(),
    check_out_date: z.string().optional(),
  })).min(1, 'Selecione pelo menos um quarto'),
});

type ReservationFormData = z.infer<typeof reservationSchema>;

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation?: ReservationResponse | null;
  onSuccess: () => void;
  prefilledData?: Partial<ReservationFormData>;
}

export default function ReservationModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
  prefilledData
}: ReservationModalProps) {
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const { toast } = useToast();
  const isEditing = !!reservation;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      adults: 1,
      children: 0,
      rooms: [{ room_id: 0, rate_per_night: 0 }],
      source: 'direct',
    },
  });

  const watchedRooms = watch('rooms');
  const watchedAdults = watch('adults');
  const watchedChildren = watch('children');

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Carregar disponibilidade quando datas e propriedade mudarem
  useEffect(() => {
    if (checkInDate && checkOutDate && selectedProperty) {
      checkRoomAvailability();
    }
  }, [checkInDate, checkOutDate, selectedProperty, watchedAdults, watchedChildren]);

  // Preencher formulário para edição
  useEffect(() => {
    if (isEditing && reservation) {
      const formData = {
        guest_id: reservation.guest_id,
        property_id: reservation.property_id,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        adults: reservation.adults,
        children: reservation.children,
        total_amount: reservation.total_amount || 0,
        source: reservation.source || 'direct',
        guest_requests: reservation.guest_requests || '',
        internal_notes: reservation.internal_notes || '',
        rooms: reservation.rooms?.map(room => ({
          room_id: room.room_id,
          rate_per_night: room.rate_per_night || 0,
        })) || [{ room_id: 0, rate_per_night: 0 }],
      };
      
      reset(formData);
      setCheckInDate(new Date(reservation.check_in_date + 'T00:00:00'));
      setCheckOutDate(new Date(reservation.check_out_date + 'T00:00:00'));
      setSelectedProperty(reservation.property_id);
    } else if (prefilledData) {
      reset(prefilledData);
      if (prefilledData.check_in_date) {
        setCheckInDate(new Date(prefilledData.check_in_date + 'T00:00:00'));
      }
      if (prefilledData.check_out_date) {
        setCheckOutDate(new Date(prefilledData.check_out_date + 'T00:00:00'));
      }
      if (prefilledData.property_id) {
        setSelectedProperty(prefilledData.property_id);
      }
    }
  }, [isEditing, reservation, prefilledData, reset]);

  const loadInitialData = async () => {
    try {
      const [propertiesRes, guestsRes] = await Promise.all([
        apiClient.getProperties({ per_page: 100 }),
        apiClient.getGuests({ per_page: 100 }),
      ]);
      
      setProperties(propertiesRes.properties || []);
      setGuests(guestsRes.guests || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados iniciais",
        variant: "destructive",
      });
    }
  };

  const checkRoomAvailability = async () => {
    if (!checkInDate || !checkOutDate || !selectedProperty) return;
    
    setCheckingAvailability(true);
    try {
      const response = await apiClient.checkAvailability({
        property_id: selectedProperty,
        check_in_date: format(checkInDate, 'yyyy-MM-dd'),
        check_out_date: format(checkOutDate, 'yyyy-MM-dd'),
        adults: watchedAdults,
        children: watchedChildren,
      });
      
      setAvailableRooms(response.available_rooms || []);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      setAvailableRooms([]);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const searchGuests = async (query: string) => {
    if (query.length < 2) return;
    
    try {
      const results = await apiClient.searchGuests(query, 10);
      setGuests(results);
    } catch (error) {
      console.error('Erro ao buscar hóspedes:', error);
    }
  };

  const addRoom = () => {
    const currentRooms = getValues('rooms');
    setValue('rooms', [...currentRooms, { room_id: 0, rate_per_night: 0 }]);
  };

  const removeRoom = (index: number) => {
    const currentRooms = getValues('rooms');
    if (currentRooms.length > 1) {
      setValue('rooms', currentRooms.filter((_, i) => i !== index));
    }
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    return differenceInDays(checkOutDate, checkInDate);
  };

  const calculateTotal = () => {
    const rooms = getValues('rooms');
    const nights = calculateNights();
    return rooms.reduce((total, room) => total + (room.rate_per_night || 0) * nights, 0);
  };

  const onSubmit = async (data: ReservationFormData) => {
    setLoading(true);

    try {
      // CORREÇÃO: Adicionar as datas para cada quarto
      const roomsWithDates = data.rooms.map(room => ({
        ...room,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date
      }));

      const reservationData = {
        ...data,
        rooms: roomsWithDates // Quartos agora têm as datas incluídas
      };

      if (isEditing && reservation) {
        await apiClient.updateReservation(reservation.id, reservationData as ReservationUpdate);
        toast({
          title: "Sucesso",
          description: "Reserva atualizada com sucesso",
        });
      } else {
        await apiClient.createReservation(reservationData as ReservationCreate);
        toast({
          title: "Sucesso",
          description: "Reserva criada com sucesso",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar reserva:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao salvar reserva',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      setCheckInDate(undefined);
      setCheckOutDate(undefined);
      setSelectedProperty(null);
      setAvailableRooms([]);
      setGuestSearch('');
      onClose();
    }
  };

  const sourceOptions = [
    { value: 'direct', label: 'Direto' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'E-mail' },
    { value: 'walk_in', label: 'Walk-in' },
  ];

  const nights = calculateNights();
  const estimatedTotal = calculateTotal();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Reserva' : 'Nova Reserva'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Guest and Property Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guest */}
            <div>
              <Label htmlFor="guest_id">Hóspede *</Label>
              <Select
                value={watch('guest_id')?.toString() || ''}
                onValueChange={(value) => setValue('guest_id', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o hóspede" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((guest) => (
                    <SelectItem key={guest.id} value={guest.id.toString()}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{guest.full_name}</div>
                          {guest.email && (
                            <div className="text-xs text-gray-500">{guest.email}</div>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.guest_id && (
                <p className="text-sm text-red-600 mt-1">{errors.guest_id.message}</p>
              )}
            </div>

            {/* Property */}
            <div>
              <Label htmlFor="property_id">Propriedade *</Label>
              <Select
                value={watch('property_id')?.toString() || ''}
                onValueChange={(value) => {
                  setValue('property_id', parseInt(value));
                  setSelectedProperty(parseInt(value));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a propriedade" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        {property.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.property_id && (
                <p className="text-sm text-red-600 mt-1">{errors.property_id.message}</p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Check-in Date */}
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
                    {checkInDate ? format(checkInDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={(date) => {
                      setCheckInDate(date);
                      setValue('check_in_date', date ? format(date, 'yyyy-MM-dd') : '');
                      // Ajustar check-out para pelo menos 1 dia depois
                      if (date && (!checkOutDate || checkOutDate <= date)) {
                        const newCheckOut = addDays(date, 1);
                        setCheckOutDate(newCheckOut);
                        setValue('check_out_date', format(newCheckOut, 'yyyy-MM-dd'));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.check_in_date && (
                <p className="text-sm text-red-600 mt-1">{errors.check_in_date.message}</p>
              )}
            </div>

            {/* Check-out Date */}
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
                    {checkOutDate ? format(checkOutDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={checkOutDate}
                    onSelect={(date) => {
                      setCheckOutDate(date);
                      setValue('check_out_date', date ? format(date, 'yyyy-MM-dd') : '');
                    }}
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

          {/* Stay Summary */}
          {checkInDate && checkOutDate && (
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

          {/* Guests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adults">Adultos *</Label>
              <Input
                id="adults"
                type="number"
                min="1"
                max="10"
                {...register('adults', { valueAsNumber: true })}
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
              />
              {errors.children && (
                <p className="text-sm text-red-600 mt-1">{errors.children.message}</p>
              )}
            </div>
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Quartos *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRoom}
                disabled={checkingAvailability}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Quarto
              </Button>
            </div>

            {checkingAvailability ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Verificando disponibilidade...
                  </div>
                </CardContent>
              </Card>
            ) : availableRooms.length === 0 && selectedProperty && checkInDate && checkOutDate ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum quarto disponível para o período selecionado.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {watchedRooms.map((_, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Room Selection */}
                          <div>
                            <Label>Quarto {index + 1}</Label>
                            <Select
                              value={watch(`rooms.${index}.room_id`)?.toString() || ''}
                              onValueChange={(value) => 
                                setValue(`rooms.${index}.room_id`, parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar quarto" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRooms.map((room) => (
                                  <SelectItem key={room.id} value={room.id.toString()}>
                                    <div className="flex items-center gap-2">
                                      <Bed className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">
                                          Quarto {room.room_number}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {room.room_type_name} - Max: {room.max_occupancy}
                                        </div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Rate per Night */}
                          <div>
                            <Label>Tarifa por Noite (R$)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0,00"
                              {...register(`rooms.${index}.rate_per_night`, { valueAsNumber: true })}
                            />
                          </div>
                        </div>

                        {/* Remove Button */}
                        {watchedRooms.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeRoom(index)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {errors.rooms && (
              <p className="text-sm text-red-600 mt-1">
                {Array.isArray(errors.rooms) 
                  ? errors.rooms[0]?.message || 'Erro nos quartos'
                  : errors.rooms.message
                }
              </p>
            )}
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total_amount">Valor Total (R$)</Label>
              <Input
                id="total_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder={`Estimado: R$ ${estimatedTotal.toFixed(2)}`}
                {...register('total_amount', { valueAsNumber: true })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor estimado: R$ {estimatedTotal.toFixed(2)}
              </p>
              {errors.total_amount && (
                <p className="text-sm text-red-600 mt-1">{errors.total_amount.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="source">Canal</Label>
              <Select
                value={watch('source') || ''}
                onValueChange={(value) => setValue('source', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar canal" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="guest_requests">Solicitações do Hóspede</Label>
              <Textarea
                id="guest_requests"
                placeholder="Solicitações especiais do hóspede..."
                rows={3}
                {...register('guest_requests')}
              />
            </div>

            <div>
              <Label htmlFor="internal_notes">Observações Internas</Label>
              <Textarea
                id="internal_notes"
                placeholder="Observações internas..."
                rows={3}
                {...register('internal_notes')}
              />
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEditing ? 'Atualizando...' : 'Criando...'}
                </div>
              ) : (
                isEditing ? 'Atualizar Reserva' : 'Criar Reserva'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}