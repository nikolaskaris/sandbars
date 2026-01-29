import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchWaveWatchGlobalGrid } from '@/lib/forecast/sources/wavewatch';
import { getCachedWaveData, getCachedModelRun, hasCachedForecastData } from '@/lib/forecast/cached-data';

export const revalidate = 0; // Disable caching during development

interface WaveGridPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod?: number;
}

// Fallback: fetch directly from WAVEWATCH III
async function fetchFromWaveWatchDirectly(bounds?: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}): Promise<WaveGridPoint[]> {
  const response = await fetchWaveWatchGlobalGrid(bounds);

  if (!response || response.points.length === 0) {
    return [];
  }

  return response.points.map(point => ({
    lat: point.lat,
    lon: point.lon,
    waveHeight: point.waveHeight,
    waveDirection: point.waveDirection,
    wavePeriod: point.wavePeriod,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const minLat = parseFloat(searchParams.get('minLat') || '-60');
  const maxLat = parseFloat(searchParams.get('maxLat') || '60');
  const minLon = parseFloat(searchParams.get('minLon') || '-180');
  const maxLon = parseFloat(searchParams.get('maxLon') || '180');
  const direct = searchParams.get('direct') === 'true';
  const forecastHour = parseInt(searchParams.get('forecastHour') || '0');

  // Check for cached forecast data (for testing forecast slider)
  // Use cached data for all forecast hours when available
  if (hasCachedForecastData()) {
    const cachedData = getCachedWaveData(forecastHour);
    if (cachedData && cachedData.length > 0) {
      // Filter by bounds if specified
      const filteredData = cachedData.filter(p =>
        p.lat >= minLat && p.lat <= maxLat &&
        p.lon >= minLon && p.lon <= maxLon
      );

      return NextResponse.json({
        grid: filteredData,
        pointCount: filteredData.length,
        source: 'cached_forecast',
        forecastHour,
        modelRun: getCachedModelRun(),
        bounds: { minLat, maxLat, minLon, maxLon },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // If direct=true, bypass database and fetch fresh from WAVEWATCH III
  if (direct) {
    console.log('Direct fetch requested, bypassing database');
    const directData = await fetchFromWaveWatchDirectly({ minLat, maxLat, minLon, maxLon });
    return NextResponse.json({
      grid: directData,
      pointCount: directData.length,
      source: 'wavewatch3_direct',
      bounds: { minLat, maxLat, minLon, maxLon },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = await createClient();

    // Try to get pre-computed grid from database (preferably WAVEWATCH III)
    // Note: Supabase defaults to 1000 rows, we need all points for global coverage
    const { data: gridData, error: gridError } = await supabase
      .from('wave_grid')
      .select('lat, lon, wave_height, wave_direction, wave_period, source, model_run, computed_at')
      .gte('lat', minLat)
      .lte('lat', maxLat)
      .gte('lon', minLon)
      .lte('lon', maxLon)
      .order('computed_at', { ascending: false })
      .limit(10000);

    // If we have data from database, use it
    if (!gridError && gridData && gridData.length > 0) {
      const gridPoints: WaveGridPoint[] = gridData.map(row => ({
        lat: Number(row.lat),
        lon: Number(row.lon),
        waveHeight: Number(row.wave_height),
        waveDirection: Number(row.wave_direction),
        wavePeriod: row.wave_period ? Number(row.wave_period) : undefined,
      }));

      // Determine the source (most common)
      const sources = gridData.map(r => r.source).filter(Boolean);
      const source = sources[0] || 'database';

      return NextResponse.json({
        grid: gridPoints,
        pointCount: gridPoints.length,
        source,
        modelRun: gridData[0]?.model_run,
        bounds: { minLat, maxLat, minLon, maxLon },
        timestamp: gridData[0]?.computed_at || new Date().toISOString(),
      });
    }

    // Fallback: fetch directly from WAVEWATCH III
    console.log('No data in database, fetching from WAVEWATCH III directly...');
    const directData = await fetchFromWaveWatchDirectly({ minLat, maxLat, minLon, maxLon });

    if (directData.length > 0) {
      return NextResponse.json({
        grid: directData,
        pointCount: directData.length,
        source: 'wavewatch3_direct',
        bounds: { minLat, maxLat, minLon, maxLon },
        timestamp: new Date().toISOString(),
      });
    }

    // Return empty grid if all else fails
    return NextResponse.json({
      grid: [],
      pointCount: 0,
      source: 'none',
      bounds: { minLat, maxLat, minLon, maxLon },
      timestamp: new Date().toISOString(),
      error: 'No wave data available',
    });

  } catch (error) {
    console.error('Error fetching wave grid:', error);

    // On any error, try direct WAVEWATCH III fetch
    try {
      const directData = await fetchFromWaveWatchDirectly({ minLat, maxLat, minLon, maxLon });

      return NextResponse.json({
        grid: directData,
        pointCount: directData.length,
        source: 'wavewatch3_fallback',
        bounds: { minLat, maxLat, minLon, maxLon },
        timestamp: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json({
        error: 'Failed to fetch wave data',
        grid: [],
        pointCount: 0,
      }, { status: 500 });
    }
  }
}
