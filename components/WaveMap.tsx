'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TimeSlider from './TimeSlider';

// Compass directions for degree conversion
const COMPASS_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

/**
 * Convert degrees to compass bearing (e.g., 290 → WNW)
 */
function degreesToCompass(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS_DIRECTIONS[index];
}

/**
 * Format popup HTML content from feature properties
 */
function formatPopupContent(properties: any): string {
  const swells = typeof properties.swells === 'string'
    ? JSON.parse(properties.swells)
    : properties.swells;
  const windWaves = typeof properties.windWaves === 'string'
    ? JSON.parse(properties.windWaves)
    : properties.windWaves;
  const wind = typeof properties.wind === 'string'
    ? JSON.parse(properties.wind)
    : properties.wind;

  // Build swells HTML
  let swellsHtml = '';
  if (swells && swells.length > 0) {
    swellsHtml = `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 500; color: #666; margin-bottom: 4px;">Swells:</div>
        ${swells.map((swell: { height: number; period: number; direction: number }) => {
          const compass = degreesToCompass(swell.direction);
          return `<div style="margin: 4px 0;">• ${swell.height}m @ ${swell.period}s from ${swell.direction}° (${compass})</div>`;
        }).join('')}
      </div>
    `;
  }

  // Build wind waves HTML
  let windWavesHtml = '';
  if (windWaves && windWaves.height > 0.1) {
    const compass = windWaves.direction ? degreesToCompass(windWaves.direction) : '';
    const dirStr = windWaves.direction ? `from ${windWaves.direction}° (${compass})` : '';
    const periodStr = windWaves.period ? `@ ${windWaves.period}s` : '';
    windWavesHtml = `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 500; color: #666; margin-bottom: 4px;">Wind Waves:</div>
        <div style="margin: 4px 0;">• ${windWaves.height}m ${periodStr} ${dirStr}</div>
      </div>
    `;
  }

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4;">
      <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">Wave Conditions</div>
      ${swellsHtml}
      ${windWavesHtml}
      <div>
        <div style="font-weight: 500; color: #666; margin-bottom: 4px;">Wind:</div>
        <div style="margin: 4px 0;">${wind.speed} m/s from ${wind.direction}° (${degreesToCompass(wind.direction)})</div>
      </div>
    </div>
  `;
}

interface ForecastMetadata {
  forecastHour: number;
  validTime: string;
  referenceTime: string;
  generatedAt: string;
}

interface GeoJSONData {
  type: string;
  metadata?: ForecastMetadata;
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: [number, number] };
    properties: any;
  }>;
}

/**
 * Simple wave visualization map.
 * Displays wave height data as colored circles on a MapLibre map.
 */
export default function WaveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const selectedPointRef = useRef<{ lng: number; lat: number } | null>(null);

  // Forecast state
  const [currentHour, setCurrentHour] = useState(0);
  const [metadata, setMetadata] = useState<ForecastMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentData, setCurrentData] = useState<GeoJSONData | null>(null);

  // Load GeoJSON data for a specific forecast hour
  const loadForecastData = useCallback(async (hour: number) => {
    // Ensure map is ready
    if (!map.current) return;

    const hourStr = hour.toString().padStart(3, '0');
    const url = `/data/wave-data-f${hourStr}.geojson`;

    setIsLoading(true);

    try {
      const response = await fetch(url);

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Verify data structure
      if (!data || !data.features) {
        throw new Error('Invalid GeoJSON data');
      }

      // Update metadata
      if (data.metadata) {
        setMetadata(data.metadata);
      }

      // Store current data for popup updates
      setCurrentData(data);

      // Update map source (check map still exists after async)
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

  // Update popup content when forecast data changes
  useEffect(() => {
    const selectedPoint = selectedPointRef.current;

    // Skip if no point selected, no popup, or no data
    if (!selectedPoint || !popup.current || !currentData) return;

    // Skip if popup is not open
    if (!popup.current.isOpen()) return;

    // Find the feature at selected coordinates (use approximate matching for floating point)
    const feature = currentData.features.find(f => {
      const [lng, lat] = f.geometry.coordinates;
      return Math.abs(lng - selectedPoint.lng) < 0.01 && Math.abs(lat - selectedPoint.lat) < 0.01;
    });

    if (feature) {
      popup.current.setHTML(formatPopupContent(feature.properties));
    }
  }, [currentData]);

  // Handle forecast hour change from slider
  const handleHourChange = useCallback((hour: number) => {
    setCurrentHour(hour);
    loadForecastData(hour);
  }, [loadForecastData]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map with global view
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 0],
      zoom: 2,
    });

    // Create reusable popup
    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '280px',
    });

    map.current.on('load', async () => {
      if (!map.current) return;

      try {
        // Load initial data (f000)
        const response = await fetch('/data/wave-data-f000.geojson');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        // Set initial metadata and data
        if (data.metadata) {
          setMetadata(data.metadata);
        }
        setCurrentData(data);

        // Add wave data source
        map.current.addSource('waves', {
          type: 'geojson',
          data: data,
        });

        // Add circle layer for wave visualization
        map.current.addLayer({
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

        // Click handler for wave circles
        map.current.on('click', 'wave-circles', (e) => {
          if (!map.current || !popup.current || !e.features || e.features.length === 0) return;

          const feature = e.features[0];
          const originalCoords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          const displayCoords: [number, number] = [...originalCoords];

          // Store the original coordinates for data lookup
          selectedPointRef.current = { lng: originalCoords[0], lat: originalCoords[1] };

          // Ensure popup appears at clicked point even if map is zoomed out
          while (Math.abs(e.lngLat.lng - displayCoords[0]) > 180) {
            displayCoords[0] += e.lngLat.lng > displayCoords[0] ? 360 : -360;
          }

          popup.current
            .setLngLat(displayCoords)
            .setHTML(formatPopupContent(feature.properties))
            .addTo(map.current);
        });

        // Clear selected point when popup closes
        if (popup.current) {
          popup.current.on('close', () => {
            selectedPointRef.current = null;
          });
        }

        // Change cursor on hover
        map.current.on('mouseenter', 'wave-circles', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'wave-circles', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      } catch (error) {
        console.error('Failed to load initial wave data:', error);
      }
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Cleanup
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
      <div style={{
        position: 'absolute',
        bottom: 100,
        left: 20,
        background: 'white',
        padding: '12px 16px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Wave Height</div>
        <div style={{
          width: 120,
          height: 12,
          borderRadius: 4,
          background: 'linear-gradient(to right, #3b82f6, #eab308, #ef4444)',
          marginBottom: 4,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
          <span>0m</span>
          <span>3m</span>
          <span>6m+</span>
        </div>
      </div>

      {/* Time Slider */}
      <TimeSlider
        currentHour={currentHour}
        validTime={metadata?.validTime ?? null}
        referenceTime={metadata?.referenceTime ?? null}
        isLoading={isLoading}
        onChange={handleHourChange}
      />
    </div>
  );
}
