'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReservationDetails } from '@/hooks/useReservationDetails';
import { ReservationHeader } from '@/components/reservations/ReservationHeader';
import CancelReservationModal from '@/components/reservations/CancelReservationModal';
import EditReservationModal from '@/components/reservations/EditReservationModal';
import CheckInModal from '@/components/reservations/CheckInModal';
// ✅ NOVO IMPORT - PaymentModal
import PaymentModal from '@/components/reservations/PaymentModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';

export default function ReservationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = parseInt(params.id as string);
  
  const { data, loading, error, refresh } = useReservationDetails(reservationId);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  // ✅ NOVO ESTADO - PaymentModal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    console.log('Ação:', action);
    
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
        // TODO: Implementar modal de check-out
        toast({
          title: 'Em desenvolvimento',
          description: 'Funcionalidade de check-out será implementada em breve.',
          variant: 'default',
        });
        break;
        
      case 'payment':
        // ✅ NOVO: Abrir modal de pagamento
        setPaymentModalOpen(true);
        break;
        
      default:
        console.log('Ação não implementada:', action);
    }
  };

  const handleEditSuccess = async () => {
    setEditModalOpen(false);
    
    // Recarregar dados da reserva
    await refresh();
    
    toast({
      title: 'Sucesso',
      description: 'Reserva atualizada com sucesso',
      variant: 'default',
    });
  };

  const handleCheckInSuccess = async () => {
    setCheckInModalOpen(false);
    
    // Recarregar dados da reserva
    await refresh();
    
    toast({
      title: 'Check-in Realizado',
      description: 'Check-in realizado com sucesso!',
      variant: 'default',
    });
  };

  // ✅ NOVO HANDLER PARA SUCESSO DO PAGAMENTO
  const handlePaymentSuccess = async () => {
    setPaymentModalOpen(false);
    
    // Recarregar dados da reserva
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
      
      // Atualizar dados da página
      await refresh();
      
    } catch (error: any) {
      console.error('Erro ao cancelar reserva:', error);
      toast({
        title: 'Erro ao Cancelar',
        description: error.response?.data?.detail || 'Erro interno do servidor',
        variant: 'destructive',
      });
      throw error; // Re-throw para o modal tratar
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ PREPARAR DADOS DO HÓSPEDE PARA PRÉ-PREENCHIMENTO
  const getExistingGuestData = () => {
    if (!data?.guest) return undefined;
    
    return {
      first_name: data.guest.full_name?.split(' ')[0] || '',
      last_name: data.guest.full_name?.split(' ').slice(1).join(' ') || '',
      email: data.guest.email || '',
      phone: data.guest.phone || '',
      document_number: data.guest.document_number || '',
      country: data.guest.nationality || 'Brasil',
      // Outros campos podem ser mapeados se disponíveis
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button onClick={refresh} className="mt-2" variant="outline" size="sm">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-500">Reserva não encontrada</p>
          <Button 
            onClick={() => router.push('/dashboard/reservations')} 
            className="mt-2" 
            variant="outline"
          >
            Voltar para Reservas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb e navegação */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">Reservas</span>
          <span className="text-gray-400">/</span>
          <span className="font-medium">{data.reservation_number}</span>
        </div>
      </div>

      {/* Header principal */}
      <ReservationHeader data={data} onAction={handleAction} />

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Coluna principal - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do Hóspede */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Dados do Hóspede</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{data.guest.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{data.guest.email}</p>
              </div>
              {data.guest.phone && (
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium">{data.guest.phone}</p>
                </div>
              )}
              {data.guest.nationality && (
                <div>
                  <p className="text-sm text-gray-500">Nacionalidade</p>
                  <p className="font-medium">{data.guest.nationality}</p>
                </div>
              )}
              {data.guest.document_type && data.guest.document_number && (
                <div>
                  <p className="text-sm text-gray-500">
                    {data.guest.document_type?.toUpperCase()}
                  </p>
                  <p className="font-medium">{data.guest.document_number}</p>
                </div>
              )}
              {data.guest.full_address && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Endereço</p>
                  <p className="font-medium">{data.guest.full_address}</p>
                </div>
              )}
            </div>
            
            {/* Estatísticas do hóspede */}
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Reservas</p>
                  <p className="font-semibold">{data.guest.total_reservations}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estadias</p>
                  <p className="font-semibold">{data.guest.completed_stays}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Noites</p>
                  <p className="font-semibold">{data.guest.total_nights}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Gasto</p>
                  <p className="font-semibold">R$ {data.guest.total_spent}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dados da Propriedade e Quartos */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Propriedade & Acomodação</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">Propriedade</p>
              <p className="font-medium text-lg">{data.property.name}</p>
              <p className="text-gray-600">{data.property.full_address}</p>
              {data.property.phone && (
                <p className="text-gray-600">{data.property.phone}</p>
              )}
              {data.property.email && (
                <p className="text-gray-600">{data.property.email}</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Quartos Reservados</h3>
              {data.rooms.map((room) => (
                <div key={room.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Quarto {room.room_number}</p>
                      <p className="text-sm text-gray-600">{room.room_type_name}</p>
                      <p className="text-sm text-gray-500">
                        Capacidade: {room.max_occupancy} pessoas
                        {room.floor && ` • ${room.floor}º andar`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">R$ {room.total_amount}</p>
                      <p className="text-sm text-gray-500">
                        R$ {room.rate_per_night}/noite
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-6">
          {/* Informações Financeiras */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Financeiro</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-medium">R$ {data.payment.total_amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pago</span>
                <span className="font-medium text-green-600">R$ {data.payment.paid_amount}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-medium">Saldo</span>
                <span className={`font-bold ${
                  parseFloat(data.payment.balance_due) > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  R$ {data.payment.balance_due}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <Badge 
                variant={data.payment.payment_status === 'paid' ? 'default' : 'secondary'}
                className={
                  data.payment.payment_status === 'paid' 
                    ? 'bg-green-100 text-green-800' 
                    : data.payment.payment_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }
              >
                {data.payment.payment_status === 'paid' ? 'Pago' 
                 : data.payment.payment_status === 'pending' ? 'Pendente'
                 : 'Em Atraso'}
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
          </div>

          {/* Observações */}
          {data.guest_requests && (
            <div className="bg-white p-6 rounded-lg border">
              <h2 className="text-lg font-semibold mb-4">Solicitações do Hóspede</h2>
              <p className="text-gray-700">{data.guest_requests}</p>
            </div>
          )}

          {/* Informações da Reserva */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Informações da Reserva</h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Canal de Origem</p>
                <p className="font-medium capitalize">
                  {data.source === 'direct' ? 'Direto' : data.source || 'Não informado'}
                </p>
              </div>
              
              {data.is_group_reservation && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 text-sm font-medium">👥 Reserva em Grupo</p>
                </div>
              )}

              <div className="pt-3 border-t">
                <p className="text-sm text-gray-500">Criada em</p>
                <p className="font-medium">
                  {format(new Date(data.created_date), 'PPp', { locale: ptBR })}
                </p>
              </div>

              {data.confirmed_date && (
                <div>
                  <p className="text-sm text-gray-500">Confirmada em</p>
                  <p className="font-medium">
                    {format(new Date(data.confirmed_date), 'PPp', { locale: ptBR })}
                  </p>
                </div>
              )}

              {data.checked_in_date && (
                <div>
                  <p className="text-sm text-gray-500">Check-in realizado</p>
                  <p className="font-medium">
                    {format(new Date(data.checked_in_date), 'PPp', { locale: ptBR })}
                  </p>
                </div>
              )}

              {data.checked_out_date && (
                <div>
                  <p className="text-sm text-gray-500">Check-out realizado</p>
                  <p className="font-medium">
                    {format(new Date(data.checked_out_date), 'PPp', { locale: ptBR })}
                  </p>
                </div>
              )}

              {data.days_since_checkout && data.days_since_checkout > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 text-sm">
                    Check-out feito há {data.days_since_checkout} dias
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Auditoria */}
      <div className="mt-6 bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Histórico de Alterações</h2>
        
        {data.audit_history && data.audit_history.length > 0 ? (
          <div className="space-y-3">
            {data.audit_history.map((audit) => (
              <div key={audit.id} className="flex gap-4 p-3 border-l-2 border-gray-200">
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="font-medium">{audit.description}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(audit.timestamp), 'PPp', { locale: ptBR })}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">por {audit.user.name}</p>
                  
                  {/* Detalhes das alterações */}
                  {audit.old_values && audit.new_values && (
                    <div className="mt-2 text-xs text-gray-500">
                      <details className="cursor-pointer">
                        <summary className="hover:text-gray-700">Ver detalhes</summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="font-medium">Antes:</p>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(audit.old_values, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-medium">Depois:</p>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(audit.new_values, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Nenhum histórico de alterações disponível</p>
        )}
      </div>

      {/* ===== MODAIS ===== */}
      
      {/* Modal de Cancelamento */}
      <CancelReservationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelConfirm}
        reservationNumber={data.reservation_number}
        loading={actionLoading === 'cancel'}
      />

      {/* Modal de Edição */}
      <EditReservationModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        reservation={data}
      />

      {/* Modal de Check-in */}
      <CheckInModal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        onSuccess={handleCheckInSuccess}
        reservationId={data.id.toString()}
        existingGuestData={getExistingGuestData()}
      />

      {/* ✅ NOVO MODAL DE PAGAMENTO */}
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