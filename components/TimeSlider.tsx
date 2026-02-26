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

/** Compute metadata for each forecast hour */
function computeBlockMeta(referenceTime: string | null) {
  if (!referenceTime) return [];
  const refDate = new Date(referenceTime);

  return FORECAST_HOURS.map((fh, i) => {
    const blockDate = new Date(refDate.getTime() + fh * 3600 * 1000);
    const localHour = blockDate.getHours();
    const isNight = localHour >= 21 || localHour <= 5;

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

/** Format time for the pill: "10am Thu" */
function formatTimePill(isoString: string): string {
  const date = new Date(isoString);
  const hour = date.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h = hour % 12 || 12;
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${h}${ampm} ${day}`;
}

interface DisplayBlock {
  startIndex: number;
  endIndex: number;
  firstHour: number;
  isNight: boolean;
  isActive: boolean;
  isDayBoundary: boolean;
}

/** Group forecast hours into display blocks based on available width */
function computeDisplayBlocks(
  blockMeta: ReturnType<typeof computeBlockMeta>,
  currentIndex: number,
  containerWidth: number,
): DisplayBlock[] {
  const MIN_BLOCK_WIDTH = 6;
  const GAP = 1;
  const total = FORECAST_HOURS.length;

  // If no width yet or plenty of room, show all blocks
  const maxBlocks = containerWidth > 0
    ? Math.floor(containerWidth / (MIN_BLOCK_WIDTH + GAP))
    : total;
  const groupSize = Math.max(1, Math.ceil(total / Math.max(1, maxBlocks)));

  const blocks: DisplayBlock[] = [];
  for (let i = 0; i < total; i += groupSize) {
    const end = Math.min(i + groupSize - 1, total - 1);
    const firstMeta = blockMeta[i];

    // Check if any block in this group is a day boundary (excluding first group)
    let isDayBoundary = false;
    for (let j = i; j <= end; j++) {
      if (blockMeta[j]?.isDayBoundary && j > 0) {
        isDayBoundary = true;
        break;
      }
    }
    // First group always gets day boundary for label positioning
    if (i === 0) isDayBoundary = true;

    // Active if the current index falls within this group
    const isActive = currentIndex >= i && currentIndex <= end;

    blocks.push({
      startIndex: i,
      endIndex: end,
      firstHour: FORECAST_HOURS[i],
      isNight: firstMeta?.isNight ?? false,
      isActive,
      isDayBoundary,
    });
  }
  return blocks;
}

/** Compute day labels from display blocks */
function computeDayLabels(
  blockMeta: ReturnType<typeof computeBlockMeta>,
  displayBlocks: DisplayBlock[],
) {
  const labels: { blockIndex: number; label: string }[] = [];
  for (let bi = 0; bi < displayBlocks.length; bi++) {
    const db = displayBlocks[bi];
    // Find first day boundary in this display block
    for (let i = db.startIndex; i <= db.endIndex; i++) {
      if (blockMeta[i]?.isDayBoundary) {
        labels.push({ blockIndex: bi, label: blockMeta[i].dayLabel });
        break;
      }
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const currentIndex = useMemo(
    () => FORECAST_HOURS.indexOf(currentHour),
    [currentHour]
  );

  const blockMeta = useMemo(
    () => computeBlockMeta(referenceTime),
    [referenceTime]
  );

  // Measure container width for adaptive grouping
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const displayBlocks = useMemo(
    () => computeDisplayBlocks(blockMeta, currentIndex, containerWidth),
    [blockMeta, currentIndex, containerWidth]
  );

  const dayLabels = useMemo(
    () => computeDayLabels(blockMeta, displayBlocks),
    [blockMeta, displayBlocks]
  );

  const timePillText = validTime ? formatTimePill(validTime) : '\u2014';

  // Play animation
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepForward(); }
    else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
  }, [stepBack, stepForward]);

  // Pill position based on display block index
  const activeBlockIndex = displayBlocks.findIndex(b => b.isActive);
  const pillLeft = displayBlocks.length > 1 && activeBlockIndex >= 0
    ? (activeBlockIndex / (displayBlocks.length - 1)) * 100
    : 50;

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

      {/* Time Pill */}
      <div style={{ position: 'relative', height: 24, marginBottom: 4 }}>
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
          <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)' }}>
            &middot;
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#C17F5E' }}>
            {LAYER_LABELS[activeLayer]}
          </span>
        </div>
      </div>

      {/* Day Labels */}
      <div style={{ position: 'relative', height: 14, marginBottom: 2 }}>
        {dayLabels.map((dl) => (
          dl.visible && (
            <span
              key={dl.blockIndex}
              style={{
                position: 'absolute',
                left: `${displayBlocks.length > 1 ? (dl.blockIndex / (displayBlocks.length - 1)) * 100 : 0}%`,
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
        {displayBlocks.map((block, i) => {
          let bgColor: string;
          if (block.isActive) {
            bgColor = '#C17F5E';
          } else if (block.isNight) {
            bgColor = 'rgba(30, 30, 25, 0.5)';
          } else {
            bgColor = 'rgba(255, 255, 255, 0.18)';
          }

          return (
            <div
              key={block.startIndex}
              onClick={() => onChange(block.firstHour)}
              aria-current={block.isActive ? 'true' : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                height: 22,
                background: bgColor,
                borderLeft: block.isDayBoundary && i > 0
                  ? '1px solid rgba(255, 255, 255, 0.25)'
                  : 'none',
                transition: 'background 0.08s ease',
              }}
            />
          );
        })}
      </div>

      {/* Controls Row */}
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
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
