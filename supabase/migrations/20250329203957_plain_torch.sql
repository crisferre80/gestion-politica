/*
  # Add recycler features and rating system

  1. New Tables
    - `recycler_profiles`
      - Additional recycler-specific information
      - Materials they collect
      - Service areas
      - Rating average
    
    - `collection_claims`
      - Links recyclers to collection points
      - Tracks claim status
      - Includes completion timestamps
    
    - `recycler_ratings`
      - Stores ratings given by residents
      - Includes comments and timestamps

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Recycler profiles table
CREATE TABLE recycler_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materials text[] NOT NULL,
  service_areas text[] NOT NULL,
  bio text,
  experience_years integer,
  rating_average decimal(3,2) DEFAULT 0,
  total_ratings integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT recycler_profiles_user_id_key UNIQUE (user_id)
);

-- Collection claims table
CREATE TABLE collection_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_point_id uuid REFERENCES collection_points(id) ON DELETE CASCADE NOT NULL,
  recycler_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT collection_claims_status_check CHECK (status IN ('pending', 'completed', 'cancelled', 'failed'))
);

-- Recycler ratings table
CREATE TABLE recycler_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recycler_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resident_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collection_claim_id uuid REFERENCES collection_claims(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recycler_ratings_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT recycler_ratings_unique_claim UNIQUE (collection_claim_id)
);

-- Enable RLS
ALTER TABLE recycler_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycler_ratings ENABLE ROW LEVEL SECURITY;

-- Recycler profiles policies
CREATE POLICY "Anyone can view recycler profiles"
  ON recycler_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Recyclers can manage their own profile"
  ON recycler_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Collection claims policies
CREATE POLICY "Recyclers can view and claim collection points"
  ON collection_claims
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Recyclers can create claims"
  ON collection_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = recycler_id);

CREATE POLICY "Recyclers can update their own claims"
  ON collection_claims
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recycler_id)
  WITH CHECK (auth.uid() = recycler_id);

-- Recycler ratings policies
CREATE POLICY "Anyone can view ratings"
  ON recycler_ratings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Residents can create ratings"
  ON recycler_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_claims c
      WHERE c.id = collection_claim_id
      AND c.status = 'completed'
      AND auth.uid() IN (
        SELECT user_id FROM collection_points
        WHERE id = c.collection_point_id
      )
    )
  );

-- Triggers for updating ratings average
CREATE OR REPLACE FUNCTION update_recycler_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recycler_profiles
  SET 
    rating_average = (
      SELECT COALESCE(AVG(rating)::numeric(3,2), 0)
      FROM recycler_ratings
      WHERE recycler_id = NEW.recycler_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM recycler_ratings
      WHERE recycler_id = NEW.recycler_id
    ),
    updated_at = now()
  WHERE user_id = NEW.recycler_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recycler_rating_on_insert
  AFTER INSERT ON recycler_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_recycler_rating();

CREATE TRIGGER update_recycler_rating_on_update
  AFTER UPDATE ON recycler_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_recycler_rating();

-- Add indexes
CREATE INDEX idx_collection_claims_recycler_id ON collection_claims(recycler_id);
CREATE INDEX idx_collection_claims_collection_point_id ON collection_claims(collection_point_id);
CREATE INDEX idx_recycler_ratings_recycler_id ON recycler_ratings(recycler_id);
CREATE INDEX idx_recycler_ratings_resident_id ON recycler_ratings(resident_id);