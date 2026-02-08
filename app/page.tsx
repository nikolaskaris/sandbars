'use client';

import { useState, useCallback, useEffect } from 'react';
import NavBar from '@/components/NavBar';
import WaveMap from '@/components/WaveMap';
import FavoritesPage from '@/components/FavoritesPage';
import SettingsPlaceholder from '@/components/SettingsPlaceholder';
import { getFavorites } from '@/lib/favorites';

type View = 'map' | 'favorites' | 'settings';

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('map');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [initialSpot, setInitialSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setFavoritesCount(getFavorites().length);
  }, [activeView]);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    check();
    const mql = window.matchMedia('(max-width: 768px)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  const refreshFavoritesCount = useCallback(() => {
    setFavoritesCount(getFavorites().length);
  }, []);

  const handleViewSpot = useCallback((lat: number, lng: number, name: string) => {
    setInitialSpot({ lat, lng, name });
    setActiveView('map');
  }, []);

  // NavBar offset: 48px top on desktop, 56px bottom on mobile
  const contentStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    ...(isMobile
      ? { top: 0, bottom: 56 }
      : { top: 48, bottom: 0 }),
  };

  return (
    <>
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        favoritesCount={favoritesCount}
      />

      <div style={contentStyle}>
        {activeView === 'map' && (
          <WaveMap
            onFavoritesChange={refreshFavoritesCount}
            initialSpot={initialSpot}
          />
        )}
        {activeView === 'favorites' && (
          <FavoritesPage
            onViewSpot={handleViewSpot}
            onFavoritesChange={refreshFavoritesCount}
          />
        )}
        {activeView === 'settings' && (
          <SettingsPlaceholder />
        )}
      </div>
    </>
  );
}
