//frontend/src/components/reservations/CheckInModal.tsx

import React, { useState, useEffect } from 'react';
import { X, MapPin, User, Phone, Mail, Calendar, Globe, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';

// Interfaces TypeScript
interface GuestData {
  first_name: string;
  last_name: string;
  document_number: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender?: string;
  country: string;
  postal_code?: string;
  state?: string;
  city?: string;
  address_line1?: string;
  address_number?: string;
  address_line2?: string;
  neighborhood?: string;
}

interface CheckInData {
  notes: string;
  guest_data: GuestData;
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  existingGuestData?: Partial<GuestData>;
  onSuccess?: () => void;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface FieldValidation {
  isValid: boolean;
  error: string;
  touched: boolean;
}

// Estados brasileiros
const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  onClose,
  reservationId,
  existingGuestData,
  onSuccess
}) => {
  // Estado inicial do formulário
  const [formData, setFormData] = useState<CheckInData>({
    notes: '',
    guest_data: {
      first_name: '',
      last_name: '',
      document_number: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      country: 'Brasil',
      postal_code: '',
      state: '',
      city: '',
      address_line1: '',
      address_number: '',
      address_line2: '',
      neighborhood: ''
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [fieldValidations, setFieldValidations] = useState<Record<string, FieldValidation>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Pré-preenchimento com dados existentes
  useEffect(() => {
    if (existingGuestData && isOpen) {
      setFormData(prev => ({
        ...prev,
        guest_data: {
          ...prev.guest_data,
          ...existingGuestData
        }
      }));
    }
  }, [existingGuestData, isOpen]);

  // Reset do formulário ao fechar
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        notes: '',
        guest_data: {
          first_name: '',
          last_name: '',
          document_number: '',
          email: '',
          phone: '',
          date_of_birth: '',
          gender: '',
          country: 'Brasil',
          postal_code: '',
          state: '',
          city: '',
          address_line1: '',
          address_number: '',
          address_line2: '',
          neighborhood: ''
        }
      });
      setFieldValidations({});
      setSubmitAttempted(false);
      setApiError(null);
    }
  }, [isOpen]);

  // Máscaras de formatação
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4,5})(\d{4})/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  // Validações individuais
  const validateField = (field: string, value: string): FieldValidation => {
    switch (field) {
      case 'first_name':
        if (!value.trim()) {
          return { isValid: false, error: 'Nome é obrigatório', touched: true };
        }
        if (value.trim().length < 2) {
          return { isValid: false, error: 'Nome deve ter pelo menos 2 caracteres', touched: true };
        }
        return { isValid: true, error: '', touched: true };

      case 'last_name':
        if (!value.trim()) {
          return { isValid: false, error: 'Sobrenome é obrigatório', touched: true };
        }
        if (value.trim().length < 2) {
          return { isValid: false, error: 'Sobrenome deve ter pelo menos 2 caracteres', touched: true };
        }
        return { isValid: true, error: '', touched: true };

      case 'document_number':
        if (!value.trim()) {
          return { isValid: false, error: 'CPF é obrigatório', touched: true };
        }
        if (!validateCPF(value)) {
          return { isValid: false, error: 'CPF inválido', touched: true };
        }
        return { isValid: true, error: '', touched: true };

      case 'email':
        if (!value.trim()) {
          return { isValid: false, error: 'Email é obrigatório', touched: true };
        }
        if (!validateEmail(value)) {
          return { isValid: false, error: 'Email inválido', touched: true };
        }
        return { isValid: true, error: '', touched: true };

      case 'phone':
        if (!value.trim()) {
          return { isValid: false, error: 'Telefone é obrigatório', touched: true };
        }
        const phoneNumbers = value.replace(/\D/g, '');
        if (phoneNumbers.length < 10) {
          return { isValid: false, error: 'Telefone deve ter pelo menos 10 dígitos', touched: true };
        }
        return { isValid: true, error: '', touched: true };

      default:
        return { isValid: true, error: '', touched: true };
    }
  };

  const validateCPF = (cpf: string) => {
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validação dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    
    return parseInt(numbers[9]) === digit1 && parseInt(numbers[10]) === digit2;
  };

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validateForm = () => {
    const requiredFields = ['first_name', 'last_name', 'document_number', 'email', 'phone'];
    const newValidations: Record<string, FieldValidation> = {};
    let isFormValid = true;

    requiredFields.forEach(field => {
      const value = formData.guest_data[field as keyof GuestData] || '';
      const validation = validateField(field, value);
      newValidations[field] = validation;
      if (!validation.isValid) {
        isFormValid = false;
      }
    });

    setFieldValidations(newValidations);
    return isFormValid;
  };

  // Busca CEP
  const fetchCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          guest_data: {
            ...prev.guest_data,
            state: data.uf,
            city: data.localidade,
            address_line1: data.logradouro,
            neighborhood: data.bairro
          }
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setApiError(null);
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Log dos dados para debug
      console.log('Dados sendo enviados para check-in:', {
        notes: formData.notes,
        guest_data: {
          ...formData.guest_data,
          document_number: formData.guest_data.document_number.replace(/\D/g, ''),
          phone: formData.guest_data.phone.replace(/\D/g, ''),
          postal_code: formData.guest_data.postal_code?.replace(/\D/g, '')
        }
      });

      await apiClient.checkInReservation(parseInt(reservationId), {
        notes: formData.notes,
        guest_data: {
          ...formData.guest_data,
          document_number: formData.guest_data.document_number.replace(/\D/g, ''),
          phone: formData.guest_data.phone.replace(/\D/g, ''),
          postal_code: formData.guest_data.postal_code?.replace(/\D/g, '')
        }
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Erro completo do check-in:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      
      // Tratar diferentes tipos de erro
      if (error.response?.status === 400) {
        if (error.response?.data?.detail) {
          setApiError(`Erro de validação: ${error.response.data.detail}`);
        } else if (error.response?.data?.errors) {
          // Erros de validação específicos
          const errorMessages = error.response.data.errors.map((err: any) => err.msg).join(', ');
          setApiError(`Dados inválidos: ${errorMessages}`);
        } else {
          setApiError('Dados inválidos. Verifique os campos obrigatórios e tente novamente.');
        }
      } else if (error.response?.status === 404) {
        setApiError('Reserva não encontrada.');
      } else if (error.response?.status === 403) {
        setApiError('Check-in não permitido para esta reserva.');
      } else {
        setApiError('Erro interno do servidor. Tente novamente em alguns instantes.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof GuestData, value: string) => {
    setFormData(prev => ({
      ...prev,
      guest_data: {
        ...prev.guest_data,
        [field]: value
      }
    }));
    
    // Validação em tempo real para campos obrigatórios
    if (['first_name', 'last_name', 'document_number', 'email', 'phone'].includes(field)) {
      const validation = validateField(field, value);
      setFieldValidations(prev => ({
        ...prev,
        [field]: validation
      }));
    }
    
    // Limpar erro da API quando usuário modifica dados
    if (apiError) {
      setApiError(null);
    }
  };

  // Função para obter classe CSS do campo baseado no estado de validação
  const getFieldClassName = (field: string, baseClass: string = '') => {
    const validation = fieldValidations[field];
    const hasError = submitAttempted && validation && !validation.isValid;
    const hasSuccess = validation && validation.isValid && validation.touched;
    
    let className = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all duration-200 ${baseClass}`;
    
    if (hasError) {
      className += ' border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500';
    } else if (hasSuccess) {
      className += ' border-green-500 focus:ring-green-500 focus:border-green-500';
    } else {
      className += ' border-gray-300 focus:ring-blue-500 focus:border-blue-500';
    }
    
    return className;
  };

  // Componente para ícone de validação
  const ValidationIcon = ({ field }: { field: string }) => {
    const validation = fieldValidations[field];
    const hasError = submitAttempted && validation && !validation.isValid;
    const hasSuccess = validation && validation.isValid && validation.touched;
    
    if (hasError) {
      return <AlertCircle className="h-5 w-5 text-red-500 absolute right-3 top-1/2 transform -translate-y-1/2" />;
    } else if (hasSuccess) {
      return <CheckCircle className="h-5 w-5 text-green-500 absolute right-3 top-1/2 transform -translate-y-1/2" />;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Check-in do Hóspede
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Erro da API */}
        {apiError && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{apiError}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Dados Pessoais */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.guest_data.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className={getFieldClassName('first_name', 'pr-10')}
                  placeholder="João"
                />
                <ValidationIcon field="first_name" />
                {submitAttempted && fieldValidations.first_name && !fieldValidations.first_name.isValid && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldValidations.first_name.error}
                  </p>
                )}
              </div>
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sobrenome *
                </label>
                <input
                  type="text"
                  value={formData.guest_data.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className={getFieldClassName('last_name', 'pr-10')}
                  placeholder="Silva"
                />
                <ValidationIcon field="last_name" />
                {submitAttempted && fieldValidations.last_name && !fieldValidations.last_name.isValid && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldValidations.last_name.error}
                  </p>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF *
                </label>
                <input
                  type="text"
                  value={formData.guest_data.document_number}
                  onChange={(e) => handleInputChange('document_number', formatCPF(e.target.value))}
                  className={getFieldClassName('document_number', 'pr-10')}
                  placeholder="123.456.789-00"
                  maxLength={14}
                />
                <ValidationIcon field="document_number" />
                {submitAttempted && fieldValidations.document_number && !fieldValidations.document_number.isValid && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldValidations.document_number.error}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={formData.guest_data.date_of_birth}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gênero
                </label>
                <select
                  value={formData.guest_data.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                  <option value="NI">Não informado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País
                </label>
                <input
                  type="text"
                  value={formData.guest_data.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brasil"
                />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-600" />
              Contato
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.guest_data.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={getFieldClassName('email', 'pr-10')}
                  placeholder="joao@email.com"
                />
                <ValidationIcon field="email" />
                {submitAttempted && fieldValidations.email && !fieldValidations.email.isValid && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldValidations.email.error}
                  </p>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="text"
                  value={formData.guest_data.phone}
                  onChange={(e) => handleInputChange('phone', formatPhone(e.target.value))}
                  className={getFieldClassName('phone', 'pr-10')}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
                <ValidationIcon field="phone" />
                {submitAttempted && fieldValidations.phone && !fieldValidations.phone.isValid && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldValidations.phone.error}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={formData.guest_data.postal_code}
                  onChange={(e) => {
                    const value = formatCEP(e.target.value);
                    handleInputChange('postal_code', value);
                    if (value.replace(/\D/g, '').length === 8) {
                      fetchCEP(value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  placeholder="12345-678"
                  maxLength={9}
                />
                {isLoadingCep && (
                  <Loader2 className="h-4 w-4 text-blue-500 absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin" />
                )}
                {isLoadingCep && <p className="text-blue-500 text-xs mt-1">Buscando CEP...</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.guest_data.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map(state => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.guest_data.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="São Paulo"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rua
                </label>
                <input
                  type="text"
                  value={formData.guest_data.address_line1}
                  onChange={(e) => handleInputChange('address_line1', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rua das Flores"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  value={formData.guest_data.address_number}
                  onChange={(e) => handleInputChange('address_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={formData.guest_data.address_line2}
                  onChange={(e) => handleInputChange('address_line2', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Apto 45"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.guest_data.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Centro"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações do Check-in
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Observações adicionais sobre o check-in..."
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Realizando Check-in...
                </>
              ) : (
                'Realizar Check-in'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckInModal;