import { createClient } from '@/lib/supabase/server';
import { getSurfForecast } from '@/lib/noaa';
import { NextResponse } from 'next/server';

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

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const forecast = await getSurfForecast(lat, lng);

    return NextResponse.json(forecast);
  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
