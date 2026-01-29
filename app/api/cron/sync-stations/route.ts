import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchNDBCStationList } from '@/lib/forecast/sources/ndbc-stations';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// Create Supabase admin client for cron jobs
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch station list from NDBC
    const stations = await fetchNDBCStationList();

    if (stations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No stations fetched from NDBC',
      });
    }

    // Filter to buoys with wave data
    const buoyStations = stations.filter(s =>
      s.type === 'buoy' && s.hasMet
    );

    let upserted = 0;
    let errors = 0;

    // Upsert stations in batches
    const batchSize = 50;
    for (let i = 0; i < buoyStations.length; i += batchSize) {
      const batch = buoyStations.slice(i, i + batchSize);

      const stationsToUpsert = batch.map(s => ({
        station_id: s.id,
        ndbc_id: s.id,
        type: 'buoy' as const,
        name: s.name,
        latitude: s.lat,
        longitude: s.lon,
        owner: s.owner,
        has_waves: s.hasMet,
        has_wind: s.hasMet,
        has_water_temp: s.hasMet,
        active: true,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('stations')
        .upsert(stationsToUpsert, {
          onConflict: 'station_id',
          ignoreDuplicates: false,
        });

      if (error) {
        errors += batch.length;
      } else {
        upserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      totalFetched: stations.length,
      buoysProcessed: buoyStations.length,
      upserted,
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

// Also support POST for Vercel cron
export async function POST(request: Request) {
  return GET(request);
}
