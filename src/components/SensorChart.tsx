import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

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
  
  // Date range state - default to last 24 hours
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      start: yesterday.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '24h' // Track the selected range type
    };
  });

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

  // Set last 50 frames
  const setLast50Frames = () => {
    setDateRange({
      start: '',
      end: '',
      type: '50frames'
    });
  };

  // Helper function to check if a specific range is selected
  const isRangeSelected = (type: string) => {
    return dateRange.type === type;
  };

  const fetchSensorData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build API URL based on range type
      let apiUrl = 'https://flespi.io/gw/devices/6925665/messages';
      
      if (dateRange.type === '50frames') {
        apiUrl += '?limit=100'; // Fetch more data to ensure we get 50 valid frames after filtering
      } else {
        // For time-based ranges, use date filtering
        const startTime = Math.floor(new Date(dateRange.start).getTime() / 1000);
        const endTime = Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000);
        apiUrl += `?filter=timestamp>${startTime}%20and%20timestamp<${endTime}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': 'FlespiToken HLjLOPX7XObF3D6itPYgFmMP0Danfjg49eUofKdSwjyGY3hAKeBYkp7LC45Pznyj'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      // Process the data similar to the jq command
      let processedData: SensorData[] = rawData.result
        ?.filter((item: any) => 
          item['ble.sensor.temperature.1'] !== undefined && 
          item['ble.sensor.humidity.1'] !== undefined
        )
        ?.map((item: any) => {
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

          return {
            timestamp: new Date(item.timestamp * 1000).getTime(),
            temperature: parseFloat(item['ble.sensor.temperature.1']) || 0,
            humidity: parseFloat(item['ble.sensor.humidity.1']) || 0,
            battery: parseFloat(item['battery.voltage']) || 0,
            magnet: magnetValue // 0 = open, 1 = closed (magnet: false=open, true=closed)
          };
        }) || [];

      // Remove duplicate timestamps by keeping the latest entry for each timestamp
      const uniqueData = new Map<number, SensorData>();
      processedData.forEach(item => {
        const existing = uniqueData.get(item.timestamp);
        if (!existing || item.battery > existing.battery) { // Keep the one with higher battery or newer data
          uniqueData.set(item.timestamp, item);
        }
      });

      // Convert back to array and sort by timestamp (newest first for 50 frames limit)
      processedData = Array.from(uniqueData.values())
        .sort((a: SensorData, b: SensorData) => b.timestamp - a.timestamp); // Sort by timestamp descending (newest first)

      // Apply limit for 50 frames option
      if (dateRange.type === '50frames') {
        processedData = processedData.slice(0, 50);
      }

      // Sort again in ascending order for chart display
      processedData = processedData.sort((a: SensorData, b: SensorData) => 
        a.timestamp - b.timestamp // Sort by timestamp ascending for chart
      );

      setData(processedData);
    } catch (err) {
      console.error('Error fetching sensor data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sensor data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSensorData();
    }
  }, [isOpen, sensorId, dateRange]);

  // Temperature chart configuration
  const temperatureChartOption = {
    backgroundColor: 'transparent',
    title: [
      {
        text: '🌡️ Température',
        left: 'center',
        top: 10,
        textStyle: {
          color: '#EF4444',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      {
        text: dateRange.type === '50frames' ? 'Dernières 50 données' : `${new Date(dateRange.start).toLocaleDateString('fr-FR')} - ${new Date(dateRange.end).toLocaleDateString('fr-FR')}`,
        left: 'center',
        top: 35,
        textStyle: {
          color: '#6B7280',
          fontSize: 12,
          fontWeight: 'normal'
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      textStyle: {
        color: '#fff'
      },
      formatter: function(params: any) {
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const value = point.data[1].toFixed(1);
        const movementStatus = point.data[2] || 0;
        let status = '';
        
        if (value < 0) status = ' 🔴 Trop froid';
        else if (value > 4) status = ' 🟡 Attention';
        else status = ' ✅ Optimal';
        
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; color: #EF4444; margin-bottom: 4px;">🌡️ Température</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${time}</strong></div>
            <div style="font-size: 16px; margin-bottom: 4px;">${point.marker} <strong>${value}°C</strong></div>
            <div style="font-size: 12px; color: #6B7280; margin-bottom: 2px;">${status}</div>
            <div style="font-size: 12px; color: #9333EA;">${movementStatus === 1 ? '🔒 Port Fermé' : '🔓 Port Ouvert'}</div>
          </div>
        `;
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '18%',
      top: '20%',
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
        formatter: function(value: number) {
          return new Date(value).toLocaleTimeString('fr-FR', { 
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
      }
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
          show: true,
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
        symbolSize: 6,
        emphasis: {
          itemStyle: {
            color: '#DC2626',
            borderColor: '#fff',
            borderWidth: 2
          }
        },
        // Lignes de référence pour la température
        markLine: {
          silent: true,
          lineStyle: {
            color: '#10B981',
            type: 'dashed',
            width: 2
          },
          data: [
            {
              yAxis: 0,
              name: 'Min optimal',
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: 'Min: 0°C'
              }
            },
            {
              yAxis: 4,
              name: 'Max optimal',
              label: {
                show: true,
                position: 'insideEndBottom',
                formatter: 'Max: 4°C'
              }
            }
          ]
        }
      },
      // Port status indicators for temperature chart
      {
        name: 'Port',
        type: 'scatter',
        data: data
          .filter(d => d.magnet === 0) // Only show when port is open (magnet sensor false)
          .map(d => [d.timestamp, d.temperature]),
        symbol: 'triangle',
        symbolSize: 8,
        itemStyle: {
          color: '#9333EA',
          borderColor: '#fff',
          borderWidth: 1
        },
        tooltip: {
          show: false
        },
        silent: true,
        z: 10
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
    title: [
      {
        text: '💧 Humidité',
        left: 'center',
        top: 10,
        textStyle: {
          color: '#3B82F6',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      {
        text: dateRange.type === '50frames' ? 'Dernières 50 données' : `${new Date(dateRange.start).toLocaleDateString('fr-FR')} - ${new Date(dateRange.end).toLocaleDateString('fr-FR')}`,
        left: 'center',
        top: 35,
        textStyle: {
          color: '#6B7280',
          fontSize: 12,
          fontWeight: 'normal'
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      textStyle: {
        color: '#fff'
      },
      formatter: function(params: any) {
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const value = point.data[1].toFixed(1);
        const movementStatus = point.data[2] || 0;
        let status = '';
        
        if (value < 85) status = ' 🔴 Trop sec';
        else if (value > 95) status = ' 🟡 Trop humide';
        else status = ' ✅ Optimal pommes';
        
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; color: #3B82F6; margin-bottom: 4px;">💧 Humidité</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${time}</strong></div>
            <div style="font-size: 16px; margin-bottom: 4px;">${point.marker} <strong>${value}%</strong></div>
            <div style="font-size: 12px; color: #6B7280; margin-bottom: 2px;">${status}</div>
            <div style="font-size: 12px; color: #9333EA;">${movementStatus === 1 ? '🔒 Port Fermé' : '🔓 Port Ouvert'}</div>
          </div>
        `;
      }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '18%',
      top: '20%',
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
        formatter: function(value: number) {
          return new Date(value).toLocaleTimeString('fr-FR', { 
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
      }
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
      axisPointer: {
        snap: true,
        lineStyle: {
          color: '#999',
          type: 'dashed',
          width: 1
        },
        handle: {
          show: true,
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
        symbolSize: 6,
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
                  fontSize: 12,
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
                fontSize: 11,
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
                fontSize: 11,
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
      // Port status indicators for humidity chart
      {
        name: 'Port',
        type: 'scatter',
        data: data
          .filter(d => d.magnet === 0) // Only show when port is open (magnet sensor false)
          .map(d => [d.timestamp, d.humidity]),
        symbol: 'triangle',
        symbolSize: 8,
        itemStyle: {
          color: '#9333EA',
          borderColor: '#fff',
          borderWidth: 1
        },
        tooltip: {
          show: false
        },
        silent: true,
        z: 10
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-2xl shadow-2xl max-w-7xl w-full max-h-[98vh] sm:max-h-[90vh] overflow-hidden mx-1 sm:mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm sm:text-lg">📊</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Historique des Capteurs</h2>
              <p className="text-xs sm:text-sm text-gray-600 truncate">{sensorName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Refresh Button */}
            <button
              onClick={() => {
                setData([]);
                setLoading(true);
                setError(null);
                fetchSensorData();
              }}
              disabled={loading}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0 ${
                loading 
                  ? 'bg-gray-100 cursor-not-allowed' 
                  : 'bg-blue-100 hover:bg-blue-200'
              }`}
              title="Actualiser les données"
            >
              {loading ? (
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0"
            >
              <span className="text-gray-600 text-base sm:text-lg">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-2 sm:p-6 overflow-y-auto min-h-0">
          {/* Modern Date Range Selector */}
          <div className="mb-3 sm:mb-6 p-2 sm:p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center space-y-2 sm:space-y-4">
              {/* Quick Range Buttons - Centered */}
              <div className="flex justify-center flex-wrap gap-2 sm:gap-3">
                <button
                  onClick={() => setQuickRange(1, '24h')}
                  className={`px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 shadow-sm ${
                    isRangeSelected('24h')
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  📅 24h
                </button>
                <button
                  onClick={() => setQuickRange(7, '7j')}
                  className={`px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 shadow-sm ${
                    isRangeSelected('7j')
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  📊 7j
                </button>
                <button
                  onClick={() => setQuickRange(30, '30j')}
                  className={`px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 shadow-sm ${
                    isRangeSelected('30j')
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  📈 30j
                </button>
                <button
                  onClick={setLast50Frames}
                  className={`px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 shadow-sm ${
                    isRangeSelected('50frames')
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  📋 50 frames
                </button>
              </div>
              
              {/* Divider */}
              <div className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
              
              {/* Custom Date Range - Centered */}
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-slate-600 font-medium text-xs sm:text-sm">📅 Du:</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-2 sm:px-3 py-1 sm:py-2 border border-slate-300 rounded-md sm:rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  />
                </div>
                <span className="text-slate-400 hidden sm:block">→</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-slate-600 font-medium text-xs sm:text-sm">📅 Au:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-2 sm:px-3 py-1 sm:py-2 border border-slate-300 rounded-md sm:rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
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

          {!loading && !error && data.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📈</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée disponible</h3>
              <p className="text-gray-600">Aucune donnée de capteur trouvée pour cette période.</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="space-y-4 sm:space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-6">
                <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-red-600 text-xs sm:text-sm font-medium truncate">Température</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-700">
                        {data.length > 0 ? data[data.length - 1].temperature.toFixed(1) : '0.0'}°C
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <span className="text-red-500 text-xl sm:text-2xl flex-shrink-0 ml-2">🌡️</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-blue-600 text-xs sm:text-sm font-medium truncate">Humidité</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-700">
                        {data.length > 0 ? data[data.length - 1].humidity.toFixed(1) : '0.0'}%
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <span className="text-blue-500 text-xl sm:text-2xl flex-shrink-0 ml-2">💧</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-purple-600 text-xs sm:text-sm font-medium truncate">Port</p>
                      <p className="text-lg sm:text-2xl font-bold text-purple-700">
                        {data.length > 0 ? (data[data.length - 1].magnet === 1 ? 'Fermé' : 'Ouvert') : 'N/A'}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        {data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <span className="text-purple-500 text-xl sm:text-2xl flex-shrink-0 ml-2">
                      {data.length > 0 ? (data[data.length - 1].magnet === 1 ? '🔒' : '🔓') : '❓'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-green-600 text-xs sm:text-sm font-medium truncate">Batterie</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-700">
                        {data.length > 0 ? data[data.length - 1].battery.toFixed(1) : '0.0'}V
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {data.length > 0 ? new Date(data[data.length - 1].timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <span className="text-green-500 text-xl sm:text-2xl flex-shrink-0 ml-2">🔋</span>
                  </div>
                </div>
              </div>

              {/* Separate Charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-6">
                {/* Temperature Chart */}
                <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm">
                  <ReactECharts 
                    option={temperatureChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                  {/* Temperature Range Info - Small without icon */}
                  <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-md sm:rounded-lg">
                    <div className="text-center">
                      <p className="text-xs font-bold text-blue-800">
                        ZONE OPTIMALE
                      </p>
                      <p className="text-xs text-blue-700 font-medium">
                        0°C - 4°C Température
                      </p>
                    </div>
                  </div>
                </div>

                {/* Humidity Chart */}
                <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-1 sm:p-4 shadow-sm">
                  <ReactECharts 
                    option={humidityChartOption} 
                    style={{ height: '250px', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                  {/* Humidity Range Info - Small without icon */}
                  <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-gradient-to-r from-green-50 to-green-100 border border-green-300 rounded-md sm:rounded-lg">
                    <div className="text-center">
                      <p className="text-xs font-bold text-green-800">
                        ZONE OPTIMALE
                      </p>
                      <p className="text-xs text-green-700 font-medium">
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