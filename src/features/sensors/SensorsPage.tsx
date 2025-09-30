import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Spinner } from '../../components/Spinner';
import { useTranslation } from 'react-i18next';
import { SensorHistoryModal } from './SensorHistoryModal';
import SensorChart from '../../components/SensorChart';
import { RoomDoc } from '../../types/settings';

// Utility function to calculate time ago
const getTimeAgo = (timestamp: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `il y a ${diffInSeconds} seconde${diffInSeconds > 1 ? 's' : ''}`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `il y a ${diffInWeeks} semaine${diffInWeeks > 1 ? 's' : ''}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `il y a ${diffInMonths} mois`;
};

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
  additionalData?: {
    temperature: number;
    humidity: number;
    battery: number;
    magnet: number;
    timestamp: Date;
  };
}


const SensorsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  
  // Cache for sensor data to avoid multiple API calls for the same sensor
  const [sensorDataCache, setSensorDataCache] = useState<Map<string, { data: any, timestamp: number }>>(new Map());
  const SENSOR_CACHE_DURATION = 60000; // 1 minute cache for sensor data

  // Function to fetch latest sensor data from API using telemetry endpoint
  const fetchLatestSensorData = useCallback(async (sensorId: string, forceRefresh = false) => {
    const now = Date.now();
    
    console.log(`🔍 [SensorsPage] fetchLatestSensorData called for ${sensorId}, forceRefresh: ${forceRefresh}`);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = sensorDataCache.get(sensorId);
      if (cached && (now - cached.timestamp) < SENSOR_CACHE_DURATION) {
        console.log(`📦 [SensorsPage] Using cached data for ${sensorId}:`, cached.data);
        return cached.data;
      }
    } else {
      console.log(`🔄 [SensorsPage] Force refresh - ignoring cache for ${sensorId}`);
    }

    try {
      // Use telemetry endpoint for direct sensor values
      const apiUrl = 'https://flespi.io/gw/devices/6925665/telemetry/ble.sensor.temperature.1,ble.sensor.humidity.1,battery.voltage,ble.sensor.magnet.status.1';
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      console.log('📊 [SensorsPage] Telemetry API response:', rawData);

      // Check if we have the required sensor data in the telemetry structure
      if (!rawData || 
          !rawData.result || 
          !Array.isArray(rawData.result) || 
          rawData.result.length === 0 ||
          !rawData.result[0].telemetry ||
          !rawData.result[0].telemetry['ble.sensor.temperature.1'] ||
          !rawData.result[0].telemetry['ble.sensor.humidity.1']) {
        console.log('❌ [SensorsPage] No temperature or humidity data in telemetry response');
        return null;
      }

      // Extract sensor data from the telemetry structure
      const telemetry = rawData.result[0].telemetry;
      const tempValue = telemetry['ble.sensor.temperature.1'].value;
      const humidityValue = telemetry['ble.sensor.humidity.1'].value;
      const batteryValue = telemetry['battery.voltage']?.value || 0;
      const magnetValue = telemetry['ble.sensor.magnet.status.1']?.value || false;

      // Get the real timestamp from the API (all sensors have the same timestamp)
      const apiTimestamp = telemetry['ble.sensor.temperature.1'].ts;
      const realTimestamp = new Date(apiTimestamp * 1000); // Convert from Unix timestamp

      console.log('📊 [SensorsPage] Raw telemetry values:', {
        temperature: tempValue,
        humidity: humidityValue,
        battery: batteryValue,
        magnet: magnetValue,
        apiTimestamp: apiTimestamp,
        realTimestamp: realTimestamp.toISOString()
      });

      const sensorData = {
        temperature: parseFloat(tempValue),
        humidity: parseFloat(humidityValue),
        battery: parseFloat(batteryValue) || 0,
        magnet: magnetValue === 1 ? 1 : 0,
        timestamp: realTimestamp
      };

      console.log('✅ [SensorsPage] Processed sensor data:', sensorData);
      console.log('📊 [SensorsPage] Data validation:', {
        temperatureValid: sensorData.temperature > 0,
        humidityValid: sensorData.humidity > 0,
        batteryValid: sensorData.battery > 0,
        magnetValid: sensorData.magnet !== undefined
      });

      // Cache the result
      setSensorDataCache(prev => {
        const newCache = new Map(prev);
        newCache.set(sensorId, { data: sensorData, timestamp: now });
        console.log(`💾 [SensorsPage] Cached fresh data for ${sensorId}:`, sensorData);
        return newCache;
      });

      return sensorData;
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      return null;
    }
  }, [sensorDataCache, SENSOR_CACHE_DURATION]);

  // State to force refresh of sensor data
  const [forceRefresh, setForceRefresh] = useState(false);

  // Fetch rooms from Firebase
  const { data: rooms, isLoading: roomsLoading, refetch } = useQuery({
    queryKey: ['rooms', tenantId, 'sensor-data', forceRefresh],
    queryFn: async (): Promise<Room[]> => {
      if (!tenantId) return [];
      
      const roomsQuery = query(
        collection(db, 'rooms'),
        where('tenantId', '==', tenantId)
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      const roomsData: Room[] = [];
      
      // Filter and sort on client side to avoid Firebase index issues
      // Only show rooms that have sensors installed (capteurInstalled: true)
      const filteredRooms = roomsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() as RoomDoc }))
        .filter(room => room.active === true && room.capteurInstalled === true)
        .sort((a, b) => a.room.localeCompare(b.room));
      
      for (const roomDoc of filteredRooms) {
        // Fetch real sensor data from API with force refresh
        const sensorData = await fetchLatestSensorData(roomDoc.sensorId, forceRefresh);
        
        // Use real sensor data from API, with fallback for testing
        const finalSensorData = sensorData || {
          temperature: 0,
          humidity: 0,
          battery: 0,
          magnet: 0,
          timestamp: new Date()
        };
        
        console.log('Final sensor data for room:', roomDoc.room, finalSensorData);
        
        // Create one unified sensor that shows all readings from the same device
        const hasValidData = finalSensorData && (
          (finalSensorData.temperature !== undefined && !isNaN(finalSensorData.temperature)) ||
          (finalSensorData.humidity !== undefined && !isNaN(finalSensorData.humidity))
        );
        
        const sensors: Sensor[] = [
          {
            id: `${roomDoc.id}-unified`,
            name: `Capteur ${roomDoc.room}`,
            type: 'temperature', // Use as primary type
            status: hasValidData ? 'online' : 'offline',
            lastReading: hasValidData ? {
              value: Math.round(finalSensorData.temperature * 10) / 10,
              unit: '°C',
              timestamp: finalSensorData.timestamp
            } : undefined,
            roomId: roomDoc.id,
            // Add additional data for display
            additionalData: {
              temperature: finalSensorData.temperature,
              humidity: finalSensorData.humidity,
              battery: finalSensorData.battery,
              magnet: finalSensorData.magnet,
              timestamp: finalSensorData.timestamp
            }
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
          sensors: sensors || []
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
    
    // Show chart for temperature and humidity sensors
    if (sensor.type === 'temperature' || sensor.type === 'humidity') {
      setIsChartModalOpen(true);
    } else {
      // Show history modal for other sensor types
      setIsHistoryModalOpen(true);
    }
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
                <span className="text-sm text-gray-500">0 chambres avec capteurs</span>
              </div>
            </div>
          </div>

          {/* No Rooms Message */}
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-4xl">🏠</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Aucune chambre avec capteurs installés</h3>
              <p className="text-gray-600 text-lg max-w-md mx-auto">
                Aucune chambre n'a de capteurs installés. Configurez des capteurs dans les paramètres des chambres pour les voir ici.
              </p>
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-600 border border-yellow-200">
                  Capteurs non installés
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
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('sensors.title')}</h1>
                <p className="text-gray-600 text-base sm:text-lg">Surveillance IoT en temps réel</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">{rooms.length} chambres actives</span>
              </div>
              <button
                onClick={() => {
                  console.log('🔄 [SensorsPage] Refresh button clicked - toggling forceRefresh');
                  // Toggle forceRefresh to trigger fresh API calls
                  setForceRefresh(prev => {
                    const newValue = !prev;
                    console.log(`🔄 [SensorsPage] forceRefresh changed from ${prev} to ${newValue}`);
                    return newValue;
                  });
                }}
                disabled={roomsLoading}
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                title="Actualiser les données"
              >
                {roomsLoading ? (
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Professional Design Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="group bg-white rounded-2xl p-4 border border-gray-200/60 shadow-sm hover:shadow-lg hover:shadow-gray-200/40 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Professional Room Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center border border-blue-100 flex-shrink-0">
                    <span className="text-lg font-bold text-blue-600">{room.name.charAt(0)}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{room.name}</h3>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 font-medium">Active</span>
                </div>
              </div>

              {/* Professional Sensors */}
              <div className="space-y-3">
                {room.sensors && room.sensors.length > 0 ? room.sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    onClick={() => handleSensorClick(sensor)}
                    className="group/sensor bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer"
                  >
                    {/* Professional Sensor Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-semibold text-gray-900 group-hover/sensor:text-blue-600 transition-colors duration-300 truncate">
                          {sensor.name}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {getSensorTypeLabel(sensor.type)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${sensor.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {sensor.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                        {(sensor.type === 'temperature' || sensor.type === 'humidity') && (
                          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center group-hover/sensor:bg-blue-200 transition-colors duration-300">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                      {sensor.additionalData && (
                        <div className="space-y-2">
                          {/* Professional Data Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-lg p-2 border border-gray-100">
                              <div className="text-xs text-gray-500 mb-1">Température</div>
                              <div className="text-lg font-bold text-red-600">
                                {sensor.additionalData.temperature !== null && !isNaN(sensor.additionalData.temperature) 
                                  ? sensor.additionalData.temperature.toFixed(1) + '°C'
                                  : 'N/A'}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-gray-100">
                              <div className="text-xs text-gray-500 mb-1">Humidité</div>
                              <div className="text-lg font-bold text-blue-600">
                                {sensor.additionalData.humidity.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          
                          {/* Status and Time Row */}
                          <div className="flex items-center justify-between">
                         {/*    <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${sensor.additionalData.magnet === 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span className="text-sm text-gray-600">
                                {sensor.additionalData.magnet === 0 ? 'Port ouvert' : 'Port fermé'}
                              </span>
                            </div> */}
                            <div className="text-sm text-gray-500">
                              {getTimeAgo(sensor.additionalData.timestamp)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
               
                )) : (
                  <div className="text-center py-2 text-gray-500 text-xs">
                    Aucun capteur configuré
                  </div>
                )}
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

        {/* Sensor Chart Modal */}
        {selectedSensor && (
          <SensorChart
            sensorId={selectedSensor.id}
            sensorName={selectedSensor.name}
            isOpen={isChartModalOpen}
            onClose={() => setIsChartModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SensorsPage;
