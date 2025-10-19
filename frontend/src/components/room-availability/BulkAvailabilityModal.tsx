// frontend/src/components/room-availability/BulkAvailabilityModal.tsx
// 📦 COMPONENTE OPCIONAL - Para atualização em massa de disponibilidades

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CalendarDays, DollarSign, Upload } from 'lucide-react';
import { BulkAvailabilityUpdate } from '@/types/room-availability';
import { RoomResponse } from '@/types/api';
import apiClient from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const bulkUpdateSchema = z.object({
  room_ids: z.array(z.number()).min(1, 'Pelo menos um quarto deve ser selecionado'),
  date_from: z.string().min(1, 'Data inicial é obrigatória'),
  date_to: z.string().min(1, 'Data final é obrigatória'),
  
  // Status (opcionais)
  is_available: z.boolean().optional(),
  is_blocked: z.boolean().optional(),
  is_out_of_order: z.boolean().optional(),
  is_maintenance: z.boolean().optional(),
  
  // Preços
  rate_override: z.number().min(0).optional().or(z.literal('')),
  min_stay: z.number().min(1).max(30).optional().or(z.literal('')),
  max_stay: z.number().min(1).max(365).optional().or(z.literal('')),
  
  // Restrições
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  
  // Informações
  reason: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
}).refine((data) => new Date(data.date_to) >= new Date(data.date_from), {
  message: "Data final deve ser posterior à data inicial",
  path: ["date_to"],
});

type BulkUpdateFormData = z.infer<typeof bulkUpdateSchema>;

interface BulkAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkAvailabilityModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: BulkAvailabilityModalProps) {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [updateFields, setUpdateFields] = useState<string[]>([]);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BulkUpdateFormData>({
    resolver: zodResolver(bulkUpdateSchema),
  });

  const watchedValues = watch();

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        setLoadingData(true);
        const response = await apiClient.getRooms();
        setRooms(response.rooms);
      } catch (error) {
        console.error('Erro ao carregar quartos:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar quartos",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };

    if (isOpen) {
      loadRooms();
    }
  }, [isOpen, toast]);

  // Update form when selected rooms change
  useEffect(() => {
    setValue('room_ids', selectedRooms);
  }, [selectedRooms, setValue]);

  const toggleRoom = (roomId: number) => {
    setSelectedRooms(prev => 
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const selectAllRooms = () => {
    setSelectedRooms(rooms.map(room => room.id));
  };

  const clearSelection = () => {
    setSelectedRooms([]);
  };

  const toggleUpdateField = (field: string) => {
    setUpdateFields(prev => 
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const onSubmit = async (data: BulkUpdateFormData) => {
    try {
      setLoading(true);

      // Filter only selected update fields
      const bulkData: BulkAvailabilityUpdate = {
        room_ids: data.room_ids,
        date_from: data.date_from,
        date_to: data.date_to,
      };

      // Only include fields that are selected for update
      if (updateFields.includes('status')) {
        if (data.is_available !== undefined) bulkData.is_available = data.is_available;
        if (data.is_blocked !== undefined) bulkData.is_blocked = data.is_blocked;
        if (data.is_out_of_order !== undefined) bulkData.is_out_of_order = data.is_out_of_order;
        if (data.is_maintenance !== undefined) bulkData.is_maintenance = data.is_maintenance;
      }

      if (updateFields.includes('pricing')) {
        if (data.rate_override !== '' && data.rate_override !== undefined) {
          bulkData.rate_override = Number(data.rate_override);
        }
        if (data.min_stay !== '' && data.min_stay !== undefined) {
          bulkData.min_stay = Number(data.min_stay);
        }
        if (data.max_stay !== '' && data.max_stay !== undefined) {
          bulkData.max_stay = Number(data.max_stay);
        }
      }

      if (updateFields.includes('restrictions')) {
        if (data.closed_to_arrival !== undefined) bulkData.closed_to_arrival = data.closed_to_arrival;
        if (data.closed_to_departure !== undefined) bulkData.closed_to_departure = data.closed_to_departure;
      }

      if (updateFields.includes('notes')) {
        if (data.reason) bulkData.reason = data.reason;
        if (data.notes) bulkData.notes = data.notes;
      }

      const result = await apiClient.bulkUpdateAvailability(bulkData);

      toast({
        title: "Sucesso!",
        description: `${result.updated} disponibilidades atualizadas, ${result.created} criadas.`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro na atualização em massa:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.detail || 'Erro na atualização em massa',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    setSelectedRooms([]);
    setUpdateFields([]);
    onClose();
  };

  const selectedRoomsCount = selectedRooms.length;
  const totalDays = watchedValues.date_from && watchedValues.date_to
    ? Math.ceil((new Date(watchedValues.date_to).getTime() - new Date(watchedValues.date_from).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Atualização em Massa de Disponibilidades
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Seleção de quartos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Quartos ({selectedRoomsCount} selecionados)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllRooms}
                  disabled={loading || loadingData}
                >
                  Selecionar Todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={loading || selectedRoomsCount === 0}
                >
                  Limpar Seleção
                </Button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto border rounded-lg p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                      selectedRooms.includes(room.id)
                        ? 'bg-blue-100 border border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => toggleRoom(room.id)}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedRooms.includes(room.id)}
                        onChange={() => toggleRoom(room.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium">
                        {room.room_number} - {room.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errors.room_ids && (
              <p className="text-sm text-red-500">{errors.room_ids.message}</p>
            )}
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_from">Data Inicial *</Label>
              <Input
                id="date_from"
                type="date"
                {...register('date_from')}
                disabled={loading}
              />
              {errors.date_from && (
                <p className="text-sm text-red-500 mt-1">{errors.date_from.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date_to">Data Final *</Label>
              <Input
                id="date_to"
                type="date"
                {...register('date_to')}
                disabled={loading}
              />
              {errors.date_to && (
                <p className="text-sm text-red-500 mt-1">{errors.date_to.message}</p>
              )}
            </div>
          </div>

          {/* Resumo */}
          {selectedRoomsCount > 0 && totalDays > 0 && (
            <Alert>
              <CalendarDays className="h-4 w-4" />
              <AlertDescription>
                Esta operação irá afetar <strong>{selectedRoomsCount} quartos</strong> durante <strong>{totalDays} dias</strong>,
                totalizando <strong>{selectedRoomsCount * totalDays} registros de disponibilidade</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Campos para atualizar */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Campos para Atualizar</Label>
            
            {/* Status */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="update_status"
                  checked={updateFields.includes('status')}
                  onChange={() => toggleUpdateField('status')}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="update_status" className="font-medium">Status de Disponibilidade</Label>
              </div>
              
              {updateFields.includes('status') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="bulk_is_available"
                      checked={watchedValues.is_available || false}
                      onCheckedChange={(checked) => setValue('is_available', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="bulk_is_available" className="text-sm">Disponível</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="bulk_is_blocked"
                      checked={watchedValues.is_blocked || false}
                      onCheckedChange={(checked) => setValue('is_blocked', checked)}
                      disabled={loading}
                    />
                    <Label htmlFor="bulk_is_blocked" className="text-sm">Bloqueado</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Add other update sections as needed */}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingData || selectedRoomsCount === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar {selectedRoomsCount} Quartos
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}