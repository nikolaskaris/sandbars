'use client';

import { useEffect, useState } from 'react';
import { MapPin, Star, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { convertWaveHeight, convertWindSpeed } from '@/lib/preferences';
import { favoritesService, type Favorite } from '@/lib/favorites-service';
import {
  getRecommendations,
  formatRecommendation,
  formatTimeWindow,
  type SessionRecommendation,
  type SpotForecast,
} from '@/lib/recommendation';
import { scoreColor } from '@/lib/quality';
import { shortConditionsSummary } from '@/lib/summary';
import QualitySparkline from './QualitySparkline';
import { useIsMobile } from '@/hooks/useIsMobile';
import Skeleton from './ui/Skeleton';

interface DashboardProps {
  onViewSpot: (lat: number, lng: number, name: string) => void;
  onNavigateToMap: () => void;
}

export default function Dashboard({ onViewSpot, onNavigateToMap }: DashboardProps) {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [topRec, setTopRec] = useState<SessionRecommendation | null>(null);
  const [spotForecasts, setSpotForecasts] = useState<SpotForecast[]>([]);
  const [hasFavorites, setHasFavorites] = useState(true); // assume true to avoid empty flash

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const favorites = await favoritesService.getFavorites(user?.id || null);

      if (cancelled) return;
      setHasFavorites(favorites.length > 0);

      if (favorites.length === 0) {
        setLoading(false);
        return;
      }

      setProgress({ done: 0, total: favorites.length });

      const result = await getRecommendations(
        favorites,
        1,
        undefined,
        (done, total) => {
          if (!cancelled) setProgress({ done, total });
        }
      );

      if (cancelled) return;

      setSpotForecasts(result.spotForecasts);
      setTopRec(result.recommendations[0] || null);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  // Sort spots: best current score first
  const sortedSpots = [...spotForecasts].sort((a, b) => {
    const aScore = a.currentScore?.score ?? 0;
    const bScore = b.currentScore?.score ?? 0;
    return bScore - aScore;
  });

  return (
    <div className={
      isMobile
        ? 'fixed inset-0 bottom-16 bg-background overflow-y-auto z-40 pb-safe'
        : 'absolute inset-0 bg-background overflow-y-auto z-40'
    }>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <h1 className="text-xl font-semibold text-text-primary mb-1">Sandbars</h1>
        <p className="text-sm text-text-tertiary mb-6">Your surf forecast</p>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-lg" />
            <div className="text-xs text-text-tertiary text-center tabular-nums">
              Loading forecasts... {progress.done}/{progress.total}
            </div>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasFavorites && (
          <div className="text-center py-12">
            <Star className="h-10 w-10 text-text-tertiary mx-auto mb-3" strokeWidth={1} />
            <div className="text-text-secondary font-medium mb-1">No saved spots yet</div>
            <div className="text-sm text-text-tertiary mb-4">
              Tap anywhere on the map and save a spot to see your forecast here.
            </div>
            <button
              onClick={onNavigateToMap}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              Open Map →
            </button>
          </div>
        )}

        {/* Top recommendation */}
        {!loading && topRec && (
          <button
            onClick={() => onViewSpot(topRec.spot.lat, topRec.spot.lng, topRec.spot.name)}
            className="w-full text-left bg-surface rounded-xl border border-border p-4 mb-6 hover:bg-surface-secondary transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-xs font-medium text-accent uppercase tracking-wider">Best bet</div>
              <div
                className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
                style={{ color: scoreColor(topRec.peakScore), backgroundColor: scoreColor(topRec.peakScore) + '18' }}
              >
                {topRec.peakScore.toFixed(1)}
              </div>
            </div>
            <div className="text-base font-medium text-text-primary mb-1">
              {topRec.spot.name} {formatTimeWindow(topRec)}
            </div>
            <div className="text-sm text-text-secondary">
              {formatRecommendation(topRec, prefs.waveUnit)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-accent font-medium">
              View forecast <ChevronRight className="h-3 w-3" />
            </div>
          </button>
        )}

        {/* Spot cards */}
        {!loading && sortedSpots.length > 0 && (
          <>
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
              Your Spots
            </div>
            <div className="space-y-2">
              {sortedSpots.map((sf) => {
                const score = sf.currentScore;
                const firstHour = sf.forecast.hours[0];
                const conditionsStr = firstHour
                  ? shortConditionsSummary(firstHour, sf.spotMeta, prefs)
                  : '';
                const heightStr = firstHour
                  ? `${convertWaveHeight(firstHour.waves.height, prefs.waveUnit)}${prefs.waveUnit}`
                  : '';
                const bestNote = sf.bestWindow
                  ? `best ${formatTimeWindow(sf.bestWindow)}`
                  : '';

                return (
                  <button
                    key={sf.spot.id}
                    onClick={() => onViewSpot(sf.spot.lat, sf.spot.lng, sf.spot.name)}
                    className="w-full text-left bg-surface rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {score && (
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: scoreColor(score.score) }}
                          />
                        )}
                        <span className="text-sm font-medium text-text-primary truncate">
                          {sf.spot.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-text-primary tabular-nums shrink-0 ml-2">
                        {heightStr}
                      </span>
                    </div>

                    <div className="text-xs text-text-tertiary mb-2">
                      {conditionsStr}
                    </div>

                    <QualitySparkline scores={sf.qualityScores} width={isMobile ? 280 : 320} height={14} />

                    <div className="text-[10px] text-text-tertiary mt-1.5">
                      {bestNote}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Add spots link */}
            <button
              onClick={onNavigateToMap}
              className="flex items-center gap-1.5 mt-4 text-xs text-text-tertiary hover:text-text-secondary"
            >
              <Plus className="h-3 w-3" /> Add more spots
            </button>
          </>
        )}
      </div>
    </div>
  );
}
