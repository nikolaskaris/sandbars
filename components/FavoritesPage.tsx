'use client';

import { useEffect, useState } from 'react';
import { Star, MapPin, Wind, Trash2, X, Pencil, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesService, type Favorite } from '@/lib/favorites-service';
import { usePreferences } from '@/contexts/PreferencesContext';
import { convertWaveHeight, convertWindSpeed } from '@/lib/preferences';
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
import { useIsMobile } from '@/hooks/useIsMobile';
import Card from './ui/Card';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Skeleton from './ui/Skeleton';

interface FavoritesPageProps {
  onViewSpot: (lat: number, lng: number, name: string) => void;
  onFavoritesChange?: () => void;
  onClose: () => void;
}

interface FavoriteConditions {
  waveHeight: number;
  swellSummary: string;
  windSummary: string;
}

export default function FavoritesPage({ onViewSpot, onFavoritesChange, onClose }: FavoritesPageProps) {
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [conditions, setConditions] = useState<Map<string, FavoriteConditions>>(new Map());
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      const favs = await favoritesService.getFavorites(user?.id || null);
      if (cancelled) return;
      setFavorites(favs);

      if (favs.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const r = await fetch(DATA_URLS.waveData(0), { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: GeoJSONData<WaveFeatureProperties> = await r.json();
        if (cancelled) return;

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
                ? `${convertWaveHeight(primary.height, prefs.waveUnit)}${prefs.waveUnit} @ ${primary.period}s from ${degreesToCompass(primary.direction)}`
                : 'No swell data',
              windSummary: wind?.speed != null
                ? `${convertWindSpeed(wind.speed, prefs.windUnit)} ${prefs.windUnit} ${degreesToCompass(wind.direction)}`
                : 'No wind data',
            });
          }
        }

        setConditions(condMap);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load conditions for favorites:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, prefs.waveUnit, prefs.windUnit]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleRemove = async (id: string) => {
    await favoritesService.removeFavorite(user?.id || null, id);
    setFavorites(prev => prev.filter(f => f.id !== id));
    onFavoritesChange?.();
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await favoritesService.renameFavorite(user?.id || null, id, trimmed);
    setFavorites(prev => prev.map(f => f.id === id ? { ...f, name: trimmed } : f));
    setEditingId(null);
  };

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Favorites</h2>
          <span className="text-xs text-text-secondary">
            {favorites.length} saved {favorites.length === 1 ? 'spot' : 'spots'}
          </span>
        </div>
        <IconButton aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <Star className="h-10 w-10 text-text-tertiary mb-3" strokeWidth={1} />
          <div className="text-sm font-medium text-text-primary mb-1">
            No favorites yet
          </div>
          <div className="text-xs text-text-secondary text-center max-w-[240px]">
            Click a spot on the map and save it to see conditions here.
          </div>
        </div>
      )}

      {/* Favorites list */}
      {!loading && favorites.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {favorites.map(fav => {
            const cond = conditions.get(fav.id);

            return (
              <Card key={fav.id} data-testid="favorite-item">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
                  {editingId === fav.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(fav.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        className="flex-1 text-sm px-1.5 py-0.5 rounded border border-accent bg-surface text-text-primary focus:outline-none min-w-0"
                      />
                      <button onClick={() => handleRename(fav.id)} className="text-accent hover:text-accent-hover p-0.5">
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-text-primary truncate">{fav.name}</span>
                      <button
                        onClick={() => { setEditingId(fav.id); setEditName(fav.name); }}
                        className="text-text-tertiary hover:text-text-secondary p-0.5 shrink-0"
                        aria-label={`Rename ${fav.name}`}
                      >
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </>
                  )}
                </div>

                {cond ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-medium text-text-primary tabular-nums">
                        {convertWaveHeight(cond.waveHeight, prefs.waveUnit)}{prefs.waveUnit}
                      </span>
                      <span className="text-xs text-text-secondary truncate">{cond.swellSummary}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Wind className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />
                      {cond.windSummary}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-text-tertiary">
                    No conditions available
                  </div>
                )}

                <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => onViewSpot(fav.lat, fav.lng, fav.name)}
                  >
                    View on Map
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-tertiary hover:text-error"
                    onClick={() => handleRemove(fav.id)}
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
    </>
  );

  if (isMobile) {
    return (
      <div
        data-testid="favorites-panel"
        className="fixed bottom-16 left-0 right-0 max-h-[70vh] bg-surface rounded-t-lg shadow-md border-t border-border z-30 flex flex-col animate-slide-in-up"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      data-testid="favorites-panel"
      className="absolute top-0 left-0 bottom-0 w-[340px] bg-surface border-r border-border shadow-md z-30 flex flex-col animate-slide-in-left"
    >
      {content}
    </div>
  );
}
