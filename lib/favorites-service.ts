// =============================================================================
// Unified Favorites Service — Supabase for logged-in, localStorage for anonymous
// =============================================================================

import { createClient } from '@/lib/supabase/client';
import { findNearestSpot, createCustomSpot } from '@/lib/spots';

// Re-export the Favorite interface (keeps lat/lng for backward compat)
export interface Favorite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  spotId?: string;
  slug?: string;
  region?: string;
  country?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// localStorage backend (anonymous users)
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'sandbars_favorites';

function getLocalFavorites(): Favorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalFavorites(favs: Favorite[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(favs));
}

function clearLocalFavorites() {
  localStorage.removeItem(LOCAL_KEY);
}

// ---------------------------------------------------------------------------
// Supabase backend (logged-in users)
// ---------------------------------------------------------------------------

interface SupabaseFavoriteRow {
  spot_id: string;
  custom_name: string | null;
  created_at: string;
  spots: {
    id: string;
    name: string;
    slug: string;
    latitude: number;
    longitude: number;
    region: string | null;
    country: string | null;
  };
}

async function getSupabaseFavorites(userId: string): Promise<Favorite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_favorites')
    .select('spot_id, custom_name, created_at, spots (id, name, slug, latitude, longitude, region, country)')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('Error fetching favorites:', error);
    return [];
  }

  return (data as unknown as SupabaseFavoriteRow[]).map((row) => ({
    id: row.spots.id,
    spotId: row.spots.id,
    name: row.custom_name || row.spots.name,
    slug: row.spots.slug,
    lat: row.spots.latitude,
    lng: row.spots.longitude,
    region: row.spots.region ?? undefined,
    country: row.spots.country ?? undefined,
    createdAt: row.created_at,
  }));
}

async function renameSupabaseFavorite(userId: string, spotId: string, customName: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('user_favorites')
    .update({ custom_name: customName })
    .eq('user_id', userId)
    .eq('spot_id', spotId);

  if (error) {
    console.error('Error renaming favorite:', error);
    return false;
  }
  return true;
}

async function addSupabaseFavorite(userId: string, spotId: string, customName?: string): Promise<boolean> {
  const supabase = createClient();
  const row: Record<string, unknown> = { user_id: userId, spot_id: spotId };
  if (customName) row.custom_name = customName;

  const { error } = await supabase
    .from('user_favorites')
    .upsert(row);

  if (error) {
    console.error('Error adding favorite:', error);
    return false;
  }
  return true;
}

async function removeSupabaseFavorite(userId: string, spotId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('spot_id', spotId);

  if (error) {
    console.error('Error removing favorite:', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Migration: localStorage → Supabase
// ---------------------------------------------------------------------------

async function migrateLocalToSupabase(userId: string): Promise<number> {
  const localFavs = getLocalFavorites();
  if (localFavs.length === 0) return 0;

  let migrated = 0;

  for (const fav of localFavs) {
    // Try to match to a known catalog spot by proximity
    const nearbySpot = await findNearestSpot(fav.lat, fav.lng, 0.01);

    let spotId: string | null = null;

    if (nearbySpot) {
      spotId = nearbySpot.id;
    } else {
      // Create a custom user spot
      const newSpot = await createCustomSpot(fav.name, fav.lat, fav.lng, userId);
      if (newSpot) spotId = newSpot.id;
    }

    if (spotId) {
      const ok = await addSupabaseFavorite(userId, spotId);
      if (ok) migrated++;
    }
  }

  if (migrated > 0) {
    clearLocalFavorites();
  }

  console.log(`Migrated ${migrated}/${localFavs.length} favorites to Supabase`);
  return migrated;
}

// ---------------------------------------------------------------------------
// Unified public API
// ---------------------------------------------------------------------------

export const favoritesService = {
  async getFavorites(userId?: string | null): Promise<Favorite[]> {
    if (userId) return getSupabaseFavorites(userId);
    return getLocalFavorites();
  },

  async addFavorite(
    userId: string | null,
    spot: { name: string; lat: number; lng: number; spotId?: string; customName?: string },
  ): Promise<boolean> {
    if (userId) {
      let spotId = spot.spotId;
      let customName = spot.customName;

      if (!spotId) {
        const nearby = await findNearestSpot(spot.lat, spot.lng, 0.01);
        if (nearby) {
          spotId = nearby.id;
          // If user provided a custom name different from catalog name, store it
          if (spot.customName && spot.customName !== nearby.name) {
            customName = spot.customName;
          }
        } else {
          const newSpot = await createCustomSpot(spot.customName || spot.name, spot.lat, spot.lng, userId);
          if (!newSpot) return false;
          spotId = newSpot.id;
        }
      }

      return addSupabaseFavorite(userId, spotId, customName);
    }

    // Anonymous — localStorage
    const favs = getLocalFavorites();
    const exists = favs.some(
      (f) => Math.abs(f.lat - spot.lat) < 0.001 && Math.abs(f.lng - spot.lng) < 0.001,
    );
    if (!exists) {
      favs.push({
        id: `local-${Date.now()}`,
        name: spot.customName || spot.name,
        lat: spot.lat,
        lng: spot.lng,
        createdAt: new Date().toISOString(),
      });
      setLocalFavorites(favs);
    }
    return true;
  },

  async removeFavorite(userId: string | null, id: string): Promise<boolean> {
    if (userId) return removeSupabaseFavorite(userId, id);
    const favs = getLocalFavorites().filter((f) => f.id !== id);
    setLocalFavorites(favs);
    return true;
  },

  async renameFavorite(userId: string | null, id: string, newName: string): Promise<boolean> {
    if (userId) return renameSupabaseFavorite(userId, id, newName);
    // Anonymous — localStorage
    const favs = getLocalFavorites();
    const fav = favs.find((f) => f.id === id);
    if (fav) {
      fav.name = newName;
      setLocalFavorites(favs);
    }
    return true;
  },

  async isFavorited(userId: string | null, lat: number, lng: number): Promise<boolean> {
    const favs = await this.getFavorites(userId);
    return favs.some(
      (f) => Math.abs(f.lat - lat) < 0.001 && Math.abs(f.lng - lng) < 0.001,
    );
  },

  migrateLocalToSupabase,
};
