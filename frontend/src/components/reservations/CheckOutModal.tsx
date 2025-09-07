// frontend/src/components/reservations/CheckOutModal.tsx

import React, { useState, useEffect } from 'react';
import { X, LogOut, AlertTriangle, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reservationId: number;
  reservationNumber: string;
  balanceDue: number;
  totalAmount: number;
}

interface CheckOutFormData {
  notes: string;
  final_charges: string;
}

const CheckOutModal: React.FC<CheckOutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reservationId,
  reservationNumber,
  balanceDue,
  totalAmount
}) => {
  // Estados do formulário
  const [formData, setFormData] = useState<CheckOutFormData>({
    notes: '',
    final_charges: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Função para formatação de moeda
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calcular o limite permitido de dívida (10% do valor total)
  const maxAllowedDebt = totalAmount * 0.10;
  const currentDebt = balanceDue;
  const finalChargesValue = parseFloat(formData.final_charges) || 0;
  const finalDebt = currentDebt + finalChargesValue;
  
  // Verificar se o check-out é permitido
  const isCheckOutAllowed = finalDebt <= maxAllowedDebt;

  // Reset do formulário quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setFormData({
        notes: '',
        final_charges: ''
      });
      setValidationError(null);
    }
  }, [isOpen]);

  // Validação em tempo real
  useEffect(() => {
    if (finalDebt > maxAllowedDebt) {
      setValidationError(
        `Dívida de ${formatCurrency(finalDebt)} excede o limite de 10% do valor total (${formatCurrency(maxAllowedDebt)}). Registre pagamentos antes de prosseguir.`
      );
    } else {
      setValidationError(null);
    }
  }, [finalDebt, maxAllowedDebt]);

  const handleInputChange = (field: keyof CheckOutFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCheckOutAllowed) {
      toast({
        title: 'Check-out não permitido',
        description: validationError || 'Dívida excede o limite permitido.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Preparar dados para envio
      const checkOutData = {
        actual_check_out_time: new Date().toISOString(),
        notes: formData.notes.trim() || undefined,
        final_charges: finalChargesValue > 0 ? finalChargesValue : undefined
      };

      // Chamar API
      await apiClient.checkOutReservation(reservationId, checkOutData);

      toast({
        title: 'Check-out realizado!',
        description: `Check-out da reserva ${reservationNumber} foi realizado com sucesso.`,
        variant: 'default',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao realizar check-out:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Erro interno do servidor';
      
      toast({
        title: 'Erro ao realizar check-out',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <LogOut className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Realizar Check-out</h2>
              <p className="text-sm text-gray-600">Reserva: {reservationNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Resumo Financeiro */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Resumo Financeiro
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total da Reserva:</p>
                <p className="font-semibold text-lg">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-gray-600">Saldo Atual:</p>
                <p className={`font-semibold text-lg ${currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(currentDebt)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Limite Permitido (10%):</p>
                <p className="font-medium">{formatCurrency(maxAllowedDebt)}</p>
              </div>
              <div>
                <p className="text-gray-600">Taxas Finais:</p>
                <p className="font-medium">{formatCurrency(finalChargesValue)}</p>
              </div>
            </div>

            {finalChargesValue > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Saldo Final:</span>
                  <span className={`font-bold text-lg ${finalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(finalDebt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Alerta de validação */}
          {!isCheckOutAllowed && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Status do check-out */}
          {isCheckOutAllowed ? (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  ✅ Check-out Liberado
                </Badge>
                <span className="text-sm text-green-700">
                  Saldo dentro do limite permitido
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  ❌ Check-out Bloqueado
                </Badge>
                <span className="text-sm text-red-700">
                  Registre pagamentos para liberar o check-out
                </span>
              </div>
            </div>
          )}

          {/* Taxas Finais */}
          <div className="mb-6">
            <Label htmlFor="final-charges" className="text-sm font-medium text-gray-700 mb-2 block">
              Taxas Finais (Opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                R$
              </span>
              <Input
                id="final-charges"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={formData.final_charges}
                onChange={(e) => handleInputChange('final_charges', e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Adicione taxas extras como frigobar, danos, etc.
            </p>
          </div>

          {/* Observações */}
          <div className="mb-6">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações do Check-out
            </Label>
            <Textarea
              id="notes"
              placeholder="Observações sobre o check-out, condições do quarto, itens deixados pelo hóspede, etc."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !isCheckOutAllowed}
              className={`${
                isCheckOutAllowed 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Realizando Check-out...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Realizar Check-out
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckOutModal;