import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReservationDetailedResponse } from '@/types/reservation-details';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReservationHeaderProps {
  data: ReservationDetailedResponse;
  onAction: (action: string) => void;
}

export function ReservationHeader({ data, onAction }: ReservationHeaderProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-green-100 text-green-800',
      checked_out: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data.reservation_number}
          </h1>
          <p className="text-gray-600 mt-1">
            Criada em {format(new Date(data.created_date), 'PPp', { locale: ptBR })}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(data.status)}>
            {data.status_display}
          </Badge>
          
          {/* Botões de ação baseados em permissions */}
          {data.actions.can_check_in && (
            <Button onClick={() => onAction('checkin')}>
              Check-in
            </Button>
          )}
          {data.actions.can_check_out && (
            <Button onClick={() => onAction('checkout')}>
              Check-out
            </Button>
          )}
          {data.actions.can_edit && (
            <Button variant="outline" onClick={() => onAction('edit')}>
              Editar
            </Button>
          )}
          {data.actions.can_add_payment && (
            <Button variant="outline" onClick={() => onAction('payment')}>
              Pagamento
            </Button>
          )}
        </div>
      </div>

      {/* Timeline das datas importantes */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Check-in</p>
          <p className="font-medium">{format(new Date(data.check_in_date), 'PPP', { locale: ptBR })}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Check-out</p>
          <p className="font-medium">{format(new Date(data.check_out_date), 'PPP', { locale: ptBR })}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Noites</p>
          <p className="font-medium">{data.nights}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Hóspedes</p>
          <p className="font-medium">{data.total_guests}</p>
        </div>
      </div>
    </div>
  );
}