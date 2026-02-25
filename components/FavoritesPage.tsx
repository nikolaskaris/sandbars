'use client';

import { useEffect, useState } from 'react';
import { Star, MapPin, Wind, Trash2 } from 'lucide-react';
import { getFavorites, removeFavorite, Favorite } from '@/lib/favorites';
import {
  SwellData,
  WindData,
  WaveFeatureProperties,
  GeoJSONData,
  degreesToCompass,
  parseJsonProperty,
  findNearestFeature,
} from '@/lib/wave-utils';
import { DATA_URLS } from '@/lib/config';
import Card from './ui/Card';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';

interface FavoritesPageProps {
  onViewSpot: (lat: number, lng: number, name: string) => void;
  onFavoritesChange?: () => void;
}

interface FavoriteConditions {
  waveHeight: number;
  swellSummary: string;
  windSummary: string;
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
      className="h-full flex flex-col bg-background"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-text-tertiary" strokeWidth={1.5} />
          <span className="text-xl font-medium text-text-primary">Favorites</span>
        </div>
        <div className="text-sm text-text-secondary mt-1">
          {favorites.length} saved {favorites.length === 1 ? 'spot' : 'spots'}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 content-start">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-9 w-28 rounded" />
                  <Skeleton className="h-9 w-9 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && favorites.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <Star className="h-12 w-12 text-text-tertiary mb-4" strokeWidth={1} />
          <div className="text-base font-medium text-text-primary mb-2">
            No favorites yet
          </div>
          <div className="text-sm text-text-secondary text-center max-w-[280px]">
            Search for a spot on the map and save it to see conditions here.
          </div>
        </div>
      )}

      {/* Favorites grid */}
      {!loading && favorites.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 content-start">
          {favorites.map(fav => {
            const cond = conditions.get(fav.id);

            return (
              <Card key={fav.id} data-testid="favorite-item">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
                  <span className="text-base font-medium text-text-primary">{fav.name}</span>
                </div>

                {cond ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-medium text-text-primary tabular-nums">
                        {cond.waveHeight}m
                      </span>
                      <span className="text-sm text-text-secondary">{cond.swellSummary}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Wind className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                      {cond.windSummary}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-text-tertiary">
                    No conditions available
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => onViewSpot(fav.lat, fav.lng, fav.name)}
                  >
                    View on Map
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(fav.id)}
                    className="text-text-tertiary hover:text-error"
                    aria-label={`Remove ${fav.name}`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
