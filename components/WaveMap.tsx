'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TimeSlider from './TimeSlider';
import SearchBar from './SearchBar';
import SpotPanel from './SpotPanel';
import VectorOverlay from './VectorOverlay';
import { MapLayer } from './LayerToggle';
import Button from './ui/Button';
import { Plus, Minus, AlertTriangle, AlertCircle } from 'lucide-react';
import { DATA_URLS, SUPABASE_STORAGE_URL } from '@/lib/config';
import { Protocol } from 'pmtiles';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  SwellData,
  WindData,
  WindWaveData,
  WaveFeatureProperties,
  ForecastMetadata,
  GeoJSONData,
  degreesToCompass,
  formatTime,
  parseJsonProperty,
  findNearestForecastHour,
  findNearestFeature,
} from '@/lib/wave-utils';

// =============================================================================
// PMTiles Protocol Registration
// =============================================================================

let pmtilesRegistered = false;
function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
}

// =============================================================================
// Constants & Styling
// =============================================================================

// TODO: Convert MapLibre popups from innerHTML strings to React portals
// so they can use Tailwind classes directly. For now, inline styles use
// design system color values.
const POPUP_STYLES = {
  container: 'font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.4; color: #2C2825;',
  title: 'font-weight: 500; margin-bottom: 4px; font-size: 14px; color: #2C2825;',
  subtitle: 'color: #8C8279; margin-bottom: 8px; font-size: 12px;',
  sectionLabel: 'font-weight: 500; color: #8C8279;',
  listItem: 'margin: 4px 0;',
  noData: 'color: #B5ADA4;',
};

// Buoy marker colors
const BUOY_FILL = '#FEFDFB';
const BUOY_STROKE = '#3D3630';

// Map layer names to PNG filename prefixes (matches pipeline output)
const LAYER_TO_FILENAME: Record<MapLayer, string> = {
  waveHeight: 'wave-height',
  wavePeriod: 'wave-period',
  wind: 'wind-speed',
};

function getRasterUrl(layer: MapLayer, hour: number): string {
  const paddedHour = String(hour).padStart(3, '0');
  return `${SUPABASE_STORAGE_URL}/${LAYER_TO_FILENAME[layer]}-f${paddedHour}.png`;
}

// Mercator bounds matching the pipeline output
const RASTER_BOUNDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, 85.051129],   // top-left
  [180, 85.051129],    // top-right
  [180, -85.051129],   // bottom-right
  [-180, -85.051129],  // bottom-left
];

const WATER_COLORS: Record<MapLayer, string> = {
  waveHeight: '#C8D8E4',  // soft warm-desaturated blue
  wavePeriod: '#C8D8E4',  // soft warm-desaturated blue
  wind: '#C8D8E4',        // soft warm-desaturated blue
};

const BATHYMETRY_LAYER_IDS = [
  'bathymetry-nearshore',
  'bathymetry-shelf',
  'bathymetry-slope',
  'bathymetry-deep',
  'bathymetry-labels',
];

function updateWaterColor(mapInstance: maplibregl.Map, layer: MapLayer) {
  if (mapInstance.getLayer('water')) {
    mapInstance.setPaintProperty('water', 'fill-color', WATER_COLORS[layer]);
  }
}

// =============================================================================
// Layer Configurations
// =============================================================================

// Legend gradients match the actual raster LUT colors from convert-grib-to-geojson.py
// Direction: "to bottom" = top is max value, bottom is min value
const LEGEND_CONFIG: Record<MapLayer, {
  unit: string;
  gradient: string;
  labels: string[];
}> = {
  waveHeight: {
    unit: 'm',
    gradient: 'linear-gradient(to bottom, rgb(15,35,100) 0%, rgb(25,55,130) 25%, rgb(35,75,160) 45%, rgb(50,100,180) 65%, rgb(70,130,200) 80%, rgb(110,155,210) 90%, rgb(150,170,200) 97%, rgb(180,175,168) 100%)',
    labels: ['15', '12', '9', '6', '3', '0'],
  },
  wavePeriod: {
    unit: 's',
    gradient: 'linear-gradient(to bottom, rgb(65,40,140) 0%, rgb(95,65,165) 25%, rgb(120,100,180) 50%, rgb(150,140,195) 75%, rgb(165,160,180) 90%, rgb(180,175,168) 100%)',
    labels: ['25', '20', '15', '10', '5', '0'],
  },
  wind: {
    unit: 'm/s',
    gradient: 'linear-gradient(to bottom, rgb(15,100,100) 0%, rgb(30,130,125) 25%, rgb(60,155,150) 50%, rgb(120,175,170) 75%, rgb(160,175,172) 90%, rgb(180,175,168) 100%)',
    labels: ['30', '25', '20', '15', '10', '5', '0'],
  },
};

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
      'circle-color': BUOY_FILL,
      'circle-opacity': 1,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': BUOY_STROKE,
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
  activeLayer: MapLayer;
  showBuoys: boolean;
  showBathymetry: boolean;
  onSpotSelect?: () => void;
}

