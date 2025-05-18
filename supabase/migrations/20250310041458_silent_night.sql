/*
  # Create collection points table

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
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on collection_points table
    - Add policies for:
      - Anyone can read collection points
      - Authenticated users can create their own points
      - Users can update and delete their own points
*/

CREATE TABLE IF NOT EXISTS collection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  district text NOT NULL,
  materials text[] NOT NULL,
  schedule text NOT NULL,
  additional_info text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE collection_points ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read collection points
CREATE POLICY "Anyone can read collection points"
  ON collection_points
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to create their own points
CREATE POLICY "Users can create their own points"
  ON collection_points
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own points
CREATE POLICY "Users can update their own points"
  ON collection_points
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own points
CREATE POLICY "Users can delete their own points"
  ON collection_points
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);