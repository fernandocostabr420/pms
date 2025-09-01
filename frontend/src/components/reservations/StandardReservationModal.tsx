// frontend/src/components/reservations/StandardReservationModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Imports básicos que sabemos que existem
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Imports condicionais - usa fallbacks se não existirem
let Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter;
let Popover, PopoverContent, PopoverTrigger;
let Calendar;
let Select, SelectContent, SelectItem, SelectTrigger, SelectValue;
let Badge, Card, CardContent, Alert, AlertDescription, Checkbox;

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
  const selectComponents = require('@/components/ui/select');
  Select = selectComponents.Select;
  SelectContent = selectComponents.SelectContent;
  SelectItem = selectComponents.SelectItem;
  SelectTrigger = selectComponents.SelectTrigger;
  SelectValue = selectComponents.SelectValue;
} catch (e) {
  Select = ({ value, onValueChange, children }) => <div className="relative">{children}</div>;
  SelectTrigger = ({ children, className }) => <button className={`w-full p-2 border rounded text-left ${className || ''}`}>{children}</button>;
  SelectValue = ({ placeholder }) => <span className="text-gray-500">{placeholder}</span>;
  SelectContent = ({ children }) => <div className="absolute top-full left-0 right-0 bg-white border rounded shadow-lg z-50 max-h-60 overflow-y-auto">{children}</div>;
  SelectItem = ({ value, children, onSelect }) => <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => onSelect && onSelect(value)}>{children}</div>;
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

try {
  const checkboxComponents = require('@/components/ui/checkbox');
  Checkbox = checkboxComponents.Checkbox;
} catch (e) {
  Checkbox = ({ checked, onCheckedChange, disabled, id }) => (
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)} 
      disabled={disabled}
      id={id}
      className="rounded border-gray-300"
    />
  );
}

// Icons
import { 
  CalendarIcon, 
  Users, 
  Search,
  Plus,
  Trash2,
  AlertCircle,
  User,
  Building,
  Bed,
  Phone,
  Mail,
  DollarSign,
  Loader2
} from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ===== SCHEMA UNIFICADO =====
const standardReservationSchema = z.object({
  // Método de seleção do hóspede
  guest_mode: z.enum(['existing', 'new']), // 'existing' = usar guest_id, 'new' = criar novo
  
  // Dados do hóspede existente (modo 'existing')
  guest_id: z.number().optional(),
  
  // Dados do novo hóspede (modo 'new')
  guest_name: z.string().optional(),
  guest_email: z.string().email('Email inválido').optional().or(z.literal('')),
  guest_phone: z.string().optional(),
  
  // Dados da reserva (obrigatórios sempre)
  property_id: z.number().min(1, 'Selecione uma propriedade'),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  adults: z.number().min(1, 'Mínimo 1 adulto').max(10, 'Máximo 10 adultos'),
  children: z.number().min(0, 'Mínimo 0 crianças').max(10, 'Máximo 10 crianças'),
  
  // Quartos
  selected_rooms: z.array(z.number()).min(1, 'Selecione pelo menos 1 quarto'),
  
  // Valores
  total_amount: z.number().min(0, 'Valor deve ser positivo').optional(),
  room_rate_override: z.number().min(0, 'Taxa deve ser positiva').optional(),
  
  // Observações
  guest_requests: z.string().optional(), // Pedidos do hóspede
  internal_notes: z.string().optional(), // Notas internas
  
  // Configurações
  source: z.string().optional(),
  requires_deposit: z.boolean().optional(),
  is_group_reservation: z.boolean().optional(),
}).refine((data) => {
  // Validação condicional: se guest_mode = 'existing', guest_id é obrigatório
  if (data.guest_mode === 'existing' && !data.guest_id) {
    return false;
  }
  // Se guest_mode = 'new', guest_name é obrigatório
  if (data.guest_mode === 'new' && (!data.guest_name || data.guest_name.length < 2)) {
    return false;
  }
  return true;
}, {
  message: 'Dados do hóspede incompletos',
  path: ['guest_mode']
});

type StandardReservationFormData = z.infer<typeof standardReservationSchema>;

