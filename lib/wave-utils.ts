// =============================================================================
// Shared Wave Types, Constants & Utilities
// =============================================================================

// Forecast hours available (every 24 hours for 16 days)
export const FORECAST_HOURS = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360, 384];

/**
 * Find the forecast hour closest to the current time, given a model run time.
 */
export function findNearestForecastHour(modelRunTime: string | null): number {
  if (!modelRunTime) return 0;
  const modelRun = new Date(modelRunTime);
  if (isNaN(modelRun.getTime())) return 0;
  const hoursElapsed = (Date.now() - modelRun.getTime()) / (1000 * 60 * 60);

  let closest = FORECAST_HOURS[0];
  let minDiff = Infinity;
  for (const hour of FORECAST_HOURS) {
    const diff = Math.abs(hoursElapsed - hour);
    if (diff < minDiff) {
      minDiff = diff;
      closest = hour;
    }
  }
  return closest;
}

export const COMPASS_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

// Types

export interface SwellData {
  height: number;
  period: number;
  direction: number;
}

export interface WindData {
  speed: number;
  direction: number;
}

export interface WindWaveData {
  height: number;
  period?: number;
  direction?: number;
}

export interface WaveFeatureProperties {
  waveHeight: number;
  swells: SwellData[] | string;
  windWaves: WindWaveData | string | null;
  wind: WindData | string;
}

export interface ForecastMetadata {
  source: string;
  model_run: string;
  forecast_hour: number;
  valid_time: string;
  generated_at: string;
  grid_resolution: string;
  point_count: number;
}

export interface GeoJSONFeature<T> {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: T;
}

export interface GeoJSONData<T = WaveFeatureProperties> {
  type: string;
  metadata?: ForecastMetadata;
  features: GeoJSONFeature<T>[];
}

// Utility Functions

export function degreesToCompass(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS_DIRECTIONS[index];
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function parseJsonProperty<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
