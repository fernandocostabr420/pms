// frontend/src/components/payments/PaymentCancelModal.tsx
'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  AlertTriangle,
  XCircle,
  DollarSign,
  Calendar,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  PaymentResponse, 
  PaymentStatusEnum,
  PAYMENT_METHOD_LABELS,
  PaymentMethodEnum
} from '@/types/payment';
import { useToast } from '@/hooks/use-toast';

const cancelPaymentSchema = z.object({
  notes: z.string().min(10, 'Motivo do cancelamento deve ter pelo menos 10 caracteres').max(500, 'Motivo deve ter no máximo 500 caracteres'),
});

type CancelPaymentFormData = z.infer<typeof cancelPaymentSchema>;

interface PaymentCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentResponse | null;
  onSuccess: (updatedPayment: PaymentResponse) => void;
}

export default function PaymentCancelModal({ 
  isOpen, 
  onClose, 
  payment,
  onSuccess
}: PaymentCancelModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<CancelPaymentFormData>({
    resolver: zodResolver(cancelPaymentSchema),
    defaultValues: {
      notes: '',
    }
  });

  if (!payment) return null;

  const canCancel = payment.status === 'pending' || payment.status === 'confirmed';
  const paymentDate = format(new Date(payment.payment_date), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethodEnum] || payment.payment_method;

  const onSubmit = async (data: CancelPaymentFormData) => {
    if (!canCancel) {
      toast({
        title: "Não é possível cancelar",
        description: "Este pagamento não pode ser cancelado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const apiClient = (await import('@/lib/api')).default;
      
      // Usar API para atualizar status para cancelado
      const response = await apiClient.updatePaymentStatus(payment.id, {
        status: PaymentStatusEnum.CANCELLED,
        notes: data.notes
      });

      if (response) {
        toast({
          title: "Pagamento cancelado",
          description: `Pagamento #${response.payment_number} foi cancelado com sucesso.`,
        });
        
        onSuccess(response);
        onClose();
        reset();
      }

    } catch (error: any) {
      console.error('Erro ao cancelar pagamento:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao cancelar pagamento',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      reset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Cancelar Pagamento
          </DialogTitle>
        </DialogHeader>

        {/* Informações do pagamento */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">#{payment.payment_number}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Valor</div>
                <div className="font-medium">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              
              <div>
                <div className="text-gray-500">Método</div>
                <div className="font-medium flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {methodLabel}
                </div>
              </div>
              
              <div>
                <div className="text-gray-500">Data</div>
                <div className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {paymentDate}
                </div>
              </div>
              
              <div>
                <div className="text-gray-500">Reserva</div>
                <div className="font-medium">#{payment.reservation_id}</div>
              </div>
            </div>
          </div>

          {/* Aviso sobre cancelamento */}
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              <strong>Atenção:</strong> O cancelamento de um pagamento irá alterar seu status para "Cancelado" 
              e esta ação não poderá ser desfeita facilmente. Certifique-se de que deseja prosseguir.
            </AlertDescription>
          </Alert>

          {/* Aviso se não pode cancelar */}
          {!canCancel && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este pagamento não pode ser cancelado. Apenas pagamentos pendentes ou confirmados 
                podem ser cancelados.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {canCancel && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Motivo do cancelamento */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-red-700 font-medium">
                Motivo do Cancelamento *
              </Label>
              <Textarea
                {...register('notes')}
                id="notes"
                placeholder="Descreva o motivo pelo qual este pagamento está sendo cancelado..."
                rows={4}
                disabled={loading}
                className="border-red-200 focus:border-red-400"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Mínimo 10 caracteres</span>
                <span>{watch('notes')?.length || 0}/500</span>
              </div>
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar Pagamento
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