// frontend/src/components/booking/SearchWidget.tsx
'use client';

import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Users, Baby, Hotel, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import type { SearchParams, PropertyPublicInfo } from '@/types/booking';
import { cn } from '@/lib/utils';

interface SearchWidgetProps {
  onSearch: (params: SearchParams) => void;
  loading?: boolean;
  initialParams?: SearchParams;
  property: PropertyPublicInfo;
}

export default function SearchWidget({
  onSearch,
  loading = false,
  initialParams,
  property,
}: SearchWidgetProps) {
  const minStay = property.booking_config.booking_settings.default_min_stay || 1;
  const maxStay = property.booking_config.booking_settings.default_max_stay || 90;
  
  const [checkIn, setCheckIn] = useState<Date | undefined>(
    initialParams?.check_in ? new Date(initialParams.check_in) : undefined
  );
  const [checkOut, setCheckOut] = useState<Date | undefined>(
    initialParams?.check_out ? new Date(initialParams.check_out) : undefined
  );
  const [adults, setAdults] = useState(initialParams?.adults || 2);
  const [children, setChildren] = useState(initialParams?.children || 0);
  const [rooms, setRooms] = useState(initialParams?.rooms || 1);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  // Auto-definir check-out quando check-in for selecionado
  useEffect(() => {
    if (checkIn && !checkOut) {
      setCheckOut(addDays(checkIn, minStay));
    }
  }, [checkIn, checkOut, minStay]);

  const handleSearch = () => {
    if (!checkIn || !checkOut) {
      return;
    }

    const params: SearchParams = {
      check_in: format(checkIn, 'yyyy-MM-dd'),
      check_out: format(checkOut, 'yyyy-MM-dd'),
      adults,
      children,
      rooms,
    };

    onSearch(params);
  };

  const totalGuests = adults + children;
  const nights = checkIn && checkOut 
    ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const canSearch = checkIn && checkOut && adults > 0;

  return (
    <Card className="shadow-lg">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Check-in */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Check-in</Label>
            <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !checkIn && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkIn ? format(checkIn, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkIn}
                  onSelect={(date) => {
                    setCheckIn(date);
                    setCheckInOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Check-out */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Check-out</Label>
            <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !checkOut && 'text-muted-foreground'
                  )}
                  disabled={!checkIn}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkOut ? format(checkOut, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={checkOut}
                  onSelect={(date) => {
                    setCheckOut(date);
                    setCheckOutOpen(false);
                  }}
                  disabled={(date) => 
                    !checkIn || 
                    date <= checkIn || 
                    date > addDays(checkIn, maxStay)
                  }
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hóspedes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hóspedes</Label>
            <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Users className="mr-2 h-4 w-4" />
                  {totalGuests} {totalGuests === 1 ? 'hóspede' : 'hóspedes'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  {/* Adultos */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Adultos</p>
                        <p className="text-xs text-gray-500">A partir de 13 anos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdults(Math.max(1, adults - 1))}
                        disabled={adults <= 1}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{adults}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdults(Math.min(10, adults + 1))}
                        disabled={adults >= 10}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Crianças */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Crianças</p>
                        <p className="text-xs text-gray-500">0 a 12 anos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChildren(Math.max(0, children - 1))}
                        disabled={children <= 0}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{children}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChildren(Math.min(10, children + 1))}
                        disabled={children >= 10}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Quartos */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">Quartos</p>
                        <p className="text-xs text-gray-500">Quantidade desejada</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRooms(Math.max(1, rooms - 1))}
                        disabled={rooms <= 1}
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{rooms}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRooms(Math.min(5, rooms + 1))}
                        disabled={rooms >= 5}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => setGuestsOpen(false)}
                    className="w-full"
                  >
                    Confirmar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Info rápida */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Informações</Label>
            <div className="flex flex-col justify-center h-10 px-3 bg-gray-50 rounded-md border">
              <p className="text-sm text-gray-600">
                {nights > 0 && `${nights} ${nights === 1 ? 'noite' : 'noites'}`}
              </p>
              <p className="text-xs text-gray-500">
                {rooms} {rooms === 1 ? 'quarto' : 'quartos'}
              </p>
            </div>
          </div>

          {/* Botão de busca */}
          <div className="space-y-2 flex items-end">
            <Button
              onClick={handleSearch}
              disabled={!canSearch || loading}
              className="w-full h-10"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mensagem de estadia mínima */}
        {minStay > 1 && (
          <p className="text-xs text-gray-500 mt-3">
            * Estadia mínima: {minStay} {minStay === 1 ? 'noite' : 'noites'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}