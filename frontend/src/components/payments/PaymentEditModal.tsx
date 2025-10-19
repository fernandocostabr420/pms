// frontend/src/components/payments/PaymentEditModal.tsx
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
  AlertTriangle,
  Shield,
  Edit2,
  DollarSign
} from 'lucide-react';
import { 
  PaymentResponse, 
  PaymentUpdate,
  PaymentConfirmedUpdate,
  validateAdminReason,
  ADMIN_REASON_MIN_LENGTH,
  ADMIN_REASON_MAX_LENGTH
} from '@/types/payment';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';

// 🆕 Interface para métodos de pagamento dinâmicos
interface PaymentMethodOption {
  code: string;
  name: string;
  is_active: boolean;
  requires_reference?: boolean;
  has_fees?: boolean;
  icon?: string;
  color?: string;
}

// Schema único que sempre inclui admin_reason (será validado condicionalmente)
const editPaymentSchema = z.object({
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  payment_method: z.string().min(1, 'Método de pagamento é obrigatório'),
  payment_date: z.string().min(1, 'Data de pagamento é obrigatória'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  fee_amount: z.number().min(0).optional(),
  is_partial: z.boolean().optional(),
  admin_reason: z.string().optional(), // Sempre opcional no schema, validação manual
});

type EditPaymentFormData = z.infer<typeof editPaymentSchema>;

interface PaymentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentResponse | null;
  onSuccess: (updatedPayment: PaymentResponse) => void;
  isAdmin?: boolean;
}

