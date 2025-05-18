-- Add pickup_time to collection_claims
ALTER TABLE collection_claims
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;

-- Add pickup_time to collection_points
ALTER TABLE collection_points
ADD COLUMN IF NOT EXISTS pickup_time timestamptz;