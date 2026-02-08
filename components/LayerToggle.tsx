'use client';

export type MapLayer = 'waveHeight' | 'wavePeriod' | 'wind';

interface LayerToggleProps {
  activeLayer: MapLayer;
  onChange: (layer: MapLayer) => void;
}

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'waveHeight', label: 'Wave Height' },
  { id: 'wavePeriod', label: 'Wave Period' },
  { id: 'wind', label: 'Wind' },
];

export default function LayerToggle({ activeLayer, onChange }: LayerToggleProps) {
  return (
    <div
      data-testid="layer-toggle"
      style={{
        display: 'flex',
        width: 'fit-content',
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {LAYERS.map(({ id, label }, i) => {
        const isActive = id === activeLayer;
        return (
          <button
            key={id}
            data-testid={`layer-${id}`}
            onClick={() => onChange(id)}
            style={{
              padding: '6px 20px',
              whiteSpace: 'nowrap' as const,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'system-ui, sans-serif',
              background: isActive ? '#3b82f6' : 'white',
              color: isActive ? 'white' : '#4b5563',
              border: 'none',
              borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
