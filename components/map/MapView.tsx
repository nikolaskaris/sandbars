'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FavoriteLocation } from '@/types';
import MapSearch from './MapSearch';
import BuoyLayer, { BUOY_LAYER_ID } from './BuoyLayer';
import LayerToggle, { BuoyIcon } from './LayerToggle';
import BuoyModal from './BuoyModal';
import GeolocationControl from './GeolocationControl';
import WaveLayer, { WaveHeightLegend } from './WaveLayer';
import WaveParticleLayer from './WaveParticleLayer';
import WindLayer from './WindLayer';
import { ForecastTimeline } from '@/components/Timeline/ForecastTimeline';
import { useLatestForecast } from '@/hooks/useLatestForecast';
import { useMapStore } from '@/hooks/useMapStore';
import type { NDBCStation } from '@/lib/forecast/sources/ndbc-stations';

// Carto Dark Matter - free dark map style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface WaveDataPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod?: number;
}

interface MapViewProps {
  favorites?: FavoriteLocation[];
  onMapClick?: (lat: number, lng: number) => void;
  selectedLocation?: FavoriteLocation | null;
  initialLocation?: { latitude: number; longitude: number; zoom?: number };
  showBuoyLayer?: boolean;
  showFavorites?: boolean;
  showWaveLayer?: boolean;
  fullScreen?: boolean;
}

// Default to US West Coast view, zoomed out
const DEFAULT_VIEW = {
  latitude: 35.0,
  longitude: -130.0,
  zoom: 4,
};

// Wave icon for layer toggle
function WaveIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  );
}

// Wind icon for layer toggle
function WindIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
  );
}

