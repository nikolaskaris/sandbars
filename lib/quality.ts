// =============================================================================
// Surf Quality Scoring — 0-10 composite score with transparent sub-scores
// =============================================================================
//
// Architecture based on research into Surfline, MSW, StormSurf, KSL, and
// academic wave physics (Iribarren number, Feddersen wind research).
//
// Key design principle: the score is a SUMMARY, not a replacement for raw data.
// Each sub-score is exposed so surfers can see WHY conditions are rated.
//
// Sub-scores:
//   Swell  (35%) — height within optimal range + directional alignment
//   Wind   (30%) — direction relative to shore + speed penalty
//   Period (20%) — longer period = better organized waves
//   Tide   (15%) — alignment with spot's preferred tide range

import type { Spot } from '@/lib/spots';
import type { ForecastAtPoint } from '@/lib/forecast';
import type { SwellData } from '@/lib/wave-utils';

// =============================================================================
// Types
// =============================================================================

export interface QualitySubScores {
  swell: number;  // 0-10
  wind: number;   // 0-10
  period: number; // 0-10
  tide: number;   // 0-10
}

export interface QualityScore {
  /** Composite score 0-10 */
  score: number;
  /** Human-readable label */
  label: string;
  /** Sub-scores for transparency */
  sub: QualitySubScores;
  /** Whether this score uses spot-specific metadata (vs generic) */
  hasSpotData: boolean;
}

// =============================================================================
// Labels — map score to descriptive text
// =============================================================================

const LABELS: Array<{ min: number; label: string }> = [
  { min: 9, label: 'Epic' },
  { min: 8, label: 'Excellent' },
  { min: 7, label: 'Good' },
  { min: 6, label: 'Fair–Good' },
  { min: 5, label: 'Fair' },
  { min: 4, label: 'Poor–Fair' },
  { min: 3, label: 'Poor' },
  { min: 2, label: 'Very Poor' },
  { min: 1, label: 'Flat' },
  { min: 0, label: 'Flat' },
];

function scoreToLabel(score: number): string {
  for (const { min, label } of LABELS) {
    if (score >= min) return label;
  }
  return 'Flat';
}

// =============================================================================
// Sub-score: Swell (0-10)
// =============================================================================
// Combines wave height assessment with directional alignment.
// Height scoring uses the spot's optimal range if available, otherwise generic.

function scoreSwell(
  heightM: number,
  swells: SwellData[],
  spot: Spot | null
): number {
  if (heightM < 0.15) return 0; // effectively flat

  // --- Height score (0-10) ---
  let heightScore: number;

  if (spot?.optimal_wave_height_min != null && spot?.optimal_wave_height_max != null) {
    // Per-spot optimal range
    const min = spot.optimal_wave_height_min;
    const max = spot.optimal_wave_height_max;
    const mid = (min + max) / 2;

    if (heightM >= min && heightM <= max) {
      // In sweet spot — score 8-10 based on how centered
      const distFromMid = Math.abs(heightM - mid) / ((max - min) / 2);
      heightScore = 10 - distFromMid * 2;
    } else if (heightM < min) {
      // Below optimal — ramp from 0 at near-flat to 7 at just-below-optimal
      heightScore = Math.min(7, (heightM / min) * 7);
    } else {
      // Above optimal — gentle decay (big waves still rideable, just not ideal)
      const overshoot = (heightM - max) / max;
      heightScore = Math.max(3, 8 - overshoot * 5);
    }
  } else {
    // Generic scoring (no spot metadata)
    if (heightM < 0.3) heightScore = 1;
    else if (heightM < 0.6) heightScore = 3;
    else if (heightM < 1.0) heightScore = 5;
    else if (heightM < 1.5) heightScore = 7;
    else if (heightM < 2.5) heightScore = 9;
    else if (heightM < 4.0) heightScore = 10;
    else heightScore = 8; // very big — great but dangerous
  }

  // --- Direction alignment ---
  let dirFactor = 1.0;

  if (spot?.optimal_swell_dir_min != null && spot?.optimal_swell_dir_max != null && swells.length > 0) {
    const primaryDir = swells[0].direction;
    const optMin = spot.optimal_swell_dir_min;
    const optMax = spot.optimal_swell_dir_max;

    // Calculate angular deviation from the optimal window
    const deviation = angularDeviation(primaryDir, optMin, optMax);

    // cos-based decay: 0° deviation = 1.0, 45° = 0.71, 90° = 0
    // But cap the minimum at 0.1 (even wrong-direction swell has some refraction)
    dirFactor = Math.max(0.1, Math.cos((Math.min(deviation, 90) / 90) * (Math.PI / 2)));
  }

  return clamp(heightScore * dirFactor, 0, 10);
}

// =============================================================================
// Sub-score: Wind (0-10)
// =============================================================================
// Offshore wind = good, onshore = bad. Glass (< 1.5 m/s) = great regardless.
// Uses facing_direction as shore-normal (direction the break faces = offshore direction).

function scoreWind(
  windSpeed: number, // m/s
  windDir: number,   // degrees, meteorological (direction wind comes FROM)
  spot: Spot | null
): number {
  // Glass conditions — great regardless of direction
  // 1.5 m/s ≈ 3.4 mph
  if (windSpeed < 1.5) return 10;

  // Light wind — mostly fine
  // 2.5 m/s ≈ 5.6 mph
  if (windSpeed < 2.5) return 9;

  // Need facing_direction to assess offshore/onshore
  if (spot?.facing_direction == null) {
    // No spot data — score purely on speed (lighter = better)
    if (windSpeed < 5) return 7;
    if (windSpeed < 8) return 5;
    if (windSpeed < 12) return 3;
    return 1;
  }

  // Calculate angle between wind direction and offshore direction
  // facing_direction = direction the break faces (= offshore direction)
  // If wind comes FROM the same direction as facing_direction → onshore (bad)
  // If wind comes FROM opposite direction → offshore (good)
  const offshoreDir = (spot.facing_direction + 180) % 360;
  const angleFromOffshore = angleDiff(windDir, offshoreDir);

  // Direction score: 0° from offshore = 10, 180° (direct onshore) = 0
  let dirScore: number;
  if (angleFromOffshore <= 30) dirScore = 10;       // offshore
  else if (angleFromOffshore <= 60) dirScore = 8;   // cross-offshore
  else if (angleFromOffshore <= 90) dirScore = 5;   // cross-shore
  else if (angleFromOffshore <= 120) dirScore = 3;  // cross-onshore
  else dirScore = 1;                                 // onshore

  // Speed penalty — stronger wind amplifies the direction effect
  // At 5 m/s (11 mph), moderate effect
  // At 10 m/s (22 mph), strong effect
  // At 15+ m/s (33+ mph), even offshore gets degraded
  let speedMod: number;
  if (windSpeed < 4) speedMod = 1.0;
  else if (windSpeed < 7) speedMod = 0.85;
  else if (windSpeed < 10) speedMod = 0.7;
  else if (windSpeed < 13) speedMod = 0.55;
  else speedMod = 0.4; // strong wind degrades everything

  // Strong offshore wind is also bad (paddling difficulty, reverse chop)
  if (angleFromOffshore < 30 && windSpeed > 12) {
    speedMod = Math.min(speedMod, 0.6);
  }

  return clamp(dirScore * speedMod, 0, 10);
}

// =============================================================================
// Sub-score: Period (0-10)
// =============================================================================
// Longer period = better organized groundswell = higher quality waves.
// Based on research: <6s = wind chop, 6-8s = poor, 10-12s = good, 14+ = excellent.

function scorePeriod(
  periodS: number,
  spot: Spot | null
): number {
  if (spot?.optimal_wave_period_min != null && spot?.optimal_wave_period_max != null) {
    const min = spot.optimal_wave_period_min;
    const max = spot.optimal_wave_period_max;

    if (periodS >= min && periodS <= max) return 9;
    if (periodS >= min - 2 && periodS <= max + 4) return 7;
    if (periodS < min - 4) return Math.max(1, 4 - (min - periodS) * 0.5);
    return 8; // above max period is still good
  }

  // Generic period scoring
  if (periodS < 5) return 0;
  if (periodS < 7) return 2;
  if (periodS < 9) return 4;
  if (periodS < 11) return 6;
  if (periodS < 13) return 7;
  if (periodS < 16) return 9;
  return 10;
}

// =============================================================================
// Sub-score: Tide (0-10)
// =============================================================================
// Per-spot tide preference. Without spot data, gives a neutral score.

