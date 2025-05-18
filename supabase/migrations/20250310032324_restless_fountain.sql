/*
  # Create Collection Points Schema

  1. New Tables
    - `collection_points`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `address` (text)
      - `district` (text)
      - `materials` (text array)
      - `schedule` (text)
      - `additional_info` (text)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on collection_points table
    - Add policies for:
      - Authenticated users can read all points
      - Users can only insert/update/delete their own points
*/

CREATE TABLE IF NOT EXISTS collection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  address text NOT NULL,
  district text NOT NULL,
  materials text[] NOT NULL,
  schedule text NOT NULL,
  additional_info text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND
    longitude BETWEEN -180 AND 180
  )
);

-- Enable RLS
ALTER TABLE collection_points ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view collection points"
  ON collection_points
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own collection points"
  ON collection_points
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collection points"
  ON collection_points
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collection points"
  ON collection_points
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_points_updated_at
  BEFORE UPDATE ON collection_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
postgresql://postgres.chwybcgxldjehfoyzazn:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres