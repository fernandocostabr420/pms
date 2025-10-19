// frontend/src/components/booking-config/BasicSettings.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Globe, 
  Clock, 
  Calendar,
  Info,
  DollarSign,
  Zap
} from 'lucide-react';

interface BasicSettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function BasicSettings({ config, onChange }: BasicSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Status do Motor de Reservas
          </CardTitle>
          <CardDescription>
            Controle se o motor de reservas está ativo e acessível publicamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="is_active" className="text-base font-medium">
                Motor de Reservas Ativo
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Quando desativado, o site não estará acessível para novos visitantes
              </p>
            </div>
            <Switch
              id="is_active"
              checked={config.is_active}
              onCheckedChange={(checked) => onChange('is_active', checked)}
            />
          </div>

          {!config.is_active && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                O motor de reservas está desativado. Ative-o para permitir que seus clientes façam reservas online.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* URL Customizada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Personalizada
          </CardTitle>
          <CardDescription>
            Defina um slug personalizado para a URL do seu motor de reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom_slug">
              Slug Customizado (opcional)
            </Label>
            <Input
              id="custom_slug"
              placeholder="minha-pousada"
              value={config.custom_slug || ''}
              onChange={(e) => onChange('custom_slug', e.target.value || null)}
              className="max-w-md"
            />
            <p className="text-sm text-gray-600">
              URL final: {process.env.NEXT_PUBLIC_BOOKING_ENGINE_URL || 'http://localhost:3001'}/{config.custom_slug || 'seu-slug'}
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Use apenas letras minúsculas, números e hífens. Ex: pousada-exemplo
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Horários de Check-in/Check-out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários de Check-in e Check-out
          </CardTitle>
          <CardDescription>
            Defina os horários padrão para entrada e saída
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="check_in_time">
                Horário de Check-in
              </Label>
              <Input
                id="check_in_time"
                type="time"
                value={config.check_in_time}
                onChange={(e) => onChange('check_in_time', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Horário a partir do qual os hóspedes podem fazer check-in
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out_time">
                Horário de Check-out
              </Label>
              <Input
                id="check_out_time"
                type="time"
                value={config.check_out_time}
                onChange={(e) => onChange('check_out_time', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Horário limite para os hóspedes deixarem o quarto
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Reserva */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Regras de Reserva
          </CardTitle>
          <CardDescription>
            Configure as restrições e limites para novas reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default_min_stay">
                Estadia Mínima (noites)
              </Label>
              <Input
                id="default_min_stay"
                type="number"
                min="1"
                max="90"
                value={config.default_min_stay}
                onChange={(e) => onChange('default_min_stay', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Número mínimo de noites por reserva
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_max_stay">
                Estadia Máxima (noites) - Opcional
              </Label>
              <Input
                id="default_max_stay"
                type="number"
                min="1"
                max="365"
                placeholder="Sem limite"
                value={config.default_max_stay || ''}
                onChange={(e) => onChange('default_max_stay', e.target.value ? parseInt(e.target.value) : null)}
              />
              <p className="text-xs text-gray-500">
                Deixe em branco para sem limite
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_advance_booking_hours">
                Antecedência Mínima (horas)
              </Label>
              <Input
                id="min_advance_booking_hours"
                type="number"
                min="0"
                max="720"
                value={config.min_advance_booking_hours}
                onChange={(e) => onChange('min_advance_booking_hours', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Quantas horas de antecedência mínima para reservar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_advance_booking_days">
                Antecedência Máxima (dias)
              </Label>
              <Input
                id="max_advance_booking_days"
                type="number"
                min="1"
                max="730"
                value={config.max_advance_booking_days}
                onChange={(e) => onChange('max_advance_booking_days', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Até quantos dias no futuro é possível reservar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações de Pagamento
          </CardTitle>
          <CardDescription>
            Configure as regras de pagamento e pré-pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="require_prepayment" className="text-base font-medium">
                Exigir Pré-pagamento
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Requer que o hóspede pague uma porcentagem antes de confirmar
              </p>
            </div>
            <Switch
              id="require_prepayment"
              checked={config.require_prepayment}
              onCheckedChange={(checked) => onChange('require_prepayment', checked)}
            />
          </div>

          {config.require_prepayment && (
            <div className="space-y-2 pl-4 border-l-2 border-blue-200">
              <Label htmlFor="prepayment_percentage">
                Porcentagem de Pré-pagamento (%)
              </Label>
              <Input
                id="prepayment_percentage"
                type="number"
                min="0"
                max="100"
                placeholder="50"
                value={config.prepayment_percentage || ''}
                onChange={(e) => onChange('prepayment_percentage', e.target.value ? parseInt(e.target.value) : null)}
                className="max-w-xs"
              />
              <p className="text-xs text-gray-500">
                Porcentagem do valor total que deve ser paga antecipadamente
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reserva Instantânea */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Reserva Instantânea
          </CardTitle>
          <CardDescription>
            Permita que hóspedes façam reservas sem aprovação manual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="instant_booking" className="text-base font-medium">
                Ativar Reserva Instantânea
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Quando ativo, as reservas são confirmadas automaticamente
              </p>
            </div>
            <Switch
              id="instant_booking"
              checked={config.instant_booking}
              onCheckedChange={(checked) => onChange('instant_booking', checked)}
            />
          </div>

          {!config.instant_booking && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Com reserva instantânea desativada, você precisará aprovar manualmente cada reserva recebida.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Idioma Padrão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Idioma Padrão
          </CardTitle>
          <CardDescription>
            Selecione o idioma principal do motor de reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default_language">
              Idioma Padrão
            </Label>
            <Select
              value={config.default_language}
              onValueChange={(value) => onChange('default_language', value)}
            >
              <SelectTrigger id="default_language" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Idioma que será exibido por padrão para os visitantes
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}