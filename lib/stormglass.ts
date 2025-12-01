import { SurfForecast, StormglassResponse } from '@/types';

const STORMGLASS_API_URL = 'https://api.stormglass.io/v2';

export async function getSurfForecast(
  lat: number,
  lng: number
): Promise<SurfForecast[]> {
  const apiKey = process.env.STORMGLASS_API_KEY;

  if (!apiKey) {
    throw new Error('Stormglass API key not configured');
  }

  const params = [
    'waveHeight',
    'wavePeriod',
    'waveDirection',
    'windSpeed',
    'windDirection',
    'waterTemperature',
  ].join(',');

  const response = await fetch(
    `${STORMGLASS_API_URL}/weather/point?lat=${lat}&lng=${lng}&params=${params}`,
    {
      headers: {
        Authorization: apiKey,
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Stormglass API error: ${response.statusText}`);
  }

  const data: StormglassResponse = await response.json();

  // Transform the response to our format
  return data.hours.map((hour) => ({
    time: hour.time,
    waveHeight: {
      min: hour.waveHeight.noaa || hour.waveHeight.sg,
      max: hour.waveHeight.icon || hour.waveHeight.noaa || hour.waveHeight.sg,
    },
    wavePeriod: hour.wavePeriod.noaa || hour.wavePeriod.sg,
    waveDirection: hour.waveDirection.noaa || hour.waveDirection.sg,
    windSpeed: hour.windSpeed.noaa || hour.windSpeed.sg,
    windDirection: hour.windDirection.noaa || hour.windDirection.sg,
    waterTemperature: hour.waterTemperature?.noaa || hour.waterTemperature?.sg,
  }));
}
