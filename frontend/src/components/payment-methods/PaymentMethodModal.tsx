// frontend/src/components/payment-methods/PaymentMethodModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Palette, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentMethodsAPI from '@/lib/api/payment-methods';
import type { 
  PaymentMethod, 
  PaymentMethodFormData,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_COLORS
} from '@/types/payment-methods';

// Schema de validação
const paymentMethodSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode ter mais de 100 caracteres'),
  
  code: z
    .string()
    .min(2, 'Código deve ter pelo menos 2 caracteres')
    .max(20, 'Código não pode ter mais de 20 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'Código deve conter apenas letras maiúsculas, números e underscore'),
  
  description: z
    .string()
    .max(500, 'Descrição não pode ter mais de 500 caracteres')
    .optional(),
  
  icon: z
    .string()
    .optional(),
  
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal (#RRGGBB)')
    .optional(),
  
  fee_percentage: z
    .number()
    .min(0, 'Taxa não pode ser negativa')
    .max(100, 'Taxa não pode ser maior que 100%')
    .optional(),
  
  is_active: z.boolean(),
  
  settings: z
    .record(z.any())
    .optional()
});

type FormData = z.infer<typeof paymentMethodSchema>;

// Ícones disponíveis (simulando - na prática viriam do backend)
const availableIcons = [
  { value: '💳', label: 'Cartão de Crédito' },
  { value: '💰', label: 'Dinheiro' },
  { value: '🏦', label: 'Transferência Bancária' },
  { value: '📱', label: 'PIX' },
  { value: '💸', label: 'Débito' },
  { value: '🎫', label: 'Voucher' },
  { value: '💎', label: 'Premium' },
  { value: '🔐', label: 'Seguro' }
];

// Cores predefinidas
const availableColors = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6B7280', // gray-500
  '#EC4899'  // pink-500
];

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethod?: PaymentMethod | null;
  onSave: () => void;
}

export default function PaymentMethodModal({
  isOpen,
  onClose,
  paymentMethod = null,
  onSave
}: PaymentMethodModalProps) {
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const { toast } = useToast();

  // Determinar se é edição ou criação
  const isEditing = !!paymentMethod;
  const title = isEditing ? 'Editar Método de Pagamento' : 'Novo Método de Pagamento';

  // Configurar formulário
  const form = useForm<FormData>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      icon: availableIcons[0].value,
      color: availableColors[0],
      fee_percentage: 0,
      is_active: true,
      settings: {}
    }
  });

  // Carregar dados quando abrir o modal para edição
  useEffect(() => {
    if (isOpen && isEditing && paymentMethod) {
      form.reset({
        name: paymentMethod.name,
        code: paymentMethod.code,
        description: paymentMethod.description || '',
        icon: paymentMethod.icon || availableIcons[0].value,
        color: paymentMethod.color || availableColors[0],
        fee_percentage: paymentMethod.fee_percentage || 0,
        is_active: paymentMethod.is_active,
        settings: paymentMethod.settings || {}
      });
    } else if (isOpen && !isEditing) {
      form.reset({
        name: '',
        code: '',
        description: '',
        icon: availableIcons[0].value,
        color: availableColors[0],
        fee_percentage: 0,
        is_active: true,
        settings: {}
      });
    }
  }, [isOpen, isEditing, paymentMethod, form]);

  // Validar código único
  const validateCode = async (code: string) => {
    if (!code.trim() || validatingCode) return;
    
    setValidatingCode(true);
    
    try {
      const result = await PaymentMethodsAPI.validateCode(
        code, 
        isEditing ? paymentMethod?.id : undefined
      );
      
      if (!result.available) {
        form.setError('code', {
          type: 'manual',
          message: 'Este código já está sendo utilizado'
        });
      }
    } catch (error) {
      console.error('Erro ao validar código:', error);
    } finally {
      setValidatingCode(false);
    }
  };

  // Gerar código automaticamente baseado no nome
  const generateCode = (name: string) => {
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20);
    
    form.setValue('code', code);
    
    if (code.length >= 2) {
      validateCode(code);
    }
  };

  // Submit do formulário
  const onSubmit = async (data: FormData) => {
    setLoading(true);
    
    try {
      if (isEditing && paymentMethod) {
        await PaymentMethodsAPI.update(paymentMethod.id, {
          name: data.name,
          code: data.code,
          description: data.description,
          icon: data.icon,
          color: data.color,
          fee_percentage: data.fee_percentage,
          is_active: data.is_active,
          settings: data.settings
        });
        
        toast({
          title: 'Método de pagamento atualizado',
          description: `${data.name} foi atualizado com sucesso.`
        });
      } else {
        await PaymentMethodsAPI.create({
          name: data.name,
          code: data.code,
          description: data.description,
          icon: data.icon,
          color: data.color,
          fee_percentage: data.fee_percentage,
          is_active: data.is_active,
          settings: data.settings
        });
        
        toast({
          title: 'Método de pagamento criado',
          description: `${data.name} foi criado com sucesso.`
        });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: isEditing ? 'Erro ao atualizar método' : 'Erro ao criar método',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal
  const handleClose = () => {
    if (!loading) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite as informações do método de pagamento.'
              : 'Crie um novo método de pagamento para seu estabelecimento.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Preview do método */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: form.watch('color') || availableColors[0] }}
                  >
                    {form.watch('icon') || availableIcons[0].value}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {form.watch('name') || 'Nome do método'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {form.watch('code') || 'CODIGO'}
                      {form.watch('fee_percentage') > 0 && (
                        <span className="ml-2">• Taxa: {form.watch('fee_percentage')}%</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={form.watch('is_active') ? "default" : "secondary"}>
                    {form.watch('is_active') ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Informações básicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informações Básicas</h3>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Cartão de Crédito"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            if (!form.watch('code')) {
                              generateCode(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Código *
                        {validatingCode && (
                          <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input 
                            placeholder="Ex: CARTAO_CREDITO"
                            className="pl-10"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                              field.onChange(value);
                              if (value.length >= 2) {
                                validateCode(value);
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Apenas letras maiúsculas, números e underscore
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descrição detalhada do método de pagamento"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Ativo</FormLabel>
                        <FormDescription>
                          Método disponível para uso nas reservas
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Configurações visuais */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configurações Visuais</h3>
                
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ícone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um ícone">
                              {field.value && (
                                <span className="flex items-center gap-2">
                                  <span className="text-lg">{field.value}</span>
                                  {availableIcons.find(icon => icon.value === field.value)?.label}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableIcons.map((icon) => (
                            <SelectItem key={icon.value} value={icon.value}>
                              <span className="flex items-center gap-2">
                                <span className="text-lg">{icon.value}</span>
                                {icon.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-gray-400" />
                            <Input 
                              type="color"
                              className="w-16 h-10 p-1 border rounded cursor-pointer"
                              {...field}
                            />
                            <Input 
                              placeholder="#3B82F6"
                              className="font-mono text-sm"
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </div>
                          
                          <div className="grid grid-cols-5 gap-2">
                            {availableColors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className="w-8 h-8 rounded-md border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ backgroundColor: color }}
                                onClick={() => field.onChange(color)}
                              />
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fee_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxa (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="0"
                          min="0"
                          max="100"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Taxa cobrada sobre este método de pagamento
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                disabled={loading || validatingCode}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Atualizar' : 'Criar'} Método
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}