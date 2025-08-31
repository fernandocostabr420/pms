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
import { Loader2, AlertCircle } from 'lucide-react';
import { PaymentResponse, PaymentCreate, PaymentUpdate, PaymentMethodEnum, PAYMENT_METHOD_LABELS } from '@/types/payment';
import { ReservationResponse } from '@/types/reservation';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: PaymentResponse | null;
  reservationId?: number;
  onSuccess: () => void;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  payment, 
  reservationId,
  onSuccess 
}: PaymentModalProps) {
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const { toast } = useToast();

  const isEdit = !!payment;
  const modalTitle = isEdit ? 'Editar Pagamento' : 'Novo Pagamento';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
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
      
      reset({
        reservation_id: payment.reservation_id,
        amount: payment.amount,
        payment_method: payment.payment_method as PaymentMethodEnum,
        payment_date: paymentDate,
        reference_number: payment.reference_number || '',
        notes: payment.notes || '',
        internal_notes: payment.internal_notes || '',
        fee_amount: payment.fee_amount || 0,
        is_partial: payment.is_partial,
      });
    } else if (reservationId) {
      setValue('reservation_id', reservationId);
    } else {
      reset({
        payment_date: new Date().toISOString().slice(0, 16),
        is_partial: false,
      });
    }
  }, [payment, reservationId, reset, setValue]);

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

  const onSubmit = async (data: PaymentFormData) => {
    try {
      setLoading(true);
      clearErrors();

      // Converter data para ISO
      const paymentData = {
        ...data,
        payment_date: new Date(data.payment_date).toISOString(),
        fee_amount: data.fee_amount || undefined,
      };

      let response;
      if (isEdit && payment) {
        response = await apiClient.updatePayment(payment.id, paymentData as PaymentUpdate);
      } else {
        response = await apiClient.createPayment(paymentData as PaymentCreate);
      }

      if (response) {
        toast({
          title: isEdit ? "Pagamento atualizado" : "Pagamento criado",
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
          <DialogTitle>{modalTitle}</DialogTitle>
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
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEdit ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  isEdit ? 'Atualizar' : 'Criar'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}