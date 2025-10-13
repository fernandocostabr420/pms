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
  Info,
  Ban
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
  const totalCells = selectedRoomsCount * totalDays * 5; // ✅ 5 linhas por célula

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

      if (actions.restrictions?.minStay && (actions.restrictions.minStay < 1 || actions.restrictions.minStay > 30)) {
        errors.push('Estadia mínima deve estar entre 1 e 30 noites');
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
    } catch (error: any) {
      console.error('Erro na execução:', error);
      alert(error.message || 'Erro ao executar edição em massa');
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
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
            state.step >= step
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-600"
          )}>
            {step}
          </div>
          {step < 3 && (
            <div className={cn(
              "w-16 h-0.5 mx-2 transition-all",
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

      {/* Date Range */}
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
            <div key={index} className="flex flex-col items-center space-y-1">
              <Label className="text-xs">{day}</Label>
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
            </div>
          ))}
        </div>
        {state.scope.daysOfWeek && state.scope.daysOfWeek.length > 0 && (
          <p className="text-xs text-blue-600">
            Alterações serão aplicadas apenas aos dias selecionados
          </p>
        )}
      </div>

      {/* Room Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Quartos</Label>
        <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
          <div className="flex items-center space-x-2 pb-2 border-b sticky top-0 bg-white">
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
            <Label className="text-sm font-medium">Selecionar todos ({roomsData.length})</Label>
          </div>
          {roomsData.map((room) => (
            <div key={room.room_id} className="flex items-center justify-between space-x-2 p-2 hover:bg-gray-50 rounded">
              <div className="flex items-center space-x-2">
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
                <Label className="text-sm cursor-pointer">
                  {room.room_number} - {room.room_name}
                </Label>
              </div>
              {room.has_channel_mapping && (
                <Badge variant="outline" className="text-xs">Mapeado</Badge>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 flex items-center justify-between">
          <span>{selectedRoomsCount} quartos selecionados</span>
          <span className="font-medium">{totalCells} células serão afetadas</span>
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
          Configure as alterações que serão aplicadas. Você pode combinar múltiplas ações.
        </p>
      </div>

      {/* LINHA 1: Preços */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Linha 1: Preços
          </CardTitle>
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
                {state.actions.priceAction === 'set' ? 'R$ (valor fixo)' : 
                 state.actions.priceAction === 'increase' ? '+ R$ (aumento)' : '- R$ (desconto)'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LINHA 2: Disponibilidade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4" />
            Linha 2: Disponibilidade
          </CardTitle>
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
              <Label htmlFor="avail-open">Abrir todos os quartos (disponível = 1)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="close" id="avail-close" />
              <Label htmlFor="avail-close">Fechar todos os quartos (bloqueado = 0)</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* LINHAS 3, 4, 5: Restrições */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Linhas 3, 4, 5: Restrições
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Linha 3: Estadia Mínima */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Linha 3: Estadia Mínima
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="30"
                placeholder="Deixe vazio para não alterar"
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
                className="w-32"
              />
              <span className="text-sm text-gray-600">noites mínimas</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            {/* Linha 4: CTA */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="cta-checkbox"
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
              <div className="flex-1">
                <Label htmlFor="cta-checkbox" className="text-sm font-medium cursor-pointer">
                  Linha 4: Fechado para Chegada (CTA)
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  Impede que hóspedes façam check-in nas datas selecionadas
                </p>
              </div>
            </div>

            {/* Linha 5: CTD */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="ctd-checkbox"
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
              <div className="flex-1">
                <Label htmlFor="ctd-checkbox" className="text-sm font-medium cursor-pointer">
                  Linha 5: Fechado para Saída (CTD)
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  Impede que hóspedes façam check-out nas datas selecionadas
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info sobre combinações */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Dica:</strong> Você pode combinar múltiplas ações. Por exemplo: definir preço fixo + fechar para chegada + estadia mínima de 3 noites.
        </AlertDescription>
      </Alert>
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
          Revise as alterações antes de aplicá-las. Esta ação modificará o calendário e será sincronizada com os canais.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{selectedRoomsCount}</div>
              <div className="text-xs text-gray-600">Quartos</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{totalDays}</div>
              <div className="text-xs text-gray-600">Dias</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{totalCells}</div>
              <div className="text-xs text-gray-600">Células (5 linhas × {selectedRoomsCount} × {totalDays})</div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="font-medium">Quartos selecionados:</Label>
            <p className="text-sm text-gray-600 mt-1 max-h-20 overflow-y-auto">{selectedRoomsNames}</p>
          </div>

          <div className="border-t pt-4">
            <Label className="font-medium">Período:</Label>
            <p className="text-sm text-gray-600 mt-1">
              {format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} até{" "}
              {format(dateRange.to, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label className="font-medium">Ações a serem executadas:</Label>
            
            {state.actions.priceAction && (
              <div className="flex items-start gap-2 text-sm p-2 bg-green-50 border border-green-200 rounded">
                <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium text-green-900">Linha 1: Preço</div>
                  <div className="text-green-700">
                    {state.actions.priceAction === 'set' ? 'Fixar em' : 
                     state.actions.priceAction === 'increase' ? 'Aumentar' : 'Diminuir'} R$ {state.actions.priceValue}
                  </div>
                </div>
              </div>
            )}
            
            {state.actions.availabilityAction && (
              <div className="flex items-start gap-2 text-sm p-2 bg-blue-50 border border-blue-200 rounded">
                <Building className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-900">Linha 2: Disponibilidade</div>
                  <div className="text-blue-700">
                    {state.actions.availabilityAction === 'open' ? 'Abrir quartos (1)' : 'Fechar quartos (0)'}
                  </div>
                </div>
              </div>
            )}
            
            {state.actions.restrictions?.minStay && (
              <div className="flex items-start gap-2 text-sm p-2 bg-purple-50 border border-purple-200 rounded">
                <Clock className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <div className="font-medium text-purple-900">Linha 3: Estadia Mínima</div>
                  <div className="text-purple-700">{state.actions.restrictions.minStay} noites</div>
                </div>
              </div>
            )}
            
            {state.actions.restrictions?.closedToArrival && (
              <div className="flex items-start gap-2 text-sm p-2 bg-orange-50 border border-orange-200 rounded">
                <Ban className="h-4 w-4 text-orange-600 mt-0.5" />
                <div>
                  <div className="font-medium text-orange-900">Linha 4: Fechado para Chegada</div>
                  <div className="text-orange-700">Aplicar CTA (Closed to Arrival)</div>
                </div>
              </div>
            )}
            
            {state.actions.restrictions?.closedToDeparture && (
              <div className="flex items-start gap-2 text-sm p-2 bg-red-50 border border-red-200 rounded">
                <Ban className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900">Linha 5: Fechado para Saída</div>
                  <div className="text-red-700">Aplicar CTD (Closed to Departure)</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Atenção:</strong> Esta operação irá modificar <strong>{totalCells} células</strong> no calendário ({selectedRoomsCount} quartos × {totalDays} dias × 5 linhas).
          As alterações serão sincronizadas automaticamente com os canais conectados.
          <strong> Esta ação não pode ser desfeita.</strong>
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
            Edição em Massa - {['Escopo', 'Ações', 'Confirmar'][state.step - 1]}
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
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-2">
            {state.step > 1 && (
              <Button variant="outline" onClick={handlePreviousStep} disabled={executing}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={executing}>
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
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar e Executar
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