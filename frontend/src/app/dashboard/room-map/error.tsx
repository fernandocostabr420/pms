// frontend/src/app/dashboard/room-map/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RoomMapError({
  error,
  reset,
}: ErrorProps) {
  useEffect(() => {
    console.error('Erro no mapa de quartos:', error);
  }, [error]);

  return (
    <div className="min-h-96 flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="p-3 bg-red-100 rounded-full w-fit mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erro no Mapa de Quartos
          </h2>
          
          <p className="text-gray-600 mb-6">
            Ocorreu um problema ao carregar o mapa de quartos. Tente novamente ou entre em contato com o suporte.
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={reset}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="w-full"
            >
              Voltar ao Dashboard
            </Button>
          </div>
          
          {error.digest && (
            <p className="text-xs text-gray-400 mt-4">
              ID do erro: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}