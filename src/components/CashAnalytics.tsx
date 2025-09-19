import React from 'react';
import { Card } from './Card';
import { formatCurrency } from '../lib/dateUtils';
import { calculateCashFlowMetrics } from '../lib/cashValidation';

interface CashAnalyticsProps {
  movements: any[];
  currentBalance: number;
  initialBalance: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'red' | 'blue' | 'orange';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  trend = 'neutral',
  color = 'blue'
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'green': return 'from-green-500 to-green-600';
      case 'red': return 'from-red-500 to-red-600';
      case 'orange': return 'from-orange-500 to-orange-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getColorClasses()} flex items-center justify-center text-white text-xl`}>
          {getTrendIcon()}
        </div>
      </div>
    </Card>
  );
};

export const CashAnalytics: React.FC<CashAnalyticsProps> = ({
  movements,
  currentBalance,
  initialBalance
}) => {
  const metrics = calculateCashFlowMetrics(movements);
  
  // Calculate balance change
  const balanceChange = currentBalance - initialBalance;
  const balanceChangePercent = initialBalance > 0 
    ? ((balanceChange / initialBalance) * 100).toFixed(1)
    : '0.0';

  // Calculate trend indicators
  const todayVsYesterday = metrics.todayNet;
  const weeklyTrend = metrics.weeklyNet > 0 ? 'up' : metrics.weeklyNet < 0 ? 'down' : 'neutral';

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Solde Actuel"
          value={formatCurrency(currentBalance)}
          subtitle={`${balanceChange >= 0 ? '+' : ''}${formatCurrency(balanceChange)} (${balanceChangePercent}%)`}
          color={balanceChange >= 0 ? 'green' : 'red'}
          trend={balanceChange >= 0 ? 'up' : 'down'}
        />
        
        <MetricCard
          title="Entrées Aujourd'hui"
          value={formatCurrency(metrics.todayIn)}
          subtitle={`${metrics.todayMovementCount} mouvements`}
          color="green"
          trend="up"
        />
        
        <MetricCard
          title="Sorties Aujourd'hui"
          value={formatCurrency(metrics.todayOut)}
          subtitle={`Net: ${formatCurrency(metrics.todayNet)}`}
          color="red"
          trend="down"
        />
        
        <MetricCard
          title="Mouvement Moyen"
          value={formatCurrency(metrics.averageMovement)}
          subtitle={`Total: ${metrics.movementCount} mouvements`}
          color="blue"
        />
      </div>

      {/* Weekly Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vue d'ensemble de la semaine</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.weeklyIn)}
            </div>
            <div className="text-sm text-gray-600">Entrées cette semaine</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(metrics.weeklyOut)}
            </div>
            <div className="text-sm text-gray-600">Sorties cette semaine</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${metrics.weeklyNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.weeklyNet)}
            </div>
            <div className="text-sm text-gray-600">Net cette semaine</div>
          </div>
        </div>
      </Card>

      {/* Cash Flow Chart Placeholder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance des flux de trésorerie</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>Graphique des flux de trésorerie</p>
            <p className="text-sm">À implémenter avec une bibliothèque de graphiques</p>
          </div>
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights & Recommandations</h3>
        <div className="space-y-3">
          {metrics.todayNet > 0 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <span className="text-green-500 text-xl">✅</span>
              <div>
                <p className="text-sm font-medium text-green-800">Journée positive</p>
                <p className="text-xs text-green-600">
                  Les entrées dépassent les sorties de {formatCurrency(metrics.todayNet)}
                </p>
              </div>
            </div>
          )}
          
          {metrics.todayNet < 0 && (
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
              <span className="text-red-500 text-xl">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-800">Attention aux sorties</p>
                <p className="text-xs text-red-600">
                  Les sorties dépassent les entrées de {formatCurrency(Math.abs(metrics.todayNet))}
                </p>
              </div>
            </div>
          )}
          
          {metrics.averageMovement > 1000 && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-500 text-xl">💰</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Mouvements importants</p>
                <p className="text-xs text-blue-600">
                  Mouvement moyen élevé: {formatCurrency(metrics.averageMovement)}
                </p>
              </div>
            </div>
          )}
          
          {metrics.movementCount > 50 && (
            <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
              <span className="text-orange-500 text-xl">📈</span>
              <div>
                <p className="text-sm font-medium text-orange-800">Activité élevée</p>
                <p className="text-xs text-orange-600">
                  {metrics.movementCount} mouvements enregistrés
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
