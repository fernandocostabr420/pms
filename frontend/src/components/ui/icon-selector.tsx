// frontend/src/components/ui/icon-selector.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search,
  ChevronDown,
  Star,
  Clock,
  Package,
  X,
  Grid3x3,
  Heart,
  // Ícones categorizados
  CreditCard,
  Banknote,
  Coins,
  Wallet,
  Smartphone,
  QrCode,
  Building,
  PiggyBank,
  DollarSign,
  Euro,
  // Canais
  Store,
  Globe,
  Phone,
  Mail,
  Users,
  Building2,
  Briefcase,
  Home,
  // Status
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock3,
  Pause,
  Play,
  // Ações
  Plus,
  Minus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  // Navegação
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  // Geral
  Settings,
  Filter,
  Calendar,
  MapPin,
  Bell,
  MessageSquare,
  FileText,
  Image,
  Video,
  Music,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapeamento de ícones organizados por categoria
const ICON_CATEGORIES = {
  payment: {
    name: 'Pagamento',
    description: 'Ícones para métodos de pagamento',
    icons: [
      { name: 'credit-card', label: 'Cartão de Crédito', component: CreditCard },
      { name: 'banknote', label: 'Dinheiro', component: Banknote },
      { name: 'coins', label: 'Moedas', component: Coins },
      { name: 'wallet', label: 'Carteira', component: Wallet },
      { name: 'smartphone', label: 'PIX/Mobile', component: Smartphone },
      { name: 'qr-code', label: 'QR Code', component: QrCode },
      { name: 'building', label: 'Banco', component: Building },
      { name: 'piggy-bank', label: 'Poupança', component: PiggyBank },
      { name: 'dollar-sign', label: 'Dólar', component: DollarSign },
      { name: 'euro', label: 'Euro', component: Euro }
    ]
  },
  channels: {
    name: 'Canais',
    description: 'Ícones para canais de venda',
    icons: [
      { name: 'store', label: 'Loja', component: Store },
      { name: 'globe', label: 'Online', component: Globe },
      { name: 'phone', label: 'Telefone', component: Phone },
      { name: 'mail', label: 'Email', component: Mail },
      { name: 'users', label: 'Grupo', component: Users },
      { name: 'building-2', label: 'Empresa', component: Building2 },
      { name: 'briefcase', label: 'Corporativo', component: Briefcase },
      { name: 'home', label: 'Residencial', component: Home }
    ]
  },
  status: {
    name: 'Status',
    description: 'Ícones para estados e status',
    icons: [
      { name: 'check-circle', label: 'Sucesso', component: CheckCircle },
      { name: 'x-circle', label: 'Erro', component: XCircle },
      { name: 'alert-circle', label: 'Atenção', component: AlertCircle },
      { name: 'clock-3', label: 'Pendente', component: Clock3 },
      { name: 'pause', label: 'Pausado', component: Pause },
      { name: 'play', label: 'Ativo', component: Play }
    ]
  },
  actions: {
    name: 'Ações',
    description: 'Ícones para botões e ações',
    icons: [
      { name: 'plus', label: 'Adicionar', component: Plus },
      { name: 'minus', label: 'Remover', component: Minus },
      { name: 'edit', label: 'Editar', component: Edit },
      { name: 'trash-2', label: 'Deletar', component: Trash2 },
      { name: 'eye', label: 'Visualizar', component: Eye },
      { name: 'eye-off', label: 'Ocultar', component: EyeOff },
      { name: 'download', label: 'Baixar', component: Download },
      { name: 'upload', label: 'Enviar', component: Upload }
    ]
  },
  navigation: {
    name: 'Navegação',
    description: 'Ícones para navegação e direções',
    icons: [
      { name: 'arrow-left', label: 'Esquerda', component: ArrowLeft },
      { name: 'arrow-right', label: 'Direita', component: ArrowRight },
      { name: 'arrow-up', label: 'Cima', component: ArrowUp },
      { name: 'arrow-down', label: 'Baixo', component: ArrowDown },
      { name: 'chevron-left', label: 'Anterior', component: ChevronLeft },
      { name: 'chevron-right', label: 'Próximo', component: ChevronRight }
    ]
  },
  general: {
    name: 'Geral',
    description: 'Ícones de uso geral',
    icons: [
      { name: 'settings', label: 'Configurações', component: Settings },
      { name: 'filter', label: 'Filtro', component: Filter },
      { name: 'calendar', label: 'Calendário', component: Calendar },
      { name: 'map-pin', label: 'Localização', component: MapPin },
      { name: 'bell', label: 'Notificação', component: Bell },
      { name: 'message-square', label: 'Mensagem', component: MessageSquare },
      { name: 'file-text', label: 'Documento', component: FileText },
      { name: 'image', label: 'Imagem', component: Image },
      { name: 'video', label: 'Vídeo', component: Video },
      { name: 'music', label: 'Música', component: Music },
      { name: 'zap', label: 'Energia', component: Zap }
    ]
  }
};

