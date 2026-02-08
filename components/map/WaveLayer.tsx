'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-map-gl/maplibre';

interface WaveDataPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod?: number;
}

interface WaveLayerProps {
  visible: boolean;
  data: WaveDataPoint[];
  opacity?: number;
}

const SOURCE_ID = 'wave-height-source';
const HEATMAP_LAYER_ID = 'wave-height-heatmap';
const LAND_MASK_SOURCE_ID = 'wave-land-mask-source';
const LAND_MASK_LAYER_ID = 'wave-land-mask-layer';

// Natural Earth 110m land polygons for ocean/land masking
const LAND_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

// Cache land GeoJSON
let landGeoJSONCache: GeoJSON.FeatureCollection | null = null;

/**
 * Convert wave data to GeoJSON
 */
function waveDataToGeoJSON(data: WaveDataPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.map((point) => ({
      type: 'Feature' as const,
      properties: {
        waveHeight: point.waveHeight,
        weight: Math.min(point.waveHeight / 8, 1),
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [point.lon, point.lat],
      },
    })),
  };
}

/**
 * WaveLayer displays wave height as a colormap heatmap layer.
 * Uses MapLibre's heatmap layer for smooth gradients.
 */
export default function WaveLayer({ visible, data, opacity = 0.7 }: WaveLayerProps) {
  const { current: mapRef } = useMap();
  const layerAddedRef = useRef(false);
  const lastDataLengthRef = useRef(0);

  // Update source data when data changes (without re-adding layer)
  const updateSourceData = useCallback((map: maplibregl.Map, newData: WaveDataPoint[]) => {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source && newData.length > 0) {
      const geojson = waveDataToGeoJSON(newData);
      source.setData(geojson);
      // Sample a point to verify data is changing
      const sample = newData[0];
      console.log(`WaveLayer: data updated (${newData.length} points), sample: h=${sample?.waveHeight?.toFixed(2)}, dir=${sample?.waveDirection?.toFixed(0)}`);
    }
  }, []);

  // Add layer to map
  const addLayer = useCallback(async (map: maplibregl.Map, waveData: WaveDataPoint[]) => {
    if (layerAddedRef.current) return;
    if (waveData.length === 0) return;

    const geojson = waveDataToGeoJSON(waveData);

    try {
      // Add wave data source
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      // Find the first label layer to insert before
      const layers = map.getStyle().layers || [];
      let firstLabelLayerId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol' && layer.id.includes('label')) {
          firstLabelLayerId = layer.id;
          break;
        }
      }

      // Add heatmap layer for smooth color gradients
      map.addLayer({
        id: HEATMAP_LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.5,
            4, 1,
            8, 1.5,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 0, 0)',
            0.1, 'rgba(13, 71, 161, 0.6)',
            0.2, 'rgba(25, 118, 210, 0.7)',
            0.3, 'rgba(0, 172, 193, 0.75)',
            0.4, 'rgba(0, 137, 123, 0.8)',
            0.5, 'rgba(67, 160, 71, 0.8)',
            0.6, 'rgba(192, 202, 51, 0.85)',
            0.7, 'rgba(255, 179, 0, 0.85)',
            0.8, 'rgba(251, 140, 0, 0.9)',
            0.9, 'rgba(244, 81, 30, 0.9)',
            1, 'rgba(198, 40, 40, 0.95)',
          ],
          'heatmap-radius': [
            'interpolate', ['exponential', 2], ['zoom'],
            0, 20,
            2, 40,
            4, 80,
            6, 150,
            8, 250,
            10, 400,
          ],
          'heatmap-opacity': opacity,
        },
      }, firstLabelLayerId);

      // Load and apply land mask
      if (!landGeoJSONCache) {
        console.log('Loading Natural Earth land mask...');
        const landResponse = await fetch(LAND_GEOJSON_URL);
        landGeoJSONCache = await landResponse.json();
      }

      if (landGeoJSONCache) {
        map.addSource(LAND_MASK_SOURCE_ID, {
          type: 'geojson',
          data: landGeoJSONCache,
        });

        map.addLayer({
          id: LAND_MASK_LAYER_ID,
          type: 'fill',
          source: LAND_MASK_SOURCE_ID,
          paint: {
            'fill-color': '#191a1a',
            'fill-opacity': 1,
          },
        }, firstLabelLayerId);
      }

      layerAddedRef.current = true;
      lastDataLengthRef.current = waveData.length;
      console.log('Wave heatmap layer added with', waveData.length, 'points');
    } catch (error) {
      console.error('Error adding wave layer:', error);
    }
  }, [opacity]);

  // Remove layer from map
  const removeLayer = useCallback((map: maplibregl.Map) => {
    try {
      if (map.getLayer(LAND_MASK_LAYER_ID)) map.removeLayer(LAND_MASK_LAYER_ID);
      if (map.getLayer(HEATMAP_LAYER_ID)) map.removeLayer(HEATMAP_LAYER_ID);
      if (map.getSource(LAND_MASK_SOURCE_ID)) map.removeSource(LAND_MASK_SOURCE_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      layerAddedRef.current = false;
    } catch (e) {}
  }, []);

  // Main effect: handle visibility and data changes
  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const handleStyleLoad = () => {
      if (visible && data.length > 0) {
        if (!layerAddedRef.current) {
          addLayer(map, data);
        } else {
          // Layer exists, just update the data
          updateSourceData(map, data);
        }
      } else if (!visible && layerAddedRef.current) {
        removeLayer(map);
      }
    };

    if (map.isStyleLoaded()) {
      handleStyleLoad();
    } else {
      map.once('style.load', handleStyleLoad);
    }

    return () => {
      // Don't remove on cleanup to avoid flicker during re-renders
    };
  }, [mapRef, visible, data, addLayer, removeLayer, updateSourceData]);

  // Separate effect to update data when it changes (even if layer already exists)
  useEffect(() => {
    if (!mapRef || !visible || data.length === 0) return;

    const map = mapRef.getMap();
    if (!map || !map.isStyleLoaded()) return;

    // If layer exists and data changed, update it
    if (layerAddedRef.current) {
      updateSourceData(map, data);
    }
  }, [mapRef, visible, data, updateSourceData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!mapRef) return;
      const map = mapRef.getMap();
      if (map) {
        removeLayer(map);
      }
    };
  }, [mapRef, removeLayer]);

  return null;
}

/**
 * Wave Height Legend Component
 */
export function WaveHeightLegend() {
  const colors = [
    { label: '0', color: '#0d47a1' },
    { label: '1', color: '#00acc1' },
    { label: '2', color: '#43a047' },
    { label: '3', color: '#c0ca33' },
    { label: '5', color: '#fb8c00' },
    { label: '8+', color: '#c62828' },
  ];

  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-lg shadow-lg p-3">
      <div className="text-xs font-medium text-white/90 mb-2">Wave Height (m)</div>
      <div className="flex gap-0.5">
        {colors.map((c, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="w-7 h-4 first:rounded-l last:rounded-r"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-[10px] text-white/70 mt-1">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
