'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/ui/Header';
import AddLocationModal from '@/components/map/AddLocationModal';
import { FavoriteLocation } from '@/types';

// Dynamically import MapView to avoid SSR issues with maplibre-gl
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
});

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Track client-side mount for hydration safety
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    checkUser();
    fetchFavorites();
  }, []);

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

  return (
    <div className="h-screen flex flex-col">
      <Header userEmail={user?.email} />

      {/* Full Screen Map */}
      <div className="flex-1 relative">
        {isMounted && (
          <MapView
            favorites={favorites}
            onMapClick={handleMapClick}
            showFavorites={true}
            showWaveLayer={true}
            showBuoyLayer={false}
            fullScreen={true}
          />
        )}
        {!isMounted && (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-white">Loading map...</div>
          </div>
        )}
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
