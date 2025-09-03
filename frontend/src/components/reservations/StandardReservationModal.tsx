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

// Hook personalizado para propriedade única
import { useProperty } from '@/hooks/useProperty';

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
  property_id: z.number().min(1, 'Propriedade é obrigatória'),
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
  
  // ===== HOOK PERSONALIZADO PARA PROPRIEDADE ÚNICA =====
  const { property: tenantProperty, loading: loadingProperty, error: propertyError } = useProperty();
  
  // ===== ESTADOS =====
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  
  // Datas como objetos Date para o componente Calendar
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();

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
      title: 'Nova Reserva',
      allowGuestSelection: true,    // Permite escolher hóspede
      allowMultipleRooms: false,   // Apenas 1 quarto
      showAdvancedFields: false,   // Campos básicos
      defaultGuestMode: 'existing' as const
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
      adults: 2, // ✅ CORRIGIDO: Alterado de 1 para 2
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

  // Definir property_id automaticamente quando propriedade carregar
  useEffect(() => {
    if (tenantProperty && !watchedValues.property_id) {
      setValue('property_id', tenantProperty.id);
    }
  }, [tenantProperty, setValue, watchedValues.property_id]);

  // Carregar quartos disponíveis quando datas mudarem
  useEffect(() => {
    if (checkInDate && checkOutDate && tenantProperty) {
      loadAvailableRooms();
    }
  }, [checkInDate, checkOutDate, tenantProperty, watchedAdults, watchedChildren]);

  // ===== FUNÇÕES DE CÁLCULO DE PREÇOS =====
  
  const handleTotalAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setValue('total_amount', numValue);
    
    // Calcular taxa por noite automaticamente
    if (numValue > 0) {
      const nights = calculateNights();
      const numRooms = watchedRooms.length;
      
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
    
    // Calcular valor total automaticamente
    if (numValue > 0) {
      const nights = calculateNights();
      const numRooms = watchedRooms.length;
      
      if (nights > 0 && numRooms > 0) {
        const totalAmount = numValue * nights * numRooms;
        setValue('total_amount', Math.round(totalAmount * 100) / 100);
      }
    } else {
      setValue('total_amount', undefined);
    }
  };

  // ===== FUNÇÕES =====

  const loadInitialData = async () => {
    try {
      // Carregar apenas hóspedes (propriedade vem do hook useProperty)
      const shouldLoadGuests = config.allowGuestSelection || mode === 'map';
      
      if (shouldLoadGuests) {
        const guestsRes = await apiClient.getGuests({ per_page: 100 });
        setGuests(guestsRes.guests || []);
        console.log('Hóspedes carregados:', guestsRes.guests?.length || 0);
      }
      
      console.log('Modo atual:', mode);
      console.log('Config allowGuestSelection:', config.allowGuestSelection);
      
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados iniciais. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // ✅ FUNÇÃO CORRIGIDA: populateInitialForm
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
      return;
    }

    // Preencher com dados pré-definidos
    if (prefilledData) {
      // ✅ CORRIGIDO: Definir valores padrão corretos
      const formData: Partial<StandardReservationFormData> = {
        guest_mode: config.defaultGuestMode,
        adults: prefilledData.adults || 2, // Garantir padrão de 2 adultos
        children: prefilledData.children || 0,
        ...prefilledData,
      };

      // Para modo mapa: pré-selecionar quarto único
      if (mode === 'map' && prefilledData.room_id) {
        formData.selected_rooms = [prefilledData.room_id];
      }

      // ✅ CORRIGIDO: Definir datas corretamente nos estados e no formulário
      let checkInDateStr = '';
      let checkOutDateStr = '';
      
      if (prefilledData.check_in_date) {
        checkInDateStr = prefilledData.check_in_date;
        setCheckInDate(new Date(prefilledData.check_in_date + 'T00:00:00'));
      } else if (prefilledData.selected_date) {
        checkInDateStr = prefilledData.selected_date;
        setCheckInDate(new Date(prefilledData.selected_date + 'T00:00:00'));
      }
      
      if (prefilledData.check_out_date) {
        checkOutDateStr = prefilledData.check_out_date;
        setCheckOutDate(new Date(prefilledData.check_out_date + 'T00:00:00'));
      } else if (prefilledData.selected_date) {
        // Para modo mapa: check-out = check-in + 1 dia por padrão
        const nextDay = addDays(new Date(prefilledData.selected_date + 'T00:00:00'), 1);
        checkOutDateStr = format(nextDay, 'yyyy-MM-dd');
        setCheckOutDate(nextDay);
      }

      // ✅ IMPORTANTE: Definir as datas no formulário também
      formData.check_in_date = checkInDateStr;
      formData.check_out_date = checkOutDateStr;

      reset(formData as StandardReservationFormData);
      return;
    }

    // ✅ CORRIGIDO: Valores padrão quando não há prefilledData
    if (!isEditing && !prefilledData) {
      const today = new Date();
      const tomorrow = addDays(today, 1);
      
      reset({
        guest_mode: config.defaultGuestMode,
        adults: 2, // Padrão de 2 adultos
        children: 0,
        selected_rooms: [],
        source: mode === 'map' ? 'room_map' : 'direct',
        requires_deposit: false,
        is_group_reservation: false,
        check_in_date: format(today, 'yyyy-MM-dd'),
        check_out_date: format(tomorrow, 'yyyy-MM-dd'),
      });
      
      setCheckInDate(today);
      setCheckOutDate(tomorrow);
    }
  };

  // ===== BUSCAR QUARTOS DISPONÍVEIS =====
  const loadAvailableRooms = async () => {
    if (!checkInDate || !checkOutDate || !tenantProperty) return;
    
    setCheckingAvailability(true);
    try {
      const response = await apiClient.checkAvailability({
        property_id: tenantProperty.id,
        check_in_date: format(checkInDate, 'yyyy-MM-dd'),
        check_out_date: format(checkOutDate, 'yyyy-MM-dd'),
        adults: watchedAdults,
        children: watchedChildren,
      });
      
      setAvailableRooms(response.available_rooms || []);
      
      // Para modo mapa: verificar se quarto pré-selecionado ainda está disponível
      if (mode === 'map' && prefilledData?.room_id) {
        const isStillAvailable = response.available_rooms?.some((room: any) => room.id === prefilledData.room_id);
        if (!isStillAvailable) {
          setValue('selected_rooms', []);
          toast({
            title: "Quarto Ocupado",
            description: "O quarto selecionado está ocupado para o período. Selecione outro.",
            variant: "destructive",
          });
        }
      }
      
    } catch (error: any) {
      console.error('Erro ao verificar disponibilidade:', error);
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

  // ===== VERIFICAÇÕES DE ERRO =====
  
  // Se erro ao carregar propriedade
  if (propertyError && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
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
              <AlertDescription>
                {propertyError}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-gray-600">
              Para criar reservas, você precisa ter pelo menos uma propriedade cadastrada no sistema.
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="!w-[750px] !max-w-[750px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg mb-4">
            {mode === 'map' ? <Bed className="h-4 w-4" /> : <CalendarIcon className="h-4 w-4" />}
            {config.title}
            {isEditing && ' - Editar'}
          </DialogTitle>
        </DialogHeader>

        {/* Loading da propriedade */}
        {loadingProperty ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando propriedade...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-3">
            
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
            
            {/* Seleção do Hóspede */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Hóspede
              </h3>

              {/* Opções de seleção do hóspede */}
              {(config.allowGuestSelection || mode === 'map') && (
                <div className="flex gap-6 mb-4 px-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="existing_guest"
                      value="existing"
                      {...register('guest_mode')}
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <Label htmlFor="existing_guest" className="text-sm">Hóspede Existente</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="new_guest"
                      value="new"
                      {...register('guest_mode')}
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <Label htmlFor="new_guest" className="text-sm">Novo Hóspede</Label>
                  </div>
                </div>
              )}

              {/* Campos baseados no modo do hóspede */}
              {watchedGuestMode === 'existing' ? (
                <div className="px-2">
                  <Label htmlFor="guest_id" className="text-sm font-medium">Hóspede *</Label>
                  <div className="mt-1 p-1">
                    <select
                      value={watch('guest_id')?.toString() || ''}
                      onChange={(e) => setValue('guest_id', parseInt(e.target.value))}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">Selecione o hóspede</option>
                      {guests.map((guest) => (
                        <option key={guest.id} value={guest.id.toString()}>
                          {guest.full_name} {guest.email && `- ${guest.email}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.guest_id && (
                    <p className="text-xs text-red-600 mt-1 px-1">{errors.guest_id.message}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 px-2">
                  <div>
                    <Label htmlFor="guest_name" className="text-sm font-medium">Nome *</Label>
                    <div className="mt-1 p-1">
                      <Input
                        {...register('guest_name')}
                        placeholder="Nome completo"
                        disabled={loading}
                        className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {errors.guest_name && (
                      <p className="text-xs text-red-600 mt-1 px-1">{errors.guest_name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="guest_email" className="text-sm font-medium">Email</Label>
                    <div className="mt-1 p-1">
                      <Input
                        {...register('guest_email')}
                        type="email"
                        placeholder="email@exemplo.com"
                        disabled={loading}
                        className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {errors.guest_email && (
                      <p className="text-xs text-red-600 mt-1 px-1">{errors.guest_email.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="guest_phone" className="text-sm font-medium">Telefone</Label>
                    <div className="mt-1 p-1">
                      <Input
                        {...register('guest_phone')}
                        placeholder="(11) 99999-9999"
                        disabled={loading}
                        className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Informações da Reserva */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Informações da Reserva
              </h3>

              <div className="grid grid-cols-1 gap-4 px-2">
                {/* Canal de Origem */}
                <div>
                  <Label htmlFor="source" className="text-sm font-medium">Canal</Label>
                  <div className="mt-1 p-1">
                    <select
                      value={watch('source') || ''}
                      onChange={(e) => setValue('source', e.target.value)}
                      disabled={loading}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      value={checkInDate ? format(checkInDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => handleDateChange('checkin', e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      disabled={loading}
                      className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      value={checkOutDate ? format(checkOutDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => handleDateChange('checkout', e.target.value)}
                      min={checkInDate ? format(addDays(checkInDate, 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      disabled={loading}
                      className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      value={watchedRooms[0] || ''}
                      onChange={(e) => {
                        const roomId = parseInt(e.target.value);
                        if (roomId) {
                          setValue('selected_rooms', [roomId]);
                        } else {
                          setValue('selected_rooms', []);
                        }
                      }}
                      disabled={loading}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">Selecione um quarto</option>
                      {availableRooms.map((room: any) => (
                        <option key={room.id} value={room.id.toString()}>
                          Quarto {room.room_number} - {room.room_type_name} (até {room.max_occupancy} pessoas)
                          {room.rate_per_night ? ` - R$ ${room.rate_per_night}/noite` : ''}
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
              ) : tenantProperty && checkInDate && checkOutDate ? (
                <div className="p-3 mx-2 rounded-md border bg-red-50 border-red-200 text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Nenhum quarto disponível para o período selecionado.</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Valores e Observações */}
            {watchedRooms.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6 px-2">
                  {/* Resumo Compacto */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Resumo</Label>
                    <div className="border rounded-md p-3 bg-gray-50">
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span>Quartos:</span>
                          <span className="font-medium">{watchedRooms.length}</span>
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
                          value={watch('total_amount') || ''}
                          onChange={(e) => handleTotalAmountChange(e.target.value)}
                          className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                          value={watch('room_rate_override') || ''}
                          onChange={(e) => handleRoomRateChange(e.target.value)}
                          className="text-sm h-9 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                        className="text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {showAdvancedFields && (
                    <div>
                      <Label htmlFor="internal_notes" className="text-sm font-medium">Notas Internas</Label>
                      <div className="mt-1 p-1">
                        <Textarea
                          {...register('internal_notes')}
                          placeholder="Observações internas..."
                          disabled={loading}
                          rows={3}
                          className="text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <DialogFooter className="gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={loading}
                className="h-9 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || watchedRooms.length === 0 || loadingProperty}
                className="min-w-[120px] h-9 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isEditing ? 'Atualizar' : 'Criar'} Reserva
              </Button>
            </DialogFooter>

          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}