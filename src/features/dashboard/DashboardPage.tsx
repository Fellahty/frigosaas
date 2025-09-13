import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { MetricsToday } from '../../types/metrics';
import { KpiCards } from './KpiCards';
import { AlertList } from './AlertList';
import { RoomCapacity } from './RoomCapacity';
import { TopClientsTable } from './TopClientsTable';
import { RecentMovesTable } from './RecentMovesTable';
import { FacilityMap } from './FacilityMap';
import { OccupancyChart } from './OccupancyChart';
import { Spinner } from '../../components/Spinner';
import { StockAndLocations } from './StockAndLocations';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['metrics', tenantId],
    queryFn: async (): Promise<MetricsToday> => {
      const docRef = doc(db, 'metrics_today', tenantId);
      const docSnap = await getDoc(docRef);

      // Use Firestore data if present, otherwise fallback to demo data so UI can render
      const raw = (docSnap.exists()
        ? (docSnap.data() as any)
        : {
            tenantId,
            date: new Date().toISOString().split('T')[0],
            kpis: {
              totalRooms: 5,
              totalClients: 12,
              averageTemperature: 22.5,
              averageHumidity: 45.2,
              alertsCount: 3,
            },
            rooms: [
              { id: 'room-1', name: 'Salle A', capacity: 20, currentOccupancy: 15, temperature: 22.0, humidity: 45.0 },
              { id: 'room-2', name: 'Salle B', capacity: 15, currentOccupancy: 12, temperature: 23.5, humidity: 47.0 },
              { id: 'room-3', name: 'Salle C', capacity: 25, currentOccupancy: 18, temperature: 21.8, humidity: 43.5 },
              { id: 'room-4', name: 'Salle D', capacity: 18, currentOccupancy: 10, temperature: 24.2, humidity: 48.0 },
              { id: 'room-5', name: 'Salle E', capacity: 30, currentOccupancy: 25, temperature: 22.8, humidity: 46.5 },
            ],
            alerts: [
              { id: 'alert-1', type: 'warning', message: 'Temperature slightly high in Salle B', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), roomId: 'room-2' },
              { id: 'alert-2', type: 'info', message: 'Maintenance scheduled for Salle C tomorrow', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), roomId: 'room-3' },
              { id: 'alert-3', type: 'error', message: 'Humidity sensor malfunction in Salle D', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), roomId: 'room-4' },
            ],
            topClients: [
              { id: 'client-1', name: 'Tech Solutions Inc', usage: 45, lastVisit: new Date(Date.now() - 2 * 60 * 60 * 1000) },
              { id: 'client-2', name: 'Design Studio Pro', usage: 38, lastVisit: new Date(Date.now() - 4 * 60 * 60 * 1000) },
              { id: 'client-3', name: 'Marketing Experts', usage: 32, lastVisit: new Date(Date.now() - 6 * 60 * 60 * 1000) },
              { id: 'client-4', name: 'Consulting Group', usage: 28, lastVisit: new Date(Date.now() - 8 * 60 * 60 * 1000) },
              { id: 'client-5', name: 'Innovation Labs', usage: 25, lastVisit: new Date(Date.now() - 10 * 60 * 60 * 1000) },
            ],
            recentMoves: [
              { id: 'move-1', clientId: 'client-1', clientName: 'Tech Solutions Inc', fromRoom: 'Salle A', toRoom: 'Salle B', timestamp: new Date(Date.now() - 30 * 60 * 1000), reason: 'Better equipment availability' },
              { id: 'move-2', clientId: 'client-2', clientName: 'Design Studio Pro', fromRoom: 'Salle C', toRoom: 'Salle A', timestamp: new Date(Date.now() - 45 * 60 * 1000), reason: 'Room temperature adjustment' },
              { id: 'move-3', clientId: 'client-3', clientName: 'Marketing Experts', fromRoom: 'Salle D', toRoom: 'Salle E', timestamp: new Date(Date.now() - 60 * 60 * 1000), reason: 'Larger capacity needed' },
            ],
            lastUpdated: new Date(),
          });

      // Normalize possible Firestore Timestamps to JS Date
      const toDate = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate() : v ?? new Date());
      const normalized: MetricsToday = {
        ...(raw as MetricsToday),
        lastUpdated: toDate((raw as any).lastUpdated),
        alerts: (raw as any).alerts?.map((a: any) => ({ ...a, timestamp: toDate(a.timestamp) })) ?? [],
        topClients: (raw as any).topClients?.map((c: any) => ({ ...c, lastVisit: toDate(c.lastVisit) })) ?? [],
        recentMoves: (raw as any).recentMoves?.map((m: any) => ({ ...m, timestamp: toDate(m.timestamp) })) ?? [],
      };

      return normalized;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error loading dashboard data</h3>
            <p className="text-red-600">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">No metrics data available</h3>
            <p className="text-yellow-600">No metrics data available for tenant: {tenantId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
   

      {/* KPI Cards */}
      <KpiCards kpis={metrics.kpis} />
      
      {/* Facility Map - Full Width */}
      <FacilityMap rooms={metrics.rooms} />
      
 
      
 
 
 
    </div>
  );
};
