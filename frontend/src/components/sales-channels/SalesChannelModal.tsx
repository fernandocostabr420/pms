// frontend/src/components/sales-channels/SalesChannelModal.tsx
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Store, Globe, Hash, Percent, Link, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SalesChannelsAPI from '@/lib/api/sales-channels';
import type { 
  SalesChannel, 
  SalesChannelFormData,
  SalesChannelType
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
    .record(z.any())
    .optional()
});

type FormData = z.infer<typeof salesChannelSchema>;

interface SalesChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesChannel?: SalesChannel | null;
  onSave: () => void;
}

export default function SalesChannelModal({
  isOpen,
  onClose,
  salesChannel = null,
  onSave
}: SalesChannelModalProps) {
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const { toast } = useToast();

  // Determinar se é edição ou criação
  const isEditing = !!salesChannel;
  const title = isEditing ? 'Editar Canal de Venda' : 'Novo Canal de Venda';

  // Configurar formulário
  const form = useForm<FormData>({
    resolver: zodResolver(salesChannelSchema),
    defaultValues: {
      name: '',
      code: '',
      channel_type: 'direct',
      commission_percentage: 0,
      is_external: false,
      is_active: true,
      webhook_url: '',
      settings: {}
    }
  });

  // Assistir mudanças no tipo de canal
  const watchedChannelType = form.watch('channel_type');
  
  // Atualizar is_external automaticamente baseado no tipo
  useEffect(() => {
    const isExternal = isExternalChannelType(watchedChannelType);
    form.setValue('is_external', isExternal);
  }, [watchedChannelType, form]);

  // Carregar dados quando abrir o modal para edição
  useEffect(() => {
    if (isOpen && isEditing && salesChannel) {
      form.reset({
        name: salesChannel.name,
        code: salesChannel.code,
        channel_type: salesChannel.channel_type,
        commission_percentage: salesChannel.commission_percentage || 0,
        is_external: salesChannel.is_external,
        is_active: salesChannel.is_active,
        webhook_url: salesChannel.webhook_url || '',
        settings: salesChannel.settings || {}
      });
    } else if (isOpen && !isEditing) {
      form.reset({
        name: '',
        code: '',
        channel_type: 'direct',
        commission_percentage: 0,
        is_external: false,
        is_active: true,
        webhook_url: '',
        settings: {}
      });
    }
  }, [isOpen, isEditing, salesChannel, form]);

  // Validar código único
  const validateCode = async (code: string) => {
    if (!code.trim() || validatingCode) return;
    
    setValidatingCode(true);
    
    try {
      const result = await SalesChannelsAPI.validateCode(
        code, 
        isEditing ? salesChannel?.id : undefined
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

  // Testar webhook
  const testWebhook = async () => {
    if (!isEditing || !salesChannel) {
      toast({
        title: 'Erro',
        description: 'Salve o canal primeiro para testar o webhook',
        variant: 'destructive'
      });
      return;
    }

    setTestingWebhook(true);
    
    try {
      const result = await SalesChannelsAPI.testWebhook(salesChannel.id);
      
      toast({
        title: result.success ? 'Webhook testado com sucesso' : 'Falha no teste do webhook',
        description: result.message,
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao testar webhook',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  // Submit do formulário
  const onSubmit = async (data: FormData) => {
    setLoading(true);
    
    try {
      const payload = {
        name: data.name,
        code: data.code,
        channel_type: data.channel_type,
        commission_percentage: data.commission_percentage,
        is_external: data.is_external,
        is_active: data.is_active,
        webhook_url: data.webhook_url || undefined,
        settings: data.settings
      };

      if (isEditing && salesChannel) {
        await SalesChannelsAPI.update(salesChannel.id, payload);
        
        toast({
          title: 'Canal de venda atualizado',
          description: `${data.name} foi atualizado com sucesso.`
        });
      } else {
        await SalesChannelsAPI.create(payload);
        
        toast({
          title: 'Canal de venda criado',
          description: `${data.name} foi criado com sucesso.`
        });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: isEditing ? 'Erro ao atualizar canal' : 'Erro ao criar canal',
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite as informações do canal de venda.'
              : 'Crie um novo canal de venda para gerenciar reservas e comissões.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Preview do canal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
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
                      {form.watch('commission_percentage') > 0 && (
                        <span className="ml-2">• Comissão: {form.watch('commission_percentage')}%</span>
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

            {/* Tabs para organizar campos */}
            <Tabs defaultValue="basic" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="commission">Comissão & Integração</TabsTrigger>
                <TabsTrigger value="settings">Configurações</TabsTrigger>
              </TabsList>

              {/* Tab: Informações Básicas */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="space-y-4">
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
                                placeholder="Ex: BOOKING_COM"
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
                  </div>

                  <div className="space-y-4">
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="is_external"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Canal Externo</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
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
                          <FormItem className="flex flex-col">
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
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
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Comissão & Integração */}
              <TabsContent value="commission" className="space-y-4">
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

                    {form.watch('commission_percentage') > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium text-gray-900 mb-2">Simulação de Comissão</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Valor da reserva:</span>
                              <span>R$ 1.000,00</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Comissão ({form.watch('commission_percentage')}%):</span>
                              <span className="text-red-600">
                                - R$ {(1000 * (form.watch('commission_percentage') || 0) / 100).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-2 font-medium">
                              <span>Valor líquido:</span>
                              <span className="text-green-600">
                                R$ {(1000 - (1000 * (form.watch('commission_percentage') || 0) / 100)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="webhook_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL do Webhook</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <div className="relative">
                                <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input 
                                  type="url"
                                  placeholder="https://api.exemplo.com/webhook"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                              
                              {field.value && isEditing && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={testWebhook}
                                  disabled={testingWebhook}
                                >
                                  {testingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Testar Webhook
                                </Button>
                              )}
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
                </div>
              </TabsContent>

              {/* Tab: Configurações */}
              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configurações Avançadas</h3>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configurações JSON
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="settings"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder='{"api_key": "sua_chave", "timeout": 30}'
                                className="font-mono text-sm"
                                rows={6}
                                {...field}
                                value={JSON.stringify(field.value || {}, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    field.onChange(parsed);
                                  } catch (error) {
                                    // Ignore JSON parse errors while typing
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Configurações específicas em formato JSON
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

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
                {isEditing ? 'Atualizar' : 'Criar'} Canal
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}