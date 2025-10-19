// frontend/src/components/booking-config/PolicySettings.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield,
  FileText,
  AlertTriangle,
  Home,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface PolicySettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function PolicySettings({ config, onChange }: PolicySettingsProps) {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const templates = {
    cancellation: `POLÍTICA DE CANCELAMENTO

Cancelamentos Gratuitos:
- Até 7 dias antes do check-in: cancelamento gratuito com reembolso total
- Entre 7 e 3 dias: taxa de 30% do valor total
- Menos de 3 dias: taxa de 50% do valor total
- No-show: sem reembolso

Reembolsos:
- Processados em até 10 dias úteis
- Devolvidos no mesmo método de pagamento

Para cancelar, entre em contato através do email ou WhatsApp informado na confirmação.`,

    house_rules: `REGRAS DA CASA

Check-in e Check-out:
- Check-in: a partir das ${config.check_in_time || '14:00'}h
- Check-out: até às ${config.check_out_time || '12:00'}h
- Check-in antecipado e check-out tardio sujeitos à disponibilidade

Regras Gerais:
- Não é permitido fumar nas áreas internas
- Animais de estimação não são permitidos
- Silêncio deve ser respeitado após 22h
- Visitantes devem ser anunciados na recepção

Segurança:
- Objetos de valor podem ser guardados no cofre da recepção
- Chaves dos quartos devem ser devolvidas no check-out
- Em caso de emergência, acione a recepção imediatamente

Responsabilidades:
- Hóspedes são responsáveis por danos causados às instalações
- Itens perdidos serão guardados por até 30 dias`,

    terms: `TERMOS E CONDIÇÕES

1. RESERVAS
Ao fazer uma reserva, você concorda com todas as políticas da propriedade e se compromete a fornecer informações verdadeiras.

2. PAGAMENTO
- Formas de pagamento aceitas são informadas no momento da reserva
- O pagamento completo é necessário para confirmar a reserva
- Cobranças adicionais podem ser aplicadas por serviços extras

3. MODIFICAÇÕES
- Alterações de reserva estão sujeitas a disponibilidade
- Taxas adicionais podem ser aplicadas para modificações
- Entre em contato o quanto antes para solicitar mudanças

4. CAPACIDADE MÁXIMA
- Número máximo de hóspedes deve ser respeitado
- Hóspedes adicionais não autorizados podem resultar em cobranças extras

5. RESPONSABILIDADE
- A propriedade não se responsabiliza por objetos perdidos ou roubados
- Danos causados pelos hóspedes serão cobrados
- Comportamento inadequado pode resultar em expulsão sem reembolso

6. PRIVACIDADE
- Seus dados pessoais serão tratados conforme nossa política de privacidade
- Não compartilhamos informações com terceiros sem consentimento

7. FORÇA MAIOR
- Não nos responsabilizamos por circunstâncias além do nosso controle
- Em casos de força maior, trabalharemos para encontrar soluções alternativas`,

    privacy: `POLÍTICA DE PRIVACIDADE

Última atualização: ${new Date().toLocaleDateString('pt-BR')}

1. INFORMAÇÕES COLETADAS
Coletamos as seguintes informações durante a reserva:
- Nome completo
- Email e telefone
- Documento de identificação
- Dados de pagamento (quando aplicável)

2. USO DAS INFORMAÇÕES
Utilizamos suas informações para:
- Processar e confirmar reservas
- Comunicar sobre sua estadia
- Melhorar nossos serviços
- Cumprir obrigações legais

3. COMPARTILHAMENTO
Não compartilhamos suas informações pessoais com terceiros, exceto:
- Quando exigido por lei
- Com processadores de pagamento (apenas dados necessários)
- Com seu consentimento explícito

4. SEGURANÇA
Implementamos medidas de segurança para proteger suas informações:
- Criptografia de dados sensíveis
- Acesso restrito às informações
- Treinamento da equipe sobre privacidade

5. SEUS DIREITOS
Você tem direito a:
- Acessar seus dados pessoais
- Corrigir informações incorretas
- Solicitar exclusão de dados
- Retirar consentimento

6. COOKIES
Nosso site utiliza cookies para:
- Melhorar a experiência de navegação
- Analisar tráfego do site
- Personalizar conteúdo

7. CONTATO
Para questões sobre privacidade, entre em contato:
Email: privacidade@suapousada.com
Telefone: (XX) XXXX-XXXX`
  };

  const copyTemplate = (template: string, type: string) => {
    navigator.clipboard.writeText(template);
    setCopiedTemplate(type);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Estas políticas serão exibidas no seu motor de reservas. É importante mantê-las claras e atualizadas. 
          Use os templates como base e adapte-os à sua realidade.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="cancellation">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cancellation">Cancelamento</TabsTrigger>
          <TabsTrigger value="house_rules">Regras</TabsTrigger>
          <TabsTrigger value="terms">Termos</TabsTrigger>
          <TabsTrigger value="privacy">Privacidade</TabsTrigger>
        </TabsList>

        {/* Política de Cancelamento */}
        <TabsContent value="cancellation">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Política de Cancelamento
                  </CardTitle>
                  <CardDescription>
                    Defina as regras para cancelamento de reservas
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyTemplate(templates.cancellation, 'cancellation')}
                >
                  {copiedTemplate === 'cancellation' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Usar Template
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cancellation_policy">
                  Política de Cancelamento
                </Label>
                <Textarea
                  id="cancellation_policy"
                  placeholder="Descreva aqui as regras de cancelamento..."
                  value={config.cancellation_policy || ''}
                  onChange={(e) => onChange('cancellation_policy', e.target.value || null)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Seja claro sobre prazos, taxas e condições de reembolso</span>
                  <span>{(config.cancellation_policy || '').length} caracteres</span>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sugestões:</strong> Inclua prazos específicos, percentuais de reembolso, 
                  método de devolução e como solicitar o cancelamento.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regras da Casa */}
        <TabsContent value="house_rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Regras da Casa
                  </CardTitle>
                  <CardDescription>
                    Estabeleça as regras de convivência da propriedade
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyTemplate(templates.house_rules, 'house_rules')}
                >
                  {copiedTemplate === 'house_rules' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Usar Template
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="house_rules">
                  Regras da Casa
                </Label>
                <Textarea
                  id="house_rules"
                  placeholder="Liste as regras e diretrizes da propriedade..."
                  value={config.house_rules || ''}
                  onChange={(e) => onChange('house_rules', e.target.value || null)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Inclua horários, restrições e responsabilidades</span>
                  <span>{(config.house_rules || '').length} caracteres</span>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Sugestões:</strong> Mencione política de fumantes, pets, horário de silêncio, 
                  número máximo de visitantes e procedimentos de emergência.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Termos e Condições */}
        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Termos e Condições
                  </CardTitle>
                  <CardDescription>
                    Termos gerais de uso e responsabilidades
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyTemplate(templates.terms, 'terms')}
                >
                  {copiedTemplate === 'terms' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Usar Template
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terms_and_conditions">
                  Termos e Condições
                </Label>
                <Textarea
                  id="terms_and_conditions"
                  placeholder="Descreva os termos de uso da propriedade..."
                  value={config.terms_and_conditions || ''}
                  onChange={(e) => onChange('terms_and_conditions', e.target.value || null)}
                  rows={15}
                  className="font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Documento legal que estabelece direitos e obrigações</span>
                  <span>{(config.terms_and_conditions || '').length} caracteres</span>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Importante:</strong> Recomendamos consultar um advogado para revisar 
                  os termos e garantir conformidade legal com as leis locais.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Política de Privacidade */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Política de Privacidade
                  </CardTitle>
                  <CardDescription>
                    Como você coleta e utiliza dados dos hóspedes
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyTemplate(templates.privacy, 'privacy')}
                >
                  {copiedTemplate === 'privacy' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Usar Template
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="privacy_policy">
                  Política de Privacidade
                </Label>
                <Textarea
                  id="privacy_policy"
                  placeholder="Descreva como você coleta, usa e protege os dados..."
                  value={config.privacy_policy || ''}
                  onChange={(e) => onChange('privacy_policy', e.target.value || null)}
                  rows={15}
                  className="font-mono text-sm"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Documento obrigatório pela LGPD (Lei Geral de Proteção de Dados)</span>
                  <span>{(config.privacy_policy || '').length} caracteres</span>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>LGPD:</strong> A política de privacidade é obrigatória no Brasil. 
                  Certifique-se de estar em conformidade com a Lei Geral de Proteção de Dados.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          <strong>Atenção Legal:</strong> Os templates fornecidos são apenas sugestões básicas. 
          Recomendamos fortemente consultar um advogado especializado para revisar e adequar 
          todas as políticas às leis locais e às especificidades do seu negócio.
        </AlertDescription>
      </Alert>
    </div>
  );
}