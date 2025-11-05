import axios from 'axios';

// OpenWeatherMap API
// For production, use environment variable
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Get current weather and forecast for a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Weather data
 */
export const getWeatherData = async (lat, lng) => {
  try {
    // Get current weather
    const currentResponse = await axios.get(`${BASE_URL}/weather`, {
      params: {
        lat,
        lon: lng,
        appid: API_KEY,
        units: 'metric',
      },
    });

    // Get 5-day forecast
    const forecastResponse = await axios.get(`${BASE_URL}/forecast`, {
      params: {
        lat,
        lon: lng,
        appid: API_KEY,
        units: 'metric',
      },
    });

    return {
      current: formatCurrentWeather(currentResponse.data),
      forecast: formatForecast(forecastResponse.data),
    };
  } catch (error) {
    if (API_KEY === 'demo') {
      // Return mock data if no API key is set
      return getMockWeatherData(lat, lng);
    }
    console.error('Weather API error:', error);
    throw new Error('Failed to fetch weather data');
  }
};

/**
 * Format current weather data
 */
const formatCurrentWeather = (data) => {
  return {
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
    windDirection: data.wind.deg,
    windGust: data.wind.gust ? Math.round(data.wind.gust * 3.6) : null,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    clouds: data.main.clouds,
    visibility: data.visibility,
    sunrise: new Date(data.sys.sunrise * 1000),
    sunset: new Date(data.sys.sunset * 1000),
  };
};

/**
 * Format forecast data
 */
const formatForecast = (data) => {
  const dailyForecasts = {};

  data.list.forEach((item) => {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];

    if (!dailyForecasts[date]) {
      dailyForecasts[date] = {
        date,
        temps: [],
        winds: [],
        conditions: [],
        hourly: [],
      };
    }

    dailyForecasts[date].temps.push(item.main.temp);
    dailyForecasts[date].winds.push(item.wind.speed * 3.6);
    dailyForecasts[date].conditions.push(item.weather[0].description);
    dailyForecasts[date].hourly.push({
      time: new Date(item.dt * 1000),
      temp: Math.round(item.main.temp),
      windSpeed: Math.round(item.wind.speed * 3.6),
      windDirection: item.wind.deg,
      description: item.weather[0].description,
      icon: item.weather[0].icon,
    });
  });

  return Object.values(dailyForecasts).map((day) => ({
    date: day.date,
    tempHigh: Math.round(Math.max(...day.temps)),
    tempLow: Math.round(Math.min(...day.temps)),
    windAvg: Math.round(day.winds.reduce((a, b) => a + b) / day.winds.length),
    windMax: Math.round(Math.max(...day.winds)),
    condition: day.conditions[0],
    hourly: day.hourly,
  }));
};

/**
 * Get wind direction as compass direction
 */
export const getWindDirection = (degrees) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
};

/**
 * Mock weather data for demo purposes
 */
const getMockWeatherData = (lat, lng) => {
  const now = new Date();

  return {
    current: {
      temperature: 22,
      feelsLike: 21,
      humidity: 65,
      pressure: 1013,
      windSpeed: 15,
      windDirection: 180,
      windGust: 20,
      description: 'clear sky',
      icon: '01d',
      clouds: 10,
      visibility: 10000,
      sunrise: new Date(now.setHours(6, 30)),
      sunset: new Date(now.setHours(18, 45)),
    },
    forecast: Array.from({ length: 5 }, (_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
      tempHigh: 22 + Math.random() * 5,
      tempLow: 18 + Math.random() * 3,
      windAvg: 12 + Math.random() * 8,
      windMax: 18 + Math.random() * 10,
      condition: 'partly cloudy',
      hourly: Array.from({ length: 8 }, (_, h) => ({
        time: new Date(Date.now() + i * 86400000 + h * 10800000),
        temp: 20 + Math.random() * 5,
        windSpeed: 10 + Math.random() * 10,
        windDirection: Math.random() * 360,
        description: 'partly cloudy',
        icon: '02d',
      })),
    })),
  };
};
