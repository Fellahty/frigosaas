import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { useTranslation } from 'react-i18next';
import { SensorHistoryModal } from './SensorHistoryModal';
import { RoomDoc } from '../../types/settings';

// Types
interface Room {
  id: string;
  name: string;
  capacity: number;
  sensorId: string;
  active: boolean;
  sensors: Sensor[];
}

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  status: 'online' | 'offline' | 'error';
  lastReading?: {
    value: number;
    unit: string;
    timestamp: Date;
  };
  roomId: string;
}

interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  unit: string;
  timestamp: Date;
}

const SensorsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Fetch rooms from Firebase
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', tenantId],
    queryFn: async (): Promise<Room[]> => {
      if (!tenantId) return [];
      
      const roomsQuery = query(
        collection(db, 'rooms'),
        where('tenantId', '==', tenantId)
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      const roomsData: Room[] = [];
      
      // Filter and sort on client side to avoid Firebase index issues
      const filteredRooms = roomsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as RoomDoc }))
        .filter(room => room.active === true)
        .sort((a, b) => a.room.localeCompare(b.room));
      
      for (const roomDoc of filteredRooms) {
        
        // Create mock sensor data based on the room's sensorId
        const sensors: Sensor[] = [
          {
            id: `${roomDoc.id}-temp`,
            name: `Capteur Température ${roomDoc.room}`,
            type: 'temperature',
            status: 'online',
            lastReading: {
              value: Math.round((4.0 + Math.random() * 2) * 10) / 10, // Random temperature between 4-6°C, 1 decimal
              unit: '°C',
              timestamp: new Date()
            },
            roomId: roomDoc.id
          },
          {
            id: `${roomDoc.id}-humidity`,
            name: `Capteur Humidité ${roomDoc.room}`,
            type: 'humidity',
            status: 'online',
            lastReading: {
              value: Math.round((60 + Math.random() * 20) * 10) / 10, // Random humidity between 60-80%, 1 decimal
              unit: '%',
              timestamp: new Date()
            },
            roomId: roomDoc.id
          }
        ];
        
        // Add motion sensor for larger rooms
        if (roomDoc.capacity > 100) {
          sensors.push({
            id: `${roomDoc.id}-motion`,
            name: `Capteur Mouvement ${roomDoc.room}`,
            type: 'motion',
            status: 'online',
            lastReading: {
              value: Math.random() > 0.8 ? 1 : 0,
              unit: 'motion',
              timestamp: new Date()
            },
            roomId: roomDoc.id
          });
        }
        
        roomsData.push({
          id: roomDoc.id,
          name: roomDoc.room,
          capacity: roomDoc.capacity,
          sensorId: roomDoc.sensorId,
          active: roomDoc.active,
          sensors
        });
      }
      
      return roomsData;
    },
    enabled: !!tenantId,
  });

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature':
        return '🌡️';
      case 'humidity':
        return '💧';
      case 'pressure':
        return '📊';
      case 'motion':
        return '👁️';
      case 'light':
        return '💡';
      default:
        return '📡';
    }
  };

  const getSensorTypeLabel = (type: string) => {
    switch (type) {
      case 'temperature':
        return t('sensors.temperature');
      case 'humidity':
        return t('sensors.humidity');
      case 'pressure':
        return t('sensors.pressure');
      case 'motion':
        return t('sensors.motion');
      case 'light':
        return t('sensors.light');
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'offline':
        return 'text-gray-600 bg-gray-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return t('sensors.online');
      case 'offline':
        return t('sensors.offline');
      case 'error':
        return t('sensors.error');
      default:
        return 'Inconnu';
    }
  };

  const handleSensorClick = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setIsHistoryModalOpen(true);
  };

  if (roomsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <span className="text-2xl">📡</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('sensors.title')}</h1>
                  <p className="text-gray-600 text-lg">{t('sensors.subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  DEMO
                </span>
                <span className="text-sm text-gray-500">0 chambres</span>
              </div>
            </div>
          </div>

          {/* No Rooms Message */}
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-4xl">🏠</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Aucune chambre configurée</h3>
              <p className="text-gray-600 text-lg max-w-md mx-auto">
                Configurez des chambres dans les paramètres pour voir leurs capteurs ici.
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  En attente de configuration
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-2xl">📡</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('sensors.title')}</h1>
                <p className="text-gray-600 text-lg">{t('sensors.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                DEMO
              </span>
              <span className="text-sm text-gray-500">{rooms.length} chambres</span>
            </div>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="group bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-white/50 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-300/50 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Room Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                    <span className="text-lg">🏠</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                    <p className="text-sm text-gray-500">{t('sensors.capacity')}: {room.capacity} m³</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">Actif</span>
                </div>
              </div>

              {/* Sensors */}
              <div className="space-y-3">
                {room.sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    onClick={() => handleSensorClick(sensor)}
                    className="group/sensor relative bg-gradient-to-r from-gray-50/80 to-white/80 rounded-2xl p-4 border border-gray-100/50 hover:border-blue-200/50 hover:shadow-md hover:shadow-blue-100/50 transition-all duration-300 cursor-pointer overflow-hidden"
                  >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-transparent opacity-0 group-hover/sensor:opacity-100 transition-opacity duration-300"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center group-hover/sensor:scale-110 transition-transform duration-200">
                            <span className="text-sm">{getSensorIcon(sensor.type)}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 group-hover/sensor:text-blue-600 transition-colors duration-200">
                              {sensor.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {getSensorTypeLabel(sensor.type)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sensor.status)}`}>
                            {getStatusLabel(sensor.status)}
                          </span>
                          <div className="w-1 h-1 bg-gray-300 rounded-full group-hover/sensor:bg-blue-400 transition-colors duration-200"></div>
                        </div>
                      </div>

                      {sensor.lastReading && (
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            {t('sensors.lastReading')}: {sensor.lastReading.timestamp.toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-2xl font-bold text-gray-900 group-hover/sensor:text-blue-600 transition-colors duration-200">
                              {sensor.lastReading.value.toFixed(1)}
                            </div>
                            <div className="text-sm text-gray-500 font-medium">
                              {sensor.lastReading.unit}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sensor History Modal */}
        {selectedSensor && (
          <SensorHistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            sensor={selectedSensor}
          />
        )}
      </div>
    </div>
  );
};

export default SensorsPage;
