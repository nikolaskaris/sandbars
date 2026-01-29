'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { useMapStore } from '@/hooks/useMapStore';

interface WindDataPoint {
  lat: number;
  lon: number;
  u: number; // U component (east-west)
  v: number; // V component (north-south)
}

interface WindLayerProps {
  visible: boolean;
}

const SOURCE_ID = 'wind-data-source';
const LAYER_ID = 'wind-arrows-layer';

/**
 * WindLayer displays wind direction and speed as animated arrows on the map.
 * Uses GFS wind data fetched from our API.
 */
export default function WindLayer({ visible }: WindLayerProps) {
  const { current: mapRef } = useMap();
  const forecastHour = useMapStore((s) => s.forecastHour);
  const [windData, setWindData] = useState<WindDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dataRef = useRef(windData);
  const visibleRef = useRef(visible);

  // Keep refs in sync
  dataRef.current = windData;
  visibleRef.current = visible;

  // Fetch wind data when layer is enabled or forecast hour changes
  useEffect(() => {
    if (!visible) return;

    const fetchWindData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          forecastHour: forecastHour.toString(),
        });

        const res = await fetch(`/api/wind/grid?${params}`);
        if (res.ok) {
          const data = await res.json();
          console.log(`Wind data fetched: ${data.grid?.length || 0} points`);
          setWindData(data.grid || []);
        } else {
          console.error('Failed to fetch wind data:', res.status);
        }
      } catch (err) {
        console.error('Error fetching wind data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWindData();
  }, [visible, forecastHour]);

  // Add/update the wind visualization layer
  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const addLayer = () => {
      const currentData = dataRef.current;
      const currentVisible = visibleRef.current;

      // Remove existing layers first
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (e) {}

      if (!currentVisible || currentData.length === 0) {
        return;
      }

      // Convert wind data to GeoJSON with arrow symbols
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: currentData.map((point) => {
          // Calculate wind speed and direction from U/V components
          const speed = Math.sqrt(point.u * point.u + point.v * point.v);
          // Direction in degrees (meteorological convention: direction wind is coming FROM)
          const direction = (Math.atan2(-point.u, -point.v) * 180) / Math.PI;

          return {
            type: 'Feature' as const,
            properties: {
              speed,
              direction,
              // Normalize speed for styling (0-1 range, capped at 20 m/s)
              normalizedSpeed: Math.min(speed / 20, 1),
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [point.lon, point.lat],
            },
          };
        }),
      };

      try {
        // Add wind data source
        map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

        // Add wind arrows layer using symbol with rotation
        map.addLayer({
          id: LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': 'arrow',
            'icon-size': [
              'interpolate', ['linear'], ['get', 'normalizedSpeed'],
              0, 0.3,
              0.5, 0.5,
              1, 0.8,
            ],
            'icon-rotate': ['get', 'direction'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': 0.7,
            'icon-color': [
              'interpolate', ['linear'], ['get', 'normalizedSpeed'],
              0, '#a5d6a7',    // light green - calm
              0.25, '#81c784', // green - light
              0.5, '#ffeb3b',  // yellow - moderate
              0.75, '#ff9800', // orange - strong
              1, '#f44336',    // red - very strong
            ],
          },
        });

        console.log('Wind layer added with', currentData.length, 'points');
      } catch (error) {
        console.error('Error adding wind layer:', error);
      }
    };

    const removeLayer = () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (e) {}
    };

    // Load arrow icon if not present
    const loadArrowIcon = () => {
      if (!map.hasImage('arrow')) {
        // Create a simple arrow icon as a canvas
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          // Arrow pointing up (will be rotated by icon-rotate)
          ctx.moveTo(size / 2, 2);           // Top point
          ctx.lineTo(size - 6, size - 6);    // Bottom right
          ctx.lineTo(size / 2, size - 10);   // Bottom center notch
          ctx.lineTo(6, size - 6);           // Bottom left
          ctx.closePath();
          ctx.fill();

          // Add stroke for visibility
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        map.addImage('arrow', { width: size, height: size, data: new Uint8Array(ctx!.getImageData(0, 0, size, size).data) });
      }
    };

    // Wait for style to load before adding layer
    const onStyleLoad = () => {
      loadArrowIcon();
      if (visibleRef.current && dataRef.current.length > 0) {
        addLayer();
      }
    };

    if (map.isStyleLoaded()) {
      onStyleLoad();
    } else {
      map.on('style.load', onStyleLoad);
    }

    // Poll to handle data arriving after map loads
    const interval = setInterval(() => {
      const shouldShow = visibleRef.current && dataRef.current.length > 0;
      const isShowing = !!map.getLayer(LAYER_ID);

      if (shouldShow && !isShowing && map.isStyleLoaded()) {
        loadArrowIcon();
        addLayer();
      } else if (!shouldShow && isShowing) {
        removeLayer();
      }
    }, 200);

    return () => {
      clearInterval(interval);
      map.off('style.load', onStyleLoad);
      removeLayer();
    };
  }, [mapRef, visible, windData, forecastHour]); // Use full data array to detect content changes

  return null;
}
