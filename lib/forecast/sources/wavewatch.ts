/**
 * WAVEWATCH III (NOAA Global Wave Model) Data Source
 *
 * Fetches real wave model data from NOAA/PacIOOS ERDDAP.
 * The data naturally only exists over ocean - no land masking needed.
 *
 * Data source: University of Hawaii PacIOOS WaveWatch III Global Model
 * https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.html
 */

// PacIOOS ERDDAP - reliable, well-maintained
const ERDDAP_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global';

export interface WaveWatchGridPoint {
  lat: number;
  lon: number;
  waveHeight: number;       // Significant wave height in meters
  waveDirection: number;    // Mean wave direction in degrees
  wavePeriod: number;       // Peak wave period in seconds
  timestamp: string;
}

export interface WaveWatchResponse {
  points: WaveWatchGridPoint[];
  modelRun: string;
  fetchedAt: string;
  source: string;
}

/**
 * Get the latest model run time
 * WW3 model updates hourly with ~6 hour delay
 */
export function getLatestModelRun(): Date {
  const now = new Date();
  // Go back 6 hours to ensure data is available
  now.setUTCHours(now.getUTCHours() - 6);
  return now;
}

/**
 * Fetch global WAVEWATCH III grid data from ERDDAP
 *
 * The data naturally only covers ocean - no land masking needed.
 * Land cells have NaN values which we simply skip.
 */
