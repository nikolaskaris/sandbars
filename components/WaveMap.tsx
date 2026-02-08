'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TimeSlider from './TimeSlider';
import SearchBar from './SearchBar';
import SpotPanel from './SpotPanel';
import VectorOverlay from './VectorOverlay';
import LayerToggle, { MapLayer } from './LayerToggle';
import { DATA_URLS } from '@/lib/config';
import {
  SwellData,
  WindData,
  WindWaveData,
  WaveFeatureProperties,
  ForecastMetadata,
  GeoJSONFeature,
  GeoJSONData,
  degreesToCompass,
  formatTime,
  parseJsonProperty,
} from '@/lib/wave-utils';

// =============================================================================
// Constants & Styling (Issue #11)
// =============================================================================

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
  sectionLabel: 'font-weight: 500; color: #666;',
  listItem: 'margin: 4px 0;',
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
// Layer Configurations
// =============================================================================

const LAYER_CONFIGS: Record<MapLayer, {
  property: string;
  colorStops: (string | number)[];
  legendTitle: string;
  legendGradient: string;
  legendLabels: [string, string, string];
}> = {
  waveHeight: {
    property: 'waveHeight',
    colorStops: [0, '#3b82f6', 3, '#eab308', 6, '#ef4444', 10, '#7f1d1d'],
    legendTitle: 'Wave Height',
    legendGradient: 'linear-gradient(to right, #3b82f6, #eab308, #ef4444)',
    legendLabels: ['0m', '3m', '6m+'],
  },
  wavePeriod: {
    property: 'wavePeriod',
    colorStops: [5, '#87CEEB', 12, '#22c55e', 20, '#7c3aed'],
    legendTitle: 'Wave Period',
    legendGradient: 'linear-gradient(to right, #87CEEB, #22c55e, #7c3aed)',
    legendLabels: ['5s', '12s', '20s+'],
  },
  wind: {
    property: 'windSpeed',
    colorStops: [0, '#d1d5db', 10, '#22c55e', 20, '#ef4444'],
    legendTitle: 'Wind Speed',
    legendGradient: 'linear-gradient(to right, #d1d5db, #22c55e, #ef4444)',
    legendLabels: ['0 m/s', '10', '20+'],
  },
};

function getCircleColorExpression(layer: MapLayer): maplibregl.ExpressionSpecification {
  const config = LAYER_CONFIGS[layer];
  return [
    'interpolate',
    ['linear'],
    ['get', config.property],
    ...config.colorStops,
  ] as maplibregl.ExpressionSpecification;
}

/**
 * Add top-level wavePeriod and windSpeed properties so MapLibre expressions can access them.
 * Mutates features in-place since the data was just fetched.
 */
function enrichWaveData(data: GeoJSONData<WaveFeatureProperties>): void {
  for (const feature of data.features) {
    const props = feature.properties;
    const swells = parseJsonProperty<SwellData[]>(props.swells);
    const wind = parseJsonProperty<WindData>(props.wind);
    const extra = props as unknown as Record<string, unknown>;
    extra.wavePeriod = swells?.[0]?.period ?? 0;
    extra.windSpeed = wind?.speed ?? 0;
  }
}

// =============================================================================
// Local Type Definitions
// =============================================================================

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

type PopupType = 'wave' | 'buoy' | null;

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

function findNearestWaveFeature(
  features: GeoJSONFeature<WaveFeatureProperties>[],
  lat: number,
  lng: number,
  maxDistance = 10
): GeoJSONFeature<WaveFeatureProperties> | null {
  let nearest: GeoJSONFeature<WaveFeatureProperties> | null = null;
  let minDist = Infinity;

  for (const feature of features) {
    const [fLng, fLat] = feature.geometry.coordinates;
    const dx = fLng - lng;
    const dy = fLat - lat;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = feature;
    }
  }

  return minDist <= maxDistance ? nearest : null;
}

