import { NextResponse } from 'next/server';
import { fetchGFSWindGrid } from '@/lib/forecast/sources/gfs';
import { getCachedWindData, getCachedModelRun, hasCachedForecastData } from '@/lib/forecast/cached-data';

export const revalidate = 300; // Cache for 5 minutes

interface WindGridPoint {
  lat: number;
  lon: number;
  u: number;
  v: number;
  speed?: number;
  direction?: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const minLat = parseFloat(searchParams.get('minLat') || '-77.5');
  const maxLat = parseFloat(searchParams.get('maxLat') || '77.5');
  const minLon = parseFloat(searchParams.get('minLon') || '-180');
  const maxLon = parseFloat(searchParams.get('maxLon') || '180');
  const forecastHour = parseInt(searchParams.get('forecastHour') || '0');

  // Check for cached forecast data (for testing forecast slider)
  if (hasCachedForecastData()) {
    const cachedData = getCachedWindData(forecastHour);
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

  try {
    const response = await fetchGFSWindGrid(forecastHour, { minLat, maxLat, minLon, maxLon });

    if (response && response.points.length > 0) {
      const gridPoints: WindGridPoint[] = response.points.map(point => ({
        lat: point.lat,
        lon: point.lon,
        u: point.u,
        v: point.v,
        speed: point.speed,
        direction: point.direction,
      }));

      return NextResponse.json({
        grid: gridPoints,
        pointCount: gridPoints.length,
        source: response.source,
        modelRun: response.modelRun,
        forecastHour: response.forecastHour,
        bounds: { minLat, maxLat, minLon, maxLon },
        timestamp: response.fetchedAt,
      });
    }

    // Return empty grid if no data
    return NextResponse.json({
      grid: [],
      pointCount: 0,
      source: 'none',
      bounds: { minLat, maxLat, minLon, maxLon },
      timestamp: new Date().toISOString(),
      error: 'No wind data available',
    });

  } catch (error) {
    console.error('Error fetching wind grid:', error);

    return NextResponse.json({
      error: 'Failed to fetch wind data',
      grid: [],
      pointCount: 0,
    }, { status: 500 });
  }
}
