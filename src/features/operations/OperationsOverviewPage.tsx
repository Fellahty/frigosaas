import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: Date;
  lastVisit?: Date;
}

interface Reservation {
  id: string;
  clientId: string;
  clientName: string;
  reservedCrates: number;
  status: 'REQUESTED' | 'APPROVED' | 'CLOSED' | 'REFUSED';
  depositRequired: number;
  depositPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EmptyCrateLoan {
  id: string;
  clientId: string;
  crates: number;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
  depositMad: number;
  depositType: 'cash' | 'check';
  depositReference: string;
}

interface Reception {
  id: string;
  clientId: string;
  clientName: string;
  productName: string;
  productVariety: string;
  totalCrates: number;
  roomId?: string;
  roomName?: string;
  status: 'pending' | 'in_progress' | 'completed';
  arrivalTime: Date;
  createdAt: Date;
}

interface ClientStatus {
  client: Client;
  reservations: Reservation[];
  emptyCrateLoans: EmptyCrateLoan[];
  receptions: Reception[];
  summary: {
    totalReserved: number;
    totalLoaned: number;
    totalReceived: number;
    totalExited: number;
    activeReservations: number;
    openLoans: number;
    totalDeposit: number;
    lastActivity: Date | null;
  };
}

export const OperationsOverviewPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      if (!tenantId) {
        console.log('No tenant ID available');
        return [];
      }
      
      console.log('Fetching clients for tenant:', tenantId);
      const clientsQuery = query(
        collection(db, 'tenants', tenantId, 'clients')
      );
      const snapshot = await getDocs(clientsQuery);
      
