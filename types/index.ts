export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface FavoriteLocation {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface SurfForecast {
  time: string;
  waveHeight: {
    min: number;
    max: number;
  };
  wavePeriod: number;
  waveDirection?: number;
  windSpeed: number;
  windDirection?: number;
  waterTemperature?: number;
}
