/**
 * Color scales for weather data visualization
 */

// Wind speed color scale (m/s) - matches Windy.com style
export const WIND_COLORS = [
  'rgb(36,104,180)',   // 0-2 m/s - light blue
  'rgb(60,157,194)',   // 2-4 m/s
  'rgb(128,205,193)',  // 4-6 m/s
  'rgb(151,218,168)',  // 6-8 m/s
  'rgb(198,231,181)',  // 8-10 m/s
  'rgb(238,247,217)',  // 10-12 m/s
  'rgb(255,238,159)',  // 12-14 m/s - yellow
  'rgb(252,217,125)',  // 14-16 m/s
  'rgb(255,182,100)',  // 16-18 m/s - orange
  'rgb(252,150,75)',   // 18-20 m/s
  'rgb(250,112,52)',   // 20-22 m/s
  'rgb(245,64,32)',    // 22-24 m/s - red
  'rgb(237,45,28)',    // 24-26 m/s
  'rgb(220,24,32)',    // 26-28 m/s
  'rgb(180,0,35)',     // 28+ m/s - dark red
];

// Wave height color scale (meters) - tuples of [threshold, rgba_color]
export const WAVE_HEIGHT_COLORS: [number, string][] = [
  [0, 'rgba(13, 71, 161, 0.7)'],      // 0m - deep blue
  [0.5, 'rgba(25, 118, 210, 0.7)'],   // 0.5m
  [1, 'rgba(0, 172, 193, 0.7)'],      // 1m - cyan
  [1.5, 'rgba(0, 137, 123, 0.7)'],    // 1.5m - teal
  [2, 'rgba(67, 160, 71, 0.7)'],      // 2m - green
  [2.5, 'rgba(124, 179, 66, 0.7)'],   // 2.5m
  [3, 'rgba(192, 202, 51, 0.7)'],     // 3m - yellow-green
  [4, 'rgba(255, 179, 0, 0.7)'],      // 4m - amber
  [5, 'rgba(251, 140, 0, 0.7)'],      // 5m - orange
  [6, 'rgba(244, 81, 30, 0.7)'],      // 6m - deep orange
  [8, 'rgba(198, 40, 40, 0.8)'],      // 8m+ - red
];

// Swell period color scale (seconds)
export const SWELL_PERIOD_COLORS: [number, string][] = [
  [0, 'rgba(100, 100, 100, 0.5)'],    // 0-5s - gray (wind chop)
  [5, 'rgba(100, 149, 237, 0.6)'],    // 5-8s - light blue (short period)
  [8, 'rgba(50, 205, 50, 0.7)'],      // 8-12s - green (medium period)
  [12, 'rgba(255, 215, 0, 0.7)'],     // 12-16s - gold (long period)
  [16, 'rgba(255, 140, 0, 0.8)'],     // 16-20s - orange (very long period)
  [20, 'rgba(255, 69, 0, 0.8)'],      // 20s+ - red (ground swell)
];

// Water temperature color scale (Celsius)
export const WATER_TEMP_COLORS: [number, string][] = [
  [0, 'rgba(0, 0, 139, 0.7)'],        // 0°C - dark blue (freezing)
  [5, 'rgba(30, 144, 255, 0.7)'],     // 5°C - dodger blue
  [10, 'rgba(0, 191, 255, 0.7)'],     // 10°C - deep sky blue
  [15, 'rgba(0, 255, 255, 0.7)'],     // 15°C - cyan
  [20, 'rgba(0, 255, 127, 0.7)'],     // 20°C - spring green
  [25, 'rgba(255, 255, 0, 0.7)'],     // 25°C - yellow (tropical)
  [30, 'rgba(255, 165, 0, 0.8)'],     // 30°C - orange (very warm)
  [35, 'rgba(255, 69, 0, 0.8)'],      // 35°C+ - red (hot)
];

/**
 * Get interpolated color for wave height
 */
export function getWaveHeightColor(heightM: number): string {
  for (let i = WAVE_HEIGHT_COLORS.length - 1; i >= 0; i--) {
    if (heightM >= WAVE_HEIGHT_COLORS[i][0]) {
      return WAVE_HEIGHT_COLORS[i][1];
    }
  }
  return WAVE_HEIGHT_COLORS[0][1];
}

/**
 * Get interpolated color for swell period
 */
export function getSwellPeriodColor(periodS: number): string {
  for (let i = SWELL_PERIOD_COLORS.length - 1; i >= 0; i--) {
    if (periodS >= SWELL_PERIOD_COLORS[i][0]) {
      return SWELL_PERIOD_COLORS[i][1];
    }
  }
  return SWELL_PERIOD_COLORS[0][1];
}

/**
 * Get interpolated color for water temperature
 */
export function getWaterTempColor(tempC: number): string {
  for (let i = WATER_TEMP_COLORS.length - 1; i >= 0; i--) {
    if (tempC >= WATER_TEMP_COLORS[i][0]) {
      return WATER_TEMP_COLORS[i][1];
    }
  }
  return WATER_TEMP_COLORS[0][1];
}

/**
 * Get wind color index based on speed in m/s
 */
export function getWindColorIndex(speedMps: number): number {
  return Math.min(Math.floor(speedMps / 2), WIND_COLORS.length - 1);
}

/**
 * Get wind color based on speed in m/s
 */
export function getWindColor(speedMps: number): string {
  return WIND_COLORS[getWindColorIndex(speedMps)];
}

// ============================================
// UNIT CONVERSIONS
// ============================================

/**
 * Convert meters per second to knots
 */
export function mpsToKnots(mps: number): number {
  return mps * 1.94384;
}

/**
 * Convert knots to meters per second
 */
export function knotsToMps(knots: number): number {
  return knots / 1.94384;
}

/**
 * Convert meters to feet
 */
export function metersToFeet(m: number): number {
  return m * 3.28084;
}

/**
 * Convert feet to meters
 */
export function feetToMeters(ft: number): number {
  return ft / 3.28084;
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/**
 * Convert Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

/**
 * Convert degrees to cardinal direction
 */
export function degreesToCardinal(degrees: number): string {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return cardinals[index];
}

/**
 * Format wave height with units
 */
export function formatWaveHeight(heightM: number, useMetric = false): string {
  if (useMetric) {
    return `${heightM.toFixed(1)}m`;
  }
  return `${metersToFeet(heightM).toFixed(1)}ft`;
}

/**
 * Format wind speed with units
 */
export function formatWindSpeed(speedMps: number, useMetric = false): string {
  if (useMetric) {
    return `${speedMps.toFixed(0)} m/s`;
  }
  return `${mpsToKnots(speedMps).toFixed(0)} kts`;
}

/**
 * Format temperature with units
 */
export function formatTemperature(tempC: number, useMetric = false): string {
  if (useMetric) {
    return `${tempC.toFixed(0)}°C`;
  }
  return `${celsiusToFahrenheit(tempC).toFixed(0)}°F`;
}
