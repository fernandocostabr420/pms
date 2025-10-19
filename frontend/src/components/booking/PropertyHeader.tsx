// frontend/src/components/booking/PropertyHeader.tsx
'use client';

import { MapPin, Phone, Mail, Globe, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PropertyPublicInfo } from '@/types/booking';
import Image from 'next/image';

interface PropertyHeaderProps {
  propertyInfo: PropertyPublicInfo;
}

export default function PropertyHeader({ propertyInfo }: PropertyHeaderProps) {
  const { property: propertyData, booking_engine } = propertyInfo;
  const primaryColor = booking_engine.primary_color || '#2563eb';

  return (
    <header 
      className="bg-white border-b shadow-sm"
      style={{ 
        borderBottomColor: primaryColor,
        borderBottomWidth: '3px'
      }}
    >
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo e Nome */}
          <div className="flex items-center gap-4">
            {booking_engine.logo_url && (
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src={booking_engine.logo_url}
                  alt={propertyData.name}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {propertyData.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {propertyData.address.city}, {propertyData.address.state}
                </span>
              </div>
            </div>
          </div>

          {/* Contatos e Redes Sociais */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Telefone */}
            {propertyData.contact.phone && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <a href={`tel:${propertyData.contact.phone}`}>
                  <Phone className="h-3 w-3 mr-1" />
                  {propertyData.contact.phone}
                </a>
              </Button>
            )}

            {/* Email */}
            {propertyData.contact.email && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <a href={`mailto:${propertyData.contact.email}`}>
                  <Mail className="h-3 w-3 mr-1" />
                  E-mail
                </a>
              </Button>
            )}

            {/* Website */}
            {propertyData.contact.website && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <a 
                  href={propertyData.contact.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Site
                </a>
              </Button>
            )}

            {/* Divisor */}
            {(booking_engine.social_links?.facebook || booking_engine.social_links?.instagram || booking_engine.social_links?.whatsapp) && (
              <div className="hidden md:block w-px h-6 bg-gray-300 mx-1" />
            )}

            {/* WhatsApp */}
            {booking_engine.social_links?.whatsapp && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 p-0"
              >
                <a
                  href={`https://wa.me/${booking_engine.social_links.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" style={{ color: primaryColor }} />
                </a>
              </Button>
            )}

            {/* Instagram */}
            {booking_engine.social_links?.instagram && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 p-0"
              >
                <a
                  href={booking_engine.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                >
                  <Instagram className="h-4 w-4" style={{ color: primaryColor }} />
                </a>
              </Button>
            )}

            {/* Facebook */}
            {booking_engine.social_links?.facebook && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 p-0"
              >
                <a
                  href={booking_engine.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                >
                  <Facebook className="h-4 w-4" style={{ color: primaryColor }} />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Hero Image/Gallery - Carousel simples */}
        {booking_engine.gallery_photos && booking_engine.gallery_photos.length > 0 && (
          <div className="mt-6 rounded-lg overflow-hidden">
            <div className="relative h-64 md:h-96">
              <Image
                src={booking_engine.gallery_photos[0]}
                alt={propertyData.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              
              {/* Texto sobre a imagem */}
              {booking_engine.welcome_text && (
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <p className="text-lg md:text-xl font-medium max-w-2xl">
                    {booking_engine.welcome_text}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}