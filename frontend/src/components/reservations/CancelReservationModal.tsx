// frontend/src/components/reservations/CancelReservationModal.tsx

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface CancelReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { cancellation_reason: string; refund_amount?: number; notes?: string }) => Promise<void>;
  reservationNumber?: string;
  loading?: boolean;
}

export default function CancelReservationModal({
  isOpen,
  onClose,
  onConfirm,
  reservationNumber,
  loading = false
}: CancelReservationModalProps) {
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = () => {
    if (cancellationReason.trim().length < 10) {
      return; // Validação já mostra erro
    }
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    try {
      await onConfirm({
        cancellation_reason: cancellationReason.trim(),
        refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
        notes: notes.trim() || undefined,
      });
      handleClose();
    } catch (error) {
      // Erro será tratado pelo componente pai
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCancellationReason('');
      setRefundAmount('');
      setNotes('');
      setShowConfirmation(false);
      onClose();
    }
  };

  const isValid = cancellationReason.trim().length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {!showConfirmation ? (
          // ===== ETAPA 1: COLETA DE DADOS =====
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Cancelar Reserva
              </DialogTitle>
              <DialogDescription>
                {reservationNumber && `Reserva: ${reservationNumber}`}
                <br />
                Esta ação não pode ser desfeita. Por favor, forneça os detalhes do cancelamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Motivo do cancelamento - OBRIGATÓRIO */}
              <div className="space-y-2">
                <Label htmlFor="cancellation-reason">
                  Motivo do Cancelamento *
                </Label>
                <Textarea
                  id="cancellation-reason"
                  placeholder="Descreva o motivo do cancelamento (mínimo 10 caracteres)..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  rows={3}
                  className={`resize-none ${
                    cancellationReason && cancellationReason.trim().length < 10
                      ? 'border-red-300 focus:border-red-500'
                      : ''
                  }`}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {cancellationReason.trim().length < 10 && cancellationReason.length > 0 && (
                      <span className="text-red-500">
                        Mínimo 10 caracteres necessários
                      </span>
                    )}
                  </span>
                  <span>
                    {cancellationReason.length}/500
                  </span>
                </div>
              </div>

              {/* Valor do reembolso - OPCIONAL */}
              <div className="space-y-2">
                <Label htmlFor="refund-amount">
                  Valor do Reembolso (R$)
                  <span className="text-gray-500 text-sm ml-1">(opcional)</span>
                </Label>
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

              {/* Observações extras - OPCIONAL */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Observações Adicionais
                  <span className="text-gray-500 text-sm ml-1">(opcional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Observações internas sobre o cancelamento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Voltar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSubmit}
                disabled={!isValid || loading}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ===== ETAPA 2: CONFIRMAÇÃO FINAL =====
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Confirmar Cancelamento
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja cancelar esta reserva?
              </DialogDescription>
            </DialogHeader>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Atenção:</strong> Esta ação é irreversível. A reserva será marcada como cancelada
                e não poderá ser reativada.
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg text-sm">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Motivo:</span> {cancellationReason}
                </div>
                {refundAmount && (
                  <div>
                    <span className="font-medium">Reembolso:</span> R$ {parseFloat(refundAmount).toFixed(2)}
                  </div>
                )}
                {notes && (
                  <div>
                    <span className="font-medium">Observações:</span> {notes}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmation(false)}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelamento'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}