import { createClient } from '@/lib/supabase/server';
import { getSurfForecast } from '@/lib/forecast';
import { SurfForecast, EnhancedSurfForecast } from '@/types';
import { NextResponse } from 'next/server';

/**
 * Convert enhanced forecast to legacy format for backwards compatibility
 */
function toLegacyFormat(enhanced: EnhancedSurfForecast): SurfForecast {
  return {
    time: enhanced.time,
    waveHeight: {
      min: enhanced.waveHeight.min,
      max: enhanced.waveHeight.max,
    },
    wavePeriod: enhanced.wavePeriod.value,
    waveDirection: enhanced.waveDirection?.value,
    windSpeed: enhanced.windSpeed.value,
    windDirection: enhanced.windDirection?.value,
    waterTemperature: enhanced.waterTemperature?.value,
    airTemperature: enhanced.airTemperature?.value,
    wavePower: enhanced.wavePower?.value,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const enhanced = searchParams.get('enhanced') === 'true'; // Optional: return enhanced format
    const hours = parseInt(searchParams.get('hours') || '168'); // Default 7 days

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const forecastData = await getSurfForecast(lat, lng, hours);

    // Return enhanced format with metadata, or legacy format
    if (enhanced) {
      return NextResponse.json(forecastData);
    } else {
      // Convert to legacy format for backwards compatibility
      const legacyForecasts = forecastData.forecasts.map(toLegacyFormat);
      return NextResponse.json(legacyForecasts);
    }
  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
