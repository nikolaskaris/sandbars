// =============================================================================
// Natural Language Summary — factual, data-driven forecast narration
// =============================================================================
//
// Generates plain-English summaries from forecast data and quality scores.
// Rules: state raw numbers first, then explain why the score is what it is.
// No creative language. Trust comes from accuracy and transparency.

import type { ForecastAtPoint } from '@/lib/forecast';
import type { QualityScore } from '@/lib/quality';
import type { Spot } from '@/lib/spots';
import { degreesToCompass } from '@/lib/wave-utils';
import { convertWaveHeight, convertWindSpeed, convertTemp, tempUnitLabel } from '@/lib/preferences';

interface SummaryOptions {
  waveUnit: 'ft' | 'm';
  windUnit: 'mph' | 'kts' | 'kph' | 'm/s';
  tempUnit: 'F' | 'C';
}

/**
 * Generate a natural language summary of current conditions.
 * Strictly factual: states numbers, then explains the scoring logic.
 */
export function generateSummary(
  forecast: ForecastAtPoint,
  quality: QualityScore,
  spot: Spot | null,
  opts: SummaryOptions = { waveUnit: 'ft', windUnit: 'mph', tempUnit: 'F' }
): string {
  const parts: string[] = [];

  // === Raw conditions ===
  const heightStr = `${convertWaveHeight(forecast.waves.height, opts.waveUnit)}${opts.waveUnit}`;
  const primarySwell = forecast.waves.swells[0];
  const periodStr = primarySwell ? `${primarySwell.period}s` : `${forecast.waves.period}s`;
  const dirStr = degreesToCompass(primarySwell?.direction ?? forecast.waves.direction);

  parts.push(`${heightStr} at ${periodStr} from the ${dirStr}.`);

  // Wind
  const windSpeedStr = `${convertWindSpeed(forecast.wind.speed, opts.windUnit)} ${opts.windUnit}`;
  const windDirStr = degreesToCompass(forecast.wind.direction);

  if (forecast.wind.speed < 1.5) {
    parts.push('Glass conditions — no wind.');
  } else {
    let windQualifier = '';
    if (spot?.facing_direction != null) {
      const offshoreDir = (spot.facing_direction + 180) % 360;
      const angle = Math.abs(((forecast.wind.direction - offshoreDir + 180) % 360) - 180);
      if (angle < 45) windQualifier = 'offshore';
      else if (angle < 90) windQualifier = 'cross-offshore';
      else if (angle < 135) windQualifier = 'cross-onshore';
      else windQualifier = 'onshore';
    }
    parts.push(`Wind is ${windQualifier ? windQualifier + ' at ' : ''}${windSpeedStr} ${windDirStr}.`);
  }

  // Tide
  if (forecast.tide) {
    const tideHStr = `${convertWaveHeight(forecast.tide.height, opts.waveUnit).toFixed(1)}${opts.waveUnit}`;
    parts.push(`Tide is ${tideHStr} and ${forecast.tide.state}.`);
  }

  // Temperature
  const temps: string[] = [];
  if (forecast.waterTemp != null) {
    temps.push(`Water ${convertTemp(forecast.waterTemp, opts.tempUnit)}${tempUnitLabel(opts.tempUnit)}`);
  }
  if (forecast.airTemp != null) {
    temps.push(`Air ${convertTemp(forecast.airTemp, opts.tempUnit)}${tempUnitLabel(opts.tempUnit)}`);
  }
  if (temps.length > 0) {
    parts.push(temps.join(', ') + '.');
  }

  // === Quality explanation ===
  if (spot) {
    const explanations: string[] = [];

    // Swell direction assessment
    if (quality.sub.swell >= 8) {
      explanations.push('Swell direction is right in the window');
    } else if (quality.sub.swell >= 5) {
      explanations.push('Swell direction is acceptable');
    } else if (quality.sub.swell < 3 && forecast.waves.height > 0.3) {
      explanations.push('Swell direction is off for this spot');
    }

    // Period assessment
    if (quality.sub.period >= 8) {
      explanations.push('period is long enough for clean walls');
    } else if (quality.sub.period < 4) {
      explanations.push('short period means mushy, disorganized waves');
    }

    // Wind assessment
    if (quality.sub.wind >= 8) {
      explanations.push('wind conditions are clean');
    } else if (quality.sub.wind < 4) {
      explanations.push('wind is degrading wave quality');
    }

    // Tide assessment
    if (spot.optimal_tide && quality.sub.tide >= 8) {
      explanations.push(`tide is in the preferred range (${spot.optimal_tide})`);
    } else if (spot.optimal_tide && quality.sub.tide < 4) {
      explanations.push(`tide isn't ideal — this spot prefers ${spot.optimal_tide} tide`);
    }

    if (explanations.length > 0) {
      // Capitalize first explanation
      explanations[0] = explanations[0].charAt(0).toUpperCase() + explanations[0].slice(1);
      parts.push(explanations.join('. ') + '.');
    }
  }

  return parts.join(' ');
}

/**
 * Generate a short one-line conditions description (for cards).
 */
export function shortConditionsSummary(
  forecast: ForecastAtPoint,
  spot: Spot | null,
  opts: SummaryOptions = { waveUnit: 'ft', windUnit: 'mph', tempUnit: 'F' }
): string {
  const parts: string[] = [];

  // Wind quality
  if (forecast.wind.speed < 1.5) {
    parts.push('Glass');
  } else if (spot?.facing_direction != null) {
    const offshoreDir = (spot.facing_direction + 180) % 360;
    const angle = Math.abs(((forecast.wind.direction - offshoreDir + 180) % 360) - 180);
    if (angle < 60) parts.push('Clean');
    else if (angle < 120) parts.push('Cross-shore');
    else if (forecast.wind.speed < 5) parts.push('Light onshore');
    else parts.push('Choppy');
  } else {
    if (forecast.wind.speed < 4) parts.push('Light wind');
    else if (forecast.wind.speed < 8) parts.push('Moderate wind');
    else parts.push('Windy');
  }

  // Tide state
  if (forecast.tide) {
    const tideLabel = forecast.tide.state.charAt(0).toUpperCase() + forecast.tide.state.slice(1);
    parts.push(`${tideLabel} tide`);
  }

  return parts.join(' · ');
}
