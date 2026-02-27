'use client';

import { X, Waves, Timer, Wind } from 'lucide-react';
import { MapLayer } from './LayerToggle';
import Toggle from './ui/Toggle';
import IconButton from './ui/IconButton';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LayersPanelProps {
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  showBuoys: boolean;
  onBuoyToggle: (show: boolean) => void;
  showBathymetry: boolean;
  onBathymetryToggle: (show: boolean) => void;
  onClose: () => void;
}

const LAYER_OPTIONS: { id: MapLayer; label: string; icon: typeof Waves }[] = [
  { id: 'waveHeight', label: 'Wave Height', icon: Waves },
  { id: 'wavePeriod', label: 'Wave Period', icon: Timer },
  { id: 'wind', label: 'Wind Speed', icon: Wind },
];

export default function LayersPanel({
  activeLayer,
  onLayerChange,
  showBuoys,
  onBuoyToggle,
  showBathymetry,
  onBathymetryToggle,
  onClose,
}: LayersPanelProps) {
  const isMobile = useIsMobile();

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-text-primary">Layers</h2>
        <IconButton aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.5} />
        </IconButton>
      </div>

      {/* Data Layer section */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-xs font-medium text-text-tertiary mb-2">Data Layer</div>
        <div className="flex flex-col gap-0.5">
          {LAYER_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`layer-${id}`}
              onClick={() => onLayerChange(id)}
              className={[
                'flex items-center gap-2 px-2.5 py-2 rounded text-sm w-full text-left transition-colors duration-100 min-h-[36px]',
                activeLayer === id
                  ? 'bg-accent-muted text-accent font-medium'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overlays section */}
      <div className="px-4 pb-4">
        <div className="border-t border-border pt-3">
          <div className="text-xs font-medium text-text-tertiary mb-2">Overlays</div>
          <div className="flex items-center gap-2 px-2.5 py-1.5" data-testid="buoy-toggle">
            <Toggle
              checked={showBuoys}
              onChange={onBuoyToggle}
              size="sm"
            />
            <div className="w-2.5 h-2.5 rounded-full bg-surface border-text-primary border-[1.5px]" />
            <span className="text-sm text-text-secondary">NDBC Buoys</span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5" data-testid="bathymetry-toggle">
            <Toggle
              checked={showBathymetry}
              onChange={onBathymetryToggle}
              size="sm"
            />
            <div className="w-2.5 h-0.5 rounded-sm" style={{ backgroundColor: '#64748B' }} />
            <span className="text-sm text-text-secondary">Bathymetry</span>
          </div>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        data-testid="layers-panel"
        className="fixed bottom-16 left-0 right-0 bg-surface rounded-t-lg shadow-md border-t border-border z-30 animate-slide-in-up"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      data-testid="layers-panel"
      className="absolute top-0 left-0 bottom-0 w-[300px] bg-surface border-r border-border shadow-md z-30 animate-slide-in-left"
    >
      {content}
    </div>
  );
}
