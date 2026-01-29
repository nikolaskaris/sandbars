-- =====================================================
-- Add forecast_runs table for tracking model runs
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Track ingested forecast runs
CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,                    -- 'gfs', 'ww3', 'wavewatch3_erddap'
  run_time TIMESTAMPTZ NOT NULL,          -- Model run time (e.g., 2024-01-15 12:00 UTC)
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  forecast_hours INTEGER[],               -- [0, 3, 6, 9, ...]
  status TEXT DEFAULT 'complete',         -- 'ingesting', 'complete', 'failed'
  point_count INTEGER,                    -- Number of grid points
  metadata JSONB,                         -- Additional info (bounds, resolution, etc.)
  UNIQUE(model, run_time)
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_model_time ON forecast_runs (model, run_time DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_status ON forecast_runs (status);

-- Enable RLS
ALTER TABLE forecast_runs ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Forecast runs are publicly readable" ON forecast_runs;
CREATE POLICY "Forecast runs are publicly readable"
  ON forecast_runs FOR SELECT
  USING (true);

-- Service role has full access
DROP POLICY IF EXISTS "Service role can manage forecast_runs" ON forecast_runs;
CREATE POLICY "Service role can manage forecast_runs"
  ON forecast_runs FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON forecast_runs TO anon, authenticated;
GRANT ALL ON forecast_runs TO service_role;

-- Function to get latest forecast run for a model
CREATE OR REPLACE FUNCTION get_latest_forecast_run(p_model TEXT)
RETURNS TABLE (
  model TEXT,
  run_time TIMESTAMPTZ,
  forecast_hours INTEGER[],
  point_count INTEGER,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.model,
    fr.run_time,
    fr.forecast_hours,
    fr.point_count,
    fr.metadata
  FROM forecast_runs fr
  WHERE fr.model = p_model AND fr.status = 'complete'
  ORDER BY fr.run_time DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old forecast runs (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_forecast_runs()
RETURNS void AS $$
BEGIN
  DELETE FROM forecast_runs WHERE ingested_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
