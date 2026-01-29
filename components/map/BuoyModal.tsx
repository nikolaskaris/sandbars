'use client';

import { useEffect, useState, useCallback } from 'react';
import type { NDBCStation } from '@/lib/forecast/sources/ndbc-stations';

interface BuoyReading {
  timestamp: string;
  waveHeight?: number;
  dominantWavePeriod?: number;
  averageWavePeriod?: number;
  waveDirection?: number;
  windSpeed?: number;
  windDirection?: number;
  waterTemperature?: number;
  airTemperature?: number;
}

interface BuoyModalProps {
  station: NDBCStation;
  onClose: () => void;
}

function getStationTypeLabel(type: NDBCStation['type']): string {
  switch (type) {
    case 'buoy': return 'Weather Buoy';
    case 'fixed': return 'C-MAN Station';
    case 'dart': return 'Tsunami Buoy';
    case 'tao': return 'TAO/PIRATA Buoy';
    case 'usv': return 'Unmanned Surface Vehicle';
    default: return 'Station';
  }
}

function getStationTypeColor(type: NDBCStation['type']): string {
  switch (type) {
    case 'buoy': return 'bg-blue-500';
    case 'fixed': return 'bg-green-500';
    case 'dart': return 'bg-red-500';
    case 'tao': return 'bg-amber-500';
    case 'usv': return 'bg-purple-500';
    default: return 'bg-gray-400';
  }
}

function formatDirection(degrees: number | undefined): string {
  if (degrees === undefined) return '--';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return `${directions[index]} (${degrees.toFixed(0)}°)`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  return date.toLocaleString();
}

function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

function msToMph(ms: number): number {
  return ms * 2.237;
}

export default function BuoyModal({ station, onClose }: BuoyModalProps) {
  const [data, setData] = useState<BuoyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/buoys/${station.id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch buoy data');
        }
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        setError('Unable to load buoy data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [station.id]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {station.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${getStationTypeColor(station.type)}`} />
                <span className="text-sm text-gray-500">
                  {getStationTypeLabel(station.type)}
                </span>
                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm text-gray-500 font-mono">
                  {station.id}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Location */}
          <div className="mt-2 text-xs text-gray-400">
            {station.lat.toFixed(3)}° N, {Math.abs(station.lon).toFixed(3)}° {station.lon >= 0 ? 'E' : 'W'}
          </div>

          {/* Owner & Capabilities */}
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {station.owner}
            </span>
            {station.hasMet && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                Met Data
              </span>
            )}
            {station.hasCurrents && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                Currents
              </span>
            )}
            {station.hasWaterQuality && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                Water Quality
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
              <p>{error}</p>
              <p className="text-xs mt-1">This station may be offline or not reporting</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Last Updated */}
              <div className="text-xs text-gray-400 mb-4">
                Last updated: {formatTimestamp(data.timestamp)}
              </div>

              {/* Wave Data */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Waves
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Height</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {data.waveHeight !== undefined
                        ? `${metersToFeet(data.waveHeight).toFixed(1)} ft`
                        : '--'}
                    </div>
                    {data.waveHeight !== undefined && (
                      <div className="text-xs text-gray-400">
                        {data.waveHeight.toFixed(1)} m
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Period</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {data.dominantWavePeriod !== undefined
                        ? `${data.dominantWavePeriod.toFixed(0)} sec`
                        : '--'}
                    </div>
                    {data.averageWavePeriod !== undefined && (
                      <div className="text-xs text-gray-400">
                        Avg: {data.averageWavePeriod.toFixed(0)} sec
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Direction</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatDirection(data.waveDirection)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Wind Data */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  Wind
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Speed</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {data.windSpeed !== undefined
                        ? `${msToMph(data.windSpeed).toFixed(0)} mph`
                        : '--'}
                    </div>
                    {data.windSpeed !== undefined && (
                      <div className="text-xs text-gray-400">
                        {data.windSpeed.toFixed(1)} m/s
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Direction</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatDirection(data.windDirection)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Temperature Data */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Temperature
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 mb-1">Water</div>
                    <div className="text-xl font-semibold text-blue-900">
                      {data.waterTemperature !== undefined
                        ? `${celsiusToFahrenheit(data.waterTemperature).toFixed(0)}°F`
                        : '--'}
                    </div>
                    {data.waterTemperature !== undefined && (
                      <div className="text-xs text-blue-400">
                        {data.waterTemperature.toFixed(1)}°C
                      </div>
                    )}
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-xs text-orange-600 mb-1">Air</div>
                    <div className="text-xl font-semibold text-orange-900">
                      {data.airTemperature !== undefined
                        ? `${celsiusToFahrenheit(data.airTemperature).toFixed(0)}°F`
                        : '--'}
                    </div>
                    {data.airTemperature !== undefined && (
                      <div className="text-xs text-orange-400">
                        {data.airTemperature.toFixed(1)}°C
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && !error && !data && (
            <div className="text-center py-8 text-gray-500">
              <p>No data available for this station</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <a
            href={`https://www.ndbc.noaa.gov/station_page.php?station=${station.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1"
          >
            View on NDBC
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
