import { NextResponse } from 'next/server';
import { fetchNDBCBuoyData } from '@/lib/forecast/sources/ndbc';

export const revalidate = 1800; // Cache for 30 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Buoy ID is required' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchNDBCBuoyData(id);

    if (!data) {
      return NextResponse.json(
        { error: 'No data available for this buoy', data: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch buoy data', data: null },
      { status: 500 }
    );
  }
}