export default function WaveMap({ onFavoritesChange, initialSpot, activeLayer, showBuoys, showBathymetry, onSpotSelect }: WaveMapProps) {
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

  // (activeLayer and showBuoys are now controlled via props)
  const showBuoysRef = useRef(showBuoys);
  useEffect(() => { showBuoysRef.current = showBuoys; }, [showBuoys]);

  // Bathymetry contour visibility (controlled via props from page.tsx)
  const showBathymetryRef = useRef(showBathymetry);
  useEffect(() => { showBathymetryRef.current = showBathymetry; }, [showBathymetry]);

  // Buoy data state
  const [buoyError, setBuoyError] = useState<string | null>(null);
  const [buoyLastUpdated, setBuoyLastUpdated] = useState<Date | null>(null);

  // Mobile detection
  const isMobile = useIsMobile();
  const isMobileRef = useRef(isMobile);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);

  // Spot panel state
  const [selectedSpot, setSelectedSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const selectedSpotRef = useRef(selectedSpot);
  useEffect(() => { selectedSpotRef.current = selectedSpot; }, [selectedSpot]);

  // Notify parent when a spot is selected (so it can close overlay panels)
  useEffect(() => {
    if (selectedSpot) onSpotSelect?.();
  }, [selectedSpot, onSpotSelect]);

  // Track previous map view to restore on spot close
  const [previousView, setPreviousView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const previousViewRef = useRef(previousView);
  useEffect(() => { previousViewRef.current = previousView; }, [previousView]);

  // Compute bottom padding so the selected spot centers above the mobile bottom sheet
  const getMobilePadding = () => ({
    top: 0,
    bottom: isMobileRef.current ? window.innerHeight * 0.45 : 0,
    left: 0,
    right: 0,
  });

  // Handle initialSpot from navigation
  useEffect(() => {
    if (initialSpot) {
      if (map.current && !previousViewRef.current) {
        const c = map.current.getCenter();
        setPreviousView({ center: [c.lng, c.lat], zoom: map.current.getZoom() });
      }
      setSelectedSpot(initialSpot);
      if (map.current) {
        map.current.flyTo({ center: [initialSpot.lng, initialSpot.lat], zoom: 6, duration: 2000, padding: getMobilePadding() });
      }
    }
  }, [initialSpot]);

  // Restore previous map view when spot is deselected
  useEffect(() => {
    if (!selectedSpot && previousView && map.current) {
      const restoreZoom = Math.max(previousView.zoom, 4);
      map.current.flyTo({
        center: previousView.zoom >= 4 ? previousView.center : map.current.getCenter().toArray() as [number, number],
        zoom: restoreZoom,
        duration: 1500,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      setPreviousView(null);
    }
  }, [selectedSpot, previousView]);

  // Keep refs in sync with state so map click handler has latest data
  useEffect(() => { currentDataRef.current = currentData; }, [currentData]);
  useEffect(() => { metadataRef.current = metadata; }, [metadata]);

  // Derive vector data from selected spot + current forecast data
  const vectorData = useMemo(() => {
    if (!selectedSpot || !currentData) return null;
    const nearest = findNearestFeature(currentData, selectedSpot.lat, selectedSpot.lng);
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
    } catch (error) {
      console.error(`Failed to load forecast data for hour ${hour}:`, error);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setWaveError('No internet connection. Please check your network and try again.');
      } else {
        setWaveError('Unable to load forecast data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleHourChange = useCallback((hour: number) => {
    setCurrentHour(hour);
    loadForecastData(hour);
  }, [loadForecastData]);

  const handleRetry = useCallback(() => {
    setWaveError(null);
    loadForecastData(currentHour);
  }, [loadForecastData, currentHour]);

  // Auto-retry when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (waveError) {
        loadForecastData(currentHour);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [waveError, currentHour, loadForecastData]);

  // Handle location search result
  const handleLocationSelect = useCallback((lat: number, lon: number, name: string) => {
    if (!map.current) return;

    if (!previousViewRef.current) {
      const c = map.current.getCenter();
      setPreviousView({ center: [c.lng, c.lat], zoom: map.current.getZoom() });
    }

    map.current.flyTo({
      center: [lon, lat],
      zoom: 6,
      duration: 2000,
      padding: getMobilePadding(),
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

  // Toggle bathymetry contour layer visibility
  useEffect(() => {
    if (!map.current) return;
    const visibility = showBathymetry ? 'visible' : 'none';
    for (const id of BATHYMETRY_LAYER_IDS) {
      if (map.current.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', visibility);
      }
    }
  }, [showBathymetry]);

  // Update base map water color when active layer changes
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      updateWaterColor(map.current, activeLayer);
    }
  }, [activeLayer]);

  // Update forecast raster when hour or active layer changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('forecast-raster') as maplibregl.ImageSource | undefined;
    if (!source) return;
    try {
      source.updateImage({ url: getRasterUrl(activeLayer, currentHour) });
    } catch (e) {
      // MapLibre throws when a previous image fetch is aborted (e.g., rapid scrubbing)
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (e instanceof Error && e.message?.includes('abort')) return;
      console.error('Failed to update forecast raster:', e);
    }
  }, [currentHour, activeLayer]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Register PMTiles protocol before map init
    ensurePmtilesProtocol();

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [0, 0],
        zoom: 2,
        doubleClickZoom: true,
      });
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setWaveError('Map failed to load (WebGL not available)');
      return;
    }

    map.current.on('error', (e) => {
      // Suppress abort errors from rapid image source updates
      if (e.error?.message?.includes('abort')) return;
      // Suppress PMTiles/bathymetry fetch errors (file may not exist yet)
      if (e.error?.message?.includes('pmtiles') || e.error?.message?.includes('bathymetry')) return;
      console.error('Map error:', e.error);
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

    // Warm the Carto Positron base style to match the design system
    map.current.on('style.load', () => {
      if (!map.current) return;
      const m = map.current;

      // Water: soft warm-desaturated blue
      if (m.getLayer('water')) {
        m.setPaintProperty('water', 'fill-opacity', 0.6);
      }
      updateWaterColor(m, activeLayer);

      // Helper: set color on fill or background layers safely
      const setLayerColor = (layerId: string, color: string) => {
        const layer = m.getLayer(layerId);
        if (!layer) return;
        if (layer.type === 'background') {
          m.setPaintProperty(layerId, 'background-color', color);
        } else if (layer.type === 'fill') {
          m.setPaintProperty(layerId, 'fill-color', color);
        }
      };

      // Land/background: warm sand tones
      for (const id of ['background', 'land', 'landcover']) {
        setLayerColor(id, '#F0EBE3');
      }

      // Parks/vegetation: very subtle warm sage
      for (const id of ['park', 'landuse', 'landcover']) {
        setLayerColor(id, '#E4DECF');
        if (m.getLayer(id)?.type === 'fill') {
          m.setPaintProperty(id, 'fill-opacity', 0.5);
        }
      }

      // Buildings: nearly invisible
      if (m.getLayer('building')) {
        m.setPaintProperty('building', 'fill-opacity', 0.1);
      }

      // Roads and labels: muted, de-emphasized
      const style = m.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          const lid = layer.id;
          if (lid.includes('road') || lid.includes('highway') || lid.includes('path') || lid.includes('bridge')) {
            if (layer.type === 'line') {
              try { m.setPaintProperty(lid, 'line-opacity', 0.3); } catch {}
            }
            if (layer.type === 'symbol') {
              try { m.setPaintProperty(lid, 'text-opacity', 0.35); } catch {}
            }
          }
          if (lid.includes('label') || lid.includes('place')) {
            try { m.setPaintProperty(lid, 'text-opacity', 0.4); } catch {}
          }
          if (lid.includes('boundary')) {
            if (layer.type === 'line') {
              try { m.setPaintProperty(lid, 'line-opacity', 0.2); } catch {}
            }
          }
        }
      }
    });

    map.current.on('load', async () => {
      if (!map.current || !popup.current) return;
      const m = map.current;

      // --- Forecast raster + vector masking layers ---
      // Find insertion point: first road/tunnel/building layer
      const baseStyle = m.getStyle();
      let insertBefore: string | undefined;
      if (baseStyle?.layers) {
        for (const layer of baseStyle.layers) {
          if (
            layer.id.includes('tunnel') ||
            layer.id.includes('road') ||
            layer.id.includes('aeroway') ||
            layer.id.includes('bridge') ||
            layer.id.includes('building')
          ) {
            insertBefore = layer.id;
            break;
          }
        }
      }

      // Forecast raster (renders everywhere — frontend masks land)
      m.addSource('forecast-raster', {
        type: 'image',
        url: getRasterUrl('waveHeight', 0),
        coordinates: RASTER_BOUNDS,
      });
      m.addLayer({
        id: 'forecast-layer',
        type: 'raster',
        source: 'forecast-raster',
        paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0 },
      }, insertBefore);

      // Land mask — NE 50m land polygons, covers raster over land
      m.addSource('land-mask', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson',
      });
      m.addLayer({
        id: 'land-mask-layer',
        type: 'fill',
        source: 'land-mask',
        paint: { 'fill-color': '#F0EBE3', 'fill-opacity': 1 },
      }, insertBefore);

      // Inland water — NE 50m lakes, renders above land mask
      m.addSource('inland-water', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson',
      });
      m.addLayer({
        id: 'inland-water-layer',
        type: 'fill',
        source: 'inland-water',
        paint: { 'fill-color': '#D8E0E4', 'fill-opacity': 1 },
      }, insertBefore);

      // --- Terrain hillshade (always on, covers land + ocean floor) ---
      try {
        m.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 15,
          encoding: 'terrarium',
        });
        m.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: {
            'hillshade-exaggeration': 0.15,
            'hillshade-shadow-color': '#1a1a2e',
            'hillshade-highlight-color': '#fefefe',
            'hillshade-accent-color': '#3d405b',
            'hillshade-illumination-direction': 315,
          },
        }, insertBefore);
      } catch (e) {
        console.warn('Failed to add terrain hillshade:', e);
      }

      // --- Bathymetry contour lines from PMTiles ---
      try {
        m.addSource('bathymetry', {
          type: 'vector',
          url: `pmtiles://${DATA_URLS.bathymetryPmtiles}`,
        });

        const contourLayers: { id: string; filter: maplibregl.FilterSpecification; opacity: number; width: number; minzoom: number }[] = [
          { id: 'bathymetry-nearshore', filter: ['<', ['get', 'depth'], 50], opacity: 0.5, width: 1.2, minzoom: 8 },
          { id: 'bathymetry-shelf', filter: ['all', ['>=', ['get', 'depth'], 50], ['<', ['get', 'depth'], 200]], opacity: 0.35, width: 0.9, minzoom: 5 },
          { id: 'bathymetry-slope', filter: ['all', ['>=', ['get', 'depth'], 200], ['<', ['get', 'depth'], 1000]], opacity: 0.2, width: 0.7, minzoom: 3 },
          { id: 'bathymetry-deep', filter: ['>=', ['get', 'depth'], 1000], opacity: 0.12, width: 0.5, minzoom: 2 },
        ];

        for (const cl of contourLayers) {
          m.addLayer({
            id: cl.id,
            type: 'line',
            source: 'bathymetry',
            'source-layer': 'bathymetry',
            filter: cl.filter,
            minzoom: cl.minzoom,
            layout: { visibility: 'none' },
            paint: {
              'line-color': '#64748B',
              'line-opacity': cl.opacity,
              'line-width': cl.width,
            },
          }, insertBefore);
        }

        // Depth labels along contour lines (≥50m only to avoid clutter)
        m.addLayer({
          id: 'bathymetry-labels',
          type: 'symbol',
          source: 'bathymetry',
          'source-layer': 'bathymetry',
          filter: ['>=', ['get', 'depth'], 50],
          minzoom: 6,
          layout: {
            visibility: 'none',
            'symbol-placement': 'line',
            'text-field': ['concat', ['to-string', ['get', 'depth']], 'm'],
            'text-font': ['Open Sans Regular'],
            'text-size': 9,
            'symbol-spacing': 300,
            'text-max-angle': 30,
          },
          paint: {
            'text-color': '#64748B',
            'text-opacity': 0.6,
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
        }, insertBefore);

        // Click handler for contour depth info
        for (const cl of contourLayers) {
          m.on('click', cl.id, (e) => {
            if (!showBathymetryRef.current) return;
            if (!e.features || e.features.length === 0) return;
            if (popup.current?.isOpen()) return; // don't override existing popup

            const depth = e.features[0].properties?.depth;
            if (depth == null) return;

            popup.current
              ?.setLngLat(e.lngLat)
              .setHTML(wrapPopup(`${popupTitle(`Depth: ${depth}m`)}`))
              .addTo(m);
          });
        }
      } catch (e) {
        console.warn('Failed to add bathymetry contours:', e);
      }

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

            // Initialize slider to forecast hour nearest to current time
            const nearestHour = findNearestForecastHour(waveData.metadata.model_run);
            if (nearestHour !== 0) {
              setCurrentHour(nearestHour);
              loadForecastData(nearestHour);
            }
          }
          setCurrentData(waveData);
          setWaveError(null);
        } else {
          console.error('Failed to load wave data:', waveResult.reason);
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setWaveError('No internet connection. Please check your network and try again.');
          } else {
            setWaveError('Unable to load forecast data. Please try again.');
          }
        }

        // Process buoy data
        if (buoyResult.status === 'fulfilled') {
          const buoyData = buoyResult.value;
          setupBuoyLayer(map.current, buoyData);
          // Apply current visibility state immediately after layer creation
          map.current.setLayoutProperty('buoy-circles', 'visibility', showBuoysRef.current ? 'visible' : 'none');
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
            const nearest = findNearestFeature(data, lat, lng, 4);
            if (!nearest) return;

            // Save current view before zooming in (only if not already saved)
            if (!previousViewRef.current) {
              const c = map.current.getCenter();
              setPreviousView({ center: [c.lng, c.lat], zoom: map.current.getZoom() });
            }

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
              padding: {
                top: 0,
                bottom: isMobileRef.current ? window.innerHeight * 0.45 : 0,
                left: 0,
                right: 0,
              },
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
        // Fly to pending spot if set before map loaded (e.g. from Favorites "View on Map")
        if (selectedSpotRef.current && map.current) {
          map.current.flyTo({
            center: [selectedSpotRef.current.lng, selectedSpotRef.current.lat],
            zoom: 6,
            duration: 2000,
            padding: {
              top: 0,
              bottom: isMobileRef.current ? window.innerHeight * 0.45 : 0,
              left: 0,
              right: 0,
            },
          });
        }
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

      {/* Search Bar */}
      <div className="absolute top-3 left-3 z-10">
        <SearchBar onLocationSelect={handleLocationSelect} />
      </div>

      {/* Zoom Controls */}
      <div
        className="absolute top-4 flex flex-col z-10 bg-surface rounded-md shadow-sm border border-border overflow-hidden transition-[right] duration-300 ease-out"
        style={{ right: selectedSpot && !isMobile ? 416 : 16 }}
      >
        <button
          onClick={() => map.current?.zoomIn()}
          aria-label="Zoom in"
          className="h-9 w-9 flex items-center justify-center bg-surface text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:scale-98 transition-all duration-150"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="border-t border-border" />
        <button
          onClick={() => map.current?.zoomOut()}
          aria-label="Zoom out"
          className="h-9 w-9 flex items-center justify-center bg-surface text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:scale-98 transition-all duration-150"
        >
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Full error overlay — initial load failed, no data at all */}
      {!currentData && waveError && (
        <div
          data-testid="error-overlay"
          className="absolute inset-0 flex flex-col items-center justify-center bg-surface/[0.97] z-[5] p-5 text-center"
        >
          <AlertTriangle className="h-10 w-10 text-text-tertiary mb-4" strokeWidth={1.5} />
          <h2 className="text-xl font-medium text-text-primary mb-2">
            Couldn&apos;t Load Forecast
          </h2>
          <p className="text-sm text-text-secondary max-w-[300px] mb-6">
            {waveError}
          </p>
          <Button onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      )}

      {/* Error banner — data loaded but update failed */}
      {currentData && waveError && (
        <div
          data-testid="error-banner"
          className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-surface border border-border px-4 py-2 rounded-md text-sm shadow-sm flex items-center gap-3 z-10"
        >
          <AlertCircle className="h-4 w-4 text-error shrink-0" strokeWidth={1.5} />
          <span className="text-text-primary">{waveError}</span>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      )}

      {/* Legend — dark glass vertical strip */}
      <div
        data-testid="legend"
        style={{
          position: 'absolute',
          bottom: 80,
          right: 12,
          zIndex: 10,
          background: 'rgba(30, 30, 25, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 6,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.7)',
          fontWeight: 500,
          letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {LEGEND_CONFIG[activeLayer].unit}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          <div
            data-testid="legend-gradient"
            role="img"
            aria-label={`Color scale for ${activeLayer}`}
            style={{
              width: 14,
              height: 140,
              borderRadius: 3,
              background: LEGEND_CONFIG[activeLayer].gradient,
              flexShrink: 0,
            }}
          />
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 140,
            padding: '1px 0',
          }}>
            {LEGEND_CONFIG[activeLayer].labels.map((label, i) => (
              <span key={i} style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.6)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Time Slider */}
      <TimeSlider
        currentHour={currentHour}
        validTime={metadata?.valid_time ?? null}
        referenceTime={metadata?.model_run ?? null}
        activeLayer={activeLayer}
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
        <SpotPanel location={selectedSpot} onClose={() => setSelectedSpot(null)} onFavoritesChange={onFavoritesChange} />
      )}
    </div>
  );
}
