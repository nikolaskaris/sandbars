// =============================================================================
// Unified Forecast — single API to get complete forecast at any point
// =============================================================================
//
// Assembles data from all sources into a single forecast object per timestamp.
// Each source has its own optimal temporal resolution:
//   - Wave/wind/swell/airTemp: per-forecast-hour (3-6h intervals, 105 hours)
//   - Tides: hourly (720 hours, from binary grid)
//   - Water temp (SST): daily (from JSON grid, changes ~0.1°C/day)

import {
  FORECAST_HOURS,
  SwellData,
  WindData,
  WaveFeatureProperties,
  GeoJSONData,
  findNearestFeature,
  parseJsonProperty,
} from '@/lib/wave-utils';
import { DATA_URLS } from '@/lib/config';
import { getTideAtPoint, TideAtPoint, getTideCurve } from '@/lib/tides';
import { getWaterTempAtPoint, getAirTempAtPoint } from '@/lib/temperature';

// =============================================================================
// Types
// =============================================================================

export interface ForecastAtPoint {
  forecastHour: number;
  validTime: string;
  waves: {
    height: number;
    period: number;
    direction: number;
    swells: SwellData[];
  };
  wind: WindData;
  tide: {
    height: number;
    state: 'rising' | 'falling' | 'high' | 'low';
  } | null;
  waterTemp: number | null; // °C
  airTemp: number | null;   // °C
}

export interface ForecastSummary {
  /** Current conditions (tide, water temp, air temp at current time) */
  current: {
    tide: TideAtPoint | null;
    tideCurve: Array<{ time: Date; height: number }> | null;
    waterTemp: number | null;
    airTemp: number | null;
  };
  /** Per-forecast-hour entries */
  hours: ForecastAtPoint[];
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Get a complete forecast for a location across all 105 forecast hours.
 * Fetches wave/wind GeoJSON in parallel, then enriches with tide + temperature.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param signal Optional AbortSignal for cancellation
 * @param onProgress Called with count of completed fetches
 */
export async function getFullForecast(
  lat: number,
  lng: number,
  signal?: AbortSignal,
  onProgress?: (completed: number) => void
): Promise<ForecastSummary> {
  // Kick off all data fetches in parallel
  const now = new Date();

  // 1. Current conditions (tide, SST, air temp at current time)
  const [currentTide, tideCurve, waterTemp, currentAirTemp] = await Promise.all([
    getTideAtPoint(lat, lng, now),
    getTideCurve(lat, lng, now, 12),
    getWaterTempAtPoint(lat, lng),
    getAirTempAtPoint(lat, lng),
  ]);

  // 2. Per-hour forecast data (wave + wind + per-hour air temp from GeoJSON)
  const hours: ForecastAtPoint[] = [];
  let completed = 0;

  await Promise.all(
    FORECAST_HOURS.map(async (hour) => {
      if (signal?.aborted) return;

      try {
        const url = DATA_URLS.waveData(hour);
        const res = await fetch(url, { signal });
        if (!res.ok) return;

        const data: GeoJSONData<WaveFeatureProperties> = await res.json();
        const feature = findNearestFeature(data, lat, lng);

        if (feature && data.metadata) {
          const swells = parseJsonProperty<SwellData[]>(feature.properties.swells) || [];
          const wind = parseJsonProperty<WindData>(feature.properties.wind) || { speed: 0, direction: 0 };
          const primarySwell = swells[0];

          // Per-hour air temp from GeoJSON (if pipeline has been updated)
          const geoJsonAirTemp = feature.properties.airTemp ?? null;

          // Tide at this forecast time
          const validDate = new Date(data.metadata.valid_time);
          let tide: ForecastAtPoint['tide'] = null;
          if (!isNaN(validDate.getTime())) {
            const tideData = await getTideAtPoint(lat, lng, validDate);
            if (tideData) {
              tide = { height: tideData.height, state: tideData.state };
            }
          }

          hours.push({
            forecastHour: hour,
            validTime: data.metadata.valid_time,
            waves: {
              height: feature.properties.waveHeight,
              period: primarySwell?.period ?? 0,
              direction: primarySwell?.direction ?? 0,
              swells,
            },
            wind,
            tide,
            waterTemp: waterTemp, // SST is daily — same value for all hours
            airTemp: geoJsonAirTemp, // Per-hour from GeoJSON, falls back to null
          });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Skip individual failures silently
      } finally {
        completed++;
        onProgress?.(completed);
      }
    })
  );

  // Sort by forecast hour
  hours.sort((a, b) => a.forecastHour - b.forecastHour);

  // If no per-hour air temp in GeoJSON, fall back to grid-based daily value
  if (currentAirTemp != null && hours.every((h) => h.airTemp == null)) {
    for (const h of hours) {
      h.airTemp = currentAirTemp;
    }
  }

  return {
    current: {
      tide: currentTide,
      tideCurve,
      waterTemp,
      airTemp: currentAirTemp,
    },
    hours,
  };
}
