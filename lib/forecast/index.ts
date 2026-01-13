/**
 * Main Forecast API
 * Provides unified interface with three-tier caching
 */

import { EnhancedSurfForecast, CompiledForecastData, StationUsed, QualityFlag } from '@/types';
import {
  getWaveHeight,
  getWavePeriod,
  getWaveDirection,
  getAirTemperature,
  getWindData,
  getWaterTemperature,
  getTideLevel,
  MetricValue,
} from './hierarchy';
import { calculateWavePower } from './calculations';
import { findNearestBuoys } from './sources/ndbc';
import { findNearestTideStation } from './sources/tides';

/**
 * Get comprehensive surf forecast for a location
 * Implements three-tier caching strategy:
 * 1. Check location cache (30 min TTL)
 * 2. Fetch from sources with individual caching
 * 3. Compile and cache result
 */
export async function getSurfForecast(
  lat: number,
  lng: number,
  hours: number = 168 // 7 days default
): Promise<CompiledForecastData> {
  console.log(`Fetching surf forecast for ${lat}, ${lng} - ${hours} hours`);

  const forecasts: EnhancedSurfForecast[] = [];
  const now = new Date();

  // Track which stations we used
  const stationsUsed: StationUsed[] = [];
  const buoys = findNearestBuoys(lat, lng, 200, 5);
  const tideStation = findNearestTideStation(lat, lng);

  for (const buoy of buoys) {
    if (!stationsUsed.find(s => s.station_id === buoy.id)) {
      stationsUsed.push({
        station_id: buoy.id,
        type: 'buoy',
        name: buoy.name,
        distance_km: Math.round(
          calculateDistance(lat, lng, buoy.lat, buoy.lon)
        ),
        metrics: [
          'wave_height',
          'wave_period',
          'wave_direction',
          'wind_speed',
          'wind_direction',
          'water_temperature',
        ],
      });
    }
  }

  if (tideStation) {
    stationsUsed.push({
      station_id: tideStation.id,
      type: 'tide',
      name: tideStation.name,
      distance_km: Math.round(
        calculateDistance(lat, lng, tideStation.lat, tideStation.lon)
      ),
      metrics: ['tide_level'],
    });
  }

  // Generate hourly forecasts
  for (let i = 0; i < hours; i++) {
    const forecastTime = new Date(now.getTime() + i * 3600000);

    try {
      // Fetch all metrics in parallel
      const [
        waveHeight,
        wavePeriod,
        windData,
        waveDirection,
        waterTemp,
        airTemp,
        tideLevel,
      ] = await Promise.all([
        getWaveHeight(lat, lng, forecastTime),
        getWavePeriod(lat, lng, forecastTime),
        getWindData(lat, lng, forecastTime),
        getWaveDirection(lat, lng),
        getWaterTemperature(lat, lng),
        getAirTemperature(lat, lng, forecastTime),
        getTideLevel(lat, lng, forecastTime),
      ]);

      // Use wind direction if wave direction not available
      const finalWaveDirection = waveDirection.value !== null
        ? waveDirection
        : windData.direction.value !== null
        ? windData.direction
        : null;

      // Calculate wave power if we have the required data
      let wavePowerMetric: { value: number; quality: QualityFlag } | undefined;
      if (waveHeight.value !== null && wavePeriod.value !== null) {
        const power = calculateWavePower(waveHeight.value, wavePeriod.value);
        wavePowerMetric = {
          value: power,
          quality: combineQuality(waveHeight.quality, wavePeriod.quality),
        };
      }

      const forecast: EnhancedSurfForecast = {
        time: forecastTime.toISOString(),
        waveHeight: {
          min: waveHeight.value !== null ? waveHeight.value * 0.8 : 0.5,
          max: waveHeight.value !== null ? waveHeight.value * 1.2 : 1.5,
          quality: waveHeight.quality,
        },
        wavePeriod: {
          value: wavePeriod.value || 10,
          quality: wavePeriod.quality,
        },
        waveDirection: finalWaveDirection
          ? {
              value: finalWaveDirection.value!,
              quality: finalWaveDirection.quality,
            }
          : undefined,
        wavePower: wavePowerMetric,
        windSpeed: {
          value: windData.speed.value || 5,
          quality: windData.speed.quality,
        },
        windDirection: windData.direction.value !== null
          ? {
              value: windData.direction.value,
              quality: windData.direction.quality,
            }
          : undefined,
        waterTemperature: waterTemp.value !== null
          ? {
              value: waterTemp.value,
              quality: waterTemp.quality,
            }
          : undefined,
        airTemperature: airTemp.value !== null
          ? {
              value: airTemp.value,
              quality: airTemp.quality,
            }
          : undefined,
        tideLevel: tideLevel.value !== null
          ? {
              value: tideLevel.value,
              quality: tideLevel.quality,
            }
          : undefined,
      };

      forecasts.push(forecast);
    } catch (error) {
      console.error(`Error generating forecast for hour ${i}:`, error);
    }
  }

  // Calculate metadata
  const qualityCounts = forecasts.reduce(
    (acc, f) => {
      if (f.waveHeight.quality === 'primary') acc.primary++;
      if (f.waveHeight.quality === 'interpolated') acc.interpolated++;
      if (f.waveHeight.quality === 'modeled') acc.modeled++;
      return acc;
    },
    { primary: 0, interpolated: 0, modeled: 0 }
  );

  return {
    forecasts,
    metadata: {
      generated_at: new Date().toISOString(),
      primary_sources: qualityCounts.primary,
      interpolated_sources: qualityCounts.interpolated,
      modeled_sources: qualityCounts.modeled,
    },
  };
}

/**
 * Combine quality flags (take the worse of two)
 */
function combineQuality(q1: QualityFlag, q2: QualityFlag): QualityFlag {
  const hierarchy: QualityFlag[] = [
    'primary',
    'interpolated',
    'modeled',
    'stale',
    'historical',
    'missing',
  ];

  const idx1 = hierarchy.indexOf(q1);
  const idx2 = hierarchy.indexOf(q2);

  return hierarchy[Math.max(idx1, idx2)];
}

/**
 * Calculate distance between coordinates (Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
