'use client';

import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import NavBar, { View } from '@/components/NavBar';
import WaveMap from '@/components/WaveMap';
import LayersPanel from '@/components/LayersPanel';
import SettingsPlaceholder from '@/components/SettingsPlaceholder';
import IconButton from '@/components/ui/IconButton';
import { MapLayer } from '@/components/LayerToggle';
import { getFavorites } from '@/lib/favorites';

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('map');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [initialSpot, setInitialSpot] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const isMobile = useIsMobile();

  // Lifted layer state (was inside WaveMap)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('waveHeight');
  const [showBuoys, setShowBuoys] = useState(true);

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
          <FavoritesPlaceholder onClose={() => setActiveView('map')} />
        )}
        {activeView === 'settings' && (
          <SettingsPlaceholder />
        )}
      </div>
    </>
  );
}

function FavoritesPlaceholder({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-surface rounded-t-lg shadow-md border-t border-border z-30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-primary">Favorites</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
        </div>
        <p className="text-sm text-text-secondary">Favorites panel coming next</p>
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 bottom-0 w-[300px] bg-surface border-r border-border shadow-md z-30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Favorites</h2>
        <IconButton aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
      </div>
      <p className="text-sm text-text-secondary">Favorites panel coming next</p>
    </div>
  );
}
