/**
 * Spatial Interpolation Unit Tests
 *
 * Tests for Inverse Distance Weighting (IDW) and other interpolation functions.
 */

import { describe, test, expect } from '@jest/globals';
import {
  inverseDistanceWeighting,
  temporalInterpolation,
  interpolateWaveData,
  interpolateWindData,
  interpolateSlowVariable,
  DataPoint,
} from '@/lib/forecast/interpolation';

describe('Spatial Interpolation', () => {
  describe('inverseDistanceWeighting', () => {
    test('should return null for empty array', () => {
      const result = inverseDistanceWeighting([]);
      expect(result).toBeNull();
    });

    test('should return null when all points are too far', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 150, quality: 'primary' },
        { value: 1.5, distance: 200, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints, 2, 100);
      expect(result).toBeNull();
    });

    test('should return very close point directly', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.5, distance: 0.5, quality: 'primary' },
        { value: 1.5, distance: 50, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      expect(result?.value).toBe(2.5);
      expect(result?.quality).toBe('primary');
    });

    test('should return single valid point', () => {
      const dataPoints: DataPoint[] = [
        { value: 3.0, distance: 25, quality: 'interpolated' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      expect(result?.value).toBe(3.0);
      expect(result?.quality).toBe('interpolated');
    });

    test('should weight closer points more heavily', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 10, quality: 'primary' },
        { value: 4.0, distance: 100, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints, 2, 150);
      // Closer point (2.0) should dominate
      expect(result?.value).toBeLessThan(2.5);
    });

    test('should interpolate equally between equidistant points', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 50, quality: 'primary' },
        { value: 4.0, distance: 50, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      // Should be exactly in the middle
      expect(result?.value).toBe(3.0);
    });

    test('should handle power parameter', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 10, quality: 'primary' },
        { value: 4.0, distance: 20, quality: 'primary' },
      ];
      // Higher power = more weight to closer points
      const resultPower1 = inverseDistanceWeighting(dataPoints, 1, 100);
      const resultPower3 = inverseDistanceWeighting(dataPoints, 3, 100);
      // Power 3 should be closer to 2.0 (the nearer value)
      expect(resultPower3!.value).toBeLessThan(resultPower1!.value);
    });

    test('should mark quality as interpolated when primary sources used', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 30, quality: 'primary' },
        { value: 3.0, distance: 40, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      expect(result?.quality).toBe('interpolated');
    });

    test('should mark quality as modeled when no primary sources', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 30, quality: 'modeled' },
        { value: 3.0, distance: 40, quality: 'interpolated' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      expect(result?.quality).toBe('modeled');
    });

    test('should filter out NaN values', () => {
      const dataPoints: DataPoint[] = [
        { value: NaN, distance: 10, quality: 'primary' },
        { value: 3.0, distance: 50, quality: 'primary' },
      ];
      const result = inverseDistanceWeighting(dataPoints);
      expect(result?.value).toBe(3.0);
    });
  });

  describe('temporalInterpolation', () => {
    test('should return first value at start time', () => {
      const time1 = new Date('2024-01-01T00:00:00Z');
      const time2 = new Date('2024-01-01T02:00:00Z');
      const result = temporalInterpolation(2.0, time1, 4.0, time2, time1);
      expect(result).toBe(2.0);
    });

    test('should return second value at end time', () => {
      const time1 = new Date('2024-01-01T00:00:00Z');
      const time2 = new Date('2024-01-01T02:00:00Z');
      const result = temporalInterpolation(2.0, time1, 4.0, time2, time2);
      expect(result).toBe(4.0);
    });

    test('should return midpoint at middle time', () => {
      const time1 = new Date('2024-01-01T00:00:00Z');
      const time2 = new Date('2024-01-01T02:00:00Z');
      const midTime = new Date('2024-01-01T01:00:00Z');
      const result = temporalInterpolation(2.0, time1, 4.0, time2, midTime);
      expect(result).toBe(3.0);
    });

    test('should handle decreasing values', () => {
      const time1 = new Date('2024-01-01T00:00:00Z');
      const time2 = new Date('2024-01-01T02:00:00Z');
      const midTime = new Date('2024-01-01T01:00:00Z');
      const result = temporalInterpolation(4.0, time1, 2.0, time2, midTime);
      expect(result).toBe(3.0);
    });

    test('should interpolate at quarter points correctly', () => {
      const time1 = new Date('2024-01-01T00:00:00Z');
      const time2 = new Date('2024-01-01T04:00:00Z');
      const quarterTime = new Date('2024-01-01T01:00:00Z');
      // At 25% through the time range
      const result = temporalInterpolation(0, time1, 8.0, time2, quarterTime);
      expect(result).toBe(2.0); // 25% of 8 = 2
    });
  });

  describe('interpolateWaveData', () => {
    test('should use higher power near shore', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 10, quality: 'primary' },
        { value: 3.0, distance: 20, quality: 'primary' },
      ];
      // Near shore (< 10km) uses power 3
      const nearShore = interpolateWaveData(dataPoints, 5);
      // Offshore uses power 2
      const offshore = interpolateWaveData(dataPoints, 50);
      // Both should return values but nearShore should weight closer point more
      expect(nearShore?.value).toBeLessThan(offshore!.value);
    });

    test('should use smaller max distance near shore', () => {
      const dataPoints: DataPoint[] = [
        { value: 2.0, distance: 60, quality: 'primary' },
      ];
      // Near shore (maxDistance = 50) should exclude 60km point
      const nearShore = interpolateWaveData(dataPoints, 5);
      expect(nearShore).toBeNull();
      // Offshore (maxDistance = 100) should include it
      const offshore = interpolateWaveData(dataPoints, 50);
      expect(offshore?.value).toBe(2.0);
    });
  });

  describe('interpolateWindData', () => {
    test('should only use close stations near shore', () => {
      const dataPoints: DataPoint[] = [
        { value: 5.0, distance: 15, quality: 'primary' },
        { value: 8.0, distance: 30, quality: 'primary' },
      ];
      // Very near shore (< 5km): only use points within 20km
      const nearShore = interpolateWindData(dataPoints, 2);
      expect(nearShore?.value).toBe(5.0); // Only 15km point qualifies
    });

    test('should return null if no close stations near shore', () => {
      const dataPoints: DataPoint[] = [
        { value: 5.0, distance: 25, quality: 'primary' },
      ];
      const nearShore = interpolateWindData(dataPoints, 2);
      expect(nearShore).toBeNull();
    });

    test('should use normal IDW offshore', () => {
      const dataPoints: DataPoint[] = [
        { value: 5.0, distance: 20, quality: 'primary' },
        { value: 10.0, distance: 40, quality: 'primary' },
      ];
      const offshore = interpolateWindData(dataPoints, 20);
      expect(offshore).not.toBeNull();
      // Should be weighted toward closer point
      expect(offshore!.value).toBeLessThan(7.5);
    });
  });

  describe('interpolateSlowVariable', () => {
    test('should return simple average', () => {
      const dataPoints: DataPoint[] = [
        { value: 15.0, distance: 50, quality: 'primary' },
        { value: 17.0, distance: 60, quality: 'primary' },
      ];
      const result = interpolateSlowVariable(dataPoints);
      expect(result?.value).toBe(16.0); // Average
    });

    test('should ignore points beyond 200km', () => {
      const dataPoints: DataPoint[] = [
        { value: 15.0, distance: 50, quality: 'primary' },
        { value: 20.0, distance: 250, quality: 'primary' },
      ];
      const result = interpolateSlowVariable(dataPoints);
      expect(result?.value).toBe(15.0); // Only uses first point
    });

    test('should return null for empty valid points', () => {
      const dataPoints: DataPoint[] = [
        { value: NaN, distance: 50, quality: 'primary' },
      ];
      const result = interpolateSlowVariable(dataPoints);
      expect(result).toBeNull();
    });

    test('should always mark quality as interpolated', () => {
      const dataPoints: DataPoint[] = [
        { value: 15.0, distance: 50, quality: 'primary' },
      ];
      const result = interpolateSlowVariable(dataPoints);
      expect(result?.quality).toBe('interpolated');
    });
  });
});
