// =============================================================================
// Recommendation Engine — finds the best upcoming surf sessions
// =============================================================================
//
// Scans all favorites × all forecast hours to find contiguous windows of
// good conditions. Ranks by quality score and recency (sooner is better).

import type { Favorite } from '@/lib/favorites-service';
import type { ForecastAtPoint, ForecastSummary } from '@/lib/forecast';
import type { Spot } from '@/lib/spots';
import { getFullForecast } from '@/lib/forecast';
import { computeQuality, type QualityScore } from '@/lib/quality';
import { findNearestSpot } from '@/lib/spots';
import { degreesToCompass } from '@/lib/wave-utils';
import { convertWaveHeight } from '@/lib/preferences';

// =============================================================================
// Types
// =============================================================================

export interface SessionRecommendation {
  spot: Favorite;
  spotMeta: Spot | null;
  bestHours: Array<ForecastAtPoint & { quality: QualityScore }>;
  peakScore: number;
  avgScore: number;
  startTime: Date;
  endTime: Date;
  summary: {
    waveHeightRange: [number, number]; // meters [min, max]
    period: number;
    swellDir: string;       // compass direction
    windSpeed: number;      // m/s
    windDesc: string;       // "offshore", "onshore", "light", "glass"
    tideState: string;
    waterTemp: number | null;
  };
}

export interface SpotForecast {
  spot: Favorite;
  spotMeta: Spot | null;
  forecast: ForecastSummary;
  qualityScores: Array<{ time: Date; score: number; label: string }>;
  bestWindow: SessionRecommendation | null;
  currentScore: QualityScore | null;
}

// =============================================================================
// Core
// =============================================================================

const MIN_WINDOW_SCORE = 3.5; // Minimum score to consider a window "worth checking"
const MIN_WINDOW_HOURS = 2;   // Minimum contiguous hours for a session

/**
 * Load forecast + quality data for a single spot.
 */
export async function getSpotForecast(
  fav: Favorite,
  signal?: AbortSignal
): Promise<SpotForecast> {
  const spotMeta = await findNearestSpot(fav.lat, fav.lng, 0.05);
  const forecast = await getFullForecast(fav.lat, fav.lng, signal);

  // Compute quality for each hour
  const qualityScores = forecast.hours.map((h) => {
    const q = computeQuality(h, spotMeta);
    return {
      time: new Date(h.validTime),
      score: q.score,
      label: q.label,
    };
  });

  // Current score (first hour)
  const currentScore = forecast.hours.length > 0
    ? computeQuality(forecast.hours[0], spotMeta)
    : null;

  // Find the best contiguous window
  const bestWindow = findBestWindow(fav, spotMeta, forecast.hours, qualityScores);

  return { spot: fav, spotMeta, forecast, qualityScores, bestWindow, currentScore };
}

/**
 * Get recommendations across all favorites, ranked by quality and recency.
 */
