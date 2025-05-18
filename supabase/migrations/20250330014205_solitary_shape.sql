/*
  # Fix collection claims relationships

  1. Changes
    - Update foreign key constraint for collection_claims.recycler_id to reference profiles.user_id
    - Add index for recycler_id column
    - Update RLS policies to reflect the new relationship

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Drop existing foreign key if it exists
ALTER TABLE collection_claims
DROP CONSTRAINT IF EXISTS collection_claims_recycler_id_fkey;

-- Add new foreign key constraint to profiles.user_id
ALTER TABLE collection_claims
ADD CONSTRAINT collection_claims_recycler_id_fkey 
  FOREIGN KEY (recycler_id) 
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_collection_claims_recycler_id;
CREATE INDEX idx_collection_claims_recycler_id ON collection_claims(recycler_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Recyclers can view and claim collection points" ON collection_claims;
CREATE POLICY "Recyclers can view and claim collection points"
  ON collection_claims
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Recyclers can create claims" ON collection_claims;
CREATE POLICY "Recyclers can create claims"
  ON collection_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recycler_id);

DROP POLICY IF EXISTS "Recyclers can update their own claims" ON collection_claims;
CREATE POLICY "Recyclers can update their own claims"
  ON collection_claims
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recycler_id)
  WITH CHECK (auth.uid() = recycler_id);