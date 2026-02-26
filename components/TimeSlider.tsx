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

/** Per-forecast-hour metadata with flex weight */
interface BlockInfo {
  index: number;
  hour: number;
  flexWeight: number; // 1 for 3hr, 2 for 6hr
  isNight: boolean;
  isDayBoundary: boolean;
}

/** Build block info — one per forecast hour */
function computeBlockInfo(
  blockMeta: ReturnType<typeof computeBlockMeta>,
): BlockInfo[] {
  return FORECAST_HOURS.map((hour, i) => {
    const duration = i === 0 ? 3 : hour - FORECAST_HOURS[i - 1];
    return {
      index: i,
      hour,
      flexWeight: duration / 3, // 3hr → 1, 6hr → 2
      isNight: blockMeta[i]?.isNight ?? false,
      isDayBoundary: blockMeta[i]?.isDayBoundary ?? false,
    };
  });
}

interface DisplayBlock {
  hour: number;           // first hour in the group (used for onClick)
  flexWeight: number;     // sum of constituent flex weights
  isNight: boolean;       // from first block in group
  isDayBoundary: boolean; // from first block in group
  indices: number[];      // which FORECAST_HOURS indices this group covers
}

/** Group blocks adaptively based on container width */
function computeDisplayBlocks(
  blocks: BlockInfo[],
  containerWidth: number,
): DisplayBlock[] {
  if (blocks.length === 0) return [];

  const totalFlex = blocks.reduce((s, b) => s + b.flexWeight, 0);
  const pxPerFlex = containerWidth / totalFlex;
  const MIN_BLOCK_PX = 6;

  // If smallest block (flex 1) is wide enough, no grouping needed
  if (pxPerFlex >= MIN_BLOCK_PX) {
    return blocks.map(b => ({
      hour: b.hour,
      flexWeight: b.flexWeight,
      isNight: b.isNight,
      isDayBoundary: b.isDayBoundary,
      indices: [b.index],
    }));
  }

  // Target flex per group so each group is at least 8px wide
  const TARGET_PX = 8;
  const targetFlex = Math.ceil(TARGET_PX / pxPerFlex);

  const groups: DisplayBlock[] = [];
  let current: DisplayBlock | null = null;

  for (const b of blocks) {
    if (!current || current.flexWeight >= targetFlex) {
      if (current) groups.push(current);
      current = {
        hour: b.hour,
        flexWeight: b.flexWeight,
        isNight: b.isNight,
        isDayBoundary: b.isDayBoundary,
        indices: [b.index],
      };
    } else {
      current.flexWeight += b.flexWeight;
      current.indices.push(b.index);
    }
  }
  if (current) groups.push(current);

  return groups;
}

/** Compute time-based percentage for positioning */
function timePercent(hour: number): number {
  const first = FORECAST_HOURS[0];
  const last = FORECAST_HOURS[FORECAST_HOURS.length - 1];
  return ((hour - first) / (last - first)) * 100;
}

/** Compute day labels — show ALL days, positioned by time */
function computeDayLabels(
  blockMeta: ReturnType<typeof computeBlockMeta>,
) {
  const labels: { hour: number; label: string; percent: number }[] = [];
  for (let i = 0; i < blockMeta.length; i++) {
    if (blockMeta[i]?.isDayBoundary) {
      labels.push({
        hour: FORECAST_HOURS[i],
        label: blockMeta[i].dayLabel,
        percent: timePercent(FORECAST_HOURS[i]),
      });
    }
  }
  return labels;
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
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentIndex = useMemo(
    () => FORECAST_HOURS.indexOf(currentHour),
    [currentHour]
  );

  const blockMeta = useMemo(
    () => computeBlockMeta(referenceTime),
    [referenceTime]
  );

  const blockInfo = useMemo(
    () => computeBlockInfo(blockMeta),
    [blockMeta]
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
    () => computeDisplayBlocks(blockInfo, containerWidth),
    [blockInfo, containerWidth]
  );

  const dayLabels = useMemo(
    () => computeDayLabels(blockMeta),
    [blockMeta]
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

  // Pill position based on time percentage
  const pillLeft = timePercent(currentHour);

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
      <div data-testid="day-labels" style={{ position: 'relative', height: 14, marginBottom: 2 }}>
        {dayLabels.map((dl) => (
          <span
            key={dl.hour}
            style={{
              position: 'absolute',
              left: `${dl.percent}%`,
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
        ))}
      </div>

      {/* Block Grid */}
      <div
        ref={containerRef}
        data-testid="slider-blocks"
        style={{
          display: 'flex',
          gap: 1,
          borderRadius: 3,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {displayBlocks.map((block, i) => {
          const isActive = block.indices.includes(currentIndex);
          let bgColor: string;
          if (isActive) {
            bgColor = '#C17F5E';
          } else if (block.isNight) {
            bgColor = 'rgba(30, 30, 25, 0.5)';
          } else {
            bgColor = 'rgba(255, 255, 255, 0.18)';
          }

          return (
            <div
              key={block.hour}
              onClick={() => onChange(block.hour)}
              aria-current={isActive ? 'true' : undefined}
              style={{
                flex: block.flexWeight,
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
