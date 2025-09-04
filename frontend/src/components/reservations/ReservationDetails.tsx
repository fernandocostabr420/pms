// frontend/src/components/reservations/ReservationDetails.tsx

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard,
  Clock,
  Users,
  Bed,
  DollarSign,
  Edit,
  CheckCircle,
  LogIn,
  LogOut,
  XCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReservationResponse } from '@/types/reservation';

interface ReservationDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: ReservationResponse | null;
  onEdit?: () => void;
  onQuickAction?: (action: string) => void;
  actionLoading?: string | null;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'checked_in':
      return 'secondary';
    case 'checked_out':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'text-amber-600 bg-amber-50';
    case 'confirmed':
      return 'text-green-600 bg-green-50';
    case 'checked_in':
      return 'text-blue-600 bg-blue-50';
    case 'checked_out':
      return 'text-gray-600 bg-gray-50';
    case 'cancelled':
      return 'text-red-600 bg-red-50';
    case 'no_show':
      return 'text-orange-600 bg-orange-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function ReservationDetails({
  isOpen,
  onClose,
  reservation,
  onEdit,
  onQuickAction,
  actionLoading
}: ReservationDetailsProps) {
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [checkOutCharges, setCheckOutCharges] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  if (!reservation) return null;

  const checkInDate = format(parseISO(reservation.check_in_date + 'T00:00:00'), 'dd/MM/yyyy - EEEE', { locale: ptBR });
  const checkOutDate = format(parseISO(reservation.check_out_date + 'T00:00:00'), 'dd/MM/yyyy - EEEE', { locale: ptBR });
  const createdDate = format(parseISO(reservation.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const handleCheckIn = () => {
    if (onQuickAction) {
      onQuickAction('check-in');
      // Passar dados adicionais se necessário
      // onQuickAction('check-in', { notes: checkInNotes });
    }
  };

  const handleCheckOut = () => {
    if (onQuickAction) {
      onQuickAction('check-out');
      // Passar dados adicionais se necessário
      // onQuickAction('check-out', { 
      //   notes: checkOutNotes, 
      //   final_charges: parseFloat(checkOutCharges) || 0 
      // });
    }
  };

  const handleCancel = () => {
    if (onQuickAction) {
      onQuickAction('cancel');
      // Passar dados adicionais se necessário
      // onQuickAction('cancel', {
      //   cancellation_reason: cancelReason,
      //   refund_amount: parseFloat(refundAmount) || 0
      // });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[1400px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Reserva</DialogTitle>
            <Badge className={`${getStatusColor(reservation.status)} border-0`}>
              {reservation.status_display || reservation.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>#{reservation.reservation_number}</span>
            <span>•</span>
            <span>Criada em {createdDate}</span>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="guest">Hóspede</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="actions">Ações</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Reservation Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Informações da Estadia
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Check-in</div>
                    <div className="font-medium">{checkInDate}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Hóspedes</div>
                    <div className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {reservation.total_guests} pessoa{reservation.total_guests !== 1 ? 's' : ''}
                      <span className="text-sm text-gray-500">
                        ({reservation.adults} adulto{reservation.adults !== 1 ? 's' : ''} + {reservation.children} criança{reservation.children !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Canal</div>
                    <div className="font-medium capitalize">{reservation.source || 'Direto'}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Check-out</div>
                    <div className="font-medium">{checkOutDate}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Noites</div>
                    <div className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {reservation.nights} noite{reservation.nights !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Propriedade</div>
                    <div className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {reservation.property_name}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rooms */}
            {reservation.rooms && reservation.rooms.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bed className="h-5 w-5" />
                    Quartos Reservados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {reservation.rooms.map((room, index) => (
                      <div key={room.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Quarto {room.room_number}</div>
                          <Badge variant="outline" className="text-xs">
                            {room.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {room.room_name && <div>{room.room_name}</div>}
                          {room.rate_per_night && (
                            <div>Tarifa: {formatCurrency(room.rate_per_night)}/noite</div>
                          )}
                          {room.total_amount && (
                            <div className="font-medium">
                              Total: {formatCurrency(room.total_amount)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes and Requests */}
            {(reservation.guest_requests || reservation.internal_notes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reservation.guest_requests && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Solicitações do Hóspede
                      </Label>
                      <div className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        {reservation.guest_requests}
                      </div>
                    </div>
                  )}
                  
                  {reservation.internal_notes && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Observações Internas
                      </Label>
                      <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        {reservation.internal_notes}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações do Hóspede
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600">Nome Completo</Label>
                    <div className="font-medium">{reservation.guest_name}</div>
                  </div>
                  
                  {reservation.guest_email && (
                    <div>
                      <Label className="text-sm text-gray-600">E-mail</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`mailto:${reservation.guest_email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {reservation.guest_email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Placeholder para informações adicionais do hóspede */}
                  <div className="text-sm text-gray-500">
                    <User className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <div className="text-center">
                      Mais informações do hóspede podem ser exibidas aqui
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Informações Financeiras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Valor Total:</span>
                      <span className="font-medium">
                        {reservation.total_amount ? formatCurrency(reservation.total_amount) : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Valor Pago:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(reservation.paid_amount)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Desconto:</span>
                      <span className="font-medium">
                        {formatCurrency(reservation.discount)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Taxas:</span>
                      <span className="font-medium">
                        {formatCurrency(reservation.taxes)}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-medium">Saldo Devedor:</span>
                      <span className={`font-bold ${reservation.balance_due && reservation.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {reservation.balance_due ? formatCurrency(reservation.balance_due) : 'R$ 0,00'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Status do Pagamento</div>
                      <Badge variant={reservation.is_paid ? 'default' : 'destructive'}>
                        {reservation.is_paid ? 'Pago' : 'Pendente'}
                      </Badge>
                    </div>
                    
                    {reservation.room_rate && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Diária Base</div>
                        <div className="font-medium">{formatCurrency(reservation.room_rate)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Check-in */}
              {reservation.can_check_in && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LogIn className="h-5 w-5 text-blue-600" />
                      Fazer Check-in
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="checkin-notes">Observações do Check-in</Label>
                      <Textarea
                        id="checkin-notes"
                        placeholder="Observações sobre o check-in..."
                        value={checkInNotes}
                        onChange={(e) => setCheckInNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button 
                      className="w-full"
                      onClick={handleCheckIn}
                      disabled={actionLoading === 'check-in'}
                    >
                      {actionLoading === 'check-in' ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processando...
                        </div>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4 mr-2" />
                          Confirmar Check-in
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Check-out */}
              {reservation.can_check_out && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LogOut className="h-5 w-5 text-orange-600" />
                      Fazer Check-out
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="checkout-notes">Observações do Check-out</Label>
                      <Textarea
                        id="checkout-notes"
                        placeholder="Observações sobre o check-out..."
                        value={checkOutNotes}
                        onChange={(e) => setCheckOutNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="final-charges">Taxas Finais (R$)</Label>
                      <Input
                        id="final-charges"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={checkOutCharges}
                        onChange={(e) => setCheckOutCharges(e.target.value)}
                      />
                    </div>
                    <Button 
                      className="w-full"
                      onClick={handleCheckOut}
                      disabled={actionLoading === 'check-out'}
                    >
                      {actionLoading === 'check-out' ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processando...
                        </div>
                      ) : (
                        <>
                          <LogOut className="h-4 w-4 mr-2" />
                          Confirmar Check-out
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Confirm Reservation */}
              {reservation.status === 'pending' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Confirmar Reserva
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full"
                      onClick={() => onQuickAction?.('confirm')}
                      disabled={actionLoading === 'confirm'}
                    >
                      {actionLoading === 'confirm' ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Confirmando...
                        </div>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Reserva
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Cancel Reservation */}
              {reservation.can_cancel && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                      Cancelar Reserva
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="cancel-reason">Motivo do Cancelamento *</Label>
                      <Textarea
                        id="cancel-reason"
                        placeholder="Descreva o motivo do cancelamento..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={3}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="refund-amount">Valor do Reembolso (R$)</Label>
                      <Input
                        id="refund-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={handleCancel}
                      disabled={!cancelReason.trim() || actionLoading === 'cancel'}
                    >
                      {actionLoading === 'cancel' ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Cancelando...
                        </div>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Reserva
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {onEdit && (
            <Button onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Reserva
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}