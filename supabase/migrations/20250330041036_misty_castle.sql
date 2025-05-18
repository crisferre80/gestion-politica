/*
  # Add pickup time tracking

  1. Changes
    - Add pickup_time column to collection_claims table
    - Add pickup_time column to collection_points table
    - Both columns use timestamptz type for timezone support

  2. Security
    - No changes to RLS policies needed
*/

-- Add pickup_time to collection_claims
ALTER TABLE collection_claims
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;

-- Add pickup_time to collection_points
ALTER TABLE collection_points
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;