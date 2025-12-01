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
