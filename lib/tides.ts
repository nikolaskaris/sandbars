// =============================================================================
// Tide Predictions — grid-based global lookup + legacy per-spot fallback
// =============================================================================

import { createClient } from '@/lib/supabase/client';
import { DATA_URLS } from '@/lib/config';

// =============================================================================
// Types
// =============================================================================

export interface TidePrediction {
  spotId: string;
  startTime: string;
  intervalMinutes: number;
  heights: number[];
  metadata: {
    model: string;
    high_tides: Array<{ time: string; height: number }>;
    low_tides: Array<{ time: string; height: number }>;
  };
}

export interface TideGridHeader {
  version: number;
  model: string;
  computed_at: string;
  start_time: string;
  interval_minutes: number;
  num_time_points: number;
  num_locations: number;
  points: Array<{ lat: number; lng: number }>;
}

export interface TideAtPoint {
  height: number; // meters
  state: 'rising' | 'falling' | 'high' | 'low';
  nextHigh: { time: Date; height: number } | null;
  nextLow: { time: Date; height: number } | null;
}

// =============================================================================
// Grid cache (singleton, loaded once per session)
// =============================================================================

let gridHeader: TideGridHeader | null = null;
let gridData: Int16Array | null = null;
let gridLoadPromise: Promise<boolean> | null = null;

/**
 * Load the tide grid files (header JSON + binary data).
 * Cached after first successful load. Returns true if grid is available.
 */
export async function loadTideGrid(): Promise<boolean> {
  if (gridHeader && gridData) return true;

  // Deduplicate concurrent calls
  if (gridLoadPromise) return gridLoadPromise;

  gridLoadPromise = (async () => {
    try {
      const [headerRes, dataRes] = await Promise.all([
        fetch(DATA_URLS.tideGridHeader),
        fetch(DATA_URLS.tideGridData),
      ]);

      if (!headerRes.ok || !dataRes.ok) {
        console.warn('Tide grid not available:', headerRes.status, dataRes.status);
        return false;
      }

      gridHeader = (await headerRes.json()) as TideGridHeader;
      const buffer = await dataRes.arrayBuffer();
      gridData = new Int16Array(buffer);

      const expectedLen = gridHeader.num_locations * gridHeader.num_time_points;
      if (gridData.length !== expectedLen) {
        console.warn(
          `Tide grid size mismatch: got ${gridData.length}, expected ${expectedLen}`
        );
        gridHeader = null;
        gridData = null;
        return false;
      }

      console.log(
        `Tide grid loaded: ${gridHeader.num_locations} coastal points, ` +
          `${gridHeader.num_time_points} time steps`
      );
      return true;
    } catch (e) {
      console.warn('Failed to load tide grid:', e);
      return false;
    } finally {
      gridLoadPromise = null;
    }
  })();

  return gridLoadPromise;
}

// =============================================================================
// Grid-based tide lookup
// =============================================================================

/**
 * Find the nearest coastal grid point index by squared distance.
 * Returns -1 if no grid is loaded.
 */
function findNearestGridPoint(lat: number, lng: number): number {
  if (!gridHeader) return -1;

  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < gridHeader.points.length; i++) {
    const p = gridHeader.points[i];
    const dlat = p.lat - lat;
    // Approximate lng distance scaling by cos(lat)
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dlng = (p.lng - lng) * cosLat;
    const dist = dlat * dlat + dlng * dlng;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  // Reject if nearest point is more than ~75km away (roughly 0.75° at equator)
  if (bestDist > 0.75 * 0.75) return -1;

  return bestIdx;
}

/**
 * Read the height array for a grid point (in meters, converted from centimeters).
 */
function getGridPointHeights(pointIndex: number): number[] | null {
  if (!gridHeader || !gridData || pointIndex < 0) return null;

  const n = gridHeader.num_time_points;
  const offset = pointIndex * n;
  const heights: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    heights[i] = gridData[offset + i] / 100; // centimeters → meters
  }

  return heights;
}

