// frontend/src/components/payments/PaymentModal.tsx
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
import { 
  Loader2, 
  AlertCircle, 
  // ✅ NOVOS ÍCONES PARA FUNCIONALIDADES ADMINISTRATIVAS
  Shield,
  AlertTriangle
} from 'lucide-react';
import { 
  PaymentResponse, 
  PaymentCreate, 
  PaymentUpdate, 
  PaymentMethodEnum, 
  PAYMENT_METHOD_LABELS,
  // ✅ NOVOS IMPORTS PARA FUNCIONALIDADES ADMINISTRATIVAS
  PaymentConfirmedUpdate,
  validateAdminReason,
  ADMIN_REASON_MIN_LENGTH,
  ADMIN_REASON_MAX_LENGTH
} from '@/types/payment';
import { ReservationResponse } from '@/types/reservation';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ✅ SCHEMA ATUALIZADO PARA SUPORTAR EDIÇÃO ADMINISTRATIVA
const paymentSchema = z.object({
  reservation_id: z.number().min(1, 'Reserva é obrigatória'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  payment_method: z.nativeEnum(PaymentMethodEnum, {
    errorMap: () => ({ message: 'Método de pagamento é obrigatório' })
  }),
  payment_date: z.string().min(1, 'Data de pagamento é obrigatória'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  fee_amount: z.number().min(0).optional(),
  is_partial: z.boolean().optional(),
});

// ✅ SCHEMA PARA EDIÇÃO ADMINISTRATIVA
const adminPaymentSchema = paymentSchema.extend({
  admin_reason: z.string()
    .min(ADMIN_REASON_MIN_LENGTH, `Justificativa deve ter pelo menos ${ADMIN_REASON_MIN_LENGTH} caracteres`)
    .max(ADMIN_REASON_MAX_LENGTH, `Justificativa deve ter no máximo ${ADMIN_REASON_MAX_LENGTH} caracteres`)
});

type PaymentFormData = z.infer<typeof paymentSchema>;
type AdminPaymentFormData = z.infer<typeof adminPaymentSchema>;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: PaymentResponse | null;
  reservationId?: number;
  onSuccess: () => void;
  // ✅ NOVAS PROPS PARA FUNCIONALIDADES ADMINISTRATIVAS
  isAdminMode?: boolean;
  isAdmin?: boolean;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  payment, 
  reservationId,
  onSuccess,
  // ✅ NOVAS PROPS
  isAdminMode = false,
  isAdmin = false
}: PaymentModalProps) {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const { toast } = useToast();

  const isEdit = !!payment;
  const isConfirmedPayment = payment?.status === 'confirmed';
  const requiresAdminReason = isAdminMode && isConfirmedPayment;
  
  // ✅ TÍTULO DINÂMICO BASEADO NO MODO
  const getModalTitle = () => {
    if (isEdit) {
      if (isAdminMode && isConfirmedPayment) {
        return 'Editar Pagamento Confirmado (Administrador)';
      }
      return 'Editar Pagamento';
    }
    return 'Novo Pagamento';
  };

  const modalTitle = getModalTitle();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<AdminPaymentFormData>({
    resolver: zodResolver(requiresAdminReason ? adminPaymentSchema : paymentSchema),
    defaultValues: {
      payment_date: new Date().toISOString().slice(0, 16), // yyyy-MM-ddTHH:mm
      is_partial: false,
    }
  });

  // Carregar dados quando modal abre
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Resetar form quando payment muda
  useEffect(() => {
    if (payment) {
      // Converter data para formato datetime-local
      const paymentDate = new Date(payment.payment_date).toISOString().slice(0, 16);
      
      const formData: Partial<AdminPaymentFormData> = {
        reservation_id: payment.reservation_id,
        amount: payment.amount,
        payment_method: payment.payment_method as PaymentMethodEnum,
        payment_date: paymentDate,
        reference_number: payment.reference_number || '',
        notes: payment.notes || '',
        internal_notes: payment.internal_notes || '',
        fee_amount: payment.fee_amount || 0,
        is_partial: payment.is_partial,
      };

      // ✅ LIMPAR JUSTIFICATIVA ADMINISTRATIVA AO CARREGAR PAGAMENTO
      if (requiresAdminReason) {
        formData.admin_reason = '';
      }

      reset(formData);
    } else if (reservationId) {
      setValue('reservation_id', reservationId);
    } else {
      reset({
        payment_date: new Date().toISOString().slice(0, 16),
        is_partial: false,
      });
    }
  }, [payment, reservationId, reset, setValue, requiresAdminReason]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      
      // Carregar reservas para o select
      const reservationsData = await apiClient.getReservations({ 
        per_page: 100,
        status: 'confirmed,checked_in'
      });
      setReservations(reservationsData.reservations);

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

  const onSubmit = async (data: AdminPaymentFormData) => {
    try {
      setLoading(true);
      clearErrors();

      // Converter data para ISO
      const basePaymentData = {
        ...data,
        payment_date: new Date(data.payment_date).toISOString(),
        fee_amount: data.fee_amount || undefined,
      };

      let response;

      if (isEdit && payment) {
        // ✅ LÓGICA PARA EDIÇÃO ADMINISTRATIVA
        if (isAdminMode && isConfirmedPayment && data.admin_reason) {
          // Validar justificativa administrativa
          const reasonValidation = validateAdminReason(data.admin_reason);
          if (!reasonValidation.valid) {
            toast({
              title: "Erro na justificativa",
              description: reasonValidation.error,
              variant: "destructive",
            });
            return;
          }

          const adminData: PaymentConfirmedUpdate = {
            ...basePaymentData,
            admin_reason: data.admin_reason
          };

          // Usar endpoint específico para pagamentos confirmados
          response = await apiClient.updateConfirmedPayment(payment.id, adminData);
        } else {
          // Edição normal
          response = await apiClient.updatePayment(payment.id, basePaymentData as PaymentUpdate);
        }
      } else {
        // Criação normal
        response = await apiClient.createPayment(basePaymentData as PaymentCreate);
      }

      if (response) {
        const successMessage = isEdit 
          ? (isAdminMode ? 'Pagamento confirmado atualizado' : 'Pagamento atualizado')
          : 'Pagamento criado';
          
        toast({
          title: successMessage,
          description: `O pagamento foi ${isEdit ? 'atualizado' : 'criado'} com sucesso.`,
        });
        onSuccess();
        onClose();
      }

    } catch (error: any) {
      console.error('Erro ao salvar pagamento:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || `Erro ao ${isEdit ? 'atualizar' : 'criar'} pagamento`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setTimeout(() => reset(), 100);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAdminMode && <Shield className="h-5 w-5 text-orange-600" />}
            {modalTitle}
          </DialogTitle>
          {/* ✅ AVISO PARA MODO ADMINISTRATIVO */}
          {isAdminMode && isConfirmedPayment && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                <strong>Atenção:</strong> Você está editando um pagamento confirmado. Esta operação requer justificativa 
                obrigatória e será registrada no log de auditoria.
              </AlertDescription>
            </Alert>
          )}
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
            {/* Reserva */}
            <div className="space-y-2">
              <Label htmlFor="reservation_id">Reserva *</Label>
              <Select 
                value={watch('reservation_id')?.toString()} 
                onValueChange={(value) => setValue('reservation_id', parseInt(value))}
                disabled={loading || isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar reserva" />
                </SelectTrigger>
                <SelectContent>
                  {reservations.map((reservation) => (
                    <SelectItem key={reservation.id} value={reservation.id.toString()}>
                      #{reservation.reservation_number} - {reservation.guest_name} 
                      ({reservation.check_in_date} - {reservation.check_out_date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reservation_id && (
                <p className="text-sm text-red-600">{errors.reservation_id.message}</p>
              )}
            </div>

            {/* Valor e Taxa */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  {...register('amount', { valueAsNumber: true })}
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  disabled={loading}
                />
                {errors.amount && (
                  <p className="text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fee_amount">Taxa (R$)</Label>
                <Input
                  {...register('fee_amount', { valueAsNumber: true })}
                  id="fee_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  disabled={loading}
                />
                {errors.fee_amount && (
                  <p className="text-sm text-red-600">{errors.fee_amount.message}</p>
                )}
              </div>
            </div>

            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pagamento *</Label>
              <Select 
                value={watch('payment_method')} 
                onValueChange={(value) => setValue('payment_method', value as PaymentMethodEnum)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar método" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_method && (
                <p className="text-sm text-red-600">{errors.payment_method.message}</p>
              )}
            </div>

            {/* Data de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payment_date">Data e Hora do Pagamento *</Label>
              <Input
                {...register('payment_date')}
                id="payment_date"
                type="datetime-local"
                disabled={loading}
              />
              {errors.payment_date && (
                <p className="text-sm text-red-600">{errors.payment_date.message}</p>
              )}
            </div>

            {/* Número de Referência */}
            <div className="space-y-2">
              <Label htmlFor="reference_number">Número de Referência</Label>
              <Input
                {...register('reference_number')}
                id="reference_number"
                placeholder="Ex: TID123456, DOC789"
                disabled={loading}
              />
              {errors.reference_number && (
                <p className="text-sm text-red-600">{errors.reference_number.message}</p>
              )}
            </div>

            {/* Pagamento Parcial */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_partial"
                checked={watch('is_partial')}
                onCheckedChange={(checked) => setValue('is_partial', checked)}
                disabled={loading}
              />
              <Label htmlFor="is_partial">Pagamento parcial</Label>
            </div>

            {/* ✅ JUSTIFICATIVA ADMINISTRATIVA (OBRIGATÓRIA PARA PAGAMENTOS CONFIRMADOS) */}
            {requiresAdminReason && (
              <div className="space-y-2">
                <Label htmlFor="admin_reason" className="text-orange-700 font-medium">
                  Justificativa Administrativa *
                </Label>
                <Textarea
                  {...register('admin_reason')}
                  id="admin_reason"
                  placeholder="Descreva detalhadamente o motivo para editar este pagamento confirmado..."
                  rows={4}
                  disabled={loading}
                  className="border-orange-200 focus:border-orange-400"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Mínimo {ADMIN_REASON_MIN_LENGTH} caracteres</span>
                  <span>{watch('admin_reason')?.length || 0}/{ADMIN_REASON_MAX_LENGTH}</span>
                </div>
                {errors.admin_reason && (
                  <p className="text-sm text-red-600">{errors.admin_reason.message}</p>
                )}
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                {...register('notes')}
                id="notes"
                placeholder="Observações sobre o pagamento..."
                rows={3}
                disabled={loading}
              />
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
            </div>

            {/* Notas Internas */}
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Notas Internas</Label>
              <Textarea
                {...register('internal_notes')}
                id="internal_notes"
                placeholder="Notas internas (não visíveis para hóspedes)..."
                rows={2}
                disabled={loading}
              />
              {errors.internal_notes && (
                <p className="text-sm text-red-600">{errors.internal_notes.message}</p>
              )}
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
              <Button type="submit" disabled={loading} className={isAdminMode ? "bg-orange-600 hover:bg-orange-700" : ""}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEdit ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  <>
                    {isAdminMode && <Shield className="mr-2 h-4 w-4" />}
                    {isEdit ? 'Atualizar' : 'Criar'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}