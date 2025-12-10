-- Add is_default column to favorite_locations table
ALTER TABLE favorite_locations
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create a partial unique index to ensure only one default location per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorite_locations_user_default
ON favorite_locations(user_id)
WHERE is_default = true;

-- Function to ensure only one default location per user
CREATE OR REPLACE FUNCTION ensure_single_default_location()
RETURNS TRIGGER AS $$
BEGIN
  -- If this location is being set as default
  IF NEW.is_default = true THEN
    -- Unset any other default locations for this user
    UPDATE favorite_locations
    SET is_default = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain single default location
DROP TRIGGER IF EXISTS trigger_ensure_single_default ON favorite_locations;
CREATE TRIGGER trigger_ensure_single_default
  BEFORE INSERT OR UPDATE ON favorite_locations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_location();
