import { NextResponse } from 'next/server';
import {
  fetchNDBCStationList,
  getAllStationsForMap,
} from '@/lib/forecast/sources/ndbc-stations';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    // Fetch all stations directly from NDBC for complete global coverage
    // This includes buoys, C-MAN stations, DART tsunami buoys, TAO/PIRATA, etc.
    const allStations = await fetchNDBCStationList();
    const mapStations = getAllStationsForMap(allStations);

    return NextResponse.json({
      stations: mapStations,
      count: mapStations.length,
      source: 'ndbc_direct',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Try NDBC fallback on any error
    try {
      const allStations = await fetchNDBCStationList();
      const mapStations = getAllStationsForMap(allStations);

      return NextResponse.json({
        stations: mapStations,
        count: mapStations.length,
        source: 'ndbc_fallback',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch stations', stations: [] },
        { status: 500 }
      );
    }
  }
}
