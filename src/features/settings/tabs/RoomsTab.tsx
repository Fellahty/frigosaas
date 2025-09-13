import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FormCard } from '../../../components/FormCard';
import { roomSchema, type Room } from '../../../types/settings';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

interface RoomDoc extends Room {
  id: string;
  tenantId: string;
}

interface RoomsTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onValidChange: (valid: boolean) => void;
}

export const RoomsTab: React.FC<RoomsTabProps> = ({ onDirtyChange, onValidChange }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [rooms, setRooms] = useState<RoomDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomDoc | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<RoomDoc | null>(null);
  const [formData, setFormData] = useState<Room & { capacityCrates: number; capacityPallets: number }>({
    room: '',
    capacity: 0,
    capacityCrates: 0,
    capacityPallets: 0,
    sensorId: '',
    active: true,
  });
  const [sensorIdError, setSensorIdError] = useState<string>('');

  useEffect(() => {
    // Initialize with empty array immediately
    setRooms([]);
    
    // Then try to load from Firestore
    loadRooms();
  }, [tenantId]);

  useEffect(() => {
    const validation = roomSchema.safeParse(formData);
    onValidChange(validation.success);
    onDirtyChange(showModal);
  }, [formData, showModal, onDirtyChange, onValidChange]);

  const loadRooms = async () => {
    if (!tenantId) return;
    
    try {
      const q = query(collection(db, 'rooms'), where('tenantId', '==', tenantId));
      const querySnapshot = await getDocs(q);
      const roomsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RoomDoc));
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]); // Set empty array on error
    }
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setFormData({
      room: '',
      capacity: 0,
      capacityCrates: 0,
      capacityPallets: 0,
      sensorId: '',
      active: true,
    });
    setSensorIdError('');
    setShowModal(true);
  };

  const handleEditRoom = (room: RoomDoc) => {
    setEditingRoom(room);
    setFormData({
      room: room.room,
      capacity: room.capacity,
      capacityCrates: room.capacityCrates || 0,
      capacityPallets: room.capacityPallets || 0,
      sensorId: room.sensorId,
      active: room.active,
    });
    setSensorIdError('');
    setShowModal(true);
  };

  const handleSaveRoom = async () => {
    if (!tenantId) return;
    
    // Check if sensor ID already exists (only for new rooms or when sensor ID changed)
    if (!editingRoom || editingRoom.sensorId !== formData.sensorId) {
      const existingRoom = rooms.find(room => 
        room.sensorId === formData.sensorId && room.id !== editingRoom?.id
      );
      
      if (existingRoom) {
        setSensorIdError(t('settings.rooms.sensorIdExists', 'Cet ID de capteur existe déjà'));
        return;
      }
    }
    
    try {
      const roomData = {
        room: formData.room,
        capacity: formData.capacity,
        capacityCrates: formData.capacityCrates,
        capacityPallets: formData.capacityPallets,
        sensorId: formData.sensorId,
        active: formData.active,
        tenantId,
      };

      if (editingRoom) {
        await updateDoc(doc(db, 'rooms', editingRoom.id), roomData);
        toast.success(t('common.success'));
      } else {
        await addDoc(collection(db, 'rooms'), roomData);
        toast.success(t('common.success'));
      }

      setShowModal(false);
      loadRooms();
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteRoom = (room: RoomDoc) => {
    setRoomToDelete(room);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) return;

    try {
      await deleteDoc(doc(db, 'rooms', roomToDelete.id));
      toast.success(t('common.success'));
      loadRooms();
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error(t('common.error'));
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoomToDelete(null);
  };

  const handleInputChange = (field: keyof Room, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Validate sensor ID in real-time
    if (field === 'sensorId') {
      validateSensorId(value);
    }
  };

  const validateSensorId = (sensorId: string) => {
    if (!sensorId.trim()) {
      setSensorIdError('');
      return;
    }
    
    const existingRoom = rooms.find(room => 
      room.sensorId === sensorId && room.id !== editingRoom?.id
    );
    
    if (existingRoom) {
      setSensorIdError(t('settings.rooms.sensorIdExists', 'Cet ID de capteur existe déjà'));
    } else {
      setSensorIdError('');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSensorIdError('');
  };

  if (isLoading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <FormCard
        title={t('settings.rooms.title', 'Chambres & capteurs')}
        description={t('settings.rooms.description', 'Gérez les chambres et leurs capteurs de surveillance')}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {t('settings.rooms.roomsList', 'Liste des chambres')}
          </h3>
          <button
            onClick={handleAddRoom}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {t('settings.rooms.addRoom', 'Ajouter une chambre')}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('settings.rooms.noRooms', 'Aucune chambre configurée')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('settings.rooms.room', 'Chambre')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('settings.rooms.capacityCrates', 'Caisses')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('settings.rooms.capacityPallets', 'Palettes')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('settings.rooms.sensorId', 'ID Capteur')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('settings.rooms.status', 'Statut')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {room.room}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(room.capacityCrates || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(room.capacityPallets || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.sensorId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        room.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {room.active ? t('common.active', 'Actif') : t('common.inactive', 'Inactif')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditRoom(room)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room)}
                        className="text-red-600 hover:text-red-900"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleCloseModal}>
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingRoom ? t('settings.rooms.editRoom', 'Modifier la chambre') : t('settings.rooms.addRoom', 'Ajouter une chambre')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.rooms.room', 'Chambre')}
                  </label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => handleInputChange('room', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="CH1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.rooms.capacityCrates', 'Capacité (Caisses)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.capacityCrates}
                    onChange={(e) => handleInputChange('capacityCrates', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="6000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.rooms.capacityPallets', 'Capacité (Palettes)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.capacityPallets}
                    onChange={(e) => handleInputChange('capacityPallets', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.rooms.sensorId', 'ID Capteur')}
                  </label>
                  <input
                    type="text"
                    value={formData.sensorId}
                    onChange={(e) => handleInputChange('sensorId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      sensorIdError 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="S-CH1"
                  />
                  {sensorIdError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {sensorIdError}
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => handleInputChange('active', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                    {t('common.active', 'Actif')}
                  </label>
                </div>
              </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSaveRoom}
                    disabled={!formData.room || !formData.sensorId || (formData.capacityCrates === 0 && formData.capacityPallets === 0) || !!sensorIdError}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {t('common.save')}
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && roomToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('settings.rooms.confirmDelete', 'Supprimer la chambre')}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t('settings.rooms.confirmDeleteMessage', `Êtes-vous sûr de vouloir supprimer la chambre "${roomToDelete.room}" ? Cette action est irréversible.`).replace('{roomName}', roomToDelete.room)}
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    {t('common.cancel', 'Annuler')}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    {t('common.delete', 'Supprimer')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
