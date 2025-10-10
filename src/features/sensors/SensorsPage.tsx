import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Spinner } from '../../components/Spinner';
import { useTranslation } from 'react-i18next';
import { SensorHistoryModal } from './SensorHistoryModal';
import SensorChart from '../../components/SensorChart';
import Warehouse3DView from '../../components/Warehouse3DView';
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
  athGroupNumber?: number;
  boitieSensorId?: string;
  sensors: Sensor[];
  polygon?: Array<{ lat: number; lng: number }>; // Saved GeoJSON polygon
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
    beacons?: any; // Beacon data if available
    timestamp: Date;
    localTime?: string; // Formatted time from API
  };
}


const SensorsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  
  // Function to extract channel number from sensor ID (e.g., "S-CH1" -> 1, "S-CH2" -> 2)
  const extractChannelNumber = (sensorId: string): number | null => {
    const match = sensorId.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  // Function to fetch all telemetry data from the new API (NO CACHE)
  const fetchAllTelemetryData = useCallback(async () => {
    console.log(`🔍 [SensorsPage] fetchAllTelemetryData called - NO CACHE`);

    try {
      const apiUrl = 'https://api.frigosmart.com/rooms/latest';
      
      console.log(`🌐 [SensorsPage] Fetching fresh data from API:`, apiUrl);
      const response = await fetch(apiUrl, {
        cache: 'no-store', // Disable browser cache
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      console.log(`📊 [SensorsPage] Fresh API response from rooms/latest:`, rawData);

      return rawData;

    } catch (error) {
      console.error(`❌ [SensorsPage] Error fetching data from rooms/latest:`, error);
      return null;
    }
  }, []);

  // Function to extract sensor data from the new API response
  const extractSensorDataFromBulk = useCallback((roomName: string, bulkData: any) => {
    console.log(`🔍 [SensorsPage] extractSensorDataFromBulk called for room: ${roomName}`);

    if (!bulkData || !bulkData.data || !Array.isArray(bulkData.data) || bulkData.data.length === 0) {
      console.log(`❌ [SensorsPage] No data available in API response`);
      return null;
    }

    // Find the room data by exact room name match
    const roomData = bulkData.data.find((item: any) => item.room === roomName);

    if (!roomData) {
      console.log(`❌ [SensorsPage] No data found for "${roomName}" in API response`);
      console.log(`📊 [SensorsPage] Available rooms:`, bulkData.data.map((item: any) => item.room));
      return null;
    }

    console.log(`✅ [SensorsPage] Found data for "${roomName}":`, roomData);

    // Convert the API response to the expected format
    const sensorData = {
      temperature: parseFloat(roomData.temperature),
      humidity: parseFloat(roomData.humidity),
      battery: 0, // Not provided by the new API
      magnet: roomData.magnet === true ? 1 : 0,
      beacons: null,
      timestamp: new Date(roomData.epoch * 1000), // Convert epoch to Date
      localTime: roomData.local_time // Keep the formatted time from API
    };

    console.log(`✅ [SensorsPage] Processed sensor data for "${roomName}":`, sensorData);
    console.log(`📊 [SensorsPage] Data validation for "${roomName}":`, {
      temperatureValid: !isNaN(sensorData.temperature),
      humidityValid: !isNaN(sensorData.humidity),
      magnetValid: sensorData.magnet !== undefined,
      timestampValid: sensorData.timestamp instanceof Date,
      localTime: sensorData.localTime
    });

    return sensorData;

  }, []);

  // State to force refresh of sensor data
  const [forceRefresh, setForceRefresh] = useState(false);

  // Fetch rooms from Firebase
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', tenantId, 'sensor-data', forceRefresh],
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 0, // Consider data stale immediately
    cacheTime: 30000, // Keep in cache for 30 seconds
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
        .sort((a, b) => a.room.localeCompare(b.room, 'fr', { numeric: true }));
      
      // Fetch all room data from the new API (single call for all rooms - NO CACHE)
      console.log(`📡 [SensorsPage] Fetching fresh data for all rooms from API`);
      const bulkData = await fetchAllTelemetryData();
      
      // Process each room using the bulk data
      for (const roomDoc of filteredRooms) {
        // Extract sensor data from the API response using exact room name
        const sensorData = bulkData ? extractSensorDataFromBulk(roomDoc.room, bulkData) : null;
        
        // Use real sensor data from API, with fallback for testing
        const finalSensorData = sensorData || {
          temperature: 0,
          humidity: 0,
          battery: 0,
          magnet: 0,
          beacons: null,
          timestamp: new Date(),
          localTime: new Date().toLocaleString('fr-FR')
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
              beacons: finalSensorData.beacons, // Include beacon data if available
              timestamp: finalSensorData.timestamp,
              localTime: finalSensorData.localTime
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
          athGroupNumber: roomDoc.athGroupNumber || 1,
          boitieSensorId: roomDoc.boitieSensorId,
          sensors: sensors || []
        });
      }
      
      console.log(`✅ [SensorsPage] Processed ${roomsData.length} rooms with data from new API (1 API call for all rooms)`);
      return roomsData;
    },
    enabled: !!tenantId,
  });

  // Group rooms by ATH group number and create tabs
  const { groupedRooms, tabs } = useMemo(() => {
    if (!rooms || rooms.length === 0) {
      return { groupedRooms: {}, tabs: [] };
    }

    // Group rooms by ATH group number
    const grouped = rooms.reduce((acc, room) => {
      const groupNumber = room.athGroupNumber || 1;
      const groupKey = `group-${groupNumber}`;
      
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(room);
      
      return acc;
    }, {} as Record<string, Room[]>);

    // Create tabs array
    const tabs = [
      { id: 'all', label: t('sensors.tabs.all', 'Toutes'), count: rooms.length },
      ...Object.keys(grouped)
        .sort((a, b) => {
          const numA = parseInt(a.replace('group-', ''));
          const numB = parseInt(b.replace('group-', ''));
          return numA - numB;
        })
        .map(groupKey => {
          const groupNumber = groupKey.replace('group-', '');
          return {
            id: groupKey,
            label: `FRIGO ${groupNumber}`,
            count: grouped[groupKey].length
          };
        })
    ];

    return { groupedRooms: grouped, tabs };
  }, [rooms, t]);

  // Set default tab to first ATH group when rooms are loaded
  React.useEffect(() => {
    if (rooms && rooms.length > 0 && !activeTab) {
      // Find the first ATH group (lowest group number)
      const athGroups = rooms.map(room => room.athGroupNumber || 1);
      const minGroup = Math.min(...athGroups);
      const firstGroupKey = `group-${minGroup}`;
      setActiveTab(firstGroupKey);
    }
  }, [rooms, activeTab]);

  // Get rooms to display based on active tab
  const displayRooms = useMemo(() => {
    let roomsToDisplay: Room[] = [];
    
    if (!activeTab) {
      return [];
    }
    if (activeTab === 'all') {
      roomsToDisplay = rooms || [];
    } else {
      roomsToDisplay = groupedRooms[activeTab] || [];
    }
    
    // Sort rooms numerically by name (Chambre 1, Chambre 2, CH1, CH2, etc.) for correct 3D positioning
    return roomsToDisplay.sort((a, b) => {
      // Extract numbers from room names (handles "Chambre 1", "CH1", "Couloir 1", etc.)
      const extractNumber = (name: string): number => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[0]) : 0;
      };
      
      const aNum = extractNumber(a.name);
      const bNum = extractNumber(b.name);
      
      // If numbers are the same, fall back to alphabetical sorting
      if (aNum === bNum) {
        return a.name.localeCompare(b.name, 'fr', { numeric: true });
      }
      
      return aNum - bNum;
    });
  }, [activeTab, rooms, groupedRooms]);

  const handleSensorClick = (sensor: Sensor) => {
    console.log('🔍 [SensorsPage] Sensor clicked:', sensor);
    setSelectedSensor(sensor);
    
    // Show chart for temperature and humidity sensors
    if (sensor.type === 'temperature' || sensor.type === 'humidity') {
      console.log('📊 [SensorsPage] Opening chart modal for sensor:', sensor.name);
      setIsChartModalOpen(true);
    } else {
      // Show history modal for other sensor types
      console.log('📜 [SensorsPage] Opening history modal for sensor:', sensor.name);
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
                <p className="text-gray-600 text-base sm:text-lg">{t('sensors.realTimeMonitoring')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">
                  {!activeTab 
                    ? t('common.loading')
                    : activeTab === 'all' 
                      ? `${rooms.length} ${t('sensors.activeRooms')}`
                      : `${displayRooms.length} ${t('sensors.rooms')} - ${tabs.find(t => t.id === activeTab)?.label || t('sensors.group')}`
                  }
                </span>
              </div>
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('sensors.viewGrid', 'Vue Grille') as string}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'map'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={t('sensors.view3D', 'Vue 3D') as string}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => {
                  console.log('🔄 [SensorsPage] Refresh button clicked - forcing fresh data fetch');
                  // Toggle forceRefresh to trigger fresh API calls (no cache)
                  setForceRefresh(prev => {
                    const newValue = !prev;
                    console.log(`🔄 [SensorsPage] forceRefresh changed from ${prev} to ${newValue}`);
                    return newValue;
                  });
                }}
                disabled={roomsLoading}
                className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                title={t('common.refresh') as string}
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
                {t('common.refresh')}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Tabs Navigation */}
        {activeTab && tabs.length > 1 && (
          <div className="mb-4 sm:mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-px">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center space-x-1 sm:space-x-2">
                      <span className="truncate max-w-[80px] sm:max-w-none">{tab.label}</span>
                      <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* View Content */}
        {!activeTab ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des chambres...</p>
            </div>
          </div>
        ) : viewMode === 'map' ? (
          /* 3D Warehouse View */
          <Warehouse3DView 
            rooms={displayRooms}
            selectedRoom={null}
            onRoomClick={(room) => {
              const sensor = room.sensors[0];
              if (sensor) {
                handleSensorClick(sensor);
              }
            }}
          />
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayRooms.map((room) => {
              const isDoorOpen = room.sensors?.[0]?.additionalData?.magnet === 0;
              return (
            <div
              key={room.id}
              className={`group rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative overflow-hidden ${
                isDoorOpen 
                  ? 'bg-red-50/30 border-red-300/60 hover:shadow-red-100/50 hover:border-red-400' 
                  : 'bg-white border-gray-200/60 hover:shadow-blue-100/50 hover:border-blue-400'
              }`}
            >
              {/* Compact Room Header */}
              <div className={`px-3 py-2.5 border-b ${
                isDoorOpen 
                  ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50' 
                  : 'bg-gradient-to-r from-slate-50 to-gray-50 border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-gray-900 truncate flex-1">{room.name}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                      F{room.athGroupNumber || 1}
                    </span>
                    <span className="text-xs text-gray-500">{room.capacity}L</span>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDoorOpen ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  </div>
                </div>
              </div>

              {/* Sensor Data */}
              <div className="p-3">
                {room.sensors && room.sensors.length > 0 ? room.sensors.map((sensor) => (
                  <div key={sensor.id}>
                      {sensor.additionalData && (
                      <div className="space-y-2">
                      <div 
                        onClick={() => handleSensorClick(sensor)}
                        className="cursor-pointer hover:bg-gray-50/50 rounded-lg p-1.5 transition-all duration-200"
                      >
                        {/* Data Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Door Status */}
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-2.5 border border-gray-200/50">
                            <div className="text-[10px] text-gray-500 font-semibold mb-1 uppercase">{t('sensors.door')}</div>
                            <div className="flex items-center justify-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${sensor.additionalData.magnet === 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                              <span className="text-base font-bold text-gray-800">
                                {sensor.additionalData.magnet === 0 ? t('sensors.doorOpened') : t('sensors.doorClosed')}
                              </span>
                            </div>
                          </div>
                          
                          {/* Temperature */}
                          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-2.5 border border-red-200/50">
                            <div className="text-[10px] text-red-600 font-semibold mb-1 uppercase">{t('sensors.temp')}</div>
                            <div className="text-base font-bold text-red-700 text-center">
                              {sensor.additionalData.temperature !== null && !isNaN(sensor.additionalData.temperature) 
                                ? sensor.additionalData.temperature.toFixed(1) + '°'
                                : '--'}
                            </div>
                          </div>
                          
                          {/* Humidity */}
                          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-2.5 border border-blue-200/50">
                            <div className="text-[10px] text-blue-600 font-semibold mb-1 uppercase">{t('sensors.hum')}</div>
                            <div className="text-base font-bold text-blue-700 text-center">
                              {sensor.additionalData.humidity.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* Battery Info - Only show if voltage > 0 */}
                        {sensor.additionalData.battery > 0 && (
                          <div className="mt-1.5 flex items-center justify-center">
                            <div className="flex items-center gap-1 bg-green-50 rounded-full px-2 py-0.5">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                              <span className="text-[10px] font-semibold text-green-700">
                                {sensor.additionalData.battery.toFixed(1)}V
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      </div>
                      )}
                    </div>
                )) : (
                  <div className="text-center py-3 text-gray-500 text-sm">
                    Aucun capteur configuré
                  </div>
                )}
                
                {/* Footer */}
                {room.sensors && room.sensors.length > 0 && room.sensors[0].additionalData && (
                  <div className="mt-1.5 pt-2 border-t border-gray-100/50 flex items-center justify-center gap-1">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {room.sensors[0].additionalData.localTime || getTimeAgo(room.sensors[0].additionalData.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
            })}
          </div>
        )}

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
            roomName={displayRooms.find(room => room.sensors.some(s => s.id === selectedSensor.id))?.name}
            boitieDeviceId={displayRooms.find(room => room.sensors.some(s => s.id === selectedSensor.id))?.boitieSensorId}
            isOpen={isChartModalOpen}
            onClose={() => setIsChartModalOpen(false)}
            availableChambers={displayRooms.map(room => ({
              id: room.sensorId, // Use the actual sensor ID instead of the unified sensor ID
              name: room.name,
              channelNumber: extractChannelNumber(room.sensorId) || 1,
              boitieDeviceId: room.boitieSensorId
            }))}
          />
        )}
      </div>
    </div>
  );
};

export default SensorsPage;

