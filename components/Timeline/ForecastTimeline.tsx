'use client';

import { useEffect, useRef, useCallback } from 'react';
import { format, addHours, parseISO } from 'date-fns';
import { useMapStore } from '@/hooks/useMapStore';

export function ForecastTimeline() {
  const forecastHour = useMapStore((s) => s.forecastHour);
  const setForecastHour = useMapStore((s) => s.setForecastHour);
  const latestInfo = useMapStore((s) => s.latestInfo);
  const isPlaying = useMapStore((s) => s.isPlaying);
  const setIsPlaying = useMapStore((s) => s.setIsPlaying);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get available forecast hours from latest info
  const getAvailableHours = useCallback(() => {
    if (latestInfo?.gfs?.forecast_hours) {
      return latestInfo.gfs.forecast_hours;
    }
    if (latestInfo?.ww3?.forecast_hours) {
      return latestInfo.ww3.forecast_hours;
    }
    // Default forecast hours if no info available
    return [0, 3, 6, 9, 12, 24, 48, 72, 96, 120];
  }, [latestInfo]);

  const availableHours = getAvailableHours();
  const maxHour = availableHours.length > 0 ? Math.max(...availableHours) : 120;

  // Get forecast valid time
  const getForecastTime = useCallback(() => {
    // Try to get run time from latest info
    if (latestInfo?.gfs?.run) {
      const runStr = latestInfo.gfs.run;
      // Parse run string: "2024011512" -> 2024-01-15 12:00 UTC
      const year = parseInt(runStr.slice(0, 4));
      const month = parseInt(runStr.slice(4, 6)) - 1;
      const day = parseInt(runStr.slice(6, 8));
      const hour = parseInt(runStr.slice(8, 10));
      const runDate = new Date(Date.UTC(year, month, day, hour));
      return addHours(runDate, forecastHour);
    }

    if (latestInfo?.wavewatch?.timestamp) {
      const runDate = parseISO(latestInfo.wavewatch.timestamp);
      return addHours(runDate, forecastHour);
    }

    // Default to current time + forecast hour
    return addHours(new Date(), forecastHour);
  }, [latestInfo, forecastHour]);

  const forecastTime = getForecastTime();

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const currentIndex = availableHours.indexOf(forecastHour);
        const nextIndex = (currentIndex + 1) % availableHours.length;
        setForecastHour(availableHours[nextIndex] || 0);
      }, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, availableHours, forecastHour, setForecastHour]);

  // Step forward/backward
  const stepBackward = useCallback(() => {
    const currentIndex = availableHours.indexOf(forecastHour);
    const prevIndex = currentIndex <= 0 ? availableHours.length - 1 : currentIndex - 1;
    setForecastHour(availableHours[prevIndex] || 0);
  }, [availableHours, forecastHour, setForecastHour]);

  const stepForward = useCallback(() => {
    const currentIndex = availableHours.indexOf(forecastHour);
    const nextIndex = (currentIndex + 1) % availableHours.length;
    setForecastHour(availableHours[nextIndex] || 0);
  }, [availableHours, forecastHour, setForecastHour]);

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm min-w-[360px] shadow-xl">
      {/* Time display */}
      <div className="text-center mb-3">
        <div className="text-lg font-semibold">
          {format(forecastTime, 'EEE, MMM d, h:mm a')}
        </div>
        <div className="text-xs text-gray-400">
          {forecastHour === 0 ? 'Current conditions' : `+${forecastHour}h forecast`}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Step backward */}
        <button
          onClick={stepBackward}
          className="w-8 h-8 flex items-center justify-center bg-white/10 rounded hover:bg-white/20 transition-colors"
          title="Previous hour"
        >
          <StepBackIcon className="w-4 h-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 flex items-center justify-center bg-white/10 rounded hover:bg-white/20 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <PauseIcon className="w-4 h-4" />
          ) : (
            <PlayIcon className="w-4 h-4" />
          )}
        </button>

        {/* Step forward */}
        <button
          onClick={stepForward}
          className="w-8 h-8 flex items-center justify-center bg-white/10 rounded hover:bg-white/20 transition-colors"
          title="Next hour"
        >
          <StepForwardIcon className="w-4 h-4" />
        </button>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={maxHour}
          step={3}
          value={forecastHour}
          onChange={(e) => setForecastHour(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />

        <span className="text-xs w-12 text-right tabular-nums">{maxHour}h</span>
      </div>

      {/* Hour markers */}
      <div className="flex justify-between mt-2 px-[52px] text-xs text-gray-500">
        <span>Now</span>
        <span>24h</span>
        <span>48h</span>
        <span>72h</span>
        <span>{maxHour}h</span>
      </div>
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function StepBackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

function StepForwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

export default ForecastTimeline;
