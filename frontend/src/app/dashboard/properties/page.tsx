// src/app/dashboard/properties/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  MapPin, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  Phone,
  Mail,
  Globe
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import apiClient from '@/lib/api';
import { PropertyResponse } from '@/types/api';
import PropertyModal from '@/components/properties/PropertyModal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';

const PROPERTY_TYPES = {
  hotel: 'Hotel',
  pousada: 'Pousada',
  resort: 'Resort',
  hostel: 'Hostel',
  apart_hotel: 'Apart Hotel'
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertyResponse | null>(null);
  const { toast } = useToast();

  // Carregamento inicial
  useEffect(() => {
    loadProperties();
  }, [searchTerm, propertyType]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (propertyType) params.property_type = propertyType;
      
      // Use o método específico que já existe na API
      const data = await apiClient.getProperties(params);
      setProperties(data.properties || []);
    } catch (error) {
      console.error('Erro ao carregar propriedades:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar propriedades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProperty = () => {
    setSelectedProperty(null);
    setIsModalOpen(true);
  };

  const handleEditProperty = (property: PropertyResponse) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const handleDeleteProperty = (property: PropertyResponse) => {
    setPropertyToDelete(property);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!propertyToDelete) return;

    try {
      await apiClient.deleteProperty(propertyToDelete.id); // Use o método específico
      toast({
        title: "Sucesso",
        description: "Propriedade excluída com sucesso",
      });
      loadProperties();
    } catch (error) {
      console.error('Erro ao excluir propriedade:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir propriedade",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setPropertyToDelete(null);
    }
  };

  const handleModalClose = (needsRefresh = false) => {
    setIsModalOpen(false);
    setSelectedProperty(null);
    if (needsRefresh) {
      loadProperties();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propriedades</h1>
          <p className="text-gray-600">Gerencie suas propriedades hoteleiras</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propriedades</h1>
          <p className="text-gray-600">Gerencie suas propriedades hoteleiras</p>
        </div>
        
        {/* LÓGICA CONDICIONAL - Mostrar botão apenas se não há propriedades */}
        {properties.length === 0 ? (
          <Button onClick={handleCreateProperty} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Propriedade
          </Button>
        ) : (
          <div className="text-right">
            <Button 
              disabled 
              className="flex items-center gap-2 opacity-50 cursor-not-allowed"
              title="Apenas uma propriedade é permitida por conta"
            >
              <Building className="h-4 w-4" />
              Propriedade Cadastrada
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Apenas uma propriedade permitida
            </p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar propriedades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Propriedades */}
      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma propriedade encontrada
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || propertyType 
                ? 'Tente ajustar os filtros de busca' 
                : 'Comece criando sua primeira propriedade'
              }
            </p>
            {!searchTerm && !propertyType && (
              <Button onClick={handleCreateProperty}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Propriedade
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* NOVO: Banner informativo quando há propriedade cadastrada */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-blue-800 font-medium">
                Propriedade cadastrada: <strong>{properties[0]?.name}</strong>
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Apenas uma propriedade é permitida por conta. Para alterar, edite a propriedade existente.
            </p>
          </div>

          {/* Grid das propriedades */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                        {property.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type}
                      </Badge>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditProperty(property)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteProperty(property)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Endereço */}
                  {property.address && (
                    <div className="flex items-start gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600 line-clamp-2">
                        {[
                          property.address,
                          property.city,
                          property.state
                        ].filter(Boolean).join(', ')}
                        {property.zip_code && ` - ${property.zip_code}`}
                      </span>
                    </div>
                  )}

                  {/* Contato */}
                  <div className="space-y-1 mb-3">
                    {property.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{property.phone}</span>
                      </div>
                    )}
                    
                    {property.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{property.email}</span>
                      </div>
                    )}
                    
                    {property.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a 
                          href={property.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Site
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Check-in/out */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Check-in: {property.check_in_time || '14:00'}</span>
                      <span>Check-out: {property.check_out_time || '12:00'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Modal de Propriedade */}
      <PropertyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        property={selectedProperty}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Propriedade"
        description={`Tem certeza que deseja excluir a propriedade "${propertyToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
      />
    </div>
  );
}