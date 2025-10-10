import React, { useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { mqttLiveService, SensorData as MQTTSensorData } from '../lib/mqtt-live';
import jsPDF from 'jspdf';

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

interface SensorData {
  timestamp: number;
  temperature: number;
  humidity: number;
  battery: number;
  magnet: number; // 0 = open, 1 = closed (magnet sensor: false=open, true=closed)
}

interface SensorChartProps {
  sensorId: string;
  sensorName: string;
  roomName?: string; // Add room name for API
  boitieDeviceId?: string;
  isOpen: boolean;
  onClose: () => void;
  availableChambers?: Array<{
    id: string;
    name: string;
    channelNumber: number;
    boitieDeviceId?: string;
  }>;
}

const SensorChart: React.FC<SensorChartProps> = ({ sensorId, sensorName, roomName, boitieDeviceId, isOpen, onClose, availableChambers = [] }) => {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Comparison mode state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedChambers, setSelectedChambers] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<{ [chamberId: string]: SensorData[] }>({});
  const [comparisonLoading, setComparisonLoading] = useState(false);
  
  
  // Function to add chamber data to comparison (reuses existing data if available)
  const addChamberToComparison = useCallback((chamber: { id: string; name: string; channelNumber: number; boitieDeviceId?: string }) => {
    // Check if this is the current sensor - if so, reuse the existing data
    const isCurrentSensor = chamber.name === sensorName || chamber.id === sensorId;
    
    if (isCurrentSensor && data.length > 0) {
      console.log(`📦 [SensorChart] Reusing existing data for current chamber: ${chamber.name}`);
      setComparisonData(prev => ({
        ...prev,
        [chamber.id]: data
      }));
    } else if (!comparisonData[chamber.id]) {
      // Only fetch if we don't already have data for this chamber
      console.log(`🔄 [SensorChart] Need to fetch data for chamber: ${chamber.name}`);
      // For now, just log - full implementation would fetch here
    } else {
      console.log(`📦 [SensorChart] Already have data for chamber: ${chamber.name}`);
    }
  }, [data, sensorName, sensorId, comparisonData]);
  
  // Update comparison data when main data changes (for current sensor)
  useEffect(() => {
    if (comparisonMode && data.length > 0) {
      const currentChamber = availableChambers.find(c => c.name === sensorName);
      if (currentChamber && selectedChambers.includes(currentChamber.id)) {
        console.log(`📦 [SensorChart] Updating comparison data for current chamber with new data`);
        setComparisonData(prev => ({
          ...prev,
          [currentChamber.id]: data
        }));
      }
    }
  }, [data, comparisonMode, sensorName, availableChambers, selectedChambers]);
  
  // Cache for storing sensor data
  const [cache, setCache] = useState<Map<string, { data: SensorData[], timestamp: number }>>(new Map());
  
  // Date range state - default to last 30 minutes
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min'
    };
  });

  const [isLiveMode, setIsLiveMode] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'basic' | 'kpi'>('basic');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [kpiCalculating, setKpiCalculating] = useState(false);
  const [cachedKPIs, setCachedKPIs] = useState<any>(null);
  const [chartKey, setChartKey] = useState(0); // For forcing chart re-render on resize

  // Cache duration constant
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Extract channel number from sensor ID
  const extractChannelNumber = (sensorId: string): number | null => {
    console.log(`🔍 [SensorChart] extractChannelNumber called with sensorId: "${sensorId}", sensorName: "${sensorName}"`);
    
    // Try to extract from sensor name first (if available)
    if (sensorName && sensorName.includes('CH')) {
      console.log(`🔍 [SensorChart] Sensor name contains 'CH', attempting to extract channel number`);
      const nameMatch = sensorName.match(/CH\s*(\d+)/i);
      console.log(`🔍 [SensorChart] Name match result:`, nameMatch);
      if (nameMatch) {
        const channel = parseInt(nameMatch[1]);
        console.log(`🏠 [SensorChart] Channel extraction (from name): "${sensorName}" -> channel ${channel}`);
        return channel;
      }
    } else {
      console.log(`🔍 [SensorChart] Sensor name check failed: sensorName="${sensorName}", includes CH: ${sensorName?.includes('CH')}`);
    }
    
    // Try standard patterns
    let match = sensorId.match(/-ch(\d+)/i);
    if (match) {
      const channel = parseInt(match[1]);
      console.log(`🏠 [SensorChart] Channel extraction (pattern -ch): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    match = sensorId.match(/uT(\d+)R/);
    if (match) {
      const channel = parseInt(match[1]);
      console.log(`🏠 [SensorChart] Channel extraction (unified pattern): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    // For unified sensor IDs without clear channel info, try to map to available channels
    if (sensorId.includes('unified')) {
      // Try to extract any number and map it to channels 1-8
      match = sensorId.match(/(\d+)/);
      if (match) {
        let channel = parseInt(match[1]);
        // Map large numbers to channels 1-8
        if (channel > 8) {
          channel = ((channel - 1) % 8) + 1;
        }
        console.log(`🏠 [SensorChart] Channel extraction (unified mapping): "${sensorId}" -> channel ${channel}`);
        return channel;
      }
    }
    
    // Fallback: try to extract any number
    match = sensorId.match(/(\d+)/);
    if (match) {
      let channel = parseInt(match[1]);
      // Ensure channel is within 1-8 range
      if (channel > 8) {
        channel = ((channel - 1) % 8) + 1;
      }
      console.log(`🏠 [SensorChart] Channel extraction (fallback): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    console.log(`🏠 [SensorChart] Channel extraction failed: "${sensorId}" -> no channel found`);
    return 1; // Default to channel 1
  };
  
  const channelNumber = extractChannelNumber(sensorId);
  console.log(`🏠 [SensorChart] Final channel ${channelNumber} from sensorId: ${sensorId}`);

  // Function to prepare comparison data from already loaded messages
  // This reuses the data from the main fetchSensorData call - NO NEW API REQUEST!
  const fetchAllChambersData = useCallback(async () => {
    if (availableChambers.length <= 1) return;
    
    setComparisonLoading(true);
    console.log(`🔄 [SensorChart] Preparing comparison data for all ${availableChambers.length} chambers`);
    console.log(`📦 [SensorChart] Reusing already loaded data - NO NEW API REQUEST`);
    
    try {
      // Get the cached data from the main fetchSensorData call
      const cacheKey = `${sensorId}-${dateRange.start}-${dateRange.end}-${dateRange.type}`;
      const cached = cache.get(cacheKey);
      
      if (!cached || !cached.data || cached.data.length === 0) {
        console.warn('⚠️ [SensorChart] No cached data available for comparison. Please wait for main data to load first.');
        setComparisonLoading(false);
        return;
      }
      
      console.log(`📦 [SensorChart] Found cached data with ${cached.data.length} points`);
      
      // Add current chamber data to comparison
      const currentChamber = availableChambers.find(c => c.name === sensorName || c.id === sensorId);
      if (currentChamber) {
        const newComparisonData: { [chamberId: string]: SensorData[] } = {
          [currentChamber.id]: cached.data
        };
        
        setComparisonData(newComparisonData);
        setSelectedChambers([currentChamber.id]);
        console.log(`✅ [SensorChart] Added current chamber to comparison: ${currentChamber.name} (${cached.data.length} points)`);
      }
      
    } catch (error) {
      console.error(`❌ [SensorChart] Error preparing comparison data:`, error);
    } finally {
      setComparisonLoading(false);
    }
  }, [availableChambers, sensorId, sensorName, dateRange, cache]);

  // Simple function to process chamber data
  const processChamberData = useCallback((messages: any[], channelNumber: number): SensorData[] => {
    console.log(`🔧 [SensorChart] Processing ${messages?.length || 0} messages for channel ${channelNumber}`);
    
    // Don't filter by date range - just use all messages from the API
    // The API already limits to the most recent messages
    const filteredMessages = messages;
    
    console.log(`📊 [SensorChart] Processing ${filteredMessages.length} messages`);
    
    const processedData: SensorData[] = [];
    
    for (const message of filteredMessages) {
      let sensorData: SensorData | null = null;
      
      // Log message keys to see what data is available
      if (filteredMessages.indexOf(message) === 0) {
        console.log(`📊 [SensorChart] Processing first message, available keys:`, Object.keys(message));
      }
      
      // Check if this message has beacon data
      if (message['ble.beacons'] && Array.isArray(message['ble.beacons'])) {
        const beaconArray = message['ble.beacons'];
        
        // Log all beacon IDs found in this message (only for first few messages)
        if (filteredMessages.indexOf(message) < 3) {
          console.log(`📡 [SensorChart] Found beacon data in message, looking for channel ${channelNumber}`);
          console.log(`📡 [SensorChart] All beacons in this message:`, beaconArray.map((b: any) => b.id));
        }
        
        const chamberBeacon = beaconArray.find((beacon: any) => {
          if (!beacon.id) return false;
          const beaconId = beacon.id.toLowerCase();
          
          // Only log detailed matching for first few messages to avoid spam
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🔍 [SensorChart] Checking beacon ID: "${beaconId}" for channel ${channelNumber}`);
          }
          
          const searchPatterns = [
            `chambre${channelNumber}`, `chambre ${channelNumber}`, `ch${channelNumber}`,
            `room${channelNumber}`, `room ${channelNumber}`, `c${channelNumber}`, `${channelNumber}`
          ];
          
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🔍 [SensorChart] Testing patterns:`, searchPatterns);
          }
          
          const matches = searchPatterns.some(pattern => {
            const matches = beaconId.includes(pattern);
            if (matches && filteredMessages.indexOf(message) < 3) {
              console.log(`✅ [SensorChart] Beacon "${beaconId}" matches pattern "${pattern}"`);
            }
            return matches;
          });
          
          if (!matches && filteredMessages.indexOf(message) < 3) {
            console.log(`❌ [SensorChart] Beacon "${beaconId}" does not match any pattern for channel ${channelNumber}`);
          }
          
          return matches;
        });
        
        if (chamberBeacon) {
          const magnetValue = chamberBeacon.magnet === true ? 1 : 0;
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🚪 [SensorChart] Beacon magnet value: ${chamberBeacon.magnet} -> ${magnetValue}`);
          }
          sensorData = {
            timestamp: message.timestamp * 1000,
            temperature: parseFloat(chamberBeacon.temperature) || 0,
            humidity: parseFloat(chamberBeacon.humidity) || 0,
            battery: parseFloat(chamberBeacon['battery.voltage']) || 0,
            magnet: magnetValue
          };
        }
          } else {
        // Handle regular sensor data
        const tempKey = `ble.sensor.temperature.${channelNumber}`;
        const humKey = `ble.sensor.humidity.${channelNumber}`;
        const tempValue = message[tempKey];
        const humidityValue = message[humKey];
        
        if (filteredMessages.indexOf(message) === 0) {
          console.log(`🔧 [SensorChart] Looking for keys: ${tempKey}, ${humKey}`);
          console.log(`🔧 [SensorChart] Found values: temp=${tempValue}, humidity=${humidityValue}`);
        }
        
        if (tempValue !== undefined && humidityValue !== undefined) {
          const magnetKey = `ble.sensor.magnet.status.${channelNumber}`;
          const magnetRawValue = message[magnetKey];
          const magnetValue = magnetRawValue === true ? 1 : 0;
          
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🚪 [SensorChart] Regular sensor magnet key: ${magnetKey}, raw value: ${magnetRawValue}, converted: ${magnetValue}`);
          }
          
          sensorData = {
            timestamp: message.timestamp * 1000,
            temperature: parseFloat(tempValue) || 0,
            humidity: parseFloat(humidityValue) || 0,
            battery: parseFloat(message[`ble.sensor.battery.voltage.${channelNumber}`]) || 0,
            magnet: magnetValue
          };
        }
      }
      
      if (sensorData) {
        processedData.push(sensorData);
      }
    }
    
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`✅ [SensorChart] Processing complete:`);
    console.log(`   - Input messages: ${filteredMessages.length}`);
    console.log(`   - Processed data points: ${processedData.length}`);
    console.log(`   - Channel: ${channelNumber}`);
    console.log(`   - Returning: ${Math.min(processedData.length, 30)} points`);
    
    // Log first few data points with magnet values
    if (processedData.length > 0) {
      console.log(`🚪 [SensorChart] First 3 processed data points with magnet values:`, 
        processedData.slice(0, 3).map(d => ({
          temp: d.temperature,
          hum: d.humidity,
          magnet: d.magnet,
          time: new Date(d.timestamp).toLocaleTimeString()
        }))
      );
      
      // Count magnet states
      const magnetStats = processedData.reduce((acc, d) => {
        acc[d.magnet] = (acc[d.magnet] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log(`🚪 [SensorChart] Magnet stats:`, magnetStats);
    }
    
    return processedData.slice(-30); // Limit to 30 points
    
  }, [dateRange]);

  // Main sensor data fetching function (simplified)
  const fetchSensorData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = `${sensorId}-${dateRange.start}-${dateRange.end}-${dateRange.type}`;
    
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('📦 [SensorChart] Using cached data:', cached.data.length, 'items');
        setData(cached.data);
        return;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      const deviceId = boitieDeviceId || '6925665';
      const room = roomName || sensorName;
      
      // Calculate time range based on selected dateRange type
      const end = new Date();
      let start = new Date();
      
      // Calculate start time based on dateRange.type
      switch (dateRange.type) {
        case '30min':
          start = new Date(end.getTime() - 30 * 60 * 1000);
          break;
        case '1h':
          start = new Date(end.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '12h':
          start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
          break;
        case '24h':
        case '1d':
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          // Default to 30 minutes
          start = new Date(end.getTime() - 30 * 60 * 1000);
      }
      
      // Format dates for API (YYYY-MM-DD HH:MM)
      const formatDate = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      
      const startStr = encodeURIComponent(formatDate(start));
      const endStr = encodeURIComponent(formatDate(end));
      const roomStr = encodeURIComponent(room);
      
      // Use new history API endpoint
      const apiUrl = `https://api.frigosmart.com/rooms/history?device_id=${deviceId}&room=${roomStr}&start=${startStr}&end=${endStr}`;
      
      console.log(`🌐 [SensorChart] Fetching history from new API:`, apiUrl);
      console.log(`📊 [SensorChart] Room: ${room}, Device: ${deviceId}`);
      console.log(`📊 [SensorChart] Time Range Type: ${dateRange.type}`);
      console.log(`📊 [SensorChart] Range: ${formatDate(start)} to ${formatDate(end)}`);
      
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [SensorChart] API Error ${response.status}:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const rawData = await response.json();
      console.log(`📊 [SensorChart] API Response:`, rawData);
      console.log(`📊 [SensorChart] Received ${rawData.count || 0} data points`);
      
      if (!rawData.data || rawData.data.length === 0) {
        console.warn('⚠️ [SensorChart] No data in API response!');
        setData([]);
        setLoading(false);
        return;
      }
      
      console.log(`📊 [SensorChart] First data sample:`, rawData.data[0]);
      
      // Convert API response to SensorData format
      const processedData: SensorData[] = rawData.data.map((item: any) => ({
        timestamp: item.epoch * 1000, // Convert to milliseconds
        temperature: parseFloat(item.temperature) || 0,
        humidity: parseFloat(item.humidity) || 0,
        battery: 0, // Not provided by new API
        magnet: item.magnet === true ? 1 : 0 // true = closed (1), false = open (0)
      }));
      
      // Sort by timestamp
      processedData.sort((a, b) => a.timestamp - b.timestamp);
      
      setData(processedData);
      console.log(`✅ [SensorChart] Processed ${processedData.length} data points`);
      if (processedData.length > 0) {
        console.log(`📊 [SensorChart] First data point:`, processedData[0]);
        console.log(`📊 [SensorChart] Last data point:`, processedData[processedData.length - 1]);
        console.log(`🔍 [SensorChart] Chart data:`);
        console.log(`   - Time range: ${new Date(processedData[0].timestamp).toLocaleString()} to ${new Date(processedData[processedData.length - 1].timestamp).toLocaleString()}`);
        console.log(`   - Temperature: ${processedData[0].temperature}°C`);
        console.log(`   - Humidity: ${processedData[0].humidity}%`);
        console.log(`   - Door: ${processedData[0].magnet === 1 ? 'CLOSED' : 'OPEN'}`);
      }

      // Cache the result
      cache.set(cacheKey, { data: processedData, timestamp: now });
      
        } catch (error) {
      console.error(`❌ [SensorChart] Error fetching sensor data:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des données';
      setError(`Échec du chargement des données: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [sensorId, dateRange, boitieDeviceId, channelNumber, cache, processChamberData]);

  // Quick date range functions
  const setQuickRange = (days: number, type: string) => {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: type
      });
    };

  const setLast30Minutes = () => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    setDateRange({
      start: thirtyMinutesAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min'
    });
  };

  const isRangeSelected = (type: string) => dateRange.type === type;

  // Calculate KPIs from data
  const calculateKPIs = useCallback(() => {
    // Use validData for KPI calculations (filters out 0 values)
    const validDataForKPI = data.filter(d => d.temperature !== 0 && d.humidity !== 0);
    
    if (validDataForKPI.length === 0) return null;

    const temps = validDataForKPI.map(d => d.temperature);
    const humidities = validDataForKPI.map(d => d.humidity);

    // Average Temperature
    const avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;

    // Temperature Stability (Standard Deviation)
    const tempVariance = temps.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / temps.length;
    const tempStability = Math.sqrt(tempVariance);

    // Average Humidity
    const avgHumidity = humidities.reduce((sum, h) => sum + h, 0) / humidities.length;

    // Humidity Stability (Standard Deviation)
    const humVariance = humidities.reduce((sum, h) => sum + Math.pow(h - avgHumidity, 2), 0) / humidities.length;
    const humStability = Math.sqrt(humVariance);

    // Temperature in safe range (0-4°C)
    const tempInRange = temps.filter(t => t >= 0 && t <= 4).length;
    const tempRangePercent = (tempInRange / temps.length) * 100;

    // Humidity in optimal range (90-95%)
    const humInRange = humidities.filter(h => h >= 90 && h <= 95).length;
    const humRangePercent = (humInRange / humidities.length) * 100;

    // Min/Max values
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minHum = Math.min(...humidities);
    const maxHum = Math.max(...humidities);

    return {
      avgTemp,
      tempStability,
      avgHumidity,
      humStability,
      tempRangePercent,
      humRangePercent,
      minTemp,
      maxTemp,
      minHum,
      maxHum,
      dataPoints: validDataForKPI.length
    };
  }, [data]);

  const kpis = calculateKPIs();

  // Calculate responsive chart dimensions and font sizes
  const getResponsiveConfig = () => {
    if (typeof window !== 'undefined') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Mobile Portrait (< 640px)
      if (vw < 640) {
        return {
          height: '300px', // Fixed height for consistency
          fontSize: { base: 10, label: 8, title: 10, legend: 9 },
          symbolSize: 2,
          padding: { chart: '2', gap: '2' },
          grid: {
            left: '12%',
            right: '18%',
            bottom: '18%',
            top: '18%'
          },
          toolbox: { right: 5, top: 5, itemSize: 12 }
        };
      }
      // Tablet (640px - 1024px)
      if (vw < 1024) {
        return {
          height: Math.min(vh * 0.40, 360) + 'px',
          fontSize: { base: 11, label: 10, title: 12, legend: 11 },
          symbolSize: 3,
          padding: { chart: '3', gap: '3' },
          grid: {
            left: '10%',
            right: '16%',
            bottom: '20%',
            top: '16%'
          },
          toolbox: { right: 10, top: 10, itemSize: 14 }
        };
      }
      // Desktop (1024px - 1280px)
      if (vw < 1280) {
        return {
          height: Math.min(vh * 0.45, 400) + 'px',
          fontSize: { base: 12, label: 11, title: 13, legend: 12 },
          symbolSize: 4,
          padding: { chart: '4', gap: '4' },
          grid: {
            left: '8%',
            right: '15%',
            bottom: '22%',
            top: '15%'
          },
          toolbox: { right: 15, top: 15, itemSize: 15 }
        };
      }
      // Large desktop (> 1280px)
      return {
        height: Math.min(vh * 0.50, 450) + 'px',
        fontSize: { base: 13, label: 12, title: 14, legend: 13 },
        symbolSize: 5,
        padding: { chart: '5', gap: '5' },
        grid: {
          left: '8%',
          right: '15%',
          bottom: '22%',
          top: '15%'
        },
        toolbox: { right: 20, top: 15, itemSize: 16 }
      };
    }
    return {
      height: '360px',
      fontSize: { base: 12, label: 11, title: 13, legend: 12 },
      symbolSize: 4,
      padding: { chart: '4', gap: '4' },
      grid: {
        left: '8%',
        right: '15%',
        bottom: '22%',
        top: '15%'
      },
      toolbox: { right: 15, top: 15, itemSize: 15 }
    };
  };
  
  const responsiveConfig = getResponsiveConfig();

  // Chart colors for comparison
  const chamberColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // Helper function to filter invalid sensor data
  const filterValidData = useCallback((chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return chartData;
    
    const filtered = chartData.filter(point => {
      // Remove points where temperature or humidity is 0 (sensor error)
      const isValid = point.temperature !== 0 && point.humidity !== 0;
      return isValid;
    });
    
    const removed = chartData.length - filtered.length;
    if (removed > 0) {
      console.log(`🧹 [SensorChart] Filtered out ${removed} invalid data points (temp=0 or humidity=0)`);
    }
    
    return filtered;
  }, []);

  // Helper function to aggregate/downsample data for better visualization
  const aggregateData = useCallback((chartData: SensorData[], intervalMinutes: number) => {
    if (!chartData || chartData.length === 0) return chartData;
    
    // If data is already small, no need to aggregate
    if (chartData.length <= 100) return chartData;
    
    const intervalMs = intervalMinutes * 60 * 1000;
    const aggregated: SensorData[] = [];
    const groups: { [key: number]: SensorData[] } = {};
    
    // Group data by time intervals
    chartData.forEach(point => {
      const bucketTime = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!groups[bucketTime]) {
        groups[bucketTime] = [];
      }
      groups[bucketTime].push(point);
    });
    
    // Calculate averages for each bucket
    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(bucketTime => {
      const bucket = groups[Number(bucketTime)];
      
      // Filter valid values only for averaging
      const validTemps = bucket.filter(p => p.temperature !== 0).map(p => p.temperature);
      const validHums = bucket.filter(p => p.humidity !== 0).map(p => p.humidity);
      
      // Skip bucket if no valid data
      if (validTemps.length === 0 || validHums.length === 0) return;
      
      const avgTemp = validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length;
      const avgHum = validHums.reduce((sum, h) => sum + h, 0) / validHums.length;
      const avgBattery = bucket.reduce((sum, p) => sum + p.battery, 0) / bucket.length;
      
      // For magnet, use the most common value in the bucket (mode)
      const magnetCounts = bucket.reduce((acc, p) => {
        acc[p.magnet] = (acc[p.magnet] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const magnetMode = Object.entries(magnetCounts).sort((a, b) => b[1] - a[1])[0][0];
      
      aggregated.push({
        timestamp: Number(bucketTime),
        temperature: Number(avgTemp.toFixed(2)),
        humidity: Number(avgHum.toFixed(1)),
        battery: Number(avgBattery.toFixed(2)),
        magnet: Number(magnetMode)
      });
    });
    
    console.log(`📊 [SensorChart] Aggregated ${chartData.length} points to ${aggregated.length} points (${intervalMinutes}min intervals)`);
    return aggregated;
  }, []);

  // Determine aggregation interval based on date range
  const getAggregationInterval = (rangeType: string) => {
    switch (rangeType) {
      case '30min':
      case '1h':
        return 0; // No aggregation
      case '6h':
        return 5; // 5 min intervals
      case '12h':
        return 10; // 10 min intervals
      case '24h':
      case '1d':
        return 10; // 10 min intervals
      case '7d':
        return 60; // 1 hour intervals
      case '30d':
        return 240; // 4 hour intervals
      default:
        return 0;
    }
  };

  // Filter invalid data first, then apply aggregation
  const validData = filterValidData(data);
  const aggregationInterval = getAggregationInterval(dateRange.type);
  const processedData = aggregationInterval > 0 ? aggregateData(validData, aggregationInterval) : validData;

  // Helper function to create door state markAreas
  const createDoorMarkAreas = (chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return [];
    
    const markAreas: any[] = [];
    let openStart: number | null = null;
    
    for (let i = 0; i < chartData.length; i++) {
      const current = chartData[i];
      const isOpen = current.magnet === 0; // 0 = open
      
      if (isOpen && openStart === null) {
        // Start of open period
        openStart = current.timestamp;
      } else if (!isOpen && openStart !== null) {
        // End of open period
        markAreas.push({
          xAxis: openStart,
          xAxisEnd: current.timestamp
        });
        openStart = null;
      }
    }
    
    // Handle case where door is still open at the end
    if (openStart !== null && chartData.length > 0) {
      markAreas.push({
        xAxis: openStart,
        xAxisEnd: chartData[chartData.length - 1].timestamp
      });
    }
    
    return markAreas;
  };

  // Helper function to create door state change markLines
  const createDoorMarkLines = (chartData: SensorData[]) => {
    if (!chartData || chartData.length <= 1) return [];
    
    const markLines: any[] = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const current = chartData[i];
      
      // Detect state change
      if (prev.magnet !== current.magnet) {
        const isOpening = current.magnet === 0;
        markLines.push({
          xAxis: current.timestamp,
          lineStyle: {
            color: isOpening ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)',
            width: 1,
            type: 'dashed'
          },
          label: {
            show: false
          }
        });
      }
    }
    
    return markLines;
  };

  // Create comparison chart option
  const createComparisonChartOption = (dataKey: 'temperature' | 'humidity') => {
    const series: any[] = [];
    const legendData: string[] = [];
    
    console.log(`📊 [SensorChart] Creating comparison chart for ${dataKey}`);
    console.log(`📊 [SensorChart] Main data length: ${data.length}`);
    console.log(`📊 [SensorChart] Comparison data:`, Object.keys(comparisonData).map(id => ({
      id,
      name: availableChambers.find(c => c.id === id)?.name,
      dataLength: comparisonData[id]?.length || 0
    })));
    
    // Add main sensor data
    if (processedData.length > 0) {
      const doorMarkAreas = createDoorMarkAreas(processedData);
      
      series.push({
        name: sensorName,
        type: 'line',
        data: processedData.map(d => [d.timestamp, d[dataKey], d.magnet]),
        smooth: true,
        lineStyle: { width: 3, color: chamberColors[0] },
        itemStyle: { color: chamberColors[0] },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize,
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(239, 68, 68, 0.08)', // Red for door open
            borderWidth: 0
          },
          label: {
            show: false
          },
          data: doorMarkAreas.map(area => [
            { xAxis: area.xAxis },
            { xAxis: area.xAxisEnd }
          ])
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: createDoorMarkLines(processedData)
        }
      });
      legendData.push(sensorName);
      console.log(`✅ [SensorChart] Added main sensor: ${sensorName} with ${doorMarkAreas.length} door open periods`);
    }
    
    // Add comparison chamber data
    Object.entries(comparisonData).forEach(([chamberId, chamberData], index) => {
      if (chamberData && chamberData.length > 0) {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber ? chamber.name : `Chamber ${chamberId}`;
        const colorIndex = (index + 1) % chamberColors.length;
        
        series.push({
          name: chamberName,
          type: 'line',
          data: chamberData.map(d => [d.timestamp, d[dataKey], d.magnet]),
          smooth: true,
          lineStyle: { width: 2, color: chamberColors[colorIndex], type: 'dashed' },
          itemStyle: { color: chamberColors[colorIndex] },
          symbol: 'circle',
          symbolSize: responsiveConfig.symbolSize - 1,
        });
        legendData.push(chamberName);
        console.log(`✅ [SensorChart] Added comparison chamber: ${chamberName} (${chamberData.length} points)`);
      }
    });
    
    console.log(`📊 [SensorChart] Total series: ${series.length}, Legend: ${legendData.join(', ')}`);
    
 
  
    
    return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        fillerColor: 'rgba(59, 130, 246, 0.2)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#3B82F6',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(59, 130, 246, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(59, 130, 246, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Smart positioning for mobile and desktop
        const isMobile = window.innerWidth < 640;
        const x = point[0] - size.contentSize[0] / 2;
        const y = isMobile ? '5%' : '10%';
        return [x, y];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: '#1F2937',
        fontSize: responsiveConfig.fontSize.base
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px; backdrop-filter: blur(8px);',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        
        let tooltipHtml = '<div>';
        
        // Time at the top
        const date = new Date(params[0].data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        tooltipHtml += `<div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>`;
        
        params.forEach((param: any) => {
          // Skip door status series in tooltip
          if (param.seriesName === 'État Porte') return;
          
          const value = param.data[1].toFixed(dataKey === 'temperature' ? 1 : 0);
          const unit = dataKey === 'temperature' ? '°C' : '%';
          
          tooltipHtml += `
            <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; min-width: 180px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">${param.seriesName}</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}${unit}</strong>
            </div>
          `;
        });
        
        // Add door status
        if (params[0] && params[0].data[2] !== undefined) {
          const doorStatus = params[0].data[2] === 1 ? '🔒 Fermée' : '  Ouverte';
          const doorColor = params[0].data[2] === 1 ? '#10B981' : '#EF4444';
          tooltipHtml += `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E5E7EB;">
              <span style="color: ${doorColor}; font-size: 12px; font-weight: 500;">${doorStatus}</span>
            </div>
          `;
        }
        
        tooltipHtml += '</div>';
        return tooltipHtml;
      }
    },
      legend: {
        data: legendData,
        top: 10,
        textStyle: { fontSize: responsiveConfig.fontSize.legend }
      },
    grid: [
      {
        left: responsiveConfig.grid.left,
        right: responsiveConfig.grid.right,
        bottom: responsiveConfig.grid.bottom,
        top: '20%',
        containLabel: true
      },
      {
        left: responsiveConfig.grid.left,
        right: responsiveConfig.grid.right,
        bottom: '5%',
        top: '88%',
        containLabel: true
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: dataKey === 'temperature' ? 'Température (°C)' : 'Humidité (%)',
        nameTextStyle: { 
          color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6' } },
        axisLabel: {
          color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: dataKey === 'temperature' ? '{value}°C' : '{value}%'
        },
        splitLine: { lineStyle: { color: dataKey === 'temperature' ? '#FEE2E2' : '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1, 
        nameTextStyle: { 
          color: '#6B7280', 
          fontSize: responsiveConfig.fontSize.label 
        },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? '🔒' : ' ';
          }
        },
        splitLine: { show: false }
      }
    ],
      series: series
    };
  };

  // Temperature chart configuration
  console.log(`📊 [SensorChart] Creating temperature chart with ${processedData.length} data points (original: ${data.length})`);
  if (processedData.length > 0) {
    console.log(`🚪 [SensorChart] Door status data for chart:`, processedData.slice(0, 5).map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString(),
      magnet: d.magnet
    })));
  }
  
  const temperatureChartOption = comparisonMode ? createComparisonChartOption('temperature') : {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(254, 226, 226, 0.6)',
        fillerColor: 'rgba(239, 68, 68, 0.25)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#EF4444',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(239, 68, 68, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(239, 68, 68, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Position tooltip at top for better visibility
        return [point[0] - size.contentSize[0] / 2, '10%'];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#1F2937',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        const value = point.data[1].toFixed(1);
        const doorStatus = point.data[2] === 1 ? '🔒 Fermée' : '  Ouverte';
        const doorColor = point.data[2] === 1 ? '#10B981' : '#EF4444';
        
        return `
          <div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; min-width: 180px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: #EF4444; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">Température</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}°C</strong>
            </div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E5E7EB;">
              <span style="color: ${doorColor}; font-size: 12px; font-weight: 500;">${doorStatus}</span>
            </div>
          </div>
        `;
      }
    },
    grid: [
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: responsiveConfig.grid.bottom, 
        top: responsiveConfig.grid.top, 
        containLabel: true 
      },
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: '5%', 
        top: '88%', 
        containLabel: true 
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Température (°C)',
        nameTextStyle: { 
          color: '#EF4444',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: '#EF4444' } },
        axisLabel: { 
          color: '#EF4444', 
          fontSize: responsiveConfig.fontSize.label,
          formatter: '{value}°C' 
        },
        splitLine: { lineStyle: { color: '#FEE2E2' } }
      },
      {
        type: 'value',
        gridIndex: 1,  
        interval: 1, 
      },
      {
        type: 'value',
        gridIndex: 0,
        name: 'Porte',
        nameTextStyle: { 
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label
        },
        position: 'right',
        min: 0,
        max: 1,
        interval: 0.5,
        axisLine: { lineStyle: { color: '#8B5CF6' } },
        axisLabel: {
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? 'Fermé' : value === 0 ? 'Ouvert' : '';
          }
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Température',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: processedData.map(d => [d.timestamp, d.temperature, d.magnet]),
        smooth: true,
        lineStyle: { width: 3, color: '#EF4444' },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize,
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(220, 38, 38, 0.12)', // Stronger red for door open
            borderWidth: 1,
            borderColor: 'rgba(220, 38, 38, 0.2)'
          },
          label: {
            show: false
          },
          data: createDoorMarkAreas(processedData).map(area => [
            { 
              xAxis: area.xAxis,
              name: 'Porte Ouverte'
            },
            { xAxis: area.xAxisEnd }
          ])
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: createDoorMarkLines(processedData)
        }
      },
      {
        name: 'État Porte',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 2,
        data: processedData.map(d => [d.timestamp, d.magnet]),
        step: 'end',
        lineStyle: { 
          width: 2, 
          color: '#8B5CF6',
          type: 'solid'
        },
        itemStyle: { color: '#8B5CF6' },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(231, 246, 92, 0.2)' },
              { offset: 1, color: 'rgba(138, 92, 246, 0)' }
            ]
          }
        }
      },
      {
        name: 'État Porte',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: processedData.map(d => {
          const doorData = [d.timestamp, d.magnet];
          return doorData;
        }),
        itemStyle: {
          color: function(params: any) {
            // 1 = Closed (Green), 0 = Open (Red)
            return params.data[1] === 1 
              ? {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: '#10B981' },  // Green-500
                    { offset: 1, color: '#059669' }   // Green-600
                  ]
                }
              : {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: '#EF4444' },  // Red-500
                    { offset: 1, color: '#DC2626' }   // Red-600
                  ]
                };
          },
          borderRadius: [2, 2, 0, 0],
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 2,
          shadowOffsetY: 1
        },
        barWidth: '100%',
        barGap: '-100%',
        emphasis: {
          itemStyle: {
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowBlur: 5,
            shadowOffsetY: 2
          }
        }
      }
    ]
  };
  
  console.log(`🚪 [SensorChart] Temperature chart series count: ${temperatureChartOption.series.length}`);
  console.log(`🚪 [SensorChart] Door status series data points: ${processedData.length}`);

  // Humidity chart configuration
  const humidityChartOption = comparisonMode ? createComparisonChartOption('humidity') : {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(219, 234, 254, 0.6)',
        fillerColor: 'rgba(59, 130, 246, 0.25)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#3B82F6',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(59, 130, 246, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(59, 130, 246, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Position tooltip at top for better visibility
        return [point[0] - size.contentSize[0] / 2, '10%'];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#1F2937',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        const value = point.data[1].toFixed(0);
        const doorStatus = point.data[2] === 1 ? '🔒 Fermée' : '  Ouverte';
        const doorColor = point.data[2] === 1 ? '#10B981' : '#EF4444';
        
        return `
          <div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; min-width: 180px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: #3B82F6; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">Humidité</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}%</strong>
            </div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E5E7EB;">
              <span style="color: ${doorColor}; font-size: 12px; font-weight: 500;">${doorStatus}</span>
            </div>
          </div>
        `;
      }
    },
    grid: [
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: responsiveConfig.grid.bottom, 
        top: responsiveConfig.grid.top, 
        containLabel: true 
      },
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: '5%', 
        top: '88%', 
        containLabel: true 
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Humidité (%)',
        nameTextStyle: { 
          color: '#3B82F6',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: '#3B82F6' } },
        axisLabel: { 
          color: '#3B82F6', 
          fontSize: responsiveConfig.fontSize.label,
          formatter: '{value}%' 
        },
        splitLine: { lineStyle: { color: '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Porte',
        nameTextStyle: { 
          color: '#6B7280', 
          fontSize: responsiveConfig.fontSize.label 
        },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        splitLine: { show: false }
      },
      {
        type: 'value',
        gridIndex: 0,
        name: 'Porte',
        nameTextStyle: { 
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label
        },
        position: 'right',
        min: 0,
        max: 1,
        interval: 0.5,
        axisLine: { lineStyle: { color: '#8B5CF6' } },
        axisLabel: {
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? 'Fermé' : value === 0 ? 'Ouvert' : '';
          }
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Humidité',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: processedData.map(d => [d.timestamp, d.humidity, d.magnet]),
        smooth: true,
        lineStyle: { width: 3, color: '#3B82F6' },
        itemStyle: { color: '#3B82F6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize,
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(220, 38, 38, 0.12)', // Red for door open
            borderWidth: 1,
            borderColor: 'rgba(220, 38, 38, 0.2)'
          },
          label: {
            show: false
          },
          data: createDoorMarkAreas(processedData).map(area => [
            { 
              xAxis: area.xAxis,
              name: 'Porte Ouverte'
            },
            { xAxis: area.xAxisEnd }
          ])
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: createDoorMarkLines(processedData)
        }
      },
      {
        name: 'État Porte',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 2,
        data: processedData.map(d => [d.timestamp, d.magnet]),
        step: 'end',
        lineStyle: { 
          width: 2, 
          color: '#8B5CF6',
          type: 'solid'
        },
        itemStyle: { color: '#8B5CF6' },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(92, 246, 92, 0.2)' },
              { offset: 1, color: 'rgba(138, 92, 246, 0)' }
            ]
          }
        }
      },
      {
        name: 'État Porte',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: processedData.map(d => [d.timestamp, d.magnet]),
        itemStyle: {
          color: function(params: any) {
            // 1 = Closed (Green), 0 = Open (Red)
            return params.data[1] === 1 
              ? {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: '#10B981' },  // Green-500
                    { offset: 1, color: '#059669' }   // Green-600
                  ]
                }
              : {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: '#EF4444' },  // Red-500
                    { offset: 1, color: '#DC2626' }   // Red-600
                  ]
                };
          },
          borderRadius: [2, 2, 0, 0],
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 2,
          shadowOffsetY: 1
        },
        barWidth: '100%',
        barGap: '-100%',
        emphasis: {
          itemStyle: {
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowBlur: 5,
            shadowOffsetY: 2
          }
        }
      }
    ]
  };

  // Effects
  useEffect(() => {
    if (isOpen && !isLiveMode) {
      console.log('🚀 [SensorChart] Modal opened, fetching data for sensor:', sensorId);
      fetchSensorData(false);
    }
  }, [isOpen, sensorId, dateRange, fetchSensorData, isLiveMode]);

  // Handle window resize for responsive charts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      setChartKey(prev => prev + 1);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // DON'T auto-enable comparison mode - let user enable it manually
  // This prevents extra API requests on modal open
  // Comparison mode only activates when user clicks the "Comparer" button

  console.log('🔍 [SensorChart] Render check - isOpen:', isOpen, 'sensorName:', sensorName);
  
  if (!isOpen) {
    console.log('❌ [SensorChart] Modal closed, not rendering');
    return null;
  }

  console.log('✅ [SensorChart] Modal open, rendering chart');
  
  const chartHeight = responsiveConfig.height;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center sm:items-start justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-white to-gray-50/80 rounded-none sm:rounded-2xl shadow-2xl max-w-7xl w-full h-full sm:h-auto sm:min-h-0 sm:max-h-[92vh] overflow-hidden mx-0 sm:mx-auto my-0 sm:my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100/60 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 tracking-tight">Analyse des Données</h2>
              <p className="text-xs text-gray-500 font-medium truncate">{sensorName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Live/Historical Toggle */}
            <button
              onClick={() => {
                setIsLiveMode(!isLiveMode);
                if (isLiveMode) {
                  console.log('🔄 [SensorChart] Switching to historical mode');
                } else {
                  console.log('🔄 [SensorChart] Switching to live mode');
                }
              }}
              className={`px-3 py-1.5 rounded-full flex items-center space-x-1.5 transition-all duration-200 flex-shrink-0 ${
                isLiveMode 
                  ? 'bg-green-500 text-white shadow-sm hover:bg-green-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
              title={isLiveMode ? "Mode temps réel actif" : "Activer le mode temps réel"}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium">
                {isLiveMode ? 'Live' : 'Live'}
              </span>
            </button>

            {/* Refresh Button (only in historical mode) */}
            {!isLiveMode && (
              <button
                onClick={() => fetchSensorData(true)}
                disabled={loading}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  loading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                }`}
                title="Actualiser les données"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            )}

            {/* Comparison Mode Toggle */}
            {availableChambers.length > 1 && (
            <button
              onClick={() => {
                  setComparisonMode(!comparisonMode);
                  if (!comparisonMode) {
                    fetchAllChambersData();
                } else {
                    setComparisonData({});
                }
              }}
              className={`px-3 py-1.5 rounded-full flex items-center space-x-1.5 transition-all duration-200 flex-shrink-0 ${
                  comparisonMode 
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
                title={comparisonMode ? "Désactiver le mode comparaison" : "Comparer avec d'autres chambres"}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              <span className="text-xs font-medium">
                  {comparisonMode ? 'Comparaison' : 'Comparer'}
              </span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100/80 hover:bg-gray-200/80 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 border border-gray-200/60"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin">
          {/* Date Range Selector */}
          <div className="mb-2 sm:mb-4 lg:mb-6 p-2 sm:p-3 lg:p-5 bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 shadow-lg shadow-black/5">
            <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                  <div className="flex justify-center flex-wrap gap-1 sm:gap-1.5 w-full">
                <button
                  onClick={setLast30Minutes}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('30min')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  30min
                </button>
                <button
                  onClick={() => setQuickRange(1, '24h')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('24h')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setQuickRange(7, '7d')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('7d')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  7j
                </button>
                <button
                  onClick={() => setQuickRange(30, '30d')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('30d')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  30j
                </button>
                  </div>
            </div>
          </div>

          {/* KPI Cards - Compact Version */}
          {kpis && !comparisonMode && (
            <div className="mb-3 sm:mb-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {/* Average Temperature KPI */}
                <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-red-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-red-600/70 uppercase tracking-tight truncate">Temp. Moy</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-red-700">{kpis.avgTemp.toFixed(1)}</p>
                        <span className="text-[10px] text-red-600">°C</span>
                      </div>
                      <p className="text-[8px] text-red-600/60 mt-0.5">{kpis.minTemp.toFixed(1)}° – {kpis.maxTemp.toFixed(1)}°</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-red-200/40">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-red-600/70">Zone 0-4°C</span>
                      <span className="text-[8px] font-bold text-red-700">{kpis.tempRangePercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-red-200/30 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          kpis.tempRangePercent >= 90 ? 'bg-green-500' : 
                          kpis.tempRangePercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(kpis.tempRangePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Temperature Stability KPI */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-orange-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-orange-600/70 uppercase tracking-tight truncate">Stabilité T°</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-orange-700">±{kpis.tempStability.toFixed(2)}</p>
                        <span className="text-[10px] text-orange-600">°C</span>
                      </div>
                      <p className="text-[8px] text-orange-600/60 mt-0.5">Écart-type (σ)</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-orange-200/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${
                          kpis.tempStability < 0.5 ? 'bg-green-500' : 
                          kpis.tempStability < 1.0 ? 'bg-yellow-500' : 'bg-red-500'
                        } animate-pulse`}></div>
                        <span className={`text-[8px] font-medium ${
                          kpis.tempStability < 0.5 ? 'text-green-600' : 
                          kpis.tempStability < 1.0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {kpis.tempStability < 0.5 ? 'Excellent' : kpis.tempStability < 1.0 ? 'Bon' : 'Instable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Average Humidity KPI */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-blue-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-blue-600/70 uppercase tracking-tight truncate">Humidité Moy</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-blue-700">{kpis.avgHumidity.toFixed(1)}</p>
                        <span className="text-[10px] text-blue-600">%</span>
                      </div>
                      <p className="text-[8px] text-blue-600/60 mt-0.5">{kpis.minHum.toFixed(0)}% – {kpis.maxHum.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-blue-200/40">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-blue-600/70">90-95%</span>
                      <span className="text-[8px] font-bold text-blue-700">{kpis.humRangePercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-blue-200/30 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          kpis.humRangePercent >= 90 ? 'bg-green-500' : 
                          kpis.humRangePercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(kpis.humRangePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Humidity Stability KPI */}
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-cyan-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-cyan-600/70 uppercase tracking-tight truncate">Stabilité H%</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-cyan-700">±{kpis.humStability.toFixed(2)}</p>
                        <span className="text-[10px] text-cyan-600">%</span>
                      </div>
                      <p className="text-[8px] text-cyan-600/60 mt-0.5">Écart-type (σ)</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-cyan-200/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${
                          kpis.humStability < 2.0 ? 'bg-green-500' : 
                          kpis.humStability < 4.0 ? 'bg-yellow-500' : 'bg-red-500'
                        } animate-pulse`}></div>
                        <span className={`text-[8px] font-medium ${
                          kpis.humStability < 2.0 ? 'text-green-600' : 
                          kpis.humStability < 4.0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {kpis.humStability < 2.0 ? 'Excellent' : kpis.humStability < 4.0 ? 'Bon' : 'Instable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Status */}
          {comparisonMode && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-5 bg-blue-50 rounded-3xl border border-blue-200">
                      <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Mode Comparaison Activé</span>
                            </div>
                {comparisonLoading && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Chargement...</span>
                                  </div>
                                )}
                              </div>
                                  </div>
                                )}

          {/* Charts */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-${responsiveConfig.padding.gap}`}>
            {/* Temperature Chart */}
            <div className={`bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl border border-gray-200/60 p-${responsiveConfig.padding.chart} shadow-lg hover:shadow-xl transition-all duration-300`}>
              <div className="mb-1.5 sm:mb-2 lg:mb-3 flex items-center justify-between">
             {/*    <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Température
                </h3> */}
                {processedData.length > 0 && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    {processedData.length} points
                    {aggregationInterval > 0 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({aggregationInterval}min)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <ReactECharts 
                key={`temp-${sensorId}-${dateRange.type}-${comparisonMode}`}
                option={temperatureChartOption} 
                style={{ height: chartHeight, width: '100%' }}
                opts={{ renderer: 'canvas', locale: 'FR' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>

            {/* Humidity Chart */}
            <div className={`bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl border border-gray-200/60 p-${responsiveConfig.padding.chart} shadow-lg hover:shadow-xl transition-all duration-300`}>
              <div className="mb-1.5 sm:mb-2 lg:mb-3 flex items-center justify-between">
{/*                 <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Humidité
                </h3> */}
                {processedData.length > 0 && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    {processedData.length} points
                    {aggregationInterval > 0 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({aggregationInterval}min)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <ReactECharts 
                key={`hum-${sensorId}-${dateRange.type}-${comparisonMode}`}
                option={humidityChartOption} 
                style={{ height: chartHeight, width: '100%' }}
                opts={{ renderer: 'canvas', locale: 'FR' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Chargement des données...</span>
                </div>
              </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!loading && !error && data.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-gray-400 mb-2">📊</div>
                <p className="text-sm text-gray-600">Aucune donnée disponible</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorChart;