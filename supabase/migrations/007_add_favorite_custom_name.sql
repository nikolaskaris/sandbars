-- Add custom_name column to user_favorites
-- When set, overrides the catalog spot name in display.
-- NULL = use the spot's default name.
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS custom_name TEXT;
