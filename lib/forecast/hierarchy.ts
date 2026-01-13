/**
 * Multi-Source Data Hierarchy Module
 * Implements priority cascade: Primary → Secondary → Tertiary → Model Fallback
 */

import { QualityFlag, MetricType } from '@/types';
import {
  fetchNDBCBuoyData,
  findNearestBuoys,
  NDBCBuoyReading,
  calculateDistance,
} from './sources/ndbc';
import {
  fetchNWSForecast,
  convertNWSToWeatherData,
  getWeatherAtTime,
  NWSWeatherData,
} from './sources/nws';
import {
  fetchTidePredictions,
  findNearestTideStation,
  getTideAtTime,
  TidePrediction,
} from './sources/tides';
import {
  inverseDistanceWeighting,
  interpolateWaveData,
  interpolateWindData,
  interpolateSlowVariable,
  DataPoint,
} from './interpolation';

export interface MetricValue {
  value: number | null;
  quality: QualityFlag;
  source: string;
  sourceHierarchy: string[];
}

/**
 * Get wave height with fallback hierarchy
 * Primary: Nearest NDBC buoy (< 50km)
 * Secondary: Interpolate from 2-3 nearby buoys
 * Tertiary: WaveWatch III model data
 * Fallback: Historical average
 */
export async function getWaveHeight(
  lat: number,
  lon: number,
  targetTime?: Date
): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  // Primary: Try nearest buoy
  const nearestBuoys = findNearestBuoys(lat, lon, 50, 1);
  if (nearestBuoys.length > 0) {
    const buoy = nearestBuoys[0];
    sourceHierarchy.push(`buoy_${buoy.id}_primary`);

    const buoyData = await fetchNDBCBuoyData(buoy.id);
    if (buoyData && buoyData.waveHeight !== undefined) {
      return {
        value: buoyData.waveHeight,
        quality: buoyData.quality,
        source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
        sourceHierarchy,
      };
    }
  }

  // Secondary: Try interpolation from multiple buoys
  const nearbyBuoys = findNearestBuoys(lat, lon, 100, 5);
  if (nearbyBuoys.length >= 2) {
    sourceHierarchy.push('buoy_interpolation');

    const dataPoints: DataPoint[] = [];
    for (const buoy of nearbyBuoys) {
      const buoyData = await fetchNDBCBuoyData(buoy.id);
      if (buoyData && buoyData.waveHeight !== undefined) {
        dataPoints.push({
          value: buoyData.waveHeight,
          distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
          quality: buoyData.quality,
        });
      }
    }

    if (dataPoints.length >= 2) {
      const distanceToShore = 10; // TODO: Calculate actual distance to shore
      const interpolated = interpolateWaveData(dataPoints, distanceToShore);
      if (interpolated) {
        return {
          value: interpolated.value,
          quality: interpolated.quality,
          source: `Interpolated from ${dataPoints.length} buoys`,
          sourceHierarchy,
        };
      }
    }
  }

  // Tertiary: WaveWatch III model (not implemented yet)
  sourceHierarchy.push('wavewatch_model');

  // Fallback: Use a reasonable default
  sourceHierarchy.push('fallback');
  return {
    value: 1.0, // 1 meter default
    quality: 'historical',
    source: 'Historical average',
    sourceHierarchy,
  };
}

/**
 * Get wave period with fallback hierarchy
 */
export async function getWavePeriod(
  lat: number,
  lon: number,
  targetTime?: Date
): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  // Primary: Try nearest buoy
  const nearestBuoys = findNearestBuoys(lat, lon, 50, 1);
  if (nearestBuoys.length > 0) {
    const buoy = nearestBuoys[0];
    sourceHierarchy.push(`buoy_${buoy.id}_primary`);

    const buoyData = await fetchNDBCBuoyData(buoy.id);
    if (buoyData && buoyData.dominantWavePeriod !== undefined) {
      return {
        value: buoyData.dominantWavePeriod,
        quality: buoyData.quality,
        source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
        sourceHierarchy,
      };
    }
  }

  // Secondary: Interpolation
  const nearbyBuoys = findNearestBuoys(lat, lon, 100, 5);
  if (nearbyBuoys.length >= 2) {
    sourceHierarchy.push('buoy_interpolation');

    const dataPoints: DataPoint[] = [];
    for (const buoy of nearbyBuoys) {
      const buoyData = await fetchNDBCBuoyData(buoy.id);
      const period = buoyData?.dominantWavePeriod || buoyData?.averageWavePeriod;
      if (period !== undefined) {
        dataPoints.push({
          value: period,
          distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
          quality: buoyData?.quality || 'missing',
        });
      }
    }

    if (dataPoints.length >= 2) {
      const interpolated = inverseDistanceWeighting(dataPoints);
      if (interpolated) {
        return {
          value: interpolated.value,
          quality: interpolated.quality,
          source: `Interpolated from ${dataPoints.length} buoys`,
          sourceHierarchy,
        };
      }
    }
  }

  // Fallback
  sourceHierarchy.push('fallback');
  return {
    value: 10, // 10 second default
    quality: 'historical',
    source: 'Historical average',
    sourceHierarchy,
  };
}