// Emojis populares como alternativa
const EMOJI_ICONS = [
  { name: 'credit-card-emoji', label: 'Cartão 💳', emoji: '💳' },
  { name: 'money-emoji', label: 'Dinheiro 💰', emoji: '💰' },
  { name: 'bank-emoji', label: 'Banco 🏦', emoji: '🏦' },
  { name: 'phone-emoji', label: 'Telefone 📱', emoji: '📱' },
  { name: 'store-emoji', label: 'Loja 🏪', emoji: '🏪' },
  { name: 'globe-emoji', label: 'Mundial 🌍', emoji: '🌍' },
  { name: 'star-emoji', label: 'Estrela ⭐', emoji: '⭐' },
  { name: 'heart-emoji', label: 'Coração ❤️', emoji: '❤️' },
  { name: 'fire-emoji', label: 'Fogo 🔥', emoji: '🔥' },
  { name: 'diamond-emoji', label: 'Diamante 💎', emoji: '💎' },
  { name: 'crown-emoji', label: 'Coroa 👑', emoji: '👑' },
  { name: 'gift-emoji', label: 'Presente 🎁', emoji: '🎁' }
];

interface IconSelectorProps {
  value?: string;
  onChange: (iconName: string, iconType: 'lucide' | 'emoji') => void;
  label?: string;
  placeholder?: string;
  showEmojiTab?: boolean;
  showFavorites?: boolean;
  showRecent?: boolean;
  maxRecentIcons?: number;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function IconSelector({
  value = 'package',
  onChange,
  label = 'Ícone',
  placeholder = 'Selecione um ícone',
  showEmojiTab = true,
  showFavorites = true,
  showRecent = true,
  maxRecentIcons = 12,
  className,
  disabled = false,
  size = 'md'
}: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentIcons, setRecentIcons] = useState<Array<{name: string, type: 'lucide' | 'emoji'}>>([]);
  const [favoriteIcons, setFavoriteIcons] = useState<Array<{name: string, type: 'lucide' | 'emoji'}>>([]);

  // Carregar favoritos e recentes do localStorage
  useEffect(() => {
    if (showRecent) {
      const savedRecent = localStorage.getItem('icon-selector-recent');
      if (savedRecent) {
        try {
          setRecentIcons(JSON.parse(savedRecent));
        } catch (error) {
          console.error('Erro ao carregar ícones recentes:', error);
        }
      }
    }

    if (showFavorites) {
      const savedFavorites = localStorage.getItem('icon-selector-favorites');
      if (savedFavorites) {
        try {
          setFavoriteIcons(JSON.parse(savedFavorites));
        } catch (error) {
          console.error('Erro ao carregar ícones favoritos:', error);
        }
      }
    }
  }, [showRecent, showFavorites]);

  // Filtrar ícones baseado na busca
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return ICON_CATEGORIES;

    const filtered: typeof ICON_CATEGORIES = {};
    
    Object.entries(ICON_CATEGORIES).forEach(([key, category]) => {
      const filteredIcons = category.icons.filter(icon =>
        icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        icon.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filteredIcons.length > 0) {
        filtered[key as keyof typeof ICON_CATEGORIES] = {
          ...category,
          icons: filteredIcons
        };
      }
    });