export default function PaymentEditModal({ 
  isOpen, 
  onClose, 
  payment,
  onSuccess,
  isAdmin = false
}: PaymentEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const { toast } = useToast();

  // Sempre chamar useForm primeiro, sem condições
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors
  } = useForm<EditPaymentFormData>({
    resolver: zodResolver(editPaymentSchema),
    defaultValues: {
      amount: 0,
      payment_method: '',
      payment_date: new Date().toISOString().slice(0, 16),
      reference_number: '',
      notes: '',
      internal_notes: '',
      fee_amount: 0,
      is_partial: false,
      admin_reason: '',
    }
  });

  // 🆕 Carregar métodos de pagamento dinâmicos
  const loadPaymentMethods = async () => {
    try {
      setLoadingMethods(true);
      console.log('🔄 Carregando métodos de pagamento para edição...');
      
      const response = await apiClient.get('/payment-methods/active');
      const methods = response.data || [];
      
      console.log('✅ Métodos carregados para edição:', methods);
      setPaymentMethods(methods);
      
    } catch (error: any) {
      console.error('❌ Erro ao carregar métodos de pagamento:', error);
      
      // 🔄 Fallback para métodos estáticos em caso de erro
      const fallbackMethods: PaymentMethodOption[] = [
        { code: 'pix', name: 'PIX', is_active: true },
        { code: 'credit_card', name: 'Cartão de Crédito', is_active: true },
        { code: 'debit_card', name: 'Cartão de Débito', is_active: true },
        { code: 'cash', name: 'Dinheiro', is_active: true },
        { code: 'bank_transfer', name: 'Transferência Bancária', is_active: true },
        { code: 'boleto', name: 'Boleto Bancário', is_active: true },
      ];
      
      setPaymentMethods(fallbackMethods);
      
      toast({
        title: 'Aviso',
        description: 'Usando métodos de pagamento padrão. Alguns métodos podem não estar disponíveis.',
        variant: 'default',
      });
    } finally {
      setLoadingMethods(false);
    }
  };

  // Carregar métodos de pagamento quando modal abre
  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  // Resetar form quando payment muda - HOOK SEMPRE CHAMADO
  useEffect(() => {
    if (payment && isOpen) {
      const paymentDate = new Date(payment.payment_date).toISOString().slice(0, 16);
      
      reset({
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_date: paymentDate,
        reference_number: payment.reference_number || '',
        notes: payment.notes || '',
        internal_notes: payment.internal_notes || '',
        fee_amount: payment.fee_amount || 0,
        is_partial: payment.is_partial,
        admin_reason: '',
      });
    }
  }, [payment, isOpen, reset]);

  // Depois de TODOS os hooks, fazer verificações
  if (!payment) {
    return null;
  }

  const isConfirmed = payment.status === 'confirmed';
  const requiresAdminReason = isConfirmed && isAdmin;
  const canEdit = !isConfirmed || (isConfirmed && isAdmin);

  const onSubmit = async (data: EditPaymentFormData) => {
    if (!payment || !canEdit) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para editar este pagamento.",
        variant: "destructive",
      });
      return;
    }

    // Validação condicional da justificativa administrativa
    if (requiresAdminReason) {
      if (!data.admin_reason || data.admin_reason.trim().length < ADMIN_REASON_MIN_LENGTH) {
        toast({
          title: "Justificativa obrigatória",
          description: `Justificativa deve ter pelo menos ${ADMIN_REASON_MIN_LENGTH} caracteres`,
          variant: "destructive",
        });
        return;
      }

      const reasonValidation = validateAdminReason(data.admin_reason);
      if (!reasonValidation.valid) {
        toast({
          title: "Erro na justificativa",
          description: reasonValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);
      clearErrors();

      // Converter data para ISO
      const basePaymentData = {
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: new Date(data.payment_date).toISOString(),
        reference_number: data.reference_number || undefined,
        notes: data.notes || undefined,
        internal_notes: data.internal_notes || undefined,
        fee_amount: data.fee_amount || undefined,
        is_partial: data.is_partial,
      };

      let response;

      if (requiresAdminReason && data.admin_reason) {
        const adminData: PaymentConfirmedUpdate = {
          ...basePaymentData,
          admin_reason: data.admin_reason
        };

        // Usar API client para edição administrativa
        const apiClient = (await import('@/lib/api')).default;
        response = await apiClient.updateConfirmedPayment(payment.id, adminData);
      } else {
        // Edição normal
        const apiClient = (await import('@/lib/api')).default;
        response = await apiClient.updatePayment(payment.id, basePaymentData as PaymentUpdate);
      }

      if (response) {
        const successMessage = requiresAdminReason 
          ? 'Pagamento confirmado atualizado'
          : 'Pagamento atualizado';
          
        toast({
          title: successMessage,
          description: `Pagamento #${response.payment_number} foi atualizado com sucesso.`,
        });
        
        onSuccess(response);
        onClose();
      }

    } catch (error: any) {
      console.error('Erro ao atualizar pagamento:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro ao atualizar pagamento',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {requiresAdminReason ? (
              <>
                <Shield className="h-5 w-5 text-orange-600" />
                Editar Pagamento Confirmado (Admin)
              </>
            ) : (
              <>
                <Edit2 className="h-5 w-5 text-blue-600" />
                Editar Pagamento
              </>
            )}
          </DialogTitle>
          
          {/* Informações do pagamento */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">#{payment.payment_number}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-600">Reserva #{payment.reservation_id}</span>
            </div>
          </div>

          {/* Aviso para edição administrativa */}
          {requiresAdminReason && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                <strong>Atenção:</strong> Este é um pagamento confirmado. A edição requer justificativa 
                obrigatória e será registrada no log de auditoria.
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso se não pode editar */}
          {!canEdit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Pagamentos confirmados só podem ser editados por administradores.
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        {canEdit && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            {/* 🆕 Método de Pagamento Dinâmico */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pagamento *</Label>
              {loadingMethods ? (
                <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Carregando métodos...</span>
                </div>
              ) : (
                <Select 
                  value={watch('payment_method')} 
                  onValueChange={(value) => setValue('payment_method', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods
                      .filter(method => method.is_active)
                      .map((method) => (
                        <SelectItem key={method.code} value={method.code}>
                          {method.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              )}
              {errors.payment_method && (
                <p className="text-sm text-red-600">{errors.payment_method.message}</p>
              )}
              {paymentMethods.length === 0 && !loadingMethods && (
                <p className="text-xs text-amber-600">
                  Nenhum método ativo encontrado. Configure métodos em Cadastros → Métodos de Pagamento.
                </p>
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

            {/* Justificativa Administrativa */}
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
              <Button 
                type="submit" 
                disabled={loading}
                className={requiresAdminReason ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    {requiresAdminReason && <Shield className="mr-2 h-4 w-4" />}
                    Atualizar Pagamento
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