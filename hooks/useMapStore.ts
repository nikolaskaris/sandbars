import { create } from 'zustand';
import type { LayerVisibility, LatestForecastInfo } from '@/types';

interface MapState {
  // Forecast time
  forecastHour: number;
  setForecastHour: (hour: number) => void;

  // Layer visibility
  layers: LayerVisibility;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  setLayerVisibility: (layer: keyof LayerVisibility, visible: boolean) => void;

  // Latest forecast info
  latestInfo: LatestForecastInfo | null;
  setLatestInfo: (info: LatestForecastInfo) => void;

  // Playback
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  // Selected location (for detail panel)
  selectedLocation: { lat: number; lon: number } | null;
  setSelectedLocation: (loc: { lat: number; lon: number } | null) => void;

  // Loading states
  isLoadingWind: boolean;
  setIsLoadingWind: (loading: boolean) => void;
  isLoadingWaves: boolean;
  setIsLoadingWaves: (loading: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  forecastHour: 0,
  setForecastHour: (hour) => set({ forecastHour: hour }),

  layers: {
    wind: false,        // Disabled by default until wind data is available
    waveHeight: true,   // Enabled by default - our main feature
    swellDirection: false,
    buoys: false,       // Disabled by default
  },
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  setLayerVisibility: (layer, visible) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: visible },
    })),

  latestInfo: null,
  setLatestInfo: (info) => set({ latestInfo: info }),

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  selectedLocation: null,
  setSelectedLocation: (loc) => set({ selectedLocation: loc }),

  isLoadingWind: false,
  setIsLoadingWind: (loading) => set({ isLoadingWind: loading }),
  isLoadingWaves: false,
  setIsLoadingWaves: (loading) => set({ isLoadingWaves: loading }),
}));
