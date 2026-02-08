'use client';

import { useEffect, useState } from 'react';
import { getFavorites, removeFavorite, Favorite } from '@/lib/favorites';
import {
  SwellData,
  WindData,
  WaveFeatureProperties,
  GeoJSONData,
  GeoJSONFeature,
  degreesToCompass,
  parseJsonProperty,
} from '@/lib/wave-utils';
import { DATA_URLS } from '@/lib/config';

interface FavoritesPageProps {
  onViewSpot: (lat: number, lng: number, name: string) => void;
  onFavoritesChange?: () => void;
}

interface FavoriteConditions {
  waveHeight: number;
  swellSummary: string;
  windSummary: string;
}

function findNearestFeature(
  geojson: GeoJSONData<WaveFeatureProperties>,
  lat: number,
  lng: number
): GeoJSONFeature<WaveFeatureProperties> | null {
  let nearest: GeoJSONFeature<WaveFeatureProperties> | null = null;
  let minDist = Infinity;

  for (const feature of geojson.features) {
    const [fLng, fLat] = feature.geometry.coordinates;
    const dx = fLng - lng;
    const dy = fLat - lat;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      nearest = feature;
    }
  }

  return nearest;
}

export default function FavoritesPage({ onViewSpot, onFavoritesChange }: FavoritesPageProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [conditions, setConditions] = useState<Map<string, FavoriteConditions>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const favs = getFavorites();
    setFavorites(favs);

    if (favs.length === 0) {
      setLoading(false);
      return;
    }

    fetch(DATA_URLS.waveData(0), { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: GeoJSONData<WaveFeatureProperties>) => {
        const condMap = new Map<string, FavoriteConditions>();

        for (const fav of favs) {
          const feature = findNearestFeature(data, fav.lat, fav.lng);
          if (feature) {
            const swells = parseJsonProperty<SwellData[]>(feature.properties.swells);
            const wind = parseJsonProperty<WindData>(feature.properties.wind);
            const primary = swells?.[0];

            condMap.set(fav.id, {
              waveHeight: feature.properties.waveHeight,
              swellSummary: primary
                ? `${primary.height}m @ ${primary.period}s from ${degreesToCompass(primary.direction)}`
                : 'No swell data',
              windSummary: wind?.speed != null
                ? `${wind.speed} m/s ${degreesToCompass(wind.direction)}`
                : 'No wind data',
            });
          }
        }

        setConditions(condMap);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load conditions for favorites:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavorites(prev => prev.filter(f => f.id !== id));
    onFavoritesChange?.();
  };

  return (
    <div
      data-testid="favorites-page"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
        background: '#f9fafb',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          background: 'white',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20, color: '#1a1a1a' }}>Favorites</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          {favorites.length} saved {favorites.length === 1 ? 'spot' : 'spots'}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '24px', color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
          Loading conditions...
        </div>
      )}

      {/* Empty state */}
      {!loading && favorites.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9734;</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            No favorites yet
          </div>
          <div style={{ fontSize: 14 }}>
            Search for a spot on the map and save it to see it here.
          </div>
        </div>
      )}

      {/* Favorites grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {favorites.map(fav => {
          const cond = conditions.get(fav.id);

          return (
            <div
              key={fav.id}
              data-testid="favorite-item"
              style={{
                background: 'white',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: '#1a1a1a' }}>
                {fav.name}
              </div>

              {cond ? (
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 16 }}>
                      {cond.waveHeight}m
                    </span>
                    {' '}{cond.swellSummary}
                  </div>
                  <div>Wind: {cond.windSummary}</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                  {loading ? 'Loading...' : 'No conditions available'}
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onViewSpot(fav.lat, fav.lng, fav.name)}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  View on Map
                </button>
                <button
                  onClick={() => handleRemove(fav.id)}
                  style={{
                    background: 'none',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
