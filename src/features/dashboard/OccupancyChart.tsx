import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { RoomSummary } from '../../types/metrics';

interface OccupancyChartProps {
  rooms: RoomSummary[];
}

export const OccupancyChart: React.FC<OccupancyChartProps> = ({ rooms }) => {
  const { t } = useTranslation();

  const getOccupancyPercentage = (current: number, capacity: number) => {
    return Math.round((current / capacity) * 100);
  };

  const getBatteryConfig = (percentage: number) => {
    if (percentage >= 80) {
      return {
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        textColor: 'text-red-700',
        status: 'Critical',
        statusColor: 'text-red-600',
        statusBg: 'bg-red-100',
        barColor: 'bg-red-500',
        glow: 'shadow-red-500/30'
      };
    }
    if (percentage >= 60) {
      return {
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-300',
        textColor: 'text-orange-700',
        status: 'Warning',
        statusColor: 'text-orange-600',
        statusBg: 'bg-orange-100',
        barColor: 'bg-orange-500',
        glow: 'shadow-orange-500/30'
      };
    }
    if (percentage >= 40) {
      return {
        color: 'from-yellow-500 to-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        textColor: 'text-yellow-700',
        status: 'Moderate',
        statusColor: 'text-yellow-600',
        statusBg: 'bg-yellow-100',
        barColor: 'bg-yellow-500',
        glow: 'shadow-yellow-500/30'
      };
    }
    if (percentage >= 20) {
      return {
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        textColor: 'text-blue-700',
        status: 'Low',
        statusColor: 'text-blue-600',
        statusBg: 'bg-blue-100',
        barColor: 'bg-blue-500',
        glow: 'shadow-blue-500/30'
      };
    }
    return {
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300',
      textColor: 'text-green-700',
      status: 'Empty',
      statusColor: 'text-green-600',
      statusBg: 'bg-green-100',
      barColor: 'bg-green-500',
      glow: 'shadow-green-500/30'
    };
  };

  const maxCapacity = Math.max(...rooms.map(room => room.capacity));

  return (
    <Card title="Graphique d'Occupation des Salles" className="h-full">
      <div className="space-y-6">
        {/* Enhanced Chart */}
        <div className="space-y-6">
          {rooms.map((room) => {
            const occupancyPercentage = getOccupancyPercentage(room.currentOccupancy, room.capacity);
            const barWidth = (room.currentOccupancy / maxCapacity) * 100;
            const batteryConfig = getBatteryConfig(occupancyPercentage);
            
            return (
              <div key={room.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${batteryConfig.color} shadow-lg`}></div>
                    <span className="font-semibold text-gray-900">{room.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">
                      {room.currentOccupancy}/{room.capacity}
                    </div>
                    <div className="text-xs text-gray-500">{occupancyPercentage}%</div>
                  </div>
                </div>
                
                {/* Enhanced Progress Bar */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden border border-gray-300">
                    <div
                      className={`h-5 ${batteryConfig.barColor} rounded-full transition-all duration-1000 ease-out relative ${batteryConfig.glow}`}
                      style={{ width: `${barWidth}%` }}
                    >
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"></div>
                      
                      {/* Battery level indicator */}
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="w-1 h-3 bg-white rounded-full opacity-80"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced capacity markers */}
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span className="font-medium">0</span>
                    <span className="font-medium">{Math.round(maxCapacity * 0.25)}</span>
                    <span className="font-medium">{Math.round(maxCapacity * 0.5)}</span>
                    <span className="font-medium">{Math.round(maxCapacity * 0.75)}</span>
                    <span className="font-medium">{maxCapacity}</span>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex justify-end">
                  <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${batteryConfig.statusColor} ${batteryConfig.statusBg} border border-current`}>
                    {batteryConfig.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {rooms.reduce((sum, room) => sum + room.currentOccupancy, 0)}
            </div>
            <div className="text-xs text-blue-700 font-medium">Total Occupied</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {rooms.reduce((sum, room) => sum + room.capacity, 0)}
            </div>
            <div className="text-xs text-green-700 font-medium">Total Capacity</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {Math.round(
                (rooms.reduce((sum, room) => sum + room.currentOccupancy, 0) /
                  rooms.reduce((sum, room) => sum + room.capacity, 0)) * 100
              )}%
            </div>
            <div className="text-xs text-purple-700 font-medium">Overall Usage</div>
          </div>
        </div>

        {/* Enhanced Room Status Summary */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Résumé des Statuts
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Vide (0-19%)', color: 'from-green-500 to-green-600', bg: 'bg-green-100', text: 'text-green-700', count: rooms.filter(r => getOccupancyPercentage(r.currentOccupancy, r.capacity) < 20).length },
              { label: 'Faible (20-39%)', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-100', text: 'text-blue-700', count: rooms.filter(r => getOccupancyPercentage(r.currentOccupancy, r.capacity) >= 20 && getOccupancyPercentage(r.currentOccupancy, r.capacity) < 40).length },
              { label: 'Modéré (40-59%)', color: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-100', text: 'text-yellow-700', count: rooms.filter(r => getOccupancyPercentage(r.currentOccupancy, r.capacity) >= 40 && getOccupancyPercentage(r.currentOccupancy, r.capacity) < 60).length },
              { label: 'Attention (60-79%)', color: 'from-orange-500 to-orange-600', bg: 'bg-orange-100', text: 'text-orange-700', count: rooms.filter(r => getOccupancyPercentage(r.currentOccupancy, r.capacity) >= 60 && getOccupancyPercentage(r.currentOccupancy, r.capacity) < 80).length },
              { label: 'Critique (80-100%)', color: 'from-red-500 to-red-600', bg: 'bg-red-100', text: 'text-red-700', count: rooms.filter(r => getOccupancyPercentage(r.currentOccupancy, r.capacity) >= 80).length },
            ].map((status, index) => (
              <div key={index} className={`${status.bg} rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow duration-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${status.color}`}></div>
                    <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${status.text}`}>{status.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
