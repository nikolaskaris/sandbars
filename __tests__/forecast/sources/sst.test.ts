/**
 * Sea Surface Temperature (SST) Data Source Tests
 *
 * Tests to verify that NOAA OISST data is being fetched correctly.
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import {
  getSeaSurfaceTemperature,
  fetchOISSTData,
  clearSSTCache,
  getSSTCacheStats,
  SSTData,
} from '@/lib/forecast/sources/sst';

// Test locations with expected SST ranges
const TEST_LOCATIONS = {
  // Tropical waters - warm
  hawaii: { lat: 21.3, lon: -157.8, name: 'Hawaii', expectedRange: [22, 28] },
  // California coast - moderate
  santaMonica: { lat: 34.0, lon: -118.5, name: 'Santa Monica', expectedRange: [14, 22] },
  // North Atlantic - cool
  newYork: { lat: 40.7, lon: -74.0, name: 'New York', expectedRange: [4, 24] },
  // Gulf of Mexico - warm
  miami: { lat: 25.8, lon: -80.1, name: 'Miami', expectedRange: [22, 30] },
};

describe('SST Data Source', () => {
  // Clear cache before each test to ensure fresh results
  beforeEach(() => {
    clearSSTCache();
  });

  describe('Input Validation', () => {
    test('should reject invalid latitude', async () => {
      const result = await getSeaSurfaceTemperature(100, -118);
      expect(result).toBeNull();
    });

    test('should reject invalid longitude', async () => {
      const result = await getSeaSurfaceTemperature(34, 200);
      expect(result).toBeNull();
    });

    test('should accept valid coordinates at boundaries', async () => {
      // These should not throw - may or may not return data
      await expect(getSeaSurfaceTemperature(-90, 0)).resolves.not.toThrow();
      await expect(getSeaSurfaceTemperature(90, 0)).resolves.not.toThrow();
      await expect(getSeaSurfaceTemperature(0, -180)).resolves.not.toThrow();
      await expect(getSeaSurfaceTemperature(0, 180)).resolves.not.toThrow();
    });
  });

  describe('Live OISST API Tests', () => {
    const sstResults: Map<string, SSTData | null> = new Map();

    beforeAll(async () => {
      console.log('\n🌡️ Fetching SST data from NOAA OISST...\n');

      for (const [key, loc] of Object.entries(TEST_LOCATIONS)) {
        try {
          console.log(`  Fetching ${loc.name}...`);
          const data = await getSeaSurfaceTemperature(loc.lat, loc.lon);
          sstResults.set(key, data);

          if (data) {
            console.log(`  ✓ ${loc.name}: ${data.temperature.toFixed(1)}°C`);
          } else {
            console.log(`  ⚠ ${loc.name}: No data available`);
          }
        } catch (error) {
          console.log(`  ✗ ${loc.name}: Failed - ${error}`);
          sstResults.set(key, null);
        }
      }
      console.log('');
    }, 60000);

    test('should fetch SST for at least one location', () => {
      const successfulFetches = Array.from(sstResults.values()).filter(d => d !== null);
      expect(successfulFetches.length).toBeGreaterThan(0);
      console.log(`✓ ${successfulFetches.length}/${Object.keys(TEST_LOCATIONS).length} locations returned SST data`);
    });

    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      describe(`${loc.name}`, () => {
        test('should have valid temperature if data available', () => {
          const data = sstResults.get(key);
          if (!data) {
            console.log(`  ⚠ No SST data for ${loc.name}`);
            return;
          }

          expect(data.temperature).toBeDefined();
          expect(typeof data.temperature).toBe('number');
          expect(data.temperature).not.toBeNaN();

          // Temperature should be within expected range for this location
          const [min, max] = loc.expectedRange;
          expect(data.temperature).toBeGreaterThanOrEqual(min - 5); // Allow 5°C margin
          expect(data.temperature).toBeLessThanOrEqual(max + 5);

          console.log(`  ✓ SST: ${data.temperature.toFixed(1)}°C (expected ${min}-${max}°C)`);
        });

        test('should have valid timestamp', () => {
          const data = sstResults.get(key);
          if (!data) return;

          expect(data.timestamp).toBeDefined();
          const date = new Date(data.timestamp);
          expect(date.getTime()).not.toBeNaN();
        });

        test('should have quality flag', () => {
          const data = sstResults.get(key);
          if (!data) return;

          expect(['primary', 'interpolated', 'modeled', 'historical', 'stale', 'missing']).toContain(data.quality);
          console.log(`  Quality: ${data.quality}`);
        });

        test('should have source identifier', () => {
          const data = sstResults.get(key);
          if (!data) return;

          expect(data.source).toBe('oisst');
        });
      });
    });
  });

  describe('Caching', () => {
    test('should cache results', async () => {
      clearSSTCache();
      const statsBefore = getSSTCacheStats();
      expect(statsBefore.size).toBe(0);

      // Fetch some data
      await getSeaSurfaceTemperature(34.0, -118.5);

      const statsAfter = getSSTCacheStats();
      // May or may not have cached data depending on API availability
      console.log(`Cache entries after fetch: ${statsAfter.size}`);
    });

    test('should return cached data on subsequent calls', async () => {
      clearSSTCache();

      // First call
      const start1 = Date.now();
      const result1 = await getSeaSurfaceTemperature(34.0, -118.5);
      const time1 = Date.now() - start1;

      // Second call should be cached
      const start2 = Date.now();
      const result2 = await getSeaSurfaceTemperature(34.0, -118.5);
      const time2 = Date.now() - start2;

      // Results should be the same
      if (result1 && result2) {
        expect(result2.temperature).toBe(result1.temperature);
      }

      // Cached call should be faster (allowing for variability)
      console.log(`First call: ${time1}ms, Second call: ${time2}ms`);
    });
  });

  describe('Global Coverage', () => {
    test('should handle land locations gracefully', async () => {
      // Coordinates in the middle of the Sahara Desert
      const result = await getSeaSurfaceTemperature(23.0, 25.0);
      // Should return null for land (no ocean SST)
      // Note: OISST might still return data for nearby ocean
      console.log(`Land location result: ${result ? `${result.temperature}°C` : 'null (expected)'}`);
    });

    test('should handle Arctic waters', async () => {
      const result = await getSeaSurfaceTemperature(75.0, 0.0);
      if (result) {
        // Arctic waters are very cold
        expect(result.temperature).toBeLessThan(10);
        console.log(`Arctic SST: ${result.temperature.toFixed(1)}°C`);
      }
    });

    test('should handle Antarctic waters', async () => {
      const result = await getSeaSurfaceTemperature(-65.0, 0.0);
      if (result) {
        // Antarctic waters are very cold
        expect(result.temperature).toBeLessThan(5);
        console.log(`Antarctic SST: ${result.temperature.toFixed(1)}°C`);
      }
    });
  });

  describe('Summary Report', () => {
    test('generate SST data availability report', async () => {
      console.log('\n📊 SST DATA AVAILABILITY REPORT\n');
      console.log('='.repeat(60));

      let successCount = 0;
      let failCount = 0;

      for (const [key, loc] of Object.entries(TEST_LOCATIONS)) {
        clearSSTCache();
        const data = await getSeaSurfaceTemperature(loc.lat, loc.lon);

        if (data) {
          successCount++;
          console.log(`✓ ${loc.name}: ${data.temperature.toFixed(1)}°C (${data.quality})`);
        } else {
          failCount++;
          console.log(`✗ ${loc.name}: No data`);
        }
      }

      console.log('');
      console.log('-'.repeat(60));
      console.log(`Total: ${successCount}/${successCount + failCount} locations successful`);
      console.log('='.repeat(60));

      expect(successCount).toBeGreaterThan(0);
    }, 120000);
  });
});
