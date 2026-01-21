/**
 * NOAA NWS (National Weather Service) Data Source
 * Fetches weather forecasts and air temperature
 */

import { QualityFlag } from '@/types';

const NWS_API_URL = 'https://api.weather.gov';

interface NWSGridpoint {
  properties: {
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
  };
}

export interface NWSForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
}

export interface NWSWeatherData {
  timestamp: string;
  airTemperature?: number;
  windSpeed?: number;
  windDirection?: number;
  quality: QualityFlag;
}

/**
 * Parse wind speed string from NWS (e.g., "10 mph", "5 to 10 mph")
 */
export function parseWindSpeed(windSpeedStr: string): number {
  const match = windSpeedStr.match(/(\d+)/);
  if (!match) return 0;
  const mph = parseInt(match[1]);
  return mph * 0.44704; // Convert mph to m/s
}

/**
 * Parse wind direction to degrees
 */
export function parseWindDirection(dir: string): number {
  const directions: { [key: string]: number } = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };
  return directions[dir.toUpperCase()] || 0;
}

/**
 * Get NOAA NWS forecast for a location
 */
export async function fetchNWSForecast(
  lat: number,
  lng: number
): Promise<NWSForecastPeriod[]> {
  try {
    // Step 1: Get the grid point for the coordinates
    const pointResponse = await fetch(
      `${NWS_API_URL}/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!pointResponse.ok) {
      console.error(`NWS points API error: ${pointResponse.statusText}`);
      return [];
    }

    const pointData: NWSGridpoint = await pointResponse.json();

    // Step 2: Get the hourly forecast
    const forecastResponse = await fetch(pointData.properties.forecastHourly, {
      headers: {
        'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
      },
      next: { revalidate: 1800 }, // Cache for 30 minutes
    });

    if (!forecastResponse.ok) {
      console.error(`NWS forecast API error: ${forecastResponse.statusText}`);
      return [];
    }

    const forecastData = await forecastResponse.json();
    return forecastData.properties.periods || [];
  } catch (error) {
    console.error('Error fetching NWS forecast:', error);
    return [];
  }
}

/**
 * Convert NWS forecast periods to weather data array
 */
export function convertNWSToWeatherData(
  periods: NWSForecastPeriod[]
): NWSWeatherData[] {
  return periods.map(period => ({
    timestamp: period.startTime,
    airTemperature:
      period.temperatureUnit === 'F'
        ? ((period.temperature - 32) * 5) / 9 // Convert to Celsius
        : period.temperature,
    windSpeed: parseWindSpeed(period.windSpeed),
    windDirection: parseWindDirection(period.windDirection),
    quality: 'primary' as QualityFlag,
  }));
}

/**
 * Get weather data for a specific time
 */
export function getWeatherAtTime(
  weatherData: NWSWeatherData[],
  targetTime: Date
): NWSWeatherData | null {
  const targetTimestamp = targetTime.getTime();

  // Find the closest forecast period
  let closest: NWSWeatherData | null = null;
  let minDiff = Infinity;

  for (const data of weatherData) {
    const dataTimestamp = new Date(data.timestamp).getTime();
    const diff = Math.abs(dataTimestamp - targetTimestamp);

    if (diff < minDiff) {
      minDiff = diff;
      closest = data;
    }
  }

  // Only return if within 3 hours
  if (minDiff < 3 * 60 * 60 * 1000) {
    return closest;
  }

  return null;
}
