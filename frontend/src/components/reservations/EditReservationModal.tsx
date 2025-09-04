// frontend/src/components/reservations/EditReservationModal.tsx - VERSÃO LIMPA E DEFINITIVA

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, differenceInDays } from 'date-fns';

// Imports básicos
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Hook personalizado para propriedade única
import { useProperty } from '@/hooks/useProperty';

// Imports condicionais com fallbacks
let Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter;
let Badge, Card, CardContent, Alert, AlertDescription;

try {
  const dialogComponents = require('@/components/ui/dialog');
  Dialog = dialogComponents.Dialog;
  DialogContent = dialogComponents.DialogContent;
  DialogHeader = dialogComponents.DialogHeader;
  DialogTitle = dialogComponents.DialogTitle;
  DialogFooter = dialogComponents.DialogFooter;
} catch (e) {
  Dialog = ({ open, onOpenChange, children }) => open ? <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => onOpenChange(false)}>{children}</div> : null;
  DialogContent = ({ children, className }) => <div className={`bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto ${className || ''}`} onClick={(e) => e.stopPropagation()}>{children}</div>;
  DialogHeader = ({ children }) => <div className="mb-6">{children}</div>;
  DialogTitle = ({ children, className }) => <h2 className={`text-xl font-bold ${className || ''}`}>{children}</h2>;
  DialogFooter = ({ children, className }) => <div className={`flex justify-end gap-2 mt-6 ${className || ''}`}>{children}</div>;
}

try {
  const otherComponents = require('@/components/ui/badge');
  Badge = otherComponents.Badge;
} catch (e) {
  Badge = ({ children, className, variant }) => <span className={`px-2 py-1 text-xs rounded ${variant === 'outline' ? 'border' : 'bg-gray-200'} ${className || ''}`}>{children}</span>;
}

try {
  const cardComponents = require('@/components/ui/card');
  Card = cardComponents.Card;
  CardContent = cardComponents.CardContent;
} catch (e) {
  Card = ({ children, className }) => <div className={`border rounded-lg ${className || ''}`}>{children}</div>;
  CardContent = ({ children, className }) => <div className={`p-4 ${className || ''}`}>{children}</div>;
}

