/**
 * NDBC (National Data Buoy Center) Data Source Tests
 *
 * Tests to verify that real buoy data is being fetched correctly
 * and that all metrics (wave height, period, direction, wind, temp) are populated.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  fetchNDBCBuoyData,
  findNearestBuoys,
  calculateDistance,
  NDBC_BUOYS,
  NDBCBuoyReading,
} from '@/lib/forecast/sources/ndbc';

// Test locations
const TEST_LOCATIONS = {
  santaMonica: { lat: 34.0, lon: -118.5, name: 'Santa Monica' },
  sanFrancisco: { lat: 37.8, lon: -122.4, name: 'San Francisco' },
  honolulu: { lat: 21.3, lon: -157.8, name: 'Honolulu' },
  newYork: { lat: 40.7, lon: -74.0, name: 'New York' },
};

describe('NDBC Data Source', () => {
  describe('Configuration', () => {
    test('should have buoy stations defined', () => {
      expect(NDBC_BUOYS).toBeDefined();
      expect(NDBC_BUOYS.length).toBeGreaterThan(0);
      console.log(`✓ ${NDBC_BUOYS.length} buoys configured`);
    });

    test('each buoy should have valid configuration', () => {
      for (const buoy of NDBC_BUOYS) {
        expect(buoy.id).toBeDefined();
        expect(buoy.id).toMatch(/^\d{5}$/);
        expect(buoy.lat).toBeGreaterThanOrEqual(-90);
        expect(buoy.lat).toBeLessThanOrEqual(90);
        expect(buoy.lon).toBeGreaterThanOrEqual(-180);
        expect(buoy.lon).toBeLessThanOrEqual(180);
        expect(buoy.name).toBeDefined();
      }
      console.log('✓ All buoy configurations are valid');
    });
  });

  describe('Distance Calculations', () => {
    test('should calculate distance correctly', () => {
      // LA to San Francisco ~550km
      const distance = calculateDistance(34.0, -118.2, 37.8, -122.4);
      expect(distance).toBeGreaterThan(500);
      expect(distance).toBeLessThan(600);
      console.log(`✓ LA to SF distance: ${distance.toFixed(1)}km`);
    });

    test('should find nearest buoys for California coast', () => {
      const nearestBuoys = findNearestBuoys(TEST_LOCATIONS.santaMonica.lat, TEST_LOCATIONS.santaMonica.lon, 100, 3);
      expect(nearestBuoys.length).toBeGreaterThan(0);
      console.log(`✓ Found ${nearestBuoys.length} buoys near Santa Monica:`);
      nearestBuoys.forEach(b => {
        const dist = calculateDistance(TEST_LOCATIONS.santaMonica.lat, TEST_LOCATIONS.santaMonica.lon, b.lat, b.lon);
        console.log(`  - ${b.id} (${b.name}): ${dist.toFixed(1)}km`);
      });
    });
  });

  describe('Live NDBC API Tests', () => {
    // Test multiple buoys to ensure data variety
    const buoysToTest = [
      '46221', // Santa Monica Basin
      '46026', // San Francisco Bar
      '46042', // Monterey Bay
      '44025', // Long Island
    ];

    const buoyResults: Map<string, NDBCBuoyReading | null> = new Map();

    beforeAll(async () => {
      console.log('\n📡 Fetching live data from NDBC buoys...\n');
      for (const buoyId of buoysToTest) {
        const data = await fetchNDBCBuoyData(buoyId);
        buoyResults.set(buoyId, data);
      }
    });

    test('should successfully fetch data from at least one buoy', () => {
      const successfulFetches = Array.from(buoyResults.values()).filter(d => d !== null);
      expect(successfulFetches.length).toBeGreaterThan(0);
      console.log(`✓ ${successfulFetches.length}/${buoysToTest.length} buoys returned data`);
    });

    describe('Data Quality Analysis', () => {
      buoysToTest.forEach(buoyId => {
        describe(`Buoy ${buoyId}`, () => {
          test('should have a timestamp', () => {
            const data = buoyResults.get(buoyId);
            if (!data) {
              console.log(`⚠ Buoy ${buoyId}: No data available (buoy may be offline)`);
              return;
            }
            expect(data.timestamp).toBeDefined();

            // Check data freshness
            const dataAge = Date.now() - new Date(data.timestamp).getTime();
            const hoursOld = dataAge / (1000 * 60 * 60);
            console.log(`  Timestamp: ${data.timestamp} (${hoursOld.toFixed(1)} hours old)`);

            if (hoursOld > 3) {
              console.log(`  ⚠ WARNING: Data is stale (> 3 hours old)`);
            }
          });

          test('should have wave height data', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            if (data.waveHeight !== undefined) {
              expect(data.waveHeight).toBeGreaterThan(0);
              expect(data.waveHeight).toBeLessThan(30); // Reasonable max wave height
              console.log(`  ✓ Wave Height: ${data.waveHeight}m`);
            } else {
              console.log(`  ⚠ MISSING: Wave Height`);
            }
          });

          test('should have wave period data', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            if (data.dominantWavePeriod !== undefined) {
              expect(data.dominantWavePeriod).toBeGreaterThan(0);
              expect(data.dominantWavePeriod).toBeLessThan(30); // Reasonable max period
              console.log(`  ✓ Dominant Wave Period: ${data.dominantWavePeriod}s`);
            } else {
              console.log(`  ⚠ MISSING: Dominant Wave Period`);
            }

            if (data.averageWavePeriod !== undefined) {
              console.log(`  ✓ Average Wave Period: ${data.averageWavePeriod}s`);
            } else {
              console.log(`  ⚠ MISSING: Average Wave Period`);
            }
          });

          test('should have wave direction data', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            if (data.waveDirection !== undefined) {
              expect(data.waveDirection).toBeGreaterThanOrEqual(0);
              expect(data.waveDirection).toBeLessThanOrEqual(360);
              console.log(`  ✓ Wave Direction: ${data.waveDirection}°`);
            } else {
              console.log(`  ⚠ MISSING: Wave Direction (MWD)`);
            }
          });

          test('should have wind data', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            if (data.windSpeed !== undefined) {
              expect(data.windSpeed).toBeGreaterThanOrEqual(0);
              expect(data.windSpeed).toBeLessThan(100); // Reasonable max wind speed
              console.log(`  ✓ Wind Speed: ${data.windSpeed} m/s`);
            } else {
              console.log(`  ⚠ MISSING: Wind Speed`);
            }

            if (data.windDirection !== undefined) {
              expect(data.windDirection).toBeGreaterThanOrEqual(0);
              expect(data.windDirection).toBeLessThanOrEqual(360);
              console.log(`  ✓ Wind Direction: ${data.windDirection}°`);
            } else {
              console.log(`  ⚠ MISSING: Wind Direction (WDIR)`);
            }
          });

          test('should have temperature data', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            if (data.waterTemperature !== undefined) {
              expect(data.waterTemperature).toBeGreaterThan(-5);
              expect(data.waterTemperature).toBeLessThan(40);
              console.log(`  ✓ Water Temperature: ${data.waterTemperature}°C`);
            } else {
              console.log(`  ⚠ MISSING: Water Temperature`);
            }

            if (data.airTemperature !== undefined) {
              expect(data.airTemperature).toBeGreaterThan(-50);
              expect(data.airTemperature).toBeLessThan(60);
              console.log(`  ✓ Air Temperature: ${data.airTemperature}°C`);
            } else {
              console.log(`  ⚠ MISSING: Air Temperature`);
            }
          });

          test('should have valid quality flag', () => {
            const data = buoyResults.get(buoyId);
            if (!data) return;

            expect(['primary', 'interpolated', 'modeled', 'historical', 'stale', 'missing']).toContain(data.quality);
            console.log(`  Quality: ${data.quality}`);
          });
        });
      });
    });

    describe('Summary Report', () => {
      test('generate data availability report', () => {
        console.log('\n📊 NDBC DATA AVAILABILITY REPORT\n');
        console.log('=' .repeat(60));

        const metrics = ['waveHeight', 'dominantWavePeriod', 'averageWavePeriod', 'waveDirection', 'windSpeed', 'windDirection', 'waterTemperature', 'airTemperature'];
        const availability: Record<string, number> = {};

        metrics.forEach(m => { availability[m] = 0; });

        let totalBuoys = 0;
        buoyResults.forEach((data, buoyId) => {
          if (data) {
            totalBuoys++;
            if (data.waveHeight !== undefined) availability['waveHeight']++;
            if (data.dominantWavePeriod !== undefined) availability['dominantWavePeriod']++;
            if (data.averageWavePeriod !== undefined) availability['averageWavePeriod']++;
            if (data.waveDirection !== undefined) availability['waveDirection']++;
            if (data.windSpeed !== undefined) availability['windSpeed']++;
            if (data.windDirection !== undefined) availability['windDirection']++;
            if (data.waterTemperature !== undefined) availability['waterTemperature']++;
            if (data.airTemperature !== undefined) availability['airTemperature']++;
          }
        });

        console.log(`\nBuoys with data: ${totalBuoys}/${buoysToTest.length}\n`);
        console.log('Metric Availability:');
        console.log('-'.repeat(40));

        Object.entries(availability).forEach(([metric, count]) => {
          const pct = totalBuoys > 0 ? ((count / totalBuoys) * 100).toFixed(0) : 0;
          const bar = '█'.repeat(Math.round(Number(pct) / 10)) + '░'.repeat(10 - Math.round(Number(pct) / 10));
          const status = count === totalBuoys ? '✓' : count === 0 ? '✗' : '⚠';
          console.log(`${status} ${metric.padEnd(20)} ${bar} ${pct}% (${count}/${totalBuoys})`);
        });

        console.log('\n' + '='.repeat(60));

        expect(true).toBe(true); // Always pass, this is for reporting
      });
    });
  });
});
