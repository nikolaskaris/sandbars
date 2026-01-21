/**
 * WAVEWATCH III (NOAA Global Wave Model) Data Source
 * Provides global wave forecasts at 0.25° resolution
 */

import { QualityFlag } from '@/types';

const NOMADS_BASE_URL = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl';
const OPENDAP_BASE_URL = 'https://nomads.ncep.noaa.gov/dods/wave/gfswave';

export interface WaveWatchGrid {
  latitude: number;
  longitude: number;
  timestamp: string;
  significantWaveHeight?: number;
  peakWavePeriod?: number;
  meanWaveDirection?: number;
  swell1Height?: number;
  swell1Period?: number;
  swell1Direction?: number;
  windWaveHeight?: number;
  quality: QualityFlag;
}

export interface WaveWatchForecast {
  modelRun: Date;
  validTime: Date;
  forecastHour: number;
  data: WaveWatchGrid[];
}

/**
 * Get the latest WAVEWATCH III model run time
 */
export function getLatestModelRun(): Date {
  const now = new Date();
  const hour = now.getUTCHours();

  // Model runs at 00Z, 06Z, 12Z, 18Z
  const cycleHour = Math.floor(hour / 6) * 6;

  const modelRun = new Date(now);
  modelRun.setUTCHours(cycleHour, 0, 0, 0);

  // If less than 3 hours since model run, use previous run
  if (now.getTime() - modelRun.getTime() < 3 * 60 * 60 * 1000) {
    modelRun.setTime(modelRun.getTime() - 6 * 60 * 60 * 1000);
  }

  return modelRun;
}

/**
 * Fetch WAVEWATCH III data for a specific location
 * Uses NOMADS GRIB filter to download only needed subset
 */
export async function fetchWaveWatchData(
  lat: number,
  lon: number,
  forecastHours: number[] = [0, 3, 6, 12, 24, 48, 72, 96, 120, 144, 168]
): Promise<WaveWatchGrid[]> {
  try {
    const modelRun = getLatestModelRun();

    console.log(`Fetching WAVEWATCH III data for ${lat},${lon} from model run ${modelRun.toISOString()}`);

    // Normalize longitude to 0-360 for NOMADS
    const normLon = lon < 0 ? lon + 360 : lon;

    // Define bounding box (0.5° around point)
    const latMin = Math.max(-90, lat - 0.25);
    const latMax = Math.min(90, lat + 0.25);
    const lonMin = Math.max(0, normLon - 0.25);
    const lonMax = Math.min(360, normLon + 0.25);

    const results: WaveWatchGrid[] = [];

    // Fetch data for each forecast hour
    // NOTE: This is a simplified implementation
    // In production, you would:
    // 1. Use GRIB2 parsing library (like grib2json or convert via Python microservice)
    // 2. Batch requests efficiently
    // 3. Cache GRIB files locally

    // For now, return mock data structure with quality flag
    for (const fhour of forecastHours) {
      const validTime = new Date(modelRun.getTime() + fhour * 3600000);

      // TODO: Actual GRIB parsing would go here
      // For now, document the data structure

      results.push({
        latitude: lat,
        longitude: lon,
        timestamp: validTime.toISOString(),
        significantWaveHeight: undefined, // Would be parsed from GRIB HTSGW
        peakWavePeriod: undefined, // Would be parsed from GRIB PERPW
        meanWaveDirection: undefined, // Would be parsed from GRIB DIRPW
        swell1Height: undefined, // Would be parsed from GRIB SWELL_1
        swell1Period: undefined,
        swell1Direction: undefined,
        windWaveHeight: undefined, // Would be parsed from GRIB WIND_WAVE
        quality: 'modeled' as QualityFlag,
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching WAVEWATCH III data:', error);
    return [];
  }
}

/**
 * Build NOMADS filter URL for GRIB subset
 */
function buildNOMADSFilterURL(
  modelRun: Date,
  forecastHour: number,
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number
): string {
  const dateStr = modelRun.toISOString().slice(0, 10).replace(/-/g, '');
  const cycleHour = modelRun.getUTCHours().toString().padStart(2, '0');

  const params = new URLSearchParams({
    file: `gfswave.t${cycleHour}z.global.0p25.f${forecastHour.toString().padStart(3, '0')}.grib2`,
    // Variables to download
    var_HTSGW: 'on', // Significant height of combined wind waves and swell
    var_PERPW: 'on', // Primary wave mean period
    var_DIRPW: 'on', // Primary wave direction
    var_SWELL: 'on', // Swell component
    // Level
    lev_surface: 'on',
    // Bounding box
    subregion: '',
    leftlon: lonMin.toString(),
    rightlon: lonMax.toString(),
    toplat: latMax.toString(),
    bottomlat: latMin.toString(),
    // Output directory
    dir: `/gfs.${dateStr}/${cycleHour}/wave/gridded`,
  });

  return `${NOMADS_BASE_URL}?${params.toString()}`;
}

/**
 * Interpolate grid data to specific point
 * Uses bilinear interpolation
 */
export function interpolateGridPoint(
  gridData: WaveWatchGrid[],
  targetLat: number,
  targetLon: number
): WaveWatchGrid | null {
  if (gridData.length === 0) return null;

  // Find nearest grid points
  const nearest = gridData
    .map(point => ({
      point,
      distance: Math.sqrt(
        Math.pow(point.latitude - targetLat, 2) + Math.pow(point.longitude - targetLon, 2)
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4); // Get 4 nearest points for bilinear interpolation

  if (nearest.length === 0) return null;

  // Simple nearest neighbor for now
  // TODO: Implement proper bilinear interpolation
  const closestPoint = nearest[0].point;

  return {
    ...closestPoint,
    latitude: targetLat,
    longitude: targetLon,
  };
}

/**
 * GRIB2 to JSON converter service endpoint
 *
 * NOTE: This requires a separate Python/Node service to convert GRIB2 to JSON
 * Example using grib2json or similar tool:
 *
 * ```python
 * import pygrib
 * import json
 *
 * grbs = pygrib.open('gfswave.t00z.global.0p25.f003.grib2')
 *
 * for grb in grbs:
 *     if grb.name == 'Significant height of combined wind waves and swell':
 *         data = {
 *             'values': grb.values.tolist(),
 *             'lats': grb.latlons()[0].tolist(),
 *             'lons': grb.latlons()[1].tolist(),
 *         }
 *         print(json.dumps(data))
 * ```
 */
export async function fetchViaGRIBService(
  serviceUrl: string,
  modelRun: Date,
  forecastHour: number,
  lat: number,
  lon: number
): Promise<WaveWatchGrid | null> {
  try {
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'wavewatch3',
        run: modelRun.toISOString(),
        forecast_hour: forecastHour,
        latitude: lat,
        longitude: lon,
      }),
    });

    if (!response.ok) {
      console.error(`GRIB service error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    return {
      latitude: lat,
      longitude: lon,
      timestamp: data.valid_time,
      significantWaveHeight: data.htsgw,
      peakWavePeriod: data.perpw,
      meanWaveDirection: data.dirpw,
      swell1Height: data.swell1_height,
      swell1Period: data.swell1_period,
      swell1Direction: data.swell1_direction,
      windWaveHeight: data.wind_wave_height,
      quality: 'modeled',
    };
  } catch (error) {
    console.error('Error fetching from GRIB service:', error);
    return null;
  }
}

/**
 * Calculate distance between two points (Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
