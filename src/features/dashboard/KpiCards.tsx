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
      title: t('dashboard.averageTemperature'),
      value: `${kpis.averageTemperature.toFixed(1)}°C`,
      icon: '🌡️',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      trend: '-0.3°C',
      trendUp: false,
    },
    {
      title: t('dashboard.averageHumidity'),
      value: `${kpis.averageHumidity.toFixed(1)}%`,
      icon: '💧',
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      trend: '+1.2%',
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {kpiData.map((kpi, index) => (
        <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          {/* Background gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
          
          <div className="relative z-10">
            {/* Header with icon and trend */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${kpi.bgColor} flex items-center justify-center text-2xl`}>
                {kpi.icon}
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${kpi.textColor} flex items-center gap-1`}>
                  {kpi.trendUp ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L12 7z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L12 13z" clipRule="evenodd" />
                    </svg>
                  )}
                  {kpi.trend}
                </div>
              </div>
            </div>
            
            {/* Value and title */}
            <div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{kpi.value}</p>
              <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
            </div>
          </div>
          
          {/* Decorative corner */}
          <div className={`absolute top-0 right-0 w-20 h-20 ${kpi.bgColor} rounded-bl-full opacity-20`} />
        </Card>
      ))}
    </div>
  );
};
