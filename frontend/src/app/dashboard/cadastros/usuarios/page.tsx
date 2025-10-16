// frontend/src/app/dashboard/cadastros/usuarios/page.tsx
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  Filter,
  MoreHorizontal,
  Pencil,
  Key,
  Power,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  User,
  AlertCircle
} from 'lucide-react';
import { useUsers } from '@/hooks/use-users';
import { UserResponse, UserCreate, UserUpdate, AdminResetPassword } from '@/lib/api/users';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function UsuariosPage() {
  const {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    adminResetPassword,
    setFilters,
    clearFilters,
    refresh
  } = useUsers();

  // Estados dos modais
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);

  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Estados dos formulários
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    is_superuser: false,
    is_active: true
  });

  const [resetPasswordData, setResetPasswordData] = useState({
    new_password: '',
    must_change_password: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || 
                       (statusFilter === 'active' && user.is_active) ||
                       (statusFilter === 'inactive' && !user.is_active);
    const matchRole = roleFilter === 'all' ||
                     (roleFilter === 'admin' && user.is_superuser) ||
                     (roleFilter === 'user' && !user.is_superuser);
    
    return matchSearch && matchStatus && matchRole;
  });

  // Aplicar filtros
  const handleApplyFilters = () => {
    setFilters({
      search: searchTerm || undefined,
      is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      is_superuser: roleFilter === 'admin' ? true : roleFilter === 'user' ? false : undefined
    });
  };

  // Limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRoleFilter('all');
    clearFilters();
  };

  // Abrir modal de criação
  const handleOpenCreateModal = () => {
    setFormData({
      email: '',
      full_name: '',
      password: '',
      is_superuser: false,
      is_active: true
    });
    setCreateModalOpen(true);
  };

  // Abrir modal de edição
  const handleOpenEditModal = (user: UserResponse) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      password: '',
      is_superuser: user.is_superuser,
      is_active: user.is_active
    });
    setEditModalOpen(true);
  };

  // Abrir modal de reset de senha
  const handleOpenResetPasswordModal = (user: UserResponse) => {
    setSelectedUser(user);
    setResetPasswordData({
      new_password: '',
      must_change_password: true
    });
    setResetPasswordModalOpen(true);
  };

  // Criar usuário
  const handleCreateUser = async () => {
    if (!formData.email || !formData.full_name || !formData.password) {
      return;
    }

    setSubmitting(true);
    const data: UserCreate = {
      email: formData.email,
      full_name: formData.full_name,
      password: formData.password,
      is_superuser: formData.is_superuser
    };

    const result = await createUser(data);
    setSubmitting(false);

    if (result) {
      setCreateModalOpen(false);
      refresh();
    }
  };

  // Atualizar usuário
  const handleUpdateUser = async () => {
    if (!selectedUser || !formData.email || !formData.full_name) {
      return;
    }

    setSubmitting(true);
    const data: UserUpdate = {
      email: formData.email,
      full_name: formData.full_name,
      is_superuser: formData.is_superuser,
      is_active: formData.is_active
    };

    const result = await updateUser(selectedUser.id, data);
    setSubmitting(false);

    if (result) {
      setEditModalOpen(false);
      refresh();
    }
  };

  // Resetar senha
  const handleResetPassword = async () => {
    if (!selectedUser || !resetPasswordData.new_password) {
      return;
    }

    if (resetPasswordData.new_password.length < 6) {
      return;
    }

    setSubmitting(true);
    const result = await adminResetPassword(selectedUser.id, resetPasswordData);
    setSubmitting(false);

    if (result) {
      setResetPasswordModalOpen(false);
      refresh();
    }
  };

  // Desativar usuário
  const handleDeleteUser = async (user: UserResponse) => {
    if (confirm(`Deseja realmente desativar o usuário ${user.full_name}?`)) {
      await deleteUser(user.id);
      refresh();
    }
  };

  // Verificar se pode resetar senha (não pode resetar senha de outro admin)
  const canResetPassword = (user: UserResponse) => {
    // Assumindo que o usuário atual é superuser (você pode pegar do contexto/auth)
    return !user.is_superuser;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Usuários
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie usuários do sistema
          </p>
        </div>
        
        <Button onClick={handleOpenCreateModal}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
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
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar Filtros
              </Button>
              <span className="text-sm text-gray-600">
                {filteredUsers.length} usuário(s) encontrado(s)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium text-gray-600">Usuário</th>
                    <th className="text-left p-4 font-medium text-gray-600">Email</th>
                    <th className="text-left p-4 font-medium text-gray-600">Tipo</th>
                    <th className="text-left p-4 font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 font-medium text-gray-600">Último Login</th>
                    <th className="text-right p-4 font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">{user.email}</td>
                      <td className="p-4">
                        {user.is_superuser ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <User className="h-3 w-3 mr-1" />
                            Usuário
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {user.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleDateString('pt-BR')
                          : 'Nunca'
                        }
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenEditModal(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {canResetPassword(user) && (
                              <DropdownMenuItem onClick={() => handleOpenResetPasswordModal(user)}>
                                <Key className="h-4 w-4 mr-2" />
                                Resetar Senha
                              </DropdownMenuItem>
                            )}
                            {user.is_active && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user)}
                                className="text-red-600"
                              >
                                <Power className="h-4 w-4 mr-2" />
                                Desativar
                              </DropdownMenuItem>
                            )}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="João Silva"
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="joao@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="is_superuser" className="cursor-pointer">Administrador</Label>
                <p className="text-xs text-gray-500">Conceder privilégios de admin</p>
              </div>
              <Switch
                id="is_superuser"
                checked={formData.is_superuser}
                onCheckedChange={(checked) => setFormData({ ...formData, is_superuser: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Usuário'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuário */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Nome Completo *</Label>
              <Input
                id="edit_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="edit_is_superuser" className="cursor-pointer">Administrador</Label>
                <p className="text-xs text-gray-500">Privilégios de admin</p>
              </div>
              <Switch
                id="edit_is_superuser"
                checked={formData.is_superuser}
                onCheckedChange={(checked) => setFormData({ ...formData, is_superuser: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="edit_is_active" className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-gray-500">Usuário pode acessar o sistema</p>
              </div>
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resetar Senha */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Resetar Senha do Usuário
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Usuário:</strong> {selectedUser.full_name}<br />
                  <strong>Email:</strong> {selectedUser.email}
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="new_password">Nova Senha *</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPasswordData.new_password}
                    onChange={(e) => setResetPasswordData({ 
                      ...resetPasswordData, 
                      new_password: e.target.value 
                    })}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {resetPasswordData.new_password && resetPasswordData.new_password.length < 6 && (
                  <p className="text-xs text-red-600 mt-1">A senha deve ter pelo menos 6 caracteres</p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="must_change" className="cursor-pointer">Forçar troca no próximo login</Label>
                  <p className="text-xs text-gray-500">Usuário deverá alterar a senha ao fazer login</p>
                </div>
                <Switch
                  id="must_change"
                  checked={resetPasswordData.must_change_password}
                  onCheckedChange={(checked) => setResetPasswordData({ 
                    ...resetPasswordData, 
                    must_change_password: checked 
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleResetPassword} 
              disabled={submitting || resetPasswordData.new_password.length < 6}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetando...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Resetar Senha
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}