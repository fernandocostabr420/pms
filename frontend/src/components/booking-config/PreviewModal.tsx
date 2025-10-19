// frontend/src/components/booking-config/PreviewModal.tsx
'use client';

import { useState } from 'react';
import { X, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PreviewModalProps {
  config: any;
  propertyId: number;
  onClose: () => void;
}

export default function PreviewModal({ config, propertyId, onClose }: PreviewModalProps) {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const getPublicUrl = () => {
    const slug = config.custom_slug || 'preview';
    return `${process.env.NEXT_PUBLIC_BOOKING_ENGINE_URL || 'http://localhost:3001'}/${slug}`;
  };

  const deviceSizes = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '90%' },
    mobile: { width: '375px', height: '90%' }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Preview do Motor de Reservas</DialogTitle>
              <DialogDescription>
                Visualize como seu site ficará para os visitantes
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Device Switcher */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={device === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === 'tablet' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setDevice('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setDevice('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" size="sm" asChild>
                <a 
                  href={getPublicUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em Nova Aba
                </a>
              </Button>

              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Area */}
        <div className="flex-1 bg-gray-100 p-6 overflow-auto">
          <div className="flex items-center justify-center min-h-full">
            <div
              className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
              style={deviceSizes[device]}
            >
              {/* Iframe Preview */}
              <iframe
                src={getPublicUrl()}
                className="w-full h-full border-0"
                title="Preview do Motor de Reservas"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {device === 'desktop' && '1920x1080'}
                {device === 'tablet' && '768x1024'}
                {device === 'mobile' && '375x667'}
              </Badge>
              <span>
                {device === 'desktop' && 'Desktop'}
                {device === 'tablet' && 'Tablet'}
                {device === 'mobile' && 'Mobile'}
              </span>
            </div>

            {!config.is_active && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                Motor Desativado
              </Badge>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Este é um preview. Salve as alterações para aplicá-las ao site público.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}