'use client';

import { useCallback, useMemo } from 'react';
import { FORECAST_HOURS } from '@/lib/wave-utils';

interface TimeSliderProps {
  currentHour: number;
  validTime: string | null;
  referenceTime: string | null;
  isLoading: boolean;
  onChange: (hour: number) => void;
}

/**
 * Format a date string for display
 * e.g., "Thu, Jan 30 6:00 PM"
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate days difference between two dates
 */
function getDaysDiff(validTime: string, referenceTime: string): number {
  const valid = new Date(validTime);
  const reference = new Date(referenceTime);
  const diffMs = valid.getTime() - reference.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate tick marks for the slider
 */
function getTickDates(referenceTime: string | null): { hour: number; label: string }[] {
  if (!referenceTime) return [];

  const refDate = new Date(referenceTime);
  const ticks: { hour: number; label: string }[] = [];

  // Show ticks at day 0, 3, 6, 9, 12, 16
  const tickDays = [0, 3, 6, 9, 12, 16];

  for (const day of tickDays) {
    const hour = day * 24;
    if (hour <= 384) {
      const tickDate = new Date(refDate.getTime() + day * 24 * 60 * 60 * 1000);
      ticks.push({
        hour,
        label: tickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
  }

  return ticks;
}

export default function TimeSlider({
  currentHour,
  validTime,
  referenceTime,
  isLoading,
  onChange,
}: TimeSliderProps) {
  // Find current index in forecast hours array
  const currentIndex = useMemo(
    () => FORECAST_HOURS.indexOf(currentHour),
    [currentHour]
  );

  // Handle slider change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = parseInt(e.target.value, 10);
      const hour = FORECAST_HOURS[index];
      onChange(hour);
    },
    [onChange]
  );

  // Calculate display values
  const daysDiff = validTime && referenceTime ? getDaysDiff(validTime, referenceTime) : 0;
  const dateDisplay = validTime ? formatDateTime(validTime) : '\u2014';
  const daysLabel = `+${daysDiff}d`;
  const ticks = getTickDates(referenceTime);

  return (
    <div
      data-testid="time-slider"
      className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border shadow-sm px-5 pt-3 pb-4 z-10"
    >
      {/* Current time display */}
      <div className="flex justify-center items-baseline gap-2 mb-4">
        <span
          data-testid="forecast-time-label"
          className={`text-lg font-medium text-text-primary tabular-nums transition-opacity duration-150 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
        >
          {dateDisplay}
        </span>
        <span className="text-sm text-text-secondary">
          ({daysLabel})
        </span>
      </div>

      {/* Tick labels row — fixed height, separate from slider */}
      <div className="relative h-4 mb-1">
        {ticks.map((tick, i) => {
          // Mobile: show only days 0, 6, 12, 16 (skip indices 1 and 3 which are days 3 and 9)
          const hiddenOnMobile = i === 1 || i === 3;
          return (
            <span
              key={tick.hour}
              className={`absolute -translate-x-1/2 flex flex-col items-center ${hiddenOnMobile ? 'hidden md:flex' : ''}`}
              style={{ left: `${(tick.hour / 384) * 100}%` }}
            >
              <span className="text-xs text-text-tertiary tabular-nums leading-none">{tick.label}</span>
              <span className="w-px h-1 bg-border mt-0.5" />
            </span>
          );
        })}
      </div>

      {/* Range input — styled via globals.css */}
      <input
        type="range"
        min={0}
        max={FORECAST_HOURS.length - 1}
        step={1}
        value={currentIndex}
        onChange={handleChange}
        className="w-full"
      />

      {/* End labels */}
      <div className="flex justify-between text-xs text-text-tertiary mt-1">
        <span>Now</span>
        <span>+16 days</span>
      </div>
    </div>
  );
}
