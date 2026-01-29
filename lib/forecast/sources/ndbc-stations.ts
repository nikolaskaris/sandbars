/**
 * NDBC Station List Management
 * Fetches and caches the complete list of active NDBC stations
 */

const NDBC_STATIONS_URL = 'https://www.ndbc.noaa.gov/activestations.xml';

export interface NDBCStation {
  id: string;
  lat: number;
  lon: number;
  name: string;
  owner: string;
  type: 'buoy' | 'fixed' | 'dart' | 'tao' | 'usv' | 'other';
  hasMet: boolean;      // meteorological data
  hasCurrents: boolean;
  hasWaterQuality: boolean;
}

// In-memory cache for station list
let cachedStations: NDBCStation[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Parse station type from NDBC type attribute
 */
function parseStationType(typeAttr: string | undefined): NDBCStation['type'] {
  if (!typeAttr) return 'other';
  const typeLower = typeAttr.toLowerCase();

  if (typeLower.includes('buoy') || typeLower === '3-meter discus buoy' ||
      typeLower === '6-meter nomad buoy' || typeLower.includes('aton')) {
    return 'buoy';
  }
  if (typeLower.includes('dart') || typeLower.includes('tsunami')) {
    return 'dart';
  }
  if (typeLower.includes('tao') || typeLower.includes('pirata') || typeLower.includes('rama')) {
    return 'tao';
  }
  if (typeLower.includes('fixed') || typeLower.includes('c-man') || typeLower.includes('land')) {
    return 'fixed';
  }
  if (typeLower.includes('usv') || typeLower.includes('glider') || typeLower.includes('sail')) {
    return 'usv';
  }
  return 'other';
}

/**
 * Parse XML response into NDBCStation array
 */
function parseStationsXML(xmlText: string): NDBCStation[] {
  const stations: NDBCStation[] = [];

  // Match all station elements
  const stationRegex = /<station\s+([^>]+)\/?>(?:<\/station>)?/gi;
  let match;

  while ((match = stationRegex.exec(xmlText)) !== null) {
    const attrs = match[1];

    // Extract attributes using regex
    const getId = /id="([^"]+)"/i.exec(attrs);
    const getLat = /lat="([^"]+)"/i.exec(attrs);
    const getLon = /lon="([^"]+)"/i.exec(attrs);
    const getName = /name="([^"]+)"/i.exec(attrs);
    const getOwner = /owner="([^"]+)"/i.exec(attrs);
    const getType = /type="([^"]+)"/i.exec(attrs);
    const getMet = /met="([^"]+)"/i.exec(attrs);
    const getCurrents = /currents="([^"]+)"/i.exec(attrs);
    const getWaterQuality = /waterquality="([^"]+)"/i.exec(attrs);

    if (getId && getLat && getLon) {
      const lat = parseFloat(getLat[1]);
      const lon = parseFloat(getLon[1]);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lon)) continue;

      stations.push({
        id: getId[1],
        lat,
        lon,
        name: getName ? getName[1] : getId[1],
        owner: getOwner ? getOwner[1] : 'Unknown',
        type: parseStationType(getType?.[1]),
        hasMet: getMet?.[1] === 'y',
        hasCurrents: getCurrents?.[1] === 'y',
        hasWaterQuality: getWaterQuality?.[1] === 'y',
      });
    }
  }

  return stations;
}

/**
 * Fetch the complete list of active NDBC stations
 * Uses a 24-hour cache to minimize API calls
 */
export async function fetchNDBCStationList(): Promise<NDBCStation[]> {
  // Return cached data if still valid
  const now = Date.now();
  if (cachedStations && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedStations;
  }

  try {
    const response = await fetch(NDBC_STATIONS_URL, {
      next: { revalidate: 86400 }, // 24 hour cache for Next.js
      headers: {
        'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch NDBC station list: ${response.statusText}`);
      // Return cached data even if stale, or empty array
      return cachedStations || [];
    }

    const xmlText = await response.text();
    const stations = parseStationsXML(xmlText);

    // Update cache
    cachedStations = stations;
    cacheTimestamp = now;

    console.log(`Loaded ${stations.length} NDBC stations`);
    return stations;
  } catch (error) {
    console.error('Error fetching NDBC station list:', error);
    // Return cached data even if stale, or empty array
    return cachedStations || [];
  }
}

/**
 * Filter stations that have meteorological data (wind, waves, temp)
 */
export function getMeteorologicalStations(stations: NDBCStation[]): NDBCStation[] {
  return stations.filter(s => s.hasMet);
}

/**
 * Filter stations by type
 */
export function getStationsByType(
  stations: NDBCStation[],
  types: NDBCStation['type'][]
): NDBCStation[] {
  return stations.filter(s => types.includes(s.type));
}

/**
 * Filter stations that are buoys (not fixed C-MAN stations)
 */
export function getBuoyStations(stations: NDBCStation[]): NDBCStation[] {
  return stations.filter(s => s.type === 'buoy' || s.type === 'dart' || s.type === 'tao');
}

/**
 * Get all stations for map display (includes all types)
 */
export function getAllStationsForMap(stations: NDBCStation[]): NDBCStation[] {
  // Filter out stations without valid coordinates
  return stations.filter(s =>
    !isNaN(s.lat) && !isNaN(s.lon) &&
    s.lat >= -90 && s.lat <= 90 &&
    s.lon >= -180 && s.lon <= 180
  );
}

/**
 * Convert stations to GeoJSON format for map rendering
 */
export function stationsToGeoJSON(stations: NDBCStation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map(station => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [station.lon, station.lat],
      },
      properties: {
        id: station.id,
        name: station.name,
        owner: station.owner,
        type: station.type,
        hasMet: station.hasMet,
        hasCurrents: station.hasCurrents,
        hasWaterQuality: station.hasWaterQuality,
      },
    })),
  };
}

/**
 * Clear the cached station list (useful for testing)
 */
export function clearStationCache(): void {
  cachedStations = null;
  cacheTimestamp = 0;
}
