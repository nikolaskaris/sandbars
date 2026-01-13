import { SurfForecast } from '@/types';

// NOAA APIs
const NWS_API_URL = 'https://api.weather.gov';
const NDBC_API_URL = 'https://www.ndbc.noaa.gov';

interface NOAAGridpoint {
  properties: {
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
  };
}

interface NOAAForecastPeriod {
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

interface NDBCBuoyData {
  waveHeight?: number;
  dominantWavePeriod?: number;
  averageWavePeriod?: number;
  waveDirection?: string;
  windSpeed?: number;
  windDirection?: string;
  waterTemperature?: number;
  timestamp?: string;
}

/**
 * Find nearest NDBC buoy to given coordinates
 */
async function findNearestBuoy(lat: number, lng: number): Promise<string | null> {
  // Major buoy stations (you can expand this list)
  const buoys = [
    { id: '46221', lat: 33.8, lon: -118.3, name: 'Santa Monica Basin' },
    { id: '46222', lat: 33.6, lon: -117.9, name: 'San Pedro' },
    { id: '46232', lat: 37.5, lon: -122.5, name: 'Point Reyes' },
    { id: '46237', lat: 37.8, lon: -122.4, name: 'San Francisco' },
    { id: '46254', lat: 33.2, lon: -119.9, name: 'Ventura' },
    { id: '46025', lat: 33.7, lon: -119.1, name: 'Santa Monica' },
    { id: '46215', lat: 40.8, lon: -124.5, name: 'Cape Mendocino' },
    { id: '46014', lat: 39.2, lon: -123.3, name: 'Point Arena' },
    { id: '46026', lat: 37.8, lon: -122.8, name: 'San Francisco Bar' },
    { id: '46012', lat: 37.4, lon: -122.9, name: 'Half Moon Bay' },
    { id: '46042', lat: 36.8, lon: -122.4, name: 'Monterey Bay' },
    { id: '46011', lat: 34.9, lon: -121.0, name: 'Santa Maria' },
    { id: '51201', lat: 24.4, lon: -162.1, name: 'Hanalei' },
    { id: '51202', lat: 21.5, lon: -157.8, name: 'Waimea Bay' },
  ];

  // Find closest buoy
  let closestBuoy = buoys[0];
  let minDistance = calculateDistance(lat, lng, buoys[0].lat, buoys[0].lon);

  for (const buoy of buoys) {
    const distance = calculateDistance(lat, lng, buoy.lat, buoy.lon);
    if (distance < minDistance) {
      minDistance = distance;
      closestBuoy = buoy;
    }
  }

  // Return buoy ID if within reasonable distance (< 200km)
  return minDistance < 200 ? closestBuoy.id : null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
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
 * Fetch current buoy data from NDBC
 */
async function getBuoyData(buoyId: string): Promise<NDBCBuoyData> {
  try {
    // NDBC realtime data (latest observation)
    const response = await fetch(
      `${NDBC_API_URL}/data/realtime2/${buoyId}.txt`,
      {
        next: { revalidate: 1800 }, // 30 minutes cache
      }
    );

    if (!response.ok) {
      throw new Error(`NDBC API error: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split('\n');

    // Parse the latest data (line 2, after header lines)
    if (lines.length < 3) {
      return {};
    }

    // NDBC format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    const data = lines[2].trim().split(/\s+/);

    const waveHeight = parseFloat(data[8]); // WVHT - significant wave height
    const dominantPeriod = parseFloat(data[9]); // DPD - dominant wave period
    const avgPeriod = parseFloat(data[10]); // APD - average wave period
    const waveDir = data[11]; // MWD - wave direction
    const windSpeed = parseFloat(data[6]); // WSPD - wind speed m/s
    const windDir = data[5]; // WDIR - wind direction
    const waterTemp = parseFloat(data[14]); // WTMP - water temperature

    return {
      waveHeight: isNaN(waveHeight) ? undefined : waveHeight,
      dominantWavePeriod: isNaN(dominantPeriod) ? undefined : dominantPeriod,
      averageWavePeriod: isNaN(avgPeriod) ? undefined : avgPeriod,
      waveDirection: waveDir === 'MM' ? undefined : waveDir,
      windSpeed: isNaN(windSpeed) ? undefined : windSpeed,
      windDirection: windDir === 'MM' ? undefined : windDir,
      waterTemperature: isNaN(waterTemp) ? undefined : waterTemp,
      timestamp: `${data[0]}-${data[1]}-${data[2]}T${data[3]}:${data[4]}:00Z`,
    };
  } catch (error) {
    console.error('Error fetching NDBC buoy data:', error);
    return {};
  }
}

/**
 * Get NOAA NWS forecast for a location
 */
async function getNWSForecast(lat: number, lng: number): Promise<NOAAForecastPeriod[]> {
  try {
    // Step 1: Get the grid point for the coordinates
    const pointResponse = await fetch(
      `${NWS_API_URL}/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
        },
        next: { revalidate: 3600 }, // 1 hour cache
      }
    );

    if (!pointResponse.ok) {
      throw new Error(`NWS points API error: ${pointResponse.statusText}`);
    }

    const pointData: NOAAGridpoint = await pointResponse.json();

    // Step 2: Get the hourly forecast
    const forecastResponse = await fetch(pointData.properties.forecastHourly, {
      headers: {
        'User-Agent': '(Sandbars Surf App, contact@sandbars.app)',
      },
      next: { revalidate: 3600 },
    });

    if (!forecastResponse.ok) {
      throw new Error(`NWS forecast API error: ${forecastResponse.statusText}`);
    }

    const forecastData = await forecastResponse.json();
    return forecastData.properties.periods || [];
  } catch (error) {
    console.error('Error fetching NWS forecast:', error);
    return [];
  }
}

/**
 * Parse wind speed string from NWS (e.g., "10 mph", "5 to 10 mph")
 */
function parseWindSpeed(windSpeedStr: string): number {
  const match = windSpeedStr.match(/(\d+)/);
  if (!match) return 0;
  const mph = parseInt(match[1]);
  return mph * 0.44704; // Convert mph to m/s
}

/**
 * Get surf forecast using NOAA data
 */
export async function getSurfForecast(
  lat: number,
  lng: number
): Promise<SurfForecast[]> {
  try {
    // Find nearest buoy for wave data
    const buoyId = await findNearestBuoy(lat, lng);

    // Get current buoy conditions (if available)
    let buoyData: NDBCBuoyData = {};
    if (buoyId) {
      buoyData = await getBuoyData(buoyId);
    }

    // Get NWS forecast for wind
    const nwsForecast = await getNWSForecast(lat, lng);

    // Build forecast array
    const forecasts: SurfForecast[] = [];

    // Use buoy data as baseline if available
    const baseWaveHeight = buoyData.waveHeight || 1.0;
    const baseWavePeriod = buoyData.dominantWavePeriod || buoyData.averageWavePeriod || 10;
    const baseWaveDirection = buoyData.waveDirection ? parseInt(buoyData.waveDirection) : undefined;

    // Create forecasts for next 7 days (168 hours)
    for (let i = 0; i < Math.min(nwsForecast.length, 168); i++) {
      const period = nwsForecast[i];

      // Parse wind from NWS
      const windSpeed = parseWindSpeed(period.windSpeed);

      // Simple wave height variation (+/- 20% based on wind)
      const waveVariation = (windSpeed - 5) / 30; // More wind = bigger waves
      const waveHeight = baseWaveHeight * (1 + waveVariation * 0.2);

      forecasts.push({
        time: period.startTime,
        waveHeight: {
          min: Math.max(0.3, waveHeight * 0.8),
          max: waveHeight * 1.2,
        },
        wavePeriod: baseWavePeriod,
        waveDirection: baseWaveDirection,
        windSpeed: windSpeed,
        windDirection: parseWindDirection(period.windDirection),
        waterTemperature: buoyData.waterTemperature,
      });
    }

    // If we don't have NWS data but have buoy data, create a basic 7-day forecast
    if (forecasts.length === 0 && buoyId) {
      const now = new Date();
      for (let i = 0; i < 168; i++) {
        const time = new Date(now.getTime() + i * 3600000);
        forecasts.push({
          time: time.toISOString(),
          waveHeight: {
            min: baseWaveHeight * 0.8,
            max: baseWaveHeight * 1.2,
          },
          wavePeriod: baseWavePeriod,
          waveDirection: baseWaveDirection,
          windSpeed: buoyData.windSpeed || 5,
          windDirection: buoyData.windDirection ? parseInt(buoyData.windDirection) : undefined,
          waterTemperature: buoyData.waterTemperature,
        });
      }
    }

    return forecasts;
  } catch (error) {
    console.error('Error getting NOAA forecast:', error);
    throw new Error('Failed to fetch NOAA forecast data');
  }
}

/**
 * Parse wind direction to degrees
 */
function parseWindDirection(dir: string): number {
  const directions: { [key: string]: number } = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return directions[dir.toUpperCase()] || 0;
}
