import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { RoomSummary } from '../../types/metrics';

interface RoomCapacityProps {
  rooms?: RoomSummary[];
}

export const RoomCapacity: React.FC<RoomCapacityProps> = ({ rooms = [] }) => {
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
    if (percentage >= 60) return { text: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
    return { text: 'Normal', color: 'text-green-600', bg: 'bg-green-100' };
  };

  return (
    <Card title={t('dashboard.roomCapacity')} className="h-full">
      <div className="space-y-4">
        {rooms.length > 0 ? (
          rooms.map((room) => {
          const occupancyPercentage = getOccupancyPercentage(room.currentOccupancy, room.capacity);
          const occupancyColor = getOccupancyColor(occupancyPercentage);
          const status = getOccupancyStatus(occupancyPercentage);

          return (
            <div key={room.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200">
              {/* Room header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h4 className="text-sm font-semibold text-gray-900">{room.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900">
                    {room.currentOccupancy}
                    <span className="text-sm font-normal text-gray-500">/{room.capacity}</span>
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.text}
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{t('rooms.capacity')}</span>
                  <span className="font-semibold">{occupancyPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 bg-gradient-to-r ${occupancyColor} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${occupancyPercentage}%` }}
                  >
                    <div className="h-full bg-white opacity-20 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t('rooms.temperature')}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{room.temperature.toFixed(1)}°C</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {t('rooms.humidity')}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{room.humidity.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          );
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noRooms')}</h3>
            <p className="text-gray-500">{t('dashboard.noRoomsDescription')}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