/**
 * Interpolate tide height at an exact time from a height array.
 */
function interpolateHeight(
  heights: number[],
  startMs: number,
  intervalMs: number,
  targetMs: number
): number | null {
  const exactIndex = (targetMs - startMs) / intervalMs;
  if (exactIndex < 0 || exactIndex >= heights.length - 1) return null;

  const i = Math.floor(exactIndex);
  const frac = exactIndex - i;
  return heights[i] + frac * (heights[i + 1] - heights[i]);
}

/**
 * Determine tide state from surrounding values.
 */
function computeTideState(
  heights: number[],
  startMs: number,
  intervalMs: number,
  targetMs: number
): 'rising' | 'falling' | 'high' | 'low' | null {
  const current = interpolateHeight(heights, startMs, intervalMs, targetMs);
  const earlier = interpolateHeight(heights, startMs, intervalMs, targetMs - 30 * 60000);
  const later = interpolateHeight(heights, startMs, intervalMs, targetMs + 30 * 60000);

  if (current === null || earlier === null || later === null) return null;

  if (current > earlier && current > later) return 'high';
  if (current < earlier && current < later) return 'low';
  return current > earlier ? 'rising' : 'falling';
}

/**
 * Find next high and low tides from a height array using 3-point extrema detection.
 */
function findNextTides(
  heights: number[],
  startMs: number,
  intervalMs: number,
  fromMs: number
): {
  nextHigh: { time: Date; height: number } | null;
  nextLow: { time: Date; height: number } | null;
} {
  let nextHigh: { time: Date; height: number } | null = null;
  let nextLow: { time: Date; height: number } | null = null;

  for (let i = 1; i < heights.length - 1; i++) {
    const timeMs = startMs + i * intervalMs;
    if (timeMs <= fromMs) continue;

    if (!nextHigh && heights[i] > heights[i - 1] && heights[i] > heights[i + 1]) {
      nextHigh = { time: new Date(timeMs), height: heights[i] };
    }
    if (!nextLow && heights[i] < heights[i - 1] && heights[i] < heights[i + 1]) {
      nextLow = { time: new Date(timeMs), height: heights[i] };
    }
    if (nextHigh && nextLow) break;
  }

  return { nextHigh, nextLow };
}

/**
 * Get complete tide info at any ocean point using the precomputed grid.
 * Returns null if grid isn't loaded or point is too far from any coastal grid point.
 */
export async function getTideAtPoint(
  lat: number,
  lng: number,
  time: Date
): Promise<TideAtPoint | null> {
  const loaded = await loadTideGrid();
  if (!loaded || !gridHeader) return null;

  const idx = findNearestGridPoint(lat, lng);
  if (idx < 0) return null;

  const heights = getGridPointHeights(idx);
  if (!heights) return null;

  const startMs = new Date(gridHeader.start_time).getTime();
  const intervalMs = gridHeader.interval_minutes * 60 * 1000;
  const targetMs = time.getTime();

  const height = interpolateHeight(heights, startMs, intervalMs, targetMs);
  if (height === null) return null;

  const state = computeTideState(heights, startMs, intervalMs, targetMs) || 'rising';
  const { nextHigh, nextLow } = findNextTides(heights, startMs, intervalMs, targetMs);

  return { height, state, nextHigh, nextLow };
}

/**
 * Get tide heights for a range of hours (for sparkline rendering).
 * Returns an array of { time: Date, height: number } or null if unavailable.
 */
