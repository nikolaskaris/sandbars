'use client';

import { useEffect, useRef } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { MapLayer } from './LayerToggle';
import type {
  WaveFeatureProperties,
  GeoJSONData,
} from '@/lib/wave-utils';
import type maplibregl from 'maplibre-gl';

// Color configurations matching LAYER_CONFIGS in WaveMap.tsx
const HEATMAP_CONFIGS: Record<
  MapLayer,
  {
    property: string;
    colorDomain: [number, number];
    colorRange: [number, number, number][];
  }
> = {
  waveHeight: {
    property: 'waveHeight',
    colorDomain: [0, 6],
    colorRange: [
      [59, 130, 246],  // blue  (flat/small)
      [100, 200, 240], // light blue
      [234, 179, 8],   // yellow (moderate)
      [253, 150, 60],  // orange
      [239, 68, 68],   // red    (large)
      [127, 29, 29],   // dark red (very large)
    ],
  },
  wavePeriod: {
    property: 'wavePeriod',
    colorDomain: [5, 20],
    colorRange: [
      [135, 206, 235], // light blue (short period)
      [80, 210, 170],  // teal
      [34, 197, 94],   // green (medium period)
      [80, 130, 200],  // blue-purple
      [124, 58, 237],  // purple (long period)
      [90, 30, 180],   // deep purple
    ],
  },
  wind: {
    property: 'windSpeed',
    colorDomain: [0, 20],
    colorRange: [
      [209, 213, 219], // gray  (calm)
      [150, 210, 150], // light green
      [34, 197, 94],   // green (moderate)
      [234, 179, 8],   // yellow
      [239, 68, 68],   // red   (strong)
      [180, 30, 30],   // dark red (very strong)
    ],
  },
};

interface DeckGLOverlayProps {
  map: maplibregl.Map | null;
  data: GeoJSONData<WaveFeatureProperties> | null;
  activeLayer: MapLayer;
  enabled: boolean;
}

export default function DeckGLOverlay({
  map,
  data,
  activeLayer,
  enabled,
}: DeckGLOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);

  // Initialize the MapboxOverlay control when the map becomes available
  useEffect(() => {
    if (!map) return;

    const overlay = new MapboxOverlay({ layers: [] });
    // MapboxOverlay implements the same IControl interface as maplibre-gl
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

  // Update heatmap layers when data, activeLayer, or enabled state changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (!enabled || !data?.features?.length) {
      overlay.setProps({ layers: [] });
      return;
    }

    const config = HEATMAP_CONFIGS[activeLayer];

    const heatmapLayer = new HeatmapLayer({
      id: 'wave-heatmap',
      data: data.features,
      getPosition: (d: GeoJSON.Feature) =>
        (d.geometry as GeoJSON.Point).coordinates as [number, number],
      getWeight: (d: GeoJSON.Feature) => {
        const val = (d.properties as Record<string, number>)?.[config.property];
        return val ?? 0;
      },
      aggregation: 'MEAN',
      radiusPixels: 50,
      intensity: 1,
      threshold: 0.03,
      colorDomain: config.colorDomain,
      colorRange: config.colorRange,
      debounceTimeout: 200,
    });

    overlay.setProps({ layers: [heatmapLayer] });
  }, [data, activeLayer, enabled]);

  // Toggle the MapLibre circle layer visibility when heatmap is enabled/disabled
  useEffect(() => {
    if (!map) return;
    if (map.getLayer('wave-circles')) {
      map.setLayoutProperty(
        'wave-circles',
        'visibility',
        enabled ? 'none' : 'visible'
      );
    }
  }, [map, enabled]);

  return null;
}
