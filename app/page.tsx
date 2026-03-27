'use client';

import { useState, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import NavBar, { View } from '@/components/NavBar';
import WaveMap from '@/components/WaveMap';
import LayersPanel from '@/components/LayersPanel';
import FavoritesPage from '@/components/FavoritesPage';
import Settings from '@/components/Settings';
import { MapLayer } from '@/components/LayerToggle';
import { useAuth } from '@/contexts/AuthContext';
import { favoritesService } from '@/lib/favorites-service';

export default function HomePage() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<View>('map');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [initialSpot, setInitialSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const isMobile = useIsMobile();

  // Lifted layer state (was inside WaveMap)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('waveHeight');
  const [showBuoys, setShowBuoys] = useState(false);
  const [showBathymetry, setShowBathymetry] = useState(false);

  useEffect(() => {
    favoritesService.getFavorites(user?.id || null).then(favs => setFavoritesCount(favs.length));
  }, [activeView, user]);

  const refreshFavoritesCount = useCallback(() => {
    favoritesService.getFavorites(user?.id || null).then(favs => setFavoritesCount(favs.length));
  }, [user]);

  const handleViewSpot = useCallback((lat: number, lng: number, name: string) => {
    setInitialSpot({ lat, lng, name });
    setActiveView('map');
  }, []);

  const handleClearInitialSpot = useCallback(() => {
    setInitialSpot(null);
  }, []);

  const handleSpotSelect = useCallback(() => {
    setActiveView('map');
  }, []);

  // Content area offset: sidebar 72px on desktop, bottom nav 64px + safe area on mobile
  const contentStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    ...(isMobile
      ? { left: 0, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }
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
          onClearInitialSpot={handleClearInitialSpot}
          activeLayer={activeLayer}
          showBuoys={showBuoys}
          showBathymetry={showBathymetry}
          onSpotSelect={handleSpotSelect}
        />

        {/* Overlay panels */}
        {activeView === 'layers' && (
          <LayersPanel
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showBuoys={showBuoys}
            onBuoyToggle={setShowBuoys}
            showBathymetry={showBathymetry}
            onBathymetryToggle={setShowBathymetry}
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
          <Settings />
        )}
      </div>
    </>
  );
}
