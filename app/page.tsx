'use client';

import { useState, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import NavBar, { View } from '@/components/NavBar';
import WaveMap from '@/components/WaveMap';
import LayersPanel from '@/components/LayersPanel';
import FavoritesPage from '@/components/FavoritesPage';
import SettingsPlaceholder from '@/components/SettingsPlaceholder';
import { MapLayer } from '@/components/LayerToggle';
import { getFavorites } from '@/lib/favorites';

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('map');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [initialSpot, setInitialSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const isMobile = useIsMobile();

  // Lifted layer state (was inside WaveMap)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('waveHeight');
  const [showBuoys, setShowBuoys] = useState(false);

  useEffect(() => {
    setFavoritesCount(getFavorites().length);
  }, [activeView]);

  const refreshFavoritesCount = useCallback(() => {
    setFavoritesCount(getFavorites().length);
  }, []);

  const handleViewSpot = useCallback((lat: number, lng: number, name: string) => {
    setInitialSpot({ lat, lng, name });
    setActiveView('map');
  }, []);

  // Content area offset: sidebar 72px on desktop, bottom tab 56px on mobile
  const contentStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    ...(isMobile
      ? { left: 0, bottom: 56 }
      : { left: 72, bottom: 0 }),
  };

  return (
    <>
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        favoritesCount={favoritesCount}
      />

      <div style={contentStyle}>
        {/* Map is always mounted */}
        <WaveMap
          onFavoritesChange={refreshFavoritesCount}
          initialSpot={initialSpot}
          activeLayer={activeLayer}
          showBuoys={showBuoys}
          onSpotSelect={() => { if (activeView !== 'map') setActiveView('map'); }}
        />

        {/* Overlay panels */}
        {activeView === 'layers' && (
          <LayersPanel
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showBuoys={showBuoys}
            onBuoyToggle={setShowBuoys}
            onClose={() => setActiveView('map')}
          />
        )}
        {activeView === 'favorites' && (
          <FavoritesPage
            onViewSpot={handleViewSpot}
            onFavoritesChange={refreshFavoritesCount}
            onClose={() => setActiveView('map')}
          />
        )}
        {activeView === 'settings' && (
          <SettingsPlaceholder />
        )}
      </div>
    </>
  );
}
