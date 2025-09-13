import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { AlertItem } from '../../types/metrics';

interface AlertListProps {
  alerts: AlertItem[];
}

export const AlertList: React.FC<AlertListProps> = ({ alerts }) => {
  const { t, i18n } = useTranslation();

  const localizeMessage = (message: string) => {
    // Known patterns from seed data
    let m = message.match(/^Humidity sensor malfunction in (.+)$/i);
    if (m) return t('alerts.msg.humidityMalfunction', { room: m[1] }) as string;
    m = message.match(/^Temperature slightly high in (.+)$/i);
    if (m) return t('alerts.msg.tempSlightlyHigh', { room: m[1] }) as string;
    m = message.match(/^Maintenance scheduled for (.+) tomorrow$/i);
    if (m) return t('alerts.msg.maintenanceTomorrow', { room: m[1] }) as string;
    return message;
  };

  const getAlertConfig = (type: AlertItem['type']) => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          color: 'from-yellow-400 to-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          badgeColor: 'bg-yellow-100 text-yellow-800'
        };
      case 'error':
        return {
          icon: '🚨',
          color: 'from-red-400 to-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          badgeColor: 'bg-red-100 text-red-800'
        };
      case 'info':
        return {
          icon: 'ℹ️',
          color: 'from-blue-400 to-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      default:
        return {
          icon: 'ℹ️',
          color: 'from-gray-400 to-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          badgeColor: 'bg-gray-100 text-gray-800'
        };
    }
  };

  if (alerts.length === 0) {
    return (
      <Card title={t('dashboard.alerts')} className="h-full">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('alerts.allClear', 'Tout est en ordre !')}</h3>
          <p className="text-gray-500">{t('alerts.noAlerts')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('dashboard.alerts')} className="h-full">
      <div className="space-y-4">
        {alerts.map((alert) => {
          const config = getAlertConfig(alert.type);
          
          return (
            <div
              key={alert.id}
              className={`relative overflow-hidden rounded-xl border ${config.borderColor} ${config.bgColor} p-4 hover:shadow-md transition-all duration-200 group`}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-r ${config.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center text-xl`}>
                      {config.icon}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
                        {t(`alerts.${alert.type}`, alert.type).toString()}
                      </span>
                      {alert.roomId && (
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border">
                          {t('alerts.room', 'Salle')}: {alert.roomId}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm font-medium ${config.textColor} mb-2`}>
                      {localizeMessage(alert.message)}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(alert.timestamp).toLocaleString(i18n.language)}
                    </div>
                  </div>
                  
                  {/* Action button */}
                  <div className="flex-shrink-0">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg hover:bg-white hover:shadow-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
