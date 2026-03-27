'use client';

import { useEffect, useState } from 'react';
import { MapPin, Star, X, Wind as WindIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePreferences } from '@/contexts/PreferencesContext';
import { convertWaveHeight, convertWindSpeed, convertTemp, tempUnitLabel } from '@/lib/preferences';
import { FORECAST_HOURS, degreesToCompass } from '@/lib/wave-utils';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesService } from '@/lib/favorites-service';
import { TideAtPoint } from '@/lib/tides';
import { getFullForecast, ForecastAtPoint, ForecastSummary } from '@/lib/forecast';
import { findNearbySpots, findNearestSpot, Spot } from '@/lib/spots';
import { computeQuality, scoreToBorderClass, scoreColor } from '@/lib/quality';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Skeleton from './ui/Skeleton';

interface SpotPanelProps {
  location: { lat: number; lng: number; name: string; isLand?: boolean };
  onClose: () => void;
  onFavoritesChange?: () => void;
  onSelectSpot?: (lat: number, lng: number, name: string) => void;
}

// ForecastAtPoint from lib/forecast.ts is used as the entry type

interface TideCurvePoint {
  time: Date;
  height: number;
}

interface DayGroup {
  date: string;
  dateLabel: string;
  isToday: boolean;
  entries: ForecastAtPoint[];
}

function parseValidTime(validTime: string | undefined): Date | null {
  if (!validTime) return null;
  const date = new Date(validTime);
  if (isNaN(date.getTime())) return null;
  return date;
}

function groupByDay(entries: ForecastAtPoint[]): DayGroup[] {
  const groups: Map<string, ForecastAtPoint[]> = new Map();

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

// Quality scoring is in lib/quality.ts — uses spot metadata for per-spot tuning

const TIDE_STATE_ARROW: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  high: '⬆',
  low: '⬇',
};

const TIDE_STATE_LABEL: Record<string, string> = {
  rising: 'Rising',
  falling: 'Falling',
  high: 'High',
  low: 'Low',
};

