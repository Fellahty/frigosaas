# Firestore Offline Cache & Auto-Sync Features

This document explains the offline capabilities implemented in the Frigo SaaS application.

## 🚀 Features Implemented

### 1. Firestore Offline Persistence
- **IndexedDB Storage**: Data is automatically cached locally using IndexedDB
- **Automatic Sync**: Changes sync automatically when back online
- **Multi-tab Support**: Gracefully handles multiple tabs with persistence warnings

### 2. Smart Data Fetching
- **Offline-First Queries**: Uses cached data when offline, syncs when online
- **Real-time Updates**: Live data updates when connected
- **Error Handling**: Graceful fallback to cached data on network errors

### 3. Visual Sync Indicators
- **Status Icons**: Shows sync status (online/offline/syncing/error)
- **Last Sync Time**: Displays when data was last synchronized
- **Pending Changes**: Shows number of queued operations

### 4. Smart Retry Logic
- **Automatic Retry**: Failed operations retry when back online
- **Exponential Backoff**: Smart retry delays to avoid overwhelming the server
- **Mutation Queuing**: Offline mutations are queued and executed when online

## 📁 Files Created/Modified

### New Files
- `src/lib/hooks/useOfflineSync.ts` - Core offline sync hooks
- `src/components/SyncStatusIndicator.tsx` - UI component for sync status
- `src/features/dashboard/OfflineDashboardPage.tsx` - Example offline-aware page
- `docs/OFFLINE_FEATURES.md` - This documentation

### Modified Files
- `src/lib/firebase.ts` - Added offline persistence and network management
- `src/lib/queryClient.ts` - Enhanced React Query config for offline support
- `src/app/App.tsx` - Initialize offline persistence on app start
- `src/app/Layout.tsx` - Added sync status indicators to UI

## 🔧 How to Use

### 1. Basic Offline Query
```typescript
import { useOfflineQuery } from '../lib/hooks/useOfflineSync';

const { data, isLoading, error, isOffline, refetch } = useOfflineQuery(
  ['clients', tenantId],
  async () => {
    const q = query(collection(db, 'tenants', tenantId, 'clients'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  undefined, // No realtime query
  {
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }
);
```

### 2. Real-time Query with Offline Support
```typescript
const { data, isLoading, error, isOffline, lastSync } = useOfflineQuery(
  ['receptions', tenantId],
  async () => {
    // Initial data fetch
    const q = query(collection(db, 'receptions'), where('tenantId', '==', tenantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  {
    collection: 'receptions',
    constraints: [where('tenantId', '==', tenantId)],
    transform: (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },
  {
    enabled: !!tenantId,
  }
);
```

### 3. Offline-Aware Mutations
```typescript
import { useOfflineMutation } from '../lib/hooks/useOfflineSync';

const { mutate, isLoading, error, pendingMutations } = useOfflineMutation(
  async (clientData) => {
    const docRef = doc(db, 'tenants', tenantId, 'clients');
    await setDoc(docRef, clientData);
  },
  {
    onSuccess: () => {
      toast.success('Client created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create client');
    },
    retryOnReconnect: true, // Queue for retry when back online
  }
);
```

### 4. Sync Status Monitoring
```typescript
import { useOfflineSync } from '../lib/hooks/useOfflineSync';

const { syncStatus, updateSyncStatus } = useOfflineSync();

// syncStatus contains:
// - isOnline: boolean
// - isSyncing: boolean
// - lastSyncTime: Date | null
// - pendingChanges: number
// - error: string | null
```

## 🎨 UI Components

### SyncStatusIndicator
```tsx
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';

// Basic indicator
<SyncStatusIndicator />

// With details
<SyncStatusIndicator showDetails={true} />
```

## ⚙️ Configuration

### React Query Configuration
The query client is configured with offline-first behavior:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst', // Use cache when offline
      refetchOnReconnect: true,    // Refetch when back online
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false; // Don't retry when offline
        return failureCount < 3; // Retry up to 3 times
      },
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false;
        return failureCount < 1; // Retry once
      },
    },
  },
});
```

### Firebase Configuration
Offline persistence is automatically enabled:

```typescript
// In src/lib/firebase.ts
export const enableOfflinePersistence = async () => {
  try {
    await enableIndexedDbPersistence(db);
    console.log('✅ Firestore offline persistence enabled');
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all features required for persistence');
    }
  }
};
```

## 🔄 How It Works

### 1. Data Flow
1. **Initial Load**: Data is fetched from Firestore and cached locally
2. **Offline Mode**: App continues to work with cached data
3. **Back Online**: Data automatically syncs and updates in real-time
4. **Mutations**: Offline changes are queued and applied when online

### 2. Cache Strategy
- **Stale-While-Revalidate**: Shows cached data immediately, fetches fresh data in background
- **Long Cache Time**: Data stays in cache for 30 minutes
- **Smart Invalidation**: Cache is invalidated when data changes

### 3. Error Handling
- **Network Errors**: Gracefully falls back to cached data
- **Sync Errors**: Shows error status and allows manual retry
- **Offline Mutations**: Queues operations for later execution

## 🚨 Important Notes

### Browser Compatibility
- **IndexedDB Required**: Modern browsers only
- **Service Worker**: Not required, but recommended for PWA features
- **Storage Limits**: IndexedDB has generous storage limits (usually 50MB+)

### Performance Considerations
- **Cache Size**: Monitor cache size in production
- **Sync Frequency**: Real-time updates only when online
- **Memory Usage**: Cached data is kept in memory for quick access

### Security
- **Data Encryption**: Cached data is not encrypted (consider for sensitive data)
- **Access Control**: Firestore security rules still apply
- **Offline Access**: Users can only access data they're authorized to see

## 🧪 Testing Offline Features

### 1. Chrome DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Test app functionality

### 2. Manual Testing
1. Load the app with data
2. Disconnect from internet
3. Navigate and interact with the app
4. Reconnect and verify sync

### 3. Console Monitoring
```javascript
// Monitor sync status
window.addEventListener('online', () => console.log('Back online'));
window.addEventListener('offline', () => console.log('Gone offline'));
```

## 🔧 Troubleshooting

### Common Issues

1. **Persistence Not Working**
   - Check browser console for errors
   - Ensure IndexedDB is supported
   - Verify no other tabs have persistence enabled

2. **Data Not Syncing**
   - Check network connection
   - Verify Firestore security rules
   - Check console for error messages

3. **Performance Issues**
   - Monitor cache size
   - Check for memory leaks
   - Optimize query patterns

### Debug Commands
```javascript
// Check offline status
console.log('Online:', navigator.onLine);

// Check Firestore persistence
console.log('Persistence enabled:', db._delegate._settings?.cacheSizeBytes > 0);

// Clear cache (development only)
// await clearIndexedDbPersistence();
```

## 📈 Future Enhancements

### Planned Features
- **Background Sync**: Sync data in background using Service Workers
- **Conflict Resolution**: Handle data conflicts when multiple users edit
- **Selective Sync**: Choose which data to sync offline
- **Compression**: Compress cached data to save space
- **Analytics**: Track offline usage patterns

### Advanced Configuration
- **Custom Cache Policies**: Per-query cache strategies
- **Sync Intervals**: Configurable sync frequency
- **Data Compression**: Compress large datasets
- **Selective Persistence**: Choose collections to persist

## 📚 Resources

- [Firebase Offline Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [React Query Offline Support](https://tanstack.com/query/v4/docs/guides/offline)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
