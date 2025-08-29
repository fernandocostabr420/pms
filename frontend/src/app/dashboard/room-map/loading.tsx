// frontend/src/app/dashboard/room-map/loading.tsx

import { Card, CardContent } from '@/components/ui/card';
import { Map, RefreshCw } from 'lucide-react';

export default function RoomMapLoading() {
  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Map className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa de Quartos</h1>
            <p className="text-gray-600">Carregando...</p>
          </div>
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Controles simples - skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>

      {/* Mapa principal - skeleton */}
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Carregando Mapa de Quartos
          </h3>
          <p className="text-gray-600 mb-8">
            Buscando dados de ocupação e reservas...
          </p>
          
          {/* Grid skeleton simplificado */}
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-48 h-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex gap-1">
                  {[...Array(31)].map((_, j) => (
                    <div key={j} className="w-16 h-12 bg-gray-100 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}