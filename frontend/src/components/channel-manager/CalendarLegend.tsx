// frontend/src/components/channel-manager/CalendarLegend.tsx
// Path: frontend/src/components/channel-manager/CalendarLegend.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Info,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Wifi,
  WifiOff,
  DollarSign,
  Building,
  Calendar,
  Hash,
  Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LegendItemProps {
  color: string;
  icon?: React.ReactNode;
  label: string;
  description: string;
  example?: string;
}

function LegendItem({ color, icon, label, description, example }: LegendItemProps) {
  return (
    <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
      <div className={cn("w-4 h-4 rounded border mt-0.5 flex items-center justify-center", color)}>
        {icon && <div className="text-xs">{icon}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900">{label}</div>
        <div className="text-xs text-gray-600 mt-0.5">{description}</div>
        {example && (
          <div className="text-xs text-gray-500 mt-1 italic">{example}</div>
        )}
      </div>
    </div>
  );
}

interface StatusIndicatorProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
}

function StatusIndicator({ icon, label, description, color }: StatusIndicatorProps) {
  return (
    <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
      <div className={`mt-0.5 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900">{label}</div>
        <div className="text-xs text-gray-600 mt-0.5">{description}</div>
      </div>
    </div>
  );
}

export function CalendarLegend() {
  const [isOpen, setIsOpen] = useState(false);

  // ============== LEGEND DATA ==============

  const cellColors = [
    {
      color: "bg-white border-gray-200",
      label: "Disponível",
      description: "Quarto disponível e pronto para reservas",
      example: "Status normal de operação"
    },
    {
      color: "bg-green-50 border-green-200",
      icon: <CheckCircle className="h-3 w-3 text-green-600" />,
      label: "Sincronizado",
      description: "Dados atualizados e sincronizados com canais",
      example: "WuBook atualizado recentemente"
    },
    {
      color: "bg-yellow-50 border-yellow-200",
      icon: <Clock className="h-3 w-3 text-yellow-600" />,
      label: "Pendente",
      description: "Alterações aguardando sincronização",
      example: "Preço alterado, aguardando envio"
    },
    {
      color: "bg-blue-50 border-blue-200",
      label: "Selecionado",
      description: "Quarto selecionado para edição em massa",
      example: "Marcado para bulk edit"
    },
    {
      color: "bg-red-50 border-red-200",
      icon: <AlertTriangle className="h-3 w-3 text-red-600" />,
      label: "Erro",
      description: "Falha na sincronização ou validação",
      example: "Erro de conexão com canal"
    },
    {
      color: "bg-gray-100 border-gray-200",
      icon: <XCircle className="h-3 w-3 text-gray-600" />,
      label: "Bloqueado",
      description: "Quarto indisponível para reservas",
      example: "Manutenção ou fechado"
    }
  ];

  const syncStatus = [
    {
      icon: <CheckCircle className="h-4 w-4" />,
      label: "Sincronizado",
      description: "Dados atualizados em todos os canais",
      color: "text-green-600"
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: "Pendente",
      description: "Alterações aguardando processamento",
      color: "text-yellow-600"
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Erro",
      description: "Falha na sincronização",
      color: "text-red-600"
    },
    {
      icon: <Wifi className="h-4 w-4" />,
      label: "Conectado",
      description: "Canal ativo e funcionando",
      color: "text-blue-600"
    },
    {
      icon: <WifiOff className="h-4 w-4" />,
      label: "Desconectado",
      description: "Canal inativo ou não mapeado",
      color: "text-gray-400"
    }
  ];

  // ✅ NOVO: Explicação do layout de 5 linhas
  const fieldRows = [
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: "Linha 1: Preço (R$)",
      description: "Tarifa da diária. Clique para editar o valor",
      example: "Ex: R$ 150.00",
      color: "text-green-600"
    },
    {
      icon: <Hash className="h-4 w-4" />,
      label: "Linha 2: Unidades",
      description: "Quantidade de quartos disponíveis (1 = disponível, 0 = bloqueado)",
      example: "Ex: 1 ou 0",
      color: "text-blue-600"
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Linha 3: Estadia Mínima",
      description: "Número mínimo de noites para reserva",
      example: "Ex: 2 (= 2 noites mínimas)",
      color: "text-purple-600"
    },
    {
      icon: <Ban className="h-4 w-4" />,
      label: "Linha 4: Fechado p/ Chegada",
      description: "Checkbox para impedir check-in nesta data",
      example: "☑ = não permite chegada",
      color: "text-orange-600"
    },
    {
      icon: <Ban className="h-4 w-4" />,
      label: "Linha 5: Fechado p/ Saída",
      description: "Checkbox para impedir check-out nesta data",
      example: "☑ = não permite saída",
      color: "text-red-600"
    }
  ];

  const restrictions = [
    {
      label: "Estadia Mínima",
      description: "Define o número mínimo de noites que o hóspede deve reservar",
      example: "Valor: 2 = mínimo 2 noites"
    },
    {
      label: "Fechado p/ Chegada (CTA)",
      description: "Impede que hóspedes façam check-in nesta data específica",
      example: "Útil para forçar estadias mais longas"
    },
    {
      label: "Fechado p/ Saída (CTD)",
      description: "Impede que hóspedes façam check-out nesta data específica",
      example: "Útil para manter ocupação em períodos estratégicos"
    }
  ];

  // ============== COMPACT LEGEND ==============

  const CompactLegend = () => (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
        <span>Sincronizado</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-yellow-50 border border-yellow-200 rounded"></div>
        <span>Pendente</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
        <span>Erro</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
        <span>Bloqueado</span>
      </div>
    </div>
  );

  // ============== MAIN RENDER ==============

  return (
    <div className="flex items-center gap-2">
      {/* Compact Legend */}
      <div className="hidden lg:block">
        <CompactLegend />
      </div>

      {/* Full Legend Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            Legenda
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] max-h-[600px] overflow-y-auto p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3 sticky top-0 bg-white z-10 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Legenda do Calendário
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Cada quarto possui 5 linhas editáveis separadas
              </p>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              
              {/* ✅ NOVO: Estrutura de 5 Linhas */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Estrutura do Calendário
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-blue-900 font-medium mb-1">Layout de Linhas Separadas</p>
                  <p className="text-xs text-blue-700">
                    Cada quarto agora exibe 5 linhas independentes para melhor visualização e edição dos dados.
                  </p>
                </div>
                <div className="space-y-1">
                  {fieldRows.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded border border-gray-100">
                      <div className={`mt-0.5 ${item.color}`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{item.description}</div>
                        {item.example && (
                          <div className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 px-2 py-0.5 rounded inline-block">
                            {item.example}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status das Células */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900">Status das Células</h4>
                <div className="space-y-1">
                  {cellColors.map((item, index) => (
                    <LegendItem key={index} {...item} />
                  ))}
                </div>
              </div>

              {/* Indicadores de Sincronização */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900">Sincronização</h4>
                <div className="space-y-1">
                  {syncStatus.map((item, index) => (
                    <StatusIndicator key={index} {...item} />
                  ))}
                </div>
              </div>

              {/* Restrições Detalhadas */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900">Restrições (Linhas 3, 4 e 5)</h4>
                <div className="space-y-2">
                  {restrictions.map((item, index) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="font-medium text-xs text-gray-900 mb-1">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {item.description}
                      </div>
                      <div className="text-xs text-gray-500 italic bg-gray-50 px-2 py-1 rounded">
                        💡 {item.example}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dicas de Uso */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3 text-gray-900">Dicas de Uso</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Clique</strong> nos valores de Preço, Unidades ou Estadia Mínima para editar inline</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Enter</strong> para salvar alterações, <strong>Escape</strong> para cancelar</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Checkboxes</strong> nas linhas 4 e 5 togglem restrições CTA/CTD</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Use <strong>Edição em Massa</strong> para atualizar múltiplas datas de uma vez</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong>Hover</strong> nas células mostra detalhes do status de sincronização</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Ícone de <strong>sincronização</strong> aparece na primeira linha (Preço)</span>
                  </div>
                </div>
              </div>

              {/* Status Badges Example */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3 text-gray-900">Badges de Status</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sincronizado
                  </Badge>
                  <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    3 pendentes
                  </Badge>
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    2 erros
                  </Badge>
                </div>
              </div>

              {/* Layout Visual Example */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3 text-gray-900">Exemplo Visual</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 font-mono text-xs">
                  <div className="flex items-center gap-2 border-b border-gray-300 pb-1">
                    <span className="text-gray-600 w-32">Quarto 101</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-600">5 linhas de dados</span>
                  </div>
                  <div className="pl-4 space-y-0.5 text-gray-700">
                    <div>L1: R$ 150.00 <span className="text-green-600">✓</span></div>
                    <div>L2: 1 (disponível)</div>
                    <div>L3: 2 noites mínimas</div>
                    <div>L4: ☐ Fechado p/ Chegada</div>
                    <div>L5: ☐ Fechado p/ Saída</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}