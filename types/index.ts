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

// ============================================
// WIND VISUALIZATION TYPES
// ============================================

// Wind data format expected by wind visualization libraries
export interface WindDataHeader {
  parameterCategory: number;
  parameterNumber: number;  // 2 for U, 3 for V
  lo1: number;              // Starting longitude
  la1: number;              // Starting latitude (top of grid)
  dx: number;               // Grid spacing in degrees
  dy: number;
  nx: number;               // Grid points in X
  ny: number;               // Grid points in Y
}

export interface WindData {
  header: WindDataHeader;
  data: number[];           // Flattened array, row-major order
}

// ============================================
// FORECAST TIMELINE TYPES
// ============================================

// Latest forecast info for UI
export interface LatestForecastInfo {
  gfs?: {
    run: string;            // e.g., "2024011512"
    forecast_hours: number[];
  };
  ww3?: {
    run: string;
    forecast_hours: number[];
  };
  wavewatch?: {
    run: string;
    timestamp: string;
  };
}

// Map layer visibility state
export interface LayerVisibility {
  wind: boolean;
  waveHeight: boolean;
  swellDirection: boolean;
  buoys: boolean;
}

// ============================================
// BUOY OBSERVATION TYPES (for new schema)
// ============================================

// Buoy observation with all data fields
export interface BuoyObservation {
  station_id: string;
  name: string | null;
  lat: number;
  lon: number;
  observed_at: string;
  wind_speed_mps: number | null;
  wind_direction_deg: number | null;
  wave_height_m: number | null;
  dominant_wave_period_s: number | null;
  wave_direction_deg: number | null;
  water_temp_c: number | null;
}

// Forecast run metadata
export interface ForecastRun {
  model: string;
  run_time: string;
  forecast_hours: number[];
  metadata: Record<string, unknown>;
}
