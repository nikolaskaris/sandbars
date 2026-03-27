'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { FORECAST_HOURS } from '@/lib/wave-utils';
import { MapLayer } from './LayerToggle';
import { LAYER_COLORS } from '@/lib/layer-colors';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TimeSliderProps {
  currentHour: number;
  validTime: string | null;
  referenceTime: string | null;
  activeLayer: MapLayer;
  isLoading: boolean;
  onChange: (hour: number) => void;
}

// Uniform 3-hourly display grid: [0, 3, 6, ..., 384] — 129 entries, 8 per day
const UNIFORM_HOURS: number[] = [];
for (let h = 0; h <= FORECAST_HOURS[FORECAST_HOURS.length - 1]; h += 3) {
  UNIFORM_HOURS.push(h);
}

/** Map a uniform display hour to the nearest actual forecast hour */
function nearestForecastHour(displayHour: number): number {
  let closest = FORECAST_HOURS[0];
  let minDiff = Math.abs(displayHour - closest);
  for (const fh of FORECAST_HOURS) {
    const diff = Math.abs(displayHour - fh);
    if (diff < minDiff) { minDiff = diff; closest = fh; }
  }
  return closest;
}

/** Format time for the pill: "2pm Wed, Apr 2" */
function formatTimePill(isoString: string): string {
  const date = new Date(isoString);
  const hour = date.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h = hour % 12 || 12;
  const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${h}${ampm} ${dayStr}`;
}

/** Format hour (0-23) as compact 12h label: "12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p" */
function formatHourCompact(hour24: number): string {
  const ampm = hour24 >= 12 ? 'p' : 'a';
  const h = hour24 % 12 || 12;
  return `${h}${ampm}`;
}

/** Convert rgb(r,g,b) string to rgba(r,g,b,a) */
function rgbToRgba(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
}

/** Shared button style for step/play controls */
const CONTROL_BUTTON_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: 14,
  padding: '2px 4px',
  cursor: 'pointer',
  lineHeight: 1,
};

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
  const isMobile = useIsMobile();

  const currentIndex = useMemo(
    () => FORECAST_HOURS.indexOf(currentHour),
    [currentHour]
  );

  // Uniform block data — one block per 3-hour slot across all 16 days
  const blockData = useMemo(() => {
    if (!referenceTime) return [];
    const refTime = new Date(referenceTime).getTime();

    return UNIFORM_HOURS.map((displayHour, index) => {
      const forecastHour = nearestForecastHour(displayHour);
      const dateTime = new Date(refTime + displayHour * 3600000);
      const localHour = dateTime.getHours();
      const isNight = localHour >= 21 || localHour <= 5;

      const prevDateTime = index > 0
        ? new Date(refTime + UNIFORM_HOURS[index - 1] * 3600000)
        : null;
      const isDayBoundary = index === 0 || (prevDateTime !== null &&
        dateTime.toLocaleDateString() !== prevDateTime.toLocaleDateString());

      const dayLabel = dateTime.toLocaleDateString('en-US', { weekday: 'short' });

      return { index, displayHour, forecastHour, dateTime, localHour, isNight, isDayBoundary, dayLabel };
    });
  }, [referenceTime]);

  // Day labels positioned by block index (uniform spacing) — desktop only
  const dayLabels = useMemo(() => {
    return blockData
      .filter(b => b.isDayBoundary)
      .map(b => ({
        label: b.dayLabel,
        leftPercent: (b.index / blockData.length) * 100,
      }));
  }, [blockData]);

  // Group blocks by day — mobile only
  const dayGroups = useMemo(() => {
    const groups: { dateLabel: string; blocks: typeof blockData }[] = [];
    let current: typeof groups[0] | null = null;
    for (const block of blockData) {
      if (block.isDayBoundary || !current) {
        current = {
          dateLabel: block.dateTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          blocks: [],
        };
        groups.push(current);
      }
      current.blocks.push(block);
    }
    return groups;
  }, [blockData]);

  const timePillText = validTime ? formatTimePill(validTime) : '\u2014';

  // Desktop pill position based on block index
  const activeBlockIndex = blockData.findIndex(b => b.forecastHour === currentHour);
  const pillLeft = blockData.length > 0 && activeBlockIndex >= 0
    ? (activeBlockIndex / blockData.length) * 100
    : 0;

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

  // Mobile: auto-scroll to active tick
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTickRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (!isMobile || !activeTickRef.current) return;
    activeTickRef.current.scrollIntoView({
      behavior: initialScrollDone.current ? 'smooth' : 'instant' as ScrollBehavior,
      inline: 'center',
      block: 'nearest',
    });
    initialScrollDone.current = true;
  }, [currentHour, isMobile]);

  // Shared outer wrapper props
  const outerProps = {
    'data-testid': 'time-slider',
    onKeyDown: handleKeyDown,
    tabIndex: 0,
    role: 'slider' as const,
    'aria-valuemin': 0,
    'aria-valuemax': FORECAST_HOURS.length - 1,
    'aria-valuenow': currentIndex,
    'aria-label': 'Forecast time',
  };

  // Hidden range input for test compatibility
  const hiddenInput = (
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
  );

  // ─── MOBILE LAYOUT ─────────────────────────────────────────────────
  if (isMobile) {
    const layerConfig = LAYER_COLORS[activeLayer];

    return (
      <div
        {...outerProps}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          fontFamily: 'Inter, system-ui, sans-serif',
          background: 'rgba(30, 30, 25, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {hiddenInput}

        <div style={{ position: 'relative' }}>
          {/* Fixed left: play controls */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            paddingLeft: 6,
            paddingRight: 12,
            background: 'linear-gradient(to right, rgba(30,30,25,0.95) 70%, transparent)',
          }}>
            <button onClick={stepBack} aria-label="Step back" style={CONTROL_BUTTON_STYLE}>&#8249;</button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              aria-label={isPlaying ? 'Pause forecast animation' : 'Play forecast animation'}
              style={CONTROL_BUTTON_STYLE}
            >
              {isPlaying ? '\u23F8' : '\u25B6'}
            </button>
            <button onClick={stepForward} aria-label="Step forward" style={CONTROL_BUTTON_STYLE}>&#8250;</button>
          </div>

          {/* Fixed right: time pill */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            paddingRight: 8,
            paddingLeft: 16,
            background: 'linear-gradient(to left, rgba(30,30,25,0.95) 70%, transparent)',
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              fontVariantNumeric: 'tabular-nums',
              opacity: isLoading ? 0.5 : 1,
            }}>
              {timePillText}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>&middot;</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#C17F5E' }}>
              {layerConfig.label}
            </span>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            data-testid="mobile-timeline"
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              paddingLeft: 56,
              paddingRight: 130,
            }}
          >
            <style>{`[data-testid="mobile-timeline"]::-webkit-scrollbar { display: none; }`}</style>

            {dayGroups.map((day, dayIdx) => (
              <div
                key={dayIdx}
                style={{
                  display: 'inline-flex',
                  flexShrink: 0,
                  borderLeft: dayIdx > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                }}
              >
                {day.blocks.map((block, blockIdx) => {
                  const isActive = block.forecastHour === currentHour;
                  const barColor = isActive
                    ? layerConfig.primaryColor
                    : block.isNight
                      ? 'rgba(30,30,30,0.6)'
                      : rgbToRgba(layerConfig.primaryColor, 0.2);

                  return (
                    <div
                      key={block.index}
                      ref={isActive ? activeTickRef : undefined}
                      onClick={() => onChange(block.forecastHour)}
                      aria-current={isActive ? 'true' : undefined}
                      style={{
                        width: 40,
                        flexShrink: 0,
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Day label — only on first tick of each day */}
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                        padding: '2px 0 0',
                        visibility: blockIdx === 0 ? 'visible' : 'hidden',
                        height: 18,
                      }}>
                        {blockIdx === 0 ? day.dateLabel : ''}
                      </div>
                      {/* Color bar cell */}
                      <div style={{
                        height: 6,
                        background: barColor,
                        transition: 'background 0.08s ease',
                      }} />
                      {/* Hour label */}
                      <div style={{
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                        paddingTop: 3,
                        paddingBottom: 4,
                        color: isActive
                          ? '#C17F5E'
                          : block.isNight
                            ? 'rgba(255,255,255,0.3)'
                            : 'rgba(255,255,255,0.55)',
                        fontWeight: isActive ? 600 : 400,
                      }}>
                        {formatHourCompact(block.localHour)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ────────────────────────────────────────────────
  return (
    <div
      {...outerProps}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '8px 16px 12px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {hiddenInput}

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
            {LAYER_COLORS[activeLayer].label}
          </span>
        </div>
      </div>

      {/* Day Labels */}
      <div data-testid="day-labels" style={{ position: 'relative', height: 14, marginBottom: 2 }}>
        {dayLabels.map((dl, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${dl.leftPercent}%`,
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

      {/* Block Grid — uniform 3-hourly blocks */}
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
        {blockData.map((block, i) => {
          const isActive = block.forecastHour === currentHour;
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
              key={block.index}
              onClick={() => onChange(block.forecastHour)}
              aria-current={isActive ? 'true' : undefined}
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
        <button onClick={stepBack} aria-label="Step back" style={CONTROL_BUTTON_STYLE}>&#8249;</button>
        <button
          onClick={() => setIsPlaying(p => !p)}
          aria-label={isPlaying ? 'Pause forecast animation' : 'Play forecast animation'}
          style={CONTROL_BUTTON_STYLE}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button onClick={stepForward} aria-label="Step forward" style={CONTROL_BUTTON_STYLE}>&#8250;</button>
      </div>
    </div>
  );
}
