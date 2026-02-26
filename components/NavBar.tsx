'use client';

import { Map, Layers, Star, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

export type View = 'map' | 'layers' | 'favorites' | 'settings';

interface NavBarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  favoritesCount: number;
}

const TOP_NAV_ITEMS: { view: View; label: string; icon: typeof Map; testId: string }[] = [
  { view: 'map', label: 'Map', icon: Map, testId: 'nav-map' },
  { view: 'layers', label: 'Layers', icon: Layers, testId: 'nav-layers' },
  { view: 'favorites', label: 'Favorites', icon: Star, testId: 'nav-favorites' },
];

const BOTTOM_NAV_ITEM = { view: 'settings' as View, label: 'Settings', icon: Settings, testId: 'nav-settings' };

export default function NavBar({ activeView, onViewChange, favoritesCount }: NavBarProps) {
  const isMobile = useIsMobile();

  const allItems = [...TOP_NAV_ITEMS, BOTTOM_NAV_ITEM];

  if (isMobile) {
    return (
      <nav
        data-testid="nav-bar"
        className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex justify-around items-center z-50 pb-safe"
      >
        {allItems.map(({ view, label, icon: Icon, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              className={[
                'flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer px-4 py-2 relative min-h-[44px] min-w-[44px] justify-center',
                isActive ? 'text-accent' : 'text-text-secondary',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className={`text-[11px] ${isActive ? 'font-medium' : ''}`}>{label}</span>
              {view === 'favorites' && favoritesCount > 0 && (
                <span className="absolute top-0.5 right-1 bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
                  {favoritesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  // Desktop: vertical sidebar
  return (
    <nav
      data-testid="nav-bar"
      className="fixed top-0 left-0 bottom-0 w-[72px] bg-surface border-r border-border flex flex-col items-center z-50 shadow-sm"
    >
      {/* Wordmark */}
      <div className="py-4">
        <span className="text-sm font-medium text-text-primary">Sandbars</span>
      </div>

      {/* Top nav items */}
      <div className="flex flex-col items-center gap-1 w-full">
        {TOP_NAV_ITEMS.map(({ view, label, icon: Icon, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              className={[
                'flex flex-col items-center gap-1 w-full py-2.5 cursor-pointer bg-transparent border-none relative transition-colors duration-150',
                isActive
                  ? 'text-accent bg-accent-muted'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r-full" />
              )}
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className={`text-[11px] leading-none ${isActive ? 'font-medium' : ''}`}>{label}</span>
              {view === 'favorites' && favoritesCount > 0 && (
                <span className="absolute top-1 right-2 bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
                  {favoritesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <div className="w-full pb-4">
        <button
          data-testid={BOTTOM_NAV_ITEM.testId}
          onClick={() => onViewChange(BOTTOM_NAV_ITEM.view)}
          className={[
            'flex flex-col items-center gap-1 w-full py-2.5 cursor-pointer bg-transparent border-none relative transition-colors duration-150',
            activeView === 'settings'
              ? 'text-accent bg-accent-muted'
              : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
          ].join(' ')}
        >
          {activeView === 'settings' && (
            <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r-full" />
          )}
          <Settings className="h-5 w-5" strokeWidth={1.5} />
          <span className={`text-[11px] leading-none ${activeView === 'settings' ? 'font-medium' : ''}`}>Settings</span>
        </button>
      </div>
    </nav>
  );
}