function formatCoordinateLabel(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}\u00B0${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(2)}\u00B0${lng >= 0 ? 'E' : 'W'}`;
  return `Location: ${latStr}, ${lngStr}`;
}

// =============================================================================
// Main Component
// =============================================================================

interface WaveMapProps {
  onFavoritesChange?: () => void;
  initialSpot?: { lat: number; lng: number; name: string } | null;
}

export default function WaveMap({ onFavoritesChange, initialSpot }: WaveMapProps = {}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const selectedPointRef = useRef<{ lng: number; lat: number } | null>(null);
  const popupTypeRef = useRef<PopupType>(null);
  const currentDataRef = useRef<GeoJSONData | null>(null);
  const metadataRef = useRef<ForecastMetadata | null>(null);

  // Forecast state
  const [currentHour, setCurrentHour] = useState(0);
  const [metadata, setMetadata] = useState<ForecastMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentData, setCurrentData] = useState<GeoJSONData | null>(null);
  const [waveError, setWaveError] = useState<string | null>(null);

  // Active data layer
  const [activeLayer, setActiveLayer] = useState<MapLayer>('waveHeight');

  // Layer visibility
  const [showBuoys, setShowBuoys] = useState(true);

  // Buoy data state
  const [buoyError, setBuoyError] = useState<string | null>(null);
  const [buoyLastUpdated, setBuoyLastUpdated] = useState<Date | null>(null);

  // Spot panel state
  const [selectedSpot, setSelectedSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const selectedSpotRef = useRef(selectedSpot);
  useEffect(() => { selectedSpotRef.current = selectedSpot; }, [selectedSpot]);

  // Handle initialSpot from navigation
  useEffect(() => {
    if (initialSpot) {
      setSelectedSpot(initialSpot);
      if (map.current) {
        map.current.flyTo({ center: [initialSpot.lng, initialSpot.lat], zoom: 6, duration: 2000 });
      }
    }
  }, [initialSpot]);

  // Keep refs in sync with state so map click handler has latest data
  useEffect(() => { currentDataRef.current = currentData; }, [currentData]);
  useEffect(() => { metadataRef.current = metadata; }, [metadata]);

  // Derive vector data from selected spot + current forecast data
  const vectorData = useMemo(() => {
    if (!selectedSpot || !currentData) return null;
    const nearest = findNearestWaveFeature(currentData.features, selectedSpot.lat, selectedSpot.lng);
    if (!nearest) return null;
    return {
      swells: parseJsonProperty<SwellData[]>(nearest.properties.swells),
      windWaves: parseJsonProperty<WindWaveData | null>(nearest.properties.windWaves),
      wind: parseJsonProperty<WindData>(nearest.properties.wind),
    };
  }, [selectedSpot, currentData]);

  // Load GeoJSON data for a specific forecast hour
  const loadForecastData = useCallback(async (hour: number) => {
    if (!map.current) return;

    const url = DATA_URLS.waveData(hour);

    setIsLoading(true);
    setWaveError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || !data.features) {
        throw new Error('Invalid GeoJSON data');
      }

      enrichWaveData(data);

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
      console.error(`Failed to load forecast data for hour ${hour}:`, error);
      setWaveError('Unable to load forecast data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleHourChange = useCallback((hour: number) => {
    setCurrentHour(hour);
    loadForecastData(hour);
  }, [loadForecastData]);

  // Handle location search result
  const handleLocationSelect = useCallback((lat: number, lon: number, name: string) => {
    if (!map.current) return;

    map.current.flyTo({
      center: [lon, lat],
      zoom: 6,
      duration: 2000,
    });

    setSelectedSpot({ lat, lng: lon, name });
  }, []);

  // Load buoy observation data
  const loadBuoyData = useCallback(async () => {
    if (!map.current) return;

    try {
      const response = await fetch(DATA_URLS.buoyObservations);
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

  // Update circle color when active layer changes
  useEffect(() => {
    if (!map.current || !map.current.getLayer('wave-circles')) return;
    map.current.setPaintProperty('wave-circles', 'circle-color', getCircleColorExpression(activeLayer));
  }, [activeLayer]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 0],
      zoom: 2,
      doubleClickZoom: true,
    });

    // Expose map instance for E2E testing
    if (typeof window !== 'undefined') {
      (window as unknown as { map: maplibregl.Map }).map = map.current;
    }

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '350px',
    });

    map.current.on('load', async () => {
      if (!map.current || !popup.current) return;

      try {
        // Parallel fetch both data sources from Supabase Storage (Issue #17)
        const [waveResult, buoyResult] = await Promise.allSettled([
          fetch(DATA_URLS.waveData(0)).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          fetch(DATA_URLS.buoyObservations).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            return r.json();
          }),
        ]);

        // Process wave data
        if (waveResult.status === 'fulfilled') {
          const waveData = waveResult.value;
          enrichWaveData(waveData);
          if (waveData.metadata) {
            setMetadata(waveData.metadata);
          }
          setCurrentData(waveData);
          setWaveError(null);

          setupWaveLayer(map.current, waveData);
        } else {
          console.error('Failed to load wave data:', waveResult.reason);
          setWaveError('Unable to load forecast data');
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

        // Map-wide click handler — selects forecast spot or closes spot view
        // Debounce to avoid triggering on double-click (which should zoom)
        let clickTimeout: ReturnType<typeof setTimeout> | null = null;

        map.current.on('click', (e) => {
          if (clickTimeout) clearTimeout(clickTimeout);

          clickTimeout = setTimeout(() => {
            clickTimeout = null;
            if (!map.current) return;

            // Don't interfere with buoy clicks
            if (map.current.getLayer('buoy-circles')) {
              const buoyFeatures = map.current.queryRenderedFeatures(e.point, { layers: ['buoy-circles'] });
              if (buoyFeatures.length > 0) return;
            }

            // Close any open buoy popup
            if (popup.current?.isOpen()) {
              popup.current.remove();
            }

            // If a spot is already selected, close spot view and return
            if (selectedSpotRef.current) {
              setSelectedSpot(null);
              return;
            }

            const data = currentDataRef.current;
            if (!data || !data.features.length) return;

            const { lng, lat } = e.lngLat;
            const nearest = findNearestWaveFeature(data.features, lat, lng);
            if (!nearest) return;

            setSelectedSpot({
              lat,
              lng,
              name: formatCoordinateLabel(lat, lng),
            });

            map.current.flyTo({
              center: [lng, lat],
              zoom: 6,
              duration: 2000,
              essential: true,
            });
          }, 250);
        });

        map.current.on('dblclick', () => {
          if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
          }
          // MapLibre handles the zoom automatically
        });
      } catch (error) {
        console.error('Failed to load map data:', error);
      }
    });

    return () => {
      popup.current?.remove();
      popup.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} data-testid="map-container" style={{ width: '100%', height: '100%' }} />

      {/* Search Bar + Layer Toggle */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
      }}>
        <SearchBar onLocationSelect={handleLocationSelect} />
        <LayerToggle activeLayer={activeLayer} onChange={setActiveLayer} />
      </div>

      {/* Zoom Controls */}
      <div style={{
        position: 'absolute',
        top: 80,
        right: selectedSpot ? 420 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 10,
        transition: 'right 0.3s ease',
      }}>
        {[
          { label: '+', action: () => map.current?.zoomIn() },
          { label: '\u2212', action: () => map.current?.zoomOut() },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              width: 36,
              height: 36,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {waveError && (
        <div
          data-testid="error-banner"
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {waveError}
        </div>
      )}

      {/* Legend */}
      <div data-testid="legend" style={LEGEND_STYLES.container}>
        <div style={LEGEND_STYLES.title}>{LAYER_CONFIGS[activeLayer].legendTitle}</div>
        <div style={{ ...LEGEND_STYLES.gradient, background: LAYER_CONFIGS[activeLayer].legendGradient }} />
        <div style={LEGEND_STYLES.labels}>
          <span>{LAYER_CONFIGS[activeLayer].legendLabels[0]}</span>
          <span>{LAYER_CONFIGS[activeLayer].legendLabels[1]}</span>
          <span>{LAYER_CONFIGS[activeLayer].legendLabels[2]}</span>
        </div>

        {/* Buoy Toggle */}
        <label
          data-testid="buoy-toggle"
          style={{
            ...LEGEND_STYLES.toggleLabel,
            cursor: buoyError ? 'default' : 'pointer',
          }}
        >
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

      {/* Vector Overlay */}
      {selectedSpot && map.current && vectorData && (
        <VectorOverlay
          map={map.current}
          location={{ lat: selectedSpot.lat, lng: selectedSpot.lng }}
          swells={vectorData.swells}
          windWaves={vectorData.windWaves}
          wind={vectorData.wind}
        />
      )}

      {/* Spot Panel */}
      {selectedSpot && (
        <SpotPanel location={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
