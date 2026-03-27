'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface LocationState {
  lat: number;
  lng: number;
  accuracy: number;
}

interface LocationContextType {
  location: LocationState | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
}

const LocationContext = createContext<LocationContextType>({
  location: null,
  loading: false,
  error: null,
  requestLocation: () => {},
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (location) return; // Already have it
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.code === 1 ? 'Location permission denied' : 'Could not get location');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [location]);

  return (
    <LocationContext.Provider value={{ location, loading, error, requestLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
