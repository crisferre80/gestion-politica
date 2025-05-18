/*
  # Fix recycler_profiles and profiles relationship

  1. Changes
    - Add foreign key constraint between recycler_profiles and profiles
    - Update queries to use proper join syntax

  2. Security
    - Maintain existing RLS policies
*/

-- Add foreign key constraint to link recycler_profiles with profiles
ALTER TABLE recycler_profiles
DROP CONSTRAINT IF EXISTS recycler_profiles_user_id_fkey,
ADD CONSTRAINT recycler_profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_recycler_profiles_user_id;
CREATE INDEX idx_recycler_profiles_user_id ON recycler_profiles(user_id);

-- Update RLS policies to use the new relationship
DROP POLICY IF EXISTS "Anyone can view recycler profiles" ON recycler_profiles;
CREATE POLICY "Anyone can view recycler profiles"
  ON recycler_profiles
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Recyclers can manage their own profile" ON recycler_profiles;
CREATE POLICY "Recyclers can manage their own profile"
  ON recycler_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);