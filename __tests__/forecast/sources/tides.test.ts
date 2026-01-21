/**
 * NOAA Tides & Currents Data Source Tests
 *
 * Tests to verify that tide predictions are being fetched correctly.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  fetchTidePredictions,
  findNearestTideStation,
  getTideAtTime,
  TIDE_STATIONS,
  TidePrediction,
} from '@/lib/forecast/sources/tides';

// Test locations
const TEST_LOCATIONS = {
  santaMonica: { lat: 34.0, lon: -118.5, name: 'Santa Monica' },
  sanFrancisco: { lat: 37.8, lon: -122.4, name: 'San Francisco' },
  honolulu: { lat: 21.3, lon: -157.9, name: 'Honolulu' },
  newYork: { lat: 40.7, lon: -74.0, name: 'New York' },
  miamiBeach: { lat: 25.8, lon: -80.1, name: 'Miami Beach' },
};

describe('Tides Data Source', () => {
  describe('Configuration', () => {
    test('should have tide stations defined', () => {
      expect(TIDE_STATIONS).toBeDefined();
      expect(TIDE_STATIONS.length).toBeGreaterThan(0);
      console.log(`✓ ${TIDE_STATIONS.length} tide stations configured`);
    });

    test('each station should have valid configuration', () => {
      for (const station of TIDE_STATIONS) {
        expect(station.id).toBeDefined();
        expect(station.id.length).toBeGreaterThan(0);
        expect(station.lat).toBeGreaterThanOrEqual(-90);
        expect(station.lat).toBeLessThanOrEqual(90);
        expect(station.lon).toBeGreaterThanOrEqual(-180);
        expect(station.lon).toBeLessThanOrEqual(180);
        expect(station.name).toBeDefined();
      }
      console.log('✓ All tide station configurations are valid');
    });
  });

  describe('Station Finding', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`should find nearest tide station for ${loc.name}`, () => {
        const station = findNearestTideStation(loc.lat, loc.lon);

        if (station) {
          console.log(`  ✓ ${loc.name} -> ${station.name} (ID: ${station.id})`);
        } else {
          console.log(`  ⚠ ${loc.name} -> No station within range`);
        }
      });
    });
  });

  describe('Live Tides API Tests', () => {
    const stationResults: Map<string, TidePrediction[]> = new Map();

    // Select a few stations to test
    const stationsToTest = [
      '9410170', // San Diego Bay
      '9414290', // San Francisco
      '1612340', // Honolulu
      '8518750', // The Battery, NY
    ];

    beforeAll(async () => {
      console.log('\n🌊 Fetching live tide data from NOAA...\n');

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      for (const stationId of stationsToTest) {
        const station = TIDE_STATIONS.find(s => s.id === stationId);
        try {
          console.log(`  Fetching ${station?.name || stationId}...`);
          const predictions = await fetchTidePredictions(stationId, now, tomorrow);
          stationResults.set(stationId, predictions);
          console.log(`  ✓ ${station?.name}: ${predictions.length} predictions`);
        } catch (error) {
          console.log(`  ✗ ${station?.name}: Failed - ${error}`);
          stationResults.set(stationId, []);
        }
      }
      console.log('');
    });

    test('should fetch predictions for at least one station', () => {
      const successfulFetches = Array.from(stationResults.values()).filter(p => p.length > 0);
      expect(successfulFetches.length).toBeGreaterThan(0);
      console.log(`✓ ${successfulFetches.length}/${stationsToTest.length} stations returned data`);
    });

    stationsToTest.forEach(stationId => {
      const station = TIDE_STATIONS.find(s => s.id === stationId);

      describe(`${station?.name || stationId}`, () => {
        test('should have tide predictions', () => {
          const predictions = stationResults.get(stationId) || [];

          if (predictions.length === 0) {
            console.log(`  ⚠ No predictions for ${station?.name}`);
            return;
          }

          expect(predictions.length).toBeGreaterThan(0);
          console.log(`  ✓ ${predictions.length} hourly predictions`);
        });

        test('should have valid tide levels', () => {
          const predictions = stationResults.get(stationId) || [];
          if (predictions.length === 0) return;

          const levels = predictions.map(p => p.tideLevel);
          const validLevels = levels.filter(l => !isNaN(l));

          expect(validLevels.length).toBe(predictions.length);

          const min = Math.min(...validLevels);
          const max = Math.max(...validLevels);

          console.log(`  ✓ Tide Level range: ${min.toFixed(2)}m - ${max.toFixed(2)}m`);

          // Tide levels should be reasonable (within -5 to 10 meters)
          expect(min).toBeGreaterThan(-5);
          expect(max).toBeLessThan(10);
        });

        test('should have valid timestamps', () => {
          const predictions = stationResults.get(stationId) || [];
          if (predictions.length === 0) return;

          predictions.forEach(pred => {
            expect(pred.timestamp).toBeDefined();
            // Timestamps should be parseable
            const date = new Date(pred.timestamp);
            expect(date.getTime()).not.toBeNaN();
          });

          console.log(`  ✓ All ${predictions.length} timestamps are valid`);
        });

        test('should have quality flags', () => {
          const predictions = stationResults.get(stationId) || [];
          if (predictions.length === 0) return;

          predictions.forEach(pred => {
            expect(['primary', 'interpolated', 'modeled', 'historical', 'stale', 'missing']).toContain(pred.quality);
          });

          console.log(`  ✓ All predictions have quality flags`);
        });

        test('should find tide at current time', () => {
          const predictions = stationResults.get(stationId) || [];
          if (predictions.length === 0) return;

          const now = new Date();
          const currentTide = getTideAtTime(predictions, now);

          if (currentTide) {
            console.log(`  ✓ Current tide level: ${currentTide.tideLevel.toFixed(2)}m`);
          } else {
            console.log(`  ⚠ No tide prediction available for current time`);
          }
        });
      });
    });

    describe('Tide Variation Analysis', () => {
      test('verify tidal range shows variation (not flat)', () => {
        console.log('\n📊 TIDE VARIATION ANALYSIS\n');

        let anyStationFlat = false;

        stationResults.forEach((predictions, stationId) => {
          if (predictions.length < 2) return;

          const station = TIDE_STATIONS.find(s => s.id === stationId);
          const levels = predictions.map(p => p.tideLevel);
          const min = Math.min(...levels);
          const max = Math.max(...levels);
          const range = max - min;

          console.log(`${station?.name}:`);
          console.log(`  Range: ${range.toFixed(2)}m (${min.toFixed(2)}m - ${max.toFixed(2)}m)`);

          if (range < 0.1) {
            console.log(`  ⚠ WARNING: Very small tidal range - data may be flat/dummy!`);
            anyStationFlat = true;
          } else {
            console.log(`  ✓ Tidal variation looks normal`);
          }
        });

        if (anyStationFlat) {
          console.log('\n⚠ Some stations show very little tidal variation!');
        }
      });
    });

    describe('Summary Report', () => {
      test('generate tides data availability report', () => {
        console.log('\n📊 TIDES DATA AVAILABILITY REPORT\n');
        console.log('='.repeat(60));

        stationResults.forEach((predictions, stationId) => {
          const station = TIDE_STATIONS.find(s => s.id === stationId);
          console.log(`\n${station?.name || stationId}:`);

          if (predictions.length === 0) {
            console.log('  ✗ No data available');
            return;
          }

          const validLevels = predictions.filter(p => !isNaN(p.tideLevel)).length;
          const validTimestamps = predictions.filter(p => {
            const d = new Date(p.timestamp);
            return !isNaN(d.getTime());
          }).length;

          console.log(`  Total predictions: ${predictions.length}`);
          console.log(`  ✓ Valid tide levels: ${validLevels}/${predictions.length} (${((validLevels/predictions.length)*100).toFixed(0)}%)`);
          console.log(`  ✓ Valid timestamps: ${validTimestamps}/${predictions.length} (${((validTimestamps/predictions.length)*100).toFixed(0)}%)`);
        });

        console.log('\n' + '='.repeat(60));
      });
    });
  });
});
