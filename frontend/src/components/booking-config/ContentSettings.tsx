// frontend/src/components/booking-config/ContentSettings.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Image as ImageIcon,
  Upload,
  X,
  Plus,
  Star,
  Info,
  GripVertical,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Globe
} from 'lucide-react';

interface ContentSettingsProps {
  config: any;
  onChange: (field: string, value: any) => void;
}

export default function ContentSettings({ config, onChange }: ContentSettingsProps) {
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    rating: 5,
    text: ''
  });

  const addGalleryPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    
    const currentPhotos = config.gallery_photos || [];
    onChange('gallery_photos', [...currentPhotos, newPhotoUrl.trim()]);
    setNewPhotoUrl('');
  };

  const removeGalleryPhoto = (index: number) => {
    const currentPhotos = config.gallery_photos || [];
    onChange('gallery_photos', currentPhotos.filter((_: any, i: number) => i !== index));
  };

  const addHeroPhoto = (url: string) => {
    const currentPhotos = config.hero_photos || [];
    onChange('hero_photos', [...currentPhotos, url]);
  };

  const removeHeroPhoto = (index: number) => {
    const currentPhotos = config.hero_photos || [];
    onChange('hero_photos', currentPhotos.filter((_: any, i: number) => i !== index));
  };

  const addTestimonial = () => {
    if (!newTestimonial.name.trim() || !newTestimonial.text.trim()) {
      alert('Preencha o nome e o depoimento');
      return;
    }

    const currentTestimonials = config.testimonials || [];
    onChange('testimonials', [...currentTestimonials, { ...newTestimonial }]);
    setNewTestimonial({ name: '', rating: 5, text: '' });
  };

  const removeTestimonial = (index: number) => {
    const currentTestimonials = config.testimonials || [];
    onChange('testimonials', currentTestimonials.filter((_: any, i: number) => i !== index));
  };

  const updateSocialLink = (platform: string, url: string) => {
    const currentLinks = config.social_links || {};
    onChange('social_links', {
      ...currentLinks,
      [platform]: url
    });
  };

  const socialPlatforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/sua-pagina' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/seu-perfil' },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, placeholder: 'https://twitter.com/seu-perfil' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/seu-canal' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/company/sua-empresa' },
    { id: 'website', name: 'Website', icon: Globe, placeholder: 'https://www.seusite.com' },
  ];

  return (
    <div className="space-y-6">
      {/* Textos de Boas-vindas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Textos de Apresentação
          </CardTitle>
          <CardDescription>
            Configure os textos que aparecerão na página inicial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="welcome_text">
              Texto de Boas-vindas (Hero Section)
            </Label>
            <Textarea
              id="welcome_text"
              placeholder="Bem-vindo à nossa pousada! Desfrute de momentos inesquecíveis..."
              value={config.welcome_text || ''}
              onChange={(e) => onChange('welcome_text', e.target.value || null)}
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Texto principal que aparece no topo da página</span>
              <span>{(config.welcome_text || '').length}/500</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="about_text">
              Sobre a Propriedade (Descrição Detalhada)
            </Label>
            <Textarea
              id="about_text"
              placeholder="Nossa pousada oferece acomodações confortáveis e aconchegantes..."
              value={config.about_text || ''}
              onChange={(e) => onChange('about_text', e.target.value || null)}
              rows={6}
              maxLength={2000}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Descrição completa da propriedade, diferenciais e comodidades</span>
              <span>{(config.about_text || '').length}/2000</span>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Use textos claros e atrativos que destaquem os principais diferenciais da sua propriedade.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Fotos Hero (Carrossel Principal) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Fotos do Carrossel Principal (Hero)
          </CardTitle>
          <CardDescription>
            Fotos que aparecerão no carrossel do topo da página
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.hero_photos && config.hero_photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {config.hero_photos.map((photo: string, index: number) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`Hero ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeHeroPhoto(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="URL da foto (https://...)"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addHeroPhoto(newPhotoUrl);
                  setNewPhotoUrl('');
                }
              }}
            />
            <Button 
              onClick={() => {
                addHeroPhoto(newPhotoUrl);
                setNewPhotoUrl('');
              }}
              disabled={!newPhotoUrl.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <p className="text-sm text-gray-600">
            Recomendado: 3-5 fotos em alta resolução (mínimo 1920x1080px)
          </p>
        </CardContent>
      </Card>

      {/* Galeria de Fotos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Galeria de Fotos
          </CardTitle>
          <CardDescription>
            Fotos adicionais da propriedade, quartos e instalações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.gallery_photos && config.gallery_photos.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {config.gallery_photos.map((photo: string, index: number) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeGalleryPhoto(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="URL da foto (https://...)"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addGalleryPhoto();
                }
              }}
            />
            <Button onClick={addGalleryPhoto} disabled={!newPhotoUrl.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Cole URLs de imagens já hospedadas ou faça upload em um serviço como Imgur, Cloudinary ou seu próprio servidor.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Depoimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Depoimentos de Hóspedes
          </CardTitle>
          <CardDescription>
            Adicione avaliações e comentários de hóspedes satisfeitos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.testimonials && config.testimonials.length > 0 && (
            <div className="space-y-4">
              {config.testimonials.map((testimonial: any, index: number) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => removeTestimonial(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{testimonial.name}</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < testimonial.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700">{testimonial.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 space-y-4">
            <h4 className="font-medium">Adicionar Novo Depoimento</h4>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="testimonial_name">Nome do Hóspede</Label>
                  <Input
                    id="testimonial_name"
                    placeholder="João Silva"
                    value={newTestimonial.name}
                    onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testimonial_rating">Avaliação</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setNewTestimonial({ ...newTestimonial, rating })}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            rating <= newTestimonial.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testimonial_text">Depoimento</Label>
                <Textarea
                  id="testimonial_text"
                  placeholder="Experiência maravilhosa! Atendimento excepcional..."
                  value={newTestimonial.text}
                  onChange={(e) => setNewTestimonial({ ...newTestimonial, text: e.target.value })}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 text-right">
                  {newTestimonial.text.length}/500
                </p>
              </div>

              <Button 
                onClick={addTestimonial}
                disabled={!newTestimonial.name.trim() || !newTestimonial.text.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Depoimento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Redes Sociais
          </CardTitle>
          <CardDescription>
            Links para suas redes sociais e website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {socialPlatforms.map((platform) => (
            <div key={platform.id} className="space-y-2">
              <Label htmlFor={`social_${platform.id}`} className="flex items-center gap-2">
                <platform.icon className="h-4 w-4" />
                {platform.name}
              </Label>
              <Input
                id={`social_${platform.id}`}
                type="url"
                placeholder={platform.placeholder}
                value={config.social_links?.[platform.id] || ''}
                onChange={(e) => updateSocialLink(platform.id, e.target.value)}
              />
            </div>
          ))}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Os ícones das redes sociais aparecerão no rodapé do site apenas para os links preenchidos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}