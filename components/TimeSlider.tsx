'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { FORECAST_HOURS } from '@/lib/wave-utils';
import { MapLayer } from './LayerToggle';

interface TimeSliderProps {
  currentHour: number;
  validTime: string | null;
  referenceTime: string | null;
  activeLayer: MapLayer;
  isLoading: boolean;
  onChange: (hour: number) => void;
}

const LAYER_LABELS: Record<MapLayer, string> = {
  waveHeight: 'Wave Height',
  wavePeriod: 'Wave Period',
  wind: 'Wind Speed',
};

/**
 * Compute block metadata for each forecast hour:
 * - isNight: local hour is 21-23 or 0-5
 * - isDayBoundary: local hour crosses midnight (new calendar day)
 * - dayLabel: "Thu", "Fri", etc. for the first block of a new day
 */
function computeBlockMeta(referenceTime: string | null) {
  if (!referenceTime) return [];

  const refDate = new Date(referenceTime);

  return FORECAST_HOURS.map((fh, i) => {
    const blockDate = new Date(refDate.getTime() + fh * 3600 * 1000);
    const localHour = blockDate.getHours();
    const isNight = localHour >= 21 || localHour <= 5;

    // Day boundary: check if this block starts a new calendar day vs previous block
    let isDayBoundary = false;
    if (i === 0) {
      isDayBoundary = true;
    } else {
      const prevDate = new Date(refDate.getTime() + FORECAST_HOURS[i - 1] * 3600 * 1000);
      isDayBoundary = blockDate.toLocaleDateString() !== prevDate.toLocaleDateString();
    }

    const dayLabel = blockDate.toLocaleDateString('en-US', { weekday: 'short' });

    return { isNight, isDayBoundary, dayLabel, date: blockDate };
  });
}

/**
 * Format time for the pill: "10am Thu" or "3pm Sat"
 */
function formatTimePill(isoString: string): string {
  const date = new Date(isoString);
  const hour = date.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h = hour % 12 || 12;
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${h}${ampm} ${day}`;
}

/**
 * Compute day label positions (index of first block in each new day)
 */
function computeDayLabels(blockMeta: ReturnType<typeof computeBlockMeta>) {
  const labels: { index: number; label: string }[] = [];
  for (let i = 0; i < blockMeta.length; i++) {
    if (blockMeta[i].isDayBoundary) {
      labels.push({ index: i, label: blockMeta[i].dayLabel });
    }
  }
  // Show every day for first ~4 days, then every other day
  return labels.map((l, i) => ({
    ...l,
    visible: i < 4 || i % 2 === 0,
  }));
}

export default function TimeSlider({
  currentHour,
  validTime,
  referenceTime,
  activeLayer,
  isLoading,
  onChange,
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentIndex = useMemo(
    () => FORECAST_HOURS.indexOf(currentHour),
    [currentHour]
  );

  const blockMeta = useMemo(
    () => computeBlockMeta(referenceTime),
    [referenceTime]
  );

  const dayLabels = useMemo(
    () => computeDayLabels(blockMeta),
    [blockMeta]
  );

  const timePillText = validTime ? formatTimePill(validTime) : '\u2014';
  const totalBlocks = FORECAST_HOURS.length;

  // Play animation: use ref to access latest currentIndex inside interval
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const next = currentIndexRef.current + 1;
      if (next >= FORECAST_HOURS.length) {
        setIsPlaying(false);
        return;
      }
      onChange(FORECAST_HOURS[next]);
    }, 500);
    playIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [isPlaying, onChange]);

  const stepBack = useCallback(() => {
    const prev = Math.max(0, currentIndex - 1);
    onChange(FORECAST_HOURS[prev]);
  }, [currentIndex, onChange]);

  const stepForward = useCallback(() => {
    const next = Math.min(FORECAST_HOURS.length - 1, currentIndex + 1);
    onChange(FORECAST_HOURS[next]);
  }, [currentIndex, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepForward(); }
    else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
  }, [stepBack, stepForward]);

  // Pill position: percentage based on active block index
  const pillLeft = totalBlocks > 0 ? (currentIndex / (totalBlocks - 1)) * 100 : 0;

  return (
    <div
      data-testid="time-slider"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '8px 16px 12px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={FORECAST_HOURS.length - 1}
      aria-valuenow={currentIndex}
      aria-label="Forecast time"
    >
      {/* Hidden range input for test compatibility */}
      <input
        type="range"
        min={0}
        max={FORECAST_HOURS.length - 1}
        step={1}
        value={currentIndex}
        onChange={(e) => onChange(FORECAST_HOURS[parseInt(e.target.value, 10)])}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Time Pill — floating above active block */}
      <div style={{
        position: 'relative',
        height: 24,
        marginBottom: 4,
      }}>
        <div
          data-testid="forecast-time-label"
          style={{
            position: 'absolute',
            left: `${pillLeft}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(30, 30, 25, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 4,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            transition: 'left 0.1s ease-out',
            opacity: isLoading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'baseline',
            gap: 5,
          }}
        >
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {timePillText}
          </span>
          <span style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.45)',
          }}>
            &middot;
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#C17F5E',
          }}>
            {LAYER_LABELS[activeLayer]}
          </span>
        </div>
      </div>

      {/* Day Labels — above block grid */}
      <div style={{
        position: 'relative',
        height: 14,
        marginBottom: 2,
      }}>
        {dayLabels.map((dl) => (
          dl.visible && (
            <span
              key={dl.index}
              style={{
                position: 'absolute',
                left: `${(dl.index / (totalBlocks - 1)) * 100}%`,
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.5)',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {dl.label}
            </span>
          )
        ))}
      </div>

      {/* Block Grid */}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          gap: 1,
          borderRadius: 3,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {FORECAST_HOURS.map((fh, i) => {
          const meta = blockMeta[i];
          const isActive = i === currentIndex;

          let bgColor: string;
          if (isActive) {
            bgColor = '#C17F5E';
          } else if (meta?.isNight) {
            bgColor = 'rgba(30, 30, 25, 0.5)';
          } else {
            bgColor = 'rgba(255, 255, 255, 0.18)';
          }

          return (
            <div
              key={fh}
              onClick={() => onChange(fh)}
              aria-current={isActive ? 'true' : undefined}
              style={{
                flex: 1,
                height: 22,
                background: bgColor,
                borderLeft: meta?.isDayBoundary && i > 0
                  ? '1px solid rgba(255, 255, 255, 0.25)'
                  : 'none',
                transition: 'background 0.08s ease',
              }}
            />
          );
        })}
      </div>

      {/* Controls Row */}
      <div style={{
        display: 'flex',
        gap: 2,
        marginTop: 6,
      }}>
        <button
          onClick={stepBack}
          aria-label="Step back"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 14,
            padding: '2px 4px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          &#8249;
        </button>
        <button
          onClick={() => setIsPlaying(p => !p)}
          aria-label={isPlaying ? 'Pause forecast animation' : 'Play forecast animation'}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 14,
            padding: '2px 4px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button
          onClick={stepForward}
          aria-label="Step forward"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 14,
            padding: '2px 4px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          &#8250;
        </button>
      </div>
    </div>
  );
}
