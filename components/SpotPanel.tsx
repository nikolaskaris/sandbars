'use client';

import { useEffect, useState } from 'react';
import {
  FORECAST_HOURS,
  SwellData,
  WindData,
  WaveFeatureProperties,
  ForecastMetadata,
  GeoJSONData,
  GeoJSONFeature,
  degreesToCompass,
  parseJsonProperty,
} from '@/lib/wave-utils';
import { DATA_URLS } from '@/lib/config';
import { isFavorite, addFavorite, removeFavorite, findFavorite } from '@/lib/favorites';

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
  entries: ForecastEntry[];
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

  const result: DayGroup[] = [];
  for (const [dateKey, dayEntries] of groups) {
    const date = new Date(dateKey + 'T12:00:00Z');
    const dateLabel = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    result.push({ date: dateKey, dateLabel, entries: dayEntries });
  }

  return result;
}

export default function SpotPanel({ location, onClose, onFavoritesChange }: SpotPanelProps) {
  const [forecasts, setForecasts] = useState<ForecastEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
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

  // Check for mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 640px)').matches);
    check();
    const mql = window.matchMedia('(max-width: 640px)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

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

  return (
    <div
      data-testid="spot-panel"
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
      {/* Sticky Header */}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{location.name}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            16-Day Forecast
          </div>
        </div>
        <button
          data-testid="save-favorite-button"
          onClick={handleToggleFavorite}
          style={{
            background: saved ? '#fef3c7' : '#f3f4f6',
            border: saved ? '1px solid #f59e0b' : '1px solid #d1d5db',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
            color: saved ? '#92400e' : '#374151',
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
            marginRight: 8,
          }}
        >
          {saved ? 'Remove from Favorites' : 'Save to Favorites'}
        </button>
        <button
          data-testid="spot-panel-close"
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
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            padding: '8px 20px',
            background: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}

      {/* Loading progress */}
      {loading && (
        <div style={{ padding: '16px 20px', color: '#666', fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            Loading forecast data... ({progress}/{FORECAST_HOURS.length})
          </div>
          <div
            style={{
              height: 4,
              background: '#e5e7eb',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(progress / FORECAST_HOURS.length) * 100}%`,
                background: '#3b82f6',
                borderRadius: 2,
                transition: 'width 0.2s',
              }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{ padding: '16px 20px', color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Forecast list */}
      <div
        data-testid="forecast-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px',
        }}
      >
        {days.map((day) => (
          <div key={day.date} data-testid="forecast-day" style={{ marginTop: 16 }}>
            {/* Day header */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a1a',
                paddingBottom: 8,
                borderBottom: '1px solid #e5e7eb',
                marginBottom: 8,
              }}
            >
              {day.dateLabel}
            </div>

            {/* Entries for this day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

                return (
                  <div
                    key={entry.forecastHour}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 8,
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 4,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, minWidth: 70, color: '#333' }}>
                      {timeStr}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Wave height */}
                      <div style={{ color: '#1a1a1a' }}>
                        <span style={{ fontWeight: 600 }}>{entry.waveHeight}m</span>
                        {primarySwell && (
                          <span style={{ color: '#666' }}>
                            {' '}@ {primarySwell.period}s from {degreesToCompass(primarySwell.direction)}
                          </span>
                        )}
                      </div>

                      {/* Wind */}
                      {entry.wind && entry.wind.speed != null && (
                        <div style={{ color: '#666', fontSize: 12 }}>
                          Wind: {entry.wind.speed} m/s from {degreesToCompass(entry.wind.direction)}
                        </div>
                      )}

                      {/* Additional swells */}
                      {entry.swells.length > 1 && (
                        <div style={{ color: '#888', fontSize: 11 }}>
                          {entry.swells.slice(1).map((s, i) => (
                            <div key={i}>
                              + {s.height}m @ {s.period}s from {degreesToCompass(s.direction)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
