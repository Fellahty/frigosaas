import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useAppSettings, usePoolSettings } from '../../lib/hooks/useAppSettings';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { EnhancedSelect } from '../../components/EnhancedSelect';
import { logCreate, logUpdate, logDelete } from '../../lib/logging';

// Types
interface Reservation {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  reservedCrates: number;
  status: 'REQUESTED' | 'APPROVED' | 'CLOSED' | 'REFUSED';
  depositRequired: number;
  depositPaid: number;
  capacityOk: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Computed fields
  loanedEmpty?: number;
  receivedFull?: number;
  inStock?: number;
  exited?: number;
  remaining?: number;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}


const STATUS_COLORS = {
  REQUESTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  REFUSED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  REQUESTED: 'En attente',
  APPROVED: 'Approuvée',
  CLOSED: 'Clôturée',
  REFUSED: 'Refusée',
};

export const ReservationsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const { settings, isLoading: settingsLoading, error: settingsError } = useAppSettings();
  const { poolSettings, isLoading: poolLoading } = usePoolSettings();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'requests' | 'approved' | 'closed' | 'refused'>('requests');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form state for creating reservation
  const [form, setForm] = useState({
    clientId: '',
    reservedCrates: 0,
    emptyCratesNeeded: 0,
    advanceAmount: 0,
  });


  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
    },
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', tenantId],
    queryFn: async () => {
      const q = query(collection(db, 'rooms'), where('tenantId', '==', tenantId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });


  // Fetch reservations
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', tenantId],
    queryFn: async (): Promise<Reservation[]> => {
      const q = query(
        collection(db, 'tenants', tenantId, 'reservations'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Add computed fields (simplified for now)
        loanedEmpty: 0,
        receivedFull: 0,
        inStock: 0,
        exited: 0,
        remaining: doc.data().reservedCrates,
      } as Reservation));
    },
  });

  // Filter reservations based on active tab and filters
  const filteredReservations = reservations.filter(reservation => {
    // Tab filter
    if (activeTab === 'requests' && reservation.status !== 'REQUESTED') return false;
    if (activeTab === 'approved' && reservation.status !== 'APPROVED') return false;
    if (activeTab === 'closed' && reservation.status !== 'CLOSED') return false;
    if (activeTab === 'refused' && reservation.status !== 'REFUSED') return false;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const referenceMatch = reservation.reference?.toLowerCase().includes(searchLower) || false;
      const clientMatch = reservation.clientName?.toLowerCase().includes(searchLower) || false;
      const clientIdMatch = reservation.clientId?.toLowerCase().includes(searchLower) || false;
      
      if (!referenceMatch && !clientMatch && !clientIdMatch) return false;
    }

    // Status and client filters removed - only using tab filtering and search

    return true;
  });

  // Calculate KPIs
  const kpis = {
    pending: reservations.filter(r => r.status === 'REQUESTED').length,
    approved: reservations.filter(r => r.status === 'APPROVED').length,
    totalReserved: reservations.reduce((sum, r) => sum + r.reservedCrates, 0),
    totalLoaned: reservations.reduce((sum, r) => sum + (r.loanedEmpty || 0), 0),
    totalInStock: reservations.reduce((sum, r) => sum + (r.inStock || 0), 0),
    totalRoomsCrates: rooms.reduce((sum, room: any) => sum + (room.capacity || room.capacityCrates || 0), 0),
    numberOfRooms: rooms.length,
  };

  // Debug logging (can be removed in production)
  // console.log('Rooms data:', rooms);
  // console.log('Total rooms crates:', kpis.totalRoomsCrates);
  // console.log('Number of rooms:', kpis.numberOfRooms);

  // Create reservation mutation
  const createReservation = useMutation({
    mutationFn: async (data: typeof form) => {
      const client = clients?.find(c => c.id === data.clientId);
      if (!client) throw new Error('Client not found');

      // Generate reference based on timestamp and client initials
      const timestamp = Date.now();
      const clientInitials = client.name.substring(0, 3).toUpperCase();
      const reference = `RES-${clientInitials}-${timestamp.toString().slice(-6)}`;

      const reservationData = {
        reference,
        clientId: data.clientId,
        clientName: client.name,
        reservedCrates: data.reservedCrates,
        emptyCratesNeeded: data.emptyCratesNeeded,
        advanceAmount: data.advanceAmount,
        status: 'REQUESTED',
        depositRequired: data.advanceAmount, // Use advanceAmount as depositRequired
        depositPaid: 0,
        capacityOk: true, // Simplified for now
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'reservations'), reservationData);
      await logCreate('reservation', docRef.id, `Réservation créée: ${client.name}`, 'admin', 'Administrateur');
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', tenantId] });
      setIsCreating(false);
      setForm({
        clientId: '',
        reservedCrates: 0,
        emptyCratesNeeded: 0,
        advanceAmount: 0,
      });
    },
  });

  // Update reservation status
  const updateReservationStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const reservationRef = doc(db, 'tenants', tenantId, 'reservations', id);
      
      // Prepare update data - only include reason if it's provided
      const updateData: any = {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      // Only add reason if it's provided and not empty
      if (reason && reason.trim()) {
        updateData.reason = reason;
      }
      
      await updateDoc(reservationRef, updateData);
      await logUpdate('reservation', id, `Statut changé: ${status}${reason ? ` - ${reason}` : ''}`, 'admin', 'Administrateur');
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['reservations', tenantId] });
      // You could add a toast notification here if you have one
      console.log(`Reservation ${status.toLowerCase()} avec succès`);
    },
    onError: (error) => {
      console.error('Erreur lors du changement de statut:', error);
      // You could add error toast notification here
    },
  });

  const handleCreateReservation = () => {
    createReservation.mutate(form);
  };

  const handleStatusChange = (id: string, status: string, reason?: string) => {
    updateReservationStatus.mutate({ id, status, reason });
  };


  // Loading state
  if (isLoading || settingsLoading || poolLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {settingsLoading ? 'Chargement des paramètres...' : 'Chargement des réservations...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (settingsError) {
    console.error('Settings error:', settingsError);
  }

  const getStatusBadge = (status: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`}>
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
    </span>
  );

  const getCapacityIcon = (ok: boolean) => (
    <span className="text-lg">
      {ok ? '🟢' : '🔴'}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sidebar.reservations', 'Réservations')}</h1>
          <p className="text-gray-600 mt-1">{t('reservations.subtitle', 'Gérez les réservations de vos clients')}</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Créer une réservation
        </button>
      </div>

      {/* Modern Search */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Search Icon Button */}
          <button
            onClick={() => {
              if (isSearchOpen && searchTerm) {
                setSearchTerm('');
                setIsSearchOpen(false);
              } else {
                setIsSearchOpen(true);
              }
            }}
            className={`flex items-center space-x-2 px-6 py-3 rounded-full transition-all duration-300 ${
              isSearchOpen || searchTerm
                ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 hover:shadow-md'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {!isSearchOpen && !searchTerm && (
              <span className="text-sm font-medium">Rechercher</span>
            )}
            {searchTerm && (
              <span className="text-sm font-medium">Recherche active</span>
            )}
          </button>

          {/* Search Input - Animated */}
          <div className={`absolute top-0 left-0 transition-all duration-300 ease-in-out ${
            isSearchOpen || searchTerm ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-x-4 pointer-events-none'
          }`}>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher par client, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => {
                  if (!searchTerm) {
                    setTimeout(() => setIsSearchOpen(false), 200);
                  }
                }}
                className="w-80 px-4 py-3 pr-12 bg-white border-2 border-blue-600 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                autoFocus={isSearchOpen}
              />
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{kpis.pending}</div>
            <div className="text-sm text-gray-600">Demandes en attente</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{kpis.approved}</div>
            <div className="text-sm text-gray-600">Approuvées</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{kpis.totalReserved}</div>
            <div className="text-sm text-gray-600">Caisses réservées</div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">{kpis.totalRoomsCrates.toLocaleString()}</div>
            <div className="text-sm text-teal-700 font-medium">Capacité totale salles</div>
            <div className="text-xs text-teal-600 mt-1">{kpis.numberOfRooms} salle{kpis.numberOfRooms > 1 ? 's' : ''}</div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{poolSettings.pool_vides_total.toLocaleString()}</div>
            <div className="text-sm text-indigo-700 font-medium">Total caisses vides</div>
            <div className="text-xs text-indigo-600 mt-1">Disponibles sur le site</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'requests', label: 'Demandes', count: reservations.filter(r => r.status === 'REQUESTED').length },
            { key: 'approved', label: 'Approuvées', count: reservations.filter(r => r.status === 'APPROVED').length },
            { key: 'closed', label: 'Clôturées', count: reservations.filter(r => r.status === 'CLOSED').length },
            { key: 'refused', label: 'Refusées', count: reservations.filter(r => r.status === 'REFUSED').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Actions</TableHeader>
              <TableHeader>Réf</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Réservé</TableHeader>
              <TableHeader>Restant</TableHeader>
              <TableHeader>Statut</TableHeader>
              <TableHeader>Montant avancé</TableHeader>
              <TableHeader>Capacité</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Aucune réservation trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => {
                          setSelectedReservation(reservation);
                          setIsDetailOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        👁️ Voir
                      </button>
                      {reservation.status === 'REQUESTED' && (
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleStatusChange(reservation.id, 'APPROVED')}
                            disabled={updateReservationStatus.isPending}
                            className="flex items-center justify-center space-x-1 text-green-600 hover:text-green-800 disabled:text-green-400 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-green-50 disabled:bg-green-25 border border-green-200 hover:border-green-300 transition-all duration-200 disabled:cursor-not-allowed"
                          >
                            {updateReservationStatus.isPending ? (
                              <>
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Approuver</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleStatusChange(reservation.id, 'REFUSED', 'Refusé par l\'admin')}
                            disabled={updateReservationStatus.isPending}
                            className="flex items-center justify-center space-x-1 text-red-600 hover:text-red-800 disabled:text-red-400 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-red-50 disabled:bg-red-25 border border-red-200 hover:border-red-300 transition-all duration-200 disabled:cursor-not-allowed"
                          >
                            {updateReservationStatus.isPending ? (
                              <>
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Refuser</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{reservation.reference || 'N/A'}</TableCell>
                  <TableCell>{reservation.clientName}</TableCell>
                  <TableCell className="text-center">{reservation.reservedCrates}</TableCell>
                  <TableCell className="text-center font-medium">{reservation.remaining || 0}</TableCell>
                  <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                  <TableCell className="text-sm">
                    {reservation.depositPaid}/{reservation.depositRequired} MAD
                  </TableCell>
                  <TableCell className="text-center">{getCapacityIcon(reservation.capacityOk)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Reservation Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Nouvelle Réservation</h3>
                    <p className="text-blue-100 text-sm">Créer une réservation pour un client</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Client Selection */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Client</span>
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                >
                  <option value="">Sélectionner un client</option>
                  {clients?.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              {/* Crate Fields */}
              <div className="space-y-4">
                {/* Reserved Crates */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span>Nombre de caisses à rentrer</span>
                  </label>
                  <input
                    type="number"
                    value={form.reservedCrates}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setForm(f => ({ 
                        ...f, 
                        reservedCrates: value,
                        // Si les caisses vides dépassent les nouvelles caisses à rentrer, on les ajuste
                        emptyCratesNeeded: f.emptyCratesNeeded > value ? value : f.emptyCratesNeeded
                      }));
                    }}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-600">Nombre total de caisses que le client veut stocker</p>
                </div>

                {/* Empty Crates */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Caisses vides nécessaires</span>
                  </label>
                  <input
                    type="number"
                    value={form.emptyCratesNeeded}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      const maxValue = form.reservedCrates;
                      if (value <= maxValue) {
                        setForm(f => ({ ...f, emptyCratesNeeded: value }));
                      }
                    }}
                    max={form.reservedCrates}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="0"
                  />
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <svg className="w-3 h-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600">
                        Maximum: {form.reservedCrates} (ne peut pas dépasser les caisses à rentrer)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Connection */}
                {form.reservedCrates > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-sm text-blue-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Le client va utiliser {form.emptyCratesNeeded} caisses vides pour stocker ses {form.reservedCrates} caisses à rentrer
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Advance Amount */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span>Montant qui va être avancé</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">MAD</span>
                </label>
                <input
                  type="number"
                  value={form.advanceAmount}
                  onChange={(e) => setForm(f => ({ ...f, advanceAmount: Number(e.target.value) }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setIsCreating(false)}
                className="px-6 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-all duration-200 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateReservation}
                disabled={!form.clientId || !form.reservedCrates || createReservation.isLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {createReservation.isLoading ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Création...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Créer la réservation</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {isDetailOpen && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Détail de la réservation</h3>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Informations</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Référence:</strong> {selectedReservation.reference || 'N/A'}</div>
                  <div><strong>Client:</strong> {selectedReservation.clientName}</div>
                  <div><strong>Statut:</strong> {getStatusBadge(selectedReservation.status)}</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Compteurs</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-2xl font-bold text-blue-600">{selectedReservation.reservedCrates}</div>
                    <div className="text-xs text-gray-600">Réservé</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-2xl font-bold text-green-600">{selectedReservation.loanedEmpty || 0}</div>
                    <div className="text-xs text-gray-600">Prêté</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-2xl font-bold text-purple-600">{selectedReservation.receivedFull || 0}</div>
                    <div className="text-xs text-gray-600">Reçu</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <div className="text-2xl font-bold text-orange-600">{selectedReservation.remaining || 0}</div>
                    <div className="text-xs text-gray-600">Restant</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Prêt caisses vides
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                Réception pleines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
