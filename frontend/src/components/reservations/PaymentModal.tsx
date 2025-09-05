// frontend/src/components/reservations/PaymentModal.tsx

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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';
import { 
  PaymentMethodEnum, 
  PAYMENT_METHOD_LABELS,
  PaymentCreate 
} from '@/types/payment';

// ===== SCHEMA SIMPLIFICADO =====
const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  payment_method: z.nativeEnum(PaymentMethodEnum),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// ===== INTERFACES =====
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reservationId: number;
  reservationNumber?: string;
  totalAmount?: number;
  balanceDue?: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  reservationId,
  reservationNumber,
  totalAmount = 0,
  balanceDue = 0
}: PaymentModalProps) {
  // ===== HOOKS =====
  const { toast } = useToast();

  // ===== ESTADOS =====
  const [loading, setLoading] = useState(false);

  // ===== FORM =====
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: balanceDue > 0 ? balanceDue : 0,
    },
  });

  const watchedValues = watch();

  // ===== HANDLERS =====
  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);

    try {
      // Preparar dados para envio (simplificado)
      const paymentData: PaymentCreate = {
        reservation_id: reservationId,
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: new Date().toISOString(),
        is_partial: false,
      };

      console.log('📤 Enviando pagamento:', paymentData);

      // Enviar para API
      const response = await apiClient.createPayment(paymentData);

      console.log('✅ Pagamento criado:', response);

      toast({
        title: 'Pagamento registrado',
        description: `Pagamento registrado com sucesso.`,
        variant: 'default',
      });

      // Fechar modal e notificar sucesso
      handleClose();
      onSuccess();

    } catch (error: any) {
      console.error('❌ Erro ao criar pagamento:', error);
      
      const errorMessage = error?.response?.data?.detail || 
                          error?.message || 
                          'Erro ao registrar pagamento';

      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ===== UTILITÁRIOS =====
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Informações da Reserva */}
          {(totalAmount > 0 || balanceDue > 0) && (
            <Alert>
              <AlertDescription>
                <div className="space-y-1 text-sm">
                  {totalAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Valor total da reserva:</span>
                      <span className="font-medium">{formatCurrency(totalAmount)}</span>
                    </div>
                  )}
                  {balanceDue > 0 && (
                    <div className="flex justify-between">
                      <span>Saldo devedor:</span>
                      <span className="font-medium text-red-600">{formatCurrency(balanceDue)}</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Valor do Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Valor do Pagamento *
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              disabled={loading}
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">
              Método de Pagamento *
            </Label>
            <select
              id="payment_method"
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('payment_method')}
            >
              <option value="">Selecione o método</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.payment_method && (
              <p className="text-sm text-red-500">{errors.payment_method.message}</p>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="gap-3 pt-4 border-t">
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
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Registrar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}