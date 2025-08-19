import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Simple in-memory cache with TTL (Time To Live) support
 * Reduces API calls and improves performance for frequently accessed data
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.subscribers = new Map();
  }

  set(key, value, ttlSeconds = 300) { // Default 5 minutes TTL
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    // Notify subscribers
    const keySubscribers = this.subscribers.get(key) || new Set();
    keySubscribers.forEach(callback => callback(value));

    console.log(`📦 Cached "${key}" (TTL: ${ttlSeconds}s)`);
  }

  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      console.log(`🗑️ Cache expired for "${key}"`);
      return null;
    }

    const ageSeconds = Math.floor((Date.now() - cached.createdAt) / 1000);
    console.log(`✅ Cache hit for "${key}" (age: ${ageSeconds}s)`);
    
    return cached.value;
  }

  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Manually deleted cache for "${key}"`);
    }
    return deleted;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cleared ${size} cache entries`);
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    return {
      total: this.cache.size,
      active: activeCount,
      expired: expiredCount
    };
  }

  // Subscribe to cache updates for a specific key
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }

    return cleanedCount;
  }
}

// Global cache instance
const globalCache = new CacheManager();

// Cleanup expired entries every 5 minutes
setInterval(() => globalCache.cleanup(), 5 * 60 * 1000);

/**
 * React hook for caching data with automatic revalidation
 */
const useCache = (key, fetcher, options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    refreshInterval = null, // Auto-refresh interval in seconds
    enabled = true
  } = options;

  const [data, setData] = useState(() => globalCache.get(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef();
  const lastFetchRef = useRef(0);
  const mountedRef = useRef(true);

  // Fetch data function
  const fetchData = useCallback(async (force = false) => {
    if (!enabled || !fetcher) return;

    // Check cache first (unless forced)
    if (!force && globalCache.has(key)) {
      const cachedData = globalCache.get(key);
      if (cachedData !== null) {
        setData(cachedData);
        return cachedData;
      }
    }

    // Prevent duplicate fetches
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 1000) {
      return data;
    }

    lastFetchRef.current = now;
    setLoading(true);
    setError(null);

    try {
      console.log(`🌐 Fetching data for cache key "${key}"`);
      const result = await fetcher();
      
      if (mountedRef.current) {
        setData(result);
        setError(null);
        
        // Cache the result
        globalCache.set(key, result, ttl);
      }
      
      return result;
    } catch (err) {
      console.error(`❌ Failed to fetch data for "${key}":`, err);
      
      if (mountedRef.current) {
        setError(err);
        
        // Try to use stale cache data on error
        const staleData = globalCache.get(key);
        if (staleData) {
          console.log(`🔄 Using stale cache data for "${key}"`);
          setData(staleData);
        }
      }
      
      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [key, fetcher, ttl, enabled, data]);

  // Mutate cache manually
  const mutate = useCallback((newData, shouldRevalidate = true) => {
    if (newData !== undefined) {
      globalCache.set(key, newData, ttl);
      setData(newData);
    }
    
    if (shouldRevalidate) {
      return fetchData(true);
    }
  }, [key, ttl, fetchData]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && enabled) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval * 1000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, enabled, fetchData]);

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus || !enabled) return;

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, enabled, fetchData]);

  // Revalidate on network reconnect
  useEffect(() => {
    if (!revalidateOnReconnect || !enabled) return;

    const handleOnline = () => {
      fetchData(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, enabled, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    mutate,
    revalidate: () => fetchData(true)
  };
};

// Export cache manager for direct access
export { globalCache };
export default useCache;