/**
 * Get wave direction with fallback hierarchy
 */
export async function getWaveDirection(
  lat: number,
  lon: number,
  windDirection?: number
): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  // Primary: Try nearest buoy
  const nearestBuoys = findNearestBuoys(lat, lon, 50, 1);
  if (nearestBuoys.length > 0) {
    const buoy = nearestBuoys[0];
    sourceHierarchy.push(`buoy_${buoy.id}_primary`);

    const buoyData = await fetchNDBCBuoyData(buoy.id);
    if (buoyData && buoyData.waveDirection !== undefined) {
      return {
        value: buoyData.waveDirection,
        quality: buoyData.quality,
        source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
        sourceHierarchy,
      };
    }
  }

  // Fallback to wind direction if available
  if (windDirection !== undefined) {
    sourceHierarchy.push('wind_direction_fallback');
    return {
      value: windDirection,
      quality: 'interpolated',
      source: 'Wind direction',
      sourceHierarchy,
    };
  }

  sourceHierarchy.push('no_data');
  return {
    value: null,
    quality: 'missing',
    source: 'No data available',
    sourceHierarchy,
  };
}

/**
 * Get air temperature with fallback hierarchy
 * Primary: NWS API point forecast
 * Secondary: Nearest NWS observation station
 * Tertiary: NDBC buoy (if available)
 */
export async function getAirTemperature(
  lat: number,
  lon: number,
  targetTime: Date
): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  // Primary: NWS forecast
  sourceHierarchy.push('nws_forecast');
  const nwsForecast = await fetchNWSForecast(lat, lon);
  if (nwsForecast.length > 0) {
    const weatherData = convertNWSToWeatherData(nwsForecast);
    const weather = getWeatherAtTime(weatherData, targetTime);
    if (weather && weather.airTemperature !== undefined) {
      return {
        value: weather.airTemperature,
        quality: weather.quality,
        source: 'NOAA NWS Forecast',
        sourceHierarchy,
      };
    }
  }

  // Tertiary: Try nearby buoys
  const nearbyBuoys = findNearestBuoys(lat, lon, 100, 3);
  if (nearbyBuoys.length > 0) {
    sourceHierarchy.push('buoy_air_temp');

    const dataPoints: DataPoint[] = [];
    for (const buoy of nearbyBuoys) {
      const buoyData = await fetchNDBCBuoyData(buoy.id);
      if (buoyData && buoyData.airTemperature !== undefined) {
        dataPoints.push({
          value: buoyData.airTemperature,
          distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
          quality: buoyData.quality,
        });
      }
    }

    if (dataPoints.length > 0) {
      const interpolated = interpolateSlowVariable(dataPoints);
      if (interpolated) {
        return {
          value: interpolated.value,
          quality: interpolated.quality,
          source: `Interpolated from ${dataPoints.length} buoys`,
          sourceHierarchy,
        };
      }
    }
  }

  sourceHierarchy.push('no_data');
  return {
    value: null,
    quality: 'missing',
    source: 'No data available',
    sourceHierarchy,
  };
}

/**
 * Get wind speed and direction from NWS or buoys
 */
