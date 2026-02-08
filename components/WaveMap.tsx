'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TimeSlider from './TimeSlider';

// =============================================================================
// Constants & Styling (Issue #11)
// =============================================================================

const COMPASS_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

const LEGEND_STYLES = {
  container: {
    position: 'absolute' as const,
    bottom: 100,
    left: 20,
    background: 'white',
    padding: '12px 16px',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    fontWeight: 600,
    marginBottom: 8,
  },
  gradient: {
    width: 120,
    height: 12,
    borderRadius: 4,
    background: 'linear-gradient(to right, #3b82f6, #eab308, #ef4444)',
    marginBottom: 4,
  },
  labels: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    color: '#666',
    marginBottom: 12,
  },
  toggleLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
  },
  buoyIndicator: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
};

const POPUP_STYLES = {
  container: 'font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4;',
  title: 'font-weight: 600; margin-bottom: 4px; font-size: 14px;',
  subtitle: 'color: #666; margin-bottom: 8px; font-size: 12px;',
  sectionTitle: 'font-weight: 500; color: #666; margin-bottom: 4px;',
  sectionLabel: 'font-weight: 500; color: #666;',
  listItem: 'margin: 4px 0;',
  section: 'margin-bottom: 8px;',
  noData: 'color: #999;',
};

const COLORS = {
  textMuted: '#666',
  error: '#ef4444',
  errorDark: '#b91c1c',
  buoyFill: '#ffffff',
  buoyStroke: '#333333',
};

// =============================================================================
// Type Definitions (Issue #10)
// =============================================================================

interface SwellData {
  height: number;
  period: number;
  direction: number;
}

interface WindData {
  speed: number;
  direction: number;
}

interface WindWaveData {
  height: number;
  period?: number;
  direction?: number;
}

interface WaveFeatureProperties {
  waveHeight: number;
  swells: SwellData[] | string;
  windWaves: WindWaveData | string | null;
  wind: WindData | string;
}

interface BuoyFeatureProperties {
  station_id: string;
  name: string;
  owner: string;
  type: string;
  wave_height: number | null;
  dominant_period: number | null;
  average_period: number | null;
  wave_direction: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  wind_gust: number | null;
  water_temp: number | null;
  air_temp: number | null;
  pressure: number | null;
  observation_time: string | null;
}

interface ForecastMetadata {
  source: string;
  model_run: string;
  forecast_hour: number;
  valid_time: string;
  generated_at: string;
  grid_resolution: string;
  point_count: number;
}

interface GeoJSONFeature<T> {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: T;
}

interface GeoJSONData<T = WaveFeatureProperties> {
  type: string;
  metadata?: ForecastMetadata;
  features: GeoJSONFeature<T>[];
}

type PopupType = 'wave' | 'buoy' | null;

// =============================================================================
// Utility Functions
// =============================================================================

