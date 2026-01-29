import { useEffect, useCallback } from 'react';
import { useMapStore } from './useMapStore';
import type { LatestForecastInfo } from '@/types';

/**
 * Hook to fetch and maintain the latest forecast info in the global store.
 * This tracks when model data was last updated and what forecast hours are available.
 */
export function useLatestForecast() {
  const setLatestInfo = useMapStore((s) => s.setLatestInfo);

  const fetchLatestInfo = useCallback(async () => {
    try {
      // Try to get latest info from our API
      const res = await fetch('/api/waves/grid?direct=false');
      if (res.ok) {
        const data = await res.json();

        // Build latest info from API response
        const info: LatestForecastInfo = {
          wavewatch: {
            run: data.modelRun || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
            timestamp: data.timestamp || new Date().toISOString(),
          },
        };

        setLatestInfo(info);
      }
    } catch (err) {
      console.error('Failed to load latest forecast info:', err);
    }
  }, [setLatestInfo]);

  useEffect(() => {
    // Fetch immediately
    fetchLatestInfo();

    // Refresh every 10 minutes to catch new forecast runs
    const interval = setInterval(fetchLatestInfo, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLatestInfo]);
}

export default useLatestForecast;
