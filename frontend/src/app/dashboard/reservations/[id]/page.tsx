'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReservationDetails } from '@/hooks/useReservationDetails';
import CancelReservationModal from '@/components/reservations/CancelReservationModal';
import EditReservationModal from '@/components/reservations/EditReservationModal';
import CheckInModal from '@/components/reservations/CheckInModal';
import PaymentModal from '@/components/reservations/PaymentModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  Bed, 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard,
  DollarSign,
  Calendar,
  Receipt,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';
import { formatReservationDate } from '@/lib/calendar-utils';

// Mock data para pagamentos - substituir por dados reais
const mockPayments = [
  {
    id: 1,
    amount: 154.98,
    payment_method: 'pix',
    payment_date: '2025-09-06T14:30:00',
    status: 'confirmed',
    reference_number: 'PIX123456',
    payer_name: 'Ruiter Melo',
    notes: 'Entrada da reserva',
    created_at: '2025-09-06T14:30:00'
  }
];

// Labels para métodos de pagamento
const PAYMENT_METHOD_LABELS = {
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito', 
  pix: 'PIX',
  bank_transfer: 'Transferência',
  cash: 'Dinheiro',
  check: 'Cheque',
  other: 'Outro'
};

// Labels para status
const STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  failed: 'Falhou',
  refunded: 'Estornado'
};

