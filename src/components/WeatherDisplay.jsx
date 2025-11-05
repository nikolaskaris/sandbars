import React from 'react';
import { getWindDirection } from '@/services/weatherApi';

export default function WeatherDisplay({ weather, location }) {
  if (!weather) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500">
        Select a location to view weather forecast
      </div>
    );
  }

  const { current, forecast } = weather;

  return (
    <div className="space-y-4">
      {/* Current Weather */}
      <div className="bg-gradient-to-br from-ocean-500 to-ocean-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-4">Current Conditions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm opacity-80">Temperature</div>
            <div className="text-2xl font-bold">{current.temperature}°C</div>
            <div className="text-xs opacity-70">Feels like {current.feelsLike}°C</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Wind</div>
            <div className="text-2xl font-bold">{current.windSpeed} km/h</div>
            <div className="text-xs opacity-70">{getWindDirection(current.windDirection)}</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Humidity</div>
            <div className="text-2xl font-bold">{current.humidity}%</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Pressure</div>
            <div className="text-2xl font-bold">{current.pressure} hPa</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white border-opacity-20">
          <p className="capitalize">{current.description}</p>
        </div>
      </div>

      {/* 5-Day Forecast */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900">5-Day Forecast</h3>
        <div className="space-y-3">
          {forecast.map((day, index) => (
            <div
              key={day.date}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <div className="font-semibold text-gray-900">
                  {index === 0
                    ? 'Today'
                    : new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                </div>
                <div className="text-sm text-gray-600 capitalize">{day.condition}</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Temp</div>
                  <div className="font-semibold text-gray-900">
                    {day.tempHigh}° / {day.tempLow}°
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Wind</div>
                  <div className="font-semibold text-gray-900">
                    {day.windAvg} km/h
                  </div>
                  <div className="text-xs text-gray-500">max {day.windMax}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
