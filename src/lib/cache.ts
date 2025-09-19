const STORAGE_PREFIX = 'frigo-cache:';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  /** Milliseconds before cached data is considered stale. Defaults to 5 minutes. */
  ttlMs?: number;
  /** Whether to attempt background refresh when cached data is returned. */
  refreshInBackground?: boolean;
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readCache = <T>(key: string): CacheEntry<T> | null => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch (error) {
    console.warn('[cache] Failed to read cache for key', key, error);
    return null;
  }
};

const writeCache = <T>(key: string, data: T) => {
  if (!isBrowser) return;
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[cache] Failed to write cache for key', key, error);
  }
};

export const fetchWithCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> => {
  const {
    ttlMs = 1000 * 60 * 5, // 5 minutes
    refreshInBackground = true,
  } = options;

  const cacheEntry = readCache<T>(key);
  const isCacheValid = cacheEntry && Date.now() - cacheEntry.timestamp <= ttlMs;

  if (cacheEntry && isCacheValid) {
    if (refreshInBackground) {
      fetchFn()
        .then((freshData) => writeCache(key, freshData))
        .catch((error) => {
          console.warn('[cache] Background refresh failed for key', key, error);
        });
    }
    return cacheEntry.data;
  }

  try {
    const freshData = await fetchFn();
    writeCache(key, freshData);
    return freshData;
  } catch (error) {
    if (cacheEntry) {
      console.warn('[cache] Using stale cache for key', key, error);
      return cacheEntry.data;
    }
    throw error;
  }
};
