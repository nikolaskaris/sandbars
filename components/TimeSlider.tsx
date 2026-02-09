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
  const dateDisplay = validTime ? formatDateTime(validTime) : 'Loading...';
  const daysLabel = `+${daysDiff} days`;
  const ticks = getTickDates(referenceTime);

  return (
    <div
      data-testid="time-slider"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '12px 20px 16px',
        fontFamily: 'system-ui, sans-serif',
        zIndex: 10,
      }}
    >
      {/* Current time display */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          data-testid="forecast-time-label"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#1a1a1a',
            opacity: isLoading ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {dateDisplay}
        </span>
        <span
          style={{
            fontSize: 13,
            color: '#666',
            fontWeight: 500,
          }}
        >
          ({daysLabel})
        </span>
        {isLoading && (
          <span
            style={{
              fontSize: 12,
              color: '#999',
            }}
          >
            Loading...
          </span>
        )}
      </div>

      {/* Slider container */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        {/* Tick marks */}
        <div
          style={{
            position: 'absolute',
            top: -18,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 4px',
          }}
        >
          {ticks.map((tick) => (
            <span
              key={tick.hour}
              style={{
                fontSize: 11,
                color: '#888',
                position: 'absolute',
                left: `${(tick.hour / 384) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* Range input */}
        <input
          type="range"
          min={0}
          max={FORECAST_HOURS.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleChange}
          style={{
            width: '100%',
            height: 6,
            appearance: 'none',
            background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
            borderRadius: 3,
            cursor: 'pointer',
            outline: 'none',
          }}
        />
      </div>

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#666',
          marginTop: 4,
        }}
      >
        <span>Today</span>
        <span>+16 days</span>
      </div>

      {/* Custom slider thumb styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.1s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
