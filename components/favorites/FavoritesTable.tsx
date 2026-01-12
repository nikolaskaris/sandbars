'use client';

import { FavoriteLocation, SurfForecast } from '@/types';
import { useState, useEffect } from 'react';

interface FavoritesTableProps {
  favorites: FavoriteLocation[];
  onDelete: (id: string) => Promise<void>;
}

interface LocationForecast {
  location: FavoriteLocation;
  fullForecast: SurfForecast[];
  sevenDayForecasts: (SurfForecast | null)[];
  loading: boolean;
}

export default function FavoritesTable({ favorites, onDelete }: FavoritesTableProps) {
  const [locationForecasts, setLocationForecasts] = useState<LocationForecast[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [expandedLocationId, setExpandedLocationId] = useState<string | null>(null);

  useEffect(() => {
    // Load default location from localStorage
    const storedDefaultId = localStorage.getItem('defaultMapLocationId');
    setDefaultLocationId(storedDefaultId);
  }, []);

  const handleSetDefault = (locationId: string) => {
    localStorage.setItem('defaultMapLocationId', locationId);
    setDefaultLocationId(locationId);
  };

  const toggleExpanded = (locationId: string) => {
    setExpandedLocationId(expandedLocationId === locationId ? null : locationId);
  };

  useEffect(() => {
    // Initialize location forecasts
    const initialForecasts = favorites.map((location) => ({
      location,
      fullForecast: [],
      sevenDayForecasts: Array(7).fill(null),
      loading: true,
    }));
    setLocationForecasts(initialForecasts);

    // Fetch forecasts for each location
    favorites.forEach(async (location, index) => {
      try {
        const response = await fetch(
          `/api/forecast?lat=${location.latitude}&lng=${location.longitude}`
        );
        if (response.ok) {
          const data: SurfForecast[] = await response.json();

          // Get forecasts for next 7 days (at noon)
          const sevenDayForecasts: (SurfForecast | null)[] = [];
          for (let i = 0; i < 7; i++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + i);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            const dayForecast = data.find((f) =>
              f.time.includes(targetDateStr) && f.time.includes('12:00')
            ) || data.find((f) => f.time.includes(targetDateStr)) || null;

            sevenDayForecasts.push(dayForecast);
          }

          setLocationForecasts((prev) => {
            const updated = [...prev];
            updated[index] = {
              location,
              fullForecast: data,
              sevenDayForecasts,
              loading: false,
            };
            return updated;
          });
        }
      } catch (error) {
        console.error('Error fetching forecast:', error);
        setLocationForecasts((prev) => {
          const updated = [...prev];
          updated[index].loading = false;
          return updated;
        });
      }
    });
  }, [favorites]);

  const formatDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDayName = (daysFromNow: number) => {
    if (daysFromNow === 0) return 'Today';
    if (daysFromNow === 1) return 'Tomorrow';
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const renderForecastCell = (forecast: SurfForecast | null, loading: boolean) => {
    if (loading) {
      return (
        <div className="text-center">
          <div className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (!forecast) {
      return <span className="text-gray-400 text-sm">No data</span>;
    }

    const getWaveColor = (height: number) => {
      if (height < 1) return 'text-gray-600';
      if (height < 2) return 'text-blue-600';
      if (height < 4) return 'text-green-600';
      if (height < 6) return 'text-orange-600';
      return 'text-red-600';
    };

    return (
      <div className="text-center">
        <p className={`font-bold text-lg ${getWaveColor(forecast.waveHeight.max)}`}>
          {forecast.waveHeight.min.toFixed(1)}-{forecast.waveHeight.max.toFixed(1)}m
        </p>
        <p className="text-xs text-gray-900 mt-1">
          {forecast.wavePeriod.toFixed(0)}s • {forecast.windSpeed.toFixed(0)} m/s
        </p>
      </div>
    );
  };

  const renderExpandedRow = (item: LocationForecast) => {
    return (
      <tr className="bg-gray-50">
        <td colSpan={10} className="px-6 py-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Detailed 7-Day Forecast</h4>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-3 text-gray-700 font-medium">Metric</th>
                    {item.sevenDayForecasts.map((_, idx) => (
                      <th key={idx} className="text-center py-2 px-3 text-gray-700 font-medium">
                        {formatDayName(idx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 font-medium">Water Temp</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast?.waterTemperature ? `${forecast.waterTemperature.toFixed(1)}°C` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 bg-white">
                    <td className="py-2 px-3 font-medium">Wind Speed</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast ? `${forecast.windSpeed.toFixed(1)} m/s` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 font-medium">Wind Direction</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast ? `${forecast.windDirection}°` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 bg-white">
                    <td className="py-2 px-3 font-medium">Swell Size</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast ? `${forecast.waveHeight.min.toFixed(1)}-${forecast.waveHeight.max.toFixed(1)}m` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 font-medium">Swell Direction</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast ? `${forecast.waveDirection}°` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-white">
                    <td className="py-2 px-3 font-medium">Swell Period</td>
                    {item.sevenDayForecasts.map((forecast, idx) => (
                      <td key={idx} className="text-center py-2 px-3">
                        {forecast ? `${forecast.wavePeriod.toFixed(0)}s` : '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg mb-2">No favorite locations yet</p>
        <p className="text-gray-400 text-sm">Add some spots from the Map view to see forecasts here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Location</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                {formatDayName(idx)}<br />
                <span className="font-normal text-xs text-gray-600">{formatDate(idx)}</span>
              </th>
            ))}
            <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {locationForecasts.map((item, index) => (
            <>
              <tr
                key={item.location.id}
                className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${
                  expandedLocationId === item.location.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => toggleExpanded(item.location.id)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg
                      className={`w-4 h-4 text-gray-600 transition-transform ${
                        expandedLocationId === item.location.id ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">{item.location.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </td>
                {item.sevenDayForecasts.map((forecast, idx) => (
                  <td key={idx} className="px-6 py-4">
                    {renderForecastCell(forecast, item.loading)}
                  </td>
                ))}
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-2">
                    {defaultLocationId === item.location.id ? (
                      <span className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        Map Default
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(item.location.id)}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        title="Set as map default"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(item.location.id)}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Delete location"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              {expandedLocationId === item.location.id && renderExpandedRow(item)}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
