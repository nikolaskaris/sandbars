import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchWaveWatchGlobalGrid, getLatestModelRun } from '@/lib/forecast/sources/wavewatch';

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
    const modelRun = getLatestModelRun();

    console.log(`Fetching WAVEWATCH III data for model run: ${modelRun.toISOString()}`);

    // Fetch global wave data from WAVEWATCH III
    const waveData = await fetchWaveWatchGlobalGrid();

    if (!waveData || waveData.points.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No wave data fetched from WAVEWATCH III',
      }, { status: 500 });
    }

    console.log(`Fetched ${waveData.points.length} points from ${waveData.source}`);

    // Convert to database format
    const computedAt = new Date().toISOString();
    const gridPoints = waveData.points.map(point => ({
      lat: Math.round(point.lat * 100) / 100,
      lon: Math.round(point.lon * 100) / 100,
      wave_height: point.waveHeight,
      wave_direction: point.waveDirection,
      wave_period: point.wavePeriod,
      source: waveData.source,
      model_run: waveData.modelRun,
      computed_at: computedAt,
    }));

    // Clear ALL existing grid data to ensure fresh state
    // (the cron runs every 6 hours, so we always want the latest data)
    const { error: deleteError } = await supabase
      .from('wave_grid')
      .delete()
      .neq('lat', 999); // Delete all rows (supabase requires a filter)

    if (deleteError) {
      console.error('Error deleting old grid data:', deleteError);
    } else {
      console.log('Cleared existing wave grid data');
    }

    // Insert in batches
    let inserted = 0;
    let errors = 0;
    const batchSize = 500;

    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('wave_grid')
        .upsert(batch, {
          onConflict: 'lat,lon',
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error(`Batch insert error:`, insertError);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      source: waveData.source,
      modelRun: waveData.modelRun,
      pointsFetched: waveData.points.length,
      pointsInserted: inserted,
      errors,
      timestamp: computedAt,
    });
  } catch (error) {
    console.error('Error in sync-wavewatch:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
