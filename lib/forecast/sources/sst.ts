/**
 * NOAA OISST (Optimum Interpolation Sea Surface Temperature) Data Source
 * Provides global SST coverage via satellite data
 *
 * Data source: NOAA CoastWatch ERDDAP
 * Resolution: 0.25 degrees (~28km)
 * Update frequency: Daily
 */

import { QualityFlag } from '@/types';

const OISST_BASE_URL = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg.json';

export interface SSTData {
  temperature: number;  // Celsius
  timestamp: string;
  quality: QualityFlag;
  source: 'oisst' | 'buoy';
}

// In-memory cache for SST data
interface SSTCacheEntry {
  data: SSTData;
  timestamp: number;
}

const sstCache = new Map<string, SSTCacheEntry>();
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Track failed locations to avoid repeated fetch attempts
const failedLocationCache = new Map<string, number>();
const FAILED_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Generate cache key for a location (rounded to 0.25 degree grid)
 */
function getCacheKey(lat: number, lon: number): string {
  // Round to 0.25 degree grid (OISST resolution)
  const roundedLat = Math.round(lat * 4) / 4;
  const roundedLon = Math.round(lon * 4) / 4;
  return `${roundedLat.toFixed(2)},${roundedLon.toFixed(2)}`;
}

/**
 * Get the most recent available date for OISST data
 * OISST has ~1 day latency, so use yesterday's date
 */
function getOISSTDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1); // Yesterday
  return date.toISOString().split('T')[0];
}

/**
 * Parse ERDDAP JSON response
 */
function parseERDDAPResponse(json: any): number | null {
  try {
    // ERDDAP returns: { table: { columnNames: [...], rows: [[...]] } }
    if (!json?.table?.rows || json.table.rows.length === 0) {
      return null;
    }

    const row = json.table.rows[0];
    const columnNames = json.table.columnNames;
    const sstIndex = columnNames.indexOf('sst');

    if (sstIndex === -1 || row[sstIndex] === null) {
      return null;
    }

    const sst = parseFloat(row[sstIndex]);
    return isNaN(sst) ? null : sst;
  } catch {
    return null;
  }
}

/**
 * Fetch SST from NOAA OISST for a specific location
 */
export async function fetchOISSTData(
  lat: number,
  lon: number
): Promise<SSTData | null> {
  // Check cache first
  const cacheKey = getCacheKey(lat, lon);
  const cached = sstCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  // Check if this location recently failed
  const failedAt = failedLocationCache.get(cacheKey);
  if (failedAt && (Date.now() - failedAt) < FAILED_CACHE_DURATION) {
    return null; // Skip recently failed locations
  }

  try {
    // Round coordinates to OISST grid
    const roundedLat = Math.round(lat * 4) / 4;
    const roundedLon = Math.round(lon * 4) / 4;
    const date = getOISSTDate();

    // Build ERDDAP query
    // Format: sst[(time)][(lat)][(lon)]
    const url = `${OISST_BASE_URL}?sst[(${date}T12:00:00Z)][(${roundedLat})][(${roundedLon})]`;

    const response = await fetch(url, {
      next: { revalidate: 21600 }, // 6 hour cache for Next.js
      headers: {
        'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
      },
    });

    if (!response.ok) {
      // Try with a slightly older date if the latest isn't available yet
      const olderDate = new Date(date);
      olderDate.setUTCDate(olderDate.getUTCDate() - 1);
      const olderDateStr = olderDate.toISOString().split('T')[0];

      const retryUrl = `${OISST_BASE_URL}?sst[(${olderDateStr}T12:00:00Z)][(${roundedLat})][(${roundedLon})]`;
      const retryResponse = await fetch(retryUrl, {
        next: { revalidate: 21600 },
        headers: {
          'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
        },
      });

      if (!retryResponse.ok) {
        // Cache the failure to avoid repeated attempts
        failedLocationCache.set(cacheKey, Date.now());
        return null;
      }

      const json = await retryResponse.json();
      const sst = parseERDDAPResponse(json);

      if (sst !== null) {
        const result: SSTData = {
          temperature: sst,
          timestamp: new Date().toISOString(),
          quality: 'interpolated', // Older data (1-2 days latency)
          source: 'oisst',
        };
        sstCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
      // Cache the failure
      failedLocationCache.set(cacheKey, Date.now());
      return null;
    }

    const json = await response.json();
    const sst = parseERDDAPResponse(json);

    if (sst === null) {
      return null;
    }

    const result: SSTData = {
      temperature: sst,
      timestamp: new Date().toISOString(),
      quality: 'primary',
      source: 'oisst',
    };

    // Cache the result
    sstCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    // Cache the failure to avoid repeated attempts
    failedLocationCache.set(cacheKey, Date.now());
    return null;
  }
}

/**
 * Get sea surface temperature for any location globally
 * This is the main entry point for SST data
 */
export async function getSeaSurfaceTemperature(
  lat: number,
  lon: number
): Promise<SSTData | null> {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return fetchOISSTData(lat, lon);
}

/**
 * Clear the SST cache (useful for testing)
 */
export function clearSSTCache(): void {
  sstCache.clear();
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getSSTCacheStats(): { size: number; entries: string[] } {
  return {
    size: sstCache.size,
    entries: Array.from(sstCache.keys()),
  };
}