function degreesToCompass(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS_DIRECTIONS[index];
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function parseJsonProperty<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

// =============================================================================
// Popup HTML Builders (Issue #8 - Shared utilities)
// =============================================================================

function wrapPopup(content: string): string {
  return `<div style="${POPUP_STYLES.container}">${content}</div>`;
}

function popupTitle(text: string): string {
  return `<div style="${POPUP_STYLES.title}">${text}</div>`;
}

function popupSubtitle(text: string): string {
  return `<div style="${POPUP_STYLES.subtitle}">${text}</div>`;
}

function popupSection(title: string, content: string): string {
  return `
    <div style="${POPUP_STYLES.section}">
      <div style="${POPUP_STYLES.sectionTitle}">${title}</div>
      ${content}
    </div>
  `;
}

function popupInlineField(label: string, value: string): string {
  return `
    <div style="${POPUP_STYLES.listItem}">
      <span style="${POPUP_STYLES.sectionLabel}">${label}</span> ${value}
    </div>
  `;
}

function formatDirectionString(direction: number | null | undefined): string {
  if (direction == null) return '';
  return `from ${direction}° (${degreesToCompass(direction)})`;
}

// =============================================================================
// Popup Formatters
// =============================================================================

function formatForecastPopup(properties: WaveFeatureProperties, validTime: string | null): string {
  const swells = parseJsonProperty<SwellData[]>(properties.swells);
  const windWaves = parseJsonProperty<WindWaveData | null>(properties.windWaves);
  const wind = parseJsonProperty<WindData>(properties.wind);

  // Build swells HTML
  let swellsHtml = '';
  if (swells && swells.length > 0) {
    const items = swells.map(swell => {
      const compass = degreesToCompass(swell.direction);
      return `<div style="${POPUP_STYLES.listItem}">• ${swell.height}m @ ${swell.period}s from ${swell.direction}° (${compass})</div>`;
    }).join('');
    swellsHtml = popupSection('Swells:', items);
  }

  // Build wind waves HTML
  let windWavesHtml = '';
  if (windWaves && windWaves.height > 0.1) {
    const dirStr = formatDirectionString(windWaves.direction);
    const periodStr = windWaves.period ? `@ ${windWaves.period}s` : '';
    const content = `<div style="${POPUP_STYLES.listItem}">• ${windWaves.height}m ${periodStr} ${dirStr}</div>`;
    windWavesHtml = popupSection('Wind Waves:', content);
  }

  // Build wind HTML
  let windHtml = '';
  if (wind && wind.speed != null) {
    const dirStr = formatDirectionString(wind.direction);
    const content = `<div style="${POPUP_STYLES.listItem}">${wind.speed} m/s ${dirStr}</div>`;
    windHtml = popupSection('Wind:', content);
  }

  // Format valid time
  const timeDisplay = validTime ? formatTime(validTime) : '';
  const dateDisplay = validTime ? new Date(validTime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) : '';

  return wrapPopup(`
    ${popupTitle('Wave Forecast')}
    ${popupSubtitle(`Forecast: ${dateDisplay} ${timeDisplay}`)}
    ${swellsHtml}
    ${windWavesHtml}
    ${windHtml}
  `);
}

function formatBuoyPopup(properties: BuoyFeatureProperties): string {
  const name = properties.name || 'Buoy';
  const stationId = properties.station_id || '';
  const timeDisplay = properties.observation_time ? formatTime(properties.observation_time) : 'N/A';

  // Build waves section
  let wavesHtml = '';
  if (properties.wave_height != null) {
    let waveStr = `${properties.wave_height}m`;
    if (properties.dominant_period != null) waveStr += ` @ ${properties.dominant_period}s`;
    if (properties.wave_direction != null) {
      waveStr += ` ${formatDirectionString(properties.wave_direction)}`;
    }
    wavesHtml = popupInlineField('Waves:', waveStr);
  }

  // Build wind section
  let windHtml = '';
  if (properties.wind_speed != null) {
    let windStr = `${properties.wind_speed} m/s`;
    if (properties.wind_direction != null) {
      windStr += ` ${formatDirectionString(properties.wind_direction)}`;
    }
    if (properties.wind_gust != null) windStr += ` (G ${properties.wind_gust})`;
    windHtml = popupInlineField('Wind:', windStr);
  }

  // Build water temp section
  let tempHtml = '';
  if (properties.water_temp != null) {
    tempHtml = popupInlineField('Water:', `${properties.water_temp}°C`);
  }

  // Handle case with no data
  const hasData = wavesHtml || windHtml || tempHtml;
  const dataHtml = hasData
    ? `${wavesHtml}${windHtml}${tempHtml}`
    : `<div style="${POPUP_STYLES.noData}">No recent observations</div>`;

  return wrapPopup(`
    ${popupTitle(name)}
    ${popupSubtitle(`Station ${stationId} · Observed: ${timeDisplay}`)}
    ${dataHtml}
  `);
}

// =============================================================================
// Map Layer Setup Functions (Issue #9)
// =============================================================================

function setupWaveLayer(
  mapInstance: maplibregl.Map,
  data: GeoJSONData<WaveFeatureProperties>
): void {
  mapInstance.addSource('waves', {
    type: 'geojson',
    data: data as unknown as GeoJSON.FeatureCollection,
  });

  mapInstance.addLayer({
    id: 'wave-circles',
    type: 'circle',
    source: 'waves',
    paint: {
      'circle-radius': 6,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'waveHeight'],
        0, '#3b82f6',
        3, '#eab308',
        6, '#ef4444',
        10, '#7f1d1d',
      ],
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5,
    },
  });
}

