'use client';

import { Map, Star, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

type View = 'map' | 'favorites' | 'settings';

interface NavBarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  favoritesCount: number;
}

const NAV_ITEMS: { view: View; label: string; icon: typeof Map; testId: string }[] = [
  { view: 'map', label: 'Map', icon: Map, testId: 'nav-map' },
  { view: 'favorites', label: 'Favorites', icon: Star, testId: 'nav-favorites' },
  { view: 'settings', label: 'Settings', icon: Settings, testId: 'nav-settings' },
];

export default function NavBar({ activeView, onViewChange, favoritesCount }: NavBarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <nav
        data-testid="nav-bar"
        className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex justify-around items-center z-50 pb-safe"
      >
        {NAV_ITEMS.map(({ view, label, icon: Icon, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              className={[
                'flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer px-5 py-2 relative min-h-[44px] min-w-[44px] justify-center',
                isActive ? 'text-accent' : 'text-text-secondary',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>{label}</span>
              {view === 'favorites' && favoritesCount > 0 && (
                <span className="absolute top-0.5 right-2 bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
                  {favoritesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      data-testid="nav-bar"
      className="fixed top-0 left-0 right-0 h-12 bg-surface border-b border-border flex items-center px-5 z-50 shadow-sm"
    >
      <span className="text-lg font-medium text-text-primary">Sandbars</span>

      <div className="flex gap-1 ml-auto">
        {NAV_ITEMS.map(({ view, label, icon: Icon, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              className={[
                'flex items-center gap-1.5 bg-transparent border-none rounded-md px-3.5 py-1.5 cursor-pointer text-sm transition-colors duration-150',
                isActive
                  ? 'text-accent font-medium border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              {label}
              {view === 'favorites' && favoritesCount > 0 && (
                <span className="bg-accent text-white rounded-full w-[18px] h-[18px] flex items-center justify-center text-[11px] font-medium">
                  {favoritesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
