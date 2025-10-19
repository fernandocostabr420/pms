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
      <PropertyHeader property={propertyInfo} />

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Widget de busca */}
        <div className="mb-8">
          <SearchWidget
            onSearch={search}
            loading={loadingSearch}
            initialParams={searchParams}
            property={propertyInfo}
          />
        </div>

        {/* Mensagem de erro */}
        {error && propertyInfo && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading de busca */}
        {loadingSearch && (
          <div className="text-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Buscando quartos disponíveis...</p>
          </div>
        )}

        {/* Resultados da busca */}
        {!loadingSearch && hasSearch && (
          <>
            {hasResults ? (
              <RoomResults
                rooms={availableRooms}
                searchParams={searchParams}
                onSelectRoom={selectRoom}
                propertyInfo={propertyInfo}
              />
            ) : (
              !error && (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                  <div className="max-w-md mx-auto">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Nenhum quarto disponível
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Não encontramos quartos disponíveis para o período selecionado.
                      Tente outras datas ou entre em contato conosco.
                    </p>
                    {propertyInfo.property.contact.phone && (
                      <p className="text-sm text-gray-500">
                        📞 {propertyInfo.property.contact.phone}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </>
        )}

        {/* Mensagem inicial (sem busca ainda) */}
        {!hasSearch && !loadingSearch && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="max-w-md mx-auto px-4">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                Bem-vindo ao {propertyInfo.property.name}
              </h3>
              <p className="text-gray-600 mb-6">
                {propertyInfo.booking_config.content.welcome_text || 
                 'Selecione as datas e a quantidade de hóspedes para ver os quartos disponíveis.'}
              </p>
              
              {/* Informações rápidas */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium">Check-in</p>
                  <p>{propertyInfo.booking_config.policies.check_in_time}</p>
                </div>
                <div>
                  <p className="font-medium">Check-out</p>
                  <p>{propertyInfo.booking_config.policies.check_out_time}</p>
                </div>
              </div>
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