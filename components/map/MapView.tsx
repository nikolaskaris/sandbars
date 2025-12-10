'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FavoriteLocation } from '@/types';
import MapSearch from './MapSearch';

interface MapViewProps {
  favorites: FavoriteLocation[];
  onMapClick?: (lat: number, lng: number) => void;
  selectedLocation?: FavoriteLocation | null;
}

export default function MapView({ favorites, onMapClick, selectedLocation }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const [viewState, setViewState] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 9,
  });

  const handleMapClick = useCallback(
    (event: any) => {
      const { lngLat } = event;
      if (onMapClick) {
        onMapClick(lngLat.lat, lngLat.lng);
      }
    },
    [onMapClick]
  );

  const flyToLocation = useCallback((lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 12,
        duration: 500, // Fast animation (0.5 seconds)
      });
    }
  }, []);

  const handleSearchSelect = useCallback((lng: number, lat: number, placeName: string) => {
    flyToLocation(lat, lng);
  }, [flyToLocation]);

  // Fly to selected location when it changes
  useEffect(() => {
    if (selectedLocation) {
      flyToLocation(selectedLocation.latitude, selectedLocation.longitude);
    }
  }, [selectedLocation, flyToLocation]);

  return (
    <div className="relative w-full h-full">
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 z-10">
        <MapSearch onSelect={handleSearchSelect} />
      </div>

      <Map
      ref={mapRef}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      onClick={handleMapClick}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-right" />

      {favorites.map((favorite) => (
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
    </div>
  );
}
