// frontend/src/components/booking/BookingEngine.tsx
'use client';

import { useEffect, useState } from 'react';
import { useBooking } from '@/hooks/use-booking';
import PropertyHeader from './PropertyHeader';
import SearchWidget from './SearchWidget';
import RoomResults from './RoomResults';
import CheckoutModal from './CheckoutModal';
import ConfirmationModal from './ConfirmationModal';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BookingEngineProps {
  slug: string;
}

export default function BookingEngine({ slug }: BookingEngineProps) {
  const {
    propertyInfo,
    availableRooms,
    selectedRoom,
    searchParams,
    bookingSuccess,
    loadingProperty,
    loadingSearch,
    loadingBooking,
    error,
    loadPropertyInfo,
    search,
    selectRoom,
    book,
    reset,
    hasResults,
    hasSearch,
  } = useBooking(slug);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  // Carregar informações da propriedade ao montar
  useEffect(() => {
    loadPropertyInfo();
  }, [loadPropertyInfo]);

  // Abrir modal de checkout quando selecionar quarto
  useEffect(() => {
    if (selectedRoom) {
      setCheckoutOpen(true);
    }
  }, [selectedRoom]);

  // Abrir modal de confirmação após reserva bem-sucedida
  useEffect(() => {
    if (bookingSuccess) {
      setCheckoutOpen(false);
      setConfirmationOpen(true);
    }
  }, [bookingSuccess]);

  // Loading inicial da propriedade
  if (loadingProperty) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // Erro ao carregar propriedade
  if (error && !propertyInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!propertyInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header da propriedade */}
      <PropertyHeader propertyInfo={propertyInfo} />

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-8">
        {/* Widget de busca */}
        <div className="max-w-4xl mx-auto mb-8">
          <SearchWidget
            onSearch={search}
            loading={loadingSearch}
            initialParams={searchParams}
          />
        </div>

        {/* Erro de busca */}
        {error && hasSearch && (
          <Alert variant="destructive" className="max-w-4xl mx-auto mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultados da busca */}
        {hasSearch && hasResults && (
          <RoomResults
            rooms={availableRooms}
            onSelectRoom={selectRoom}
            loading={loadingSearch}
            searchParams={searchParams}
          />
        )}

        {/* Estado vazio - sem busca ainda */}
        {!hasSearch && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Encontre seu quarto ideal
              </h3>
              <p className="text-gray-600 mb-6">
                {/* ✅ CORREÇÃO: Acessar welcome_text diretamente do booking_engine */}
                {propertyInfo.booking_engine?.welcome_text || 
                 'Selecione as datas e a quantidade de hóspedes para ver os quartos disponíveis.'}
              </p>
              
              {/* Informações rápidas */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium">Check-in</p>
                  {/* ✅ CORREÇÃO: Acessar check_in_time diretamente */}
                  <p>{propertyInfo.booking_engine?.check_in_time || propertyInfo.property?.check_in_time}</p>
                </div>
                <div>
                  <p className="font-medium">Check-out</p>
                  {/* ✅ CORREÇÃO: Acessar check_out_time diretamente */}
                  <p>{propertyInfo.booking_engine?.check_out_time || propertyInfo.property?.check_out_time}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sem resultados */}
        {hasSearch && !hasResults && !loadingSearch && !error && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">
                Nenhum quarto disponível para as datas selecionadas.
                Tente outras datas ou entre em contato conosco.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modal de checkout */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          selectRoom(null);
        }}
        room={selectedRoom}
        searchParams={searchParams}
        propertyInfo={propertyInfo}
        onConfirm={book}
        loading={loadingBooking}
      />

      {/* Modal de confirmação */}
      <ConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => {
          setConfirmationOpen(false);
          reset();
        }}
        booking={bookingSuccess}
        propertyInfo={propertyInfo}
      />
    </div>
  );
}