// Swell direction icon (animated lines)
function SwellIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function MapView({
  favorites = [],
  onMapClick,
  selectedLocation,
  initialLocation,
  showBuoyLayer: initialShowBuoyLayer = false,
  showFavorites = true,
  showWaveLayer: initialShowWaveLayer = true,
  fullScreen = false,
}: MapViewProps) {
  const mapRef = useRef<any>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [viewState, setViewState] = useState({
    latitude: initialLocation?.latitude ?? DEFAULT_VIEW.latitude,
    longitude: initialLocation?.longitude ?? DEFAULT_VIEW.longitude,
    zoom: initialLocation?.zoom ?? DEFAULT_VIEW.zoom,
  });

  // Layer states
  const [showBuoys, setShowBuoys] = useState(initialShowBuoyLayer);
  const [showWaves, setShowWaves] = useState(initialShowWaveLayer);
  const [showWaveDirection, setShowWaveDirection] = useState(true); // Wave direction particles
  const [showWind, setShowWind] = useState(false); // Wind disabled by default (wave direction is more relevant)
  const [buoyStations, setBuoyStations] = useState<NDBCStation[]>([]);
  const [isLoadingBuoys, setIsLoadingBuoys] = useState(false);
  const [waveData, setWaveData] = useState<WaveDataPoint[]>([]);
  const [isLoadingWaves, setIsLoadingWaves] = useState(false);

  // Buoy modal state
  const [selectedBuoy, setSelectedBuoy] = useState<NDBCStation | null>(null);

  // Get forecast hour from global store for dynamic data updates
  const forecastHour = useMapStore((s) => s.forecastHour);

  // Initialize latest forecast info for timeline
  useLatestForecast();

  // Fetch wave data for a specific forecast hour
  const fetchWaveData = useCallback(async (hour: number) => {
    setIsLoadingWaves(true);
    try {
      // Include forecastHour for time-varying data
      const params = new URLSearchParams({
        minLat: '-77.5',
        maxLat: '77.5',
        minLon: '-180',
        maxLon: '180',
        forecastHour: hour.toString(),
      });

      const res = await fetch(`/api/waves/grid?${params}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Wave data fetched: ${data.grid?.length || 0} points, source: ${data.source}, hour: ${hour}`);
        setWaveData(data.grid || []);
      } else {
        console.error('Failed to fetch wave data:', res.status);
      }
    } catch {
      // Silently fail - wave layer just won't show
    } finally {
      setIsLoadingWaves(false);
    }
  }, []);

  // Fetch wave data when any wave layer is enabled or forecast hour changes
  useEffect(() => {
    if (showWaves || showWaveDirection) {
      console.log(`MapView: Fetching wave data for forecastHour=${forecastHour}`);
      fetchWaveData(forecastHour);
    }
  }, [showWaves, showWaveDirection, forecastHour, fetchWaveData]); // Fetch when either layer needs data

  // Fetch buoy stations when layer is enabled
  useEffect(() => {
    if (showBuoys && buoyStations.length === 0 && !isLoadingBuoys) {
      setIsLoadingBuoys(true);
      fetch('/api/buoys/stations')
        .then(res => res.json())
        .then(data => {
          if (data.stations) {
            setBuoyStations(data.stations);
          }
        })
        .catch(err => {
          console.error('Failed to load buoy stations:', err);
        })
        .finally(() => {
          setIsLoadingBuoys(false);
        });
    }
  }, [showBuoys, buoyStations.length, isLoadingBuoys]);

  // Layer configuration
  const layerConfig = [
    {
      id: 'waves',
      label: 'Wave Height',
      icon: <WaveIcon />,
      enabled: showWaves,
    },
    {
      id: 'swell',
      label: 'Swell Direction',
      icon: <SwellIcon />,
      enabled: showWaveDirection,
    },
    {
      id: 'wind',
      label: 'Wind',
      icon: <WindIcon />,
      enabled: showWind,
    },
    {
      id: 'buoys',
      label: 'NDBC Buoys',
      icon: <BuoyIcon />,
      enabled: showBuoys,
    },
  ];

  const handleLayerToggle = useCallback((layerId: string, enabled: boolean) => {
    if (layerId === 'buoys') {
      setShowBuoys(enabled);
    } else if (layerId === 'waves') {
      setShowWaves(enabled);
    } else if (layerId === 'swell') {
      setShowWaveDirection(enabled);
    } else if (layerId === 'wind') {
      setShowWind(enabled);
    }
  }, []);

  const handleBuoyClick = useCallback((station: NDBCStation) => {
    setSelectedBuoy(station);
  }, []);

  const handleMapClick = useCallback(
    (event: any) => {
      const { lngLat } = event;

      // Clear any existing timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        return; // This is a double-click, ignore for adding favorite
      }

      // Set a timeout for single click
      clickTimeoutRef.current = setTimeout(() => {
        if (onMapClick) {
          onMapClick(lngLat.lat, lngLat.lng);
        }
        clickTimeoutRef.current = null;
      }, 250);
    },
    [onMapClick]
  );

  const flyToLocation = useCallback((lat: number, lng: number, zoom?: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: zoom ?? 10,
        duration: 1000,
      });
    }
  }, []);

  const handleSearchSelect = useCallback((lng: number, lat: number, placeName: string) => {
    flyToLocation(lat, lng, 10);
  }, [flyToLocation]);

  const handleGeolocation = useCallback((lat: number, lng: number) => {
    flyToLocation(lat, lng, 10);
  }, [flyToLocation]);

  // Update map location when initialLocation prop changes
  useEffect(() => {
    if (initialLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [initialLocation.longitude, initialLocation.latitude],
        zoom: initialLocation.zoom || 10,
        duration: 1000,
      });
    }
  }, [initialLocation]);

  // Fly to selected location when it changes
  useEffect(() => {
    if (selectedLocation) {
      flyToLocation(selectedLocation.latitude, selectedLocation.longitude, 12);
    }
  }, [selectedLocation, flyToLocation]);

  return (
    <div className="relative w-full h-full">
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 z-10">
        <MapSearch onSelect={handleSearchSelect} />
      </div>

      {/* Controls - Top Right */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <GeolocationControl onLocationFound={handleGeolocation} />
        <LayerToggle layers={layerConfig} onToggle={handleLayerToggle} />
      </div>

      {/* Wave Height Legend - Bottom Left */}
      {showWaves && (
        <div className="absolute bottom-8 left-4 z-10">
          <WaveHeightLegend />
        </div>
      )}

      {/* Loading indicator for wave data */}
      {isLoadingWaves && (
        <div className="absolute top-20 left-4 z-10 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-600">Loading wave data...</span>
        </div>
      )}

      {/* Forecast Timeline - Bottom Center */}
      <ForecastTimeline />

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        doubleClickZoom={true}
        scrollZoom={true}
        touchZoomRotate={true}
        touchPitch={false}
        dragRotate={false}
        pitchWithRotate={false}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={showBuoys ? [BUOY_LAYER_ID] : []}
      >
        <NavigationControl position="bottom-right" />

        {/* Wind Layer - animated particles */}
        <WindLayer visible={showWind} />

        {/* Wave Height Colormap Layer */}
        <WaveLayer visible={showWaves} data={waveData} opacity={0.6} />

        {/* Wave Direction Animation Layer - nullschool-style oscillating bars */}
        <WaveParticleLayer
          visible={showWaveDirection}
          data={waveData}
          config={{
            barCount: 6000,            // Number of oscillating bars
            barLength: 12,             // Short bars (10-15px)
            barWidth: 1.5,             // Stroke width
            oscillationAmplitude: 8,   // Max lateral displacement
            oscillationSpeed: 0.08,    // Oscillation frequency
            barLifespan: 60,           // ~1 second at 60fps
            fadeInFrames: 8,
            fadeOutFrames: 15,
            respawnRadius: 5,          // Spawn nearby, not across map
            color: [220, 240, 255],    // Light cyan-white
            opacity: 0.7,
          }}
        />

        {/* Buoy Layer */}
        <BuoyLayer
          visible={showBuoys}
          stations={buoyStations}
          onBuoyClick={handleBuoyClick}
        />

        {/* Favorite Markers */}
        {showFavorites && favorites.map((favorite) => (
          <Marker
            key={favorite.id}
            latitude={favorite.latitude}
            longitude={favorite.longitude}
            anchor="bottom"
          >
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  selectedLocation?.id === favorite.id
                    ? 'bg-blue-600 scale-125'
                    : 'bg-red-600 hover:scale-110'
                }`}
                title={favorite.name}
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      {/* Buoy Modal */}
      {selectedBuoy && (
        <BuoyModal
          station={selectedBuoy}
          onClose={() => setSelectedBuoy(null)}
        />
      )}
    </div>
  );
}
