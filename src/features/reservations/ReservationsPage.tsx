import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useAppSettings, usePoolSettings } from '../../lib/hooks/useAppSettings';
import { useOfflineQuery, useOfflineMutation } from '../../lib/hooks/useOfflineSync';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { EnhancedSelect } from '../../components/EnhancedSelect';
import { ConfirmationModal } from '../../components/ConfirmationModal';
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
  selectedRooms: string[];
  roomNames?: string[]; // Computed field for display
  totalRoomCapacity?: number; // Total capacity of all selected rooms
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
  const [activeTab, setActiveTab] = useState<'requests' | 'approved' | 'closed' | 'refused'>('approved');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({
    clientId: '',
    reservedCrates: 0,
    emptyCratesNeeded: 0,
    selectedRooms: [] as string[],
  });

  // Form state for creating reservation
  const [form, setForm] = useState({
    clientId: '',
    reservedCrates: 0,
    emptyCratesNeeded: 0,
    selectedRooms: [] as string[],
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

  // Fetch crate types to calculate total empty crates
  const { data: crateTypes = [] } = useQuery({
    queryKey: ['crate-types', tenantId],
    queryFn: async () => {
      const q = query(collection(db, 'tenants', tenantId, 'crate-types'), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });


  // Fetch reservations with offline support
  const { data: reservations = [], isLoading, isOffline, lastSync, refetch } = useOfflineQuery(
    ['reservations', tenantId, rooms],
    async (): Promise<Reservation[]> => {
      const q = query(
        collection(db, 'tenants', tenantId, 'reservations'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const selectedRooms = data.selectedRooms || [];
        const roomNames = selectedRooms.map((roomId: string) => {
          const room = rooms.find(r => r.id === roomId);
          return room ? (room.room || room.name || `Room ${roomId}`) : `Room ${roomId}`;
        });
        
        // Calculate total capacity of selected rooms
        const totalRoomCapacity = selectedRooms.reduce((total, roomId) => {
          const room = rooms.find(r => r.id === roomId);
          return total + (room ? (room.capacityCrates || room.capacity || 0) : 0);
        }, 0);
        
        return {
          id: doc.id,
          ...data,
          selectedRooms,
          roomNames,
          totalRoomCapacity,
          // Add computed fields (simplified for now)
          loanedEmpty: 0,
          receivedFull: 0,
          inStock: 0,
          exited: 0,
          remaining: data.reservedCrates,
        } as Reservation;
      });
    },
    {
      collection: `tenants/${tenantId}/reservations`,
      constraints: [orderBy('createdAt', 'desc')],
      transform: (snapshot) => snapshot.docs.map(doc => {
        const data = doc.data();
        const selectedRooms = data.selectedRooms || [];
        const roomNames = selectedRooms.map((roomId: string) => {
          const room = rooms.find(r => r.id === roomId);
          return room ? (room.room || room.name || `Room ${roomId}`) : `Room ${roomId}`;
        });
        
        const totalRoomCapacity = selectedRooms.reduce((total, roomId) => {
          const room = rooms.find(r => r.id === roomId);
          return total + (room ? (room.capacityCrates || room.capacity || 0) : 0);
        }, 0);
        
        return {
          id: doc.id,
          ...data,
          selectedRooms,
          roomNames,
          totalRoomCapacity,
          loanedEmpty: 0,
          receivedFull: 0,
          inStock: 0,
          exited: 0,
          remaining: data.reservedCrates,
        } as Reservation;
      })
    },
    {
      enabled: !!rooms.length && !!tenantId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

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

  // Calculate total empty crates from crate-types
  const totalEmptyCrates = crateTypes.reduce((total, crateType: any) => total + (crateType.quantity || 0), 0);

  // Calculate KPIs
  const kpis = {
    pending: reservations.filter(r => r.status === 'REQUESTED').length,
    approved: reservations.filter(r => r.status === 'APPROVED').length,
    totalReserved: reservations.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.reservedCrates, 0),
    totalLoaned: reservations.reduce((sum, r) => sum + (r.loanedEmpty || 0), 0),
    totalInStock: reservations.reduce((sum, r) => sum + (r.inStock || 0), 0),
    totalRoomsCrates: rooms.reduce((sum, room: any) => sum + (room.capacityCrates || room.capacity || 0), 0),
    numberOfRooms: rooms.length,
    totalEmptyCrates,
  };

  // Debug logging (can be removed in production)
  // console.log('Rooms data:', rooms);
  // console.log('Total rooms crates:', kpis.totalRoomsCrates);
  // console.log('Number of rooms:', kpis.numberOfRooms);

  // Create reservation mutation with offline support
  const createReservation = useOfflineMutation(
    async (data: typeof form) => {
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
        selectedRooms: data.selectedRooms,
        status: 'REQUESTED',
        capacityOk: true, // Simplified for now
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const docRef = await addDoc(collection(db, 'tenants', tenantId, 'reservations'), reservationData);
      await logCreate('reservation', docRef.id, `Réservation créée: ${client.name}`, 'admin', 'Administrateur');
      return docRef.id;
    },
    {
      onSuccess: () => {
        setIsCreating(false);
        setForm({
          clientId: '',
          reservedCrates: 0,
          emptyCratesNeeded: 0,
          selectedRooms: [],
        });
        // Data will automatically sync due to real-time listener
      },
      onError: (error) => {
        console.error('Error creating reservation:', error);
      },
      retryOnReconnect: true,
    }
  );

  // Update reservation status with offline support
  const updateReservationStatus = useOfflineMutation(
    async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
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
    {
      onSuccess: (_, { status }) => {
        console.log(`Reservation ${status.toLowerCase()} avec succès`);
        // Data will automatically sync due to real-time listener
      },
      onError: (error) => {
        console.error('Erreur lors du changement de statut:', error);
      },
      retryOnReconnect: true,
    }
  );

  // Update reservation details with offline support
  const updateReservation = useOfflineMutation(
    async ({ id, updates }: { id: string; updates: typeof editForm }) => {
      const reservationRef = doc(db, 'tenants', tenantId, 'reservations', id);
      await updateDoc(reservationRef, {
        reservedCrates: updates.reservedCrates,
        emptyCratesNeeded: updates.emptyCratesNeeded,
        selectedRooms: updates.selectedRooms,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    },
    {
      onSuccess: () => {
        setIsEditing(false);
        setIsDetailOpen(false);
        // Data will automatically sync due to real-time listener
      },
      onError: (error) => {
        console.error('Erreur lors de la modification:', error);
      },
      retryOnReconnect: true,
    }
  );

  // Delete reservation mutation with offline support
  const deleteReservation = useOfflineMutation(
    async (id: string) => {
      const reservationRef = doc(db, 'tenants', tenantId, 'reservations', id);
      await deleteDoc(reservationRef);
      await logDelete('reservation', id, 'Réservation supprimée', 'admin', 'Administrateur');
    },
    {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        setReservationToDelete(null);
        // Data will automatically sync due to real-time listener
      },
      onError: (error) => {
        console.error('Erreur lors de la suppression:', error);
      },
      retryOnReconnect: true,
    }
  );

  const handleCreateReservation = () => {
    createReservation.mutate(form);
  };

  const handleEditReservation = () => {
    if (selectedReservation) {
      setEditForm({
        clientId: selectedReservation.clientId,
        reservedCrates: selectedReservation.reservedCrates,
        emptyCratesNeeded: selectedReservation.emptyCratesNeeded || 0,
        selectedRooms: selectedReservation.selectedRooms || [],
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedReservation) {
      updateReservation.mutate({
        id: selectedReservation.id,
        updates: editForm,
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      clientId: '',
      reservedCrates: 0,
      emptyCratesNeeded: 0,
      selectedRooms: [],
    });
  };

  const handleStatusChange = (id: string, status: string, reason?: string) => {
    updateReservationStatus.mutate({ id, status, reason });
  };

  const handleDeleteClick = (reservation: Reservation) => {
    setReservationToDelete(reservation);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (reservationToDelete) {
      deleteReservation.mutate(reservationToDelete.id);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setReservationToDelete(null);
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
          {isOffline && (
            <p className="text-orange-600 text-sm mt-2">
              Mode hors ligne - Les données peuvent être limitées
            </p>
          )}
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
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{t('sidebar.reservations', 'Réservations')}</h1>
            {isOffline && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
                Hors ligne
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {t('reservations.subtitle', 'Gérez les réservations de vos clients')}
            {lastSync && (
              <span className="text-xs text-gray-500 ml-2">
                • Dernière sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-3 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            title="Actualiser les données"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
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
            <div className="text-2xl font-bold text-indigo-600">{kpis.totalEmptyCrates.toLocaleString()}</div>
            <div className="text-sm text-indigo-700 font-medium">Total caisses vides</div>
            <div className="text-xs text-indigo-600 mt-1">Disponibles sur le site</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'approved', label: 'Approuvées', count: reservations.filter(r => r.status === 'APPROVED').length },
            { key: 'requests', label: 'Demandes', count: reservations.filter(r => r.status === 'REQUESTED').length },
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
              <TableHeader>Client</TableHeader>
              <TableHeader>Réservé</TableHeader>
              <TableHeader>Caisses vides</TableHeader>
              <TableHeader>Salles</TableHeader>
              <TableHeader>Statut</TableHeader>
              <TableHeader>Capacité</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Aucune réservation trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => {
                const isOverCapacity = reservation.reservedCrates > (reservation.totalRoomCapacity || 0);
                return (
                <TableRow key={reservation.id} className={isOverCapacity ? 'bg-red-50 border-l-4 border-red-400' : ''}>
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
                  <TableCell>{reservation.clientName}</TableCell>
                  <TableCell className="text-center">{reservation.reservedCrates}</TableCell>
                  <TableCell className="text-center">{reservation.emptyCratesNeeded || 0}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {reservation.roomNames && reservation.roomNames.length > 0 ? (
                          reservation.roomNames.map((roomName, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {roomName}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">Aucune salle</span>
                        )}
                      </div>
                      {reservation.totalRoomCapacity && reservation.totalRoomCapacity > 0 && (
                        <div className={`text-sm font-semibold ${isOverCapacity ? 'text-red-600' : 'text-gray-900'}`}>
                          {reservation.totalRoomCapacity.toLocaleString()}
                          {isOverCapacity && (
                            <span className="ml-2 text-xs text-red-500">
                              ⚠️ Dépassement
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                  <TableCell className="text-center">{getCapacityIcon(reservation.capacityOk)}</TableCell>
                </TableRow>
                );
              })
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

              {/* Room Selection */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Salles à utiliser</span>
                  <span className="text-xs text-gray-500">({form.selectedRooms.length} sélectionnée{form.selectedRooms.length > 1 ? 's' : ''})</span>
                </label>
                
                {/* Selected Rooms Summary */}
                {form.selectedRooms.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {form.selectedRooms.map((roomId) => {
                      const room = rooms.find((r: any) => r.id === roomId);
                      return (
                        <span
                          key={roomId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                        >
                          {room?.room || room?.name || `Room ${roomId}`}
                          <button
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, selectedRooms: f.selectedRooms.filter(id => id !== roomId) }));
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Room Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {rooms
                    .sort((a: any, b: any) => {
                      const nameA = (a.room || a.name || '').toLowerCase();
                      const nameB = (b.room || b.name || '').toLowerCase();
                      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                    })
                    .map((room: any) => (
                    <label 
                      key={room.id} 
                      className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-all duration-200 ${
                        form.selectedRooms.includes(room.id)
                          ? 'bg-indigo-50 border-indigo-200 border'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.selectedRooms.includes(room.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(f => ({ ...f, selectedRooms: [...f.selectedRooms, room.id] }));
                          } else {
                            setForm(f => ({ ...f, selectedRooms: f.selectedRooms.filter(id => id !== room.id) }));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{room.room || room.name || `Room ${room.id}`}</div>
                        <div className="text-xs text-gray-500">
                          {room.capacityCrates || room.capacity || 0} caisses
                        </div>
                      </div>
                    </label>
                  ))}
                  {rooms.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
                      Aucune salle disponible
                    </div>
                  )}
                </div>
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
                <h4 className="font-medium mb-2">Caisse</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-2xl font-bold text-red-600">{selectedReservation.reservedCrates}</div>
                    <div className="text-xs text-gray-600">Nombre de caisses à rentrer</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-2xl font-bold text-green-600">{selectedReservation.reservedCrates}</div>
                    <div className="text-xs text-gray-600">Caisses vides nécessaires</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center">
                  <div className="bg-gray-100 rounded-full h-2 w-24 mr-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-600">100%</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => handleDeleteClick(selectedReservation)}
                disabled={deleteReservation.isPending}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteReservation.isPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Supprimer</span>
                  </>
                )}
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleEditReservation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {isEditing && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Modifier la réservation</h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Client</span>
                </label>
                <EnhancedSelect
                  options={clients?.map(client => ({
                    value: client.id,
                    label: client.name,
                    company: client.company
                  })) || []}
                  value={editForm.clientId}
                  onChange={(value) => setEditForm(f => ({ ...f, clientId: value }))}
                  placeholder="Sélectionner un client"
                  className="w-full"
                />
              </div>

              {/* Number of Crates to Return */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span>Nombre de caisses à rentrer</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={editForm.reservedCrates}
                  onChange={(e) => setEditForm(f => ({ ...f, reservedCrates: Number(e.target.value) }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="0"
                />
              </div>

              {/* Empty Crates Needed */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Caisses vides nécessaires</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={editForm.emptyCratesNeeded}
                  onChange={(e) => setEditForm(f => ({ ...f, emptyCratesNeeded: Number(e.target.value) }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="0"
                />
              </div>

              {/* Room Selection */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Salles à utiliser</span>
                  <span className="text-xs text-gray-500">({editForm.selectedRooms.length} sélectionnée{editForm.selectedRooms.length > 1 ? 's' : ''})</span>
                </label>
                
                {/* Selected Rooms Summary */}
                {editForm.selectedRooms.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {editForm.selectedRooms.map((roomId) => {
                      const room = rooms.find((r: any) => r.id === roomId);
                      return (
                        <span
                          key={roomId}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                        >
                          {room?.room || room?.name || `Room ${roomId}`}
                          <button
                            type="button"
                            onClick={() => {
                              setEditForm(f => ({ ...f, selectedRooms: f.selectedRooms.filter(id => id !== roomId) }));
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Room Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {rooms
                    .sort((a: any, b: any) => {
                      const nameA = (a.room || a.name || '').toLowerCase();
                      const nameB = (b.room || b.name || '').toLowerCase();
                      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                    })
                    .map((room: any) => (
                    <label 
                      key={room.id} 
                      className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-all duration-200 ${
                        editForm.selectedRooms.includes(room.id)
                          ? 'bg-indigo-50 border-indigo-200 border'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editForm.selectedRooms.includes(room.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm(f => ({ ...f, selectedRooms: [...f.selectedRooms, room.id] }));
                          } else {
                            setEditForm(f => ({ ...f, selectedRooms: f.selectedRooms.filter(id => id !== room.id) }));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{room.room || room.name || `Room ${room.id}`}</div>
                        <div className="text-xs text-gray-500">
                          {room.capacityCrates || room.capacity || 0} caisses
                        </div>
                      </div>
                    </label>
                  ))}
                  {rooms.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
                      Aucune salle disponible
                    </div>
                  )}
                </div>
              </div>

            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleSaveEdit}
                disabled={updateReservation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {updateReservation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Supprimer la réservation"
        message={`Êtes-vous sûr de vouloir supprimer la réservation ${reservationToDelete?.reference || ''} pour le client ${reservationToDelete?.clientName || ''} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        isLoading={deleteReservation.isPending}
      />
    </div>
  );
};
