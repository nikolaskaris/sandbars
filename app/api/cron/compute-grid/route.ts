import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Haversine distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface BuoyReading {
  lat: number;
  lon: number;
  wave_height: number;
  wave_direction: number;
  wave_period: number | null;
}

// IDW interpolation with tighter distance limit to preserve local variation
function interpolatePoint(
  lat: number,
  lon: number,
  readings: BuoyReading[],
  maxDistance: number = 400 // km - tighter limit preserves local variation
): { wave_height: number; wave_direction: number; wave_period: number | null } | null {
  let weightedHeight = 0;
  let weightedPeriod = 0;
  let totalWeight = 0;
  let periodWeight = 0;
  let dirX = 0;
  let dirY = 0;

  for (const reading of readings) {
    const distance = calculateDistance(lat, lon, reading.lat, reading.lon);
    if (distance > maxDistance) continue;

    const weight = 1 / Math.max(distance * distance, 1);
    weightedHeight += reading.wave_height * weight;

    const dirRad = reading.wave_direction * 0.017453;
    dirX += Math.cos(dirRad) * weight;
    dirY += Math.sin(dirRad) * weight;

    if (reading.wave_period !== null) {
      weightedPeriod += reading.wave_period * weight;
      periodWeight += weight;
    }

    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  return {
    wave_height: Math.round((weightedHeight / totalWeight) * 100) / 100,
    wave_direction: Math.round(((Math.atan2(dirY, dirX) * 57.2958) + 360) % 360),
    wave_period: periodWeight > 0 ? Math.round((weightedPeriod / periodWeight) * 10) / 10 : null,
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get latest readings from each buoy (using the function we created)
    const { data: readings, error: readingsError } = await supabase
      .rpc('get_latest_buoy_readings');

    // Fallback: if function doesn't exist, query directly
    let buoyData: BuoyReading[] = [];

    if (readingsError || !readings || readings.length === 0) {
      // Direct query as fallback
      const { data: directReadings, error: directError } = await supabase
        .from('buoy_readings')
        .select(`
          ndbc_id,
          wave_height,
          wave_direction,
          dominant_wave_period,
          observed_at,
          stations!inner(latitude, longitude)
        `)
        .not('wave_height', 'is', null)
        .not('wave_direction', 'is', null)
        .gte('observed_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .order('observed_at', { ascending: false });

      if (directError || !directReadings) {
        return NextResponse.json({
          success: false,
          error: directError?.message || 'No readings available',
        }, { status: 500 });
      }

      // Deduplicate by station (keep latest)
      const seen = new Set<string>();
      for (const r of directReadings as any[]) {
        if (!seen.has(r.ndbc_id)) {
          seen.add(r.ndbc_id);
          buoyData.push({
            lat: r.stations.latitude,
            lon: r.stations.longitude,
            wave_height: r.wave_height,
            wave_direction: r.wave_direction,
            wave_period: r.dominant_wave_period,
          });
        }
      }
    } else {
      buoyData = readings.map((r: any) => ({
        lat: r.lat,
        lon: r.lon,
        wave_height: r.wave_height,
        wave_direction: r.wave_direction,
        wave_period: r.wave_period,
      }));
    }

    if (buoyData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid buoy readings found',
      });
    }

    // Generate grid points
    const gridPoints: {
      lat: number;
      lon: number;
      wave_height: number;
      wave_direction: number;
      wave_period: number | null;
      computed_at: string;
    }[] = [];

    const resolution = 2; // 2 degree grid for better detail
    const computedAt = new Date().toISOString();

    for (let lat = -60; lat <= 60; lat += resolution) {
      for (let lon = -180; lon <= 180; lon += resolution) {
        const interpolated = interpolatePoint(lat, lon, buoyData);
        if (interpolated) {
          gridPoints.push({
            lat,
            lon,
            wave_height: interpolated.wave_height,
            wave_direction: interpolated.wave_direction,
            wave_period: interpolated.wave_period,
            computed_at: computedAt,
          });
        }
      }
    }

    // Also include actual buoy locations for accuracy
    for (const buoy of buoyData) {
      const roundedLat = Math.round(buoy.lat / resolution) * resolution;
      const roundedLon = Math.round(buoy.lon / resolution) * resolution;

      const exists = gridPoints.some(
        p => Math.abs(p.lat - buoy.lat) < resolution / 2 &&
             Math.abs(p.lon - buoy.lon) < resolution / 2
      );

      if (!exists) {
        gridPoints.push({
          lat: Math.round(buoy.lat * 100) / 100,
          lon: Math.round(buoy.lon * 100) / 100,
          wave_height: buoy.wave_height,
          wave_direction: buoy.wave_direction,
          wave_period: buoy.wave_period,
          computed_at: computedAt,
        });
      }
    }

    // Clear old grid and insert new
    const { error: deleteError } = await supabase
      .from('wave_grid')
      .delete()
      .lt('computed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    // Insert in batches
    let inserted = 0;
    const batchSize = 100;

    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('wave_grid')
        .upsert(batch, {
          onConflict: 'lat,lon',
          ignoreDuplicates: false,
        });

      if (!insertError) {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      buoyReadings: buoyData.length,
      gridPointsGenerated: gridPoints.length,
      gridPointsInserted: inserted,
      timestamp: computedAt,
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
