-- Create favorite_locations table
CREATE TABLE IF NOT EXISTS favorite_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_favorite_locations_user_id ON favorite_locations(user_id);

-- Enable Row Level Security
ALTER TABLE favorite_locations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own favorite locations
CREATE POLICY "Users can view their own favorite locations"
  ON favorite_locations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own favorite locations
CREATE POLICY "Users can insert their own favorite locations"
  ON favorite_locations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own favorite locations
CREATE POLICY "Users can update their own favorite locations"
  ON favorite_locations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own favorite locations
CREATE POLICY "Users can delete their own favorite locations"
  ON favorite_locations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Data quality flags enum
CREATE TYPE quality_flag AS ENUM (
  'primary',        -- Direct observation
  'interpolated',   -- Derived from nearby stations
  'modeled',        -- From numerical model
  'historical',     -- Fallback to climatology
  'stale',          -- Last reading > 3 hours old
  'missing'         -- No data available
);

-- Station types enum
CREATE TYPE station_type AS ENUM (
  'buoy',          -- NDBC buoy
  'weather',       -- NWS weather station
  'tide',          -- Tides & Currents station
  'wavewatch'      -- WaveWatch III grid point
);

-- Metric types enum
CREATE TYPE metric_type AS ENUM (
  'wave_height',
  'wave_period',
  'wave_direction',
  'wind_speed',
  'wind_direction',
  'water_temperature',
  'air_temperature',
  'tide_level',
  'wave_power'
);

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL UNIQUE,  -- External ID (e.g., buoy number)
  type station_type NOT NULL,
  name VARCHAR(255),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  range_km INTEGER DEFAULT 50,  -- Effective range for interpolation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_stations_lat_lon ON stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(type);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations(active);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metric_type metric_type NOT NULL,
  value DECIMAL(10, 4),
  quality_flag quality_flag DEFAULT 'primary',
  source_hierarchy_used JSONB DEFAULT '[]'::jsonb,  -- Track which sources were tried
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for observations queries
CREATE INDEX IF NOT EXISTS idx_observations_station_timestamp ON observations(station_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_observations_metric_timestamp ON observations(metric_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp DESC);

-- Location cache table
CREATE TABLE IF NOT EXISTS location_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude DECIMAL(10, 6) NOT NULL,  -- Rounded to grid
  longitude DECIMAL(11, 6) NOT NULL,  -- Rounded to grid
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  compiled_data JSONB NOT NULL,
  stations_used JSONB DEFAULT '[]'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for location cache
CREATE INDEX IF NOT EXISTS idx_location_cache_lat_lon ON location_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_location_cache_expires ON location_cache(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_cache_unique ON location_cache(latitude, longitude, timestamp);

-- Function to clean up old observations (> 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_observations()
RETURNS void AS $$
BEGIN
  DELETE FROM observations WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired location cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM location_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
