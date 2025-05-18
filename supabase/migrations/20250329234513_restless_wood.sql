/*
  # Fix collection claims relationship with profiles

  1. Changes
    - Drop existing foreign key from collection_claims to users
    - Add new foreign key from collection_claims to profiles
    - Update queries to use the correct relationship

  2. Security
    - Maintain existing RLS policies
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