function scoreTide(
  tideHeightM: number | null,
  tideState: string | null,
  spot: Spot | null
): number {
  if (tideHeightM == null) return 5; // no tide data — neutral

  // Without spot tide preference, give a moderate score
  // (mid-tide is generally okay for most spots)
  if (!spot?.optimal_tide) return 6;

  const tide = spot.optimal_tide.toLowerCase();

  // Simple matching based on spot's stated preference
  const isRising = tideState === 'rising';
  const isFalling = tideState === 'falling';
  const isHigh = tideState === 'high';
  const isLow = tideState === 'low';

  switch (tide) {
    case 'low':
      if (isLow) return 10;
      if (isFalling) return 7;
      if (isRising && tideHeightM < 0.3) return 8;
      if (isHigh) return 2;
      return 5;

    case 'mid':
      if ((isRising || isFalling) && !isHigh && !isLow) return 9;
      if (isLow || isHigh) return 4;
      return 7;

    case 'high':
      if (isHigh) return 10;
      if (isRising) return 7;
      if (isFalling && tideHeightM > 0.5) return 8;
      if (isLow) return 2;
      return 5;

    case 'rising':
      if (isRising) return 10;
      if (isLow) return 6; // about to rise
      if (isFalling) return 3;
      return 5;

    case 'falling':
      if (isFalling) return 10;
      if (isHigh) return 6; // about to fall
      if (isRising) return 3;
      return 5;

    case 'any':
      return 8; // works at all tides

    default:
      return 6;
  }
}

// =============================================================================
// Main scoring function
// =============================================================================

const WEIGHTS = {
  swell: 0.35,
  wind: 0.30,
  period: 0.20,
  tide: 0.15,
};

/**
 * Compute a quality score for a forecast entry at a specific spot.
 *
 * @param forecast - Forecast data for a single time step
 * @param spot - Spot metadata (null for arbitrary ocean points)
 * @returns Quality score with sub-scores for transparency
 */
export function computeQuality(
  forecast: ForecastAtPoint,
  spot: Spot | null = null
): QualityScore {
  const primaryPeriod = forecast.waves.swells[0]?.period ?? forecast.waves.period;

  const sub: QualitySubScores = {
    swell: scoreSwell(forecast.waves.height, forecast.waves.swells, spot),
    wind: scoreWind(forecast.wind.speed, forecast.wind.direction, spot),
    period: scorePeriod(primaryPeriod, spot),
    tide: scoreTide(
      forecast.tide?.height ?? null,
      forecast.tide?.state ?? null,
      spot
    ),
  };

  const score = clamp(
    sub.swell * WEIGHTS.swell +
    sub.wind * WEIGHTS.wind +
    sub.period * WEIGHTS.period +
    sub.tide * WEIGHTS.tide,
    0,
    10
  );

  // Round to 1 decimal
  const rounded = Math.round(score * 10) / 10;

  return {
    score: rounded,
    label: scoreToLabel(rounded),
    sub,
    hasSpotData: spot != null,
  };
}

// =============================================================================
// Score color — maps 0-10 to a CSS color for visual display
// =============================================================================

export function scoreColor(score: number): string {
  if (score >= 8) return '#22C55E';   // green — good to epic
  if (score >= 6) return '#84CC16';   // lime — fair to good
  if (score >= 4) return '#EAB308';   // yellow — poor to fair
  if (score >= 2) return '#F97316';   // orange — poor
  return '#9CA3AF';                    // gray — flat/very poor
}

/**
 * Map a 0-10 score to the Tailwind border class used in SpotPanel rows.
 */
export function scoreToBorderClass(score: number): string {
  if (score >= 8) return 'border-l-quality-epic';
  if (score >= 6.5) return 'border-l-quality-great';
  if (score >= 5) return 'border-l-quality-good';
  if (score >= 3) return 'border-l-quality-fair';
  return 'border-l-quality-poor';
}

// =============================================================================
// Utility
// =============================================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Absolute angular difference between two bearings (0-180) */
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(((a - b + 180) % 360) - 180);
  return diff;
}

/**
 * Angular deviation from an optimal window [min, max].
 * Returns 0 if within the window, otherwise the degrees outside.
 * Handles wraparound (e.g., min=300, max=60 crosses north).
 */
function angularDeviation(dir: number, optMin: number, optMax: number): number {
  // Normalize
  dir = ((dir % 360) + 360) % 360;

  if (optMin <= optMax) {
    // Normal range (e.g., 180-270)
    if (dir >= optMin && dir <= optMax) return 0;
    return Math.min(
      angleDiff(dir, optMin),
      angleDiff(dir, optMax)
    );
  } else {
    // Wraps around north (e.g., 300-60)
    if (dir >= optMin || dir <= optMax) return 0;
    return Math.min(
      angleDiff(dir, optMin),
      angleDiff(dir, optMax)
    );
  }
}