export async function getTideCurve(
  lat: number,
  lng: number,
  centerTime: Date,
  hoursBeforeAfter: number = 12
): Promise<Array<{ time: Date; height: number }> | null> {
  const loaded = await loadTideGrid();
  if (!loaded || !gridHeader) return null;

  const idx = findNearestGridPoint(lat, lng);
  if (idx < 0) return null;

  const heights = getGridPointHeights(idx);
  if (!heights) return null;

  const startMs = new Date(gridHeader.start_time).getTime();
  const intervalMs = gridHeader.interval_minutes * 60 * 1000;
  const centerMs = centerTime.getTime();

  const fromMs = centerMs - hoursBeforeAfter * 3600000;
  const toMs = centerMs + hoursBeforeAfter * 3600000;

  // Sample every 15 minutes for smooth curve
  const step = 15 * 60000;
  const curve: Array<{ time: Date; height: number }> = [];

  for (let ms = fromMs; ms <= toMs; ms += step) {
    const h = interpolateHeight(heights, startMs, intervalMs, ms);
    if (h !== null) {
      curve.push({ time: new Date(ms), height: h });
    }
  }

  return curve.length > 0 ? curve : null;
}

/**
 * Get tide height at a specific forecast time for a given location.
 * Convenience wrapper for SpotPanel forecast rows.
 */
export async function getTideHeightAtTime(
  lat: number,
  lng: number,
  time: Date
): Promise<{ height: number; state: 'rising' | 'falling' | 'high' | 'low' } | null> {
  const loaded = await loadTideGrid();
  if (!loaded || !gridHeader) return null;

  const idx = findNearestGridPoint(lat, lng);
  if (idx < 0) return null;

  const heights = getGridPointHeights(idx);
  if (!heights) return null;

  const startMs = new Date(gridHeader.start_time).getTime();
  const intervalMs = gridHeader.interval_minutes * 60 * 1000;
  const targetMs = time.getTime();

  const height = interpolateHeight(heights, startMs, intervalMs, targetMs);
  if (height === null) return null;

  const state = computeTideState(heights, startMs, intervalMs, targetMs) || 'rising';

  return { height, state };
}

// =============================================================================
// Legacy per-spot functions (fallback, will be deprecated)
// =============================================================================

/**
 * Get the latest tide prediction for a spot from Supabase.
 * @deprecated Use getTideAtPoint() with grid lookup instead.
 */
export async function getTidePrediction(spotId: string): Promise<TidePrediction | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tide_predictions')
    .select('*')
    .eq('spot_id', spotId)
    .order('start_time', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    spotId: data.spot_id,
    startTime: data.start_time,
    intervalMinutes: data.interval_minutes,
    heights: data.heights,
    metadata: data.metadata,
  };
}

/**
 * Get the tide height at a specific time, linearly interpolating between data points.
 * @deprecated Use getTideAtPoint() with grid lookup instead.
 */
export function getTideAtTime(prediction: TidePrediction, targetTime: Date): number | null {
  const startMs = new Date(prediction.startTime).getTime();
  const intervalMs = prediction.intervalMinutes * 60 * 1000;
  return interpolateHeight(prediction.heights, startMs, intervalMs, targetTime.getTime());
}

/**
 * Get tide state: rising, falling, high, or low.
 * @deprecated Use getTideAtPoint() with grid lookup instead.
 */
export function getTideState(
  prediction: TidePrediction,
  targetTime: Date
): 'rising' | 'falling' | 'high' | 'low' | null {
  const startMs = new Date(prediction.startTime).getTime();
  const intervalMs = prediction.intervalMinutes * 60 * 1000;
  return computeTideState(prediction.heights, startMs, intervalMs, targetTime.getTime());
}

/**
 * Get the next high and low tide times from a given time.
 * @deprecated Use getTideAtPoint() with grid lookup instead.
 */
export function getNextTides(
  prediction: TidePrediction,
  fromTime: Date
): { nextHigh: { time: string; height: number } | null; nextLow: { time: string; height: number } | null } {
  const fromMs = fromTime.getTime();

  const nextHigh =
    prediction.metadata.high_tides?.find((h) => new Date(h.time).getTime() > fromMs) || null;
  const nextLow =
    prediction.metadata.low_tides?.find((l) => new Date(l.time).getTime() > fromMs) || null;

  return { nextHigh, nextLow };
}
