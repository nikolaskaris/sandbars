/**
 * NDBC (National Data Buoy Center) Data Source
 * Fetches real-time buoy observations
 */

import { QualityFlag } from '@/types';
import {
  fetchNDBCStationList,
  NDBCStation,
  getMeteorologicalStations,
} from './ndbc-stations';

const NDBC_API_URL = 'https://www.ndbc.noaa.gov';

export interface NDBCBuoyReading {
  timestamp: string;
  waveHeight?: number;
  dominantWavePeriod?: number;
  averageWavePeriod?: number;
  waveDirection?: number;
  windSpeed?: number;
  windDirection?: number;
  waterTemperature?: number;
  airTemperature?: number;
  quality: QualityFlag;
}

export interface NDBCBuoyInfo {
  id: string;
  lat: number;
  lon: number;
  name: string;
}

// Re-export NDBCStation for use by other modules
export type { NDBCStation } from './ndbc-stations';

// Fallback buoys for when dynamic fetch fails
const FALLBACK_BUOYS: NDBCBuoyInfo[] = [
  // California Coast
  { id: '46221', lat: 33.8, lon: -118.3, name: 'Santa Monica Basin' },
  { id: '46222', lat: 33.6, lon: -117.9, name: 'San Pedro' },
  { id: '46232', lat: 37.5, lon: -122.5, name: 'Point Reyes' },
  { id: '46237', lat: 37.8, lon: -122.4, name: 'San Francisco' },
  { id: '46254', lat: 33.2, lon: -119.9, name: 'Ventura' },
  { id: '46025', lat: 33.7, lon: -119.1, name: 'Santa Monica' },
  { id: '46215', lat: 40.8, lon: -124.5, name: 'Cape Mendocino' },
  { id: '46014', lat: 39.2, lon: -123.3, name: 'Point Arena' },
  { id: '46026', lat: 37.8, lon: -122.8, name: 'San Francisco Bar' },
  { id: '46012', lat: 37.4, lon: -122.9, name: 'Half Moon Bay' },
  { id: '46042', lat: 36.8, lon: -122.4, name: 'Monterey Bay' },
  { id: '46011', lat: 34.9, lon: -121.0, name: 'Santa Maria' },
  // Hawaii
  { id: '51201', lat: 24.4, lon: -162.1, name: 'Hanalei' },
  { id: '51202', lat: 21.5, lon: -157.8, name: 'Waimea Bay' },
  // East Coast
  { id: '44025', lat: 40.3, lon: -73.2, name: 'Long Island' },
  { id: '44065', lat: 40.4, lon: -73.7, name: 'New York Harbor' },
  { id: '41010', lat: 28.9, lon: -78.5, name: 'Canaveral East' },
  { id: '42040', lat: 29.2, lon: -88.2, name: 'Luke Offshore' },
];

// Cached station list converted to NDBCBuoyInfo format
let cachedBuoyList: NDBCBuoyInfo[] | null = null;

/**
 * Get all NDBC buoys (dynamically fetched or fallback)
 */
export async function getNDBCBuoys(): Promise<NDBCBuoyInfo[]> {
  if (cachedBuoyList) {
    return cachedBuoyList;
  }

  try {
    const stations = await fetchNDBCStationList();
    if (stations.length > 0) {
      // Filter to meteorological stations and convert to NDBCBuoyInfo format
      const metStations = getMeteorologicalStations(stations);
      cachedBuoyList = metStations.map(s => ({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        name: s.name,
      }));
      return cachedBuoyList;
    }
  } catch (error) {
    console.error('Error fetching dynamic station list, using fallback:', error);
  }

  return FALLBACK_BUOYS;
}

// Legacy export for backward compatibility (use getNDBCBuoys() for dynamic list)
export const NDBC_BUOYS: NDBCBuoyInfo[] = FALLBACK_BUOYS;

/**
 * Check if a value is missing (NDBC missing data markers)
 */
function isMissing(val: string | number | undefined): boolean {
  if (val === undefined || val === null) return true;
  const strVal = String(val);
  return strVal === 'MM' || strVal === '999' || strVal === '999.0' || strVal === '99.0';
}

/**
 * Determine quality flag based on data freshness
 */
function determineQuality(timestamp: Date): QualityFlag {
  const age = Date.now() - timestamp.getTime();
  const hoursOld = age / (1000 * 60 * 60);

  if (hoursOld < 1) return 'primary';
  if (hoursOld < 3) return 'primary';
  return 'stale';
}

// Track failed buoys to avoid repeated fetch attempts
const failedBuoyCache = new Map<string, number>();
const FAILED_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch current buoy data from NDBC
 */
