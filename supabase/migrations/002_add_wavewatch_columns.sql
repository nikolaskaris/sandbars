-- =====================================================
-- Add WAVEWATCH III columns to wave_grid
-- Run this in your Supabase SQL Editor if you already
-- have the wave_grid table from 001_wave_grid.sql
-- =====================================================

-- Add source column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wave_grid' AND column_name = 'source'
  ) THEN
    ALTER TABLE wave_grid ADD COLUMN source VARCHAR(50) DEFAULT 'buoy_interpolation';
  END IF;
END $$;

-- Add model_run column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wave_grid' AND column_name = 'model_run'
  ) THEN
    ALTER TABLE wave_grid ADD COLUMN model_run TIMESTAMPTZ;
  END IF;
END $$;

-- Create index on source for faster queries
CREATE INDEX IF NOT EXISTS idx_wave_grid_source ON wave_grid(source);
