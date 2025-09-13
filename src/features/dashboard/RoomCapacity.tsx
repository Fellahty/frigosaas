import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { RoomSummary } from '../../types/metrics';

interface RoomCapacityProps {
  rooms: RoomSummary[];
}

export const RoomCapacity: React.FC<RoomCapacityProps> = ({ rooms }) => {
  const { t } = useTranslation();

  const getOccupancyPercentage = (current: number, capacity: number) => {
    return Math.round((current / capacity) * 100);
  };

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 80) return 'from-red-500 to-red-600';
    if (percentage >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-green-500 to-green-600';
  };

  const getOccupancyStatus = (percentage: number) => {
    if (percentage >= 80) return { text: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
    if (percentage >= 60) return { text: 'Warning', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'Normal', color: 'text-green-600', bg: 'bg-green-100' };
  };

  return (
    <Card title={t('dashboard.roomCapacity')} className="h-full">
      <div className="space-y-6">
        {rooms.map((room) => {
          const occupancyPercentage = getOccupancyPercentage(room.currentOccupancy, room.capacity);
          const occupancyColor = getOccupancyColor(occupancyPercentage);
          const status = getOccupancyStatus(occupancyPercentage);

          return (
            <div key={room.id} className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors duration-200">
              {/* Room header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h4 className="text-lg font-semibold text-gray-900">{room.name}</h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    {room.currentOccupancy}
                    <span className="text-lg font-normal text-gray-500">/{room.capacity}</span>
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.text}
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{t('rooms.capacity')}</span>
                  <span className="font-semibold">{occupancyPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 bg-gradient-to-r ${occupancyColor} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${occupancyPercentage}%` }}
                  >
                    <div className="h-full bg-white opacity-20 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t('rooms.temperature')}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{room.temperature.toFixed(1)}°C</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t('rooms.humidity')}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{room.humidity.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
