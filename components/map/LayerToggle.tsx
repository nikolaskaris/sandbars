'use client';

import { useState, useEffect, useCallback } from 'react';

interface LayerConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface LayerToggleProps {
  layers: LayerConfig[];
  onToggle: (layerId: string, enabled: boolean) => void;
}

const STORAGE_KEY = 'sandbars-map-layers';

/**
 * Load layer preferences from localStorage
 */
function loadLayerPreferences(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save layer preferences to localStorage
 */
function saveLayerPreferences(prefs: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export default function LayerToggle({ layers, onToggle }: LayerToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});

  // Load preferences on mount
  useEffect(() => {
    const prefs = loadLayerPreferences();
    setPreferences(prefs);

    // Apply stored preferences
    layers.forEach(layer => {
      if (prefs[layer.id] !== undefined && prefs[layer.id] !== layer.enabled) {
        onToggle(layer.id, prefs[layer.id]);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((layerId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    onToggle(layerId, newEnabled);

    // Save preference
    const newPrefs = { ...preferences, [layerId]: newEnabled };
    setPreferences(newPrefs);
    saveLayerPreferences(newPrefs);
  }, [onToggle, preferences]);

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white rounded-lg shadow-md p-2 hover:bg-gray-50 transition-colors"
        aria-label="Toggle map layers"
        title="Map Layers"
      >
        <svg
          className="w-5 h-5 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-3 py-1 border-b border-gray-100 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Map Layers
            </span>
          </div>

          {layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => handleToggle(layer.id, layer.enabled)}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                layer.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {layer.icon}
              </div>
              <span className={`text-sm ${layer.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                {layer.label}
              </span>
              <div className={`ml-auto w-8 h-5 rounded-full transition-colors ${
                layer.enabled ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-0.5 ${
                  layer.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
          ))}

          {/* Legend */}
          <div className="px-3 pt-2 mt-1 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Buoy Types
            </span>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Weather Buoy</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>C-MAN Station</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span>Tsunami Buoy</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>TAO/PIRATA</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Buoy icon for use in layer config
export function BuoyIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
