// frontend/src/components/guests/GuestModal.tsx
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, User, Phone, Mail, MapPin } from 'lucide-react';
import { GuestResponse, GuestCreate, GuestUpdate } from '@/types/guest';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const guestSchema = z.object({
  first_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  last_name: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().min(2, 'Nacionalidade é obrigatória'),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, 'País é obrigatório'),
  notes: z.string().optional(),
  marketing_consent: z.string(),
});

type GuestFormData = z.infer<typeof guestSchema>;

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  guest?: GuestResponse | null;
  onSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'passport', label: 'Passaporte' },
  { value: 'rg', label: 'RG' },
  { value: 'cnh', label: 'CNH' },
  { value: 'other', label: 'Outro' },
];

const MARKETING_CONSENT_OPTIONS = [
  { value: 'not_asked', label: 'Não perguntado' },
  { value: 'yes', label: 'Aceita' },
  { value: 'no', label: 'Não aceita' },
];

export default function GuestModal({ 
  isOpen, 
  onClose, 
  guest, 
  onSuccess 
}: GuestModalProps) {
  const [loading, setLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [documentAvailable, setDocumentAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingDocument, setCheckingDocument] = useState(false);
  const { toast } = useToast();

  const isEdit = !!guest;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      document_type: '',
      document_number: '',
      date_of_birth: '',
      nationality: 'Brasil',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Brasil',
      notes: '',
      marketing_consent: 'not_asked',
    }
  });

  const emailValue = watch('email');
  const documentValue = watch('document_number');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (guest) {
        reset({
          first_name: guest.first_name,
          last_name: guest.last_name,
          email: guest.email || '',
          phone: guest.phone || '',
          document_type: guest.document_type || '',
          document_number: guest.document_number || '',
          date_of_birth: guest.date_of_birth || '',
          nationality: guest.nationality,
          address_line1: guest.address_line1 || '',
          address_line2: guest.address_line2 || '',
          city: guest.city || '',
          state: guest.state || '',
          postal_code: guest.postal_code || '',
          country: guest.country,
          notes: guest.notes || '',
          marketing_consent: guest.marketing_consent,
        });
      } else {
        reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          document_type: '',
          document_number: '',
          date_of_birth: '',
          nationality: 'Brasil',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'Brasil',
          notes: '',
          marketing_consent: 'not_asked',
        });
      }
      setEmailAvailable(null);
      setDocumentAvailable(null);
    }
  }, [isOpen, guest, reset]);

  // Verificação de email - SUBSTITUIR o useEffect existente
