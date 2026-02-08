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

interface FavoritesPanelProps {
  onClose: () => void;
  onViewSpot: (lat: number, lng: number, name: string) => void;
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

export default function FavoritesPanel({ onClose, onViewSpot }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [conditions, setConditions] = useState<Map<string, FavoriteConditions>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 640px)').matches);
    check();
    const mql = window.matchMedia('(max-width: 640px)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  // Load favorites and fetch current conditions (f000)
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
  };

  return (
    <div
      data-testid="favorites-panel"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: isMobile ? '100%' : 400,
        background: 'white',
        boxShadow: '-2px 0 12px rgba(0,0,0,0.15)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 16 }}>Favorites</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#666',
            padding: '4px 8px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          aria-label="Close favorites"
        >
          ✕
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px', color: '#666', fontSize: 13, textAlign: 'center' }}>
          Loading conditions...
        </div>
      )}

      {/* Empty state */}
      {!loading && favorites.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#9734;</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No favorites yet.</div>
          <div style={{ fontSize: 13 }}>Search for a spot to add.</div>
        </div>
      )}

      {/* Favorites list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {favorites.map(fav => {
          const cond = conditions.get(fav.id);

          return (
            <div
              key={fav.id}
              data-testid="favorite-item"
              style={{
                padding: '14px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {fav.name}
              </div>

              {cond ? (
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                  <div>
                    <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{cond.waveHeight}m</span>
                    {' '}{cond.swellSummary}
                  </div>
                  <div>Wind: {cond.windSummary}</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#999' }}>
                  {loading ? 'Loading...' : 'No conditions available'}
                </div>
              )}

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onViewSpot(fav.lat, fav.lng, fav.name)}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => handleRemove(fav.id)}
                  style={{
                    background: 'none',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: 12,
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