      console.log('Clients fetched:', snapshot.docs.length);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
          company: data.company || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastVisit: data.lastVisit?.toDate?.(),
        };
      });
    },
    enabled: !!tenantId,
  });

  // Fetch all reservations
  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations', tenantId],
    queryFn: async (): Promise<Reservation[]> => {
      if (!tenantId) return [];
      
      const reservationsQuery = query(
        collection(db, 'tenants', tenantId, 'reservations')
      );
      const snapshot = await getDocs(reservationsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          reservedCrates: data.reservedCrates || 0,
          status: data.status || 'REQUESTED',
          depositRequired: data.depositRequired || 0,
          depositPaid: data.depositPaid || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        };
      });
    },
    enabled: !!tenantId,
  });

  // Fetch all empty crate loans
  const { data: emptyCrateLoans, isLoading: loansLoading } = useQuery({
    queryKey: ['empty-crate-loans', tenantId],
    queryFn: async (): Promise<EmptyCrateLoan[]> => {
      if (!tenantId) return [];
      
      const loansQuery = query(
        collection(db, 'empty_crate_loans'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(loansQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          crates: data.crates || 0,
          status: data.status || 'open',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          closedAt: data.closedAt?.toDate?.(),
          depositMad: data.depositMad || 0,
          depositType: data.depositType || 'cash',
          depositReference: data.depositReference || '',
        };
      });
    },
    enabled: !!tenantId,
  });

  // Fetch all receptions
  const { data: receptions, isLoading: receptionsLoading } = useQuery({
    queryKey: ['receptions', tenantId],
    queryFn: async (): Promise<Reception[]> => {
      if (!tenantId) return [];
      
      const receptionsQuery = query(
        collection(db, 'receptions'),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(receptionsQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          productName: data.productName || '',
          productVariety: data.productVariety || '',
          totalCrates: data.totalCrates || 0,
          roomId: data.roomId || '',
          roomName: data.roomName || '',
          status: data.status || 'pending',
          arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
    },
    enabled: !!tenantId,
  });

  // Process client status data
  const clientStatuses: ClientStatus[] = React.useMemo(() => {
    if (!clients || !reservations || !emptyCrateLoans || !receptions) {
      console.log('Missing data:', { clients: !!clients, reservations: !!reservations, emptyCrateLoans: !!emptyCrateLoans, receptions: !!receptions });
      return [];
    }

    console.log('Processing client data:', {
      clientsCount: clients.length,
      reservationsCount: reservations.length,
      loansCount: emptyCrateLoans.length,
      receptionsCount: receptions.length
    });

    return clients.map(client => {
      const clientReservations = reservations.filter(r => r.clientId === client.id);
      const clientLoans = emptyCrateLoans.filter(l => l.clientId === client.id);
      const clientReceptions = receptions.filter(r => r.clientId === client.id);

      // Calculate summary statistics
      const totalReserved = clientReservations
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + r.reservedCrates, 0);
      
      const totalLoaned = clientLoans
        .filter(l => l.status === 'open')
        .reduce((sum, l) => sum + l.crates, 0);
      
      const totalReceived = clientReceptions
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + r.totalCrates, 0);
      
      const totalExited = clientLoans
        .filter(l => l.status === 'closed')
        .reduce((sum, l) => sum + l.crates, 0);
      
      const activeReservations = clientReservations
        .filter(r => r.status === 'APPROVED').length;
      
      const openLoans = clientLoans
        .filter(l => l.status === 'open').length;
      
      const totalDeposit = clientReservations
        .reduce((sum, r) => sum + r.depositPaid, 0);
      
      // Find last activity date
      const allDates = [
        ...clientReservations.map(r => r.updatedAt),
        ...clientLoans.map(l => l.createdAt),
        ...clientReceptions.map(r => r.createdAt),
        client.lastVisit,
      ].filter(Boolean) as Date[];
      
      const lastActivity = allDates.length > 0 
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

      console.log(`Client ${client.name}:`, {
        reservations: clientReservations.length,
        loans: clientLoans.length,
        receptions: clientReceptions.length,
        totalReserved,
        totalLoaned,
        totalReceived,
        totalExited
      });

      return {
        client,
        reservations: clientReservations,
        emptyCrateLoans: clientLoans,
        receptions: clientReceptions,
        summary: {
          totalReserved,
          totalLoaned,
          totalReceived,
          totalExited,
          activeReservations,
          openLoans,
          totalDeposit,
          lastActivity,
        },
      };
    });
  }, [clients, reservations, emptyCrateLoans, receptions]);

  // Filter and search client statuses
  const filteredClientStatuses = useMemo(() => {
    if (!clientStatuses) return [];

    return clientStatuses.filter(clientStatus => {
      const matchesSearch = searchTerm === '' || 
        clientStatus.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientStatus.client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientStatus.client.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && (clientStatus.summary.activeReservations > 0 || clientStatus.summary.openLoans > 0)) ||
        (statusFilter === 'inactive' && clientStatus.summary.activeReservations === 0 && clientStatus.summary.openLoans === 0);

      return matchesSearch && matchesStatus;
    });
  }, [clientStatuses, searchTerm, statusFilter]);

  const isLoading = clientsLoading || reservationsLoading || loansLoading || receptionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200/60 sticky top-0 z-10 backdrop-blur-xl bg-white/80">
        <div className="px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                {t('operations.overview', 'Vue d\'ensemble des opérations')}
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                {t('operations.overviewSubtitle', 'Statut des clients et leurs opérations en cours')}
              </p>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={t('operations.searchClients', 'Rechercher des clients...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-80 pl-12 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900"
              >
                <option value="all">{t('operations.allClients', 'Tous les clients')}</option>
                <option value="active">{t('operations.activeClients', 'Clients actifs')}</option>
                <option value="inactive">{t('operations.inactiveClients', 'Clients inactifs')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {t('operations.totalClients', 'Total clients')}
                </p>
                <p className="text-4xl font-bold text-gray-900">
                  {clientStatuses.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {t('operations.activeReservations', 'Réservations actives')}
                </p>
                <p className="text-4xl font-bold text-gray-900">
                  {clientStatuses.reduce((sum, cs) => sum + cs.summary.activeReservations, 0)}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {t('operations.totalCratesInUse', 'Caisses en usage')}
                </p>
                <p className="text-4xl font-bold text-gray-900">
                  {clientStatuses.reduce((sum, cs) => sum + cs.summary.totalLoaned, 0)}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {t('operations.totalDeposits', 'Total des cautions')}
                </p>
                <p className="text-4xl font-bold text-gray-900">
                  {clientStatuses.reduce((sum, cs) => sum + cs.summary.totalDeposit, 0).toLocaleString()} MAD
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Client Status Cards */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              {t('operations.clientsOverview', 'Vue d\'ensemble des clients')}
            </h2>
            <div className="text-sm text-gray-500">
              {filteredClientStatuses.length} {t('operations.of', 'sur')} {clientStatuses.length} {t('operations.clients', 'clients')}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredClientStatuses.map((clientStatus) => (
              <div 
                key={clientStatus.client.id} 
                className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group cursor-pointer"
              >
                {/* Client Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <span className="text-white font-bold text-lg">
                          {clientStatus.client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {clientStatus.client.name}
                        </h3>
                        {clientStatus.client.company && (
                          <p className="text-sm text-gray-500 truncate">
                            {clientStatus.client.company}
                          </p>
                        )}
                      </div>
                    </div>
                    {clientStatus.client.phone && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {clientStatus.client.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      clientStatus.summary.lastActivity && 
                      (Date.now() - clientStatus.summary.lastActivity.getTime()) < 7 * 24 * 60 * 60 * 1000
                        ? 'bg-green-500 shadow-lg shadow-green-500/50'
                        : 'bg-gray-400'
                    }`}></div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      clientStatus.summary.activeReservations > 0 || clientStatus.summary.openLoans > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {clientStatus.summary.activeReservations > 0 || clientStatus.summary.openLoans > 0
                        ? t('operations.active', 'Actif')
                        : t('operations.inactive', 'Inactif')
                      }
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border border-blue-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        {t('operations.reserved', 'Réservées')}
                      </p>
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {clientStatus.summary.totalReserved}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-4 border border-green-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        {t('operations.loaned', 'Prêtées')}
                      </p>
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {clientStatus.summary.totalLoaned}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-4 border border-purple-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                        {t('operations.received', 'Reçues')}
                      </p>
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {clientStatus.summary.totalReceived}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 border border-orange-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                        {t('operations.exited', 'Sorties')}
                      </p>
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {clientStatus.summary.totalExited}
                    </p>
                  </div>
                </div>

                {/* Activity Summary */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">
                      {t('operations.activeReservations', 'Réservations actives')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {clientStatus.summary.activeReservations}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">
                      {t('operations.openLoans', 'Prêts ouverts')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {clientStatus.summary.openLoans}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">
                      {t('operations.deposit', 'Cautions')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {clientStatus.summary.totalDeposit.toLocaleString()} MAD
                    </span>
                  </div>

                  {clientStatus.summary.lastActivity && (
                    <div className="flex items-center justify-between py-2 border-t border-gray-100 pt-3">
                      <span className="text-sm text-gray-600">
                        {t('operations.lastActivity', 'Dernière activité')}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {clientStatus.summary.lastActivity.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {filteredClientStatuses.length === 0 && clientStatuses.length > 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100/50 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('operations.noResults', 'Aucun résultat trouvé')}
            </h3>
            <p className="text-gray-500 text-lg">
              {t('operations.noResultsDescription', 'Aucun client ne correspond à vos critères de recherche')}
            </p>
          </div>
        )}

        {clientStatuses.length === 0 && (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100/50 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('operations.noClients', 'Aucun client trouvé')}
            </h3>
            <p className="text-gray-500 text-lg">
              {t('operations.noClientsDescription', 'Commencez par ajouter des clients à votre système')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
