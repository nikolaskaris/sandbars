// =============================================================================
// Shared Wave Types, Constants & Utilities
// =============================================================================

// Forecast hours available: 3-hourly for days 0-10 (f000-f240), 6-hourly for days 10-16 (f246-f384)
export const FORECAST_HOURS = [
  0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48,
  51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96,
  99, 102, 105, 108, 111, 114, 117, 120, 123, 126, 129, 132, 135, 138, 141, 144,
  147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177, 180, 183, 186, 189, 192,
  195, 198, 201, 204, 207, 210, 213, 216, 219, 222, 225, 228, 231, 234, 237, 240,
  246, 252, 258, 264, 270, 276, 282, 288, 294, 300, 306, 312, 318, 324, 330, 336,
  342, 348, 354, 360, 366, 372, 378, 384,
];

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
