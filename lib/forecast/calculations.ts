/**
 * Calculations Module
 * Derived metrics like wave power
 */

/**
 * Calculate wave power
 * Formula: P = 0.5 * ρ * g * H² * T
 * Where:
 *   ρ (rho) = water density = 1025 kg/m³ (seawater)
 *   g = gravitational acceleration = 9.81 m/s²
 *   H = significant wave height (meters)
 *   T = wave period (seconds)
 *
 * @param waveHeight - Significant wave height in meters
 * @param wavePeriod - Wave period in seconds
 * @returns Wave power in kW/m
 */
export function calculateWavePower(waveHeight: number, wavePeriod: number): number {
  const RHO = 1025; // kg/m³ - seawater density
  const G = 9.81; // m/s² - gravitational acceleration

  // P = 0.5 * ρ * g * H² * T
  const power = 0.5 * RHO * G * Math.pow(waveHeight, 2) * wavePeriod;

  // Convert to kW/m
  return power / 1000;
}

/**
 * Calculate wave energy flux (similar to power but more precise)
 * Formula: E = (ρ * g² / 64π) * H² * T
 *
 * @param waveHeight - Significant wave height in meters
 * @param wavePeriod - Wave period in seconds
 * @returns Wave energy flux in kW/m
 */
export function calculateWaveEnergyFlux(waveHeight: number, wavePeriod: number): number {
  const RHO = 1025; // kg/m³
  const G = 9.81; // m/s²

  // E = (ρ * g² / 64π) * H² * T
  const energy = ((RHO * Math.pow(G, 2)) / (64 * Math.PI)) * Math.pow(waveHeight, 2) * wavePeriod;

  // Convert to kW/m
  return energy / 1000;
}

/**
 * Estimate surf quality based on wave metrics
 * Returns a score from 0-10
 */
export function calculateSurfQualityScore(
  waveHeight: number,
  wavePeriod: number,
  windSpeed: number,
  windDirection?: number,
  waveDirection?: number
): number {
  let score = 0;

  // Wave height score (0-3 points)
  // Optimal: 1-2.5m
  if (waveHeight >= 1 && waveHeight <= 2.5) {
    score += 3;
  } else if (waveHeight >= 0.6 && waveHeight < 1) {
    score += 2;
  } else if (waveHeight > 2.5 && waveHeight <= 3.5) {
    score += 2;
  } else if (waveHeight > 0.3 && waveHeight < 0.6) {
    score += 1;
  }

  // Wave period score (0-3 points)
  // Optimal: 10-16 seconds (long period swells)
  if (wavePeriod >= 10 && wavePeriod <= 16) {
    score += 3;
  } else if (wavePeriod >= 8 && wavePeriod < 10) {
    score += 2;
  } else if (wavePeriod > 16 && wavePeriod <= 20) {
    score += 2;
  } else if (wavePeriod >= 6 && wavePeriod < 8) {
    score += 1;
  }

  // Wind score (0-2 points)
  // Optimal: light offshore wind (< 5 m/s)
  if (windSpeed < 3) {
    score += 2;
  } else if (windSpeed < 5) {
    score += 1.5;
  } else if (windSpeed < 8) {
    score += 1;
  } else if (windSpeed < 12) {
    score += 0.5;
  }

  // Wind/wave direction score (0-2 points)
  if (windDirection !== undefined && waveDirection !== undefined) {
    const directionDiff = Math.abs(windDirection - waveDirection);
    const normalizedDiff = Math.min(directionDiff, 360 - directionDiff);

    // Offshore wind (wind opposite to waves) is best
    if (normalizedDiff > 150 && normalizedDiff < 210) {
      score += 2;
    } else if (normalizedDiff > 120 && normalizedDiff < 240) {
      score += 1.5;
    } else if (normalizedDiff < 30) {
      // Onshore wind (same direction as waves) is bad
      score += 0;
    } else {
      score += 1;
    }
  }

  return Math.min(score, 10);
}

/**
 * Convert wind speed from various units
 */
export function convertWindSpeed(
  value: number,
  from: 'mph' | 'knots' | 'ms' | 'kmh',
  to: 'ms' = 'ms'
): number {
  // Convert to m/s first
  let ms: number;
  switch (from) {
    case 'mph':
      ms = value * 0.44704;
      break;
    case 'knots':
      ms = value * 0.514444;
      break;
    case 'kmh':
      ms = value / 3.6;
      break;
    case 'ms':
    default:
      ms = value;
  }

  return ms;
}

/**
 * Convert temperature
 */
export function convertTemperature(
  value: number,
  from: 'C' | 'F',
  to: 'C' | 'F' = 'C'
): number {
  if (from === to) return value;

  if (from === 'F' && to === 'C') {
    return ((value - 32) * 5) / 9;
  } else {
    return (value * 9) / 5 + 32;
  }
}

/**
 * Estimate breaking wave height based on depth
 * Waves typically break when H/d ≈ 0.78 (where d is water depth)
 */
export function estimateBreakingWaveHeight(depth: number): number {
  return depth * 0.78;
}

/**
 * Calculate wave celerity (phase speed)
 * C = L/T where L is wavelength, T is period
 * Deep water approximation: C = gT/(2π)
 */
export function calculateWaveCelerity(wavePeriod: number): number {
  const G = 9.81; // m/s²
  return (G * wavePeriod) / (2 * Math.PI);
}
