import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchNDBCBuoyData } from '@/lib/forecast/sources/ndbc';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get active buoy stations from database
    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('id, ndbc_id, latitude, longitude')
      .eq('type', 'buoy')
      .eq('active', true)
      .not('ndbc_id', 'is', null)
      .limit(100); // Limit to prevent timeout

    if (stationsError || !stations) {
      return NextResponse.json({
        success: false,
        error: stationsError?.message || 'No stations found',
      }, { status: 500 });
    }

    let fetched = 0;
    let inserted = 0;
    let errors = 0;

    // Fetch readings in parallel batches
    const batchSize = 20;
    const observedAt = new Date().toISOString();

    for (let i = 0; i < stations.length; i += batchSize) {
      const batch = stations.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (station) => {
          if (!station.ndbc_id) return null;

          const data = await fetchNDBCBuoyData(station.ndbc_id, true);
          if (!data) return null;

          fetched++;

          return {
            station_id: station.id,
            ndbc_id: station.ndbc_id,
            observed_at: observedAt,
            wave_height: data.waveHeight ?? null,
            wave_direction: data.waveDirection ?? null,
            dominant_wave_period: data.dominantWavePeriod ?? null,
            average_wave_period: data.averageWavePeriod ?? null,
            wind_speed: data.windSpeed ?? null,
            wind_direction: data.windDirection ?? null,
            wind_gust: null, // Not available in current NDBC data
            water_temp: data.waterTemperature ?? null,
            air_temp: data.airTemperature ?? null,
            pressure: null, // Not available in current NDBC data
          };
        })
      );

      // Filter successful results
      const readings = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (readings.length > 0) {
        const { error: insertError } = await supabase
          .from('buoy_readings')
          .upsert(readings, {
            onConflict: 'ndbc_id,observed_at',
            ignoreDuplicates: true,
          });

        if (insertError) {
          errors += readings.length;
        } else {
          inserted += readings.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      stationsChecked: stations.length,
      readingsFetched: fetched,
      readingsInserted: inserted,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
