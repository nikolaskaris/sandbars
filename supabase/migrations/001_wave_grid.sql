-- =====================================================
-- Sandbars Wave Data Pipeline - Complete Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Station types enum
DO $$ BEGIN
  CREATE TYPE station_type AS ENUM ('buoy', 'weather', 'tide', 'wavewatch');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Stations table (NDBC buoys and other data sources)
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL UNIQUE,
  ndbc_id VARCHAR(10),
  type station_type NOT NULL DEFAULT 'buoy',
  name VARCHAR(255),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  owner VARCHAR(100),
  has_waves BOOLEAN DEFAULT false,
  has_wind BOOLEAN DEFAULT false,
  has_water_temp BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stations
CREATE INDEX IF NOT EXISTS idx_stations_lat_lon ON stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stations_type ON stations(type);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations(active);
CREATE INDEX IF NOT EXISTS idx_stations_ndbc_id ON stations(ndbc_id);

-- Pre-computed wave grid table
CREATE TABLE IF NOT EXISTS wave_grid (
  id SERIAL PRIMARY KEY,
  lat DECIMAL(5,2) NOT NULL,
  lon DECIMAL(6,2) NOT NULL,
  wave_height DECIMAL(4,2),
  wave_direction SMALLINT,
  wave_period DECIMAL(4,1),
  source VARCHAR(50) DEFAULT 'buoy_interpolation',  -- 'wavewatch3', 'buoy_interpolation', 'synthetic'
  model_run TIMESTAMPTZ,  -- For model data, when the model was run
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lat, lon)
);

-- Indexes for wave_grid
CREATE INDEX IF NOT EXISTS idx_wave_grid_location ON wave_grid(lat, lon);
CREATE INDEX IF NOT EXISTS idx_wave_grid_computed ON wave_grid(computed_at);

-- Buoy readings table for time-series data
CREATE TABLE IF NOT EXISTS buoy_readings (
  id SERIAL PRIMARY KEY,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  ndbc_id VARCHAR(10) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  wave_height DECIMAL(4,2),
  wave_direction SMALLINT,
  dominant_wave_period DECIMAL(4,1),
  average_wave_period DECIMAL(4,1),
  wind_speed DECIMAL(5,2),
  wind_direction SMALLINT,
  wind_gust DECIMAL(5,2),
  water_temp DECIMAL(4,1),
  air_temp DECIMAL(4,1),
  pressure DECIMAL(6,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ndbc_id, observed_at)
);

-- Indexes for buoy_readings
CREATE INDEX IF NOT EXISTS idx_buoy_readings_ndbc_time ON buoy_readings(ndbc_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_buoy_readings_observed ON buoy_readings(observed_at DESC);

-- Function to get latest reading for each station
CREATE OR REPLACE FUNCTION get_latest_buoy_readings()
RETURNS TABLE (
  ndbc_id VARCHAR(10),
  lat DECIMAL(10,8),
  lon DECIMAL(11,8),
  wave_height DECIMAL(4,2),
  wave_direction SMALLINT,
  wave_period DECIMAL(4,1),
  observed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (br.ndbc_id)
    br.ndbc_id,
    s.latitude as lat,
    s.longitude as lon,
    br.wave_height,
    br.wave_direction,
    br.dominant_wave_period as wave_period,
    br.observed_at
  FROM buoy_readings br
  JOIN stations s ON s.ndbc_id = br.ndbc_id
  WHERE br.observed_at > NOW() - INTERVAL '3 hours'
    AND br.wave_height IS NOT NULL
    AND br.wave_direction IS NOT NULL
  ORDER BY br.ndbc_id, br.observed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old buoy readings (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_buoy_readings()
RETURNS void AS $$
BEGIN
  DELETE FROM buoy_readings WHERE observed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE buoy_readings ENABLE ROW LEVEL SECURITY;

-- Public read access (these are public data)
DROP POLICY IF EXISTS "Stations are publicly readable" ON stations;
CREATE POLICY "Stations are publicly readable"
  ON stations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Wave grid is publicly readable" ON wave_grid;
CREATE POLICY "Wave grid is publicly readable"
  ON wave_grid FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Buoy readings are publicly readable" ON buoy_readings;
CREATE POLICY "Buoy readings are publicly readable"
  ON buoy_readings FOR SELECT
  USING (true);

-- Service role has full access (for cron jobs)
DROP POLICY IF EXISTS "Service role can manage stations" ON stations;
CREATE POLICY "Service role can manage stations"
  ON stations FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage wave_grid" ON wave_grid;
CREATE POLICY "Service role can manage wave_grid"
  ON wave_grid FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage buoy_readings" ON buoy_readings;
CREATE POLICY "Service role can manage buoy_readings"
  ON buoy_readings FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT SELECT ON stations TO anon, authenticated;
GRANT SELECT ON wave_grid TO anon, authenticated;
GRANT SELECT ON buoy_readings TO anon, authenticated;

GRANT ALL ON stations TO service_role;
GRANT ALL ON wave_grid TO service_role;
GRANT ALL ON buoy_readings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wave_grid_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE buoy_readings_id_seq TO service_role;