useEffect(() => {
  if (emailValue && emailValue.includes('@') && emailValue.trim().length > 5) {
    const timeoutId = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const response = await apiClient.checkEmailAvailability(emailValue.trim(), guest?.id);
        setEmailAvailable(response.available);
      } catch (error) {
        console.error('Erro ao verificar email:', error);
        setEmailAvailable(null); // Em caso de erro, não mostrar indicador
      } finally {
        setCheckingEmail(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  } else {
    setEmailAvailable(null);
  }
}, [emailValue, guest?.id]);

  // Verificação de documento
  useEffect(() => {
  if (documentValue && documentValue.trim().length >= 3) {
    const timeoutId = setTimeout(async () => {
      setCheckingDocument(true);
      try {
        const response = await apiClient.checkDocumentAvailability(documentValue.trim(), guest?.id);
        setDocumentAvailable(response.available);
      } catch (error) {
        console.error('Erro ao verificar documento:', error);
        setDocumentAvailable(null); // Em caso de erro, não mostrar indicador
      } finally {
        setCheckingDocument(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  } else {
    setDocumentAvailable(null);
  }
}, [documentValue, guest?.id]);

  const onSubmit = async (data: GuestFormData) => {
    // Verificar disponibilidade antes de submeter
    if (data.email && emailAvailable === false) {
      toast({
        title: "Erro",
        description: "Este email já está sendo usado por outro hóspede",
        variant: "destructive",
      });
      return;
    }

    if (data.document_number && documentAvailable === false) {
      toast({
        title: "Erro", 
        description: "Este documento já está sendo usado por outro hóspede",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Limpar campos vazios
      const submitData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      if (isEdit) {
        await apiClient.put(`/guests/${guest!.id}`, submitData);
        toast({
          title: "Sucesso",
          description: "Hóspede atualizado com sucesso",
        });
      } else {
        await apiClient.post('/guests/', submitData);
        toast({
          title: "Sucesso", 
          description: "Hóspede cadastrado com sucesso",
        });
      }

      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erro ao salvar hóspede';
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Hóspede' : 'Novo Hóspede'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="additional">Adicional</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              {/* Nome */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nome *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      {...register('first_name')}
                      id="first_name"
                      placeholder="João"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  {errors.first_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="last_name">Sobrenome *</Label>
                  <Input
                    {...register('last_name')}
                    id="last_name"
                    placeholder="Silva"
                    disabled={loading}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              {/* Documento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="document_type">Tipo do Documento</Label>
                  <Select
                    value={watch('document_type') || ''}
                    onValueChange={(value) => setValue('document_type', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="document_number">Número do Documento</Label>
                  <div className="relative">
                    <Input
                      {...register('document_number')}
                      id="document_number"
                      placeholder="123.456.789-00"
                      disabled={loading}
                    />
                    {checkingDocument && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {!checkingDocument && documentAvailable === true && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {!checkingDocument && documentAvailable === false && (
                      <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {documentAvailable === false && (
                    <p className="text-sm text-red-600 mt-1">Documento já em uso</p>
                  )}
                </div>
              </div>

              {/* Nascimento e Nacionalidade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_of_birth">Data de Nascimento</Label>
                  <Input
                    {...register('date_of_birth')}
                    id="date_of_birth"
                    type="date"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="nationality">Nacionalidade *</Label>
                  <Input
                    {...register('nationality')}
                    id="nationality"
                    placeholder="Brasil"
                    disabled={loading}
                  />
                  {errors.nationality && (
                    <p className="text-sm text-red-600 mt-1">{errors.nationality.message}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('email')}
                    id="email"
                    type="email"
                    placeholder="joao@email.com"
                    className="pl-10"
                    disabled={loading}
                  />
                  {checkingEmail && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {!checkingEmail && emailAvailable === true && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {!checkingEmail && emailAvailable === false && (
                    <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                  )}
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
                {emailAvailable === false && (
                  <p className="text-sm text-red-600 mt-1">Email já em uso</p>
                )}
              </div>

              {/* Telefone */}
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('phone')}
                    id="phone"
                    placeholder="(11) 99999-9999"
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Endereço */}
              <div>
                <Label htmlFor="address_line1">Endereço</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('address_line1')}
                    id="address_line1"
                    placeholder="Rua das Flores, 123"
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address_line2">Complemento</Label>
                <Input
                  {...register('address_line2')}
                  id="address_line2"
                  placeholder="Apto 45"
                  disabled={loading}
                />
              </div>

              {/* Cidade, Estado e CEP */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    {...register('city')}
                    id="city"
                    placeholder="São Paulo"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    {...register('state')}
                    id="state"
                    placeholder="SP"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="postal_code">CEP</Label>
                  <Input
                    {...register('postal_code')}
                    id="postal_code"
                    placeholder="01234-567"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* País */}
              <div>
                <Label htmlFor="country">País *</Label>
                <Input
                  {...register('country')}
                  id="country"
                  placeholder="Brasil"
                  disabled={loading}
                />
                {errors.country && (
                  <p className="text-sm text-red-600 mt-1">{errors.country.message}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4">
              {/* Marketing */}
              <div>
                <Label htmlFor="marketing_consent">Consentimento de Marketing</Label>
                <Select
                  value={watch('marketing_consent')}
                  onValueChange={(value) => setValue('marketing_consent', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETING_CONSENT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  {...register('notes')}
                  id="notes"
                  placeholder="Informações adicionais sobre o hóspede..."
                  rows={3}
                  disabled={loading}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}