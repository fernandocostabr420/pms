// frontend/src/components/booking-config/NotificationSettings.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Info,
  CheckCircle,
  AlertCircle,
  Plus,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NotificationSettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function NotificationSettings({ config, onChange }: NotificationSettingsProps) {
  const [newEmail, setNewEmail] = useState('');

  const getEmailList = (): string[] => {
    if (!config.notification_emails) return [];
    return config.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean);
  };

  const addEmail = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      alert('Digite um email válido');
      return;
    }

    const currentEmails = getEmailList();
    if (currentEmails.includes(newEmail.trim())) {
      alert('Este email já está na lista');
      return;
    }

    const updatedEmails = [...currentEmails, newEmail.trim()].join(', ');
    onChange('notification_emails', updatedEmails);
    setNewEmail('');
  };

  const removeEmail = (emailToRemove: string) => {
    const currentEmails = getEmailList();
    const updatedEmails = currentEmails
      .filter(email => email !== emailToRemove)
      .join(', ');
    onChange('notification_emails', updatedEmails || null);
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notificações por Email
          </CardTitle>
          <CardDescription>
            Configure os emails que receberão notificações de novas reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Quando uma nova reserva for criada através do motor de reservas, 
              todos os emails cadastrados receberão uma notificação automática.
            </AlertDescription>
          </Alert>

          {/* Lista de Emails */}
          {getEmailList().length > 0 && (
            <div className="space-y-2">
              <Label>Emails Cadastrados</Label>
              <div className="flex flex-wrap gap-2">
                {getEmailList().map((email, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="pl-3 pr-1 py-1 text-sm"
                  >
                    <Mail className="h-3 w-3 mr-2" />
                    {email}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-2 hover:bg-red-100"
                      onClick={() => removeEmail(email)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Adicionar Novo Email */}
          <div className="space-y-2">
            <Label htmlFor="new_email">
              Adicionar Email de Notificação
            </Label>
            <div className="flex gap-2">
              <Input
                id="new_email"
                type="email"
                placeholder="email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
              <Button onClick={addEmail} disabled={!newEmail.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Adicione múltiplos emails para receber notificações
            </p>
          </div>

          {getEmailList().length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum email cadastrado. Adicione pelo menos um email para receber 
                notificações de novas reservas.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Notificações por SMS
            <Badge variant="outline" className="ml-2">Em Breve</Badge>
          </CardTitle>
          <CardDescription>
            Envie confirmações de reserva por SMS para os hóspedes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-60">
            <div className="flex-1">
              <Label htmlFor="send_sms_confirmation" className="text-base font-medium">
                Enviar SMS de Confirmação
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Envia SMS automático para o hóspede após a reserva
              </p>
            </div>
            <Switch
              id="send_sms_confirmation"
              checked={config.send_sms_confirmation}
              onCheckedChange={(checked) => onChange('send_sms_confirmation', checked)}
              disabled
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Funcionalidade em desenvolvimento.</strong> A integração com 
              provedores de SMS estará disponível em breve. Configure agora para 
              estar pronto quando o recurso for liberado.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* WhatsApp Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notificações por WhatsApp
            <Badge variant="outline" className="ml-2">Em Breve</Badge>
          </CardTitle>
          <CardDescription>
            Envie confirmações de reserva via WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-60">
            <div className="flex-1">
              <Label htmlFor="send_whatsapp_confirmation" className="text-base font-medium">
                Enviar WhatsApp de Confirmação
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Envia mensagem automática via WhatsApp Business API
              </p>
            </div>
            <Switch
              id="send_whatsapp_confirmation"
              checked={config.send_whatsapp_confirmation}
              onCheckedChange={(checked) => onChange('send_whatsapp_confirmation', checked)}
              disabled
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Funcionalidade em desenvolvimento.</strong> Requer conta 
              WhatsApp Business e integração com provedor de API. A funcionalidade 
              será liberada em breve.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email Template Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Preview do Email de Notificação
          </CardTitle>
          <CardDescription>
            Exemplo do email que será enviado quando houver uma nova reserva
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {/* Email Header */}
            <div 
              className="p-4 text-white"
              style={{ backgroundColor: config.primary_color }}
            >
              <div className="flex items-center gap-3">
                {config.logo_url && (
                  <img 
                    src={config.logo_url} 
                    alt="Logo" 
                    className="h-8 w-auto object-contain bg-white/20 rounded px-2"
                  />
                )}
                <span className="font-semibold text-lg">Nova Reserva Recebida</span>
              </div>
            </div>

            {/* Email Body */}
            <div className="p-6 bg-white">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Você recebeu uma nova reserva!</span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Hóspede:</span>
                      <p className="font-medium">João Silva</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">joao@exemplo.com</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Check-in:</span>
                      <p className="font-medium">15/03/2024</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Check-out:</span>
                      <p className="font-medium">18/03/2024</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Hóspedes:</span>
                      <p className="font-medium">2 adultos, 1 criança</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor Total:</span>
                      <p className="font-medium">R$ 900,00</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  Acesse o sistema para visualizar todos os detalhes e gerenciar esta reserva.
                </p>

                <Button 
                  className="w-full"
                  style={{ backgroundColor: config.primary_color }}
                >
                  Acessar Sistema
                </Button>
              </div>
            </div>

            {/* Email Footer */}
            <div className="p-4 bg-gray-50 border-t text-center text-xs text-gray-500">
              <p>Esta é uma notificação automática do seu motor de reservas.</p>
              <p className="mt-1">
                Você está recebendo este email porque está cadastrado para receber 
                notificações de novas reservas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo das Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-gray-600">
                    {getEmailList().length} {getEmailList().length === 1 ? 'destinatário' : 'destinatários'}
                  </p>
                </div>
              </div>
              {getEmailList().length > 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium">SMS</p>
                  <p className="text-sm text-gray-600">
                    {config.send_sms_confirmation ? 'Ativado' : 'Desativado'} (Em breve)
                  </p>
                </div>
              </div>
              <Badge variant="outline">Em Breve</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-sm text-gray-600">
                    {config.send_whatsapp_confirmation ? 'Ativado' : 'Desativado'} (Em breve)
                  </p>
                </div>
              </div>
              <Badge variant="outline">Em Breve</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}