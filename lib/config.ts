/**
 * Application configuration
 */

// Supabase project URL (env var with hardcoded fallback)
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://azxmuhckfajyqmwadote.supabase.co';

// Supabase Storage URL for GeoJSON data
export const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/forecasts`;

// Current month for tide grid files
const TIDE_MONTH = new Date().toISOString().slice(0, 7); // "YYYY-MM"

// Data URLs
export const DATA_URLS = {
  waveData: (forecastHour: number) => {
    const hourStr = forecastHour.toString().padStart(3, '0');
    return `${SUPABASE_STORAGE_URL}/wave-data-f${hourStr}.geojson`;
  },
  buoyObservations: `${SUPABASE_STORAGE_URL}/buoy-observations.geojson`,
  bathymetryPmtiles: `${SUPABASE_STORAGE_URL}/bathymetry-contours.pmtiles`,
  tideGridHeader: `/data/tides-${TIDE_MONTH}-header.json`,
  tideGridData: `/data/tides-${TIDE_MONTH}.bin`,
};
