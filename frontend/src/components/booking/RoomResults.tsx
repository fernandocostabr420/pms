// frontend/src/components/booking/RoomResults.tsx
'use client';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Wifi, 
  Wind, 
  Tv, 
  Coffee,
  Bed,
  DollarSign,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import type { RoomAvailable, SearchParams, PropertyPublicInfo } from '@/types/booking';
import Image from 'next/image';

interface RoomResultsProps {
  rooms: RoomAvailable[];
  searchParams: SearchParams;
  onSelectRoom: (room: RoomAvailable) => void;
  propertyInfo: PropertyPublicInfo;
}

export default function RoomResults({
  rooms,
  searchParams,
  onSelectRoom,
  propertyInfo,
}: RoomResultsProps) {
  const primaryColor = propertyInfo.booking_config.branding.primary_color || '#2563eb';

  // Mapeamento de ícones para comodidades
  const getAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return Wifi;
    if (lower.includes('ar') || lower.includes('climatizado')) return Wind;
    if (lower.includes('tv')) return Tv;
    if (lower.includes('café') || lower.includes('coffee')) return Coffee;
    return CheckCircle2;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header dos resultados */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Quartos Disponíveis
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {rooms.length} {rooms.length === 1 ? 'opção encontrada' : 'opções encontradas'} 
            {' '}para {searchParams.adults} {searchParams.adults === 1 ? 'adulto' : 'adultos'}
            {searchParams.children > 0 && ` e ${searchParams.children} ${searchParams.children === 1 ? 'criança' : 'crianças'}`}
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-600">
            <Calendar className="inline h-4 w-4 mr-1" />
            {searchParams.check_in} até {searchParams.check_out}
          </p>
        </div>
      </div>

      {/* Lista de quartos */}
      <div className="grid gap-6">
        {rooms.map((room) => (
          <Card key={room.room.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="grid md:grid-cols-[300px_1fr] gap-4">
              
              {/* Imagem do quarto */}
              <div className="relative h-64 md:h-full bg-gray-200">
                {room.room.photos && room.room.photos.length > 0 ? (
                  <Image
                    src={room.room.photos[0]}
                    alt={room.room.room_type_name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Bed className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                
                {/* Badge de capacidade */}
                <div className="absolute top-3 left-3">
                  <Badge className="bg-white text-gray-900">
                    <Users className="h-3 w-3 mr-1" />
                    Até {room.room.max_occupancy} pessoas
                  </Badge>
                </div>
              </div>

              {/* Informações do quarto */}
              <div className="p-6 flex flex-col">
                <CardContent className="flex-1 p-0">
                  
                  {/* Título e tipo */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {room.room.room_type_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Quarto {room.room.room_number}
                    </p>
                  </div>

                  {/* Descrição */}
                  {room.room.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {room.room.description}
                    </p>
                  )}

                  {/* Comodidades */}
                  {room.room.amenities && room.room.amenities.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {room.room.amenities.slice(0, 6).map((amenity, idx) => {
                          const Icon = getAmenityIcon(amenity);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded"
                            >
                              <Icon className="h-3 w-3" />
                              <span>{amenity}</span>
                            </div>
                          );
                        })}
                        {room.room.amenities.length > 6 && (
                          <div className="text-xs text-gray-500 px-2 py-1">
                            +{room.room.amenities.length - 6} mais
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Plano de tarifa */}
                  {room.rate_plan && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium text-blue-900">
                        {room.rate_plan.name}
                      </p>
                      {room.rate_plan.description && (
                        <p className="text-xs text-blue-700 mt-1">
                          {room.rate_plan.description}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>

                {/* Footer com preço e ação */}
                <CardFooter className="p-0 pt-4 border-t flex items-end justify-between gap-4">
                  
                  {/* Preços */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {room.pricing.nights} {room.pricing.nights === 1 ? 'noite' : 'noites'}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {formatCurrency(room.pricing.total_amount)}
                      </span>
                      <span className="text-sm text-gray-500">
                        total
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(room.pricing.rate_per_night)} por noite
                    </p>
                  </div>

                  {/* Botão de reserva */}
                  <Button
                    onClick={() => onSelectRoom(room)}
                    size="lg"
                    className="shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Reservar Agora
                  </Button>
                </CardFooter>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}