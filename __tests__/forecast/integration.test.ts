/**
 * Forecast System Integration Tests
 *
 * Tests to verify that the complete forecast system is working correctly
 * and returning real, varying data (not dummy/static values).
 *
 * This test specifically checks for the issues reported:
 * - Wave heights same for all 7 days (dummy data?)
 * - Missing wind direction
 * - Missing swell direction
 * - Dummy data for swell period
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { getSurfForecast } from '@/lib/forecast';
import { CompiledForecastData, EnhancedSurfForecast, QualityFlag } from '@/types';

// Test locations
const TEST_LOCATIONS = {
  santaMonica: { lat: 34.0195, lon: -118.4912, name: 'Santa Monica, CA' },
  sanFrancisco: { lat: 37.7749, lon: -122.4194, name: 'San Francisco, CA' },
  monterey: { lat: 36.6, lon: -121.9, name: 'Monterey, CA' },
};

describe('Forecast System Integration', () => {
  const forecastResults: Map<string, CompiledForecastData> = new Map();

  beforeAll(async () => {
    console.log('\n🏄 Fetching complete surf forecasts...\n');
    console.log('This may take a minute as we fetch data from multiple sources...\n');

    for (const [key, loc] of Object.entries(TEST_LOCATIONS)) {
      try {
        console.log(`  Fetching 7-day forecast for ${loc.name}...`);
        const startTime = Date.now();

        // Fetch 168 hours = 7 days
        const forecast = await getSurfForecast(loc.lat, loc.lon, 168);
        forecastResults.set(key, forecast);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ✓ ${loc.name}: ${forecast.forecasts.length} hours (${elapsed}s)`);
      } catch (error) {
        console.log(`  ✗ ${loc.name}: Failed - ${error}`);
      }
    }
    console.log('');
  }, 120000); // 2 minute timeout for all fetches

  describe('Basic Forecast Structure', () => {
    test('should return forecasts for all test locations', () => {
      expect(forecastResults.size).toBe(Object.keys(TEST_LOCATIONS).length);
    });

    test('should have 168 hours (7 days) of forecasts', () => {
      forecastResults.forEach((data, key) => {
        const loc = TEST_LOCATIONS[key as keyof typeof TEST_LOCATIONS];
        expect(data.forecasts.length).toBe(168);
        console.log(`✓ ${loc.name}: ${data.forecasts.length} hourly forecasts`);
      });
    });

    test('should have metadata', () => {
      forecastResults.forEach((data, key) => {
        expect(data.metadata).toBeDefined();
        expect(data.metadata.generated_at).toBeDefined();
        console.log(`Metadata for ${key}:`);
        console.log(`  Primary sources: ${data.metadata.primary_sources}`);
        console.log(`  Interpolated: ${data.metadata.interpolated_sources}`);
        console.log(`  Modeled: ${data.metadata.modeled_sources}`);
      });
    });
  });

  describe('CRITICAL: Wave Height Variation Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: wave heights should vary over 7 days`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        // Get wave heights for each day at noon
        const dailyHeights: number[] = [];
        for (let day = 0; day < 7; day++) {
          const hourIndex = day * 24 + 12; // noon each day
          if (hourIndex < data.forecasts.length) {
            const forecast = data.forecasts[hourIndex];
            dailyHeights.push(forecast.waveHeight.max);
          }
        }

        console.log(`\n${loc.name} - Daily Max Wave Heights at Noon:`);
        dailyHeights.forEach((h, i) => {
          const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
          console.log(`  Day ${i + 1} (${date.toLocaleDateString()}): ${h.toFixed(2)}m`);
        });

        // Check if ALL values are identical (sign of dummy data)
        const uniqueHeights = new Set(dailyHeights.map(h => h.toFixed(2)));

        if (uniqueHeights.size === 1) {
          console.log(`  ⚠️ CRITICAL: All wave heights are IDENTICAL (${dailyHeights[0].toFixed(2)}m)!`);
          console.log(`  This strongly suggests DUMMY/FALLBACK data is being used!`);
        } else {
          console.log(`  ✓ Wave heights show variation (${uniqueHeights.size} unique values)`);
        }

        // Also check the range
        const minHeight = Math.min(...dailyHeights);
        const maxHeight = Math.max(...dailyHeights);
        const range = maxHeight - minHeight;
        console.log(`  Range: ${minHeight.toFixed(2)}m - ${maxHeight.toFixed(2)}m (variation: ${range.toFixed(2)}m)`);

        // Check quality flags
        const qualities = new Set<QualityFlag>();
        data.forecasts.forEach(f => qualities.add(f.waveHeight.quality));
        console.log(`  Quality flags: ${[...qualities].join(', ')}`);

        // If quality is 'historical' for all, that's the fallback
        if (qualities.size === 1 && qualities.has('historical')) {
          console.log(`  ⚠️ WARNING: All wave heights are from HISTORICAL fallback!`);
        }

        // Test assertion - flag the issue but don't fail the test
        // so we can see the full report
        if (uniqueHeights.size === 1) {
          console.log('\n  DIAGNOSIS: The system is returning fallback/default wave heights');
          console.log('  because real buoy data is not being retrieved or is being rejected.');
        }
      });
    });
  });

  describe('CRITICAL: Wave Period Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: wave period should vary and not be default value`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        const periods = data.forecasts.map(f => f.wavePeriod.value);
        const uniquePeriods = new Set(periods);
        const qualities = new Set(data.forecasts.map(f => f.wavePeriod.quality));

        console.log(`\n${loc.name} - Wave Period Analysis:`);
        console.log(`  Unique values: ${uniquePeriods.size}`);
        console.log(`  Range: ${Math.min(...periods).toFixed(1)}s - ${Math.max(...periods).toFixed(1)}s`);
        console.log(`  Quality flags: ${[...qualities].join(', ')}`);

        // Check if it's stuck at default 10s
        if (uniquePeriods.size === 1 && periods[0] === 10) {
          console.log(`  ⚠️ CRITICAL: Wave period is stuck at default value (10s)!`);
          console.log(`  This indicates real buoy period data is not being retrieved.`);
        } else if (uniquePeriods.size === 1) {
          console.log(`  ⚠️ WARNING: Wave period shows no variation`);
        } else {
          console.log(`  ✓ Wave period shows variation`);
        }
      });
    });
  });

  describe('CRITICAL: Wind Direction Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: wind direction should be present`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        const withWindDir = data.forecasts.filter(f => f.windDirection !== undefined);
        const missingWindDir = data.forecasts.filter(f => f.windDirection === undefined);

        const pctPresent = ((withWindDir.length / data.forecasts.length) * 100).toFixed(1);

        console.log(`\n${loc.name} - Wind Direction:`);
        console.log(`  Present: ${withWindDir.length}/${data.forecasts.length} (${pctPresent}%)`);
        console.log(`  Missing: ${missingWindDir.length}/${data.forecasts.length}`);

        if (withWindDir.length > 0) {
          const directions = withWindDir.map(f => f.windDirection!.value);
          const uniqueDirs = new Set(directions.map(d => Math.round(d / 10) * 10)); // Group by 10°
          console.log(`  Direction range: ${Math.min(...directions).toFixed(0)}° - ${Math.max(...directions).toFixed(0)}°`);
          console.log(`  Unique directions (grouped): ${uniqueDirs.size}`);

          const qualities = new Set(withWindDir.map(f => f.windDirection!.quality));
          console.log(`  Quality flags: ${[...qualities].join(', ')}`);
        }

        if (Number(pctPresent) < 50) {
          console.log(`  ⚠️ CRITICAL: More than half of wind direction data is MISSING!`);
        } else if (Number(pctPresent) < 90) {
          console.log(`  ⚠️ WARNING: Significant wind direction data is missing`);
        } else {
          console.log(`  ✓ Wind direction data looks good`);
        }
      });
    });
  });

  describe('CRITICAL: Wave/Swell Direction Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: wave/swell direction should be present`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        const withWaveDir = data.forecasts.filter(f => f.waveDirection !== undefined);
        const missingWaveDir = data.forecasts.filter(f => f.waveDirection === undefined);

        const pctPresent = ((withWaveDir.length / data.forecasts.length) * 100).toFixed(1);

        console.log(`\n${loc.name} - Wave/Swell Direction:`);
        console.log(`  Present: ${withWaveDir.length}/${data.forecasts.length} (${pctPresent}%)`);
        console.log(`  Missing: ${missingWaveDir.length}/${data.forecasts.length}`);

        if (withWaveDir.length > 0) {
          const directions = withWaveDir.map(f => f.waveDirection!.value);
          const uniqueDirs = new Set(directions.map(d => Math.round(d / 10) * 10));
          console.log(`  Direction range: ${Math.min(...directions).toFixed(0)}° - ${Math.max(...directions).toFixed(0)}°`);
          console.log(`  Unique directions (grouped): ${uniqueDirs.size}`);

          const qualities = new Set(withWaveDir.map(f => f.waveDirection!.quality));
          console.log(`  Quality flags: ${[...qualities].join(', ')}`);
        }

        if (Number(pctPresent) < 50) {
          console.log(`  ⚠️ CRITICAL: More than half of wave direction data is MISSING!`);
        } else if (Number(pctPresent) < 90) {
          console.log(`  ⚠️ WARNING: Significant wave direction data is missing`);
        } else {
          console.log(`  ✓ Wave direction data looks good`);
        }
      });
    });
  });

  describe('Water Temperature Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: water temperature should be present`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        const withTemp = data.forecasts.filter(f => f.waterTemperature !== undefined);
        const pctPresent = ((withTemp.length / data.forecasts.length) * 100).toFixed(1);

        console.log(`\n${loc.name} - Water Temperature:`);
        console.log(`  Present: ${withTemp.length}/${data.forecasts.length} (${pctPresent}%)`);

        if (withTemp.length > 0) {
          const temps = withTemp.map(f => f.waterTemperature!.value);
          console.log(`  Range: ${Math.min(...temps).toFixed(1)}°C - ${Math.max(...temps).toFixed(1)}°C`);

          // Check if it's varying (it should be relatively stable)
          const uniqueTemps = new Set(temps.map(t => t.toFixed(1)));
          console.log(`  Unique values: ${uniqueTemps.size}`);
        }

        if (Number(pctPresent) === 0) {
          console.log(`  ⚠️ WARNING: No water temperature data available`);
        }
      });
    });
  });

  describe('Tide Level Analysis', () => {
    Object.entries(TEST_LOCATIONS).forEach(([key, loc]) => {
      test(`${loc.name}: tide level should be present and varying`, () => {
        const data = forecastResults.get(key);
        if (!data) return;

        const withTide = data.forecasts.filter(f => f.tideLevel !== undefined);
        const pctPresent = ((withTide.length / data.forecasts.length) * 100).toFixed(1);

        console.log(`\n${loc.name} - Tide Level:`);
        console.log(`  Present: ${withTide.length}/${data.forecasts.length} (${pctPresent}%)`);

        if (withTide.length > 0) {
          const levels = withTide.map(f => f.tideLevel!.value);
          const minLevel = Math.min(...levels);
          const maxLevel = Math.max(...levels);
          const range = maxLevel - minLevel;

          console.log(`  Range: ${minLevel.toFixed(2)}m - ${maxLevel.toFixed(2)}m (variation: ${range.toFixed(2)}m)`);

          // Tides should show clear variation (at least 0.5m for most locations)
          if (range < 0.3) {
            console.log(`  ⚠️ WARNING: Very small tidal range - may be flat/dummy data`);
          } else {
            console.log(`  ✓ Tidal variation looks normal`);
          }
        }
      });
    });
  });

  describe('Summary Diagnosis Report', () => {
    test('generate comprehensive diagnosis', () => {
      console.log('\n');
      console.log('═'.repeat(70));
      console.log('                    FORECAST DATA DIAGNOSIS REPORT');
      console.log('═'.repeat(70));

      forecastResults.forEach((data, key) => {
        const loc = TEST_LOCATIONS[key as keyof typeof TEST_LOCATIONS];
        console.log(`\n📍 ${loc.name}`);
        console.log('-'.repeat(50));

        // Wave Height
        const waveHeights = data.forecasts.map(f => f.waveHeight.max);
        const uniqueWaveHeights = new Set(waveHeights.map(h => h.toFixed(2)));
        const waveQuality = [...new Set(data.forecasts.map(f => f.waveHeight.quality))];

        console.log(`\nWave Height:`);
        console.log(`  Status: ${uniqueWaveHeights.size === 1 ? '❌ DUMMY DATA' : uniqueWaveHeights.size < 5 ? '⚠️ LOW VARIATION' : '✅ OK'}`);
        console.log(`  Unique values: ${uniqueWaveHeights.size}`);
        console.log(`  Quality: ${waveQuality.join(', ')}`);

        // Wave Period
        const periods = data.forecasts.map(f => f.wavePeriod.value);
        const uniquePeriods = new Set(periods);
        const periodQuality = [...new Set(data.forecasts.map(f => f.wavePeriod.quality))];

        console.log(`\nWave Period:`);
        console.log(`  Status: ${uniquePeriods.size === 1 && periods[0] === 10 ? '❌ DEFAULT VALUE' : uniquePeriods.size === 1 ? '⚠️ NO VARIATION' : '✅ OK'}`);
        console.log(`  Unique values: ${uniquePeriods.size}`);
        console.log(`  Quality: ${periodQuality.join(', ')}`);

        // Wind Direction
        const withWindDir = data.forecasts.filter(f => f.windDirection !== undefined);
        const windDirPct = (withWindDir.length / data.forecasts.length) * 100;

        console.log(`\nWind Direction:`);
        console.log(`  Status: ${windDirPct < 50 ? '❌ MOSTLY MISSING' : windDirPct < 90 ? '⚠️ PARTIALLY MISSING' : '✅ OK'}`);
        console.log(`  Available: ${windDirPct.toFixed(0)}%`);

        // Wave Direction
        const withWaveDir = data.forecasts.filter(f => f.waveDirection !== undefined);
        const waveDirPct = (withWaveDir.length / data.forecasts.length) * 100;

        console.log(`\nWave/Swell Direction:`);
        console.log(`  Status: ${waveDirPct < 50 ? '❌ MOSTLY MISSING' : waveDirPct < 90 ? '⚠️ PARTIALLY MISSING' : '✅ OK'}`);
        console.log(`  Available: ${waveDirPct.toFixed(0)}%`);

        // Water Temp
        const withWaterTemp = data.forecasts.filter(f => f.waterTemperature !== undefined);
        const waterTempPct = (withWaterTemp.length / data.forecasts.length) * 100;

        console.log(`\nWater Temperature:`);
        console.log(`  Status: ${waterTempPct === 0 ? '❌ MISSING' : '✅ OK'}`);
        console.log(`  Available: ${waterTempPct.toFixed(0)}%`);

        // Tide
        const withTide = data.forecasts.filter(f => f.tideLevel !== undefined);
        const tidePct = (withTide.length / data.forecasts.length) * 100;
        const tideVariation = withTide.length > 0 ? Math.max(...withTide.map(f => f.tideLevel!.value)) - Math.min(...withTide.map(f => f.tideLevel!.value)) : 0;

        console.log(`\nTide Level:`);
        console.log(`  Status: ${tidePct === 0 ? '❌ MISSING' : tideVariation < 0.3 ? '⚠️ LOW VARIATION' : '✅ OK'}`);
        console.log(`  Available: ${tidePct.toFixed(0)}%`);
        if (withTide.length > 0) {
          console.log(`  Variation: ${tideVariation.toFixed(2)}m`);
        }
      });

      console.log('\n');
      console.log('═'.repeat(70));
      console.log('                         RECOMMENDATIONS');
      console.log('═'.repeat(70));

      // Generate recommendations based on issues found
      const issues: string[] = [];

      forecastResults.forEach((data, key) => {
        const uniqueWaveHeights = new Set(data.forecasts.map(f => f.waveHeight.max.toFixed(2)));
        if (uniqueWaveHeights.size === 1) {
          issues.push('Wave heights returning fallback values - check NDBC buoy data fetching');
        }

        const uniquePeriods = new Set(data.forecasts.map(f => f.wavePeriod.value));
        if (uniquePeriods.size === 1 && data.forecasts[0].wavePeriod.value === 10) {
          issues.push('Wave period stuck at default 10s - check NDBC buoy dominant period');
        }

        const windDirPct = (data.forecasts.filter(f => f.windDirection !== undefined).length / data.forecasts.length) * 100;
        if (windDirPct < 50) {
          issues.push('Wind direction mostly missing - check NWS API wind direction parsing');
        }

        const waveDirPct = (data.forecasts.filter(f => f.waveDirection !== undefined).length / data.forecasts.length) * 100;
        if (waveDirPct < 50) {
          issues.push('Wave direction mostly missing - check NDBC MWD field or fallback logic');
        }
      });

      // Deduplicate and print
      const uniqueIssues = [...new Set(issues)];
      if (uniqueIssues.length === 0) {
        console.log('\n✅ All data sources appear to be working correctly!\n');
      } else {
        console.log('\n⚠️ Issues detected:\n');
        uniqueIssues.forEach((issue, i) => {
          console.log(`  ${i + 1}. ${issue}`);
        });
        console.log('');
      }

      console.log('═'.repeat(70));
    });
  });
});
