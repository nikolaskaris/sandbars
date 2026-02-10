'use client';

import { useEffect, useRef } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { BitmapLayer } from '@deck.gl/layers';
import type { MapLayer } from './LayerToggle';
import type maplibregl from 'maplibre-gl';
import { SUPABASE_STORAGE_URL } from '@/lib/config';

// Map layer names to PNG filename prefixes
const LAYER_TO_FILENAME: Record<MapLayer, string> = {
  waveHeight: 'wave-height',
  wavePeriod: 'wave-period',
  wind: 'wind-speed',
};

interface DeckGLOverlayProps {
  map: maplibregl.Map | null;
  forecastHour: number;
  activeLayer: MapLayer;
  opacity?: number;
}

export default function DeckGLOverlay({
  map,
  forecastHour,
  activeLayer,
  opacity = 0.8,
}: DeckGLOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);

  // Initialize the MapboxOverlay control when the map becomes available
  useEffect(() => {
    if (!map) return;

    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;

    return () => {
      overlayRef.current = null;
      try {
        map.removeControl(overlay as unknown as maplibregl.IControl);
      } catch {
        // Map may already be destroyed during cleanup
      }
      overlay.finalize();
    };
  }, [map]);

  // Update BitmapLayer when forecastHour, activeLayer, or opacity changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const paddedHour = String(forecastHour).padStart(3, '0');
    const filenamePrefix = LAYER_TO_FILENAME[activeLayer];
    const imageUrl = `${SUPABASE_STORAGE_URL}/${filenamePrefix}-f${paddedHour}.png`;

    const layer = new BitmapLayer({
      id: 'wave-raster',
      image: imageUrl,
      bounds: [-180, -85.051129, 180, 85.051129],
      opacity,
    });

    overlay.setProps({ layers: [layer] });
  }, [forecastHour, activeLayer, opacity]);

  return null;
}
