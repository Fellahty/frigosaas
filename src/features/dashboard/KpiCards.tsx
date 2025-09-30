import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Kpis } from '../../types/metrics';

interface KpiCardsProps {
  kpis: Kpis;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  const { t } = useTranslation();

  const kpiData = [
    {
      title: t('dashboard.totalRooms'),
      value: kpis.totalRooms,
      icon: '🏠',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      trend: '+2.5%',
      trendUp: true,
    },
    {
      title: t('dashboard.totalClients'),
      value: kpis.totalClients,
      icon: '👥',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      trend: '+8.1%',
      trendUp: true,
    },
    {
      title: t('dashboard.alertsCount'),
      value: kpis.alertsCount,
      icon: '⚠️',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      trend: '-12.5%',
      trendUp: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {kpiData.map((kpi, index) => (
        <div key={index} className="relative bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
          
          {/* Content */}
          <div className="space-y-2">
            {/* Header with icon and trend */}
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center text-sm`}>
                {kpi.icon}
              </div>
              <div className={`text-[10px] font-medium ${kpi.textColor} flex items-center gap-0.5`}>
                {kpi.trendUp ? (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L12 7z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L12 13z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-[10px]">{kpi.trend}</span>
              </div>
            </div>
            
            {/* Value and title */}
            <div className="space-y-0.5">
              <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">{kpi.title}</p>
            </div>
          </div>
          
          {/* Subtle accent line */}
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${kpi.color} rounded-b-lg opacity-50`} />
        </div>
      ))}
    </div>
  );
};
