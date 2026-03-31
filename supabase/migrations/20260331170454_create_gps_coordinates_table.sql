/*
  # Create GPS coordinates table

  1. New Tables
    - `gps_coordinates`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, references profiles)
      - `latitude` (decimal, not null)
      - `longitude` (decimal, not null)
      - `accuracy` (decimal)
      - `timestamp` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `gps_coordinates` table
    - Add policy for users to read their own coordinates
    - Add policy for users to insert their own coordinates
*/

CREATE TABLE IF NOT EXISTS gps_coordinates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  accuracy decimal,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE gps_coordinates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coordinates"
  ON gps_coordinates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coordinates"
  ON gps_coordinates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gps_coordinates_user_id ON gps_coordinates(user_id);
CREATE INDEX IF NOT EXISTS idx_gps_coordinates_timestamp ON gps_coordinates(timestamp DESC);
