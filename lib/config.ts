/**
 * Application configuration
 */

// Supabase Storage URL for GeoJSON data
export const SUPABASE_STORAGE_URL =
  'https://azxmuhckfajyqmwadote.supabase.co/storage/v1/object/public/forecasts';

// Data URLs
export const DATA_URLS = {
  waveData: (forecastHour: number) => {
    const hourStr = forecastHour.toString().padStart(3, '0');
    return `${SUPABASE_STORAGE_URL}/wave-data-f${hourStr}.geojson`;
  },
  buoyObservations: `${SUPABASE_STORAGE_URL}/buoy-observations.geojson`,
};