function setupBuoyLayer(
  mapInstance: maplibregl.Map,
  data: GeoJSONData<BuoyFeatureProperties>
): void {
  mapInstance.addSource('buoys', {
    type: 'geojson',
    data: data as unknown as GeoJSON.FeatureCollection,
  });

  mapInstance.addLayer({
    id: 'buoy-circles',
    type: 'circle',
    source: 'buoys',
    paint: {
      'circle-radius': 5,
      'circle-color': COLORS.buoyFill,
      'circle-opacity': 1,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': COLORS.buoyStroke,
      'circle-stroke-opacity': 1,
    },
  });
}

function setupLayerClickHandler(
  mapInstance: maplibregl.Map,
  popupInstance: maplibregl.Popup,
  layerId: string,
  popupType: PopupType,
  selectedPointRef: React.MutableRefObject<{ lng: number; lat: number } | null>,
  popupTypeRef: React.MutableRefObject<PopupType>,
  formatContent: (properties: unknown) => string
): void {
  mapInstance.on('click', layerId, (e) => {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const originalCoords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    const displayCoords: [number, number] = [...originalCoords];

    selectedPointRef.current = { lng: originalCoords[0], lat: originalCoords[1] };
    popupTypeRef.current = popupType;

    // Handle world wrap
    while (Math.abs(e.lngLat.lng - displayCoords[0]) > 180) {
      displayCoords[0] += e.lngLat.lng > displayCoords[0] ? 360 : -360;
    }

    popupInstance
      .setLngLat(displayCoords)
      .setHTML(formatContent(feature.properties))
      .addTo(mapInstance);
  });

  // Cursor handlers
  mapInstance.on('mouseenter', layerId, () => {
    mapInstance.getCanvas().style.cursor = 'pointer';
  });

  mapInstance.on('mouseleave', layerId, () => {
    mapInstance.getCanvas().style.cursor = '';
  });
}

// =============================================================================
// Main Component
// =============================================================================

