'use client';

import { FavoriteLocation, SurfForecast } from '@/types';
import { useState, useEffect } from 'react';

interface FavoritesTableProps {
  favorites: FavoriteLocation[];
  onDelete: (id: string) => Promise<void>;
}

interface LocationForecast {
  location: FavoriteLocation;
  forecasts: {
    today: SurfForecast | null;
    tomorrow: SurfForecast | null;
    dayAfter: SurfForecast | null;
  };
  loading: boolean;
}

export default function FavoritesTable({ favorites, onDelete }: FavoritesTableProps) {
  const [locationForecasts, setLocationForecasts] = useState<LocationForecast[]>([]);

  useEffect(() => {
    // Initialize location forecasts
    const initialForecasts = favorites.map((location) => ({
      location,
      forecasts: { today: null, tomorrow: null, dayAfter: null },
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

          // Get today, tomorrow, and day after forecasts (at noon)
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfter = new Date(today);
          dayAfter.setDate(dayAfter.getDate() + 2);

          const getTodayForecast = (forecasts: SurfForecast[]) => {
            const todayStr = today.toISOString().split('T')[0];
            return forecasts.find((f) => f.time.includes(todayStr) && f.time.includes('12:00')) || forecasts[0];
          };

          const getTomorrowForecast = (forecasts: SurfForecast[]) => {
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            return forecasts.find((f) => f.time.includes(tomorrowStr) && f.time.includes('12:00')) || null;
          };

          const getDayAfterForecast = (forecasts: SurfForecast[]) => {
            const dayAfterStr = dayAfter.toISOString().split('T')[0];
            return forecasts.find((f) => f.time.includes(dayAfterStr) && f.time.includes('12:00')) || null;
          };

          setLocationForecasts((prev) => {
            const updated = [...prev];
            updated[index] = {
              location,
              forecasts: {
                today: getTodayForecast(data),
                tomorrow: getTomorrowForecast(data),
                dayAfter: getDayAfterForecast(data),
              },
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
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
              Today<br />
              <span className="font-normal text-xs text-gray-600">{formatDate(0)}</span>
            </th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
              Tomorrow<br />
              <span className="font-normal text-xs text-gray-600">{formatDate(1)}</span>
            </th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
              {formatDate(2).split(',')[0]}<br />
              <span className="font-normal text-xs text-gray-600">{formatDate(2)}</span>
            </th>
            <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {locationForecasts.map((item, index) => (
            <tr key={item.location.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{item.location.name}</p>
                  <p className="text-sm text-gray-600">
                    {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                  </p>
                </div>
              </td>
              <td className="px-6 py-4">
                {renderForecastCell(item.forecasts.today, item.loading)}
              </td>
              <td className="px-6 py-4">
                {renderForecastCell(item.forecasts.tomorrow, item.loading)}
              </td>
              <td className="px-6 py-4">
                {renderForecastCell(item.forecasts.dayAfter, item.loading)}
              </td>
              <td className="px-6 py-4 text-right">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
