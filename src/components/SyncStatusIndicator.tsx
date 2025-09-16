import React from 'react';
import { useOfflineSync } from '../lib/hooks/useOfflineSync';

interface SyncStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const { syncStatus } = useOfflineSync();

  // Fallback for when syncStatus is not available
  if (!syncStatus) {
    return (
      <div className={`flex items-center space-x-2 ${className}`} title="Sync status unavailable">
        <div className="flex items-center space-x-1 text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
          {showDetails && <span className="text-xs">Unknown</span>}
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (syncStatus.error) {
      return (
        <div className="flex items-center space-x-1 text-red-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {showDetails && <span className="text-xs">Error</span>}
        </div>
      );
    }

    if (!syncStatus.isOnline) {
      return (
        <div className="flex items-center space-x-1 text-orange-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
          {showDetails && <span className="text-xs">Offline</span>}
        </div>
      );
    }

    if (syncStatus.isSyncing) {
      return (
        <div className="flex items-center space-x-1 text-blue-600">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {showDetails && <span className="text-xs">Syncing</span>}
        </div>
      );
    }

    if (syncStatus.pendingChanges > 0) {
      return (
        <div className="flex items-center space-x-1 text-yellow-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {showDetails && <span className="text-xs">{syncStatus.pendingChanges}</span>}
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1 text-green-600">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        {showDetails && <span className="text-xs">Synced</span>}
      </div>
    );
  };

  const getTooltipText = () => {
    if (syncStatus.error) return `Sync Error: ${syncStatus.error}`;
    if (!syncStatus.isOnline) return 'Working offline - changes will sync when back online';
    if (syncStatus.isSyncing) return 'Syncing data...';
    if (syncStatus.pendingChanges > 0) return `${syncStatus.pendingChanges} pending changes`;
    if (syncStatus.lastSyncTime) return `Last sync: ${syncStatus.lastSyncTime.toLocaleTimeString()}`;
    return 'All data synced';
  };

  const getStatusText = () => {
    if (syncStatus.error) return 'Error';
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.isSyncing) return 'Syncing...';
    if (syncStatus.pendingChanges > 0) return `${syncStatus.pendingChanges} pending`;
    return 'Synced';
  };

  return (
    <div 
      className={`flex items-center space-x-2 ${className}`}
      title={getTooltipText()}
    >
      {getStatusIcon()}
      {showDetails && (
        <div className="flex flex-col">
          <span className="text-xs font-medium">{getStatusText()}</span>
          {syncStatus.lastSyncTime && (
            <span className="text-xs text-gray-500">
              {syncStatus.lastSyncTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
