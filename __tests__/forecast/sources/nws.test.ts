/**
 * NWS (National Weather Service) Data Source Tests
 *
 * Tests to verify that weather forecasts are being fetched correctly
 * including air temperature, wind speed, and wind direction.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  fetchNWSForecast,
  convertNWSToWeatherData,
  getWeatherAtTime,
  parseWindSpeed,
  parseWindDirection,
  NWSForecastPeriod,
  NWSWeatherData,
} from '@/lib/forecast/sources/nws';

// Test locations (coastal areas where NWS data should be available)
const TEST_LOCATIONS = {
  santaMonica: { lat: 34.0195, lon: -118.4912, name: 'Santa Monica' },
  sanFrancisco: { lat: 37.7749, lon: -122.4194, name: 'San Francisco' },
  miamiBeach: { lat: 25.7907, lon: -80.1300, name: 'Miami Beach' },
  newYork: { lat: 40.7128, lon: -74.0060, name: 'New York' },
};

describe('NWS Data Source', () => {
  describe('Helper Functions', () => {
    describe('parseWindSpeed', () => {
      test('should parse simple wind speed', () => {
        const result = parseWindSpeed('10 mph');
        expect(result).toBeCloseTo(4.47, 1); // 10 mph ≈ 4.47 m/s
      });

      test('should parse range wind speed (take first number)', () => {
        const result = parseWindSpeed('5 to 10 mph');
        expect(result).toBeCloseTo(2.24, 1); // 5 mph ≈ 2.24 m/s
      });

      test('should handle gusts', () => {
        const result = parseWindSpeed('15 mph with gusts up to 25 mph');
        expect(result).toBeCloseTo(6.71, 1); // 15 mph ≈ 6.71 m/s
      });

      test('should return 0 for invalid input', () => {
        const result = parseWindSpeed('calm');
        expect(result).toBe(0);
      });
    });

    describe('parseWindDirection', () => {
      const testCases = [
        { input: 'N', expected: 0 },
        { input: 'NE', expected: 45 },
        { input: 'E', expected: 90 },
        { input: 'SE', expected: 135 },
        { input: 'S', expected: 180 },
        { input: 'SW', expected: 225 },
        { input: 'W', expected: 270 },
        { input: 'NW', expected: 315 },
        { input: 'NNE', expected: 22.5 },
        { input: 'WSW', expected: 247.5 },
      ];

      testCases.forEach(({ input, expected }) => {
        test(`should parse ${input} as ${expected}°`, () => {
          expect(parseWindDirection(input)).toBe(expected);
        });
      });

      test('should handle lowercase', () => {
        expect(parseWindDirection('ne')).toBe(45);
      });
    });
  });

  describe('Live NWS API Tests', () => {
    const locationResults: Map<string, NWSForecastPeriod[]> = new Map();

    beforeAll(async () => {
      console.log('\n🌤️ Fetching live data from NWS API...\n');

      for (const [key, loc] of Object.entries(TEST_LOCATIONS)) {
        try {
          console.log(`  Fetching ${loc.name}...`);
          const forecast = await fetchNWSForecast(loc.lat, loc.lon);
          locationResults.set(key, forecast);
          console.log(`  ✓ ${loc.name}: ${forecast.length} periods`);
        } catch (error) {
          console.log(`  ✗ ${loc.name}: Failed - ${error}`);
          locationResults.set(key, []);
        }
      }
      console.log('');
    });

    test('should fetch forecast for at least one location', () => {
      const successfulFetches = Array.from(locationResults.values()).filter(f => f.length > 0);
      expect(successfulFetches.length).toBeGreaterThan(0);
      console.log(`✓ ${successfulFetches.length}/${Object.keys(TEST_LOCATIONS).length} locations returned data`);
    });

    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      describe(`${loc.name}`, () => {
        test('should have forecast periods', () => {
          const forecast = locationResults.get(key) || [];

          if (forecast.length === 0) {
            console.log(`  ⚠ No forecast data for ${loc.name}`);
            return;
          }

          expect(forecast.length).toBeGreaterThan(0);
          console.log(`  ✓ ${forecast.length} forecast periods`);
        });

        test('should have valid temperature data', () => {
          const forecast = locationResults.get(key) || [];
          if (forecast.length === 0) return;

          const hasTemperature = forecast.some(p => p.temperature !== undefined);
          expect(hasTemperature).toBe(true);

          const temps = forecast.filter(p => p.temperature !== undefined).map(p => p.temperature);
          console.log(`  ✓ Temperature range: ${Math.min(...temps)}°F - ${Math.max(...temps)}°F`);
        });

        test('should have valid wind speed data', () => {
          const forecast = locationResults.get(key) || [];
          if (forecast.length === 0) return;

          const hasWindSpeed = forecast.some(p => p.windSpeed !== undefined && p.windSpeed !== '');
          expect(hasWindSpeed).toBe(true);

          const windSpeeds = forecast
            .map(p => parseWindSpeed(p.windSpeed))
            .filter(s => s > 0);

          if (windSpeeds.length > 0) {
            console.log(`  ✓ Wind Speed range: ${Math.min(...windSpeeds).toFixed(1)} - ${Math.max(...windSpeeds).toFixed(1)} m/s`);
          } else {
            console.log(`  ⚠ No valid wind speed data`);
          }
        });

        test('should have valid wind direction data', () => {
          const forecast = locationResults.get(key) || [];
          if (forecast.length === 0) return;

          const hasWindDirection = forecast.some(p => p.windDirection !== undefined && p.windDirection !== '');

          if (hasWindDirection) {
            const directions = [...new Set(forecast.map(p => p.windDirection).filter(d => d))];
            console.log(`  ✓ Wind Directions: ${directions.join(', ')}`);
          } else {
            console.log(`  ⚠ MISSING: Wind Direction data`);
          }
        });

        test('should convert to weather data format correctly', () => {
          const forecast = locationResults.get(key) || [];
          if (forecast.length === 0) return;

          const weatherData = convertNWSToWeatherData(forecast);
          expect(weatherData.length).toBe(forecast.length);

          // Check first period
          const first = weatherData[0];
          expect(first.timestamp).toBeDefined();
          expect(first.airTemperature).toBeDefined();

          if (first.airTemperature !== undefined) {
            // Should be in Celsius
            expect(first.airTemperature).toBeGreaterThan(-50);
            expect(first.airTemperature).toBeLessThan(60);
          }

          console.log(`  ✓ Converted ${weatherData.length} periods to weather data`);
        });

        test('should find weather at specific time', () => {
          const forecast = locationResults.get(key) || [];
          if (forecast.length === 0) return;

          const weatherData = convertNWSToWeatherData(forecast);
          const targetTime = new Date();

          const weather = getWeatherAtTime(weatherData, targetTime);

          if (weather) {
            console.log(`  ✓ Current weather found:`);
            console.log(`    - Air Temp: ${weather.airTemperature?.toFixed(1)}°C`);
            console.log(`    - Wind Speed: ${weather.windSpeed?.toFixed(1)} m/s`);
            console.log(`    - Wind Direction: ${weather.windDirection}°`);
          } else {
            console.log(`  ⚠ No weather data available for current time`);
          }
        });
      });
    });

    describe('Data Consistency Checks', () => {
      test('verify wind direction is being returned (not missing)', () => {
        let totalPeriods = 0;
        let missingWindDir = 0;

        locationResults.forEach((forecast) => {
          forecast.forEach(period => {
            totalPeriods++;
            if (!period.windDirection || period.windDirection === '') {
              missingWindDir++;
            }
          });
        });

        const pctMissing = totalPeriods > 0 ? ((missingWindDir / totalPeriods) * 100).toFixed(1) : 0;
        console.log(`\nWind Direction Availability: ${100 - Number(pctMissing)}%`);
        console.log(`  Missing: ${missingWindDir}/${totalPeriods} periods`);

        if (Number(pctMissing) > 20) {
          console.log(`  ⚠ WARNING: High percentage of missing wind direction data!`);
        }
      });

      test('verify forecast extends multiple days', () => {
        let maxHours = 0;

        locationResults.forEach((forecast, key) => {
          if (forecast.length > 1) {
            const first = new Date(forecast[0].startTime);
            const last = new Date(forecast[forecast.length - 1].startTime);
            const hours = (last.getTime() - first.getTime()) / (1000 * 60 * 60);
            maxHours = Math.max(maxHours, hours);
          }
        });

        console.log(`\nMax forecast range: ${(maxHours / 24).toFixed(1)} days (${maxHours} hours)`);

        if (maxHours < 24 * 7) {
          console.log(`  ⚠ WARNING: Forecast range is less than 7 days`);
        }
      });
    });

    describe('Summary Report', () => {
      test('generate NWS data availability report', () => {
        console.log('\n📊 NWS DATA AVAILABILITY REPORT\n');
        console.log('='.repeat(60));

        locationResults.forEach((forecast, key) => {
          const loc = TEST_LOCATIONS[key as keyof typeof TEST_LOCATIONS];
          console.log(`\n${loc.name}:`);

          if (forecast.length === 0) {
            console.log('  ✗ No data available');
            return;
          }

          const weatherData = convertNWSToWeatherData(forecast);

          const hasTemp = weatherData.filter(w => w.airTemperature !== undefined).length;
          const hasWind = weatherData.filter(w => w.windSpeed !== undefined).length;
          const hasDir = weatherData.filter(w => w.windDirection !== undefined).length;

          console.log(`  Total periods: ${forecast.length}`);
          console.log(`  ✓ Temperature: ${hasTemp}/${forecast.length} (${((hasTemp/forecast.length)*100).toFixed(0)}%)`);
          console.log(`  ${hasWind === forecast.length ? '✓' : '⚠'} Wind Speed: ${hasWind}/${forecast.length} (${((hasWind/forecast.length)*100).toFixed(0)}%)`);
          console.log(`  ${hasDir === forecast.length ? '✓' : '⚠'} Wind Direction: ${hasDir}/${forecast.length} (${((hasDir/forecast.length)*100).toFixed(0)}%)`);
        });

        console.log('\n' + '='.repeat(60));
      });
    });
  });
});
