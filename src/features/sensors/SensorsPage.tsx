import React, { useState, useCallback, useMemo } from 'react';
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
  athGroupNumber?: number;
  boitieSensorId?: string;
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
    beacons?: any; // Beacon data if available
    timestamp: Date;
  };
}


const SensorsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  
  // Cache for sensor data to avoid multiple API calls for the same sensor
  const [sensorDataCache, setSensorDataCache] = useState<Map<string, { data: any, timestamp: number }>>(new Map());
  const SENSOR_CACHE_DURATION = 60000; // 1 minute cache for sensor data

  // Function to extract channel number from sensor ID (e.g., "S-CH1" -> 1, "S-CH2" -> 2)
  const extractChannelNumber = (sensorId: string): number | null => {
    const match = sensorId.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  // Function to check if sensor ID indicates it has beacons
  const hasBeacons = (sensorId: string): boolean => {
    // Check if sensor ID contains "beacon" or "bcn" or similar indicators
    return sensorId.toLowerCase().includes('beacon') || 
           sensorId.toLowerCase().includes('bcn') ||
           sensorId.toLowerCase().includes('bt');
  };

  // Function to fetch all telemetry data in bulk from API
  const fetchAllTelemetryData = useCallback(async (boitieDeviceId?: string, forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = `all-telemetry-${boitieDeviceId || '6925665'}`;
    
    console.log(`🔍 [SensorsPage] fetchAllTelemetryData called for device ${boitieDeviceId || '6925665'}, forceRefresh: ${forceRefresh}`);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = sensorDataCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < SENSOR_CACHE_DURATION) {
        console.log(`📦 [SensorsPage] Using cached bulk telemetry data:`, cached.data);
        return cached.data;
      }
    } else {
      console.log(`🔄 [SensorsPage] Force refresh - ignoring cache for bulk telemetry data`);
    }

    try {
      // Use boitieDeviceId if provided, otherwise fallback to default device ID
      const deviceId = boitieDeviceId || '6925665';
      
      // Make single API call to get all telemetry data with all possible parameters
      // Include all possible sensor channels to avoid CORS issues
      const allSensorParams = [
        // Temperature sensors for channels 1-8
        'ble.sensor.temperature.1', 'ble.sensor.temperature.2', 'ble.sensor.temperature.3', 'ble.sensor.temperature.4',
        'ble.sensor.temperature.5', 'ble.sensor.temperature.6', 'ble.sensor.temperature.7', 'ble.sensor.temperature.8',
        // Humidity sensors for channels 1-8
        'ble.sensor.humidity.1', 'ble.sensor.humidity.2', 'ble.sensor.humidity.3', 'ble.sensor.humidity.4',
        'ble.sensor.humidity.5', 'ble.sensor.humidity.6', 'ble.sensor.humidity.7', 'ble.sensor.humidity.8',
        // Battery voltage sensors for channels 1-8
        'ble.sensor.battery.voltage.1', 'ble.sensor.battery.voltage.2', 'ble.sensor.battery.voltage.3', 'ble.sensor.battery.voltage.4',
        'ble.sensor.battery.voltage.5', 'ble.sensor.battery.voltage.6', 'ble.sensor.battery.voltage.7', 'ble.sensor.battery.voltage.8',
        // Magnet status sensors for channels 1-8
        'ble.sensor.magnet.status.1', 'ble.sensor.magnet.status.2', 'ble.sensor.magnet.status.3', 'ble.sensor.magnet.status.4',
        'ble.sensor.magnet.status.5', 'ble.sensor.magnet.status.6', 'ble.sensor.magnet.status.7', 'ble.sensor.magnet.status.8',
        // Beacon data
        'ble.beacons'
      ];
      
      const apiUrl = `https://flespi.io/gw/devices/${deviceId}/telemetry/${allSensorParams.join(',')}`;
      
      console.log(`🌐 [SensorsPage] Bulk API URL for device ${deviceId}:`, apiUrl);
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      console.log(`📊 [SensorsPage] Bulk telemetry API response for device ${deviceId}:`, rawData);

      // Cache the bulk data
      sensorDataCache.set(cacheKey, {
        data: rawData,
        timestamp: now
      });

      return rawData;

    } catch (error) {
      console.error(`❌ [SensorsPage] Error fetching bulk telemetry data:`, error);
      return null;
    }
  }, []);

  // Function to extract sensor data from bulk telemetry data
  const extractSensorDataFromBulk = useCallback((sensorId: string, bulkData: any, boitieDeviceId?: string) => {
    console.log(`🔍 [SensorsPage] extractSensorDataFromBulk called for ${sensorId}`);
    
    // Extract channel number from sensor ID
    const channelNumber = extractChannelNumber(sensorId);
    
    if (!channelNumber) {
      console.error(`❌ [SensorsPage] Could not extract channel number from sensorId: ${sensorId}`);
      return null;
    }
    
    console.log(`🏠 [SensorsPage] Mapped sensorId ${sensorId} to channel ${channelNumber}`);
    
    // Check if this sensor has beacons
    const sensorHasBeacons = hasBeacons(sensorId);
    console.log(`📡 [SensorsPage] Sensor ${sensorId} has beacons: ${sensorHasBeacons}`);

    if (!bulkData || !bulkData.result || !Array.isArray(bulkData.result) || bulkData.result.length === 0) {
      console.log(`❌ [SensorsPage] No bulk telemetry data available for ${sensorId}`);
      return null;
    }

    const telemetry = bulkData.result[0].telemetry;
    let sensorData: any = null;

    if (sensorHasBeacons) {
      // Handle beacon data
      if (!telemetry || !telemetry['ble.beacons']) {
        console.log(`❌ [SensorsPage] No beacon data in bulk telemetry for ${sensorId}`);
        return null;
      }

      const beaconArray = telemetry['ble.beacons'].value;
      
      console.log(`📡 [SensorsPage] Beacon array from bulk data for ${sensorId}:`, beaconArray);
      
      // Log all available beacon IDs for debugging
      const availableIds = beaconArray.map((beacon: any) => beacon.id).filter(Boolean);
      console.log(`📡 [SensorsPage] Available beacon IDs:`, availableIds);
      console.log(`🔍 [SensorsPage] Looking for beacon matching channel ${channelNumber}...`);

      // Find beacon for this specific chamber
      const chamberBeacon = beaconArray.find((beacon: any) => {
        if (!beacon.id) return false;
        
        const beaconId = beacon.id.toLowerCase();
        const searchPatterns = [
          `chambre${channelNumber}`,     // "chambre2"
          `chambre ${channelNumber}`,    // "chambre 2"
          `ch${channelNumber}`,          // "ch2"
          `room${channelNumber}`,        // "room2"
          `room ${channelNumber}`,       // "room 2"
          `c${channelNumber}`,           // "c2"
          `${channelNumber}`             // "2" (if ID is just the number)
        ];
        
        const matches = searchPatterns.some(pattern => {
          const isMatch = beaconId.includes(pattern);
          if (isMatch) {
            console.log(`✅ [SensorsPage] Found match: "${beacon.id}" matches pattern "${pattern}"`);
          }
          return isMatch;
        });
        
        return matches;
      });

      if (!chamberBeacon) {
        console.log(`❌ [SensorsPage] No beacon found for channel ${channelNumber} in beacon array`);
        console.log(`❌ [SensorsPage] Searched patterns: chambre${channelNumber}, chambre ${channelNumber}, ch${channelNumber}, room${channelNumber}, room ${channelNumber}, c${channelNumber}, ${channelNumber}`);
        return null;
      }

      console.log(`📡 [SensorsPage] Found beacon for Chambre${channelNumber}:`, chamberBeacon);

      // Extract data from beacon object
      sensorData = {
        temperature: parseFloat(chamberBeacon.temperature),
        humidity: parseFloat(chamberBeacon.humidity),
        battery: parseFloat(chamberBeacon['battery.voltage']) || 0,
        magnet: chamberBeacon.magnet === true ? 1 : 0,
        beacons: chamberBeacon, // Store the full beacon object
        timestamp: new Date() // Beacon data doesn't have timestamp, use current time
      };

      console.log(`📊 [SensorsPage] Processed beacon data for ${sensorId} (Chambre${channelNumber}):`, {
        temperature: chamberBeacon.temperature,
        humidity: chamberBeacon.humidity,
        battery: chamberBeacon['battery.voltage'],
        magnet: chamberBeacon.magnet,
        id: chamberBeacon.id,
        macAddress: chamberBeacon['mac.address'],
        type: chamberBeacon.type
      });

    } else {
      // Handle regular sensor data
      if (!telemetry || 
          !telemetry[`ble.sensor.temperature.${channelNumber}`] ||
          !telemetry[`ble.sensor.humidity.${channelNumber}`]) {
        console.log(`❌ [SensorsPage] No temperature or humidity data in bulk telemetry for ${sensorId} (channel ${channelNumber})`);
        return null;
      }

      const tempValue = telemetry[`ble.sensor.temperature.${channelNumber}`].value;
      const humidityValue = telemetry[`ble.sensor.humidity.${channelNumber}`].value;
      const batteryValue = telemetry[`ble.sensor.battery.voltage.${channelNumber}`]?.value || 0;
      const magnetValue = telemetry[`ble.sensor.magnet.status.${channelNumber}`]?.value || false;

      // Get the real timestamp from the API
      const apiTimestamp = telemetry[`ble.sensor.temperature.${channelNumber}`].ts;
      const realTimestamp = new Date(apiTimestamp * 1000);

      console.log(`📊 [SensorsPage] Raw telemetry values for ${sensorId} (channel ${channelNumber}):`, {
        temperature: tempValue,
        humidity: humidityValue,
        battery: batteryValue,
        magnet: magnetValue,
        apiTimestamp: apiTimestamp,
        realTimestamp: realTimestamp.toISOString()
      });

      sensorData = {
        temperature: parseFloat(tempValue),
        humidity: parseFloat(humidityValue),
        battery: parseFloat(batteryValue) || 0,
        magnet: magnetValue === true ? 1 : 0,
        beacons: null, // No beacon data for regular sensors
        timestamp: realTimestamp
      };
    }

    console.log(`✅ [SensorsPage] Processed sensor data for ${sensorId} (channel ${channelNumber}):`, sensorData);
    console.log(`📊 [SensorsPage] Data validation for ${sensorId}:`, {
      temperatureValid: sensorData.temperature > 0,
      humidityValid: sensorData.humidity > 0,
      batteryValid: sensorData.battery > 0,
      magnetValid: sensorData.magnet !== undefined,
      beaconValid: sensorData.beacons !== null && sensorData.beacons !== undefined
    });

    return sensorData;

  }, []);

  // Legacy function to fetch latest sensor data from API using sensor ID and boitie device ID
  const fetchLatestSensorData = useCallback(async (sensorId: string, boitieDeviceId?: string, forceRefresh = false) => {
    const now = Date.now();
    
    console.log(`🔍 [SensorsPage] fetchLatestSensorData called for ${sensorId}, forceRefresh: ${forceRefresh}`);
    
    // Extract channel number from sensor ID (e.g., "S-CH1" -> 1, "S-CH2" -> 2)
    const channelNumber = extractChannelNumber(sensorId);
    
    if (!channelNumber) {
      console.error(`❌ [SensorsPage] Could not extract channel number from sensorId: ${sensorId}`);
      return null;
    }
    
    console.log(`🏠 [SensorsPage] Mapped sensorId ${sensorId} to channel ${channelNumber}`);
    
    // Check if this sensor has beacons
    const sensorHasBeacons = hasBeacons(sensorId);
    console.log(`📡 [SensorsPage] Sensor ${sensorId} has beacons: ${sensorHasBeacons}`);
    
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
      let apiUrl: string;
      
      // Use boitieDeviceId if provided, otherwise fallback to default device ID
      const deviceId = boitieDeviceId || '6925665';
      
      if (sensorHasBeacons) {
        // For beacons, use the ble.beacons endpoint
        apiUrl = `https://flespi.io/gw/devices/${deviceId}/telemetry/ble.beacons`;
        console.log(`📡 [SensorsPage] Using beacon endpoint for ${sensorId} (channel ${channelNumber}) with device ${deviceId}`);
      } else {
        // For regular sensors, use the standard sensor endpoint
        apiUrl = `https://flespi.io/gw/devices/${deviceId}/telemetry/ble.sensor.temperature.${channelNumber},ble.sensor.humidity.${channelNumber},ble.sensor.battery.voltage.${channelNumber},ble.sensor.magnet.status.${channelNumber}`;
      }
      
      console.log(`🌐 [SensorsPage] API URL for ${sensorId} (channel ${channelNumber}, beacons: ${sensorHasBeacons}):`, apiUrl);
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }





      const rawData = await response.json();
      
      console.log(`📊 [SensorsPage] Telemetry API response for ${sensorId} (channel ${channelNumber}):`, rawData);

      let sensorData: any = null;

      if (sensorHasBeacons) {
        // Handle beacon data
      if (!rawData || 
          !rawData.result || 
          !Array.isArray(rawData.result) || 
          rawData.result.length === 0 ||
          !rawData.result[0].telemetry ||
            !rawData.result[0].telemetry['ble.beacons']) {
          console.log(`❌ [SensorsPage] No beacon data in telemetry response for ${sensorId}`);
        return null;
      }

      const telemetry = rawData.result[0].telemetry;
        const beaconArray = telemetry['ble.beacons'].value;
        
        console.log(`📡 [SensorsPage] Beacon array received for ${sensorId}:`, beaconArray);
        
        // Log all available beacon IDs for debugging
        const availableIds = beaconArray.map((beacon: any) => beacon.id).filter(Boolean);
        console.log(`📡 [SensorsPage] Available beacon IDs:`, availableIds);
        console.log(`🔍 [SensorsPage] Looking for beacon matching channel ${channelNumber}...`);

        // Find beacon for this specific chamber
        // Look for various formats: "Chambre2", "chambre2", "Chambre 2", "CH2", etc.
        const chamberBeacon = beaconArray.find((beacon: any) => {
          if (!beacon.id) return false;
          
          const beaconId = beacon.id.toLowerCase();
          const searchPatterns = [
            `chambre${channelNumber}`,     // "chambre2"
            `chambre ${channelNumber}`,    // "chambre 2"
            `ch${channelNumber}`,          // "ch2"
            `room${channelNumber}`,        // "room2"
            `room ${channelNumber}`,       // "room 2"
            `c${channelNumber}`,           // "c2"
            `${channelNumber}`             // "2" (if ID is just the number)
          ];
          
          const matches = searchPatterns.some(pattern => {
            const isMatch = beaconId.includes(pattern);
            if (isMatch) {
              console.log(`✅ [SensorsPage] Found match: "${beacon.id}" matches pattern "${pattern}"`);
            }
            return isMatch;
          });
          
          return matches;
        });

        if (!chamberBeacon) {
          console.log(`❌ [SensorsPage] No beacon found for channel ${channelNumber} in beacon array`);
          console.log(`❌ [SensorsPage] Searched patterns: chambre${channelNumber}, chambre ${channelNumber}, ch${channelNumber}, room${channelNumber}, room ${channelNumber}, c${channelNumber}, ${channelNumber}`);
          return null;
        }

        console.log(`📡 [SensorsPage] Found beacon for Chambre${channelNumber}:`, chamberBeacon);

        // Extract data from beacon object
        sensorData = {
          temperature: parseFloat(chamberBeacon.temperature),
          humidity: parseFloat(chamberBeacon.humidity),
          battery: parseFloat(chamberBeacon['battery.voltage']) || 0,
          magnet: chamberBeacon.magnet === true ? 1 : 0,
          beacons: chamberBeacon, // Store the full beacon object
          timestamp: new Date() // Beacon data doesn't have timestamp, use current time
        };

        console.log(`📊 [SensorsPage] Processed beacon data for ${sensorId} (Chambre${channelNumber}):`, {
          temperature: chamberBeacon.temperature,
          humidity: chamberBeacon.humidity,
          battery: chamberBeacon['battery.voltage'],
          magnet: chamberBeacon.magnet,
          id: chamberBeacon.id,
          macAddress: chamberBeacon['mac.address'],
          type: chamberBeacon.type
        });

      } else {
        // Handle regular sensor data
        if (!rawData || 
            !rawData.result || 
            !Array.isArray(rawData.result) || 
            rawData.result.length === 0 ||
            !rawData.result[0].telemetry ||
            !rawData.result[0].telemetry[`ble.sensor.temperature.${channelNumber}`] ||
            !rawData.result[0].telemetry[`ble.sensor.humidity.${channelNumber}`]) {
          console.log(`❌ [SensorsPage] No temperature or humidity data in telemetry response for ${sensorId} (channel ${channelNumber})`);
          return null;
        }

        const telemetry = rawData.result[0].telemetry;
        const tempValue = telemetry[`ble.sensor.temperature.${channelNumber}`].value;
        const humidityValue = telemetry[`ble.sensor.humidity.${channelNumber}`].value;
        const batteryValue = telemetry[`ble.sensor.battery.voltage.${channelNumber}`]?.value || 0;
        const magnetValue = telemetry[`ble.sensor.magnet.status.${channelNumber}`]?.value || false;

        // Get the real timestamp from the API
        const apiTimestamp = telemetry[`ble.sensor.temperature.${channelNumber}`].ts;
        const realTimestamp = new Date(apiTimestamp * 1000);

        console.log(`📊 [SensorsPage] Raw telemetry values for ${sensorId} (channel ${channelNumber}):`, {
        temperature: tempValue,
        humidity: humidityValue,
        battery: batteryValue,
        magnet: magnetValue,
        apiTimestamp: apiTimestamp,
        realTimestamp: realTimestamp.toISOString()
      });

        sensorData = {
        temperature: parseFloat(tempValue),
        humidity: parseFloat(humidityValue),
        battery: parseFloat(batteryValue) || 0,
        magnet: magnetValue === true ? 1 : 0,
          beacons: null, // No beacon data for regular sensors
        timestamp: realTimestamp
      };
      }

      console.log(`✅ [SensorsPage] Processed sensor data for ${sensorId} (channel ${channelNumber}):`, sensorData);
      console.log(`📊 [SensorsPage] Data validation for ${sensorId}:`, {
        temperatureValid: sensorData.temperature > 0,
        humidityValid: sensorData.humidity > 0,
        batteryValid: sensorData.battery > 0,
        magnetValid: sensorData.magnet !== undefined,
        beaconValid: sensorData.beacons !== null && sensorData.beacons !== undefined
      });

      // Cache the result
      setSensorDataCache(prev => {
        const newCache = new Map(prev);
        newCache.set(sensorId, { data: sensorData, timestamp: now });
        console.log(`💾 [SensorsPage] Cached fresh data for ${sensorId} (channel ${channelNumber}):`, sensorData);
        return newCache;
      });

      return sensorData;
    } catch (error) {
      console.error(`Error fetching sensor data for ${sensorId} (channel ${channelNumber}):`, error);
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
        .sort((a, b) => a.room.localeCompare(b.room, 'fr', { numeric: true }));
      
      // Get unique boitieSensorIds to make bulk API calls
      const uniqueBoitieIds = [...new Set(filteredRooms.map(room => room.boitieSensorId).filter(Boolean))];
      console.log(`🔍 [SensorsPage] Found ${uniqueBoitieIds.length} unique boitie sensor IDs:`, uniqueBoitieIds);
      
      // Fetch bulk telemetry data for each unique device
      const bulkTelemetryData: { [deviceId: string]: any } = {};
      for (const deviceId of uniqueBoitieIds) {
        console.log(`📡 [SensorsPage] Fetching bulk data for device: ${deviceId}`);
        const bulkData = await fetchAllTelemetryData(deviceId, forceRefresh);
        if (bulkData) {
          bulkTelemetryData[deviceId] = bulkData;
        }
      }
      
      // Process each room using the bulk data
      for (const roomDoc of filteredRooms) {
        const deviceId = roomDoc.boitieSensorId || '6925665';
        const bulkData = bulkTelemetryData[deviceId];
        
        // Extract sensor data from bulk telemetry data
        const sensorData = bulkData ? extractSensorDataFromBulk(roomDoc.sensorId, bulkData, deviceId) : null;
        
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
              beacons: finalSensorData.beacons, // Include beacon data if available
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
          athGroupNumber: roomDoc.athGroupNumber || 1,
          boitieSensorId: roomDoc.boitieSensorId,
          sensors: sensors || []
        });
      }
      
      console.log(`✅ [SensorsPage] Processed ${roomsData.length} rooms with bulk telemetry data (${uniqueBoitieIds.length} API calls instead of ${filteredRooms.length})`);
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
    if (!activeTab) {
      return [];
    }
    if (activeTab === 'all') {
      return rooms || [];
    }
    return groupedRooms[activeTab] || [];
  }, [activeTab, rooms, groupedRooms]);

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
                <p className="text-gray-600 text-base sm:text-lg">Surveillance IoT en temps réel</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">
                  {!activeTab 
                    ? 'Chargement...'
                    : activeTab === 'all' 
                      ? `${rooms.length} chambres actives`
                      : `${displayRooms.length} chambres - ${tabs.find(t => t.id === activeTab)?.label || 'Groupe'}`
                  }
                </span>
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

        {/* Mobile-Responsive Grid */}
        {!activeTab ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des chambres...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayRooms.map((room) => (
            <div
              key={room.id}
              className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              {/* Mobile-Optimized Room Header */}
              <div className="p-3 sm:p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    {/* Chamber Number */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {extractChannelNumber(room.sensorId) || room.name.replace(/\D/g, '') || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{room.name}</h3>
                      <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 min-w-0">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
                          FRIGO {room.athGroupNumber || 1}
                        </span>
                        <span className="text-xs text-gray-500 hidden sm:inline truncate">{room.capacity}L</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 hidden sm:inline">Online</span>
                </div>
                </div>
              </div>

              {/* Mobile-Optimized Sensor Data */}
              <div className="p-3 sm:p-4">
                {room.sensors && room.sensors.length > 0 ? room.sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    onClick={() => handleSensorClick(sensor)}
                    className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 sm:p-3 transition-colors duration-150"
                  >
                    {/* Sensor Header */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3 min-w-0">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <h4 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{sensor.name}</h4>
                      </div>
                      {/* Detail Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSensorClick(sensor);
                        }}
                        className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors duration-150 flex-shrink-0 ml-1 sm:ml-2"
                        title="Agrandir / Voir détails"
                      >
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                      </button>
                    </div>

                      {sensor.additionalData && (
                      <div>
                        {/* Main Data Grid - 3 columns with more width */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                          {/* Door */}
                          <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2 mx-1">
                            <div className="text-xs text-gray-600 font-medium mb-1 hidden sm:block">Port</div>
                            <div className="flex items-center justify-center">
                              <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-0.5 sm:mr-1 flex-shrink-0 ${sensor.additionalData.magnet === 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span className="text-xs sm:text-sm font-bold text-gray-700">
                                {sensor.additionalData.magnet === 0 ? 'O' : 'F'}
                              </span>
                            </div>
                              </div>
                          
                          {/* Temperature */}
                          <div className="bg-red-50 rounded-lg p-1.5 sm:p-2 mx-1">
                            <div className="text-xs text-red-600 font-medium mb-1 hidden sm:block">Temp</div>
                            <div className="text-sm sm:text-lg font-bold text-red-700">
                              {sensor.additionalData.temperature !== null && !isNaN(sensor.additionalData.temperature) 
                                ? sensor.additionalData.temperature.toFixed(1) + '°'
                                : 'N/A'}
                            </div>
                          </div>
                          
                          {/* Humidity */}
                          <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 mx-1">
                            <div className="text-xs text-blue-600 font-medium mb-1 hidden sm:block">Hum</div>
                            <div className="text-sm sm:text-lg font-bold text-blue-700">
                              {sensor.additionalData.humidity.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* Compact Battery Info - Only show if voltage > 0 */}
                        {sensor.additionalData.battery > 0 && (
                          <div className="mt-2 flex items-center justify-center">
                            <div className="flex items-center space-x-1 bg-green-50 rounded-full px-2 py-1">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium text-green-700">
                                {sensor.additionalData.battery.toFixed(1)}V
                              </span>
                            </div>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                )) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Aucun capteur configuré
                  </div>
                )}
                
                {/* Last Update Footer */}
                {room.sensors && room.sensors.length > 0 && room.sensors[0].additionalData && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                    <span className="text-xs text-gray-500">
                      Mis à jour {getTimeAgo(room.sensors[0].additionalData.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
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