export default function WaveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const selectedPointRef = useRef<{ lng: number; lat: number } | null>(null);
  const popupTypeRef = useRef<PopupType>(null);

  // Forecast state
  const [currentHour, setCurrentHour] = useState(0);
  const [metadata, setMetadata] = useState<ForecastMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentData, setCurrentData] = useState<GeoJSONData | null>(null);

  // Layer visibility
  const [showBuoys, setShowBuoys] = useState(true);

  // Buoy data state
  const [buoyError, setBuoyError] = useState<string | null>(null);
  const [buoyLastUpdated, setBuoyLastUpdated] = useState<Date | null>(null);

  // Load GeoJSON data for a specific forecast hour
  const loadForecastData = useCallback(async (hour: number) => {
    if (!map.current) return;

    const hourStr = hour.toString().padStart(3, '0');
    const url = `/data/wave-data-f${hourStr}.geojson`;

    setIsLoading(true);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || !data.features) {
        throw new Error('Invalid GeoJSON data');
      }

      if (data.metadata) {
        setMetadata(data.metadata);
      }
      setCurrentData(data);

      if (map.current) {
        const source = map.current.getSource('waves') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData(data);
        }
      }
    } catch (error) {
      console.error(`Failed to load forecast data for f${hourStr}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update popup content when forecast data changes (only for wave popups)
  useEffect(() => {
    const selectedPoint = selectedPointRef.current;
    if (!selectedPoint || !popup.current || !currentData) return;
    if (!popup.current.isOpen() || popupTypeRef.current !== 'wave') return;

    const feature = currentData.features.find(f => {
      const [lng, lat] = f.geometry.coordinates;
      return Math.abs(lng - selectedPoint.lng) < 0.01 && Math.abs(lat - selectedPoint.lat) < 0.01;
    });

    if (feature) {
      popup.current.setHTML(formatForecastPopup(feature.properties, metadata?.valid_time ?? null));
    }
  }, [currentData, metadata]);

  const handleHourChange = useCallback((hour: number) => {
    setCurrentHour(hour);
    loadForecastData(hour);
  }, [loadForecastData]);

  // Load buoy observation data
  const loadBuoyData = useCallback(async () => {
    if (!map.current) return;

    try {
      const response = await fetch('/data/buoy-observations.geojson');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buoyData = await response.json();
      const existingSource = map.current.getSource('buoys') as maplibregl.GeoJSONSource;
      if (existingSource) {
        existingSource.setData(buoyData);
      }

      setBuoyError(null);
      setBuoyLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load buoy data:', error);
      setBuoyError(error instanceof Error ? error.message : 'Failed to load buoy data');
    }
  }, []);

  // Periodic refresh for buoy data (every 30 minutes)
  useEffect(() => {
    if (!buoyLastUpdated) return;

    const REFRESH_INTERVAL = 30 * 60 * 1000;
    const intervalId = setInterval(() => {
      loadBuoyData();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [buoyLastUpdated, loadBuoyData]);

  // Toggle buoy layer visibility
  useEffect(() => {
    if (!map.current) return;
    const visibility = showBuoys ? 'visible' : 'none';
    if (map.current.getLayer('buoy-circles')) {
      map.current.setLayoutProperty('buoy-circles', 'visibility', visibility);
    }
  }, [showBuoys]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 0],
      zoom: 2,
    });

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '280px',
    });

    map.current.on('load', async () => {
      if (!map.current || !popup.current) return;

      try {
        // Parallel fetch both data sources (Issue #17)
        const [waveResult, buoyResult] = await Promise.allSettled([
          fetch('/data/wave-data-f000.geojson').then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          fetch('/data/buoy-observations.geojson').then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            return r.json();
          }),
        ]);

        // Process wave data
        if (waveResult.status === 'fulfilled') {
          const waveData = waveResult.value;
          if (waveData.metadata) {
            setMetadata(waveData.metadata);
          }
          setCurrentData(waveData);

          setupWaveLayer(map.current, waveData);
          setupLayerClickHandler(
            map.current,
            popup.current,
            'wave-circles',
            'wave',
            selectedPointRef,
            popupTypeRef,
            (props) => formatForecastPopup(props as WaveFeatureProperties, waveData.metadata?.valid_time ?? null)
          );
        } else {
          console.error('Failed to load wave data:', waveResult.reason);
        }

        // Process buoy data
        if (buoyResult.status === 'fulfilled') {
          const buoyData = buoyResult.value;
          setupBuoyLayer(map.current, buoyData);
          setupLayerClickHandler(
            map.current,
            popup.current,
            'buoy-circles',
            'buoy',
            selectedPointRef,
            popupTypeRef,
            (props) => formatBuoyPopup(props as BuoyFeatureProperties)
          );
          setBuoyError(null);
          setBuoyLastUpdated(new Date());
        } else {
          console.error('Failed to load buoy data:', buoyResult.reason);
          setBuoyError(buoyResult.reason instanceof Error ? buoyResult.reason.message : 'Failed to load buoy data');
        }

        // Clear selected point when popup closes
        popup.current.on('close', () => {
          selectedPointRef.current = null;
          popupTypeRef.current = null;
        });
      } catch (error) {
        console.error('Failed to load map data:', error);
      }
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      popup.current?.remove();
      popup.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      <div style={LEGEND_STYLES.container}>
        <div style={LEGEND_STYLES.title}>Wave Forecast</div>
        <div style={LEGEND_STYLES.gradient} />
        <div style={LEGEND_STYLES.labels}>
          <span>0m</span>
          <span>3m</span>
          <span>6m+</span>
        </div>

        {/* Buoy Toggle */}
        <label style={{
          ...LEGEND_STYLES.toggleLabel,
          cursor: buoyError ? 'default' : 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showBuoys && !buoyError}
            onChange={(e) => setShowBuoys(e.target.checked)}
            disabled={!!buoyError}
            style={{
              ...LEGEND_STYLES.checkbox,
              cursor: buoyError ? 'not-allowed' : 'pointer',
            }}
          />
          <div style={{
            ...LEGEND_STYLES.buoyIndicator,
            background: buoyError ? COLORS.error : COLORS.buoyFill,
            border: `1.5px solid ${buoyError ? COLORS.errorDark : COLORS.buoyStroke}`,
          }} />
          <span style={{ color: buoyError ? COLORS.errorDark : COLORS.textMuted }}>
            {buoyError ? 'Buoys unavailable' : 'NDBC Buoys'}
          </span>
        </label>
      </div>

      {/* Time Slider */}
      <TimeSlider
        currentHour={currentHour}
        validTime={metadata?.valid_time ?? null}
        referenceTime={metadata?.model_run ?? null}
        isLoading={isLoading}
        onChange={handleHourChange}
      />
    </div>
  );
}
