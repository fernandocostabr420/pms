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
  Calendar
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
      description: "Célula selecionada para edição em massa",
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

  const fieldExplanations = [
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: "Preço (R$)",
      description: "Tarifa da diária. Clique para editar inline",
      color: "text-green-600"
    },
    {
      icon: <Building className="h-4 w-4" />,
      label: "Disponibilidade (#)",
      description: "Número de unidades disponíveis. ✓ = disponível, ✗ = bloqueado",
      color: "text-blue-600"
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Restrições",
      description: "MinStay (noites mínimas) e checkboxes CTA/CTD",
      color: "text-orange-600"
    }
  ];

  const restrictions = [
    {
      label: "MinStay (2n)",
      description: "Estadia mínima de 2 noites"
    },
    {
      label: "CTA ☐",
      description: "Closed to Arrival - Fechado para chegada"
    },
    {
      label: "CTD ☐", 
      description: "Closed to Departure - Fechado para saída"
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
        <PopoverContent className="w-96 p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Legenda do Calendário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
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

              {/* Campos da Célula */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900">Campos Editáveis</h4>
                <div className="space-y-1">
                  {fieldExplanations.map((item, index) => (
                    <StatusIndicator key={index} {...item} />
                  ))}
                </div>
              </div>

              {/* Restrições */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-gray-900">Restrições</h4>
                <div className="space-y-2">
                  {restrictions.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                      <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-0.5">
                        {item.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-600">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dicas de Uso */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3 text-gray-900">Dicas de Uso</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div>• <strong>Clique</strong> nos valores para editar inline</div>
                  <div>• <strong>Enter</strong> para salvar, <strong>Escape</strong> para cancelar</div>
                  <div>• Use <strong>Edição em Massa</strong> para múltiplas células</div>
                  <div>• <strong>Checkboxes</strong> nas restrições togglem CTA/CTD</div>
                  <div>• <strong>Hover</strong> nas células mostra detalhes de sync</div>
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
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}