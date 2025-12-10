'use client';

import { SurfForecast } from '@/types';

interface ForecastCardProps {
  forecast: SurfForecast[];
  locationName: string;
  loading?: boolean;
}

export default function ForecastCard({ forecast, locationName, loading }: ForecastCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (forecast.length === 0) {
    return null;
  }

  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      hour12: true,
    });
  };

  const getWaveHeightColor = (height: number) => {
    if (height < 1) return 'text-gray-600';
    if (height < 2) return 'text-blue-600';
    if (height < 4) return 'text-green-600';
    if (height < 6) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900">Surf Forecast</h2>
        <p className="text-gray-900">{locationName}</p>
      </div>

      <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
        {forecast.slice(0, 24).map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex-1">
              <p className="font-medium text-gray-900">{formatTime(item.time)}</p>
            </div>

            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <p className="text-gray-900 text-xs mb-1">Wave Height</p>
                <p className={`font-bold text-lg ${getWaveHeightColor(item.waveHeight.max)}`}>
                  {item.waveHeight.min.toFixed(1)}-{item.waveHeight.max.toFixed(1)}m
                </p>
              </div>

              <div className="text-center">
                <p className="text-gray-900 text-xs mb-1">Period</p>
                <p className="font-medium text-gray-900">{item.wavePeriod.toFixed(0)}s</p>
              </div>

              <div className="text-center">
                <p className="text-gray-900 text-xs mb-1">Wind</p>
                <p className="font-medium text-gray-900">{item.windSpeed.toFixed(1)} m/s</p>
              </div>

              {item.waterTemperature && (
                <div className="text-center">
                  <p className="text-gray-900 text-xs mb-1">Water</p>
                  <p className="font-medium text-gray-900">{item.waterTemperature.toFixed(1)}°C</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
