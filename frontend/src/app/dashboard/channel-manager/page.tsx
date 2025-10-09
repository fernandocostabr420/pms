// frontend/src/app/dashboard/channel-manager/page.tsx
// Path: frontend/src/app/dashboard/channel-manager/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Radio, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Settings,
  BarChart3,
  Users,
  Building
} from 'lucide-react';

import { useChannelManagerCalendar } from '@/hooks/useChannelManagerCalendar';
import { useProperty } from '@/hooks/useProperty';
import { CalendarToolbar } from '@/components/channel-manager/CalendarToolbar';
import { CalendarHeader } from '@/components/channel-manager/CalendarHeader';
import { ChannelManagerCalendar } from '@/components/channel-manager/ChannelManagerCalendar';
import { BulkEditModal } from '@/components/channel-manager/BulkEditModal';
import { CalendarLegend } from '@/components/channel-manager/CalendarLegend';

export default function ChannelManagerPage() {
  const { property, loading: propertyLoading } = useProperty();
  
  const {
    data,
    loading,
    error,
    uiState,
    bulkEditState,
    dateRange,
    setDateRange,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    filters,
    setFilters,
    updateCell,
    startBulkEdit,
    updateBulkEditState,
    executeBulkEdit,
    syncStatus,
    syncWithWuBook,
    refresh,
    calculateStats
  } = useChannelManagerCalendar({
    propertyId: property?.id,
    autoRefresh: true,
    refreshInterval: 60 // Refresh a cada 60 segundos
  });

  const [showOverview, setShowOverview] = useState(true);
  const stats = calculateStats();

  // ============== LOADING STATES ==============
  
  if (propertyLoading || (loading && !data)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============== ERROR STATE ==============
  
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Radio className="h-7 w-7 text-blue-600" />
              Channel Manager
            </h1>
            <p className="text-gray-600 mt-1">Gerencie preços, disponibilidade e sincronização com canais de venda</p>
          </div>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}. Verifique sua conexão ou tente novamente em alguns instantes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ============== MAIN RENDER ==============

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="h-7 w-7 text-blue-600" />
            Channel Manager
            {syncStatus === 'syncing' && (
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie preços, disponibilidade e sincronização com canais de venda
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {syncStatus === 'success' && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Sincronizado
            </Badge>
          )}
          
          <Button 
            onClick={syncWithWuBook}
            disabled={syncStatus === 'syncing'}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            Sincronizar WuBook
          </Button>
          
          <Button onClick={() => setShowOverview(!showOverview)} variant="ghost">
            <BarChart3 className="h-4 w-4 mr-2" />
            {showOverview ? 'Ocultar Resumo' : 'Mostrar Resumo'}
          </Button>
        </div>
      </div>

      {/* ===== OVERVIEW CARDS ===== */}
      {showOverview && data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Total de Quartos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {data.rooms_summary.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data.rooms_summary.filter(r => r.has_channel_mapping).length} mapeados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {data.total_days}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                dias analisados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Taxa de Ocupação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalCells > 0 ? Math.round(((stats.totalCells - stats.availableRooms) / stats.totalCells) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalCells - stats.availableRooms} de {stats.totalCells} células
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Sincronização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(stats.syncRate)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data.statistics.synced_records} de {data.statistics.total_records} registros
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== TOOLBAR ===== */}
      <CalendarToolbar
        dateRange={dateRange}
        setDateRange={setDateRange}
        goToPreviousWeek={goToPreviousWeek}
        goToNextWeek={goToNextWeek}
        goToToday={goToToday}
        filters={filters}
        setFilters={setFilters}
        onBulkEdit={startBulkEdit}
        onRefresh={refresh}
        data={data}
        loading={loading}
      />

      {/* ===== CALENDAR ===== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendário de Disponibilidade
            </CardTitle>
            <CalendarLegend />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Header com datas */}
          <CalendarHeader 
            dateRange={dateRange}
            data={data}
          />
          
          {/* Grid principal do calendário */}
          <ChannelManagerCalendar
            data={data}
            loading={loading}
            onUpdateCell={updateCell}
            uiState={uiState}
            getAvailabilityByRoomDate={async (roomId: number, date: string) => {
              const dayData = data?.calendar_data.find(d => d.date === date);
              return dayData?.availabilities.find(a => a.room_id === roomId) || null;
            }}
          />
        </CardContent>
      </Card>

      {/* ===== BULK EDIT MODAL ===== */}
      <BulkEditModal
        isOpen={bulkEditState.isOpen}
        state={bulkEditState}
        onUpdateState={updateBulkEditState}
        onExecute={executeBulkEdit}
        onClose={() => updateBulkEditState({ isOpen: false })}
        roomsData={data?.rooms_summary || []}
      />

      {/* ===== STATUS INDICATORS ===== */}
      {data && (
        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
          <div className="flex items-center gap-4">
            <span>
              Última atualização: {new Date().toLocaleTimeString('pt-BR')}
            </span>
            {data.sync_status.last_global_sync && (
              <span>
                Última sincronização: {new Date(data.sync_status.last_global_sync).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span>
              {data.sync_status.healthy_configurations} configurações saudáveis
            </span>
            {data.sync_status.error_configurations > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.sync_status.error_configurations} com erro
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}