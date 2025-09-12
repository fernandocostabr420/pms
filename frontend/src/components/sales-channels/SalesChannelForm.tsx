// frontend/src/components/sales-channels/SalesChannelForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Store, 
  Globe, 
  Hash, 
  Percent, 
  Link, 
  Settings,
  AlertCircle,
  CheckCircle,
  Calculator
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesChannelsAPI from '@/lib/api/sales-channels';
import type { 
  SalesChannel, 
  SalesChannelFormData,
  SalesChannelType,
  SalesChannelCreate,
  SalesChannelUpdate
} from '@/types/sales-channels';
import { SALES_CHANNEL_TYPES, getSalesChannelTypeLabel, isExternalChannelType } from '@/types/sales-channels';

// Schema de validação
const salesChannelSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode ter mais de 100 caracteres'),
  
  code: z
    .string()
    .min(2, 'Código deve ter pelo menos 2 caracteres')
    .max(20, 'Código não pode ter mais de 20 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'Código deve conter apenas letras maiúsculas, números e underscore'),
  
  channel_type: z
    .enum(['direct', 'ota', 'phone', 'email', 'walk_in', 'agency', 'corporate', 'other'])
    .default('direct'),
  
  commission_percentage: z
    .number()
    .min(0, 'Comissão não pode ser negativa')
    .max(100, 'Comissão não pode ser maior que 100%')
    .optional(),
  
  is_external: z.boolean(),
  
  is_active: z.boolean(),
  
  webhook_url: z
    .string()
    .url('URL do webhook inválida')
    .optional()
    .or(z.literal('')),
  
  settings: z
    .string()
    .refine((val) => {
      if (!val.trim()) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, 'JSON inválido')
    .optional()
});

type FormData = z.infer<typeof salesChannelSchema>;

interface SalesChannelFormProps {
  salesChannel?: SalesChannel | null;
  onSubmit: (data: SalesChannelCreate | SalesChannelUpdate) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  showPreview?: boolean;
  showCommissionCalculator?: boolean;
}

