/**
 * GFS (Global Forecast System) Wind Data Source
 *
 * Fetches global wind data from NOAA ERDDAP.
 * Provides U/V wind components for vector visualization.
 */

// NOAA Coastwatch ERDDAP for GFS data
const ERDDAP_BASE = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/NCEP_Global_Best';

export interface GFSWindPoint {
  lat: number;
  lon: number;
  u: number;  // U component (east-west wind, m/s)
  v: number;  // V component (north-south wind, m/s)
  speed: number;
  direction: number;
  timestamp: string;
}

export interface GFSWindResponse {
  points: GFSWindPoint[];
  modelRun: string;
  forecastHour: number;
  fetchedAt: string;
  source: string;
}

/**
 * Fetch global GFS wind grid data
 */
export async function fetchGFSWindGrid(
  forecastHour: number = 0,
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<GFSWindResponse | null> {
  const {
    minLat = -77.5,
    maxLat = 77.5,
    minLon = -180,
    maxLon = 180,
  } = bounds || {};

  // Use stride of 8 (4 degree resolution from 0.5 degree native) for reasonable data size
  const stride = 8;

  try {
    // Try ERDDAP first
    const points = await fetchGFSFromERDDAP(minLat, maxLat, minLon, maxLon, stride, forecastHour);

    if (points.length > 0) {
      console.log(`Fetched ${points.length} wind grid points from ERDDAP`);
      return {
        points,
        modelRun: new Date().toISOString(),
        forecastHour,
        fetchedAt: new Date().toISOString(),
        source: 'gfs_erddap',
      };
    }
  } catch (error) {
    console.error('Error fetching from GFS ERDDAP:', error);
  }

  // Fall back to synthetic data
  return fetchSyntheticWindData(forecastHour, bounds);
}

/**
 * Fetch GFS wind data from NOAA ERDDAP
 */
async function fetchGFSFromERDDAP(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  stride: number,
  forecastHour: number
): Promise<GFSWindPoint[]> {
  // For global requests (-180 to 180), we need to handle the date line
  // ERDDAP uses 0-360 longitude
  const needsTwoParts = minLon < 0 && maxLon > 0;

  if (needsTwoParts) {
    // Part 1: Western hemisphere (-180 to 0 maps to 180-360 in ERDDAP)
    const westPoints = await fetchGFSRegion(
      minLat, maxLat,
      180 + minLon, 359.5, // e.g., -180 -> 0, so 0-180
      stride
    );

    // Part 2: Eastern hemisphere (0 to 180)
    const eastPoints = await fetchGFSRegion(
      minLat, maxLat,
      0, maxLon,
      stride
    );

    return [...westPoints, ...eastPoints];
  }

  // Single region request
  const erddapMinLon = minLon < 0 ? minLon + 360 : minLon;
  const erddapMaxLon = maxLon < 0 ? maxLon + 360 : maxLon;

  return fetchGFSRegion(minLat, maxLat, erddapMinLon, erddapMaxLon, stride);
}

/**
 * Fetch a single region of GFS wind data
 */
async function fetchGFSRegion(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  stride: number
): Promise<GFSWindPoint[]> {
  // Build ERDDAP query for U and V wind components at 10m height
  const url = `${ERDDAP_BASE}.json?` +
    `ugrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(${minLon}):${stride}:(${maxLon})],` +
    `vgrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(${minLon}):${stride}:(${maxLon})]`;

  console.log(`Fetching GFS wind from ERDDAP: lat ${minLat}-${maxLat}, lon ${minLon}-${maxLon}`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`GFS ERDDAP request failed: ${response.status}`);
  }

  const data = await response.json();
  const points: GFSWindPoint[] = [];

  if (!data.table?.rows) {
    console.warn('No data in GFS ERDDAP response');
    return [];
  }

  const { columnNames, rows } = data.table;
  const timeIdx = columnNames.indexOf('time');
  const latIdx = columnNames.indexOf('latitude');
  const lonIdx = columnNames.indexOf('longitude');
  const uIdx = columnNames.indexOf('ugrd10m');
  const vIdx = columnNames.indexOf('vgrd10m');

  for (const row of rows) {
    const u = row[uIdx];
    const v = row[vIdx];

    // Skip NaN values
    if (u === null || v === null || isNaN(u) || isNaN(v)) {
      continue;
    }

    let lon = row[lonIdx];
    // Convert to -180 to 180
    if (lon > 180) {
      lon = lon - 360;
    }

    // Calculate speed and direction
    const speed = Math.sqrt(u * u + v * v);
    const direction = (Math.atan2(-u, -v) * 180) / Math.PI;
    const normalizedDir = direction < 0 ? direction + 360 : direction;

    points.push({
      lat: row[latIdx],
      lon,
      u: Math.round(u * 100) / 100,
      v: Math.round(v * 100) / 100,
      speed: Math.round(speed * 100) / 100,
      direction: Math.round(normalizedDir),
      timestamp: row[timeIdx],
    });
  }

  return points;
}

