// frontend/src/components/guests/GuestCard.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react';
import { GuestResponse } from '@/types/guest';

interface GuestCardProps {
  guest: GuestResponse;
  onEdit: (guest: GuestResponse) => void;
  onDelete: (guest: GuestResponse) => void;
  onView: (guest: GuestResponse) => void;
}

export default function GuestCard({ 
  guest, 
  onEdit, 
  onDelete, 
  onView 
}: GuestCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMarketingConsentBadge = (consent: string) => {
    switch (consent) {
      case 'yes':
        return <Badge className="bg-green-100 text-green-800">Aceita Marketing</Badge>;
      case 'no':
        return <Badge className="bg-red-100 text-red-800">Não aceita Marketing</Badge>;
      default:
        return <Badge variant="outline">Marketing não perguntado</Badge>;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{guest.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {guest.nationality}
                </Badge>
                {guest.display_document && (
                  <Badge variant="outline" className="text-xs">
                    {guest.display_document}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(guest)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(guest)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(guest)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Informações de contato */}
        <div className="space-y-2">
          {guest.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4" />
              <span className="truncate">{guest.email}</span>
            </div>
          )}
          
          {guest.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4" />
              <span>{guest.phone}</span>
            </div>
          )}
          
          {guest.full_address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{guest.full_address}</span>
            </div>
          )}
        </div>

        {/* Marketing consent */}
        <div className="flex justify-between items-center">
          {getMarketingConsentBadge(guest.marketing_consent)}
          
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(guest.created_at)}</span>
          </div>
        </div>

        {/* Notas (se houver) */}
        {guest.notes && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
            <p className="line-clamp-2">{guest.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}