// frontend/src/components/guests/GuestStats.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Mail, 
  FileText, 
  TrendingUp,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { GuestStats } from '@/types/guest';

interface GuestStatsProps {
  stats: GuestStats;
}

export default function GuestStatsComponent({ stats }: GuestStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total de Hóspedes */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Hóspedes</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total_guests.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hóspedes com Email */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Com Email</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.guests_with_email.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500">
                {stats.email_percentage.toFixed(1)}% do total
              </p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <Mail className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hóspedes com Documento */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Com Documento</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.guests_with_document.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500">
                {stats.document_percentage.toFixed(1)}% do total
              </p>
            </div>
            <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
              <FileText className="h-4 w-4 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Consent */}
      <Card>
        <CardContent className="p-6">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-3">Consentimento Marketing</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>Aceita</span>
                </div>
                <span className="font-medium">{stats.marketing_consent.yes}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span>Recusa</span>
                </div>
                <span className="font-medium">{stats.marketing_consent.no}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-3 w-3 text-gray-400" />
                  <span>Não perguntado</span>
                </div>
                <span className="font-medium">{stats.marketing_consent.not_asked}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}