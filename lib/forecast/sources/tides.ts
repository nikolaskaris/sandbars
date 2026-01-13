/**
 * NOAA Tides & Currents Data Source
 * Fetches tide predictions
 */

import { QualityFlag } from '@/types';

const TIDES_API_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TidePrediction {
  timestamp: string;
  tideLevel: number; // meters
  quality: QualityFlag;
}

// Major tide stations (can be expanded)
export const TIDE_STATIONS: TideStation[] = [
  // California
  { id: '9410170', name: 'San Diego Bay', lat: 32.7, lon: -117.2 },
  { id: '9410840', name: 'La Jolla', lat: 32.9, lon: -117.3 },
  { id: '9411340', name: 'Santa Monica', lat: 34.0, lon: -118.5 },
  { id: '9414290', name: 'San Francisco', lat: 37.8, lon: -122.5 },
  { id: '9413450', name: 'Monterey', lat: 36.6, lon: -121.9 },

  // Hawaii
  { id: '1612340', name: 'Honolulu', lat: 21.3, lon: -157.9 },
  { id: '1615680', name: 'Hilo', lat: 19.7, lon: -155.1 },

  // East Coast
  { id: '8518750', name: 'The Battery, NY', lat: 40.7, lon: -74.0 },
  { id: '8534720', name: 'Atlantic City', lat: 39.4, lon: -74.4 },
  { id: '8721164', name: 'Miami Beach', lat: 25.8, lon: -80.1 },
];

/**
 * Calculate distance between two coordinates
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
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

/**
 * Find nearest tide station
 */
export function findNearestTideStation(lat: number, lon: number): TideStation | null {
  let nearest: TideStation | null = null;
  let minDistance = Infinity;

  for (const station of TIDE_STATIONS) {
    const distance = calculateDistance(lat, lon, station.lat, station.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = station;
    }
  }

  // Only return if within reasonable distance (< 100km)
  return minDistance < 100 ? nearest : null;
}

/**
 * Fetch tide predictions for a station
 */
export async function fetchTidePredictions(
  stationId: string,
  startDate: Date,
  endDate: Date
): Promise<TidePrediction[]> {
  try {
    const beginDate = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const params = new URLSearchParams({
      product: 'predictions',
      application: 'Sandbars',
      begin_date: beginDate,
      end_date: endDateStr,
      datum: 'MLLW', // Mean Lower Low Water
      station: stationId,
      time_zone: 'gmt',
      units: 'metric',
      interval: 'h', // Hourly
      format: 'json',
    });

    const response = await fetch(`${TIDES_API_URL}?${params.toString()}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours (predictions are static)
    });

    if (!response.ok) {
      console.error(`Tides API error for station ${stationId}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.predictions || !Array.isArray(data.predictions)) {
      return [];
    }

    return data.predictions.map((pred: any) => ({
      timestamp: pred.t,
      tideLevel: parseFloat(pred.v),
      quality: 'primary' as QualityFlag,
    }));
  } catch (error) {
    console.error(`Error fetching tide predictions for station ${stationId}:`, error);
    return [];
  }
}

/**
 * Format date for API (yyyyMMdd HH:mm)
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day} ${hours}:${minutes}`;
}

/**
 * Get tide level at specific time
 */
export function getTideAtTime(
  predictions: TidePrediction[],
  targetTime: Date
): TidePrediction | null {
  const targetTimestamp = targetTime.getTime();

  // Find closest prediction
  let closest: TidePrediction | null = null;
  let minDiff = Infinity;

  for (const pred of predictions) {
    const predTimestamp = new Date(pred.timestamp).getTime();
    const diff = Math.abs(predTimestamp - targetTimestamp);

    if (diff < minDiff) {
      minDiff = diff;
      closest = pred;
    }
  }

  // Only return if within 1 hour
  if (minDiff < 60 * 60 * 1000) {
    return closest;
  }

  return null;
}
