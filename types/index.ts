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
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  waterTemperature?: number;
}

export interface StormglassResponse {
  hours: Array<{
    time: string;
    waveHeight: { noaa: number; sg: number; icon: number };
    wavePeriod: { noaa: number; sg: number; icon: number };
    waveDirection: { noaa: number; sg: number; icon: number };
    windSpeed: { noaa: number; sg: number; icon: number };
    windDirection: { noaa: number; sg: number; icon: number };
    waterTemperature?: { noaa: number; sg: number; icon: number };
  }>;
  meta: {
    cost: number;
    dailyQuota: number;
    end: string;
    lat: number;
    lng: number;
    params: string[];
    requestCount: number;
    start: string;
  };
}
