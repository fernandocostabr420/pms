// frontend/src/components/booking/CheckoutModal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  MapPin, 
  FileText,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RoomAvailable, SearchParams, PropertyPublicInfo, BookingRequest, GuestData } from '@/types/booking';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomAvailable | null;
  searchParams: SearchParams;
  propertyInfo: PropertyPublicInfo;
  onConfirm: (booking: BookingRequest) => Promise<any>;
  loading: boolean;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  room,
  searchParams,
  propertyInfo,
  onConfirm,
  loading,
}: CheckoutModalProps) {
  const [formData, setFormData] = useState<GuestData>({
    full_name: '',
    email: '',
    phone: '',
    document_type: 'cpf',
    document_number: '',
    nationality: 'Brasil',
    address: '',
    city: '',
    state: '',
    country: 'Brasil',
    postal_code: '',
    special_requests: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!room) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome completo é obrigatório';
    }

    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'E-mail válido é obrigatório';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    if (!formData.document_number.trim()) {
      newErrors.document_number = 'Documento é obrigatório';
    }

    if (!paymentMethod) {
      newErrors.payment_method = 'Selecione uma forma de pagamento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const bookingRequest: BookingRequest = {
      property_slug: propertyInfo.property.slug,
      room_id: room.room.id,
      check_in_date: searchParams.check_in,
      check_out_date: searchParams.check_out,
      adults: searchParams.adults,
      children: searchParams.children,
      guest: formData,
      payment_method: paymentMethod,
      special_requests: formData.special_requests,
    };

    try {
      await onConfirm(bookingRequest);
    } catch (error) {
      // Erro será tratado pelo componente pai
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Finalizar Reserva</DialogTitle>
          <DialogDescription>
            Complete seus dados para confirmar a reserva
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_350px] gap-6 mt-4">
          
          {/* Formulário */}
          <div className="space-y-6">
            
            {/* Dados Pessoais */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados Pessoais
              </h3>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Seu nome completo"
                    className={errors.full_name ? 'border-red-500' : ''}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="document_type">Tipo de Documento *</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value: any) => setFormData({ ...formData, document_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="rg">RG</SelectItem>
                        <SelectItem value="passport">Passaporte</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="document_number">Número do Documento *</Label>
                    <Input
                      id="document_number"
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                      placeholder="000.000.000-00"
                      className={errors.document_number ? 'border-red-500' : ''}
                    />
                    {errors.document_number && (
                      <p className="text-xs text-red-500 mt-1">{errors.document_number}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Endereço (opcional) */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço (Opcional)
              </h3>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="UF"
                    />
                  </div>

                  <div>
                    <Label htmlFor="postal_code">CEP</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Forma de Pagamento */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Forma de Pagamento *
              </h3>
              
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className={errors.payment_method ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                  <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                  <SelectItem value="cash">Dinheiro (no local)</SelectItem>
                </SelectContent>
              </Select>
              {errors.payment_method && (
                <p className="text-xs text-red-500 mt-1">{errors.payment_method}</p>
              )}
              
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  A propriedade entrará em contato para finalizar o pagamento após a confirmação.
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* Pedidos Especiais */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Pedidos Especiais
              </h3>
              
              <Textarea
                value={formData.special_requests}
                onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                placeholder="Alguma solicitação especial? (ex: andar alto, cama extra, etc.)"
                rows={4}
              />
            </div>
          </div>

          {/* Resumo da Reserva */}
          <div>
            <Card className="sticky top-4">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Resumo da Reserva</h3>
                
                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {room.room.room_type_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Quarto {room.room.room_number}
                    </p>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-gray-700">
                        {searchParams.check_in} até {searchParams.check_out}
                      </p>
                      <p className="text-xs text-gray-500">
                        {room.pricing.nights} {room.pricing.nights === 1 ? 'noite' : 'noites'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-gray-700">
                        {searchParams.adults} {searchParams.adults === 1 ? 'adulto' : 'adultos'}
                        {searchParams.children > 0 && `, ${searchParams.children} ${searchParams.children === 1 ? 'criança' : 'crianças'}`}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {room.pricing.nights}x {formatCurrency(room.pricing.rate_per_night)}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(room.pricing.base_rate)}
                    </span>
                  </div>

                  {room.pricing.taxes && room.pricing.taxes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxas</span>
                      <span className="font-medium">
                        {formatCurrency(room.pricing.taxes)}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(room.pricing.total_amount)}
                  </span>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Confirmar Reserva
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Ao confirmar, você concorda com as políticas de cancelamento e termos de uso.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}