// frontend/src/components/reservations/PaymentModal.tsx - VERSÃO COMPLETA COM MÉTODOS DINÂMICOS

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2,
  AlertTriangle,
  Calendar,
  CreditCard,
  User,
  Receipt,
  FileText,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';
import { PaymentCreate } from '@/types/payment';

// ===== INTERFACE PARA MÉTODOS DE PAGAMENTO DINÂMICOS =====
interface PaymentMethodOption {
  code: string;
  name: string;
  is_active: boolean;
  requires_reference?: boolean;
  has_fees?: boolean;
  icon?: string;
  color?: string;
}

// ===== UTILITÁRIOS FINANCEIROS COM ENTRADA AUTOMÁTICA =====

/**
 * Classe para manipulação de valores monetários com entrada automática
 * Implementa entrada de números inteiros com posicionamento automático da vírgula
 */
class AutoCurrencyUtils {
  
  /**
   * Converte centavos para reais
   * 25050 -> 250.50
   */
  static centsToReais(cents: number): number {
    return Math.round(cents) / 100;
  }
  
  /**
   * Converte reais para centavos (evita problemas de float)
   * 250.50 -> 25050
   */
  static reaisToCents(reais: number): number {
    return Math.round(reais * 100);
  }
  
  /**
   * Formata valor numérico para exibição brasileira
   * 1234.56 -> "1.234,56"
   */
  static formatForDisplay(value: number): string {
    if (isNaN(value) || value === null || value === undefined) return '';
    
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  /**
   * Formata com símbolo de moeda
   * 1234.56 -> "R$ 1.234,56"
   */
  static formatWithSymbol(value: number): string {
    if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
    
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  /**
   * Formata centavos para exibição automática
   * 1234 -> "12,34"
   * 123 -> "1,23"  
   * 12 -> "0,12"
   * 1 -> "0,01"
   * 0 -> "0,00"
   */
  static formatCentsToDisplay(cents: number): string {
    if (isNaN(cents) || cents < 0) return '0,00';
    
    // Limita o valor máximo em centavos (R$ 999.999,99 = 99999999 centavos)
    const maxCents = 99999999;
    const limitedCents = Math.min(cents, maxCents);
    
    // Converte para string e garante pelo menos 3 dígitos (para incluir os centavos)
    const centsStr = limitedCents.toString().padStart(3, '0');
    
    // Separa parte inteira dos centavos
    const centavos = centsStr.slice(-2);
    const reaisStr = centsStr.slice(0, -2);
    
    // Formata a parte dos reais com separadores de milhares
    const reaisFormatted = reaisStr ? parseInt(reaisStr).toLocaleString('pt-BR') : '0';
    
    return `${reaisFormatted},${centavos}`;
  }
  
  /**
   * Remove caracteres não numéricos e retorna apenas dígitos
   * "123abc456" -> "123456"
   */
  static extractDigits(value: string): string {
    return value.replace(/\D/g, '');
  }
  
  /**
   * Converte string de dígitos para centavos
   * "1234" -> 1234 centavos (R$ 12,34)
   */
  static digitsToCents(digits: string): number {
    if (!digits) return 0;
    return parseInt(digits) || 0;
  }
  
  /**
   * Converte centavos para valor decimal
   * 1234 centavos -> 12.34
   */
  static centsToDecimal(cents: number): number {
    return Math.round(cents) / 100;
  }
  
  /**
   * Valida se o valor está dentro dos limites financeiros
   */
  static validate(value: number, min: number = 0, max: number = 999999.99): boolean {
    return value >= min && value <= max && !isNaN(value);
  }
}

// ===== COMPONENTE DE INPUT MONETÁRIO AUTOMÁTICO =====

interface AutoCurrencyInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxValue?: number;
  label?: string;
  error?: string;
}

const AutoCurrencyInput: React.FC<AutoCurrencyInputProps> = ({
  value,
  onChange,
  placeholder = "0,00",
  disabled = false,
  className = "",
  maxValue = 999999.99,
  label,
  error
}) => {
  // Estado interno em centavos para evitar problemas de precisão
  const [internalCents, setInternalCents] = useState<number>(0);
  const [displayValue, setDisplayValue] = useState<string>('0,00');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sincroniza valor externo com estado interno
  useEffect(() => {
    if (!isFocused && value !== undefined && value !== null) {
      const cents = AutoCurrencyUtils.reaisToCents(value);
      setInternalCents(cents);
      setDisplayValue(AutoCurrencyUtils.formatCentsToDisplay(cents));
    }
  }, [value, isFocused]);
  
  // Inicializa valores quando componente monta
  useEffect(() => {
    if (value !== undefined && value !== null) {
      const cents = AutoCurrencyUtils.reaisToCents(value);
      setInternalCents(cents);
      setDisplayValue(AutoCurrencyUtils.formatCentsToDisplay(cents));
    }
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Extrai apenas dígitos
    const digits = AutoCurrencyUtils.extractDigits(rawValue);
    
    // Converte para centavos
    const cents = AutoCurrencyUtils.digitsToCents(digits);
    
    // Verifica limite máximo
    const maxCents = AutoCurrencyUtils.reaisToCents(maxValue);
    const limitedCents = Math.min(cents, maxCents);
    
    // Atualiza estado interno
    setInternalCents(limitedCents);
    
    // Atualiza display
    const formattedDisplay = AutoCurrencyUtils.formatCentsToDisplay(limitedCents);
    setDisplayValue(formattedDisplay);
    
    // Notifica mudança em valor decimal
    const decimalValue = AutoCurrencyUtils.centsToDecimal(limitedCents);
    onChange(decimalValue);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
    
    // Posiciona cursor no final
    setTimeout(() => {
      if (inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    
    // Reformata para garantir exibição consistente
    const formattedDisplay = AutoCurrencyUtils.formatCentsToDisplay(internalCents);
    setDisplayValue(formattedDisplay);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permite: Backspace, Delete, Tab, Escape, Enter, setas
    if ([8, 9, 27, 13, 46, 37, 38, 39, 40].includes(e.keyCode)) {
      return;
    }
    
    // Permite: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    if ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88 || e.keyCode === 90) && e.ctrlKey) {
      return;
    }
    
    // Bloqueia tudo exceto números
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    // Obtém dados colados e extrai apenas dígitos
    const pastedData = e.clipboardData.getData('text');
    const digits = AutoCurrencyUtils.extractDigits(pastedData);
    
    if (digits) {
      // Simula entrada de dígitos
      const newEvent = {
        target: { value: digits }
      } as React.ChangeEvent<HTMLInputElement>;
      
      handleChange(newEvent);
    }
  };
  
  return (
    <div>
      {label && <Label className="text-sm font-medium mb-1 block">{label}</Label>}
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 text-right font-mono ${className}`}
          inputMode="numeric"
          autoComplete="off"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

// ===== SCHEMA COMPLETO =====
const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Valor deve ser maior que zero').max(999999.99, 'Valor muito alto'),
  payment_method: z.string().min(1, 'Método de pagamento é obrigatório'),
  payment_date: z.string().min(1, 'Data de pagamento é obrigatória'),
  payer_name: z.string().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  fee_amount: z.number().min(0).max(99999.99).optional(),
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

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
      payment_date: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      fee_amount: 0,
    },
  });

  const watchedValues = watch();

  // ===== FUNÇÕES =====

  // 🆕 Carregar métodos de pagamento dinâmicos
  const loadPaymentMethods = async () => {
    try {
      setLoadingMethods(true);
      console.log('🔄 Carregando métodos de pagamento...');
      
      const response = await apiClient.get('/payment-methods/active');
      const methods = response.data || [];
      
      console.log('✅ Métodos carregados:', methods);
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

  // ===== EFEITOS =====

  // Carregar métodos de pagamento quando modal abre
  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  // Reset quando modal abre
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      reset({
        amount: balanceDue > 0 ? balanceDue : 0,
        payment_date: format(now, 'yyyy-MM-dd\'T\'HH:mm'),
        fee_amount: 0,
      });
    }
  }, [isOpen, balanceDue, reset]);

  // ===== HANDLERS =====
  
  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const handleAmountChange = (value: number) => {
    setValue('amount', value);
  };

  const handleFeeAmountChange = (value: number) => {
    setValue('fee_amount', value);
  };

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);

    try {
      // Validação adicional
      if (!AutoCurrencyUtils.validate(data.amount, 0.01, 999999.99)) {
        toast({
          title: "Erro",
          description: "Valor do pagamento inválido",
          variant: "destructive",
        });
        return;
      }

      if (data.fee_amount && !AutoCurrencyUtils.validate(data.fee_amount, 0, 99999.99)) {
        toast({
          title: "Erro", 
          description: "Taxa inválida",
          variant: "destructive",
        });
        return;
      }

      // Preparar dados para envio
      const paymentData: PaymentCreate = {
        reservation_id: reservationId,
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: new Date(data.payment_date).toISOString(),
        reference_number: data.reference_number || undefined,
        notes: data.payer_name ? `Pagador: ${data.payer_name}${data.notes ? '\n' + data.notes : ''}` : data.notes || undefined,
        internal_notes: data.internal_notes || undefined,
        fee_amount: data.fee_amount || undefined,
        is_partial: data.amount < totalAmount,
      };

      console.log('📤 Enviando pagamento:', paymentData);

      // Enviar para API
      const response = await apiClient.createPayment(paymentData);

      console.log('✅ Pagamento criado:', response);

      toast({
        title: 'Pagamento registrado',
        description: `Pagamento de ${AutoCurrencyUtils.formatWithSymbol(data.amount)} registrado com sucesso.`,
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

  // ===== CÁLCULOS =====
  
  const netAmount = watchedValues.amount - (watchedValues.fee_amount || 0);
  const isPartialPayment = watchedValues.amount > 0 && watchedValues.amount < totalAmount;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Registrar Pagamento
            {reservationNumber && (
              <span className="text-sm font-normal text-gray-600">
                - {reservationNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          
          {/* Informações da Reserva */}
          {(totalAmount > 0 || balanceDue > 0) && (
            <Alert className="bg-blue-50 border-blue-200">
              <Receipt className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <div className="font-medium text-blue-800 mb-2">Resumo Financeiro da Reserva</div>
                  {totalAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Valor total:</span>
                      <span className="font-medium">{AutoCurrencyUtils.formatWithSymbol(totalAmount)}</span>
                    </div>
                  )}
                  {balanceDue > 0 && (
                    <div className="flex justify-between">
                      <span>Saldo devedor:</span>
                      <span className="font-medium text-red-600">{AutoCurrencyUtils.formatWithSymbol(balanceDue)}</span>
                    </div>
                  )}
                  {isPartialPayment && (
                    <div className="flex justify-between border-t pt-2">
                      <span>Saldo restante:</span>
                      <span className="font-medium text-orange-600">
                        {AutoCurrencyUtils.formatWithSymbol(totalAmount - watchedValues.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Dados do Pagamento */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Dados do Pagamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Valor do Pagamento */}
              <div>
                <AutoCurrencyInput
                  label="Valor do Pagamento *"
                  value={watchedValues.amount}
                  onChange={handleAmountChange}
                  placeholder="0,00"
                  disabled={loading}
                  maxValue={999999.99}
                  className="h-10"
                  error={errors.amount?.message}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite apenas números. Ex: 12500 = R$ 125,00
                </p>
              </div>

              {/* Taxa (opcional) */}
              <div>
                <AutoCurrencyInput
                  label="Taxa Cobrada"
                  value={watchedValues.fee_amount}
                  onChange={handleFeeAmountChange}
                  placeholder="0,00"
                  disabled={loading}
                  maxValue={99999.99}
                  className="h-10"
                  error={errors.fee_amount?.message}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Taxa de processamento ou comissão
                </p>
              </div>
            </div>

            {/* Valor Líquido (calculado) */}
            {(watchedValues.fee_amount || 0) > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Valor líquido (após taxa):</span>
                  <span className="font-medium text-green-600">
                    {AutoCurrencyUtils.formatWithSymbol(netAmount)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data do Pagamento */}
              <div className="space-y-2">
                <Label htmlFor="payment_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data do Pagamento *
                </Label>
                <Input
                  id="payment_date"
                  type="datetime-local"
                  disabled={loading}
                  className="h-10"
                  {...register('payment_date')}
                />
                {errors.payment_date && (
                  <p className="text-sm text-red-500">{errors.payment_date.message}</p>
                )}
              </div>

              {/* 🆕 Método de Pagamento Dinâmico */}
              <div className="space-y-2">
                <Label htmlFor="payment_method">
                  Método de Pagamento *
                </Label>
                {loadingMethods ? (
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-gray-500">Carregando métodos...</span>
                  </div>
                ) : (
                  <select
                    id="payment_method"
                    disabled={loading}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...register('payment_method')}
                  >
                    <option value="">Selecione o método</option>
                    {paymentMethods
                      .filter(method => method.is_active)
                      .map((method) => (
                        <option key={method.code} value={method.code}>
                          {method.name}
                        </option>
                      ))
                    }
                  </select>
                )}
                {errors.payment_method && (
                  <p className="text-sm text-red-500">{errors.payment_method.message}</p>
                )}
                {paymentMethods.length === 0 && !loadingMethods && (
                  <p className="text-xs text-amber-600">
                    Nenhum método ativo encontrado. Configure métodos em Cadastros → Métodos de Pagamento.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome do Pagador */}
              <div className="space-y-2">
                <Label htmlFor="payer_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome do Pagador
                </Label>
                <Input
                  id="payer_name"
                  type="text"
                  placeholder="Nome de quem realizou o pagamento"
                  disabled={loading}
                  className="h-10"
                  {...register('payer_name')}
                />
                <p className="text-xs text-gray-500">
                  Opcional - para identificar quem fez o pagamento
                </p>
              </div>

              {/* Número de Referência */}
              <div className="space-y-2">
                <Label htmlFor="reference_number" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Número de Referência
                </Label>
                <Input
                  id="reference_number"
                  type="text"
                  placeholder="Comprovante, TID, etc."
                  disabled={loading}
                  className="h-10"
                  {...register('reference_number')}
                />
                <p className="text-xs text-gray-500">
                  Número do comprovante, transação, etc.
                </p>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Observações</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Observações Gerais */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre o pagamento..."
                  disabled={loading}
                  rows={3}
                  className="resize-none"
                  {...register('notes')}
                />
                <p className="text-xs text-gray-500">
                  Visível para hóspedes e equipe
                </p>
              </div>

              {/* Notas Internas */}
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Notas Internas</Label>
                <Textarea
                  id="internal_notes"
                  placeholder="Notas internas para a equipe..."
                  disabled={loading}
                  rows={3}
                  className="resize-none"
                  {...register('internal_notes')}
                />
                <p className="text-xs text-gray-500">
                  Apenas para equipe interna
                </p>
              </div>
            </div>
          </div>

          {/* Avisos */}
          {isPartialPayment && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Pagamento Parcial:</strong> Este pagamento não quitará totalmente a reserva. 
                Saldo restante: {AutoCurrencyUtils.formatWithSymbol(totalAmount - watchedValues.amount)}
              </AlertDescription>
            </Alert>
          )}

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
              disabled={loading || !watchedValues.amount || watchedValues.amount <= 0}
              className="min-w-[150px]"
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