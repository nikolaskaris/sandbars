// =============================================================================
// Spot Catalog — search, lookup, and create surf spots
// =============================================================================

import { createClient } from '@/lib/supabase/client';

export interface Spot {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  region: string | null;
  country: string | null;
  source: string;
  metadata: Record<string, unknown>;
  // Surf metadata
  facing_direction: number | null;
  break_type: string | null;
  optimal_swell_dir_min: number | null;
  optimal_swell_dir_max: number | null;
  optimal_wave_height_min: number | null;
  optimal_wave_height_max: number | null;
  optimal_wave_period_min: number | null;
  optimal_wave_period_max: number | null;
  optimal_tide: string | null;
}

/**
 * Search spots by name (fuzzy ILIKE match).
 */
export async function searchSpots(query: string, limit = 10): Promise<Spot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Spot search error:', error);
    return [];
  }
  return data || [];
}

/**
 * Get a spot by its URL slug.
 */
export async function getSpotBySlug(slug: string): Promise<Spot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get a spot by UUID.
 */
export async function getSpotById(id: string): Promise<Spot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

/**
 * Find the nearest spot to a lat/lng within a radius (in degrees).
 * ~0.01 degrees ≈ 1km at the equator.
 */
export async function findNearestSpot(
  lat: number,
  lng: number,
  radiusDeg = 0.01,
): Promise<Spot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .gte('latitude', lat - radiusDeg)
    .lte('latitude', lat + radiusDeg)
    .gte('longitude', lng - radiusDeg)
    .lte('longitude', lng + radiusDeg)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0];
}

/**
 * Find nearby catalog spots within a radius, sorted by distance.
 * Returns up to `limit` spots.
 */
export async function findNearbySpots(
  lat: number,
  lng: number,
  radiusDeg = 2,
  limit = 5,
): Promise<Spot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .gte('latitude', lat - radiusDeg)
    .lte('latitude', lat + radiusDeg)
    .gte('longitude', lng - radiusDeg)
    .lte('longitude', lng + radiusDeg)
    .limit(50);

  if (error || !data || data.length === 0) return [];

  // Sort by distance and return top N
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return data
    .map((spot) => ({
      spot,
      dist:
        (spot.latitude - lat) ** 2 +
        ((spot.longitude - lng) * cosLat) ** 2,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map(({ spot }) => spot);
}

/**
 * Create a user-submitted custom spot.
 */
export async function createCustomSpot(
  name: string,
  latitude: number,
  longitude: number,
  userId: string,
): Promise<Spot | null> {
  const supabase = createClient();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data, error } = await supabase
    .from('spots')
    .insert({
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      latitude,
      longitude,
      source: 'user',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Create spot error:', error);
    return null;
  }
  return data;
}

// =============================================================================
// Quality Scoring Helpers
// =============================================================================

/**
 * Check if a swell direction falls within a spot's optimal window.
 * Handles wraparound (e.g., min=300, max=60 crosses north).
 * swellDir is in meteorological convention: direction swell comes FROM.
 */
export function isSwellDirOptimal(
  swellDir: number,
  optMin: number | null,
  optMax: number | null,
): boolean {
  if (optMin === null || optMax === null) return true;
  if (optMin <= optMax) {
    return swellDir >= optMin && swellDir <= optMax;
  }
  // Wraps around 0° (north)
  return swellDir >= optMin || swellDir <= optMax;
}

/**
 * Check if a wave height falls within a spot's optimal range.
 * height is in meters (significant wave height Hs).
 */
export function isHeightOptimal(
  height: number,
  optMin: number | null,
  optMax: number | null,
): boolean {
  if (optMin === null || optMax === null) return true;
  return height >= optMin && height <= optMax;
}

/**
 * Check if a wave period falls within a spot's optimal range.
 * period is in seconds (peak period Tp).
 */
export function isPeriodOptimal(
  period: number,
  optMin: number | null,
  optMax: number | null,
): boolean {
  if (optMin === null || optMax === null) return true;
  return period >= optMin && period <= optMax;
}