export async function getWindData(
  lat: number,
  lon: number,
  targetTime: Date
): Promise<{ speed: MetricValue; direction: MetricValue }> {
  const sourceHierarchy: string[] = [];

  // Primary: NWS forecast
  sourceHierarchy.push('nws_forecast');
  const nwsForecast = await fetchNWSForecast(lat, lon);
  if (nwsForecast.length > 0) {
    const weatherData = convertNWSToWeatherData(nwsForecast);
    const weather = getWeatherAtTime(weatherData, targetTime);
    if (weather && weather.windSpeed !== undefined && weather.windDirection !== undefined) {
      return {
        speed: {
          value: weather.windSpeed,
          quality: weather.quality,
          source: 'NOAA NWS Forecast',
          sourceHierarchy: [...sourceHierarchy],
        },
        direction: {
          value: weather.windDirection,
          quality: weather.quality,
          source: 'NOAA NWS Forecast',
          sourceHierarchy: [...sourceHierarchy],
        },
      };
    }
  }

  // Secondary: Buoy interpolation
  const nearbyBuoys = findNearestBuoys(lat, lon, 100, 5);
  const speedDataPoints: DataPoint[] = [];
  const dirDataPoints: DataPoint[] = [];

  for (const buoy of nearbyBuoys) {
    const buoyData = await fetchNDBCBuoyData(buoy.id);
    const distance = calculateDistance(lat, lon, buoy.lat, buoy.lon);

    if (buoyData && buoyData.windSpeed !== undefined) {
      speedDataPoints.push({
        value: buoyData.windSpeed,
        distance,
        quality: buoyData.quality,
      });
    }

    if (buoyData && buoyData.windDirection !== undefined) {
      dirDataPoints.push({
        value: buoyData.windDirection,
        distance,
        quality: buoyData.quality,
      });
    }
  }

  const distanceToShore = 10; // TODO: Calculate actual
  const speedInterp = interpolateWindData(speedDataPoints, distanceToShore);
  const dirInterp = interpolateWindData(dirDataPoints, distanceToShore);

  return {
    speed: speedInterp
      ? {
          value: speedInterp.value,
          quality: speedInterp.quality,
          source: `Interpolated from ${speedDataPoints.length} buoys`,
          sourceHierarchy: [...sourceHierarchy, 'buoy_interpolation'],
        }
      : { value: 5, quality: 'historical', source: 'Default', sourceHierarchy: [...sourceHierarchy, 'fallback'] },
    direction: dirInterp
      ? {
          value: dirInterp.value,
          quality: dirInterp.quality,
          source: `Interpolated from ${dirDataPoints.length} buoys`,
          sourceHierarchy: [...sourceHierarchy, 'buoy_interpolation'],
        }
      : { value: null, quality: 'missing', source: 'No data', sourceHierarchy: [...sourceHierarchy, 'no_data'] },
  };
}

/**
 * Get water temperature from buoys
 */
export async function getWaterTemperature(lat: number, lon: number): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  // Try nearby buoys
  const nearbyBuoys = findNearestBuoys(lat, lon, 100, 5);
  const dataPoints: DataPoint[] = [];

  for (const buoy of nearbyBuoys) {
    sourceHierarchy.push(`buoy_${buoy.id}`);
    const buoyData = await fetchNDBCBuoyData(buoy.id);
    if (buoyData && buoyData.waterTemperature !== undefined) {
      dataPoints.push({
        value: buoyData.waterTemperature,
        distance: calculateDistance(lat, lon, buoy.lat, buoy.lon),
        quality: buoyData.quality,
      });
    }
  }

  if (dataPoints.length > 0) {
    const interpolated = interpolateSlowVariable(dataPoints);
    if (interpolated) {
      return {
        value: interpolated.value,
        quality: interpolated.quality,
        source: `Interpolated from ${dataPoints.length} buoys`,
        sourceHierarchy,
      };
    }
  }

  sourceHierarchy.push('no_data');
  return {
    value: null,
    quality: 'missing',
    source: 'No data available',
    sourceHierarchy,
  };
}

/**
 * Get tide level
 */
export async function getTideLevel(
  lat: number,
  lon: number,
  targetTime: Date
): Promise<MetricValue> {
  const sourceHierarchy: string[] = [];

  const tideStation = findNearestTideStation(lat, lon);
  if (!tideStation) {
    return {
      value: null,
      quality: 'missing',
      source: 'No tide station nearby',
      sourceHierarchy: ['no_station'],
    };
  }

  sourceHierarchy.push(`tide_station_${tideStation.id}`);

  // Fetch 24 hours of predictions
  const startTime = new Date(targetTime);
  startTime.setHours(startTime.getHours() - 12);
  const endTime = new Date(targetTime);
  endTime.setHours(endTime.getHours() + 12);

  const predictions = await fetchTidePredictions(tideStation.id, startTime, endTime);
  const tidePrediction = getTideAtTime(predictions, targetTime);

  if (tidePrediction) {
    return {
      value: tidePrediction.tideLevel,
      quality: tidePrediction.quality,
      source: `NOAA Tide Station ${tideStation.name}`,
      sourceHierarchy,
    };
  }

  sourceHierarchy.push('no_data');
  return {
    value: null,
    quality: 'missing',
    source: 'No tide data available',
    sourceHierarchy,
  };
}