try {
  const alertComponents = require('@/components/ui/alert');
  Alert = alertComponents.Alert;
  AlertDescription = alertComponents.AlertDescription;
} catch (e) {
  Alert = ({ children, variant }) => <div className={`p-4 rounded border ${variant === 'destructive' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>{children}</div>;
  AlertDescription = ({ children }) => <div>{children}</div>;
}

// Icons
import { 
  CalendarIcon, 
  AlertCircle,
  User,
  Building,
  Bed,
  Phone,
  Mail,
  Loader2,
  BedDouble
} from 'lucide-react';

// Utils
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ===== SCHEMA PARA EDIÇÃO =====
const editReservationSchema = z.object({
  property_id: z.number().min(1, 'Propriedade é obrigatória'),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  adults: z.number().min(1, 'Mínimo 1 adulto').max(10, 'Máximo 10 adultos'),
  children: z.number().min(0, 'Mínimo 0 crianças').max(10, 'Máximo 10 crianças'),
  selected_rooms: z.array(z.number()).min(1, 'Selecione pelo menos 1 quarto'),
  total_amount: z.number().min(0, 'Valor deve ser positivo').optional(),
  room_rate_override: z.number().min(0, 'Taxa deve ser positiva').optional(),
  guest_requests: z.string().optional(),
  internal_notes: z.string().optional(),
  source: z.string().optional(),
  requires_deposit: z.boolean().optional(),
  is_group_reservation: z.boolean().optional(),
});

type EditReservationFormData = z.infer<typeof editReservationSchema>;

// ===== INTERFACES =====
interface EditReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reservation: any;
}

export default function EditReservationModal({
  isOpen,
  onClose,
  onSuccess,
  reservation
}: EditReservationModalProps) {
  
  // ===== HOOKS =====
  const { property: tenantProperty, loading: loadingProperty, error: propertyError } = useProperty();
  const { toast } = useToast();
  
  // ===== ESTADOS =====
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [fullReservation, setFullReservation] = useState<any>(null); // ✅ NOVO: Reserva completa

  // ===== FORM =====
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<EditReservationFormData>({
    resolver: zodResolver(editReservationSchema),
    defaultValues: {
      adults: 2,
      children: 0,
      selected_rooms: [],
      source: 'direct',
      requires_deposit: false,
      is_group_reservation: false,
    },
  });

  const watchedValues = watch();

  // ===== EFEITOS =====
  
  // Inicializar quando modal abre
  useEffect(() => {
    if (isOpen && reservation && !initialized) {
      console.log('🔄 Inicializando modal de edição...', reservation);
      initializeForm();
      setInitialized(true);
    }
    
    // Reset quando modal fecha
    if (!isOpen) {
      console.log('🔄 Resetando modal...');
      reset();
      setAvailableRooms([]);
      setInitialized(false);
    }
  }, [isOpen, reservation, initialized]);

  // Carregar quartos quando datas mudarem
  useEffect(() => {
    if (
      initialized && 
      tenantProperty && 
      watchedValues.check_in_date && 
      watchedValues.check_out_date &&
      watchedValues.adults
    ) {
      console.log('📅 Carregando quartos disponíveis...');
      loadAvailableRooms();
    }
  }, [
    initialized,
    tenantProperty,
    watchedValues.check_in_date,
    watchedValues.check_out_date,
    watchedValues.adults,
    watchedValues.children
  ]);

  // ===== FUNÇÕES =====

  const initializeForm = () => {
    if (!reservation) return;
    
    console.log('📝 Inicializando formulário com dados da reserva:', reservation);
    
    // Obter quartos da reserva
    const roomIds = reservation.rooms?.map((room: any) => room.room_id) || [];
    const currentRatePerNight = reservation.rooms?.[0]?.rate_per_night || 0;
    
    // Preencher formulário
    const formData: EditReservationFormData = {
      property_id: reservation.property_id || tenantProperty?.id || 0,
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      adults: reservation.adults || 2,
      children: reservation.children || 0,
      selected_rooms: roomIds,
      total_amount: parseFloat(reservation.total_amount) || 0,
      room_rate_override: currentRatePerNight,
      source: reservation.source || 'direct',
      guest_requests: reservation.guest_requests || '',
      internal_notes: reservation.internal_notes || '',
      requires_deposit: reservation.requires_deposit || false,
      is_group_reservation: reservation.is_group_reservation || false,
    };
    
    console.log('📋 Dados do formulário:', formData);
    reset(formData);
  };

  const loadAvailableRooms = async () => {
    if (!tenantProperty || !watchedValues.check_in_date || !watchedValues.check_out_date) return;
    
    setCheckingAvailability(true);
    
    try {
      console.log('🔍 Buscando quartos disponíveis...');
      
      // ✅ NOVA CHAMADA - Com exclude_reservation_id
      const response = await apiClient.checkAvailability({
        property_id: tenantProperty.id,
        check_in_date: watchedValues.check_in_date,
        check_out_date: watchedValues.check_out_date,
        adults: watchedValues.adults,
        children: watchedValues.children,
        exclude_reservation_id: reservation.id  // ✅ EXCLUIR RESERVA ATUAL
      });
      
      console.log('📊 Resposta da API:', response);
      
      const roomsAvailable = response.available_rooms || [];
      
      // ✅ OBTER QUARTOS ATUAIS DA RESERVA
      const currentRoomIds = reservation.rooms?.map((room: any) => room.room_id) || [];
      console.log('🔍 Quartos atuais da reserva:', currentRoomIds);
      console.log('🔍 Quartos no watch antes da seleção:', watchedValues.selected_rooms);
      
      // ✅ MARCAR QUARTOS ATUAIS
      roomsAvailable.forEach((room: any) => {
        if (currentRoomIds.includes(room.id)) {
          room.isCurrentReservation = true;
        }
      });
      
      console.log('🏠 Quartos disponíveis (incluindo atual):', roomsAvailable);
      setAvailableRooms(roomsAvailable);
      
      // ✅ AUTO-SELECIONAR FORÇADAMENTE - Sempre selecionar o quarto atual
      if (currentRoomIds.length > 0) {
        const availableRoomIds = roomsAvailable.map((room: any) => room.id);
        const validRoomIds = currentRoomIds.filter(id => availableRoomIds.includes(id));
        
        if (validRoomIds.length > 0) {
          console.log('🎯 Auto-selecionando quarto atual (forçado):', validRoomIds);
          setValue('selected_rooms', validRoomIds);
          
          // ✅ VERIFICAR SE A SELEÇÃO FUNCIONOU
          setTimeout(() => {
            const currentSelected = getValues('selected_rooms');
            console.log('✅ Quartos selecionados após setValue:', currentSelected);
          }, 100);
        } else {
          console.warn('⚠️ Nenhum quarto atual encontrado na lista de disponíveis');
        }
      } else {
        console.warn('⚠️ Reserva não tem quartos definidos');
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao verificar disponibilidade:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar quartos disponíveis",
        variant: "destructive",
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const calculateNights = () => {
    if (!watchedValues.check_in_date || !watchedValues.check_out_date) return 0;
    const checkIn = new Date(watchedValues.check_in_date + 'T00:00:00');
    const checkOut = new Date(watchedValues.check_out_date + 'T00:00:00');
    return differenceInDays(checkOut, checkIn);
  };

  const calculateTotal = () => {
    const nights = calculateNights();
    if (!nights || watchedValues.selected_rooms.length === 0) return 0;
    
    let total = 0;
    watchedValues.selected_rooms.forEach(roomId => {
      const room = availableRooms.find((r: any) => r.id === roomId);
      if (room) {
        const rate = watchedValues.room_rate_override || room.rate_per_night || 0;
        total += rate * nights;
      }
    });
    
    return total;
  };

  const handleTotalAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setValue('total_amount', numValue);
    
    if (numValue > 0) {
      const nights = calculateNights();
      const numRooms = watchedValues.selected_rooms.length;
      
      if (nights > 0 && numRooms > 0) {
        const ratePerNight = numValue / (nights * numRooms);
        setValue('room_rate_override', Math.round(ratePerNight * 100) / 100);
      }
    } else {
      setValue('room_rate_override', undefined);
    }
  };

  const handleRoomRateChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setValue('room_rate_override', numValue);
    
    if (numValue > 0) {
      const nights = calculateNights();
      const numRooms = watchedValues.selected_rooms.length;
      
      if (nights > 0 && numRooms > 0) {
        const totalAmount = numValue * nights * numRooms;
        setValue('total_amount', Math.round(totalAmount * 100) / 100);
      }
    } else {
      setValue('total_amount', undefined);
    }
  };

  const handleDateChange = (type: 'checkin' | 'checkout', dateString: string) => {
    if (!dateString) return;
    
    console.log(`📅 Alterando ${type}:`, dateString);
    
    if (type === 'checkin') {
      setValue('check_in_date', dateString);
      
      // Auto-ajustar check-out se necessário
      const checkIn = new Date(dateString + 'T00:00:00');
      const currentCheckOut = watchedValues.check_out_date ? new Date(watchedValues.check_out_date + 'T00:00:00') : null;
      
      if (!currentCheckOut || checkIn >= currentCheckOut) {
        const newCheckOut = addDays(checkIn, 1);
        const newCheckOutString = format(newCheckOut, 'yyyy-MM-dd');
        setValue('check_out_date', newCheckOutString);
      }
    } else {
      setValue('check_out_date', dateString);
    }
    
    // Reset seleção de quartos para recarregar
    setValue('selected_rooms', []);
  };

  const onSubmit = async (data: EditReservationFormData) => {
    try {
      setLoading(true);
      console.log('💾 Salvando reserva com dados:', data);

      const reservationData = {
        property_id: data.property_id,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        adults: data.adults,
        children: data.children,
        total_amount: data.total_amount || calculateTotal(),
        source: data.source || 'direct',
        guest_requests: data.guest_requests,
        internal_notes: data.internal_notes,
        requires_deposit: data.requires_deposit || false,
        is_group_reservation: data.is_group_reservation || false,
        
        rooms: data.selected_rooms.map(roomId => ({
          room_id: roomId,
          check_in_date: data.check_in_date,
          check_out_date: data.check_out_date,
          rate_per_night: data.room_rate_override || undefined,
        })),
      };

      console.log('📤 Enviando para API:', reservationData);
      await apiClient.updateReservation(reservation.id, reservationData);
      
      toast({
        title: "Sucesso",
        description: "Reserva atualizada com sucesso",
      });

      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('❌ Erro ao salvar reserva:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao salvar reserva',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ===== VERIFICAÇÕES DE ERRO =====
  
  if (propertyError && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!w-[500px] !max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-red-600">
              <AlertCircle className="h-5 w-5" />
              Erro - Propriedade Necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{propertyError}</AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!reservation) return null;

  // ===== RENDER PRINCIPAL =====

  const sourceOptions = [
    { value: 'direct', label: 'Direto' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'E-mail' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'room_map', label: 'Mapa de Quartos' },
  ];

  const nights = calculateNights();
  const estimatedTotal = calculateTotal();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!w-[750px] !max-w-[750px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg mb-4">
            <BedDouble className="h-4 w-4" />
            Editar Reserva #{reservation.reservation_number}
          </DialogTitle>
        </DialogHeader>

        {loadingProperty ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando propriedade...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-3">
            
            {/* Banner da propriedade */}
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
            
            {/* Informações do Hóspede (Readonly) */}
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-gray-600" />
                  <Label className="text-sm font-medium text-gray-700">Hóspede</Label>
                  <Badge variant="secondary" className="text-xs">Não editável</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{reservation.guest?.full_name || 'N/A'}</span>
                  </div>
                  {reservation.guest?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{reservation.guest.email}</span>
                    </div>
                  )}
                  {reservation.guest?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{reservation.guest.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Informações da Reserva */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Informações da Reserva
              </h3>

              {/* Canal de Origem */}
              <div className="grid grid-cols-1 gap-4 px-2">
                <div>
                  <Label htmlFor="source" className="text-sm font-medium">Canal</Label>
                  <div className="mt-1 p-1">
                    <select
                      value={watchedValues.source || ''}
                      onChange={(e) => setValue('source', e.target.value)}
                      disabled={loading}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o canal</option>
                      {sourceOptions.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Datas e Hóspedes */}
              <div className="grid grid-cols-4 gap-4 px-2">
                <div>
                  <Label className="text-sm font-medium">Check-in *</Label>
                  <div className="mt-1 p-1">
                    <Input
                      type="date"
                      value={watchedValues.check_in_date || ''}
                      onChange={(e) => handleDateChange('checkin', e.target.value)}
                      disabled={loading}
                      className="text-sm h-9"
                    />
                  </div>
                  {errors.check_in_date && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.check_in_date.message}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">Check-out *</Label>
                  <div className="mt-1 p-1">
                    <Input
                      type="date"
                      value={watchedValues.check_out_date || ''}
                      onChange={(e) => handleDateChange('checkout', e.target.value)}
                      disabled={loading}
                      className="text-sm h-9"
                    />
                  </div>
                  {errors.check_out_date && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.check_out_date.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="adults" className="text-sm font-medium">Adultos *</Label>
                  <div className="mt-1 p-1">
                    <Input
                      {...register('adults', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="10"
                      disabled={loading}
                      className="text-sm h-9"
                    />
                  </div>
                  {errors.adults && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.adults.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="children" className="text-sm font-medium">Crianças</Label>
                  <div className="mt-1 p-1">
                    <Input
                      {...register('children', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="10"
                      disabled={loading}
                      className="text-sm h-9"
                    />
                  </div>
                  {errors.children && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.children.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Seleção de Quarto */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Bed className="h-4 w-4" />
                  Quarto
                </h3>
                {checkingAvailability && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              {availableRooms.length > 0 ? (
                <div className="px-2">
                  <Label className="text-sm font-medium">Selecione o quarto *</Label>
                  <div className="mt-1 p-1">
                    <select
                      value={watchedValues.selected_rooms[0] || ''}
                      onChange={(e) => {
                        const roomId = parseInt(e.target.value);
                        setValue('selected_rooms', roomId ? [roomId] : []);
                      }}
                      disabled={loading}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um quarto</option>
                      {availableRooms.map((room: any) => (
                        <option key={`room-${room.id}`} value={room.id}>
                          Quarto {room.room_number} - {room.room_type_name || 'Quarto'} (até {room.max_occupancy} pessoas)
                          {room.rate_per_night ? ` - R$ ${room.rate_per_night}/noite` : ''}
                          {room.isCurrentReservation ? ' [ATUAL]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.selected_rooms && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.selected_rooms.message}</p>
                  )}
                </div>
              ) : checkingAvailability ? (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Verificando disponibilidade...</p>
                </div>
              ) : (
                <div className="p-3 mx-2 rounded-md border bg-yellow-50 border-yellow-200 text-yellow-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Carregando quartos disponíveis...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Valores e Observações */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6 px-2">
                {/* Resumo */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Resumo</Label>
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-xs space-y-2">
                      <div className="flex justify-between">
                        <span>Quartos:</span>
                        <span className="font-medium">{watchedValues.selected_rooms.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Noites:</span>
                        <span className="font-medium">{nights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hóspedes:</span>
                        <span className="font-medium">{(watchedValues.adults || 0) + (watchedValues.children || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-sm border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span className="text-green-600">R$ {estimatedTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campos de Valor */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="total_amount" className="text-sm font-medium">Valor Total (R$)</Label>
                    <div className="mt-1 p-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={estimatedTotal.toFixed(2)}
                        disabled={loading}
                        value={watchedValues.total_amount || ''}
                        onChange={(e) => handleTotalAmountChange(e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="room_rate_override" className="text-sm font-medium">Taxa/Noite (R$)</Label>
                    <div className="mt-1 p-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Personalizar"
                        disabled={loading}
                        value={watchedValues.room_rate_override || ''}
                        onChange={(e) => handleRoomRateChange(e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="grid grid-cols-2 gap-4 px-2">
                <div>
                  <Label htmlFor="guest_requests" className="text-sm font-medium">Pedidos do Hóspede</Label>
                  <div className="mt-1 p-1">
                    <Textarea
                      {...register('guest_requests')}
                      placeholder="Pedidos especiais..."
                      disabled={loading}
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="internal_notes" className="text-sm font-medium">Notas Internas</Label>
                  <div className="mt-1 p-1">
                    <Textarea
                      {...register('internal_notes')}
                      placeholder="Observações internas..."
                      disabled={loading}
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={loading}
                className="h-9 px-4 text-sm"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || loadingProperty}
                className="min-w-[120px] h-9 px-4 text-sm"
              >
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Atualizar Reserva
              </Button>
            </DialogFooter>

          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}