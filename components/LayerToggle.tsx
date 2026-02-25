'use client';

import { Waves, Timer, Wind } from 'lucide-react';

export type MapLayer = 'waveHeight' | 'wavePeriod' | 'wind';

interface LayerToggleProps {
  activeLayer: MapLayer;
  onChange: (layer: MapLayer) => void;
}

const LAYERS: { id: MapLayer; label: string; icon: typeof Waves }[] = [
  { id: 'waveHeight', label: 'Height', icon: Waves },
  { id: 'wavePeriod', label: 'Period', icon: Timer },
  { id: 'wind', label: 'Wind', icon: Wind },
];

export default function LayerToggle({ activeLayer, onChange }: LayerToggleProps) {
  return (
    <div
      data-testid="layer-toggle"
      className="flex w-fit bg-surface rounded-md shadow-sm border border-border"
    >
      {LAYERS.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeLayer;
        return (
          <button
            key={id}
            data-testid={`layer-${id}`}
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-1.5 px-3.5 py-1.5 text-sm whitespace-nowrap',
              'border-b-2 transition-colors duration-150',
              isActive
                ? 'text-accent font-medium border-accent bg-accent-muted'
                : 'text-text-secondary border-transparent hover:bg-surface-secondary',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