// ===== INTERFACES =====
interface PrefilledData {
  // Dados pré-selecionados
  property_id?: number;
  room_id?: number;        // Para modo mapa - quarto único pré-selecionado
  selected_date?: string;  // Para modo mapa - data pré-selecionada
  check_in_date?: string;
  check_out_date?: string;
  guest_id?: number;
  // Outros campos que podem vir preenchidos
  adults?: number;
  children?: number;
  source?: string;
}

interface StandardReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  
  // Configuração do modo de operação
  mode?: 'full' | 'quick' | 'map'; // full = completo, quick = rápido, map = mapa
  title?: string; // Título personalizado
  
  // Dados para edição
  reservation?: any; // Reserva existente para edição
  isEditing?: boolean;
  
  // Dados pré-preenchidos
  prefilledData?: PrefilledData;
  
  // Configurações específicas por modo
  allowGuestSelection?: boolean; // Se false, sempre cria novo hóspede
  allowMultipleRooms?: boolean;  // Se false, permite apenas 1 quarto
  showAdvancedFields?: boolean;  // Mostra campos como internal_notes, deposits, etc.
}

export default function StandardReservationModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'full',
  title,
  reservation,
  isEditing = false,
  prefilledData,
  allowGuestSelection = true,
  allowMultipleRooms = true,
  showAdvancedFields = true
}: StandardReservationModalProps) {
  
  // ===== ESTADOS =====
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  
  // Datas como objetos Date para o componente Calendar
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);

  const { toast } = useToast();

  // ===== CONFIGURAÇÃO POR MODO =====
  const modeConfig = {
    full: {
      title: 'Nova Reserva',
      allowGuestSelection: true,
      allowMultipleRooms: true,
      showAdvancedFields: true,
      defaultGuestMode: 'existing' as const
    },
    quick: {
      title: 'Reserva Rápida',
      allowGuestSelection: false, // Sempre cria novo hóspede
      allowMultipleRooms: true,
      showAdvancedFields: false,
      defaultGuestMode: 'new' as const
    },
    map: {
      title: 'Reserva Rápida',
      allowGuestSelection: false, // Sempre cria novo hóspede
      allowMultipleRooms: false,  // Apenas 1 quarto
      showAdvancedFields: false,
      defaultGuestMode: 'new' as const
    }
  };

  const config = {
    ...modeConfig[mode],
    allowGuestSelection: allowGuestSelection ?? modeConfig[mode].allowGuestSelection,
    allowMultipleRooms: allowMultipleRooms ?? modeConfig[mode].allowMultipleRooms,
    showAdvancedFields: showAdvancedFields ?? modeConfig[mode].showAdvancedFields,
    title: title ?? modeConfig[mode].title
  };

  // ===== FORM =====
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<StandardReservationFormData>({
    resolver: zodResolver(standardReservationSchema),
    defaultValues: {
      guest_mode: config.defaultGuestMode,
      adults: 1,
      children: 0,
      selected_rooms: [],
      source: mode === 'map' ? 'room_map' : 'direct',
      requires_deposit: false,
      is_group_reservation: false,
    },
  });

  const watchedValues = watch();
  const watchedGuestMode = watch('guest_mode');
  const watchedRooms = watch('selected_rooms');
  const watchedAdults = watch('adults');
  const watchedChildren = watch('children');

  // ===== EFEITOS =====
  
  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      populateInitialForm();
    }
  }, [isOpen]);

  // Carregar disponibilidade quando datas mudarem
  useEffect(() => {
    if (checkInDate && checkOutDate && selectedProperty) {
      checkRoomAvailability();
    }
  }, [checkInDate, checkOutDate, selectedProperty, watchedAdults, watchedChildren]);

  // ===== FUNÇÕES =====

  const loadInitialData = async () => {
    try {
      const [propertiesRes, guestsRes] = await Promise.all([
        apiClient.getProperties({ per_page: 100 }),
        config.allowGuestSelection ? apiClient.getGuests({ per_page: 100 }) : Promise.resolve({ guests: [] }),
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

  const populateInitialForm = () => {
    // Preencher com dados da reserva existente (edição)
    if (isEditing && reservation) {
      const formData = {
        guest_mode: 'existing' as const,
        guest_id: reservation.guest_id,
        property_id: reservation.property_id,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        adults: reservation.adults,
        children: reservation.children,
        selected_rooms: reservation.rooms?.map((room: any) => room.room_id) || [],
        total_amount: reservation.total_amount || 0,
        source: reservation.source || 'direct',
        guest_requests: reservation.guest_requests || '',
        internal_notes: reservation.internal_notes || '',
        requires_deposit: reservation.requires_deposit || false,
        is_group_reservation: reservation.is_group_reservation || false,
      };
      
      reset(formData);
      setCheckInDate(new Date(reservation.check_in_date + 'T00:00:00'));
      setCheckOutDate(new Date(reservation.check_out_date + 'T00:00:00'));
      setSelectedProperty(reservation.property_id);
      return;
    }

    // Preencher com dados pré-definidos
    if (prefilledData) {
      const formData: Partial<StandardReservationFormData> = {
        guest_mode: config.defaultGuestMode,
        ...prefilledData,
      };

      // Para modo mapa: pré-selecionar quarto único
      if (mode === 'map' && prefilledData.room_id) {
        formData.selected_rooms = [prefilledData.room_id];
      }

      reset(formData as StandardReservationFormData);
      
      if (prefilledData.check_in_date) {
        setCheckInDate(new Date(prefilledData.check_in_date + 'T00:00:00'));
      } else if (prefilledData.selected_date) {
        setCheckInDate(new Date(prefilledData.selected_date + 'T00:00:00'));
      }
      
      if (prefilledData.check_out_date) {
        setCheckOutDate(new Date(prefilledData.check_out_date + 'T00:00:00'));
      } else if (prefilledData.selected_date) {
        // Para modo mapa: check-out = check-in + 1 dia por padrão
        setCheckOutDate(addDays(new Date(prefilledData.selected_date + 'T00:00:00'), 1));
      }
      
      if (prefilledData.property_id) {
        setSelectedProperty(prefilledData.property_id);
      }
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
      
      setAvailableRooms(response.rooms || []);
      
      // Para modo mapa: manter quarto pré-selecionado se ainda disponível
      if (mode === 'map' && prefilledData?.room_id) {
        const isStillAvailable = response.rooms?.some((room: any) => room.id === prefilledData.room_id);
        if (!isStillAvailable) {
          setValue('selected_rooms', []);
          toast({
            title: "Quarto Indisponível",
            description: "O quarto selecionado não está mais disponível. Selecione outro.",
            variant: "destructive",
          });
        }
      }
      
    } catch (error: any) {
      console.error('Erro ao verificar disponibilidade:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar disponibilidade dos quartos",
        variant: "destructive",
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    return differenceInDays(checkOutDate, checkInDate);
  };

  const calculateTotal = () => {
    const nights = calculateNights();
    if (!nights || watchedRooms.length === 0) return 0;
    
    // Cálculo baseado nos quartos selecionados
    let total = 0;
    watchedRooms.forEach(roomId => {
      const room = availableRooms.find((r: any) => r.id === roomId);
      if (room) {
        const rate = watchedValues.room_rate_override || room.rate_per_night || 0;
        total += rate * nights;
      }
    });
    
    return total;
  };

  const toggleRoomSelection = (roomId: number) => {
    if (!config.allowMultipleRooms) {
      // Modo mapa: apenas 1 quarto
      setValue('selected_rooms', [roomId]);
      return;
    }
    
    const currentSelected = watchedRooms || [];
    const newSelected = currentSelected.includes(roomId)
      ? currentSelected.filter(id => id !== roomId)
      : [...currentSelected, roomId];
    setValue('selected_rooms', newSelected);
  };

  const onSubmit = async (data: StandardReservationFormData) => {
    try {
      setLoading(true);

      // Preparar dados da reserva
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
        
        // Quartos com datas
        rooms: data.selected_rooms.map(roomId => ({
          room_id: roomId,
          check_in_date: data.check_in_date,
          check_out_date: data.check_out_date,
          rate_per_night: data.room_rate_override || undefined,
        })),
      };

      let finalReservationData;

      if (data.guest_mode === 'existing') {
        // Usar hóspede existente
        finalReservationData = {
          ...reservationData,
          guest_id: data.guest_id,
        };
      } else {
        // Criar reserva com novo hóspede (quick booking)
        finalReservationData = {
          ...reservationData,
          guest_name: data.guest_name,
          guest_email: data.guest_email || undefined,
          guest_phone: data.guest_phone || undefined,
        };
      }

      // Decidir qual endpoint usar
      if (isEditing && reservation) {
        // Atualizar reserva existente
        await apiClient.updateReservation(reservation.id, finalReservationData);
        toast({
          title: "Sucesso",
          description: "Reserva atualizada com sucesso",
        });
      } else if (data.guest_mode === 'new') {
        // Criar reserva rápida (com novo hóspede)
        await apiClient.createQuickReservation(finalReservationData);
        toast({
          title: "Sucesso",
          description: "Reserva criada com sucesso",
        });
      } else {
        // Criar reserva completa (com hóspede existente)
        await apiClient.createReservation(finalReservationData);
        toast({
          title: "Sucesso",
          description: "Reserva criada com sucesso",
        });
      }

      onSuccess();
      handleClose();

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

  const handleDateChange = (type: 'checkin' | 'checkout', dateString: string) => {
    if (!dateString) return;
    
    const date = new Date(dateString + 'T00:00:00');
    
    if (type === 'checkin') {
      setCheckInDate(date);
      setValue('check_in_date', dateString);
      
      // Auto-ajustar check-out se necessário
      if (!checkOutDate || date >= checkOutDate) {
        const newCheckOut = addDays(date, 1);
        const newCheckOutString = format(newCheckOut, 'yyyy-MM-dd');
        setCheckOutDate(newCheckOut);
        setValue('check_out_date', newCheckOutString);
      }
    } else {
      setCheckOutDate(date);
      setValue('check_out_date', dateString);
    }
  };

  // ===== RENDER =====

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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'map' ? <Bed className="h-5 w-5" /> : <CalendarIcon className="h-5 w-5" />}
            {config.title}
            {isEditing && ' - Editar'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Seleção do Hóspede */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Hóspede
            </h3>

            {config.allowGuestSelection && (
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="existing_guest"
                    value="existing"
                    {...register('guest_mode')}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="existing_guest">Hóspede Existente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="new_guest"
                    value="new"
                    {...register('guest_mode')}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="new_guest">Novo Hóspede</Label>
                </div>
              </div>
            )}

            {/* Campos baseados no modo do hóspede */}
            {watchedGuestMode === 'existing' ? (
              <div>
                <Label htmlFor="guest_id">Hóspede *</Label>
                <select
                  value={watch('guest_id')?.toString() || ''}
                  onChange={(e) => setValue('guest_id', parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione o hóspede</option>
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.id.toString()}>
                      {guest.full_name} {guest.email && `- ${guest.email}`}
                    </option>
                  ))}
                </select>
                {errors.guest_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.guest_id.message}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="guest_name">Nome do Hóspede *</Label>
                  <Input
                    {...register('guest_name')}
                    placeholder="Nome completo"
                    disabled={loading}
                  />
                  {errors.guest_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guest_email">Email</Label>
                  <Input
                    {...register('guest_email')}
                    type="email"
                    placeholder="email@exemplo.com"
                    disabled={loading}
                  />
                  {errors.guest_email && (
                    <p className="text-sm text-red-600 mt-1">{errors.guest_email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="guest_phone">Telefone</Label>
                  <Input
                    {...register('guest_phone')}
                    placeholder="(11) 99999-9999"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Informações da Reserva */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informações da Reserva
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Propriedade */}
              <div>
                <Label htmlFor="property_id">Propriedade *</Label>
                <select
                  value={watch('property_id')?.toString() || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setValue('property_id', value);
                    setSelectedProperty(value);
                  }}
                  disabled={loading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecione uma propriedade</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id.toString()}>
                      {property.name}
                    </option>
                  ))}
                </select>
                {errors.property_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.property_id.message}</p>
                )}
              </div>

              {/* Canal de Origem */}
              <div>
                <Label htmlFor="source">Canal de Origem</Label>
                <select
                  value={watch('source') || ''}
                  onChange={(e) => setValue('source', e.target.value)}
                  disabled={loading}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data de Check-in *</Label>
                <Input
                  type="date"
                  value={checkInDate ? format(checkInDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleDateChange('checkin', e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  disabled={loading}
                />
                {errors.check_in_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.check_in_date.message}</p>
                )}
              </div>

              <div>
                <Label>Data de Check-out *</Label>
                <Input
                  type="date"
                  value={checkOutDate ? format(checkOutDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleDateChange('checkout', e.target.value)}
                  min={checkInDate ? format(addDays(checkInDate, 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  disabled={loading}
                />
                {errors.check_out_date && (
                  <p className="text-sm text-red-600 mt-1">{errors.check_out_date.message}</p>
                )}
              </div>
            </div>

            {/* Hóspedes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adults">Adultos *</Label>
                <Input
                  {...register('adults', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="10"
                  disabled={loading}
                />
                {errors.adults && (
                  <p className="text-sm text-red-600 mt-1">{errors.adults.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="children">Crianças</Label>
                <Input
                  {...register('children', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="10"
                  disabled={loading}
                />
                {errors.children && (
                  <p className="text-sm text-red-600 mt-1">{errors.children.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Seleção de Quartos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Bed className="h-5 w-5" />
                Quartos {config.allowMultipleRooms ? '' : '(máximo 1)'}
              </h3>
              {checkingAvailability && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {availableRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRooms.map((room: any) => {
                  const isSelected = watchedRooms.includes(room.id);
                  
                  return (
                    <div 
                      key={room.id} 
                      className={`cursor-pointer transition-colors border-2 rounded-lg p-4 ${
                        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => toggleRoomSelection(room.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4" />
                          <span className="font-medium">{room.room_number}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded border-gray-300"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>{room.room_type_name}</div>
                        <div>Até {room.max_occupancy} pessoas</div>
                        {room.rate_per_night && (
                          <div className="font-medium text-green-600 mt-1">
                            R$ {room.rate_per_night}/noite
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : checkingAvailability ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Verificando disponibilidade...</p>
              </div>
            ) : selectedProperty && checkInDate && checkOutDate ? (
              <div className="p-4 rounded border bg-red-50 border-red-200 text-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Nenhum quarto disponível para o período selecionado.
                </div>
              </div>
            ) : null}

            {errors.selected_rooms && (
              <p className="text-sm text-red-600">{errors.selected_rooms.message}</p>
            )}
          </div>

          {/* Valores e Configurações */}
          {(showAdvancedFields || watchedRooms.length > 0) && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Valores e Configurações
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resumo */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Resumo</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Quartos selecionados:</span>
                      <span>{watchedRooms.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Noites:</span>
                      <span>{nights}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total de hóspedes:</span>
                      <span>{(watchedValues.adults || 0) + (watchedValues.children || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-lg border-t pt-2 mt-2">
                      <span>Total estimado:</span>
                      <span>R$ {estimatedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Configurações de Valor */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="total_amount">Valor Total (R$)</Label>
                    <Input
                      {...register('total_amount', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={estimatedTotal.toFixed(2)}
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Deixe em branco para usar o valor calculado automaticamente
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="room_rate_override">Taxa por Noite (R$)</Label>
                    <Input
                      {...register('room_rate_override', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Sobrescrever tarifa padrão"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guest_requests">Pedidos do Hóspede</Label>
                <Textarea
                  {...register('guest_requests')}
                  placeholder="Pedidos especiais, preferências..."
                  disabled={loading}
                  rows={3}
                />
              </div>

              {showAdvancedFields && (
                <div>
                  <Label htmlFor="internal_notes">Notas Internas</Label>
                  <Textarea
                    {...register('internal_notes')}
                    placeholder="Observações para uso interno..."
                    disabled={loading}
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Configurações Avançadas */}
          {showAdvancedFields && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configurações Avançadas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requires_deposit"
                    checked={watch('requires_deposit')}
                    onChange={(e) => setValue('requires_deposit', e.target.checked)}
                    disabled={loading}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="requires_deposit">Requer Depósito</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_group_reservation"
                    checked={watch('is_group_reservation')}
                    onChange={(e) => setValue('is_group_reservation', e.target.checked)}
                    disabled={loading}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_group_reservation">Reserva em Grupo</Label>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
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
              disabled={loading || watchedRooms.length === 0}
              className="min-w-[120px]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Atualizar' : 'Criar'} Reserva
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}