export default function SalesChannelForm({
  salesChannel = null,
  onSubmit,
  onCancel,
  loading = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  showPreview = true,
  showCommissionCalculator = true
}: SalesChannelFormProps) {
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean;
    message?: string;
  }>({ isValid: true });
  const [calculatorValue, setCalculatorValue] = useState<number>(1000);
  const { toast } = useToast();

  // Determinar se é edição
  const isEditing = !!salesChannel;

  // Configurar formulário
  const form = useForm<FormData>({
    resolver: zodResolver(salesChannelSchema),
    defaultValues: {
      name: salesChannel?.name || '',
      code: salesChannel?.code || '',
      channel_type: salesChannel?.channel_type || 'direct',
      commission_percentage: salesChannel?.commission_percentage || 0,
      is_external: salesChannel?.is_external || false,
      is_active: salesChannel?.is_active ?? true,
      webhook_url: salesChannel?.webhook_url || '',
      settings: salesChannel?.settings ? JSON.stringify(salesChannel.settings, null, 2) : ''
    }
  });

  // Assistir mudanças no tipo de canal
  const watchedChannelType = form.watch('channel_type');
  const watchedCommission = form.watch('commission_percentage') || 0;
  
  // Atualizar is_external automaticamente baseado no tipo
  useEffect(() => {
    const isExternal = isExternalChannelType(watchedChannelType);
    form.setValue('is_external', isExternal);
  }, [watchedChannelType, form]);

  // Validar código único
  const validateCode = async (code: string) => {
    if (!code.trim() || validatingCode) return;
    
    setValidatingCode(true);
    setCodeValidation({ isValid: true });
    
    try {
      const result = await SalesChannelsAPI.validateCode(
        code, 
        isEditing ? salesChannel?.id : undefined
      );
      
      if (!result.available) {
        setCodeValidation({
          isValid: false,
          message: 'Este código já está sendo utilizado'
        });
        form.setError('code', {
          type: 'manual',
          message: 'Este código já está sendo utilizado'
        });
      } else {
        setCodeValidation({
          isValid: true,
          message: 'Código disponível'
        });
        form.clearErrors('code');
      }
    } catch (error) {
      console.error('Erro ao validar código:', error);
      setCodeValidation({
        isValid: false,
        message: 'Erro ao validar código'
      });
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

  // Calcular comissão
  const calculateCommission = (value: number, percentage: number) => {
    const commission = (value * percentage) / 100;
    const net = value - commission;
    return { commission, net };
  };

  // Submit do formulário
  const handleSubmit = async (data: FormData) => {
    try {
      let settings = {};
      
      // Parse das configurações JSON
      if (data.settings?.trim()) {
        try {
          settings = JSON.parse(data.settings);
        } catch (error) {
          toast({
            title: 'Erro nas configurações',
            description: 'JSON inválido nas configurações',
            variant: 'destructive'
          });
          return;
        }
      }

      const payload = {
        name: data.name,
        code: data.code,
        channel_type: data.channel_type,
        commission_percentage: data.commission_percentage,
        is_external: data.is_external,
        is_active: data.is_active,
        webhook_url: data.webhook_url || undefined,
        settings
      };

      await onSubmit(payload);
    } catch (error) {
      // Erro tratado no componente pai
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview do canal */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview do Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                {form.watch('is_external') ? (
                  <Globe className="h-5 w-5 text-blue-600" />
                ) : (
                  <Store className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {form.watch('name') || 'Nome do canal'}
                </div>
                <div className="text-sm text-gray-500">
                  {form.watch('code') || 'CODIGO'}
                  {watchedCommission > 0 && (
                    <span className="ml-2">• Comissão: {watchedCommission}%</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {getSalesChannelTypeLabel(form.watch('channel_type'))}
                </Badge>
                {form.watch('is_external') && (
                  <Badge variant="secondary">Externo</Badge>
                )}
                <Badge variant={form.watch('is_active') ? "default" : "secondary"}>
                  {form.watch('is_active') ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Booking.com"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            if (!form.getValues('code') || !isEditing) {
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
                        {!validatingCode && codeValidation.message && (
                          <span className={`inline ml-2 text-xs ${
                            codeValidation.isValid ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {codeValidation.isValid ? (
                              <CheckCircle className="inline h-3 w-3 mr-1" />
                            ) : (
                              <AlertCircle className="inline h-3 w-3 mr-1" />
                            )}
                            {codeValidation.message}
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input 
                            placeholder="Ex: BOOKING_COM"
                            className="pl-10"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                              field.onChange(value);
                              if (value.length >= 2) {
                                validateCode(value);
                              } else {
                                setCodeValidation({ isValid: true });
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="channel_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Canal *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SALES_CHANNEL_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                {isExternalChannelType(type.value as SalesChannelType) && (
                                  <Globe className="h-4 w-4 text-blue-500" />
                                )}
                                {type.label}
                              </div>
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
                  name="is_external"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-end">
                      <FormLabel>Canal Externo</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2 h-10">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled // Automaticamente definido pelo tipo
                          />
                          <span className="text-sm text-gray-500">
                            {field.value ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Definido automaticamente pelo tipo
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-end">
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2 h-10">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <span className="text-sm text-gray-500">
                            {field.value ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Canal disponível para receber reservas
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Comissão e Integração */}
          <Card>
            <CardHeader>
              <CardTitle>Comissão e Integração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="commission_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taxa de Comissão (%)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              type="number"
                              placeholder="0.00"
                              className="pl-10"
                              min="0"
                              max="100"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Percentual cobrado sobre o valor das reservas
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="webhook_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Webhook</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              type="url"
                              placeholder="https://api.exemplo.com/webhook"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          URL para receber notificações de reservas
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Calculadora de comissão */}
                {showCommissionCalculator && watchedCommission > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Calculadora de Comissão
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Valor da reserva (R$)
                        </label>
                        <Input
                          type="number"
                          placeholder="1000"
                          value={calculatorValue}
                          onChange={(e) => setCalculatorValue(Number(e.target.value) || 0)}
                        />
                      </div>
                      
                      <Card className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Valor bruto:</span>
                              <span>R$ {calculatorValue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Comissão ({watchedCommission}%):</span>
                              <span className="text-red-600">
                                - R$ {calculateCommission(calculatorValue, watchedCommission).commission.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-medium">
                              <span>Valor líquido:</span>
                              <span className="text-green-600">
                                R$ {calculateCommission(calculatorValue, watchedCommission).net.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configurações Avançadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações Avançadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="settings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Configurações JSON</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"api_key": "sua_chave", "timeout": 30}'
                        className="font-mono text-sm"
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Configurações específicas em formato JSON (opcional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Botões de ação */}
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}
            
            <Button 
              type="submit" 
              disabled={loading || validatingCode || !codeValidation.isValid}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}