export async function getRecommendations(
  favorites: Favorite[],
  limit = 5,
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number) => void
): Promise<{ spotForecasts: SpotForecast[]; recommendations: SessionRecommendation[] }> {
  const spotForecasts: SpotForecast[] = [];
  let completed = 0;

  // Fetch all spot forecasts in parallel
  await Promise.all(
    favorites.map(async (fav) => {
      if (signal?.aborted) return;
      try {
        const sf = await getSpotForecast(fav, signal);
        spotForecasts.push(sf);
      } catch {
        // Skip failed spots
      } finally {
        completed++;
        onProgress?.(completed, favorites.length);
      }
    })
  );

  // Collect all windows from all spots
  const allWindows: SessionRecommendation[] = spotForecasts
    .filter((sf) => sf.bestWindow)
    .map((sf) => sf.bestWindow!);

  // Rank: peak score × recency weight
  const now = Date.now();
  const ranked = allWindows
    .map((w) => {
      const hoursUntil = Math.max(0, (w.startTime.getTime() - now) / 3600000);
      // Recency weight: 1.0 for now, decays to 0.6 at 7 days out
      const recencyWeight = 1.0 - 0.4 * Math.min(hoursUntil / (7 * 24), 1);
      return { rec: w, rank: w.peakScore * recencyWeight };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((r) => r.rec);

  return { spotForecasts, recommendations: ranked };
}

// =============================================================================
// Window finding
// =============================================================================

function findBestWindow(
  fav: Favorite,
  spotMeta: Spot | null,
  hours: ForecastAtPoint[],
  scores: Array<{ time: Date; score: number }>
): SessionRecommendation | null {
  if (hours.length === 0) return null;

  // Find contiguous windows where score ≥ threshold
  const windows: Array<{ start: number; end: number; peakScore: number; sumScore: number }> = [];
  let windowStart = -1;
  let windowPeak = 0;
  let windowSum = 0;

  for (let i = 0; i < scores.length; i++) {
    if (scores[i].score >= MIN_WINDOW_SCORE) {
      if (windowStart < 0) {
        windowStart = i;
        windowPeak = 0;
        windowSum = 0;
      }
      windowPeak = Math.max(windowPeak, scores[i].score);
      windowSum += scores[i].score;
    } else {
      if (windowStart >= 0) {
        windows.push({ start: windowStart, end: i - 1, peakScore: windowPeak, sumScore: windowSum });
        windowStart = -1;
      }
    }
  }
  if (windowStart >= 0) {
    windows.push({ start: windowStart, end: scores.length - 1, peakScore: windowPeak, sumScore: windowSum });
  }

  // Filter by minimum duration
  const validWindows = windows.filter((w) => {
    const startMs = scores[w.start].time.getTime();
    const endMs = scores[w.end].time.getTime();
    return (endMs - startMs) / 3600000 >= MIN_WINDOW_HOURS;
  });

  if (validWindows.length === 0) return null;

  // Pick the best raw window (highest peak, earliest as tiebreaker)
  const best = validWindows.sort((a, b) => b.peakScore - a.peakScore || a.start - b.start)[0];

  // Score all hours in the window
  const allWindowHours = hours.slice(best.start, best.end + 1).map((h) => ({
    ...h,
    quality: computeQuality(h, spotMeta),
  }));

  // Narrow to the PEAK sub-window: find the best contiguous ~3-6hr block
  // within the larger window. This gives surfers a specific actionable window
  // instead of a 16-hour block.
  const narrowed = narrowToPeakWindow(allWindowHours, scores.slice(best.start, best.end + 1));

  const peakHour = narrowed.reduce((a, b) => (a.quality.score > b.quality.score ? a : b));
  const count = narrowed.length;

  // Summarize conditions at peak hour
  const peakSwell = peakHour.waves.swells[0];
  const windAngle = spotMeta?.facing_direction != null
    ? angleDiff(peakHour.wind.direction, (spotMeta.facing_direction + 180) % 360)
    : 180;

  let windDesc: string;
  if (peakHour.wind.speed < 1.5) windDesc = 'glass';
  else if (peakHour.wind.speed < 3) windDesc = 'light wind';
  else if (windAngle < 60) windDesc = 'offshore wind';
  else if (windAngle < 120) windDesc = 'cross-shore wind';
  else windDesc = 'onshore wind';

  const heights = narrowed.map((h) => h.waves.height);

  // Tide description at the peak hour — specific, not vague
  let tideDesc = '';
  if (peakHour.tide) {
    tideDesc = `${peakHour.tide.state} tide`;
  }

  return {
    spot: fav,
    spotMeta,
    bestHours: narrowed,
    peakScore: best.peakScore,
    avgScore: narrowed.reduce((s, h) => s + h.quality.score, 0) / count,
    startTime: new Date(narrowed[0].validTime),
    endTime: new Date(narrowed[narrowed.length - 1].validTime),
    summary: {
      waveHeightRange: [Math.min(...heights), Math.max(...heights)],
      period: peakSwell?.period ?? peakHour.waves.period,
      swellDir: degreesToCompass(peakSwell?.direction ?? peakHour.waves.direction),
      windSpeed: peakHour.wind.speed,
      windDesc,
      tideState: tideDesc || 'unknown',
      waterTemp: peakHour.waterTemp,
    },
  };
}

// Practical surfing hours: 6 AM to 7 PM local time
const EARLIEST_SURF_HOUR = 6;
const LATEST_SURF_HOUR = 19;

/**
 * Filter forecast hours to daylight surfing hours only (6 AM - 7 PM local).
 */
function filterDaylightHours<T extends { validTime: string }>(hours: T[]): T[] {
  return hours.filter((h) => {
    const localHour = new Date(h.validTime).getHours();
    return localHour >= EARLIEST_SURF_HOUR && localHour < LATEST_SURF_HOUR;
  });
}

/**
 * Narrow a wide window to the best 1-2 forecast step session (~3-6 hours).
 *
 * Strategy:
 * 1. Filter to daylight hours only (6 AM - 7 PM)
 * 2. Find the single best scoring hour as the anchor
 * 3. Extend to the adjacent hour if it's also good (score within 80% of peak)
 * 4. Cap at 2 forecast steps (max ~6 hours)
 */
function narrowToPeakWindow<T extends { quality: { score: number }; validTime: string }>(
  windowHours: T[],
  _scores: Array<{ time: Date; score: number }>
): T[] {
  // Step 1: filter to daylight
  const daylight = filterDaylightHours(windowHours);
  if (daylight.length === 0) return windowHours.slice(0, 1); // fallback to first hour
  if (daylight.length === 1) return daylight;

  // Step 2: find the peak hour
  let peakIdx = 0;
  for (let i = 1; i < daylight.length; i++) {
    if (daylight[i].quality.score > daylight[peakIdx].quality.score) {
      peakIdx = i;
    }
  }

  const peakScore = daylight[peakIdx].quality.score;
  const threshold = peakScore * 0.8; // adjacent hour must be within 80% of peak

  // Step 3: expand from peak to adjacent good hours (max 2 total = ~6hr)
  let start = peakIdx;
  let end = peakIdx;

  // Try extending backward
  if (start > 0 && daylight[start - 1].quality.score >= threshold) {
    start--;
  }
  // Try extending forward (only if we haven't already expanded to 2)
  if (end - start < 1 && end < daylight.length - 1 && daylight[end + 1].quality.score >= threshold) {
    end++;
  }

  return daylight.slice(start, end + 1);
}

// =============================================================================
// Formatting helpers
// =============================================================================

/**
 * Format a recommendation as a plain-language one-liner.
 */
export function formatRecommendation(
  rec: SessionRecommendation,
  waveUnit: 'ft' | 'm' = 'ft'
): string {
  const s = rec.summary;
  const hLow = convertWaveHeight(s.waveHeightRange[0], waveUnit);
  const hHigh = convertWaveHeight(s.waveHeightRange[1], waveUnit);
  const heightStr = hLow === hHigh ? `${hLow}${waveUnit}` : `${hLow}-${hHigh}${waveUnit}`;

  const parts = [
    `${heightStr}`,
    `${s.period}s ${s.swellDir} swell`,
    s.windDesc !== 'glass' && s.windDesc !== 'light wind' ? s.windDesc : null,
    s.tideState && s.tideState !== 'unknown' ? s.tideState : null,
  ].filter(Boolean);

  return parts.join(', ') + '.';
}

/**
 * Format the time window as readable text.
 */
export function formatTimeWindow(rec: SessionRecommendation): string {
  const now = new Date();
  const start = rec.startTime;
  // End time = last forecast step + 3 hours (each step covers a 3hr period)
  const end = new Date(rec.endTime.getTime() + 3 * 3600000);

  // Cap end time at sunset (7 PM)
  const sunset = new Date(end);
  sunset.setHours(LATEST_SURF_HOUR, 0, 0, 0);
  const displayEnd = end > sunset ? sunset : end;

  const isToday = start.toDateString() === now.toDateString();
  const isTomorrow = start.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const dayStr = isToday ? 'today' : isTomorrow ? 'tomorrow' : start.toLocaleDateString('en-US', { weekday: 'long' });

  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  const endTime = displayEnd.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

  return `${dayStr} ${startTime}–${endTime}`;
}

// =============================================================================
// Utility
// =============================================================================

function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 180) % 360) - 180);
}
