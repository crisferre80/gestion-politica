/*
  # Create Collection Points Schema

  1. New Tables
    - `collection_points`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users initially, later changed to profiles.user_id)
      - `recycler_id` (uuid, foreign key to auth.users, nullable)
      - `claim_id` (uuid, foreign key to collection_claims, nullable)
      - `status` (text, default 'available')
      - `address` (text)
      - `district` (text)
      - `materials` (text array)
      - `schedule` (text)
      - `additional_info` (text)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `pickup_time` (timestamptz, nullable)

  2. Security
    - Enable RLS on collection_points table
    - Add policies for:
      - Authenticated users can read all points
      - Users can only insert/update/delete their own points
*/

CREATE TABLE IF NOT EXISTS collection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL, -- FK to profiles.user_id added in 20250329210007_raspy_snow.sql
  recycler_id uuid REFERENCES auth.users, 
  claim_id uuid, -- FK to collection_claims.id added in 20250330015301_crimson_butterfly.sql
  status TEXT DEFAULT 'available' NOT NULL, 
  address text NOT NULL,
  district text NOT NULL,
  materials text[] NOT NULL,
  schedule text NOT NULL,
  additional_info text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  pickup_time timestamptz, 
  
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND
    longitude BETWEEN -180 AND 180
  ),
  CONSTRAINT status_check CHECK (status IN ('available', 'claimed', 'completed', 'cancelled')) 
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

CREATE TRIGGER update_collection_points_updated_at
  BEFORE UPDATE ON collection_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();