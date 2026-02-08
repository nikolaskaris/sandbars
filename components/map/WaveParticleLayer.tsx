'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { WaveParticleEngine, WaveDataPoint, WaveVisualizationConfig } from '@/lib/wave-particle-engine';

interface WaveParticleLayerProps {
  visible: boolean;
  data: WaveDataPoint[];
  config?: Partial<WaveVisualizationConfig>;
}

/**
 * WaveParticleLayer renders animated wave direction bars.
 * Short perpendicular bars that oscillate to show wave direction and energy transfer.
 *
 * Key difference from wind visualization:
 * - Wind: particles flow continuously IN the direction of motion
 * - Waves: bars oscillate PERPENDICULAR to direction of energy propagation
 */
export default function WaveParticleLayer({
  visible,
  data,
  config = {},
}: WaveParticleLayerProps) {
  const { current: mapRef } = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WaveParticleEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataVersionRef = useRef(0);

  // Create canvas and engine on mount
  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const mapContainer = map.getContainer();
    if (!mapContainer) return;

    // Create container for canvas overlay
    // Use z-index 2 to layer above map tiles but below UI controls
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '2';
    containerRef.current = container;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current = canvas;
    container.appendChild(canvas);

    // Insert container into map
    mapContainer.appendChild(container);

    // Create engine with nullschool-style oscillating bar config
    // Bars oscillate perpendicular to wave direction, not flow along it
    const engine = new WaveParticleEngine(canvas, {
      barCount: 6000,            // Number of oscillating bars
      barLength: 12,             // Length of each bar in pixels
      barWidth: 1.5,             // Stroke width
      oscillationAmplitude: 8,   // Max lateral displacement in pixels
      oscillationSpeed: 0.08,    // Speed of oscillation
      barLifespan: 60,           // Frames before bar respawns
      fadeInFrames: 8,           // Smooth fade in
      fadeOutFrames: 15,         // Smooth fade out
      respawnRadius: 5,          // Spawn new bars within 5 degrees
      color: [220, 240, 255],    // Light cyan-white
      opacity: 0.7,              // Base opacity
      ...config,
    });
    engineRef.current = engine;

    // Set initial size
    const rect = mapContainer.getBoundingClientRect();
    engine.resize(rect.width, rect.height);

    // Cleanup
    return () => {
      engine.destroy();
      engineRef.current = null;
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      containerRef.current = null;
      canvasRef.current = null;
    };
  }, [mapRef]);

  // Update projection when map moves
  const updateProjection = useCallback(() => {
    if (!mapRef || !engineRef.current) return;

    const map = mapRef.getMap();
    if (!map) return;

    engineRef.current.setProjection(
      (lng: number, lat: number) => {
        try {
          const point = map.project([lng, lat]);
          return [point.x, point.y];
        } catch {
          return null;
        }
      },
      (x: number, y: number) => {
        try {
          const lngLat = map.unproject([x, y]);
          return [lngLat.lng, lngLat.lat];
        } catch {
          return null;
        }
      }
    );
  }, [mapRef]);

  // Handle map movement
  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const onMove = () => {
      updateProjection();
    };

    const onResize = () => {
      if (!engineRef.current || !canvasRef.current) return;
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      engineRef.current.resize(rect.width, rect.height);
      updateProjection();
    };

    map.on('move', onMove);
    map.on('resize', onResize);

    // Initial projection setup
    updateProjection();

    return () => {
      map.off('move', onMove);
      map.off('resize', onResize);
    };
  }, [mapRef, updateProjection]);

  // Update data when it changes - key fix for forecast slider
  useEffect(() => {
    if (!engineRef.current) return;

    // Track data version to detect actual changes
    dataVersionRef.current += 1;
    const currentVersion = dataVersionRef.current;

    // Sample a point to verify data is actually different
    const sample = data[0];
    console.log(`WaveParticleLayer: v${currentVersion}, ${data.length} points, sample: h=${sample?.waveHeight?.toFixed(2)}, dir=${sample?.waveDirection?.toFixed(0)}`);

    engineRef.current.setData(data);
    updateProjection();
  }, [data, updateProjection]);

  // Update config when it changes
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setConfig(config);
  }, [config]);

  // Start/stop animation based on visibility
  useEffect(() => {
    if (!engineRef.current || !containerRef.current) return;

    if (visible && data.length > 0) {
      containerRef.current.style.display = 'block';
      engineRef.current.start();
    } else {
      containerRef.current.style.display = 'none';
      engineRef.current.stop();
      engineRef.current.clear();
    }
  }, [visible, data.length]);

  return null;
}
