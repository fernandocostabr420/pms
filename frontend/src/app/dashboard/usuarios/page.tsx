// ARQUIVO 2: frontend/src/app/dashboard/usuarios/page.tsx
// ============================================
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Pencil,
  Key,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  User,
  Trash2,
  Home,
  ChevronRight,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { useUsers } from '@/hooks/use-users';
import { UserResponse, UserCreate, UserUpdate } from '@/lib/api/users';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function UsuariosPage() {
  const { toast } = useToast();
  const {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    adminResetPassword,
    refresh
  } = useUsers();

  // Estados dos modais
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);

  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Estados dos formulários
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    is_superuser: false,
    is_active: true
  });

  const [resetPasswordData, setResetPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  });

  const [editFormData, setEditFormData] = useState<Partial<UserUpdate>>({});

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);
    
    const matchesRole = roleFilter === 'all' ||
      (roleFilter === 'admin' && user.is_superuser) ||
      (roleFilter === 'user' && !user.is_superuser);

    return matchesSearch && matchesStatus && matchesRole;
  });

  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRoleFilter('all');
  };

  // Handlers
  const handleCreateUser = async () => {
    if (!formData.email || !formData.full_name || !formData.password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    try {
      await createUser(formData as UserCreate);
      setCreateModalOpen(false);
      setFormData({
        email: '',
        full_name: '',
        password: '',
        is_superuser: false,
        is_active: true
      });
      setShowPassword(false);
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    if (!editFormData.email || !editFormData.full_name) {
      toast({
        title: "Erro",
        description: "Nome e email são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateUser(selectedUser.id, editFormData);
      setEditModalOpen(false);
      setSelectedUser(null);
      setEditFormData({});
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar usuário",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteUser(selectedUser.id);
      setDeleteModalOpen(false);
      setSelectedUser(null);
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir usuário",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    if (!resetPasswordData.new_password || resetPasswordData.new_password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (resetPasswordData.new_password !== resetPasswordData.confirm_password) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminResetPassword(selectedUser.id, {
        new_password: resetPasswordData.new_password
      });
      setResetPasswordModalOpen(false);
      setSelectedUser(null);
      setResetPasswordData({ new_password: '', confirm_password: '' });
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast({
        title: "Sucesso",
        description: "Senha resetada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao resetar senha",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (user: UserResponse) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      is_superuser: user.is_superuser
    });
    setEditModalOpen(true);
  };

  const openResetPasswordModal = (user: UserResponse) => {
    setSelectedUser(user);
    setResetPasswordData({ new_password: '', confirm_password: '' });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetPasswordModalOpen(true);
  };

  const openDeleteModal = (user: UserResponse) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">Gerenciar Usuários</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
            Gerenciar Usuários
          </h1>
          <p className="text-gray-600 mt-2">
            Crie, edite e gerencie os usuários do sistema
          </p>
        </div>
        
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <UserPlus className="h-5 w-5 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuários Ativos</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {users.filter(u => u.is_active).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Administradores</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {users.filter(u => u.is_superuser).length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuários Inativos</p>
                <p className="text-2xl font-bold text-gray-500 mt-1">
                  {users.filter(u => !u.is_active).length}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <User className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="user">Usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {filteredUsers.length} usuário(s) encontrado(s)
                </p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Usuários ({filteredUsers.length})</span>
            {filteredUsers.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <Loader2 className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
              <p className="text-gray-600">Carregando usuários...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum usuário encontrado</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece criando o primeiro usuário'}
              </p>
              {!searchTerm && statusFilter === 'all' && roleFilter === 'all' && (
                <Button onClick={() => setCreateModalOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Primeiro Usuário
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Último Login
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-12 w-12 flex-shrink-0">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-md">
                              <span className="text-white font-bold text-base">
                                {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {user.full_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_superuser ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-semibold">
                            <User className="h-3 w-3 mr-1" />
                            Usuário
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge 
                          variant={user.is_active ? "default" : "secondary"}
                          className={user.is_active ? "bg-green-100 text-green-800 border-green-200 font-semibold" : "font-semibold"}
                        >
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openEditModal(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPasswordModal(user)}>
                              <Key className="h-4 w-4 mr-2" />
                              Resetar Senha
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDeleteModal(user)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Usuário */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="full_name" className="text-sm font-semibold">
                Nome Completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="João Silva"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-semibold">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="joao@exemplo.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-semibold">
                Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            <div className="pt-4 space-y-4 border-t">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="is_superuser" className="text-sm font-semibold cursor-pointer">
                    Administrador
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Permissão total no sistema
                  </p>
                </div>
                <Switch
                  id="is_superuser"
                  checked={formData.is_superuser}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_superuser: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="is_active" className="text-sm font-semibold cursor-pointer">
                    Conta Ativa
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Usuário pode fazer login
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser}>
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuário */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit_full_name" className="text-sm font-semibold">
                Nome Completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_full_name"
                value={editFormData.full_name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit_email" className="text-sm font-semibold">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_email"
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="pt-4 space-y-4 border-t">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="edit_is_superuser" className="text-sm font-semibold cursor-pointer">
                    Administrador
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Permissão total no sistema
                  </p>
                </div>
                <Switch
                  id="edit_is_superuser"
                  checked={editFormData.is_superuser || false}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_superuser: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="edit_is_active" className="text-sm font-semibold cursor-pointer">
                    Conta Ativa
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Usuário pode fazer login
                  </p>
                </div>
                <Switch
                  id="edit_is_active"
                  checked={editFormData.is_active !== false}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser}>
              <Pencil className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resetar Senha */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Resetar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{selectedUser?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription className="text-sm">
                A nova senha será definida imediatamente. O usuário deverá usar a nova senha no próximo login.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="new_password" className="text-sm font-semibold">
                Nova Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  id="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={resetPasswordData.new_password}
                  onChange={(e) => setResetPasswordData({ 
                    ...resetPasswordData, 
                    new_password: e.target.value 
                  })}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm_password" className="text-sm font-semibold">
                Confirmar Senha <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={resetPasswordData.confirm_password}
                  onChange={(e) => setResetPasswordData({ 
                    ...resetPasswordData, 
                    confirm_password: e.target.value 
                  })}
                  placeholder="Confirme a nova senha"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword}>
              <Key className="h-4 w-4 mr-2" />
              Resetar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-600">Excluir Usuário</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível e não pode ser desfeita
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-red-200 bg-red-50">
            <AlertDescription>
              Você está prestes a excluir permanentemente o usuário <strong>{selectedUser?.full_name}</strong> 
              {' '}(<strong>{selectedUser?.email}</strong>) do sistema.
              <br /><br />
              Todos os dados e históricos associados a este usuário serão perdidos.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}