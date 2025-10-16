// frontend/src/app/dashboard/cadastros/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Store,
  Plus,
  ArrowRight,
  Settings,
  Database,
  Activity,
  BarChart3,
  Users,
  Shield,
  User
} from 'lucide-react';
import Link from 'next/link';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { useSalesChannels } from '@/hooks/use-sales-channels';
import { useUsers } from '@/hooks/use-users';

export default function CadastrosPage() {
  const { 
    paymentMethods, 
    loading: loadingPaymentMethods, 
    total: totalPaymentMethods 
  } = usePaymentMethods({ per_page: 5 });

  const { 
    salesChannels, 
    loading: loadingSalesChannels, 
    total: totalSalesChannels 
  } = useSalesChannels({ per_page: 5 });

  const {
    users,
    loading: loadingUsers
  } = useUsers();

  // Estatísticas rápidas
  const activePaymentMethods = paymentMethods.filter(pm => pm.is_active).length;
  const activeSalesChannels = salesChannels.filter(sc => sc.is_active).length;
  const externalChannels = salesChannels.filter(sc => sc.is_external).length;
  const activeUsers = users.filter(u => u.is_active).length;
  const adminUsers = users.filter(u => u.is_superuser).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastros</h1>
          <p className="text-gray-600 mt-1">
            Gerencie métodos de pagamento, canais de venda e usuários do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Importar Dados
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Métodos de Pagamento</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {loadingPaymentMethods ? '-' : totalPaymentMethods}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {loadingPaymentMethods ? '-' : activePaymentMethods} ativos
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Store className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Canais de Venda</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {loadingSalesChannels ? '-' : totalSalesChannels}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {loadingSalesChannels ? '-' : activeSalesChannels} ativos
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Usuários</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {loadingUsers ? '-' : users.length}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {loadingUsers ? '-' : activeUsers} ativos
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Taxa Média</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {loadingPaymentMethods ? '-' : 
                      paymentMethods.length > 0 
                        ? ((paymentMethods.reduce((sum, pm) => sum + (pm.fee_percentage || 0), 0) / paymentMethods.length).toFixed(1) + '%')
                        : '0%'
                    }
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    pagamentos
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards principais de navegação */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Métodos de Pagamento */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Métodos de Pagamento</CardTitle>
                  <CardDescription>
                    Configure as formas de pagamento aceitas
                  </CardDescription>
                </div>
              </div>
              <Link href="/dashboard/cadastros/metodos-pagamento">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </Link>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* Lista rápida dos últimos métodos */}
            <div className="space-y-3 mb-4">
              {loadingPaymentMethods ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-gray-200 rounded mb-1"></div>
                        <div className="w-16 h-3 bg-gray-200 rounded"></div>
                      </div>
                      <div className="w-12 h-5 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : paymentMethods.length > 0 ? (
                paymentMethods.slice(0, 3).map(pm => (
                  <div key={pm.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: pm.color || '#3B82F6' }}
                    >
                      {pm.icon ? pm.icon : pm.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{pm.name}</p>
                      <p className="text-xs text-gray-500">{pm.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pm.fee_percentage && (
                        <span className="text-xs text-gray-600">
                          {pm.fee_percentage}%
                        </span>
                      )}
                      <Badge 
                        variant={pm.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {pm.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">Nenhum método de pagamento cadastrado</p>
                </div>
              )}
            </div>
            
            <Link href="/dashboard/cadastros/metodos-pagamento">
              <Button variant="outline" className="w-full" size="sm">
                Ver todos os métodos
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Canais de Venda */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Store className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Canais de Venda</CardTitle>
                  <CardDescription>
                    Gerencie canais diretos, OTAs e parcerias
                  </CardDescription>
                </div>
              </div>
              <Link href="/dashboard/cadastros/canais-venda">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </Link>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* Lista rápida dos últimos canais */}
            <div className="space-y-3 mb-4">
              {loadingSalesChannels ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-gray-200 rounded mb-1"></div>
                        <div className="w-16 h-3 bg-gray-200 rounded"></div>
                      </div>
                      <div className="w-12 h-5 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : salesChannels.length > 0 ? (
                salesChannels.slice(0, 3).map(sc => (
                  <div key={sc.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <Store className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{sc.name}</p>
                      <p className="text-xs text-gray-500">{sc.channel_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sc.commission_percentage && (
                        <span className="text-xs text-gray-600">
                          {sc.commission_percentage}%
                        </span>
                      )}
                      {sc.is_external && (
                        <Badge variant="outline" className="text-xs">
                          Externo
                        </Badge>
                      )}
                      <Badge 
                        variant={sc.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {sc.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Store className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">Nenhum canal de venda cadastrado</p>
                </div>
              )}
            </div>
            
            <Link href="/dashboard/cadastros/canais-venda">
              <Button variant="outline" className="w-full" size="sm">
                Ver todos os canais
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Usuários */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Usuários</CardTitle>
                  <CardDescription>
                    Gerencie usuários e permissões
                  </CardDescription>
                </div>
              </div>
              <Link href="/dashboard/cadastros/usuarios">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </Link>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* Lista rápida dos últimos usuários */}
            <div className="space-y-3 mb-4">
              {loadingUsers ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-gray-200 rounded mb-1"></div>
                        <div className="w-16 h-3 bg-gray-200 rounded"></div>
                      </div>
                      <div className="w-12 h-5 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : users.length > 0 ? (
                users.slice(0, 3).map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-xs">
                        {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.is_superuser ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          User
                        </Badge>
                      )}
                      <Badge 
                        variant={user.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">Nenhum usuário cadastrado</p>
                </div>
              )}
            </div>
            
            <Link href="/dashboard/cadastros/usuarios">
              <Button variant="outline" className="w-full" size="sm">
                Ver todos os usuários
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Dicas e ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          <CardDescription>
            Configure rapidamente os cadastros essenciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-4 justify-start">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Métodos Padrão</span>
                </div>
                <span className="text-xs text-gray-500">
                  Criar métodos de pagamento básicos
                </span>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 justify-start">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="h-4 w-4" />
                  <span className="font-medium">Canal Direto</span>
                </div>
                <span className="text-xs text-gray-500">
                  Configurar reservas diretas
                </span>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 justify-start">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Novo Usuário</span>
                </div>
                <span className="text-xs text-gray-500">
                  Adicionar usuário ao sistema
                </span>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 justify-start">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4" />
                  <span className="font-medium">Importar Dados</span>
                </div>
                <span className="text-xs text-gray-500">
                  Importar de planilha ou sistema
                </span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}