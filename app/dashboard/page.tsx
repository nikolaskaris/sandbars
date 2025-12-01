'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/ui/Header';
import FavoritesList from '@/components/favorites/FavoritesList';
import ForecastCard from '@/components/favorites/ForecastCard';
import AddLocationModal from '@/components/map/AddLocationModal';
import { FavoriteLocation, SurfForecast } from '@/types';

// Dynamically import MapView to avoid SSR issues with mapbox-gl
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
});

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<FavoriteLocation | null>(null);
  const [forecast, setForecast] = useState<SurfForecast[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
    fetchFavorites();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchForecast(selectedLocation.latitude, selectedLocation.longitude);
    }
  }, [selectedLocation]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth');
    } else {
      setUser(user);
    }
  };

  const fetchFavorites = async () => {
    const response = await fetch('/api/favorites');
    if (response.ok) {
      const data = await response.json();
      setFavorites(data);
    }
  };

  const fetchForecast = async (lat: number, lng: number) => {
    setForecastLoading(true);
    try {
      const response = await fetch(`/api/forecast?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        setForecast(data);
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setForecastLoading(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setPendingLocation({ lat, lng });
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (name: string, lat: number, lng: number) => {
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, latitude: lat, longitude: lng }),
    });

    if (response.ok) {
      await fetchFavorites();
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      const response = await fetch(`/api/favorites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(favorites.filter((f) => f.id !== id));
        if (selectedLocation?.id === id) {
          setSelectedLocation(null);
          setForecast([]);
        }
      }
    }
  };

  const handleSelectLocation = (favorite: FavoriteLocation) => {
    setSelectedLocation(favorite);
  };

  return (
    <div className="h-screen flex flex-col">
      <Header userEmail={user?.email} />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-96 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Favorite Locations</h2>
            <FavoritesList
              favorites={favorites}
              selectedId={selectedLocation?.id || null}
              onSelect={handleSelectLocation}
              onDelete={handleDeleteLocation}
            />
          </div>

          {selectedLocation && (
            <div className="p-6 border-t">
              <ForecastCard
                forecast={forecast}
                locationName={selectedLocation.name}
                loading={forecastLoading}
              />
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            favorites={favorites}
            onMapClick={handleMapClick}
            selectedLocation={selectedLocation}
          />
        </div>
      </div>

      <AddLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLocation}
        latitude={pendingLocation?.lat || 0}
        longitude={pendingLocation?.lng || 0}
      />
    </div>
  );
}