/**
 * Synthetic fallback when ERDDAP is unavailable
 * Uses climatological wind patterns
 */
async function fetchSyntheticWindData(
  forecastHour: number = 0,
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<GFSWindResponse | null> {
  console.log('GFS ERDDAP unavailable, generating synthetic wind data');

  const {
    minLat = -77.5,
    maxLat = 77.5,
    minLon = -180,
    maxLon = 180,
  } = bounds || {};

  const points: GFSWindPoint[] = [];
  const timestamp = new Date().toISOString();
  const step = 4; // 4 degree grid

  // Time-based variation
  const hourSeed = Date.now() / (3600 * 1000) + forecastHour;

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lon = minLon; lon <= maxLon; lon += step) {
      // Skip obvious land areas for performance
      if (isLikelyLand(lat, lon)) continue;

      // Generate wind based on global circulation patterns
      const { u, v } = generateClimatologicalWind(lat, lon, hourSeed);

      const speed = Math.sqrt(u * u + v * v);
      const direction = (Math.atan2(-u, -v) * 180) / Math.PI;
      const normalizedDir = direction < 0 ? direction + 360 : direction;

      points.push({
        lat,
        lon,
        u: Math.round(u * 100) / 100,
        v: Math.round(v * 100) / 100,
        speed: Math.round(speed * 100) / 100,
        direction: Math.round(normalizedDir),
        timestamp,
      });
    }
  }

  console.log(`Generated ${points.length} synthetic wind points`);

  return {
    points,
    modelRun: timestamp,
    forecastHour,
    fetchedAt: timestamp,
    source: 'synthetic_fallback',
  };
}

/**
 * Generate climatological wind based on latitude bands
 */
function generateClimatologicalWind(
  lat: number,
  lon: number,
  timeSeed: number
): { u: number; v: number } {
  const absLat = Math.abs(lat);
  let baseU: number;
  let baseV: number;

  // Global circulation patterns
  if (absLat > 60) {
    // Polar easterlies
    baseU = lat > 0 ? 3 : -3;
    baseV = -2;
  } else if (absLat > 30) {
    // Westerlies
    baseU = lat > 0 ? -8 : 8;
    baseV = 0;
  } else if (absLat > 5) {
    // Trade winds
    baseU = lat > 0 ? 6 : -6;
    baseV = lat > 0 ? 3 : -3;
  } else {
    // Doldrums (ITCZ) - light variable winds
    baseU = 0;
    baseV = 0;
  }

  // Add spatial and temporal variation
  const variation = Math.sin((lat + timeSeed) * 0.15) * Math.cos((lon + timeSeed) * 0.12);
  const u = baseU + variation * 3;
  const v = baseV + variation * 2;

  return { u, v };
}

/**
 * Simple heuristic for land areas (skip for performance)
 */
function isLikelyLand(lat: number, lon: number): boolean {
  // Major continental interiors
  if (lat > 25 && lat < 70 && lon > -125 && lon < -60) return true;  // N. America
  if (lat > -55 && lat < 10 && lon > -80 && lon < -35) return true;  // S. America
  if (lat > 35 && lat < 72 && lon > -10 && lon < 60) return true;    // Europe
  if (lat > -35 && lat < 37 && lon > -18 && lon < 52) return true;   // Africa
  if (lat > 10 && lat < 75 && lon > 55 && lon < 145) return true;    // Asia
  if (lat > -45 && lat < -10 && lon > 110 && lon < 155) return true; // Australia
  if (lat < -80 || lat > 85) return true; // Polar regions

  return false;
}
