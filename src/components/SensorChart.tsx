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

const SensorChart: React.FC<SensorChartProps> = ({ sensorId, sensorName, boitieDeviceId, isOpen, onClose, availableChambers = [] }) => {
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
      
      // Use /messages endpoint for historical data with reasonable limit
      // This single request will have temperature, humidity, battery, magnet, beacons - everything!
      const apiUrl = `https://flespi.io/gw/devices/${deviceId}/messages?limit=200`;
      
      console.log(`🌐 [SensorChart] 🚀 SINGLE API REQUEST for ALL data:`, apiUrl);
      console.log(`📊 [SensorChart] This ONE request will contain temp, humidity, battery, magnet, beacons for ALL channels`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [SensorChart] API Error ${response.status}:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const rawData = await response.json();
      console.log(`📊 [SensorChart] API Response:`, rawData);
      console.log(`📊 [SensorChart] Received ${rawData.result?.length || 0} messages`);
      
      // Print complete JSON data for debugging
      console.log(`🔍 [SensorChart] COMPLETE JSON DATA:`, JSON.stringify(rawData, null, 2));
      
      // Print first few messages in detail
      if (rawData.result && rawData.result.length > 0) {
        console.log(`🔍 [SensorChart] FIRST 3 MESSAGES DETAIL:`, JSON.stringify(rawData.result.slice(0, 3), null, 2));
        
        // Check for beacon data in first few messages
        const messagesWithBeacons = rawData.result.slice(0, 10).filter((msg: any) => msg['ble.beacons']);
        if (messagesWithBeacons.length > 0) {
          console.log(`🔍 [SensorChart] BEACON DATA FOUND:`, JSON.stringify(messagesWithBeacons[0]['ble.beacons'], null, 2));
        }
      }
      
      if (!rawData.result || rawData.result.length === 0) {
        console.warn('⚠️ [SensorChart] No messages in API response!');
        setData([]);
        setLoading(false);
        return;
      }
      
      console.log(`📊 [SensorChart] First message sample:`, rawData.result[0]);
      console.log(`📊 [SensorChart] Available keys in first message:`, Object.keys(rawData.result[0]));
      console.log(`📊 [SensorChart] Channel number for processing:`, channelNumber);
      
      // Show real data values being processed
      if (rawData.result.length > 0) {
        const firstMessage = rawData.result[0];
        console.log(`🔍 [SensorChart] REAL DATA from API:`);
        console.log(`   - Timestamp: ${new Date(firstMessage.timestamp * 1000).toLocaleString()}`);
        console.log(`   - Temperature CH${channelNumber}: ${firstMessage[`ble.sensor.temperature.${channelNumber}`]}`);
        console.log(`   - Humidity CH${channelNumber}: ${firstMessage[`ble.sensor.humidity.${channelNumber}`]}`);
        console.log(`   - Battery CH${channelNumber}: ${firstMessage[`ble.sensor.battery.voltage.${channelNumber}`]}`);
        console.log(`   - Magnet CH${channelNumber}: ${firstMessage[`ble.sensor.magnet.status.${channelNumber}`]}`);
        console.log(`   - Has beacons: ${!!firstMessage['ble.beacons']}`);
      }
      
      // Process messages using the processChamberData function
      const processedData = processChamberData(rawData.result, channelNumber || 1);
      
      setData(processedData);
      console.log(`✅ [SensorChart] Processed ${processedData.length} data points from ${rawData.result.length} messages`);
      if (processedData.length > 0) {
        console.log(`📊 [SensorChart] FINAL DATA for chart display:`, processedData[0]);
        console.log(`🔍 [SensorChart] Chart will show REAL data:`);
        console.log(`   - Time: ${new Date(processedData[0].timestamp).toLocaleString()}`);
        console.log(`   - Temperature: ${processedData[0].temperature}°C`);
        console.log(`   - Humidity: ${processedData[0].humidity}%`);
        console.log(`   - Battery: ${processedData[0].battery}V`);
        console.log(`   - Door: ${processedData[0].magnet === 1 ? 'CLOSED' : 'OPEN'}`);
      } else {
        console.warn('⚠️ [SensorChart] No data points were processed! Check channel number and data format');
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

  // Chart colors for comparison
  const chamberColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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
    if (data.length > 0) {
      series.push({
        name: sensorName,
        type: 'line',
        data: data.map(d => [d.timestamp, d[dataKey], d.magnet]),
        smooth: true,
        lineStyle: { width: 3, color: chamberColors[0] },
        itemStyle: { color: chamberColors[0] },
        symbol: 'circle',
        symbolSize: 4,
      });
      legendData.push(sensorName);
      console.log(`✅ [SensorChart] Added main sensor: ${sensorName}`);
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
          symbolSize: 3,
        });
        legendData.push(chamberName);
        console.log(`✅ [SensorChart] Added comparison chamber: ${chamberName} (${chamberData.length} points)`);
      }
    });
    
    console.log(`📊 [SensorChart] Total series: ${series.length}, Legend: ${legendData.join(', ')}`);
    
    // Add door status bar for main sensor
    const doorStatusSeries = data.length > 0 ? {
      name: 'État Porte',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map(d => [d.timestamp, d.magnet]),
      itemStyle: {
        color: function(params: any) {
          return params.data[1] === 1 ? '#10B981' : '#EF4444';
        }
      },
      barWidth: '100%',
      barGap: '-100%'
    } : null;
    
    if (doorStatusSeries) {
      series.push(doorStatusSeries);
    }
    
    return {
    backgroundColor: 'transparent',
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom temporel',
            back: 'Restaurer zoom'
          }
        },
        restore: {
          title: 'Restaurer'
        },
        saveAsImage: {
          title: 'Sauvegarder'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
        handleSize: '80%',
        handleStyle: {
          color: '#fff',
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.6)',
          shadowOffsetX: 2,
          shadowOffsetY: 2
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
        axisPointer: { type: 'cross' },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        
          let tooltipHtml = '<div style="padding: 8px;">';
          tooltipHtml += `<div style="font-weight: bold; margin-bottom: 6px;">${dataKey === 'temperature' ? 'Température' : 'Humidité'}</div>`;
          
          params.forEach((param: any) => {
            // Skip door status series in tooltip
            if (param.seriesName === 'État Porte') return;
            
            const value = param.data[1].toFixed(dataKey === 'temperature' ? 1 : 0);
            const unit = dataKey === 'temperature' ? '°C' : '%';
            
            tooltipHtml += `
              <div style="margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${param.color}; border-radius: 50%; margin-right: 6px;"></span>
                <strong>${param.seriesName}:</strong> ${value}${unit}
          </div>
        `;
          });
          
          // Add door status at the end
          if (params[0] && params[0].data[2] !== undefined) {
            const doorStatus = params[0].data[2] === 1 ? '🔒 Fermée' : '🔓 Ouverte';
            tooltipHtml += `<div style="font-size: 12px; color: #6B7280; margin-top: 4px;">Porte: ${doorStatus}</div>`;
          }
          
          const date = new Date(params[0].data[0]);
          const time = date.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          tooltipHtml += `<div style="font-size: 12px; color: #6B7280;">${time}</div>`;
          
          tooltipHtml += '</div>';
          return tooltipHtml;
      }
    },
      legend: {
        data: legendData,
        top: 10,
        textStyle: { fontSize: 12 }
      },
    grid: [
      {
        left: '5%',
        right: '5%',
        bottom: '30%',
        top: '20%',
        containLabel: true
      },
      {
        left: '5%',
        right: '5%',
        bottom: '5%',
        top: '85%',
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
          fontSize: 10,
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
        nameTextStyle: { color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6' },
        axisLine: { lineStyle: { color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6' } },
        axisLabel: {
          color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6',
          formatter: dataKey === 'temperature' ? '{value}°C' : '{value}%'
        },
        splitLine: { lineStyle: { color: dataKey === 'temperature' ? '#FEE2E2' : '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Porte',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 9,
          formatter: function(value: number) {
            return value === 1 ? '🔒' : '🔓';
          }
        },
        splitLine: { show: false }
      }
    ],
      series: series
    };
  };

  // Temperature chart configuration
  console.log(`📊 [SensorChart] Creating temperature chart with ${data.length} data points`);
  if (data.length > 0) {
    console.log(`🚪 [SensorChart] Door status data for chart:`, data.slice(0, 5).map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString(),
      magnet: d.magnet
    })));
  }
  
  const temperatureChartOption = comparisonMode ? createComparisonChartOption('temperature') : {
    backgroundColor: 'transparent',
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom temporel',
            back: 'Restaurer zoom'
          }
        },
        restore: {
          title: 'Restaurer'
        },
        saveAsImage: {
          title: 'Sauvegarder'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
        handleSize: '80%',
        handleStyle: {
          color: '#fff',
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.6)',
          shadowOffsetX: 2,
          shadowOffsetY: 2
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const value = point.data[1].toFixed(1);
        const doorStatus = point.data[2] === 1 ? '🔒 Fermée' : '🔓 Ouverte';
        return `<div style="padding: 8px;"><strong>Température: ${value}°C</strong><br/>${time}<br/>Porte: ${doorStatus}</div>`;
      }
    },
    grid: [
      { left: '5%', right: '5%', bottom: '30%', top: '12%', containLabel: true },
      { left: '5%', right: '5%', bottom: '5%', top: '85%', containLabel: true }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
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
        nameTextStyle: { color: '#EF4444' },
        axisLine: { lineStyle: { color: '#EF4444' } },
        axisLabel: { color: '#EF4444', formatter: '{value}°C' },
        splitLine: { lineStyle: { color: '#FEE2E2' } }
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Porte',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 9,
          formatter: function(value: number) {
            return value === 1 ? '🔒' : '🔓';
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
        data: data.map(d => [d.timestamp, d.temperature, d.magnet]),
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
        symbolSize: 4,
      },
      {
        name: 'État Porte',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.map(d => {
          const doorData = [d.timestamp, d.magnet];
          return doorData;
        }),
        itemStyle: {
          color: function(params: any) {
            return params.data[1] === 1 ? '#10B981' : '#EF4444';
          }
        },
        barWidth: '100%',
        barGap: '-100%'
      }
    ]
  };
  
  console.log(`🚪 [SensorChart] Temperature chart series count: ${temperatureChartOption.series.length}`);
  console.log(`🚪 [SensorChart] Door status series data points: ${data.length}`);

  // Humidity chart configuration
  const humidityChartOption = comparisonMode ? createComparisonChartOption('humidity') : {
    backgroundColor: 'transparent',
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom temporel',
            back: 'Restaurer zoom'
          }
        },
        restore: {
          title: 'Restaurer'
        },
        saveAsImage: {
          title: 'Sauvegarder'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
        handleSize: '80%',
        handleStyle: {
          color: '#fff',
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.6)',
          shadowOffsetX: 2,
          shadowOffsetY: 2
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const value = point.data[1].toFixed(0);
        const doorStatus = point.data[2] === 1 ? '🔒 Fermée' : '🔓 Ouverte';
        return `<div style="padding: 8px;"><strong>Humidité: ${value}%</strong><br/>${time}<br/>Porte: ${doorStatus}</div>`;
      }
    },
    grid: [
      { left: '5%', right: '5%', bottom: '30%', top: '12%', containLabel: true },
      { left: '5%', right: '5%', bottom: '5%', top: '85%', containLabel: true }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
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
        nameTextStyle: { color: '#3B82F6' },
        axisLine: { lineStyle: { color: '#3B82F6' } },
        axisLabel: { color: '#3B82F6', formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Porte',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 9,
          formatter: function(value: number) {
            return value === 1 ? '🔒' : '🔓';
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
        data: data.map(d => [d.timestamp, d.humidity, d.magnet]),
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
        symbolSize: 4,
      },
      {
        name: 'État Porte',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.map(d => [d.timestamp, d.magnet]),
        itemStyle: {
          color: function(params: any) {
            return params.data[1] === 1 ? '#10B981' : '#EF4444';
          }
        },
        barWidth: '100%',
        barGap: '-100%'
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

  // DON'T auto-enable comparison mode - let user enable it manually
  // This prevents extra API requests on modal open
  // Comparison mode only activates when user clicks the "Comparer" button

  console.log('🔍 [SensorChart] Render check - isOpen:', isOpen, 'sensorName:', sensorName);
  
  if (!isOpen) {
    console.log('❌ [SensorChart] Modal closed, not rendering');
    return null;
  }

  console.log('✅ [SensorChart] Modal open, rendering chart');
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-1 sm:p-4 pt-16 sm:pt-4">
      <div className="bg-white rounded-lg sm:rounded-2xl shadow-2xl max-w-7xl w-full max-h-[85vh] sm:max-h-[90vh] overflow-hidden mx-1 sm:mx-4 flex flex-col mt-4 sm:mt-0">
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
        <div className="flex-1 p-2 sm:p-6 overflow-y-auto min-h-0">
          {/* Date Range Selector */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-5 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl shadow-black/5">
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                  <div className="flex justify-center flex-wrap gap-1 sm:gap-1.5">
                <button
                  onClick={setLast30Minutes}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                    isRangeSelected('30min')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  30min
                </button>
                <button
                  onClick={() => setQuickRange(1, '24h')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                    isRangeSelected('24h')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setQuickRange(7, '7d')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                    isRangeSelected('7d')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  7j
                </button>
                <button
                  onClick={() => setQuickRange(30, '30d')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-6">
                {/* Temperature Chart */}
            <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm">
                  <ReactECharts 
                    option={temperatureChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                  />
                </div>

                {/* Humidity Chart */}
            <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm">
                  <ReactECharts 
                    option={humidityChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
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