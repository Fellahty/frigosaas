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
  isOpen: boolean;
  onClose: () => void;
}

const SensorChart: React.FC<SensorChartProps> = ({ sensorId, sensorName, isOpen, onClose }) => {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'basic' | 'kpi'>('basic');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [kpiCalculating, setKpiCalculating] = useState(false);
  const [cachedKPIs, setCachedKPIs] = useState<any>(null);
  
  // Date range state - default to last 30 minutes
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    return {
      start: thirtyMinutesAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min' // Track the selected range type
    };
  });

  // Cache for API responses to avoid unnecessary requests
  const [cache, setCache] = useState<Map<string, { data: SensorData[], timestamp: number }>>(new Map());
  const CACHE_DURATION = 30000; // 30 seconds cache

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

  // Set last 30 minutes
  const setLast30Minutes = () => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    setDateRange({
      start: thirtyMinutesAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min'
    });
  };

  // Helper function to check if a specific range is selected
  const isRangeSelected = (type: string) => {
    return dateRange.type === type;
  };

  // Advanced KPI Calculation Functions for Apple Storage
  const calculateKPIs = useCallback(() => {
    if (data.length === 0) return null;

    // Sort data by timestamp (oldest first for calculations)
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate time range in minutes
    const startTime = sortedData[0].timestamp;
    const endTime = sortedData[sortedData.length - 1].timestamp;
    const totalMinutes = Math.max(1, Math.floor((endTime - startTime) / (1000 * 60)));

    // 1. Heures de maturation pondérées (Q10) - HMP
    // Q10 = 2.2 pour les pommes, température de référence = 0°C
    const Q10 = 2.2;
    const T_ref = 0; // Température de référence pour les pommes
    const RR_ref = Math.pow(Q10, (T_ref - T_ref) / 10); // = 1
    let hmp = 0;
    
    sortedData.forEach(d => {
      const RR_T = Math.pow(Q10, (d.temperature - T_ref) / 10);
      hmp += Math.max(0, RR_T - RR_ref);
    });
    hmp = hmp / totalMinutes * 24; // Convert to per day

    // 2. Indice de dessiccation (VPD) - ID
    // VPD = es * (1 - RH/100) où es = pression de vapeur saturante
    let id = 0;
    sortedData.forEach(d => {
      // Formule de Magnus pour la pression de vapeur saturante
      const es = 0.6108 * Math.exp((17.27 * d.temperature) / (d.temperature + 237.3));
      const vpd = es * (1 - d.humidity / 100);
      // Seuil de 0.1 kPa pour les pommes (plus strict que 0.05)
      id += Math.max(0, vpd - 0.1);
    });
    id = id / totalMinutes * 60; // Convert to kPa·min/h

    // 3. Condensation (point de rosée)
    let condensationEvents = 0;
    let minMargin = Infinity;
    sortedData.forEach(d => {
      // Formule de Magnus pour le point de rosée
      const gamma = (17.62 * d.temperature) / (243.12 + d.temperature) + Math.log(d.humidity / 100);
      const tRosee = (243.12 * gamma) / (17.62 - gamma);
      const marge = d.temperature - tRosee;
      minMargin = Math.min(minMargin, marge);
      // Seuil de 1°C pour les pommes (plus strict que 0.5°C)
      if (marge <= 1.0) condensationEvents++;
    });
    const condensationRate = condensationEvents / totalMinutes * 24 * 60; // Events per day

    // 4. Impact des ouvertures (thermique) - AOT_15
    let aot15 = 0;
    let returnTimes = [];
    let currentOpening = false;
    let openingStart = 0;
    let baseline = 0; // Température de référence pour les pommes

    for (let i = 0; i < sortedData.length; i++) {
      const d = sortedData[i];
      
      if (d.magnet === 0 && !currentOpening) {
        // Door opening starts
        currentOpening = true;
        openingStart = i;
        baseline = d.temperature;
      } else if (d.magnet === 1 && currentOpening) {
        // Door closing
        currentOpening = false;
        const openingDuration = Math.min(15, i - openingStart);
        
        // Calculate AOT_15 - impact thermique cumulé
        for (let j = openingStart; j < Math.min(openingStart + openingDuration, sortedData.length); j++) {
          // Seuil de 2°C pour les pommes
          aot15 += Math.max(0, sortedData[j].temperature - 2);
        }
        
        // Calculate return time to baseline + 0.5°C
        const returnThreshold = Math.max(2, baseline + 0.5);
        let returnTime = 0;
        for (let j = i; j < Math.min(i + 30, sortedData.length); j++) {
          if (sortedData[j].temperature <= returnThreshold) {
            returnTime = j - i;
            break;
          }
        }
        if (returnTime > 0) returnTimes.push(returnTime);
      }
    }

    const medianAOT15 = returnTimes.length > 0 ? 
      returnTimes.sort((a, b) => a - b)[Math.floor(returnTimes.length / 2)] : 0;
    const medianReturn = returnTimes.length > 0 ? 
      returnTimes.sort((a, b) => a - b)[Math.floor(returnTimes.length / 2)] : 0;

    // 5. Stabilité dynamique - P95 des variations
    const tempChanges = [];
    const humidityChanges = [];
    
    for (let i = 1; i < sortedData.length; i++) {
      const timeDiff = (sortedData[i].timestamp - sortedData[i-1].timestamp) / (1000 * 60); // minutes
      if (timeDiff > 0) {
        tempChanges.push(Math.abs(sortedData[i].temperature - sortedData[i-1].temperature) / timeDiff);
        humidityChanges.push(Math.abs(sortedData[i].humidity - sortedData[i-1].humidity) / timeDiff);
      }
    }

    const p95Temp = tempChanges.length > 0 ? 
      tempChanges.sort((a, b) => a - b)[Math.floor(tempChanges.length * 0.95)] : 0;
    const p95Humidity = humidityChanges.length > 0 ? 
      humidityChanges.sort((a, b) => a - b)[Math.floor(humidityChanges.length * 0.95)] : 0;

    // 6. Conformité fine aux consignes pour pommes
    // Température: 0-2°C, Humidité: 90-95%
    let maxOutOfRangeSequence = 0;
    let currentSequence = 0;
    
    sortedData.forEach(d => {
      const outOfRange = d.temperature < 0 || d.temperature > 2 || d.humidity < 90 || d.humidity > 95;
      if (outOfRange) {
        currentSequence++;
        maxOutOfRangeSequence = Math.max(maxOutOfRangeSequence, currentSequence);
      } else {
        currentSequence = 0;
      }
    });

    return {
      hmp: Math.round(hmp * 100) / 100,
      id: Math.round(id * 100) / 100,
      condensationEvents: Math.round(condensationRate * 10) / 10,
      minMargin: Math.round(minMargin * 10) / 10,
      aot15: Math.round(medianAOT15 * 10) / 10,
      returnTime: Math.round(medianReturn * 10) / 10,
      p95Temp: Math.round(p95Temp * 1000) / 1000,
      p95Humidity: Math.round(p95Humidity * 10) / 10,
      maxOutOfRange: maxOutOfRangeSequence,
      totalMinutes,
      dataPoints: sortedData.length
    };
  }, [data]);

  // Calculate KPIs only when switching to KPI view mode
  useEffect(() => {
    if (viewMode === 'kpi' && data.length > 0 && !cachedKPIs) {
      setKpiCalculating(true);
      // Use setTimeout to make calculation non-blocking
      setTimeout(() => {
        const kpis = calculateKPIs();
        setCachedKPIs(kpis);
        setKpiCalculating(false);
      }, 100);
    }
  }, [viewMode, data, cachedKPIs, calculateKPIs]);

  // Clear cached KPIs when data changes
  useEffect(() => {
    setCachedKPIs(null);
  }, [data]);

  const fetchSensorData = useCallback(async (forceRefresh = false) => {
    // Generate cache key based on date range
    const cacheKey = `${dateRange.start}-${dateRange.end}-${dateRange.type}`;
    const now = Date.now();
    
    console.log('🔍 [SensorChart] Starting data fetch...', {
      dateRange,
      cacheKey,
      forceRefresh,
      sensorId
    });
    
    // Check cache first (unless force refresh)
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
      // For all ranges, use messages endpoint to get historical data
      let apiUrl = 'https://flespi.io/gw/devices/6925665/messages';
      
      if (dateRange.type === '30min') {
        // For 30 minutes, get more recent messages
        apiUrl += '?limit=30';
      } else {
        // For time-based ranges, use date filtering
        const startTime = Math.floor(new Date(dateRange.start).getTime() / 1000);
        const endTime = Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000);
        apiUrl += `?filter=timestamp>${startTime}%20and%20timestamp<${endTime}`;
      }

      console.log('🌐 [SensorChart] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      console.log('📊 [SensorChart] Raw API response:', rawData);
      console.log('📊 [SensorChart] Raw data result array length:', rawData.result?.length || 0);
      
      // Optimize data processing with early returns and better filtering
      if (!rawData.result || !Array.isArray(rawData.result)) {
        console.log('❌ [SensorChart] No valid result array in API response');
        setData([]);
        return;
      }

      // Process data more efficiently with single pass
      const uniqueTimestamps = new Map<number, SensorData>();
      
      console.log('🔄 [SensorChart] Processing', rawData.result.length, 'raw data items...');
      
      // Filter messages that have BOTH temperature AND humidity (like Python script)
      let validMessages = rawData.result.filter((item: any) => 
        item['ble.sensor.temperature.1'] !== undefined && 
        item['ble.sensor.humidity.1'] !== undefined
      );

      // For 30min range, filter to last 30 minutes
      if (dateRange.type === '30min') {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
        const thirtyMinutesAgoTimestamp = Math.floor(thirtyMinutesAgo.getTime() / 1000); // Convert to Unix timestamp
        
        validMessages = validMessages.filter((item: any) => {
          const messageTimestamp = item.timestamp; // Already in Unix timestamp format
          return messageTimestamp >= thirtyMinutesAgoTimestamp;
        });
        console.log('📊 [SensorChart] Filtered to last 30 minutes:', validMessages.length, 'messages');
        console.log('📊 [SensorChart] Time range:', {
          now: now.toISOString(),
          thirtyMinutesAgo: thirtyMinutesAgo.toISOString(),
          thirtyMinutesAgoTimestamp
        });
      }
      
      console.log('📊 [SensorChart] Valid messages with both temp & humidity:', validMessages.length, 'out of', rawData.result.length);
      
      if (validMessages.length === 0) {
        console.log('❌ [SensorChart] No messages found with both temperature and humidity data');
        setData([]);
        return;
      }

      // Sort by timestamp to get the newest messages first (like Python script)
      const sortedMessages = validMessages.sort((a: any, b: any) => {
        const timestampA = a.timestamp || 0;
        const timestampB = b.timestamp || 0;
        return timestampB - timestampA; // Newest first
      });

      console.log('🕒 [SensorChart] Sorted messages by timestamp (newest first)');
      console.log('📅 [SensorChart] First message timestamp:', new Date(sortedMessages[0].timestamp * 1000).toISOString());
      console.log('📅 [SensorChart] Last message timestamp:', new Date(sortedMessages[sortedMessages.length - 1].timestamp * 1000).toISOString());
      
      for (let i = 0; i < sortedMessages.length; i++) {
        const item = sortedMessages[i];
        
        // Log first few items for debugging
        if (i < 3) {
          console.log(`📋 [SensorChart] Valid item ${i}:`, item);
        }
        
        const temp = item['ble.sensor.temperature.1'];
        const humidity = item['ble.sensor.humidity.1'];
        const battery = item['battery.voltage'];
        const magnet = item['ble.sensor.magnet.status.1'];
        
        console.log(`🔍 [SensorChart] Item ${i} values:`, {
          temp,
          humidity,
          battery,
          magnet,
          timestamp: item.timestamp
        });
        
        // Both temperature and humidity should be valid now
        if (temp === undefined || humidity === undefined || 
            parseFloat(temp) <= 0 || parseFloat(humidity) <= 0) {
          console.log(`⏭️ [SensorChart] Skipping item ${i} - invalid data:`, { temp, humidity });
          continue;
        }

        // Handle magnet sensor value (can be boolean or number)
        let magnetValue = 0;
        const magnetData = item['ble.sensor.magnet.status.1'];
        if (magnetData !== undefined && magnetData !== null) {
          if (typeof magnetData === 'boolean') {
            magnetValue = magnetData ? 1 : 0;
          } else {
            magnetValue = parseFloat(magnetData) || 0;
          }
        }

         const sensorData: SensorData = {
           timestamp: new Date(item.timestamp * 1000).getTime(),
           temperature: parseFloat(temp),
           humidity: parseFloat(humidity), // Both temp and humidity are guaranteed to exist
           battery: parseFloat(item['battery.voltage']) || 0,
           magnet: magnetValue
         };

        // Handle duplicates during processing
        const existing = uniqueTimestamps.get(sensorData.timestamp);
        if (!existing || sensorData.battery > existing.battery) {
          uniqueTimestamps.set(sensorData.timestamp, sensorData);
        }
      }

       // Convert to array and sort efficiently
       let finalData = Array.from(uniqueTimestamps.values());
       
       // Sort by timestamp descending (newest first) for limit application
       finalData.sort((a, b) => b.timestamp - a.timestamp);

       // Apply limit for 30 minutes option (show last 30 minutes of data)
       if (dateRange.type === '30min') {
         const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
         finalData = finalData.filter(item => item.timestamp >= thirtyMinutesAgo);
       }

       // Final sort for chart display (ascending - oldest to newest for chart)
       finalData.sort((a, b) => a.timestamp - b.timestamp);

       console.log('✅ [SensorChart] Final processed data:', finalData);
       console.log('📈 [SensorChart] Data summary:', {
         totalItems: finalData.length,
         temperatureRange: finalData.length > 0 ? {
           min: Math.min(...finalData.map(d => d.temperature)),
           max: Math.max(...finalData.map(d => d.temperature))
         } : 'N/A',
         humidityRange: finalData.length > 0 ? {
           min: Math.min(...finalData.map(d => d.humidity)),
           max: Math.max(...finalData.map(d => d.humidity))
         } : 'N/A',
         validHumidityCount: finalData.filter(d => d.humidity > 0).length,
         timeRange: finalData.length > 0 ? {
           start: new Date(finalData[0].timestamp).toISOString(),
           end: new Date(finalData[finalData.length - 1].timestamp).toISOString()
         } : 'N/A'
       });

       // Cache the result
       setCache(prev => {
         const newCache = new Map(prev);
         newCache.set(cacheKey, { data: finalData, timestamp: now });
         return newCache;
       });

       setData(finalData);
    } catch (err) {
      console.error('❌ [SensorChart] Error fetching sensor data:', err);
      console.error('❌ [SensorChart] Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('⏰ [SensorChart] Request was aborted (timeout)');
        setError('Request timeout - please try again');
      } else {
        console.log('💥 [SensorChart] Setting error message:', err instanceof Error ? err.message : 'Failed to fetch sensor data');
        setError(err instanceof Error ? err.message : 'Failed to fetch sensor data');
      }
      setData([]);
    } finally {
      console.log('🏁 [SensorChart] Data fetch completed, setting loading to false');
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [cache, dateRange]);

  // Debounced refresh function
  const [refreshTimeout, setRefreshTimeout] = useState<NodeJS.Timeout | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    const timeout = setTimeout(() => {
      fetchSensorData(true);
    }, 300); // 300ms debounce
    setRefreshTimeout(timeout);
  }, [refreshTimeout, fetchSensorData]);

  // Share data function - WhatsApp style PDF
  const handleShareData = useCallback(async () => {
    try {
      if (data.length === 0) {
        console.log('❌ [SensorChart] No data to share');
        return;
      }

      // Create PDF document
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Helper function to add text with auto-wrap
      const addText = (text: string, x: number, y: number, options: any = {}) => {
        const maxWidth = pageWidth - 2 * margin;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * (options.fontSize || 10) * 0.35);
      };

      // Helper function to add a new page if needed
      const checkNewPage = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
      };

      // Colors
      const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
      const successColor: [number, number, number] = [34, 197, 94]; // Green
      const warningColor: [number, number, number] = [245, 158, 11]; // Orange
      const grayColor: [number, number, number] = [107, 114, 128]; // Gray

      // Header with LYAZAMI branding
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // White overlay for better text contrast
      doc.setFillColor(255, 255, 255, 0.1);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // YAZAMI brand title - Centered and prominent
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      const brandText = 'YAZAMI';
      const brandWidth = doc.getTextWidth(brandText);
      doc.text(brandText, (pageWidth - brandWidth) / 2, 18);
      
      // Subtitle - Centered
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const subtitleText = 'SYSTEME DE SURVEILLANCE IoT';
      const subtitleWidth = doc.getTextWidth(subtitleText);
      doc.text(subtitleText, (pageWidth - subtitleWidth) / 2, 25);
      
      // Main report title - Centered
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const reportText = 'Rapport d\'Analyse des Capteurs';
      const reportWidth = doc.getTextWidth(reportText);
      doc.text(reportText, (pageWidth - reportWidth) / 2, 30);
      
      // Sensor name - Centered
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const sensorText = sensorName;
      const sensorWidth = doc.getTextWidth(sensorText);
      doc.text(sensorText, (pageWidth - sensorWidth) / 2, 35);
      
      yPosition = 45;

      // Date and mode section
      const currentDate = new Date().toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      doc.setTextColor(...grayColor);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Genere le ${currentDate}`, margin, yPosition);
      
      // Mode indicator with colored background
      const modeText = isLiveMode ? 'Mode Temps Reel' : 'Mode Historique';
      const modeColor = isLiveMode ? successColor : primaryColor;
      
      doc.setFillColor(...modeColor);
      doc.rect(pageWidth - 80, yPosition - 6, 75, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(modeText, pageWidth - 77, yPosition - 1);
      
      yPosition += 15;

      // Summary section with improved structure
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      yPosition = addText('SYNTHESE DES DONNEES', margin, yPosition + 8, { fontSize: 16 });

      // Add separator line
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      yPosition += 8;

      // Summary data with better formatting
      const dataSummary = {
        totalPoints: data.length,
        temperatureRange: {
          min: Math.min(...data.map(d => d.temperature)).toFixed(1),
          max: Math.max(...data.map(d => d.temperature)).toFixed(1),
          avg: (data.reduce((sum, d) => sum + d.temperature, 0) / data.length).toFixed(1)
        },
        humidityRange: {
          min: Math.min(...data.map(d => d.humidity)).toFixed(1),
          max: Math.max(...data.map(d => d.humidity)).toFixed(1),
          avg: (data.reduce((sum, d) => sum + d.humidity, 0) / data.length).toFixed(1)
        },
        timeRange: {
          start: new Date(data[data.length - 1].timestamp).toLocaleString('fr-FR', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          }),
          end: new Date(data[0].timestamp).toLocaleString('fr-FR', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          })
        }
      };

      // Enhanced summary grid with better layout
      const summaryData = [
        { 
          icon: '■', 
          label: 'Points de donnees', 
          value: `${dataSummary.totalPoints} mesures`, 
          color: primaryColor,
          description: 'Total des enregistrements'
        },
        { 
          icon: '°', 
          label: 'Temperature', 
          value: `${dataSummary.temperatureRange.avg}°C`, 
          color: warningColor,
          description: `${dataSummary.temperatureRange.min}°C - ${dataSummary.temperatureRange.max}°C`
        },
        { 
          icon: '%', 
          label: 'Humidite', 
          value: `${dataSummary.humidityRange.avg}%`, 
          color: successColor,
          description: `${dataSummary.humidityRange.min}% - ${dataSummary.humidityRange.max}%`
        },
        { 
          icon: '◐', 
          label: 'Periode d\'analyse', 
          value: `${dataSummary.timeRange.start}`, 
          color: grayColor,
          description: `jusqu'a ${dataSummary.timeRange.end}`
        }
      ];

      summaryData.forEach((item, index) => {
        const x = margin + (index % 2) * (pageWidth / 2);
        const y = yPosition + Math.floor(index / 2) * 20;
        
        // Enhanced background box with border
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y - 10, pageWidth / 2 - 10, 18, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(x, y - 10, pageWidth / 2 - 10, 18, 'S');
        
        // Icon
        doc.setTextColor(...item.color);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(item.icon, x + 3, y - 2);
        
        // Label
        doc.setTextColor(...grayColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + 12, y - 2);
        
        // Main value
        doc.setTextColor(...item.color);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x + 12, y + 3);
        
        // Description
        doc.setTextColor(...grayColor);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.description, x + 12, y + 6);
      });

      yPosition += 35;

      // Recent data table with improved structure
      checkNewPage(35);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      yPosition = addText('DETAIL DES MESURES', margin, yPosition + 8, { fontSize: 16 });

      // Add separator line
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      yPosition += 8;

      // Enhanced table headers
      const tableHeaders = ['Heure', 'Temperature', 'Humidite', 'Batterie', 'Port'];
      const colWidths = [25, 25, 20, 20, 15];
      let xPos = margin;

      // Header background with gradient effect
      doc.setFillColor(...primaryColor);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 10, 'F');
      
      tableHeaders.forEach((header, index) => {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(header, xPos + 2, yPosition + 6);
        xPos += colWidths[index];
      });

      yPosition += 12;

      // Table data (last 25 points) with better formatting
      const recentData = data.slice(0, 25);
      recentData.forEach((point, index) => {
        checkNewPage(8);
        
        // Enhanced row styling
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 7, 'F');
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 7, 'F');
        }

        // Add subtle border
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 7, 'S');

        xPos = margin;
        const rowData = [
          new Date(point.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          `${point.temperature.toFixed(1)}°C`,
          `${point.humidity.toFixed(1)}%`,
          `${point.battery.toFixed(2)}V`,
          point.magnet === 1 ? 'Ouvert' : 'Ferme'
        ];

        rowData.forEach((cell, colIndex) => {
          // Color coding for different data types
          if (colIndex === 1) { // Temperature
            const temp = parseFloat(point.temperature.toFixed(1));
            if (temp < 0) doc.setTextColor(59, 130, 246); // Blue for cold
            else if (temp > 4) doc.setTextColor(239, 68, 68); // Red for hot
            else doc.setTextColor(34, 197, 94); // Green for optimal
          } else if (colIndex === 2) { // Humidity
            const hum = parseFloat(point.humidity.toFixed(1));
            if (hum < 85) doc.setTextColor(245, 158, 11); // Orange for low
            else if (hum > 95) doc.setTextColor(239, 68, 68); // Red for high
            else doc.setTextColor(34, 197, 94); // Green for optimal
          } else if (colIndex === 4) { // Door status
            if (point.magnet === 1) {
              doc.setTextColor(239, 68, 68); // Red for open
            } else {
              doc.setTextColor(34, 197, 94); // Green for closed
            }
          } else {
            doc.setTextColor(0, 0, 0);
          }
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(cell, xPos + 2, yPosition + 4);
          xPos += colWidths[colIndex];
        });

        yPosition += 7;
      });

      // Enhanced footer with better structure
      yPosition = pageHeight - 25;
      
      // Footer background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, yPosition - 5, pageWidth, 25, 'F');
      
      // Footer border
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(0, yPosition - 5, pageWidth, yPosition - 5);
      
      // Footer content with YAZAMI branding
      doc.setTextColor(...grayColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Rapport genere automatiquement par YAZAMI IoT', margin, yPosition);
      
      doc.setFontSize(8);
      doc.text('Optimise pour le partage WhatsApp', margin, yPosition + 4);
      doc.text('Donnees securisees et confidentielles', margin, yPosition + 8);
      
      // YAZAMI brand in footer - Centered and prominent
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const footerBrandText = 'YAZAMI';
      const footerBrandWidth = doc.getTextWidth(footerBrandText);
      doc.text(footerBrandText, (pageWidth - footerBrandWidth) / 2, yPosition + 12);
      
      // QR Code placeholder (visual element)
      doc.setFillColor(...primaryColor);
      doc.rect(pageWidth - 25, yPosition - 2, 20, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('QR', pageWidth - 20, yPosition + 8);
      doc.text('CODE', pageWidth - 20, yPosition + 12);

      // Generate PDF blob for sharing
      const pdfBlob = doc.output('blob');
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      const fileName = `rapport-${sensorName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}-${timeStr}.pdf`;
      
      // Create share options
      const shareData = {
        title: `Rapport Capteur - ${sensorName}`,
        text: `Rapport d'analyse des capteurs généré par YAZAMI IoT\n\nCapteur: ${sensorName}\nDate: ${new Date().toLocaleString('fr-FR')}\nMode: ${isLiveMode ? 'Temps réel' : 'Historique'}`,
        files: [new File([pdfBlob], fileName, { type: 'application/pdf' })]
      };

      // Check if Web Share API is supported
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          console.log('📊 [SensorChart] PDF partagé via Web Share API');
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('❌ [SensorChart] Erreur lors du partage:', error);
            // Fallback to download
            doc.save(fileName);
          }
        }
      } else {
        // Fallback: Show share options dialog
        showShareOptionsDialog(pdfBlob, fileName, shareData);
      }
    } catch (error) {
      console.error('❌ [SensorChart] Error generating PDF:', error);
    }
  }, [data, sensorName, isLiveMode]);

  // Share options dialog function
  const showShareOptionsDialog = (pdfBlob: Blob, fileName: string, shareData: any) => {
    // Create a modal dialog for share options
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    dialog.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Partager le Rapport</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Choisissez comment partager votre rapport PDF</p>
      </div>
      
      <div style="display: grid; gap: 12px;">
        <button id="whatsapp-share" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: none;
          border-radius: 12px;
          background: #25d366;
          color: white;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
          Partager sur WhatsApp
        </button>
        
        <button id="email-share" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: none;
          border-radius: 12px;
          background: #3b82f6;
          color: white;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          Envoyer par Email
        </button>
        
        <button id="download-share" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: none;
          border-radius: 12px;
          background: #6b7280;
          color: white;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          Télécharger le PDF
        </button>
        
        <button id="copy-link" style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: none;
          border-radius: 12px;
          background: #10b981;
          color: white;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          Copier le lien
        </button>
      </div>
      
      <div style="margin-top: 20px; text-align: center;">
        <button id="close-share" style="
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #6b7280;
          font-size: 14px;
          cursor: pointer;
        ">Annuler</button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Event listeners
    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const downloadPDF = () => {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      closeModal();
    };

    const shareWhatsApp = () => {
      const text = encodeURIComponent(shareData.text);
      const url = `https://wa.me/?text=${text}`;
      window.open(url, '_blank');
      closeModal();
    };

    const shareEmail = () => {
      const subject = encodeURIComponent(shareData.title);
      const body = encodeURIComponent(shareData.text);
      const url = `mailto:?subject=${subject}&body=${body}`;
      window.open(url);
      closeModal();
    };

    const copyLink = () => {
      navigator.clipboard.writeText(shareData.text).then(() => {
        alert('Texte copié dans le presse-papiers !');
        closeModal();
      });
    };

    // Add event listeners
    dialog.querySelector('#whatsapp-share')?.addEventListener('click', shareWhatsApp);
    dialog.querySelector('#email-share')?.addEventListener('click', shareEmail);
    dialog.querySelector('#download-share')?.addEventListener('click', downloadPDF);
    dialog.querySelector('#copy-link')?.addEventListener('click', copyLink);
    dialog.querySelector('#close-share')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  };

  // MQTT Live data handling - REACTIVATED with correct configuration
  useEffect(() => {
    if (isOpen && isLiveMode) {
      console.log('🔌 [SensorChart] Starting MQTT live mode for sensor:', sensorId);
      
      // Connect to MQTT if not already connected
      if (!mqttConnected) {
        console.log('🔌 [SensorChart] Attempting MQTT connection...');
        
        // Set a timeout for MQTT connection
        const mqttTimeout = setTimeout(() => {
          console.log('⏰ [SensorChart] MQTT connection timeout, falling back to API mode');
          setIsLiveMode(false);
          setError('MQTT connection timeout, using historical data instead');
        }, 10000); // 10 seconds timeout

        mqttLiveService.connect()
          .then(() => {
            clearTimeout(mqttTimeout);
            console.log('✅ [SensorChart] MQTT connected successfully');
            setMqttConnected(true);
            setError(null); // Clear any previous errors
            
            // Load historical data only after MQTT connection is established
            console.log('📊 [SensorChart] Loading historical data as baseline for live mode...');
            fetchSensorData(false);
          })
          .catch((err) => {
            clearTimeout(mqttTimeout);
            console.error('❌ [SensorChart] MQTT connection failed:', err);
            console.log('🔄 [SensorChart] Falling back to API mode');
            setIsLiveMode(false);
            setError('MQTT connection failed, using historical data instead');
          });
      }

      // Subscribe to sensor data
      const unsubscribe = mqttLiveService.onSensorData((sensorData: MQTTSensorData) => {
        console.log('📊 [SensorChart] Received live sensor data:', sensorData);
        
        // Convert MQTT data to our format
        const convertedData: SensorData = {
          timestamp: sensorData.timestamp,
          temperature: sensorData.temperature,
          humidity: sensorData.humidity,
          battery: sensorData.battery,
          magnet: sensorData.magnet
        };

        // Add to existing data (combine historical + live data)
        setData(prevData => {
          // Check if this data point already exists (avoid duplicates)
    /*       const exists = prevData.some(item => 
            Math.abs(item.timestamp - convertedData.timestamp) < 5000 && // Within 5 seconds
            Math.abs(item.temperature - convertedData.temperature) < 0.1 && // Same temperature
            Math.abs(item.humidity - convertedData.humidity) < 0.1 // Same humidity
          ); 
          
          if (exists) {
            console.log('📊 [SensorChart] Duplicate data point detected, skipping:', {
              timestamp: new Date(convertedData.timestamp).toISOString(),
              temperature: convertedData.temperature,
              humidity: convertedData.humidity
            });
            return prevData;
          }*/
          
          console.log('📊 [SensorChart] Adding new live data point:', {
            timestamp: new Date(convertedData.timestamp).toISOString(),
            temperature: convertedData.temperature,
            humidity: convertedData.humidity
          });
          
          // Add new data and keep last 100 points for better visualization
          const newData = [...prevData, convertedData];
          return newData; // Keep last 100 points
        });
      });

      return () => {
        console.log('🔌 [SensorChart] Unsubscribing from MQTT data');
        unsubscribe();
      };
    }
  }, [isOpen, isLiveMode, sensorId, mqttConnected]);

  useEffect(() => {
    if (isOpen && !isLiveMode) {
      console.log('🚀 [SensorChart] Modal opened, fetching historical data for sensor:', sensorId);
      console.log('🔗 [SensorChart] API Endpoint: https://flespi.io/gw/devices/6925665/messages');
      console.log('🔑 [SensorChart] Token: FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj');
      fetchSensorData(false); // Use cache when modal opens
    }
  }, [isOpen, sensorId, dateRange, fetchSensorData, isLiveMode]);

  // Temperature chart configuration
  const temperatureChartOption = {
    backgroundColor: 'transparent',
/*     title: [
      {
        text: 'Température',
        left: 'center',
        top: 5,
        textStyle: {
          color: '#EF4444',
          fontSize: 12,
          fontWeight: 'bold'
        }
      }
    ], */
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const value = point.data[1].toFixed(1);
        const movementStatus = point.data[2] || 0;
        
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; color: #EF4444; margin-bottom: 6px; font-size: 14px;">Température</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${time}</strong></div>
            <div style="font-size: 16px; margin-bottom: 4px;">${point.marker} <strong>${value}°C</strong></div>
            <div style="font-size: 12px; color: #9333EA;">${movementStatus === 1 ? '🔒 Port Fermé' : '🔓 Port Ouvert'}</div>
          </div>
        `;
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '25%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: '#E5E7EB'
        }
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 10,
        rotate: 45,
        interval: 'auto', // Affichage automatique optimisé
        formatter: function(value: number) {
          const date = new Date(value);
          return date.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      },
  
    },
    yAxis: {
      type: 'value',
      name: 'Température (°C)',
      nameTextStyle: {
        color: '#EF4444'
      },
      axisLine: {
        lineStyle: {
          color: '#EF4444'
        }
      },
      axisLabel: {
        color: '#EF4444',
        formatter: '{value}°C'
      },
      splitLine: {
        lineStyle: {
          color: '#FEE2E2'
        }
      },
      axisPointer: {
        snap: true,
        lineStyle: {
          color: '#999',
          type: 'dashed',
          width: 1
        },
        handle: {
          show: false,
          color: '#999'
        }
      }
    },
    series: [
      {
        name: 'Température',
        type: 'line',
        data: data.map(d => [d.timestamp, d.temperature, d.magnet]),
        smooth: true,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#F97316' },
              { offset: 1, color: '#EF4444' }
            ]
          }
        },
        itemStyle: {
          color: '#EF4444'
        },
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
        emphasis: {
          itemStyle: {
            color: '#DC2626',
            borderColor: '#fff',
            borderWidth: 2
          }
        },
      },
      // Port status as stacked bar chart
      {
        name: 'Port Fermé',
        type: 'bar',
        data: data.map(d => [d.timestamp, d.magnet === 1 ? 1 : 0]),
        itemStyle: {
          color: '#10B981',
          opacity: 0.7
        },
        stack: 'port',
        barWidth: '80%',
        tooltip: {
          formatter: function(params: any) {
            if (params.data[1] === 0) return '';
            const date = new Date(params.data[0]);
            const time = date.toLocaleString('fr-FR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            });
            return `🔒 Port Fermé<br/>${time}`;
          }
        }
      },
      {
        name: 'Port Ouvert',
        type: 'bar',
        data: data.map(d => [d.timestamp, d.magnet === 0 ? 1 : 0]),
        itemStyle: {
          color: '#EF4444',
          opacity: 0.7
        },
        stack: 'port',
        barWidth: '80%',
        tooltip: {
          formatter: function(params: any) {
            if (params.data[1] === 0) return '';
            const date = new Date(params.data[0]);
            const time = date.toLocaleString('fr-FR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            });
            return `🔓 Port Ouvert<br/>${time}`;
          }
        }
      }
    ],
    // Timeline and zoom features for temperature
    dataZoom: [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: 100,
        height: 20,
        bottom: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#E5E7EB',
        fillerColor: 'rgba(239, 68, 68, 0.2)',
        handleStyle: {
          color: '#EF4444',
          borderColor: '#EF4444'
        },
        textStyle: {
          color: '#6B7280',
          fontSize: 10
        }
      },
      {
        type: 'inside',
        xAxisIndex: [0],
        start: 0,
        end: 100
      }
    ]
  };

  // Humidity chart configuration
  const humidityChartOption = {
    backgroundColor: 'transparent',
/*     title: [
      {
        text: 'Humidité',
        left: 'center',
        top: 5,
        textStyle: {
          color: '#3B82F6',
          fontSize: 12,
          fontWeight: 'bold'
        }
      }
    ], */
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const value = point.data[1];
        const movementStatus = point.data[2] || 0;
        
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; color: #3B82F6; margin-bottom: 6px; font-size: 14px;">Humidité</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${time}</strong></div>
            <div style="font-size: 16px; margin-bottom: 4px;">${point.marker} <strong>${value > 0 ? value.toFixed(1) + '%' : 'N/A'}</strong></div>
            <div style="font-size: 12px; color: #9333EA;">${movementStatus === 1 ? '🔒 Port Fermé' : '🔓 Port Ouvert'}</div>
          </div>
        `;
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '25%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: '#E5E7EB'
        }
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 10,
        rotate: 45,
        interval: 'auto', // Affichage automatique optimisé
        formatter: function(value: number) {
          const date = new Date(value);
          return date.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#F3F4F6',
          type: 'dashed'
        }
      },
      splitNumber: 4
    },
    yAxis: {
      type: 'value',
      name: 'Humidité (%)',
      nameTextStyle: {
        color: '#3B82F6'
      },
      axisLine: {
        lineStyle: {
          color: '#3B82F6'
        }
      },
      axisLabel: {
        color: '#3B82F6',
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          color: '#DBEAFE'
        }
      },
      splitNumber: 4,
      axisPointer: {
        snap: true,
        lineStyle: {
          color: '#999',
          type: 'dashed',
          width: 1
        },
        handle: {
          show: false,
          color: '#999'
        }
      }
    },
    series: [
       {
         name: 'Humidité',
         type: 'line',
         data: data.map(d => [d.timestamp, d.humidity, d.magnet]),
        smooth: true,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#06B6D4' },
              { offset: 1, color: '#3B82F6' }
            ]
          }
        },
        itemStyle: {
          color: '#3B82F6'
        },
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
        emphasis: {
          itemStyle: {
            color: '#2563EB',
            borderColor: '#fff',
            borderWidth: 2
          }
        },
        // Zone optimale pour le stockage des pommes (85-95%) - Plus visible
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(34, 197, 94, 0.25)',
            borderColor: 'rgba(34, 197, 94, 0.8)',
            borderWidth: 2
          },
          data: [
            [
              {
                yAxis: 85,
                itemStyle: {
                  color: 'rgba(34, 197, 94, 0.25)'
                },
                label: {
                  show: true,
                  position: 'insideTop',
                  formatter: 'ZONE OPTIMALE\nPOMMES',
                  color: '#22C55E',
                  fontSize: 10,
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderColor: '#22C55E',
                  borderWidth: 1,
                  borderRadius: 6,
                  padding: [4, 8]
                }
              },
              {
                yAxis: 95,
                itemStyle: {
                  color: 'rgba(34, 197, 94, 0.25)'
                }
              }
            ]
          ]
        },
        // Lignes de référence pour l'humidité optimale des pommes - Plus visibles
        markLine: {
          silent: true,
          lineStyle: {
            color: '#16A34A',
            type: 'solid',
            width: 3
          },
          data: [
            {
              yAxis: 85,
              name: 'Min optimal pommes',
              lineStyle: {
                color: '#16A34A',
                type: 'solid',
                width: 3
              },
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: '85% MIN',
                color: '#FFFFFF',
                fontSize: 9,
                fontWeight: 'bold',
                backgroundColor: '#16A34A',
                borderColor: '#FFFFFF',
                borderWidth: 1,
                borderRadius: 6,
                padding: [4, 8]
              }
            },
            {
              yAxis: 95,
              name: 'Max optimal pommes',
              lineStyle: {
                color: '#16A34A',
                type: 'solid',
                width: 3
              },
              label: {
                show: true,
                position: 'insideEndBottom',
                formatter: '95% MAX',
                color: '#FFFFFF',
                fontSize: 9,
                fontWeight: 'bold',
                backgroundColor: '#16A34A',
                borderColor: '#FFFFFF',
                borderWidth: 1,
                borderRadius: 6,
                padding: [4, 8]
              }
            }
          ]
        }
      },
       // Port status as stacked bar chart for humidity
       {
         name: 'Port Fermé',
         type: 'bar',
         data: data.map(d => [d.timestamp, d.magnet === 1 ? 1 : 0]),
         itemStyle: {
           color: '#10B981',
           opacity: 0.7
         },
         stack: 'port',
         barWidth: '80%',
         tooltip: {
           formatter: function(params: any) {
             if (params.data[1] === 0) return '';
             const date = new Date(params.data[0]);
             const time = date.toLocaleString('fr-FR', { 
               day: '2-digit', 
               month: '2-digit', 
               year: 'numeric', 
               hour: '2-digit', 
               minute: '2-digit',
               second: '2-digit'
             });
             return `🔒 Port Fermé<br/>${time}`;
           }
         }
       },
       {
         name: 'Port Ouvert',
         type: 'bar',
         data: data.map(d => [d.timestamp, d.magnet === 0 ? 1 : 0]),
         itemStyle: {
           color: '#EF4444',
           opacity: 0.7
         },
         stack: 'port',
         barWidth: '80%',
         tooltip: {
           formatter: function(params: any) {
             if (params.data[1] === 0) return '';
             const date = new Date(params.data[0]);
             const time = date.toLocaleString('fr-FR', { 
               day: '2-digit', 
               month: '2-digit', 
               year: 'numeric', 
               hour: '2-digit', 
               minute: '2-digit',
               second: '2-digit'
             });
             return `🔓 Port Ouvert<br/>${time}`;
           }
         }
       }
    ],
    // Timeline and zoom features for humidity
    dataZoom: [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: 100,
        height: 20,
        bottom: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#E5E7EB',
        fillerColor: 'rgba(59, 130, 246, 0.2)',
        handleStyle: {
          color: '#3B82F6',
          borderColor: '#3B82F6'
        },
        textStyle: {
          color: '#6B7280',
          fontSize: 10
        }
      },
      {
        type: 'inside',
        xAxisIndex: [0],
        start: 0,
        end: 100
      }
    ]
  };

  if (!isOpen) return null;

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
            {/* Live/Historical Toggle - Apple Style */}
            <button
              onClick={() => {
                setIsLiveMode(!isLiveMode);
                // Don't clear data when switching to live mode - keep historical data
                if (isLiveMode) {
                  console.log('🔄 [SensorChart] Switching to historical mode');
                } else {
                  console.log('🔄 [SensorChart] Switching to live mode - will load historical data first');
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
                onClick={debouncedRefresh}
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

            {/* Share Button - WhatsApp Style */}
            <button
              onClick={handleShareData}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 bg-green-500 text-white shadow-sm hover:bg-green-600"
              title="Partager les données"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </button>
            {/* Close Button - Apple Style */}
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
          {/* Apple-inspired Date Range Selector */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-5 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl shadow-black/5">
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
              {/* Live Mode Status */}
              {isLiveMode ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 rounded-full border border-green-200">
                  <div className={`w-2 h-2 rounded-full ${mqttConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium text-green-700">
                    {mqttConnected ? 'Mode temps réel' : 'Connexion...'}
                  </span>
                </div>
              ) : error && error.includes('MQTT') ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-50 rounded-full border border-yellow-200">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">
                    Mode Historique (MQTT indisponible)
                  </span>
                </div>
              ) : (
                <>
                  {/* Quick Range Buttons - Compact French Design */}
                  <div className="flex justify-center flex-wrap gap-1 sm:gap-1.5">
                <button
                  onClick={setLast30Minutes}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ease-out backdrop-blur-sm ${
                    isRangeSelected('30min')
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-105 border border-blue-400/20'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90 hover:border-slate-300/80 hover:shadow-md hover:scale-102 active:scale-98'
                  }`}
                >
                  30min
                </button>
                <button
                  onClick={() => setQuickRange(1, '24h')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ease-out backdrop-blur-sm ${
                    isRangeSelected('24h')
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-105 border border-blue-400/20'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90 hover:border-slate-300/80 hover:shadow-md hover:scale-102 active:scale-98'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setQuickRange(7, '7j')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ease-out backdrop-blur-sm ${
                    isRangeSelected('7j')
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-105 border border-blue-400/20'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90 hover:border-slate-300/80 hover:shadow-md hover:scale-102 active:scale-98'
                  }`}
                >
                  7j
                </button>
                <button
                  onClick={() => setQuickRange(30, '30j')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ease-out backdrop-blur-sm ${
                    isRangeSelected('30j')
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 transform scale-105 border border-blue-400/20'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90 hover:border-slate-300/80 hover:shadow-md hover:scale-102 active:scale-98'
                  }`}
                >
                  30j
                </button>
                <button
                  onClick={() => setQuickRange(0, 'custom')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all duration-300 ease-out backdrop-blur-sm ${
                    isRangeSelected('custom')
                      ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 transform scale-105 border border-purple-400/20'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90 hover:border-slate-300/80 hover:shadow-md hover:scale-102 active:scale-98'
                  }`}
                >
                  Perso
                </button>
                  </div>
                  
                  {/* Apple-style Divider */}
                  <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent"></div>
              
              {/* Custom Date Range - Compact French - Hidden until Perso is selected */}
              {isRangeSelected('custom') && (
                <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium text-xs">Du:</span>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value, type: 'custom' }))}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm"
                    />
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-medium text-xs">Au:</span>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value, type: 'custom' }))}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm"
                    />
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </div>

          {loading && isInitialLoad && (
            <div className="flex items-center justify-center py-12 transition-opacity duration-300">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Chargement des données...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <span className="text-red-500 text-xl mr-3">⚠️</span>
                <div>
                  <h3 className="text-red-800 font-medium">Erreur de chargement</h3>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && data.length === 0 && !isInitialLoad && (
            <div className="text-center py-12 transition-all duration-300">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📈</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée disponible</h3>
              <p className="text-gray-600">Aucune donnée de capteur trouvée pour cette période.</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="space-y-4 sm:space-y-8 transition-all duration-500 ease-in-out opacity-100">
              {/* View Mode Toggle Buttons - Compact Professional Design */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex bg-gray-100 rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setViewMode('basic')}
                    className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'basic'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Basique
                  </button>
                  <button
                    onClick={() => setViewMode('kpi')}
                    className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'kpi'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Avancés
                  </button>
                </div>
              </div>

              {/* Summary Cards - Basic or KPI View */}
              <div className={`grid gap-2 sm:gap-3 mb-3 sm:mb-6 ${
                viewMode === 'basic' 
                  ? 'grid-cols-2 lg:grid-cols-4' 
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
              }`}>
                {viewMode === 'basic' ? (
                  <>
                    {/* Basic View - Current Values */}
                    <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-2 sm:p-3 border border-red-200">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-red-600 text-xs font-medium truncate">Temp</p>
                          <p className="text-sm sm:text-lg font-bold text-red-700">
                            {data.length > 0 ? data[data.length - 1].temperature.toFixed(1) : '0.0'}°C
                          </p>
                          <p className="text-xs text-red-600 mt-0.5">
                            {data.length > 0 ? getTimeAgo(new Date(data[data.length - 1].timestamp)) : 'N/A'}
                          </p>
                        </div>
                        <span className="text-red-500 text-lg sm:text-xl flex-shrink-0 ml-1">🌡️</span>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-2 sm:p-3 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-blue-600 text-xs font-medium truncate">Humidité</p>
                          <p className="text-sm sm:text-lg font-bold text-blue-700">
                            {data.length > 0 ? data[data.length - 1].humidity.toFixed(1) : '0.0'}%
                          </p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            {data.length > 0 ? getTimeAgo(new Date(data[data.length - 1].timestamp)) : 'N/A'}
                          </p>
                        </div>
                        <span className="text-blue-500 text-lg sm:text-xl flex-shrink-0 ml-1">💧</span>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-2 sm:p-3 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-purple-600 text-xs font-medium truncate">Port</p>
                          <p className="text-sm sm:text-lg font-bold text-purple-700">
                            {data.length > 0 ? (data[data.length - 1].magnet === 1 ? 'Fermé' : 'Ouvert') : 'N/A'}
                          </p>
                          <p className="text-xs text-purple-600 mt-0.5">
                            {data.length > 0 ? getTimeAgo(new Date(data[data.length - 1].timestamp)) : 'N/A'}
                          </p>
                        </div>
                        <span className="text-purple-500 text-lg sm:text-xl flex-shrink-0 ml-1">
                          {data.length > 0 ? (data[data.length - 1].magnet === 1 ? '🔒' : '🔓') : '❓'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-2 sm:p-3 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-green-600 text-xs font-medium truncate">Batterie</p>
                          <p className="text-sm sm:text-lg font-bold text-green-700">
                            {data.length > 0 ? data[data.length - 1].battery.toFixed(1) : '0.0'}V
                          </p>
                          <p className="text-xs text-green-600 mt-0.5">
                            {data.length > 0 ? getTimeAgo(new Date(data[data.length - 1].timestamp)) : 'N/A'}
                          </p>
                        </div>
                        <span className="text-green-500 text-lg sm:text-xl flex-shrink-0 ml-1">🔋</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* KPI View - Advanced Apple Storage Calculations */}
                    {(() => {
                      // Show loading state while calculating KPIs
                      if (kpiCalculating) {
                        return (
                          <div className="col-span-full flex items-center justify-center py-8">
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                              <span className="text-sm text-gray-600">Calcul des KPI avancés...</span>
                            </div>
                          </div>
                        );
                      }
                      
                      // Use cached KPIs
                      const kpis = cachedKPIs;
                      if (!kpis) return null;
                      
                      return (
                        <>
                          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-2 sm:p-3 border border-red-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-red-600 text-xs font-medium truncate">HMP Q10</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'hmp' ? null : 'hmp')}
                                    className="w-5 h-5 rounded-full bg-red-200 hover:bg-red-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-red-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-red-700">
                                  {kpis.hmp}
                                </p>
                                <p className="text-xs text-red-600 mt-0.5">
                                  Maturation/j
                                </p>
                                {expandedCard === 'hmp' && (
                                  <div className="mt-2 p-2 bg-red-100/50 rounded-md border border-red-200/50 animate-fadeIn">
                                    <p className="text-xs text-red-700 font-medium">
                                      Plus la valeur est élevée, plus les pommes vieillissent rapidement
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">
                                      Optimal: 0/jour | Alerte: &gt;5/jour
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-red-500 text-lg sm:text-xl flex-shrink-0 ml-1">🍎</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-2 sm:p-3 border border-blue-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-blue-600 text-xs font-medium truncate">ID VPD</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'id' ? null : 'id')}
                                    className="w-5 h-5 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-blue-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-blue-700">
                                  {kpis.id}
                                </p>
                                <p className="text-xs text-blue-600 mt-0.5">
                                  kPa·min/h
                                </p>
                                {expandedCard === 'id' && (
                                  <div className="mt-2 p-2 bg-blue-100/50 rounded-md border border-blue-200/50 animate-fadeIn">
                                    <p className="text-xs text-blue-700 font-medium">
                                      Mesure le risque de perte de poids par dessiccation
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">
                                      Optimal: 0 | Alerte: ≥1 kPa·min/h
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-blue-500 text-lg sm:text-xl flex-shrink-0 ml-1">💧</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-2 sm:p-3 border border-purple-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-purple-600 text-xs font-medium truncate">Condensation</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'condensation' ? null : 'condensation')}
                                    className="w-5 h-5 rounded-full bg-purple-200 hover:bg-purple-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-purple-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-purple-700">
                                  {kpis.condensationEvents}
                                </p>
                                <p className="text-xs text-purple-600 mt-0.5">
                                  {kpis.minMargin}°C marge
                                </p>
                                {expandedCard === 'condensation' && (
                                  <div className="mt-2 p-2 bg-purple-100/50 rounded-md border border-purple-200/50 animate-fadeIn">
                                    <p className="text-xs text-purple-700 font-medium">
                                      Risque de moisissures quand l'air atteint le point de rosée
                                    </p>
                                    <p className="text-xs text-purple-600 mt-1">
                                      Optimal: Marge ≥1°C, 0 événements | Alerte: Marge &lt;1°C
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-purple-500 text-lg sm:text-xl flex-shrink-0 ml-1">💨</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-2 sm:p-3 border border-orange-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-orange-600 text-xs font-medium truncate">AOT15</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'aot15' ? null : 'aot15')}
                                    className="w-5 h-5 rounded-full bg-orange-200 hover:bg-orange-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-orange-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-orange-700">
                                  {kpis.aot15}
                                </p>
                                <p className="text-xs text-orange-600 mt-0.5">
                                  {kpis.returnTime}min retour
                                </p>
                                {expandedCard === 'aot15' && (
                                  <div className="mt-2 p-2 bg-orange-100/50 rounded-md border border-orange-200/50 animate-fadeIn">
                                    <p className="text-xs text-orange-700 font-medium">
                                      Impact thermique des ouvertures de porte sur 15 minutes
                                    </p>
                                    <p className="text-xs text-orange-600 mt-1">
                                      Optimal: Retour ≤15min, AOT15 faible | Alerte: Retour &gt;15min
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-orange-500 text-lg sm:text-xl flex-shrink-0 ml-1">🚪</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-2 sm:p-3 border border-green-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-green-600 text-xs font-medium truncate">Stabilité</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'stability' ? null : 'stability')}
                                    className="w-5 h-5 rounded-full bg-green-200 hover:bg-green-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-green-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-green-700">
                                  {kpis.p95Temp}
                                </p>
                                <p className="text-xs text-green-600 mt-0.5">
                                  °C/min P95
                                </p>
                                {expandedCard === 'stability' && (
                                  <div className="mt-2 p-2 bg-green-100/50 rounded-md border border-green-200/50 animate-fadeIn">
                                    <p className="text-xs text-green-700 font-medium">
                                      Variations brusques de température = mauvaise régulation
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                      Optimal: &lt;0.05°C/min | Alerte: ≥0.05°C/min
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-green-500 text-lg sm:text-xl flex-shrink-0 ml-1">📊</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-2 sm:p-3 border border-cyan-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-cyan-600 text-xs font-medium truncate">RH Stabilité</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'rh-stability' ? null : 'rh-stability')}
                                    className="w-5 h-5 rounded-full bg-cyan-200 hover:bg-cyan-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-cyan-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-cyan-700">
                                  {kpis.p95Humidity}
                                </p>
                                <p className="text-xs text-cyan-600 mt-0.5">
                                  %/min P95
                                </p>
                                {expandedCard === 'rh-stability' && (
                                  <div className="mt-2 p-2 bg-cyan-100/50 rounded-md border border-cyan-200/50 animate-fadeIn">
                                    <p className="text-xs text-cyan-700 font-medium">
                                      Variations brusques d'humidité = dégivrage mal calibré
                                    </p>
                                    <p className="text-xs text-cyan-600 mt-1">
                                      Optimal: &lt;0.5%/min | Alerte: ≥0.5%/min
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-cyan-500 text-lg sm:text-xl flex-shrink-0 ml-1">🌡️</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-2 sm:p-3 border border-indigo-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-indigo-600 text-xs font-medium truncate">Hors Plage</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'out-of-range' ? null : 'out-of-range')}
                                    className="w-5 h-5 rounded-full bg-indigo-200 hover:bg-indigo-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-indigo-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-indigo-700">
                                  {kpis.maxOutOfRange}
                                </p>
                                <p className="text-xs text-indigo-600 mt-0.5">
                                  min max séquence
                                </p>
                                {expandedCard === 'out-of-range' && (
                                  <div className="mt-2 p-2 bg-indigo-100/50 rounded-md border border-indigo-200/50 animate-fadeIn">
                                    <p className="text-xs text-indigo-700 font-medium">
                                      Plus longue période hors des consignes optimales
                                    </p>
                                    <p className="text-xs text-indigo-600 mt-1">
                                      Optimal: &lt;15min | Alerte: ≥15min
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-indigo-500 text-lg sm:text-xl flex-shrink-0 ml-1">⚠️</span>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-2 sm:p-3 border border-emerald-200 hover:shadow-lg transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-emerald-600 text-xs font-medium truncate">Données</p>
                                  <button
                                    onClick={() => setExpandedCard(expandedCard === 'data' ? null : 'data')}
                                    className="w-5 h-5 rounded-full bg-emerald-200 hover:bg-emerald-300 flex items-center justify-center transition-all duration-200 hover:scale-110"
                                  >
                                    <span className="text-emerald-600 text-xs font-bold">!</span>
                                  </button>
                                </div>
                                <p className="text-sm sm:text-lg font-bold text-emerald-700">
                                  {kpis.dataPoints}
                                </p>
                                <p className="text-xs text-emerald-600 mt-0.5">
                                  {kpis.totalMinutes} min
                                </p>
                                {expandedCard === 'data' && (
                                  <div className="mt-2 p-2 bg-emerald-100/50 rounded-md border border-emerald-200/50 animate-fadeIn">
                                    <p className="text-xs text-emerald-700 font-medium">
                                      "Nombre de mesures et durée d'analyse"
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="text-emerald-500 text-lg sm:text-xl flex-shrink-0 ml-1">📈</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Separate Charts - Mobile Optimized */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-6">
                {/* Temperature Chart */}
                <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm transition-all duration-300 hover:shadow-lg">
                  <ReactECharts 
                    option={temperatureChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                  />
                  {/* Temperature Range Info - Small without icon */}
                  <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-gradient-to-r from-yellow-50 to-red-100 border border-yellow-300 rounded-md sm:rounded-lg">
                    <div className="text-center">
                      <p className="text-xs font-bold text-red-800">
                        ZONE OPTIMALE
                      </p>
                      <p className="text-xs text-red-700 font-medium">
                        0°C - 4°C Température
                      </p>
                    </div>
                  </div>
                </div>

                {/* Humidity Chart */}
                <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm transition-all duration-300 hover:shadow-lg">
                  <ReactECharts 
                    option={humidityChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                  />
                  {/* Humidity Range Info - Small without icon */}
                  <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-md sm:rounded-lg">
                    <div className="text-center">
                      <p className="text-xs font-bold text-blue-800">
                        ZONE OPTIMALE
                      </p>
                      <p className="text-xs text-blue-700 font-medium">
                        85% - 95% Humidité
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
          {/* Bottom padding for better mobile scrolling */}
          <div className="h-4 sm:h-6"></div>
        </div>
      </div>
    </div>
  );
};

export default SensorChart;