export async function fetchNDBCBuoyData(buoyId: string, silent: boolean = false): Promise<NDBCBuoyReading | null> {
  // Check if this buoy recently failed
  const failedAt = failedBuoyCache.get(buoyId);
  if (failedAt && (Date.now() - failedAt) < FAILED_CACHE_DURATION) {
    return null; // Skip recently failed buoys
  }

  try {
    const response = await fetch(
      `${NDBC_API_URL}/data/realtime2/${buoyId}.txt`,
      {
        next: { revalidate: 1800 }, // Cache for 30 minutes
        headers: {
          'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
        },
      }
    );

    if (!response.ok) {
      // Cache the failure to avoid repeated attempts
      failedBuoyCache.set(buoyId, Date.now());
      return null;
    }

    const text = await response.text();
    const lines = text.split('\n');

    // Parse the latest data (line 2, after header lines)
    if (lines.length < 3) {
      return null;
    }

    // NDBC format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    const data = lines[2].trim().split(/\s+/);

    if (data.length < 15) {
      return null;
    }

    // Parse timestamp
    const year = parseInt(data[0]) + 2000; // YY format
    const month = data[1];
    const day = data[2];
    const hour = data[3];
    const minute = data[4];
    const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);

    // Parse values
    const waveHeight = parseFloat(data[8]); // WVHT - significant wave height (meters)
    const dominantPeriod = parseFloat(data[9]); // DPD - dominant wave period (seconds)
    const avgPeriod = parseFloat(data[10]); // APD - average wave period (seconds)
    const waveDir = parseFloat(data[11]); // MWD - wave direction (degrees)
    const windSpeed = parseFloat(data[6]); // WSPD - wind speed (m/s)
    const windDir = parseFloat(data[5]); // WDIR - wind direction (degrees)
    const airTemp = parseFloat(data[13]); // ATMP - air temperature (°C)
    const waterTemp = parseFloat(data[14]); // WTMP - water temperature (°C)

    const quality = determineQuality(timestamp);

    return {
      timestamp: timestamp.toISOString(),
      waveHeight: !isNaN(waveHeight) && !isMissing(waveHeight) && waveHeight < 99 ? waveHeight : undefined,
      dominantWavePeriod: !isNaN(dominantPeriod) && !isMissing(dominantPeriod) && dominantPeriod < 99 ? dominantPeriod : undefined,
      averageWavePeriod: !isNaN(avgPeriod) && !isMissing(avgPeriod) && avgPeriod < 99 ? avgPeriod : undefined,
      waveDirection: !isNaN(waveDir) && !isMissing(waveDir) && waveDir <= 360 ? waveDir : undefined,
      windSpeed: !isNaN(windSpeed) && !isMissing(windSpeed) && windSpeed < 99 ? windSpeed : undefined,
      windDirection: !isNaN(windDir) && !isMissing(windDir) && windDir <= 360 ? windDir : undefined,
      airTemperature: !isNaN(airTemp) && !isMissing(airTemp) && airTemp < 99 ? airTemp : undefined,
      waterTemperature: !isNaN(waterTemp) && !isMissing(waterTemp) && waterTemp < 99 ? waterTemp : undefined,
      quality,
    };
  } catch (error) {
    // Cache the failure to avoid repeated attempts
    failedBuoyCache.set(buoyId, Date.now());
    return null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find nearest buoys to a location (async version using dynamic list)
 */
export async function findNearestBuoysAsync(
  lat: number,
  lon: number,
  maxDistance: number = 200,
  count: number = 5
): Promise<NDBCBuoyInfo[]> {
  const buoys = await getNDBCBuoys();
  const buoysWithDistance = buoys.map(buoy => ({
    ...buoy,
    distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
  }));

  return buoysWithDistance
    .filter(b => b.distance < maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/**
 * Find nearest buoys to a location (sync version using fallback list)
 * @deprecated Use findNearestBuoysAsync for access to full station list
 */
export function findNearestBuoys(
  lat: number,
  lon: number,
  maxDistance: number = 200,
  count: number = 5
): NDBCBuoyInfo[] {
  const buoysWithDistance = NDBC_BUOYS.map(buoy => ({
    ...buoy,
    distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
  }));

  return buoysWithDistance
    .filter(b => b.distance < maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

export type BuoyDataField = 'waveDirection' | 'windDirection' | 'waveHeight' |
  'dominantWavePeriod' | 'averageWavePeriod' | 'windSpeed' |
  'waterTemperature' | 'airTemperature';

export interface NearestBuoyWithDataResult {
  buoy: NDBCBuoyInfo;
  data: NDBCBuoyReading;
  distance: number;
}

/**
 * Find the single nearest buoy that has valid data for a specific field
 * Searches with a wider radius to find any buoy with the requested data
 */
export async function findNearestBuoyWithData(
  lat: number,
  lon: number,
  field: BuoyDataField,
  maxDistance: number = 500
): Promise<NearestBuoyWithDataResult | null> {
  // Get all buoys sorted by distance
  const buoys = await getNDBCBuoys();
  const buoysWithDistance = buoys
    .map(buoy => ({
      ...buoy,
      distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
    }))
    .filter(b => b.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  // Try each buoy in order until we find one with valid data
  for (const buoy of buoysWithDistance) {
    const data = await fetchNDBCBuoyData(buoy.id);
    if (data && data[field] !== undefined) {
      return {
        buoy: { id: buoy.id, lat: buoy.lat, lon: buoy.lon, name: buoy.name },
        data,
        distance: buoy.distance,
      };
    }
  }

  return null;
}
