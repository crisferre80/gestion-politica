/*
  # Add status field to collection points

  1. Changes
    - Add status field to collection_points table
    - Add claim_id field to track which claim is associated with the point
    - Update RLS policies to reflect the new fields

  2. Security
    - Maintain existing RLS policies
    - Add new policy for recyclers to claim points
*/

ALTER TABLE collection_points
ADD COLUMN IF NOT EXISTS status text DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed')),
ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES collection_claims(id) ON DELETE SET NULL;

-- Add index for status lookups
CREATE INDEX IF NOT EXISTS idx_collection_points_status ON collection_points(status);

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
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM collection_claims 
      WHERE collection_points.id = collection_point_id 
      AND recycler_id = auth.uid()
    )
  );