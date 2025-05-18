/*
  # Fix collection_points and profiles relationship

  1. Changes
    - Add foreign key constraint from collection_points.user_id to profiles.user_id
    - Update RLS policies to reflect the new relationship

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Drop existing foreign key if it exists
ALTER TABLE collection_points
DROP CONSTRAINT IF EXISTS collection_points_user_id_fkey;

-- Add new foreign key constraint to profiles.user_id
ALTER TABLE collection_points
ADD CONSTRAINT collection_points_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_collection_points_user_id;
CREATE INDEX idx_collection_points_user_id ON collection_points(user_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Anyone can read collection points" ON collection_points;
CREATE POLICY "Anyone can read collection points"
  ON collection_points
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can create their own points" ON collection_points;
CREATE POLICY "Users can create their own points"
  ON collection_points
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own points" ON collection_points;
CREATE POLICY "Users can update their own points"
  ON collection_points
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own points" ON collection_points;
CREATE POLICY "Users can delete their own points"
  ON collection_points
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);