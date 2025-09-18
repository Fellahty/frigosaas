import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table } from '../../components/Table';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Spinner } from '../../components/Spinner';
import { FormCard } from '../../components/FormCard';

// Types for hygiene records
interface VehicleControlRecord {
  id: string;
  date: string;
  vehicleNumber: string;
  cleanlinessState: 'clean' | 'dirty';
  controller: string;
  supervisor: string;
  notes?: string;
}

interface CleaningControlRecord {
  id: string;
  date: string;
  elementToClean: string;
  operation: 'cleaning' | 'disinfection' | 'maintenance';
  operator: string;
  responsible: string;
  notes?: string;
}

interface Truck {
  id: string;
  number: string;
  color?: string;
  photoUrl?: string;
  isActive: boolean;
  lastVisit?: Date;
  visitCount: number;
  createdAt?: Date;
  tenantId?: string;
}

type HygieneRecord = VehicleControlRecord | CleaningControlRecord;

// Mock data
const mockVehicleRecords: VehicleControlRecord[] = [
  {
    id: '1',
    date: '2024-01-15',
    vehicleNumber: '5200-9-36',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Samia',
    notes: 'Véhicule en excellent état'
  },
  {
    id: '2',
    date: '2024-01-14',
    vehicleNumber: '2525-B-40',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Jum\'a',
    notes: 'Contrôle effectué avec succès'
  },
  {
    id: '3',
    date: '2024-01-13',
    vehicleNumber: '2706-9-17',
    cleanlinessState: 'clean',
    controller: 'Hassane',
    supervisor: 'Samia'
  }
];

const mockCleaningRecords: CleaningControlRecord[] = [
  {
    id: '1',
    date: '2024-01-15',
    elementToClean: 'Salle de triage pommes',
    operation: 'cleaning',
    operator: 'Équipe Frigo',
    responsible: 'Samia',
    notes: 'Nettoyage complet effectué'
  },
  {
    id: '2',
    date: '2024-01-14',
    elementToClean: 'Couloir',
    operation: 'cleaning',
    operator: 'Équipe Frigo',
    responsible: 'Samia'
  },
  {
    id: '3',
    date: '2024-01-13',
    elementToClean: 'Chambre 1',
    operation: 'disinfection',
    operator: 'Équipe Frigo',
    responsible: 'Samia',
    notes: 'Désinfection préventive'
  }
];


