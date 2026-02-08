'use client';

import { useEffect, useState } from 'react';

type View = 'map' | 'favorites' | 'settings';

interface NavBarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  favoritesCount: number;
}

const NAV_ITEMS: { view: View; label: string; icon: string; testId: string }[] = [
  { view: 'map', label: 'Map', icon: '\uD83C\uDF0A', testId: 'nav-map' },
  { view: 'favorites', label: 'Favorites', icon: '\u2605', testId: 'nav-favorites' },
  { view: 'settings', label: 'Settings', icon: '\u2699', testId: 'nav-settings' },
];

export default function NavBar({ activeView, onViewChange, favoritesCount }: NavBarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    check();
    const mql = window.matchMedia('(max-width: 768px)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);

  if (isMobile) {
    return (
      <nav
        data-testid="nav-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'white',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 50,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {NAV_ITEMS.map(({ view, label, icon, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 16px',
                color: isActive ? '#3b82f6' : '#6b7280',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400 }}>{label}</span>
              {view === 'favorites' && favoritesCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 8,
                    background: '#3b82f6',
                    color: 'white',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 50,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a' }}>
        Sandbars
      </div>

      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        {NAV_ITEMS.map(({ view, label, testId }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={testId}
              onClick={() => onViewChange(view)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isActive ? '#eff6ff' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
                color: isActive ? '#3b82f6' : '#4b5563',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {label}
              {view === 'favorites' && favoritesCount > 0 && (
                <span
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
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
