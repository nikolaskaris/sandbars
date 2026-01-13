/**
 * Spatial Interpolation Module
 * Implements Inverse Distance Weighting (IDW) for multi-source data
 */

import { QualityFlag } from '@/types';

export interface DataPoint {
  value: number;
  distance: number; // kilometers
  quality: QualityFlag;
}

/**
 * Inverse Distance Weighting (IDW) interpolation
 * Weight = 1 / distance^power
 *
 * @param dataPoints - Array of data points with values and distances
 * @param power - Power parameter (default 2)
 * @param maxDistance - Maximum distance to consider (km)
 * @returns Interpolated value or null if no valid data
 */
export function inverseDistanceWeighting(
  dataPoints: DataPoint[],
  power: number = 2,
  maxDistance: number = 100
): { value: number; quality: QualityFlag } | null {
  // Filter out invalid data points
  const validPoints = dataPoints.filter(
    p => p.distance <= maxDistance && !isNaN(p.value) && p.value !== null
  );

  if (validPoints.length === 0) {
    return null;
  }

  // If we have a very close point (< 1km), just use it
  const veryClose = validPoints.find(p => p.distance < 1);
  if (veryClose) {
    return { value: veryClose.value, quality: veryClose.quality };
  }

  // If only one point, return it
  if (validPoints.length === 1) {
    return { value: validPoints[0].value, quality: validPoints[0].quality };
  }

  // Calculate weights
  let weightedSum = 0;
  let weightSum = 0;

  for (const point of validPoints) {
    const weight = 1 / Math.pow(point.distance, power);
    weightedSum += point.value * weight;
    weightSum += weight;
  }

  const interpolatedValue = weightedSum / weightSum;

  // Determine quality based on sources
  const hasPrimary = validPoints.some(p => p.quality === 'primary');
  const quality: QualityFlag = hasPrimary ? 'interpolated' : 'modeled';

  return { value: interpolatedValue, quality };
}

/**
 * Temporal interpolation between two values
 */
export function temporalInterpolation(
  value1: number,
  time1: Date,
  value2: number,
  time2: Date,
  targetTime: Date
): number {
  const t1 = time1.getTime();
  const t2 = time2.getTime();
  const target = targetTime.getTime();

  // Linear interpolation
  const ratio = (target - t1) / (t2 - t1);
  return value1 + (value2 - value1) * ratio;
}

/**
 * Interpolate between buoys accounting for bathymetry
 * Uses standard IDW but with distance-based weighting that considers
 * coastal effects (closer to shore = more variable conditions)
 */
export function interpolateWaveData(
  dataPoints: DataPoint[],
  distanceToShore: number // km
): { value: number; quality: QualityFlag } | null {
  // For wave data, use higher power near shore (more local variation)
  const power = distanceToShore < 10 ? 3 : 2;
  const maxDistance = distanceToShore < 10 ? 50 : 100;

  return inverseDistanceWeighting(dataPoints, power, maxDistance);
}

/**
 * Interpolate wind data with caution near coastlines
 */
export function interpolateWindData(
  dataPoints: DataPoint[],
  distanceToShore: number // km
): { value: number; quality: QualityFlag } | null {
  // Wind is less reliable near coastline due to land/sea effects
  if (distanceToShore < 5) {
    // Only use very close stations near shore
    const closePoints = dataPoints.filter(p => p.distance < 20);
    if (closePoints.length === 0) {
      return null;
    }
    return inverseDistanceWeighting(closePoints, 2, 20);
  }

  return inverseDistanceWeighting(dataPoints, 2, 50);
}

/**
 * Simple averaging for slowly-changing variables like water temperature
 */
export function interpolateSlowVariable(
  dataPoints: DataPoint[],
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours in ms
): { value: number; quality: QualityFlag } | null {
  const validPoints = dataPoints.filter(
    p => !isNaN(p.value) && p.value !== null && p.distance < 200
  );

  if (validPoints.length === 0) {
    return null;
  }

  // Simple average for slow variables
  const sum = validPoints.reduce((acc, p) => acc + p.value, 0);
  const avg = sum / validPoints.length;

  return { value: avg, quality: 'interpolated' };
}