// Componente para badges de status
const StatusBadge = ({ status }: { status: string }) => {
  const configs = {
    pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    confirmed: { icon: CheckCircle, className: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { icon: XCircle, className: 'bg-red-100 text-red-800 border-red-200' },
    failed: { icon: AlertTriangle, className: 'bg-red-100 text-red-800 border-red-200' },
    refunded: { icon: ArrowUpDown, className: 'bg-blue-100 text-blue-800 border-blue-200' }
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
    </Badge>
  );
};

// Componente Header melhorado
function ImprovedReservationHeader({ data, onAction }: { data: any; onAction: (action: string) => void }) {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      checked_in: 'bg-green-100 text-green-800 border-green-200',
      checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const roomsDisplay = data.rooms?.map(room => `${room.room_number} (${room.room_type_name})`).join(', ') || 'Quartos não informados';

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {data.guest?.full_name || 'Hóspede não informado'}
                </h1>
                <p className="text-gray-600 font-medium">
                  Reserva: {data.reservation_number}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-green-100 rounded">
                <Bed className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg text-gray-700 font-medium">
                {roomsDisplay}
              </p>
            </div>
            
            <p className="text-sm text-gray-600">
              Criada em {format(new Date(data.created_date), 'PPP', { locale: ptBR })} às {format(new Date(data.created_date), 'HH:mm')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(data.status)} variant="outline">
              {data.status_display}
            </Badge>
            
            <div className="flex gap-2 flex-wrap">
              {data.actions.can_check_in && (
                <Button onClick={() => onAction('checkin')} className="bg-green-600 hover:bg-green-700">
                  Check-in
                </Button>
              )}
              {data.actions.can_check_out && (
                <Button onClick={() => onAction('checkout')} className="bg-blue-600 hover:bg-blue-700">
                  Check-out
                </Button>
              )}
              {data.actions.can_edit && (
                <Button variant="outline" onClick={() => onAction('edit')}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {data.actions.can_add_payment && (
                <Button variant="outline" onClick={() => onAction('payment')} className="border-green-200 text-green-700 hover:bg-green-50">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pagamento
                </Button>
              )}
              {data.actions.can_cancel && (
                <Button 
                  variant="destructive" 
                  onClick={() => onAction('cancel')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Check-in</p>
            <p className="font-semibold text-gray-900">{formatReservationDate(data.check_in_date, 'dd/MM')}</p>
            <p className="text-xs text-gray-600">{formatReservationDate(data.check_in_date, 'EEE')}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Check-out</p>
            <p className="font-semibold text-gray-900">{formatReservationDate(data.check_out_date, 'dd/MM')}</p>
            <p className="text-xs text-gray-600">{formatReservationDate(data.check_out_date, 'EEE')}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Noites</p>
            <p className="font-semibold text-gray-900 text-lg">{data.nights}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Hóspedes</p>
            <p className="font-semibold text-gray-900 text-lg">{data.total_guests}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de Pagamentos
function PaymentsSection({ reservationId, onAddPayment }: { reservationId: number; onAddPayment: () => void }) {
  const [payments] = useState(mockPayments); // Substituir por hook real
  const [editingPayment, setEditingPayment] = useState<any>(null);

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    // Abrir modal de edição
  };

  const handleDeletePayment = async (paymentId: number) => {
    // Implementar exclusão
    toast({
      title: 'Pagamento Excluído',
      description: 'O pagamento foi excluído com sucesso.',
      variant: 'default',
    });
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-green-600" />
              Pagamentos
            </CardTitle>
            <Button onClick={onAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhum pagamento registrado</p>
            <Button 
              onClick={onAddPayment} 
              variant="outline" 
              className="mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primeiro Pagamento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-green-600" />
            Pagamentos ({payments.length})
          </CardTitle>
          <Button onClick={onAddPayment} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 bg-green-100 rounded">
                  <CreditCard className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg text-green-600">
                      R$ {payment.amount.toFixed(2)}
                    </span>
                    <StatusBadge status={payment.status} />
                  </div>
                  <p className="text-sm text-gray-600">
                    {PAYMENT_METHOD_LABELS[payment.payment_method as keyof typeof PAYMENT_METHOD_LABELS]}
                    {payment.reference_number && ` • ${payment.reference_number}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(payment.payment_date), 'dd/MM/yyyy HH:mm')}
                </span>
                {payment.payer_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {payment.payer_name}
                  </span>
                )}
              </div>
              
              {payment.notes && (
                <p className="text-sm text-gray-600 mt-2 italic">{payment.notes}</p>
              )}
            </div>
            
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditPayment(payment)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeletePayment(payment.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ReservationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = parseInt(params.id as string);
  
  const { data, loading, error, refresh } = useReservationDetails(reservationId);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    switch (action) {
      case 'cancel':
        setCancelModalOpen(true);
        break;
      case 'edit':
        setEditModalOpen(true);
        break;
      case 'checkin':
        setCheckInModalOpen(true);
        break;
      case 'checkout':
        toast({
          title: 'Em desenvolvimento',
          description: 'Funcionalidade de check-out será implementada em breve.',
          variant: 'default',
        });
        break;
      case 'payment':
        setPaymentModalOpen(true);
        break;
      default:
        console.log('Ação não implementada:', action);
    }
  };

  const handleEditSuccess = async () => {
    setEditModalOpen(false);
    await refresh();
    toast({
      title: 'Sucesso',
      description: 'Reserva atualizada com sucesso',
      variant: 'default',
    });
  };

  const handleCheckInSuccess = async () => {
    setCheckInModalOpen(false);
    await refresh();
    toast({
      title: 'Check-in Realizado',
      description: 'Check-in realizado com sucesso!',
      variant: 'default',
    });
  };

  const handlePaymentSuccess = async () => {
    setPaymentModalOpen(false);
    await refresh();
    toast({
      title: 'Pagamento Registrado',
      description: 'Pagamento registrado com sucesso!',
      variant: 'default',
    });
  };

  const handleCancelConfirm = async (cancelData: {
    cancellation_reason: string;
    refund_amount?: number;
    notes?: string;
  }) => {
    if (!data) return;

    try {
      setActionLoading('cancel');
      await apiClient.cancelReservation(data.id, cancelData);
      toast({
        title: 'Reserva Cancelada',
        description: `A reserva ${data.reservation_number} foi cancelada com sucesso.`,
        variant: 'default',
      });
      await refresh();
    } catch (error: any) {
      toast({
        title: 'Erro ao Cancelar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const getExistingGuestData = () => {
    if (!data?.guest) return undefined;
    return {
      first_name: data.guest.full_name?.split(' ')[0] || '',
      last_name: data.guest.full_name?.split(' ').slice(1).join(' ') || '',
      email: data.guest.email || '',
      phone: data.guest.phone || '',
      document_number: data.guest.document_number || '',
      country: data.guest.nationality || 'Brasil',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-800">{error}</p>
            <Button onClick={refresh} className="mt-3" variant="outline" size="sm">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Reserva não encontrada</p>
            <Button 
              onClick={() => router.push('/dashboard/reservations')} 
              className="mt-3" 
              variant="outline"
            >
              Voltar para Reservas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">Reservas</span>
        <span className="text-gray-400">/</span>
        <span className="font-medium">{data.guest?.full_name || data.reservation_number}</span>
      </div>

      {/* Header melhorado */}
      <ImprovedReservationHeader data={data} onAction={handleAction} />

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do Hóspede */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Dados do Hóspede
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Nome</p>
                  <p className="font-semibold">{data.guest.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-medium">{data.guest.email}</p>
                </div>
                {data.guest.phone && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Telefone</p>
                    <p className="font-medium">{data.guest.phone}</p>
                  </div>
                )}
                {data.guest.nationality && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Nacionalidade</p>
                    <p className="font-medium">{data.guest.nationality}</p>
                  </div>
                )}
                {data.guest.document_type && data.guest.document_number && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      {data.guest.document_type?.toUpperCase()}
                    </p>
                    <p className="font-medium">{data.guest.document_number}</p>
                  </div>
                )}
                {data.guest.full_address && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Endereço</p>
                    <p className="font-medium">{data.guest.full_address}</p>
                  </div>
                )}
              </div>
              
              {/* Estatísticas do hóspede */}
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Histórico do Hóspede</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Reservas</p>
                    <p className="font-bold text-blue-600 text-xl">{data.guest.total_reservations}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Estadias</p>
                    <p className="font-bold text-green-600 text-xl">{data.guest.completed_stays}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Noites</p>
                    <p className="font-bold text-purple-600 text-xl">{data.guest.total_nights}</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Gasto</p>
                    <p className="font-bold text-yellow-600 text-xl">R$ {data.guest.total_spent}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de Pagamentos */}
          <PaymentsSection 
            reservationId={reservationId} 
            onAddPayment={() => setPaymentModalOpen(true)} 
          />
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-6">
          {/* Resumo Financeiro */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total da Reserva</span>
                  <span className="font-bold text-lg">R$ {data.payment.total_amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Valor Pago</span>
                  <span className="font-semibold text-green-600">R$ {data.payment.paid_amount}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Saldo Restante</span>
                    <span className={`font-bold text-lg ${
                      parseFloat(data.payment.balance_due) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      R$ {data.payment.balance_due}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Badge 
                  variant="outline"
                  className={
                    data.payment.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : data.payment.payment_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : 'bg-red-100 text-red-800 border-red-200'
                  }
                >
                  {data.payment.payment_status === 'paid' ? 'Totalmente Pago' 
                   : data.payment.payment_status === 'pending' ? 'Pagamento Pendente'
                   : 'Pagamento em Atraso'}
                </Badge>
              </div>

              {data.payment.is_overdue && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm font-medium">⚠️ Pagamento em atraso</p>
                </div>
              )}

              {data.payment.deposit_required && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm font-medium">💰 Depósito obrigatório</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          {data.guest_requests && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Solicitações do Hóspede</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{data.guest_requests}</p>
              </CardContent>
            </Card>
          )}

          {/* Informações da Reserva */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações da Reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Código da Reserva</p>
                <p className="font-mono font-semibold">{data.reservation_number}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Canal de Origem</p>
                <p className="font-medium capitalize">
                  {data.source === 'direct' ? 'Direto' : data.source || 'Não informado'}
                </p>
              </div>
              
              {data.is_group_reservation && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 text-sm font-medium">👥 Reserva em Grupo</p>
                </div>
              )}

              <div className="pt-3 border-t space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Criada em</p>
                  <p className="font-medium">
                    {format(new Date(data.created_date), 'PPp', { locale: ptBR })}
                  </p>
                </div>

                {data.confirmed_date && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Confirmada em</p>
                    <p className="font-medium">
                      {format(new Date(data.confirmed_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}

                {data.checked_in_date && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Check-in realizado</p>
                    <p className="font-medium">
                      {format(new Date(data.checked_in_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}

                {data.checked_out_date && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Check-out realizado</p>
                    <p className="font-medium">
                      {format(new Date(data.checked_out_date), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Auditoria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.audit_history && data.audit_history.length > 0 ? (
            <div className="space-y-4">
              {data.audit_history.map((audit) => (
                <div key={audit.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold">{audit.description}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(audit.timestamp), 'PPp', { locale: ptBR })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">por {audit.user.name}</p>
                    
                    {audit.old_values && audit.new_values && (
                      <details className="mt-2 cursor-pointer">
                        <summary className="text-sm text-blue-600 hover:text-blue-700">Ver detalhes</summary>
                        <div className="mt-2 p-3 bg-white rounded border text-xs">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-medium mb-1">Antes:</p>
                              <pre className="whitespace-pre-wrap text-gray-600">{JSON.stringify(audit.old_values, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-medium mb-1">Depois:</p>
                              <pre className="whitespace-pre-wrap text-gray-600">{JSON.stringify(audit.new_values, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum histórico de alterações disponível</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <CancelReservationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        reservationNumber={data.reservation_number}
        loading={actionLoading === 'cancel'}
      />

      <EditReservationModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        reservation={data}
      />

      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        onSuccess={handleCheckInSuccess}
        reservationId={data.id.toString()}
        existingGuestData={getExistingGuestData()}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        reservationId={data.id}
        reservationNumber={data.reservation_number}
        totalAmount={parseFloat(data.payment.total_amount) || 0}
        balanceDue={parseFloat(data.payment.balance_due) || 0}
      />
    </div>
  );
}