    return filtered;
  }, [searchTerm]);

  // Filtrar emojis baseado na busca
  const filteredEmojis = useMemo(() => {
    if (!searchTerm) return EMOJI_ICONS;
    
    return EMOJI_ICONS.filter(emoji =>
      emoji.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emoji.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Adicionar aos recentes
  const addToRecent = (iconName: string, iconType: 'lucide' | 'emoji') => {
    if (!showRecent) return;
    
    const newIcon = { name: iconName, type: iconType };
    const updated = [newIcon, ...recentIcons.filter(icon => 
      !(icon.name === iconName && icon.type === iconType)
    )].slice(0, maxRecentIcons);
    
    setRecentIcons(updated);
    localStorage.setItem('icon-selector-recent', JSON.stringify(updated));
  };

  // Alternar favorito
  const toggleFavorite = (iconName: string, iconType: 'lucide' | 'emoji', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showFavorites) return;
    
    const iconObj = { name: iconName, type: iconType };
    const isFavorite = favoriteIcons.some(icon => 
      icon.name === iconName && icon.type === iconType
    );
    
    const updated = isFavorite
      ? favoriteIcons.filter(icon => !(icon.name === iconName && icon.type === iconType))
      : [...favoriteIcons, iconObj];
    
    setFavoriteIcons(updated);
    localStorage.setItem('icon-selector-favorites', JSON.stringify(updated));
  };

  // Verificar se é favorito
  const isFavorite = (iconName: string, iconType: 'lucide' | 'emoji') => {
    return favoriteIcons.some(icon => icon.name === iconName && icon.type === iconType);
  };

  // Selecionar ícone
  const handleIconSelect = (iconName: string, iconType: 'lucide' | 'emoji') => {
    onChange(iconName, iconType);
    addToRecent(iconName, iconType);
    setIsOpen(false);
  };

  // Renderizar ícone atual
  const renderCurrentIcon = () => {
    // Se for emoji
    if (value.includes('emoji')) {
      const emoji = EMOJI_ICONS.find(e => e.name === value);
      return emoji ? (
        <span className="text-lg">{emoji.emoji}</span>
      ) : (
        <Package className="h-5 w-5" />
      );
    }
    
    // Se for ícone Lucide
    const allIcons = Object.values(ICON_CATEGORIES).flatMap(cat => cat.icons);
    const icon = allIcons.find(i => i.name === value);
    
    if (icon) {
      const IconComponent = icon.component;
      return <IconComponent className="h-5 w-5" />;
    }
    
    return <Package className="h-5 w-5" />;
  };

  // Tamanhos dos ícones baseado na prop size
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const buttonSizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-between", buttonSizes[size])}
            disabled={disabled}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                {renderCurrentIcon()}
              </div>
              <span className="text-sm">{placeholder}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-96 p-0" align="start">
          <div className="border-b border-gray-200 p-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar ícones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="lucide" className="w-full">
            <div className="border-b border-gray-200 px-4 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="lucide">Ícones</TabsTrigger>
                {showEmojiTab && <TabsTrigger value="emoji">Emojis</TabsTrigger>}
                {(showFavorites || showRecent) && <TabsTrigger value="favorites">Salvos</TabsTrigger>}
              </TabsList>
            </div>

            {/* Tab: Ícones Lucide */}
            <TabsContent value="lucide" className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(filteredCategories).map(([key, category]) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-medium text-gray-700">{category.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {category.icons.length}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-6 gap-2">
                    {category.icons.map((icon) => (
                      <div key={icon.name} className="relative group">
                        <button
                          className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center relative bg-white hover:bg-blue-50 transition-all"
                          onClick={() => handleIconSelect(icon.name, 'lucide')}
                          title={icon.label}
                        >
                          <icon.component className={iconSizes[size]} />
                          
                          {/* Indicador de selecionado */}
                          {value === icon.name && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-2 w-2 text-white" />
                            </div>
                          )}
                          
                          {/* Botão de favorito */}
                          {showFavorites && (
                            <button
                              className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                              onClick={(e) => toggleFavorite(icon.name, 'lucide', e)}
                            >
                              <Heart 
                                className={cn(
                                  "h-2 w-2",
                                  isFavorite(icon.name, 'lucide') 
                                    ? "text-red-500 fill-current" 
                                    : "text-gray-400"
                                )} 
                              />
                            </button>
                          )}
                        </button>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {icon.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {Object.keys(filteredCategories).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Grid3x3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum ícone encontrado</p>
                  <p className="text-sm">Tente outros termos de busca</p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Emojis */}
            {showEmojiTab && (
              <TabsContent value="emoji" className="p-4 space-y-4 max-h-96 overflow-y-auto">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Emojis Populares</h4>
                  <div className="grid grid-cols-6 gap-2">
                    {filteredEmojis.map((emoji) => (
                      <div key={emoji.name} className="relative group">
                        <button
                          className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center relative bg-white hover:bg-blue-50 transition-all"
                          onClick={() => handleIconSelect(emoji.name, 'emoji')}
                          title={emoji.label}
                        >
                          <span className="text-2xl">{emoji.emoji}</span>
                          
                          {/* Indicador de selecionado */}
                          {value === emoji.name && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-2 w-2 text-white" />
                            </div>
                          )}
                          
                          {/* Botão de favorito */}
                          {showFavorites && (
                            <button
                              className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                              onClick={(e) => toggleFavorite(emoji.name, 'emoji', e)}
                            >
                              <Heart 
                                className={cn(
                                  "h-2 w-2",
                                  isFavorite(emoji.name, 'emoji') 
                                    ? "text-red-500 fill-current" 
                                    : "text-gray-400"
                                )} 
                              />
                            </button>
                          )}
                        </button>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {emoji.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {filteredEmojis.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Grid3x3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum emoji encontrado</p>
                    <p className="text-sm">Tente outros termos de busca</p>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Tab: Favoritos e Recentes */}
            {(showFavorites || showRecent) && (
              <TabsContent value="favorites" className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Ícones Favoritos */}
                {showFavorites && favoriteIcons.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <h4 className="text-sm font-medium text-gray-700">Favoritos</h4>
                      <Badge variant="secondary" className="text-xs">
                        {favoriteIcons.length}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-2">
                      {favoriteIcons.map(({ name, type }) => (
                        <div key={`${name}-${type}`} className="relative group">
                          <button
                            className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center relative bg-white hover:bg-blue-50 transition-all"
                            onClick={() => handleIconSelect(name, type)}
                          >
                            {type === 'emoji' ? (
                              <span className="text-2xl">
                                {EMOJI_ICONS.find(e => e.name === name)?.emoji}
                              </span>
                            ) : (
                              (() => {
                                const allIcons = Object.values(ICON_CATEGORIES).flatMap(cat => cat.icons);
                                const icon = allIcons.find(i => i.name === name);
                                return icon ? <icon.component className={iconSizes[size]} /> : null;
                              })()
                            )}
                            
                            {value === name && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-2 w-2 text-white" />
                              </div>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ícones Recentes */}
                {showRecent && recentIcons.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <h4 className="text-sm font-medium text-gray-700">Recentes</h4>
                      <Badge variant="secondary" className="text-xs">
                        {recentIcons.length}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-2">
                      {recentIcons.map(({ name, type }) => (
                        <div key={`recent-${name}-${type}`} className="relative group">
                          <button
                            className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center relative bg-white hover:bg-blue-50 transition-all"
                            onClick={() => handleIconSelect(name, type)}
                          >
                            {type === 'emoji' ? (
                              <span className="text-2xl">
                                {EMOJI_ICONS.find(e => e.name === name)?.emoji}
                              </span>
                            ) : (
                              (() => {
                                const allIcons = Object.values(ICON_CATEGORIES).flatMap(cat => cat.icons);
                                const icon = allIcons.find(i => i.name === name);
                                return icon ? <icon.component className={iconSizes[size]} /> : null;
                              })()
                            )}
                            
                            {value === name && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-2 w-2 text-white" />
                              </div>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {favoriteIcons.length === 0 && recentIcons.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum ícone salvo ainda</p>
                    <p className="text-sm">Favorite ícones para vê-los aqui</p>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}