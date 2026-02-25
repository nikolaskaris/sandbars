'use client';

import { useEffect, useState } from 'react';
import { MapPin, Star, X, Wind as WindIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  FORECAST_HOURS,
  SwellData,
  WindData,
  WaveFeatureProperties,
  GeoJSONData,
  degreesToCompass,
  parseJsonProperty,
  findNearestFeature,
} from '@/lib/wave-utils';
import { DATA_URLS } from '@/lib/config';
import { isFavorite, addFavorite, removeFavorite, findFavorite } from '@/lib/favorites';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Skeleton from './ui/Skeleton';

interface SpotPanelProps {
  location: { lat: number; lng: number; name: string };
  onClose: () => void;
  onFavoritesChange?: () => void;
}

interface ForecastEntry {
  forecastHour: number;
  validTime: string;
  swells: SwellData[];
  wind: WindData;
  waveHeight: number;
}

interface DayGroup {
  date: string;
  dateLabel: string;
  isToday: boolean;
  entries: ForecastEntry[];
}

function parseValidTime(validTime: string | undefined): Date | null {
  if (!validTime) return null;
  const date = new Date(validTime);
  if (isNaN(date.getTime())) return null;
  return date;
}

function groupByDay(entries: ForecastEntry[]): DayGroup[] {
  const groups: Map<string, ForecastEntry[]> = new Map();

  for (const entry of entries) {
    const date = parseValidTime(entry.validTime);
    if (!date) continue;
    const dateKey = date.toISOString().slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const result: DayGroup[] = [];
  for (const [dateKey, dayEntries] of groups) {
    const date = new Date(dateKey + 'T12:00:00Z');
    const isToday = dateKey === todayKey;
    const dateLabel = isToday
      ? 'Today'
      : date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
    result.push({ date: dateKey, dateLabel, isToday, entries: dayEntries });
  }

  return result;
}

/**
 * Temporary heuristic quality indicator. Will be replaced by the real
 * quality scoring engine in Phase 5. Provides the visual color signal
 * for forecast row left-border scanning.
 */
function heuristicQuality(entry: ForecastEntry): 'poor' | 'fair' | 'good' | 'great' | 'epic' {
  const h = entry.waveHeight;
  const p = entry.swells[0]?.period ?? 0;
  const w = entry.wind?.speed ?? 0;

  let score = 0;

  // Height: sweet spot 1-3m
  if (h >= 1 && h <= 3) score += 30;
  else if (h >= 0.5 && h <= 5) score += 15;

  // Period: longer is better
  if (p >= 12) score += 30;
  else if (p >= 8) score += 15;

  // Wind: lighter is better
  if (w <= 5) score += 30;
  else if (w <= 10) score += 15;
  else if (w >= 15) score -= 10;

  if (score >= 75) return 'epic';
  if (score >= 55) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'poor';
}

const QUALITY_BORDER: Record<string, string> = {
  epic: 'border-l-quality-epic',
  great: 'border-l-quality-great',
  good: 'border-l-quality-good',
  fair: 'border-l-quality-fair',
  poor: 'border-l-quality-poor',
};

export default function SpotPanel({ location, onClose, onFavoritesChange }: SpotPanelProps) {
  const [forecasts, setForecasts] = useState<ForecastEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'half' | 'full'>('half');
  const [saved, setSaved] = useState(() => isFavorite(location.lat, location.lng));
  const [toast, setToast] = useState<string | null>(null);

  const handleToggleFavorite = () => {
    if (saved) {
      const fav = findFavorite(location.lat, location.lng);
      if (fav) removeFavorite(fav.id);
      setSaved(false);
      setToast('Removed');
    } else {
      addFavorite({
        id: crypto.randomUUID(),
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        createdAt: new Date().toISOString(),
      });
      setSaved(true);
      setToast('Saved!');
    }
    onFavoritesChange?.();
    setTimeout(() => setToast(null), 2000);
  };

  // Prevent body scroll when sheet is fully expanded on mobile
  useEffect(() => {
    if (isMobile && sheetHeight === 'full') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, sheetHeight]);

  const getSheetHeightPercent = () => {
    switch (sheetHeight) {
      case 'collapsed': return 15;
      case 'half': return 45;
      case 'full': return 90;
    }
  };

  const handleDragHandleTap = () => {
    setSheetHeight(prev => {
      if (prev === 'collapsed') return 'half';
      if (prev === 'half') return 'full';
      return 'collapsed';
    });
  };

  // Fetch all forecast hours
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setForecasts([]);
    setProgress(0);
    setLoading(true);
    setError(null);

    const entries: ForecastEntry[] = [];
    let completed = 0;

    Promise.all(
      FORECAST_HOURS.map(async (hour) => {
        try {
          const url = DATA_URLS.waveData(hour);
          const res = await fetch(url, { signal });
          if (!res.ok) return null;

          const data: GeoJSONData<WaveFeatureProperties> = await res.json();
          const feature = findNearestFeature(data, location.lat, location.lng);

          if (feature && data.metadata) {
            const swells = parseJsonProperty<SwellData[]>(feature.properties.swells);
            const wind = parseJsonProperty<WindData>(feature.properties.wind);

            const entry: ForecastEntry = {
              forecastHour: hour,
              validTime: data.metadata.valid_time,
              swells: swells || [],
              wind: wind || { speed: 0, direction: 0 },
              waveHeight: feature.properties.waveHeight,
            };
            entries.push(entry);
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return null;
          // Skip individual failures
        } finally {
          completed++;
          if (!signal.aborted) {
            setProgress(completed);
          }
        }
        return null;
      })
    ).then(() => {
      if (signal.aborted) return;
      entries.sort((a, b) => a.forecastHour - b.forecastHour);
      setForecasts(entries);
      setLoading(false);
      if (entries.length === 0) {
        setError('No forecast data available for this location');
      }
    });

    return () => controller.abort();
  }, [location.lat, location.lng]);

  const days = groupByDay(forecasts);
  const progressPct = (progress / FORECAST_HOURS.length) * 100;

  return (
    <div
      data-testid="spot-panel"
      className={
        isMobile
          ? 'fixed bottom-0 left-0 right-0 bg-surface rounded-t-lg shadow-lg z-[1000] flex flex-col overflow-hidden transition-[height] duration-300 ease-out'
          : 'absolute top-0 right-0 h-full w-[420px] bg-surface shadow-lg z-20 flex flex-col'
      }
      style={isMobile ? { height: `${getSheetHeightPercent()}vh` } : undefined}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div
          onClick={handleDragHandleTap}
          className="py-3 cursor-pointer flex justify-center shrink-0"
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
      )}

      {/* Header */}
      <div
        className={[
          'bg-surface border-b border-border flex justify-between items-center shrink-0 z-[1]',
          isMobile ? 'relative px-4 pb-3' : 'sticky top-0 px-5 py-4',
        ].join(' ')}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-text-tertiary shrink-0" strokeWidth={1.5} />
            <span className="text-lg font-medium text-text-primary truncate">{location.name}</span>
          </div>
          <div className="text-sm text-text-secondary mt-0.5">16-Day Forecast</div>
        </div>
        <Button
          data-testid="save-favorite-button"
          variant={saved ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleToggleFavorite}
          className="mr-2 shrink-0"
        >
          <Star
            className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`}
            strokeWidth={1.5}
          />
          {saved ? 'Saved' : 'Save'}
        </Button>
        <IconButton
          data-testid="spot-panel-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Toast */}
      {toast && (
        <div className="px-5 py-2 bg-success/15 border-b border-success/30 text-success text-sm font-medium text-center">
          {toast}
        </div>
      )}

      {/* Loading progress */}
      {loading && (
        <div className="px-5 py-4 shrink-0">
          <div className="h-1 bg-border rounded-sm overflow-hidden mb-2">
            <div
              className="h-full bg-accent rounded-sm transition-[width] duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-text-tertiary tabular-nums mb-4">
            Loading {progress} of {FORECAST_HOURS.length} forecast hours
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-14 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="px-5 py-4 text-error text-sm">
          {error}
        </div>
      )}

      {/* Forecast list */}
      <div
        data-testid="forecast-list"
        className="flex-1 overflow-y-auto px-5 pb-5"
      >
        {days.map((day) => (
          <div key={day.date} data-testid="forecast-day" className="mt-4">
            {/* Day header */}
            <div
              className={[
                'text-sm font-medium pb-2 border-b border-border mb-1',
                day.isToday ? 'text-accent' : 'text-text-primary',
              ].join(' ')}
            >
              {day.dateLabel}
            </div>

            {/* Entries for this day */}
            <div className="flex flex-col">
              {day.entries.map((entry) => {
                const primarySwell = entry.swells[0];
                const parsedTime = parseValidTime(entry.validTime);
                const timeStr = parsedTime
                  ? parsedTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : `+${entry.forecastHour}h`;

                const quality = heuristicQuality(entry);

                return (
                  <div
                    key={entry.forecastHour}
                    className={`flex items-start gap-3 py-2 px-3 border-l-[3px] hover:bg-surface-secondary transition-colors duration-100 ${QUALITY_BORDER[quality]}`}
                  >
                    {/* Time */}
                    <div className="text-sm font-medium text-text-primary tabular-nums w-[70px] shrink-0">
                      {timeStr}
                    </div>

                    {/* Wave + swell details */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-medium text-text-primary tabular-nums">
                          {entry.waveHeight}m
                        </span>
                        {primarySwell && (
                          <span className="text-sm text-text-secondary tabular-nums">
                            @ {primarySwell.period}s {degreesToCompass(primarySwell.direction)}
                          </span>
                        )}
                      </div>

                      {/* Secondary swells */}
                      {entry.swells.length > 1 && (
                        <div className="text-xs text-text-tertiary tabular-nums">
                          {entry.swells.slice(1).map((s, i) => (
                            <div key={i}>
                              + {s.height}m @ {s.period}s {degreesToCompass(s.direction)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Wind */}
                    {entry.wind && entry.wind.speed != null && (
                      <div className="flex items-center gap-1 text-sm text-text-secondary tabular-nums ml-auto shrink-0">
                        <WindIcon className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />
                        {entry.wind.speed} m/s
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
