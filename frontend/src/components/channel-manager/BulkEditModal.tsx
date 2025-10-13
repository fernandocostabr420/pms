// frontend/src/components/channel-manager/BulkEditModal.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Building,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkEditState, RoomSummary } from '@/types/channel-manager';
import { ChannelManagerDateRangePicker } from '@/components/channel-manager/DateRangePicker';

interface BulkEditModalProps {
  isOpen: boolean;
  state: BulkEditState;
  onUpdateState: (updates: Partial<BulkEditState>) => void;
  onExecute: () => Promise<void>;
  onClose: () => void;
  roomsData: RoomSummary[];
}

export function BulkEditModal({
  isOpen,
  state,
  onUpdateState,
  onExecute,
  onClose,
  roomsData
}: BulkEditModalProps) {

  const [executing, setExecuting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ============== COMPUTED VALUES ==============

  const selectedRoomsCount = state.scope.roomIds.length;
  const dateRange = {
    from: new Date(state.scope.dateRange.from),
    to: new Date(state.scope.dateRange.to)
  };
  const totalDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalCells = selectedRoomsCount * totalDays;

  const selectedRoomsNames = useMemo(() => {
    return roomsData
      .filter(room => state.scope.roomIds.includes(room.room_id))
      .map(room => `${room.room_number} - ${room.room_name}`)
      .join(', ');
  }, [roomsData, state.scope.roomIds]);

  // ============== VALIDATION ==============

  const validateStep = (step: number): string[] => {
    const errors: string[] = [];

    if (step === 1) {
      if (state.scope.roomIds.length === 0) {
        errors.push('Selecione pelo menos um quarto');
      }
      if (dateRange.from >= dateRange.to) {
        errors.push('Data final deve ser posterior à data inicial');
      }
      if (totalDays > 366) {
        errors.push('Período não pode exceder 366 dias');
      }
    }

    if (step === 2) {
      const { actions } = state;
      const hasAnyAction = !!(
        actions.priceAction ||
        actions.availabilityAction ||
        actions.restrictions?.minStay ||
        actions.restrictions?.closedToArrival !== undefined ||
        actions.restrictions?.closedToDeparture !== undefined
      );

      if (!hasAnyAction) {
        errors.push('Defina pelo menos uma ação a ser executada');
      }

      if (actions.priceAction && actions.priceAction !== 'set' && !actions.priceValue) {
        errors.push('Valor de ajuste de preço é obrigatório');
      }

      if (actions.priceAction === 'set' && !actions.priceValue) {
        errors.push('Preço fixo é obrigatório');
      }
    }

    return errors;
  };

  useEffect(() => {
    setValidationErrors(validateStep(state.step));
  }, [state]);

  // ============== HANDLERS ==============

  const handleNextStep = () => {
    const errors = validateStep(state.step);
    if (errors.length === 0) {
      onUpdateState({ step: (state.step + 1) as 1 | 2 | 3 });
    }
  };

  const handlePreviousStep = () => {
    onUpdateState({ step: (state.step - 1) as 1 | 2 | 3 });
  };

  const handleExecute = async () => {
    try {
      setExecuting(true);
      await onExecute();
      onClose();
    } catch (error) {
      console.error('Erro na execução:', error);
    } finally {
      setExecuting(false);
    }
  };

  const handleDateRangeChange = (range: { from: Date; to: Date } | null) => {
    if (range) {
      onUpdateState({
        scope: {
          ...state.scope,
          dateRange: {
            from: format(range.from, 'yyyy-MM-dd'),
            to: format(range.to, 'yyyy-MM-dd')
          }
        }
      });
    }
  };

  const handleRoomSelection = (roomIds: number[]) => {
    onUpdateState({
      scope: {
        ...state.scope,
        roomIds
      }
    });
  };

  // ============== STEP RENDERERS ==============

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            state.step >= step
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-600"
          )}>
            {step}
          </div>
          {step < 3 && (
            <div className={cn(
              "w-16 h-0.5 mx-2",
              state.step > step ? "bg-blue-600" : "bg-gray-200"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Building className="h-5 w-5" />
          Definir Escopo
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Selecione o período e os quartos para aplicar as alterações em massa.
        </p>
      </div>

      {/* Date Range - NOVO COMPONENTE */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Período</Label>
        <ChannelManagerDateRangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
          numberOfMonths={2}
          showPresets={true}
          maxDays={366}
          minDays={1}
        />
        <div className="text-xs text-gray-500">
          {totalDays} dias selecionados
        </div>
      </div>

      {/* Days of Week */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Dias da Semana (opcional)</Label>
        <div className="grid grid-cols-7 gap-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, index) => (
            <div key={index} className="flex items-center space-x-1">
              <Checkbox
                checked={state.scope.daysOfWeek?.includes(index) || false}
                onCheckedChange={(checked) => {
                  const current = state.scope.daysOfWeek || [];
                  const updated = checked
                    ? [...current, index]
                    : current.filter(d => d !== index);
                  onUpdateState({
                    scope: {
                      ...state.scope,
                      daysOfWeek: updated.length > 0 ? updated : undefined
                    }
                  });
                }}
              />
              <Label className="text-xs">{day}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Room Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Quartos</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={state.scope.roomIds.length === roomsData.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleRoomSelection(roomsData.map(r => r.room_id));
                } else {
                  handleRoomSelection([]);
                }
              }}
            />
            <Label className="text-sm font-medium">Selecionar todos</Label>
          </div>
          {roomsData.map((room) => (
            <div key={room.room_id} className="flex items-center space-x-2">
              <Checkbox
                checked={state.scope.roomIds.includes(room.room_id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleRoomSelection([...state.scope.roomIds, room.room_id]);
                  } else {
                    handleRoomSelection(state.scope.roomIds.filter(id => id !== room.room_id));
                  }
                }}
              />
              <Label className="text-sm">
                {room.room_number} - {room.room_name}
              </Label>
              {room.has_channel_mapping && (
                <Badge variant="outline" className="text-xs">Mapeado</Badge>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500">
          {selectedRoomsCount} quartos selecionados
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Definir Ações
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure as alterações que serão aplicadas aos quartos selecionados.
        </p>
      </div>

      {/* Price Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={state.actions.priceAction || 'none'}
            onValueChange={(value) => onUpdateState({
              actions: {
                ...state.actions,
                priceAction: value === 'none' ? undefined : value as any
              }
            })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="price-none" />
              <Label htmlFor="price-none">Manter preços atuais</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="set" id="price-set" />
              <Label htmlFor="price-set">Definir preço fixo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="increase" id="price-increase" />
              <Label htmlFor="price-increase">Aumentar preço</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="decrease" id="price-decrease" />
              <Label htmlFor="price-decrease">Diminuir preço</Label>
            </div>
          </RadioGroup>

          {state.actions.priceAction && state.actions.priceAction !== 'none' && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Valor"
                value={state.actions.priceValue || ''}
                onChange={(e) => onUpdateState({
                  actions: {
                    ...state.actions,
                    priceValue: parseFloat(e.target.value) || undefined
                  }
                })}
                className="w-32"
              />
              <span className="text-sm text-gray-600">
                {state.actions.priceAction === 'set' ? 'R$' : 
                 state.actions.priceAction === 'increase' ? '+ R$' : '- R$'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Availability Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Disponibilidade</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={state.actions.availabilityAction || 'none'}
            onValueChange={(value) => onUpdateState({
              actions: {
                ...state.actions,
                availabilityAction: value === 'none' ? undefined : value as any
              }
            })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="avail-none" />
              <Label htmlFor="avail-none">Manter disponibilidade atual</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="open" id="avail-open" />
              <Label htmlFor="avail-open">Abrir todos os quartos</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="close" id="avail-close" />
              <Label htmlFor="avail-close">Fechar todos os quartos</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Restrictions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Restrições</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Estadia Mínima</Label>
              <Input
                type="number"
                min="1"
                max="30"
                placeholder="Noites"
                value={state.actions.restrictions?.minStay || ''}
                onChange={(e) => onUpdateState({
                  actions: {
                    ...state.actions,
                    restrictions: {
                      ...state.actions.restrictions,
                      minStay: parseInt(e.target.value) || undefined
                    }
                  }
                })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={state.actions.restrictions?.closedToArrival || false}
                onCheckedChange={(checked) => onUpdateState({
                  actions: {
                    ...state.actions,
                    restrictions: {
                      ...state.actions.restrictions,
                      closedToArrival: checked as boolean
                    }
                  }
                })}
              />
              <Label className="text-sm">Fechado para chegada (CTA)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={state.actions.restrictions?.closedToDeparture || false}
                onCheckedChange={(checked) => onUpdateState({
                  actions: {
                    ...state.actions,
                    restrictions: {
                      ...state.actions.restrictions,
                      closedToDeparture: checked as boolean
                    }
                  }
                })}
              />
              <Label className="text-sm">Fechado para saída (CTD)</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Confirmar Alterações
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Revise as alterações antes de aplicá-las. Esta ação não pode ser desfeita.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="font-medium">Quartos selecionados:</Label>
              <p className="text-gray-600">{selectedRoomsCount} quartos</p>
            </div>
            <div>
              <Label className="font-medium">Período:</Label>
              <p className="text-gray-600">{totalDays} dias</p>
            </div>
            <div>
              <Label className="font-medium">Total de células:</Label>
              <p className="text-gray-600 font-bold">{totalCells} células</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="font-medium">Quartos:</Label>
            <p className="text-sm text-gray-600 mt-1">{selectedRoomsNames}</p>
          </div>

          <div className="border-t pt-4">
            <Label className="font-medium">Período:</Label>
            <p className="text-sm text-gray-600 mt-1">
              {format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} até{" "}
              {format(dateRange.to, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label className="font-medium">Ações:</Label>
            {state.actions.priceAction && (
              <div className="text-sm text-gray-600">
                • Preço: {state.actions.priceAction === 'set' ? 'Fixar em' : 
                         state.actions.priceAction === 'increase' ? 'Aumentar' : 'Diminuir'} R$ {state.actions.priceValue}
              </div>
            )}
            {state.actions.availabilityAction && (
              <div className="text-sm text-gray-600">
                • Disponibilidade: {state.actions.availabilityAction === 'open' ? 'Abrir quartos' : 'Fechar quartos'}
              </div>
            )}
            {state.actions.restrictions?.minStay && (
              <div className="text-sm text-gray-600">
                • Estadia mínima: {state.actions.restrictions.minStay} noites
              </div>
            )}
            {state.actions.restrictions?.closedToArrival && (
              <div className="text-sm text-gray-600">
                • Aplicar: Fechado para chegada (CTA)
              </div>
            )}
            {state.actions.restrictions?.closedToDeparture && (
              <div className="text-sm text-gray-600">
                • Aplicar: Fechado para saída (CTD)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Atenção:</strong> Esta operação irá modificar {totalCells} células no calendário.
          As alterações serão sincronizadas automaticamente com os canais conectados.
          Esta ação não pode ser desfeita.
        </AlertDescription>
      </Alert>
    </div>
  );

  // ============== MAIN RENDER ==============

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Edição em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {renderStepIndicator()}

          {state.step === 1 && renderStep1()}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {state.step > 1 && (
              <Button variant="outline" onClick={handlePreviousStep}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {state.step < 3 ? (
              <Button 
                onClick={handleNextStep}
                disabled={validationErrors.length > 0}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleExecute}
                disabled={executing || validationErrors.length > 0}
                className="bg-red-600 hover:bg-red-700"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Executar Alterações
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}