export async function fetchWaveWatchGlobalGrid(
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<WaveWatchResponse | null> {
  const {
    minLat = -77.5,
    maxLat = 77.5,
    minLon = -180,
    maxLon = 180,
  } = bounds || {};

  // ERDDAP uses 0-360 longitude, convert from -180 to 180
  const erddapMinLon = minLon < 0 ? minLon + 360 : minLon;
  const erddapMaxLon = maxLon < 0 ? maxLon + 360 : maxLon;

  // For global coverage, we need to handle the date line
  // Request in two parts if spanning the date line
  const needsTwoParts = minLon < 0 && maxLon > 0;

  // Use stride of 4 (2° resolution from 0.5° native) for reasonable data size
  const stride = 4;

  try {
    let allPoints: WaveWatchGridPoint[] = [];

    if (needsTwoParts) {
      // Part 1: Western hemisphere (180-360 in ERDDAP coords)
      const westPoints = await fetchERDDAPRegion(
        minLat, maxLat,
        180 + minLon, 359.5, // -180 to 0 maps to 180-360
        stride
      );

      // Part 2: Eastern hemisphere (0-180 in ERDDAP coords)
      const eastPoints = await fetchERDDAPRegion(
        minLat, maxLat,
        0, maxLon,
        stride
      );

      allPoints = [...westPoints, ...eastPoints];
    } else {
      allPoints = await fetchERDDAPRegion(
        minLat, maxLat,
        erddapMinLon, erddapMaxLon,
        stride
      );
    }

    console.log(`Fetched ${allPoints.length} wave grid points from ERDDAP`);

    return {
      points: allPoints,
      modelRun: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      source: 'wavewatch3_erddap',
    };
  } catch (error) {
    console.error('Error fetching from ERDDAP:', error);
    // Fall back to synthetic data if ERDDAP fails
    return fetchSyntheticFallback(bounds);
  }
}

/**
 * Fetch a region from ERDDAP
 */
async function fetchERDDAPRegion(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  stride: number
): Promise<WaveWatchGridPoint[]> {
  // Build ERDDAP query URL
  // Format: variable[(time)][(depth)][(lat_start):stride:(lat_end)][(lon_start):stride:(lon_end)]
  const url = `${ERDDAP_BASE}.json?` +
    `Thgt[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(${minLon}):${stride}:(${maxLon})],` +
    `Tdir[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(${minLon}):${stride}:(${maxLon})],` +
    `Tper[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(${minLon}):${stride}:(${maxLon})]`;

  console.log(`Fetching ERDDAP data for region: lat ${minLat}-${maxLat}, lon ${minLon}-${maxLon}`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    // Long timeout for large requests
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`ERDDAP request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const points: WaveWatchGridPoint[] = [];

  // Parse ERDDAP response
  // Format: { table: { columnNames: [...], rows: [[time, depth, lat, lon, Thgt], ...] } }
  if (!data.table?.rows) {
    console.warn('No data in ERDDAP response');
    return [];
  }

  const { columnNames, rows } = data.table;
  const timeIdx = columnNames.indexOf('time');
  const latIdx = columnNames.indexOf('latitude');
  const lonIdx = columnNames.indexOf('longitude');
  const hgtIdx = columnNames.indexOf('Thgt');
  const dirIdx = columnNames.indexOf('Tdir');
  const perIdx = columnNames.indexOf('Tper');

  for (const row of rows) {
    const waveHeight = row[hgtIdx];

    // Skip NaN values (land areas)
    if (waveHeight === null || waveHeight === undefined || isNaN(waveHeight)) {
      continue;
    }

    let lon = row[lonIdx];
    // Convert ERDDAP longitude (0-360) to standard (-180 to 180)
    if (lon > 180) {
      lon = lon - 360;
    }

    const waveDirection = row[dirIdx];
    const wavePeriod = row[perIdx];

    points.push({
      lat: row[latIdx],
      lon,
      waveHeight: Math.round(waveHeight * 100) / 100,
      waveDirection: waveDirection !== null && !isNaN(waveDirection)
        ? Math.round(waveDirection)
        : 0,
      wavePeriod: wavePeriod !== null && !isNaN(wavePeriod)
        ? Math.round(wavePeriod * 10) / 10
        : 0,
      timestamp: row[timeIdx],
    });
  }

  return points;
}

/**
 * Synthetic fallback when ERDDAP is unavailable
 * Uses a proper ocean mask based on known ocean coordinates
 */
async function fetchSyntheticFallback(
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): Promise<WaveWatchResponse | null> {
  console.log('ERDDAP unavailable, generating synthetic fallback data');

  const {
    minLat = -77.5,
    maxLat = 77.5,
    minLon = -180,
    maxLon = 180,
  } = bounds || {};

  const points: WaveWatchGridPoint[] = [];
  const timestamp = new Date().toISOString();
  const step = 2; // 2 degree grid

  // Time-based variation
  const daySeed = Math.floor(Date.now() / (6 * 60 * 60 * 1000));

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lon = minLon; lon <= maxLon; lon += step) {
      // Simple ocean check - only generate for likely ocean areas
      if (!isLikelyOcean(lat, lon)) continue;

      // Generate wave height based on latitude (climatology)
      const absLat = Math.abs(lat);
      let baseHeight: number;

      if (absLat > 50) baseHeight = 4.0;      // High latitude storms
      else if (absLat > 40) baseHeight = 3.0; // Storm tracks
      else if (absLat > 25) baseHeight = 2.0; // Mid-latitudes
      else if (absLat > 10) baseHeight = 1.2; // Trade winds
      else baseHeight = 0.7;                   // Doldrums

      // Add spatial variation
      const variation = Math.sin((lat + daySeed) * 0.1) * Math.cos((lon + daySeed) * 0.08) * 0.5;
      const waveHeight = Math.max(0.3, baseHeight + variation);

      // Direction based on latitude bands
      let direction: number;
      if (lat < -30 || lat > 30) direction = 270; // Westerlies
      else if (lat > 0) direction = 225;          // NE trades
      else direction = 315;                        // SE trades

      const wavePeriod = 6 + waveHeight * 1.2;

      points.push({
        lat,
        lon,
        waveHeight: Math.round(waveHeight * 100) / 100,
        waveDirection: direction,
        wavePeriod: Math.round(wavePeriod * 10) / 10,
        timestamp,
      });
    }
  }

  console.log(`Generated ${points.length} synthetic fallback points`);

  return {
    points,
    modelRun: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    source: 'synthetic_fallback',
  };
}

/**
 * Simple heuristic for likely ocean areas
 * This is only used as a fallback - real ERDDAP data has proper masking
 */
function isLikelyOcean(lat: number, lon: number): boolean {
  // Major continental interiors (definitely not ocean)

  // North America interior
  if (lat > 25 && lat < 70 && lon > -125 && lon < -60) return false;

  // South America
  if (lat > -55 && lat < 10 && lon > -80 && lon < -35) return false;

  // Europe + Western Asia
  if (lat > 35 && lat < 72 && lon > -10 && lon < 60) return false;

  // Africa
  if (lat > -35 && lat < 37 && lon > -18 && lon < 52) return false;

  // Asia (broad interior)
  if (lat > 10 && lat < 75 && lon > 55 && lon < 145) return false;

  // Australia
  if (lat > -45 && lat < -10 && lon > 110 && lon < 155) return false;

  // Antarctica
  if (lat < -75) return false;

  // Arctic
  if (lat > 80) return false;

  return true;
}

/**
 * Fetch WAVEWATCH III data for a specific point
 */
export async function fetchWaveWatchPoint(
  lat: number,
  lon: number
): Promise<WaveWatchGridPoint | null> {
  const response = await fetchWaveWatchGlobalGrid({
    minLat: lat - 2,
    maxLat: lat + 2,
    minLon: lon - 2,
    maxLon: lon + 2,
  });

  if (!response || response.points.length === 0) {
    return null;
  }

  // Find nearest point
  let nearest = response.points[0];
  let minDist = Infinity;

  for (const point of response.points) {
    const dist = Math.sqrt(
      Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lon, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return nearest;
}
