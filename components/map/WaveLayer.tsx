'use client';

import { useEffect, useRef } from 'react';
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

const SOURCE_ID = 'wave-data-source';
const LAYER_ID = 'wave-circles-layer';
const LAND_MASK_SOURCE_ID = 'land-mask-source';
const LAND_MASK_LAYER_ID = 'land-mask-layer';

// Natural Earth 110m land polygons - industry standard for ocean/land masking
const LAND_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

// Cache land GeoJSON to avoid re-fetching
let landGeoJSONCache: GeoJSON.FeatureCollection | null = null;

export default function WaveLayer({ visible, data }: WaveLayerProps) {
  const { current: mapRef } = useMap();
  const dataRef = useRef(data);
  const visibleRef = useRef(visible);
  const initializedRef = useRef(false);

  // Keep refs in sync
  dataRef.current = data;
  visibleRef.current = visible;

  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const addLayer = async () => {
      const currentData = dataRef.current;
      const currentVisible = visibleRef.current;

      // Remove existing layers first
      try {
        if (map.getLayer(LAND_MASK_LAYER_ID)) map.removeLayer(LAND_MASK_LAYER_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(LAND_MASK_SOURCE_ID)) map.removeSource(LAND_MASK_SOURCE_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (e) {}

      if (!currentVisible || currentData.length === 0) {
        return;
      }

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: currentData.map((point) => ({
          type: 'Feature' as const,
          properties: { waveHeight: point.waveHeight },
          geometry: {
            type: 'Point' as const,
            coordinates: [point.lon, point.lat],
          },
        })),
      };

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

        // Add wave circles layer
        map.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate', ['exponential', 2], ['zoom'],
              0, 25,
              2, 60,
              4, 140,
              6, 320,
              8, 600,
            ],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'waveHeight'],
              0, '#0d47a1',
              0.5, '#1976d2',
              1, '#00acc1',
              1.5, '#00897b',
              2, '#43a047',
              2.5, '#7cb342',
              3, '#c0ca33',
              4, '#ffb300',
              5, '#fb8c00',
              6, '#f4511e',
              8, '#c62828',
            ],
            'circle-opacity': 0.7,
            'circle-blur': 0.4,
          },
        }, firstLabelLayerId);

        // Load Natural Earth land mask (industry standard for ocean boundaries)
        // This layer sits ON TOP of the wave layer to mask spillover onto land
        try {
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

            // Add land mask fill - matches dark-v11 map background color
            map.addLayer({
              id: LAND_MASK_LAYER_ID,
              type: 'fill',
              source: LAND_MASK_SOURCE_ID,
              paint: {
                'fill-color': '#191a1a', // Matches mapbox dark-v11 land color
                'fill-opacity': 1,
              },
            }, firstLabelLayerId); // Insert before labels but after wave layer

            console.log('Land mask applied - wave spillover onto land is now masked');
          }
        } catch (landError) {
          console.warn('Could not load Natural Earth land mask:', landError);
        }

        console.log('Wave layer added with', currentData.length, 'points');
        initializedRef.current = true;
      } catch (error) {
        console.error('Error adding wave layer:', error);
      }
    };

    const removeLayer = () => {
      try {
        if (map.getLayer(LAND_MASK_LAYER_ID)) map.removeLayer(LAND_MASK_LAYER_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(LAND_MASK_SOURCE_ID)) map.removeSource(LAND_MASK_SOURCE_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (e) {}
    };

    // Wait for style to load before adding layer
    const onStyleLoad = () => {
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
  }, [mapRef, visible, data]); // Use full data array to detect content changes

  return null;
}

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
    <div className="bg-black/60 backdrop-blur-sm rounded-lg shadow-lg p-3">
      <div className="text-xs font-medium text-white/80 mb-2">Wave Height (m)</div>
      <div className="flex gap-0.5">
        {colors.map((c, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="w-6 h-3 first:rounded-l-sm last:rounded-r-sm"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-[9px] text-white/60 mt-1">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
