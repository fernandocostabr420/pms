// frontend/src/app/dashboard/cadastros/canais-venda/page.tsx
'use client';

import { useState, useEffect } from 'react';

// Tipo básico para testing
interface SalesChannel {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  is_external: boolean;
}

export default function CanaisVendaPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simular dados para teste
  useEffect(() => {
    const mockChannels: SalesChannel[] = [
      {
        id: 1,
        name: 'Booking.com',
        code: 'booking',
        is_active: true,
        is_external: true,
      },
      {
        id: 2,
        name: 'Site Oficial',
        code: 'direct',
        is_active: true,
        is_external: false,
      },
    ];

    setTimeout(() => {
      setChannels(mockChannels);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>Canais de Venda</h1>
        <p>Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>Canais de Venda</h1>
        <div style={{ color: 'red', padding: '16px', border: '1px solid red', borderRadius: '4px' }}>
          Erro: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Canais de Venda
        </h1>
        <p style={{ color: '#666' }}>
          Configure os canais de venda da sua propriedade
        </p>
      </div>

      {/* Botão de ação */}
      <div style={{ marginBottom: '24px' }}>
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={() => alert('Função de criar canal será implementada')}
        >
          + Novo Canal
        </button>
      </div>

      {/* Lista de canais */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0' }}>
            Canais Cadastrados ({channels.length})
          </h2>
        </div>

        <div>
          {channels.length === 0 ? (
            <div style={{
              padding: '48px',
              textAlign: 'center' as const,
              color: '#6b7280',
            }}>
              <p style={{ marginBottom: '16px' }}>Nenhum canal encontrado</p>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={() => alert('Função de criar canal será implementada')}
              >
                Criar Primeiro Canal
              </button>
            </div>
          ) : (
            <div>
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  style={{
                    padding: '16px',
                    borderBottom: channels.indexOf(channel) < channels.length - 1 ? '1px solid #e5e7eb' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '500' }}>
                      {channel.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                      <span>Código: {channel.code}</span>
                      {channel.is_external && (
                        <span style={{ color: '#3b82f6' }}>• Externo</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        borderRadius: '12px',
                        backgroundColor: channel.is_active ? '#dcfce7' : '#fee2e2',
                        color: channel.is_active ? '#166534' : '#dc2626',
                      }}
                    >
                      {channel.is_active ? 'Ativo' : 'Inativo'}
                    </span>

                    <button
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      onClick={() => alert(`Ações para ${channel.name} serão implementadas`)}
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer de informação */}
      <div style={{ marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
        <p>
          Total: {channels.length} canais |{' '}
          Ativos: {channels.filter(c => c.is_active).length} |{' '}
          Externos: {channels.filter(c => c.is_external).length}
        </p>
      </div>
    </div>
  );
}