function TideSparkline({
  curve,
  nowMs,
  width = 280,
  height = 50,
}: {
  curve: TideCurvePoint[];
  nowMs: number;
  width?: number;
  height?: number;
}) {
  if (curve.length < 2) return null;

  const minH = Math.min(...curve.map((p) => p.height));
  const maxH = Math.max(...curve.map((p) => p.height));
  const range = maxH - minH || 0.1;
  const padding = 2;
  const plotH = height - padding * 2;
  const plotW = width - padding * 2;

  const startMs = curve[0].time.getTime();
  const endMs = curve[curve.length - 1].time.getTime();
  const timeRange = endMs - startMs || 1;

  const toX = (ms: number) => padding + ((ms - startMs) / timeRange) * plotW;
  const toY = (h: number) => padding + plotH - ((h - minH) / range) * plotH;

  const pathD = curve
    .map((p, i) => {
      const x = toX(p.time.getTime());
      const y = toY(p.height);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Now marker position
  const nowX = toX(nowMs);
  const nowInRange = nowMs >= startMs && nowMs <= endMs;

  // Find tide height at now by linear interpolation on curve
  let nowY = height / 2;
  if (nowInRange) {
    for (let i = 0; i < curve.length - 1; i++) {
      const t0 = curve[i].time.getTime();
      const t1 = curve[i + 1].time.getTime();
      if (nowMs >= t0 && nowMs <= t1) {
        const frac = (nowMs - t0) / (t1 - t0);
        const h = curve[i].height + frac * (curve[i + 1].height - curve[i].height);
        nowY = toY(h);
        break;
      }
    }
  }

  // Hour labels at 6hr intervals
  const hourLabels: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < curve.length; i++) {
    const t = curve[i].time;
    if (t.getMinutes() === 0 && t.getHours() % 6 === 0) {
      hourLabels.push({
        x: toX(t.getTime()),
        label: t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
      });
    }
  }

  return (
    <svg width={width} height={height + 14} className="block">
      {/* Zero line */}
      {minH < 0 && maxH > 0 && (
        <line
          x1={padding}
          y1={toY(0)}
          x2={width - padding}
          y2={toY(0)}
          stroke="#E0D8CC"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
      )}
      {/* Tide curve */}
      <path d={pathD} fill="none" stroke="#B8704C" strokeWidth={1.5} opacity={0.8} />
      {/* Now marker */}
      {nowInRange && (
        <>
          <line
            x1={nowX}
            y1={padding}
            x2={nowX}
            y2={height}
            stroke="#B5ADA4"
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
          <circle cx={nowX} cy={nowY} r={3} fill="#B8704C" />
        </>
      )}
      {/* Hour labels */}
      {hourLabels.map((hl, i) => (
        <text
          key={i}
          x={hl.x}
          y={height + 11}
          textAnchor="middle"
          fontSize={9}
          fill="#B5ADA4"
        >
          {hl.label}
        </text>
      ))}
    </svg>
  );
}

export default function SpotPanel({ location, onClose, onFavoritesChange, onSelectSpot }: SpotPanelProps) {
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const [forecasts, setForecasts] = useState<ForecastAtPoint[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'half' | 'full'>('half');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [currentTide, setCurrentTide] = useState<TideAtPoint | null>(null);
  const [tideCurve, setTideCurve] = useState<TideCurvePoint[] | null>(null);
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [spotMeta, setSpotMeta] = useState<Spot | null>(null);
  const [waterTemp, setWaterTemp] = useState<number | null>(null);
  const [airTemp, setAirTemp] = useState<number | null>(null);

  // Try to find catalog spot metadata for quality scoring
  useEffect(() => {
    if (location.isLand) return;
    let cancelled = false;
    findNearestSpot(location.lat, location.lng, 0.05).then((spot) => {
      if (!cancelled) setSpotMeta(spot);
    });
    return () => { cancelled = true; };
  }, [location.lat, location.lng, location.isLand]);

  // Load nearby spots for land clicks
  useEffect(() => {
    if (!location.isLand) return;
    let cancelled = false;
    findNearbySpots(location.lat, location.lng, 2, 5).then((spots) => {
      if (!cancelled) setNearbySpots(spots);
    });
    return () => { cancelled = true; };
  }, [location.lat, location.lng, location.isLand]);

  // Check if this location is already favorited (async)
  useEffect(() => {
    favoritesService.isFavorited(user?.id || null, location.lat, location.lng).then(setSaved);
  }, [user, location.lat, location.lng]);

  // Detect if this is a custom (non-catalog) spot by checking if name looks like coordinates
  const isCustomSpot = !spotMeta || /^\d/.test(location.name) || location.name.includes('°');

  const handleToggleFavorite = async () => {
    if (saved) {
      const favs = await favoritesService.getFavorites(user?.id || null);
      const fav = favs.find(
        f => Math.abs(f.lat - location.lat) < 0.001 && Math.abs(f.lng - location.lng) < 0.001
      );
      if (fav) await favoritesService.removeFavorite(user?.id || null, fav.id);
      setSaved(false);
      setShowNameInput(false);
      setToast('Removed');
      onFavoritesChange?.();
      setTimeout(() => setToast(null), 2000);
    } else if (isCustomSpot && !showNameInput) {
      // Show name input for custom spots
      setCustomName('');
      setShowNameInput(true);
    } else {
      // Save with custom name (or catalog name)
      await favoritesService.addFavorite(user?.id || null, {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        customName: showNameInput && customName.trim() ? customName.trim() : undefined,
      });
      setSaved(true);
      setShowNameInput(false);
      setToast('Saved!');
      onFavoritesChange?.();
      setTimeout(() => setToast(null), 2000);
    }
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

  // Fetch unified forecast (wave, wind, tide, temps — all in one call)
  useEffect(() => {
    if (location.isLand) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    setForecasts([]);
    setProgress(0);
    setLoading(true);
    setError(null);
    setCurrentTide(null);
    setTideCurve(null);
    setWaterTemp(null);
    setAirTemp(null);

    getFullForecast(
      location.lat,
      location.lng,
      controller.signal,
      (completed) => setProgress(completed)
    ).then((summary) => {
      if (controller.signal.aborted) return;

      // Set current conditions
      setCurrentTide(summary.current.tide);
      setTideCurve(summary.current.tideCurve);
      setWaterTemp(summary.current.waterTemp);
      setAirTemp(summary.current.airTemp);

      // Set per-hour forecasts
      setForecasts(summary.hours);
      setLoading(false);

      if (summary.hours.length === 0) {
        setError('No forecast data available for this location');
      }
    });

    return () => controller.abort();
  }, [location.lat, location.lng, location.isLand]);

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
          {(currentTide || waterTemp != null || airTemp != null) && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-text-tertiary flex-wrap">
              {currentTide && (
                <>
                  <span className="text-text-secondary font-medium tabular-nums">
                    {convertWaveHeight(currentTide.height, prefs.waveUnit).toFixed(1)}{prefs.waveUnit}
                  </span>
                  <span>{TIDE_STATE_ARROW[currentTide.state]} {TIDE_STATE_LABEL[currentTide.state]}</span>
                  {currentTide.nextHigh && (
                    <span>
                      · High {currentTide.nextHigh.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                </>
              )}
              {waterTemp != null && (
                <span>{currentTide ? '·' : ''} Water {convertTemp(waterTemp, prefs.tempUnit)}{tempUnitLabel(prefs.tempUnit)}</span>
              )}
              {airTemp != null && (
                <span>· Air {convertTemp(airTemp, prefs.tempUnit)}{tempUnitLabel(prefs.tempUnit)}</span>
              )}
            </div>
          )}
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

      {/* Name input for custom spots */}
      {showNameInput && (
        <div className="px-5 py-3 border-b border-border bg-surface-secondary shrink-0">
          <label className="text-xs text-text-tertiary mb-1 block">Name this spot</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleToggleFavorite(); }}
              placeholder="My secret spot..."
              autoFocus
              className="flex-1 text-sm px-2.5 py-1.5 rounded border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            />
            <Button size="sm" variant="primary" onClick={handleToggleFavorite}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowNameInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="px-5 py-2 bg-success/15 border-b border-success/30 text-success text-sm font-medium text-center">
          {toast}
        </div>
      )}

      {/* Land mode — no forecast, suggest nearby spots */}
      {location.isLand && (
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="text-center mb-6">
            <div className="text-text-tertiary text-sm mb-1">No surf forecast on land</div>
            <div className="text-text-tertiary text-xs">Try clicking on the ocean, or check out a nearby spot:</div>
          </div>

          {nearbySpots.length > 0 ? (
            <div className="flex flex-col gap-2">
              {nearbySpots.map((spot) => (
                <button
                  key={spot.id}
                  onClick={() => onSelectSpot?.(spot.latitude, spot.longitude, spot.name)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left hover:bg-surface-secondary transition-colors duration-100 border border-border"
                >
                  <MapPin className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{spot.name}</div>
                    {spot.country && (
                      <div className="text-xs text-text-tertiary">{spot.region ? `${spot.region}, ` : ''}{spot.country}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs text-text-tertiary">No surf spots found nearby</div>
          )}
        </div>
      )}

      {/* Tide sparkline */}
      {!location.isLand && tideCurve && tideCurve.length > 2 && (
        <div className="px-5 py-2 border-b border-border shrink-0">
          <TideSparkline
            curve={tideCurve}
            nowMs={Date.now()}
            width={isMobile ? 300 : 380}
            height={45}
          />
        </div>
      )}

      {/* Loading progress */}
      {!location.isLand && loading && (
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
      {!location.isLand && error && !loading && (
        <div className="px-5 py-4 text-error text-sm">
          {error}
        </div>
      )}

      {/* Forecast list */}
      {!location.isLand && <div
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
                const primarySwell = entry.waves.swells[0];
                const parsedTime = parseValidTime(entry.validTime);
                const timeStr = parsedTime
                  ? parsedTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : `+${entry.forecastHour}h`;

                const quality = computeQuality(entry, spotMeta);

                return (
                  <div
                    key={entry.forecastHour}
                    className={`flex items-start gap-3 py-2.5 px-3 border-l-[3px] min-h-[44px] hover:bg-surface-secondary transition-colors duration-100 ${scoreToBorderClass(quality.score)}`}
                  >
                    {/* Time + Score */}
                    <div className="w-[70px] shrink-0">
                      <div className="text-sm font-medium text-text-primary tabular-nums">
                        {timeStr}
                      </div>
                      <div
                        className="text-xs font-medium tabular-nums mt-0.5"
                        style={{ color: scoreColor(quality.score) }}
                        title={`Swell ${quality.sub.swell.toFixed(0)} · Wind ${quality.sub.wind.toFixed(0)} · Period ${quality.sub.period.toFixed(0)} · Tide ${quality.sub.tide.toFixed(0)}`}
                      >
                        {quality.score.toFixed(1)} {quality.label}
                      </div>
                    </div>

                    {/* Wave + swell details */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-medium text-text-primary tabular-nums">
                          {convertWaveHeight(entry.waves.height, prefs.waveUnit)}{prefs.waveUnit}
                        </span>
                        {primarySwell && (
                          <span className="text-sm text-text-secondary tabular-nums">
                            @ {primarySwell.period}s {degreesToCompass(primarySwell.direction)}
                          </span>
                        )}
                      </div>

                      {/* Secondary swells */}
                      {entry.waves.swells.length > 1 && (
                        <div className="text-xs text-text-tertiary tabular-nums">
                          {entry.waves.swells.slice(1).map((s, i) => (
                            <div key={i}>
                              + {convertWaveHeight(s.height, prefs.waveUnit)}{prefs.waveUnit} @ {s.period}s {degreesToCompass(s.direction)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Wind + Tide + Temps (right side) */}
                    <div className="flex flex-col items-end gap-0.5 ml-auto shrink-0">
                      {entry.wind && entry.wind.speed != null && (
                        <div className="flex items-center gap-1 text-sm text-text-secondary tabular-nums">
                          <WindIcon className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />
                          {convertWindSpeed(entry.wind.speed, prefs.windUnit)} {prefs.windUnit}
                        </div>
                      )}
                      {entry.tide && (
                        <div className="flex items-center gap-0.5 text-xs text-text-tertiary tabular-nums">
                          <span>{TIDE_STATE_ARROW[entry.tide.state]}</span>
                          <span>{convertWaveHeight(entry.tide.height, prefs.waveUnit).toFixed(1)}{prefs.waveUnit}</span>
                        </div>
                      )}
                      {entry.airTemp != null && (
                        <div className="text-xs text-text-tertiary tabular-nums">
                          {convertTemp(entry.airTemp, prefs.tempUnit)}{tempUnitLabel(prefs.tempUnit)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
