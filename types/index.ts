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

// Data quality flags
export type QualityFlag =
  | 'primary'        // Direct observation
  | 'interpolated'   // Derived from nearby stations
  | 'modeled'        // From numerical model
  | 'historical'     // Fallback to climatology
  | 'stale'          // Last reading > 3 hours old
  | 'missing';       // No data available

// Station types
export type StationType = 'buoy' | 'weather' | 'tide' | 'wavewatch';

// Metric types
export type MetricType =
  | 'wave_height'
  | 'wave_period'
  | 'wave_direction'
  | 'wind_speed'
  | 'wind_direction'
  | 'water_temperature'
  | 'air_temperature'
  | 'tide_level'
  | 'wave_power';

// Station database model
export interface Station {
  id: string;
  station_id: string;
  type: StationType;
  name?: string;
  latitude: number;
  longitude: number;
  metadata: Record<string, any>;
  active: boolean;
  range_km: number;
  created_at: string;
  updated_at: string;
}

// Observation database model
export interface Observation {
  id: string;
  station_id: string;
  timestamp: string;
  metric_type: MetricType;
  value: number | null;
  quality_flag: QualityFlag;
  source_hierarchy_used: string[];
  created_at: string;
}

// Location cache database model
export interface LocationCache {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  compiled_data: CompiledForecastData;
  stations_used: StationUsed[];
  expires_at: string;
  created_at: string;
}

// Station usage tracking
export interface StationUsed {
  station_id: string;
  type: StationType;
  name: string;
  distance_km: number;
  metrics: MetricType[];
}

// Compiled forecast data with quality indicators
export interface CompiledForecastData {
  forecasts: EnhancedSurfForecast[];
  metadata: {
    generated_at: string;
    primary_sources: number;
    interpolated_sources: number;
    modeled_sources: number;
  };
}

// Enhanced surf forecast with quality indicators
export interface EnhancedSurfForecast {
  time: string;
  waveHeight: {
    min: number;
    max: number;
    quality: QualityFlag;
  };
  wavePeriod: {
    value: number;
    quality: QualityFlag;
  };
  waveDirection?: {
    value: number;
    quality: QualityFlag;
  };
  wavePower?: {
    value: number;  // kW/m
    quality: QualityFlag;
  };
  windSpeed: {
    value: number;
    quality: QualityFlag;
  };
  windDirection?: {
    value: number;
    quality: QualityFlag;
  };
  waterTemperature?: {
    value: number;
    quality: QualityFlag;
  };
  airTemperature?: {
    value: number;
    quality: QualityFlag;
  };
  tideLevel?: {
    value: number;
    quality: QualityFlag;
  };
}

// Legacy format for backwards compatibility
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
  airTemperature?: number;
  wavePower?: number;
}
