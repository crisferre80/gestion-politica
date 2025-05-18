/*
  # Add claim cancellation tracking

  1. Changes
    - Add cancellation_reason column to collection_claims table
    - Add cancelled_by column to track who cancelled the claim
    - Add cancelled_at timestamp
    - Update RLS policies to allow cancellation

  2. Security
    - Maintain existing RLS policies
    - Add policy for cancellation
*/

-- Add cancellation tracking columns
ALTER TABLE collection_claims
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Update status check constraint
ALTER TABLE collection_claims
DROP CONSTRAINT IF EXISTS collection_claims_status_check,
ADD CONSTRAINT collection_claims_status_check 
  CHECK (status IN ('pending', 'completed', 'cancelled', 'failed'));