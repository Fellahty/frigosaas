import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes - longer cache for offline
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!navigator.onLine) return false;
        // Retry up to 3 times for network errors
        if (failureCount < 3) return true;
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // Refetch when back online
      refetchOnMount: true,
      // Keep data fresh longer when offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations if offline
        if (!navigator.onLine) return false;
        // Retry once for network errors
        return failureCount < 1;
      },
      networkMode: 'offlineFirst',
    },
  },
});
