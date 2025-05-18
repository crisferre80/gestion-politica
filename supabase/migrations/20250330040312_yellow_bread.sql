/*
  # Add pickup time to collection claims and points

  1. Changes
    - Add pickup_time column to collection_claims table
    - Add pickup_time column to collection_points table
    - Update existing functions and triggers

  2. Security
    - Maintain existing RLS policies
*/

-- Add pickup_time to collection_claims
ALTER TABLE collection_claims
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;

-- Add pickup_time to collection_points
ALTER TABLE collection_points
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;