export const HygienePage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'vehicle' | 'cleaning' | 'trucks'>('vehicle');
  const [vehicleRecords, setVehicleRecords] = useState<VehicleControlRecord[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<CleaningControlRecord[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  
  // Add form states
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [isAddingCleaning, setIsAddingCleaning] = useState(false);
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  
  // Form data states
  const [vehicleForm, setVehicleForm] = useState({
    date: '',
    vehicleNumber: '',
    cleanlinessState: 'clean' as 'clean' | 'dirty',
    controller: '',
    supervisor: '',
    notes: ''
  });
  
  const [cleaningForm, setCleaningForm] = useState({
    date: '',
    elementToClean: '',
    operation: 'cleaning' as 'cleaning' | 'disinfection' | 'maintenance',
    operator: '',
    responsible: '',
    notes: ''
  });
  
  const [truckForm, setTruckForm] = useState({
    number: '',
    color: '',
    photoUrl: ''
  });

  // Fetch trucks from Firebase
  const { data: trucks = [], isLoading: trucksLoading, error: trucksError } = useQuery({
    queryKey: ['trucks', tenantId],
    queryFn: async (): Promise<Truck[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for trucks query');
        return [];
      }
      
      try {
        console.log('Fetching trucks for tenant:', tenantId);
        const q = query(collection(db, 'trucks'), where('tenantId', '==', tenantId), where('isActive', '==', true));
        const snap = await getDocs(q);
        const trucksData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            number: data.number || '',
            color: data.color || '',
            photoUrl: data.photoUrl || '',
            isActive: data.isActive !== false,
            lastVisit: data.lastVisit?.toDate ? data.lastVisit.toDate() : undefined,
            visitCount: data.visitCount || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            tenantId: data.tenantId
          };
        });
        console.log('Trucks loaded:', trucksData.length, 'trucks');
        return trucksData;
      } catch (error) {
        console.error('Error fetching trucks:', error);
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch vehicle control records from Firebase
  const { data: vehicleRecordsData = [], isLoading: vehicleLoading } = useQuery({
    queryKey: ['vehicle-control-records', tenantId],
    queryFn: async (): Promise<VehicleControlRecord[]> => {
      if (!tenantId) return [];
      
      try {
        const q = query(collection(db, 'vehicle_control_records'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || new Date().toISOString().split('T')[0]
        })) as VehicleControlRecord[];
      } catch (error) {
        console.error('Error fetching vehicle control records:', error);
        return mockVehicleRecords; // Fallback to mock data
      }
    },
    enabled: !!tenantId,
  });

  // Fetch cleaning control records from Firebase
  const { data: cleaningRecordsData = [], isLoading: cleaningLoading } = useQuery({
    queryKey: ['cleaning-control-records', tenantId],
    queryFn: async (): Promise<CleaningControlRecord[]> => {
      if (!tenantId) return [];
      
      try {
        const q = query(collection(db, 'cleaning_control_records'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || new Date().toISOString().split('T')[0]
        })) as CleaningControlRecord[];
      } catch (error) {
        console.error('Error fetching cleaning control records:', error);
        return mockCleaningRecords; // Fallback to mock data
      }
    },
    enabled: !!tenantId,
  });

  // Update local state when data changes
  useEffect(() => {
    setVehicleRecords(vehicleRecordsData);
  }, [vehicleRecordsData]);

  useEffect(() => {
    setCleaningRecords(cleaningRecordsData);
  }, [cleaningRecordsData]);

  // Form handlers
  // Add vehicle control record mutation
  const addVehicleRecordMutation = useMutation({
    mutationFn: async (payload: typeof vehicleForm) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const recordData = {
        tenantId,
        ...payload,
        date: payload.date || new Date().toISOString().split('T')[0],
        createdAt: Timestamp.fromDate(new Date()),
      };
      
      // Add the vehicle control record
      const docRef = await addDoc(collection(db, 'vehicle_control_records'), recordData);
      
      // Update truck visit count and last visit
      const truck = trucks.find(t => t.number === payload.vehicleNumber);
      if (truck) {
        await updateDoc(doc(db, 'trucks', truck.id), {
          lastVisit: Timestamp.fromDate(new Date()),
          visitCount: (truck.visitCount || 0) + 1
        });
      }
      
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicle-control-records', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setVehicleForm({
        date: '',
        vehicleNumber: '',
        cleanlinessState: 'clean',
        controller: '',
        supervisor: '',
        notes: ''
      });
      setIsAddingVehicle(false);
    },
  });

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVehicleRecordMutation.mutate(vehicleForm);
  };

  // Add cleaning control record mutation
  const addCleaningRecordMutation = useMutation({
    mutationFn: async (payload: typeof cleaningForm) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const recordData = {
        tenantId,
        ...payload,
        date: payload.date || new Date().toISOString().split('T')[0],
        createdAt: Timestamp.fromDate(new Date()),
      };
      
      const docRef = await addDoc(collection(db, 'cleaning_control_records'), recordData);
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-control-records', tenantId] });
      setCleaningForm({
        date: '',
        elementToClean: '',
        operation: 'cleaning',
        operator: '',
        responsible: '',
        notes: ''
      });
      setIsAddingCleaning(false);
    },
  });

  const handleCleaningSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCleaningRecordMutation.mutate(cleaningForm);
  };

  // Add truck mutation
  const addTruckMutation = useMutation({
    mutationFn: async (payload: typeof truckForm) => {
      if (!tenantId) throw new Error('No tenant ID available');
      
      const docRef = await addDoc(collection(db, 'trucks'), {
        tenantId,
        ...payload,
        isActive: true,
        visitCount: 0,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setTruckForm({
        number: '',
        color: '',
        photoUrl: ''
      });
      setIsAddingTruck(false);
    },
  });

  // Delete truck mutation
  const deleteTruckMutation = useMutation({
    mutationFn: async (truckId: string) => {
      await updateDoc(doc(db, 'trucks', truckId), {
        isActive: false
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
    },
  });

  const handleTruckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTruckMutation.mutate(truckForm);
  };

  const handleDelete = (recordId: string) => {
    setRecordToDelete(recordId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      if (activeTab === 'vehicle') {
        setVehicleRecords(prev => prev.filter(record => record.id !== recordToDelete));
      } else if (activeTab === 'cleaning') {
        setCleaningRecords(prev => prev.filter(record => record.id !== recordToDelete));
      } else if (activeTab === 'trucks') {
        deleteTruckMutation.mutate(recordToDelete);
      }
    }
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const getTruckTableColumns = () => [
    {
      key: 'number',
      label: t('hygiene.vehicleNumber'),
      render: (truck: Truck) => (
        <span className="text-sm font-medium text-gray-900">
          {truck.number}
        </span>
      )
    },
    {
      key: 'color',
      label: 'Couleur',
      render: (truck: Truck) => (
        <div className="flex items-center">
          <div 
            className="w-4 h-4 rounded-full mr-2"
            style={{ backgroundColor: truck.color === 'Rouge' ? '#ef4444' : truck.color === 'Bleu' ? '#3b82f6' : truck.color === 'Blanc' ? '#ffffff' : truck.color === 'Vert' ? '#10b981' : '#6b7280' }}
          ></div>
          <span className="text-sm text-gray-900">{truck.color}</span>
        </div>
      )
    },
    {
      key: 'lastVisit',
      label: 'Dernière visite',
      render: (truck: Truck) => (
        <span className="text-sm text-gray-900">
          {truck.lastVisit ? new Date(truck.lastVisit).toLocaleDateString('fr-FR') : 'Jamais'}
        </span>
      )
    },
    {
      key: 'visitCount',
      label: 'Nombre de visites',
      render: (truck: Truck) => (
        <span className="text-sm font-medium text-gray-900">
          {truck.visitCount}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (truck: Truck) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          truck.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {truck.isActive ? 'Actif' : 'Inactif'}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (truck: Truck) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(truck.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const getVehicleTableColumns = () => [
    {
      key: 'date',
      label: t('hygiene.date'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">
          {new Date(record.date).toLocaleDateString('fr-FR')}
        </span>
      )
    },
    {
      key: 'vehicleNumber',
      label: t('hygiene.vehicleNumber'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm font-medium text-gray-900">
          {record.vehicleNumber}
        </span>
      )
    },
    {
      key: 'cleanlinessState',
      label: t('hygiene.cleanlinessState'),
      render: (record: VehicleControlRecord) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          record.cleanlinessState === 'clean' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {t(`hygiene.${record.cleanlinessState}`)}
        </span>
      )
    },
    {
      key: 'controller',
      label: t('hygiene.controller'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">{record.controller}</span>
      )
    },
    {
      key: 'supervisor',
      label: t('hygiene.supervisor'),
      render: (record: VehicleControlRecord) => (
        <span className="text-sm text-gray-900">{record.supervisor}</span>
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (record: VehicleControlRecord) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(record.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const getCleaningTableColumns = () => [
    {
      key: 'date',
      label: t('hygiene.date'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">
          {new Date(record.date).toLocaleDateString('fr-FR')}
        </span>
      )
    },
    {
      key: 'elementToClean',
      label: t('hygiene.elementToClean'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm font-medium text-gray-900">
          {record.elementToClean}
        </span>
      )
    },
    {
      key: 'operation',
      label: t('hygiene.operation'),
      render: (record: CleaningControlRecord) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          record.operation === 'cleaning' 
            ? 'bg-blue-100 text-blue-800'
            : record.operation === 'disinfection'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-orange-100 text-orange-800'
        }`}>
          {t(`hygiene.operations.${record.operation}`)}
        </span>
      )
    },
    {
      key: 'operator',
      label: t('hygiene.operator'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">{record.operator}</span>
      )
    },
    {
      key: 'responsible',
      label: t('hygiene.responsible'),
      render: (record: CleaningControlRecord) => (
        <span className="text-sm text-gray-900">{record.responsible}</span>
      )
    },
    {
      key: 'actions',
      label: t('hygiene.actions'),
      render: (record: CleaningControlRecord) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleDelete(record.id)}
            className="text-red-600 hover:text-red-900 text-sm font-medium"
          >
            {t('hygiene.delete')}
          </button>
        </div>
      )
    }
  ];

  const isLoading = trucksLoading || vehicleLoading || cleaningLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('hygiene.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('hygiene.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'vehicle'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('hygiene.vehicleControl')}
            </button>
            <button
              onClick={() => setActiveTab('cleaning')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cleaning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('hygiene.cleaningControl')}
            </button>
            <button
              onClick={() => setActiveTab('trucks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trucks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Liste des camions
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'vehicle' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('hygiene.vehicleControlTitle')}
                </h3>
                <button 
                  onClick={() => setIsAddingVehicle(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {t('hygiene.addRecord')}
                </button>
              </div>
              
              {vehicleRecords.length > 0 ? (
                <Table
                  data={vehicleRecords}
                  columns={getVehicleTableColumns()}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {t('hygiene.noRecords')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Commencez par ajouter des enregistrements de contrôle des véhicules.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'cleaning' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('hygiene.cleaningControlTitle')}
                </h3>
                <button 
                  onClick={() => setIsAddingCleaning(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {t('hygiene.addRecord')}
                </button>
              </div>
              
              {cleaningRecords.length > 0 ? (
                <Table
                  data={cleaningRecords}
                  columns={getCleaningTableColumns()}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {t('hygiene.noRecords')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Commencez par ajouter des enregistrements de contrôle de nettoyage.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Liste des camions et leurs visites
                </h3>
                <button 
                  onClick={() => setIsAddingTruck(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Ajouter un camion
                </button>
              </div>
              
              {trucks.length > 0 ? (
                <Table
                  data={trucks}
                  columns={getTruckTableColumns()}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Aucun camion enregistré
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Commencez par ajouter des camions au système.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isAddingVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un contrôle véhicule</h3>
                <button
                  onClick={() => setIsAddingVehicle(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleVehicleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={vehicleForm.date}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro véhicule</label>
                  <select
                    value={vehicleForm.vehicleNumber}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un camion</option>
                    {trucks.map(truck => (
                      <option key={truck.id} value={truck.number}>
                        {truck.number} {truck.color && `(${truck.color})`}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={vehicleForm.vehicleNumber}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Ou saisir un nouveau numéro..."
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">État de propreté</label>
                  <select
                    value={vehicleForm.cleanlinessState}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, cleanlinessState: e.target.value as 'clean' | 'dirty' }))}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="clean">Propre</option>
                    <option value="dirty">Sale</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contrôleur</label>
                  <input
                    type="text"
                    value={vehicleForm.controller}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, controller: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Hassane"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Superviseur</label>
                  <input
                    type="text"
                    value={vehicleForm.supervisor}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, supervisor: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Samia"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={vehicleForm.notes}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingVehicle(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Cleaning Modal */}
      {isAddingCleaning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un contrôle nettoyage</h3>
                <button
                  onClick={() => setIsAddingCleaning(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleCleaningSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={cleaningForm.date}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Élément à nettoyer</label>
                  <select
                    value={cleaningForm.elementToClean}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, elementToClean: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un élément</option>
                    <option value="Salle de triage pommes">Salle de triage pommes</option>
                    <option value="Couloir">Couloir</option>
                    <option value="Le Quai">Le Quai</option>
                    <option value="Chambre 1">Chambre 1</option>
                    <option value="Chambre 2">Chambre 2</option>
                    <option value="Passage entre les chambres">Passage entre les chambres</option>
                    <option value="Compte Tech 1">Compte Tech 1</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opération</label>
                  <select
                    value={cleaningForm.operation}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, operation: e.target.value as 'cleaning' | 'disinfection' | 'maintenance' }))}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="cleaning">Nettoyage</option>
                    <option value="disinfection">Désinfection</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur</label>
                  <input
                    type="text"
                    value={cleaningForm.operator}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, operator: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Équipe Frigo"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={cleaningForm.responsible}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, responsible: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: Samia"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={cleaningForm.notes}
                    onChange={(e) => setCleaningForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingCleaning(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {isAddingTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Ajouter un camion</h3>
                <button
                  onClick={() => setIsAddingTruck(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleTruckSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro du camion</label>
                  <input
                    type="text"
                    value={truckForm.number}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, number: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="Ex: 5200-9-36"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                  <select
                    value={truckForm.color}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner une couleur</option>
                    <option value="Rouge">Rouge</option>
                    <option value="Bleu">Bleu</option>
                    <option value="Blanc">Blanc</option>
                    <option value="Vert">Vert</option>
                    <option value="Noir">Noir</option>
                    <option value="Gris">Gris</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Photo (optionnel)</label>
                  <input
                    type="url"
                    value={truckForm.photoUrl}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, photoUrl: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingTruck(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t('hygiene.confirmDelete')}
        message="Cette action ne peut pas être annulée."
        confirmText={t('hygiene.delete')}
        cancelText={t('hygiene.cancel')}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};
