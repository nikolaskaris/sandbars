/**
 * Forecast Calculations Unit Tests
 *
 * Tests for wave power, surf quality, unit conversions, and other calculations.
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculateWavePower,
  calculateWaveEnergyFlux,
  calculateSurfQualityScore,
  convertWindSpeed,
  convertTemperature,
  estimateBreakingWaveHeight,
  calculateWaveCelerity,
} from '@/lib/forecast/calculations';

describe('Forecast Calculations', () => {
  describe('calculateWavePower', () => {
    test('should calculate power for typical swell', () => {
      // 2m waves at 10s period
      const power = calculateWavePower(2, 10);
      // Expected: 0.5 * 1025 * 9.81 * 4 * 10 / 1000 ≈ 201 kW/m
      expect(power).toBeCloseTo(201.1, 0);
    });

    test('should return 0 for flat conditions', () => {
      const power = calculateWavePower(0, 10);
      expect(power).toBe(0);
    });

    test('should scale with square of wave height', () => {
      const power1m = calculateWavePower(1, 10);
      const power2m = calculateWavePower(2, 10);
      // 2m waves should have 4x the power of 1m waves
      expect(power2m / power1m).toBeCloseTo(4, 1);
    });

    test('should scale linearly with period', () => {
      const power10s = calculateWavePower(2, 10);
      const power20s = calculateWavePower(2, 20);
      // 20s period should have 2x the power of 10s
      expect(power20s / power10s).toBeCloseTo(2, 1);
    });
  });

  describe('calculateWaveEnergyFlux', () => {
    test('should calculate energy for typical swell', () => {
      const energy = calculateWaveEnergyFlux(2, 10);
      // Should be positive and reasonable
      expect(energy).toBeGreaterThan(0);
      expect(energy).toBeLessThan(100);
    });

    test('should return 0 for flat conditions', () => {
      const energy = calculateWaveEnergyFlux(0, 10);
      expect(energy).toBe(0);
    });
  });

  describe('calculateSurfQualityScore', () => {
    test('should score optimal conditions highly (7-10)', () => {
      // 1.5m waves, 12s period, light wind (3 m/s)
      const score = calculateSurfQualityScore(1.5, 12, 3);
      expect(score).toBeGreaterThanOrEqual(7);
    });

    test('should score flat conditions poorly', () => {
      // 0.2m waves, 5s period
      const score = calculateSurfQualityScore(0.2, 5, 3);
      expect(score).toBeLessThan(4);
    });

    test('should score very windy conditions poorly', () => {
      // Good waves but strong onshore wind
      const score = calculateSurfQualityScore(1.5, 12, 15);
      expect(score).toBeLessThan(7);
    });

    test('should score offshore wind higher than onshore', () => {
      // Same conditions, but wind direction differs
      // Wave from 270° (west), wind from 90° (east) = offshore
      const offshoreScore = calculateSurfQualityScore(1.5, 12, 5, 90, 270);
      // Wave from 270° (west), wind from 270° (west) = onshore
      const onshoreScore = calculateSurfQualityScore(1.5, 12, 5, 270, 270);
      expect(offshoreScore).toBeGreaterThan(onshoreScore);
    });

    test('should cap score at 10', () => {
      // Perfect conditions
      const score = calculateSurfQualityScore(1.5, 12, 1, 180, 0);
      expect(score).toBeLessThanOrEqual(10);
    });

    test('should handle missing direction data', () => {
      const score = calculateSurfQualityScore(1.5, 12, 5);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('convertWindSpeed', () => {
    test('should convert mph to m/s', () => {
      const result = convertWindSpeed(10, 'mph');
      // 10 mph ≈ 4.47 m/s
      expect(result).toBeCloseTo(4.47, 2);
    });

    test('should convert knots to m/s', () => {
      const result = convertWindSpeed(10, 'knots');
      // 10 knots ≈ 5.14 m/s
      expect(result).toBeCloseTo(5.14, 2);
    });

    test('should convert km/h to m/s', () => {
      const result = convertWindSpeed(36, 'kmh');
      // 36 km/h = 10 m/s
      expect(result).toBeCloseTo(10, 1);
    });

    test('should pass through m/s unchanged', () => {
      const result = convertWindSpeed(10, 'ms');
      expect(result).toBe(10);
    });

    test('should handle zero', () => {
      expect(convertWindSpeed(0, 'mph')).toBe(0);
      expect(convertWindSpeed(0, 'knots')).toBe(0);
    });
  });

  describe('convertTemperature', () => {
    test('should convert F to C', () => {
      // 32°F = 0°C
      expect(convertTemperature(32, 'F', 'C')).toBeCloseTo(0, 1);
      // 212°F = 100°C
      expect(convertTemperature(212, 'F', 'C')).toBeCloseTo(100, 1);
      // 68°F = 20°C
      expect(convertTemperature(68, 'F', 'C')).toBeCloseTo(20, 1);
    });

    test('should convert C to F', () => {
      // 0°C = 32°F
      expect(convertTemperature(0, 'C', 'F')).toBeCloseTo(32, 1);
      // 100°C = 212°F
      expect(convertTemperature(100, 'C', 'F')).toBeCloseTo(212, 1);
    });

    test('should return same value when from and to are equal', () => {
      expect(convertTemperature(20, 'C', 'C')).toBe(20);
      expect(convertTemperature(68, 'F', 'F')).toBe(68);
    });

    test('should handle negative temperatures', () => {
      // -40 is same in both scales
      expect(convertTemperature(-40, 'F', 'C')).toBeCloseTo(-40, 1);
      expect(convertTemperature(-40, 'C', 'F')).toBeCloseTo(-40, 1);
    });
  });

  describe('estimateBreakingWaveHeight', () => {
    test('should estimate breaking height from depth', () => {
      // At 2m depth, waves break at ~1.56m
      const breakingHeight = estimateBreakingWaveHeight(2);
      expect(breakingHeight).toBeCloseTo(1.56, 2);
    });

    test('should scale linearly with depth', () => {
      const shallow = estimateBreakingWaveHeight(1);
      const deep = estimateBreakingWaveHeight(3);
      expect(deep / shallow).toBeCloseTo(3, 1);
    });

    test('should return 0 for 0 depth', () => {
      expect(estimateBreakingWaveHeight(0)).toBe(0);
    });
  });

  describe('calculateWaveCelerity', () => {
    test('should calculate celerity for typical swells', () => {
      // 10s period wave
      const celerity = calculateWaveCelerity(10);
      // C = g*T / 2π = 9.81 * 10 / (2 * 3.14159) ≈ 15.6 m/s
      expect(celerity).toBeCloseTo(15.6, 1);
    });

    test('should increase with period', () => {
      const slow = calculateWaveCelerity(8);
      const fast = calculateWaveCelerity(16);
      expect(fast).toBeGreaterThan(slow);
      // Should double when period doubles
      expect(fast / slow).toBeCloseTo(2, 1);
    });

    test('should return 0 for 0 period', () => {
      expect(calculateWaveCelerity(0)).toBe(0);
    });
  });
});
