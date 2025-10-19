// frontend/src/components/booking/ConfirmationModal.tsx
'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  Calendar,
  User,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Download,
  Share2,
  Home
} from 'lucide-react';
import type { BookingResponse, PropertyPublicInfo } from '@/types/booking';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingResponse | null;
  propertyInfo: PropertyPublicInfo;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  booking,
  propertyInfo,
}: ConfirmationModalProps) {
  if (!booking) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Confirmação de Reserva',
          text: `Reserva #${booking.reservation_number} confirmada em ${propertyInfo.property.name}`,
        });
      } catch (err) {
        console.log('Erro ao compartilhar:', err);
      }
    } else {
      // Fallback: copiar para clipboard
      const text = `Reserva #${booking.reservation_number} confirmada em ${propertyInfo.property.name}`;
      navigator.clipboard.writeText(text);
      alert('Link copiado para a área de transferência!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="text-center py-6">
          
          {/* Ícone de sucesso */}
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>

          {/* Título */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Reserva Confirmada!
          </h2>
          
          <p className="text-gray-600 mb-6">
            Sua reserva foi recebida com sucesso. Você receberá um e-mail de confirmação em breve.
          </p>

          {/* Card com detalhes */}
          <Card className="text-left">
            <CardContent className="p-6 space-y-4">
              
              {/* Número da reserva */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-700 mb-1">Número da Reserva</p>
                <p className="text-2xl font-bold text-blue-900">
                  #{booking.reservation_number}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Guarde este número para acompanhar sua reserva
                </p>
              </div>

              <Separator />

              {/* Informações da reserva */}
              <div className="space-y-3">
                
                {/* Propriedade */}
                <div className="flex items-start gap-3">
                  <Home className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {propertyInfo.property.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {propertyInfo.property.address.city}, {propertyInfo.property.address.state}
                    </p>
                  </div>
                </div>

                {/* Datas */}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Período</p>
                    <p className="text-sm text-gray-600">
                      Check-in: {formatDate(booking.check_in_date)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Check-out: {formatDate(booking.check_out_date)}
                    </p>
                  </div>
                </div>

                {/* Hóspede */}
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Hóspede</p>
                    <p className="text-sm text-gray-600">{booking.guest_name}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">E-mail</p>
                    <p className="text-sm text-gray-600">{booking.guest_email}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Status</p>
                    <p className="text-sm text-gray-600">
                      {booking.status === 'pending_confirmation' && 'Aguardando confirmação'}
                      {booking.status === 'confirmed' && 'Confirmada'}
                      {booking.status === 'pending' && 'Pendente'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Valor total */}
              <div className="flex justify-between items-center bg-gray-50 rounded-lg p-4">
                <span className="text-lg font-medium text-gray-900">Valor Total</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(booking.total_amount)}
                </span>
              </div>

              {/* Mensagem adicional */}
              {booking.message && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    {booking.message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximos passos */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">Próximos Passos</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Você receberá um e-mail de confirmação</li>
              <li>✓ A propriedade entrará em contato para finalizar o pagamento</li>
              <li>✓ Guarde o número da reserva para consultas futuras</li>
            </ul>
          </div>

          {/* Informações de contato */}
          {(propertyInfo.property.contact.phone || propertyInfo.property.contact.email) && (
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Dúvidas? Entre em contato:</p>
              <div className="flex flex-wrap justify-center gap-4">
                {propertyInfo.property.contact.phone && (
                  <a 
                    href={`tel:${propertyInfo.property.contact.phone}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {propertyInfo.property.contact.phone}
                  </a>
                )}
                {propertyInfo.property.contact.email && (
                  <a 
                    href={`mailto:${propertyInfo.property.contact.email}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {propertyInfo.property.contact.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Imprimir Confirmação
            </Button>
            
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex-1"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>

            <Button
              onClick={onClose}
              className="flex-1"
              style={{ backgroundColor: propertyInfo.booking_config.branding.primary_color }}
            >
              Concluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}