-- Create table for recycler ratings
CREATE TABLE IF NOT EXISTS recycler_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recycler_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    collection_claim_id UUID REFERENCES collection_claims(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (resident_id, collection_claim_id),
    CONSTRAINT fk_recycler FOREIGN KEY (recycler_id) REFERENCES profiles(user_id),
    CONSTRAINT fk_resident FOREIGN KEY (resident_id) REFERENCES profiles(user_id)
);

-- Enable RLS
ALTER TABLE recycler_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Residents can insert their own ratings
CREATE POLICY "Residents can rate recyclers" ON recycler_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = resident_id);

-- Policy: Recyclers can view their own ratings
CREATE POLICY "Recyclers can view their own ratings" ON recycler_ratings
  FOR SELECT TO authenticated
  USING (recycler_id = auth.uid());

-- Policy: Residents can view their own ratings
CREATE POLICY "Residents can view their own ratings" ON recycler_ratings
  FOR SELECT TO authenticated
  USING (resident_id = auth.uid());

-- Policy: Admins can view all ratings (if you have an admin role system)
-- CREATE POLICY "Admins can view all ratings" ON recycler_ratings
--   FOR SELECT TO authenticated
--   USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recycler_ratings_recycler_id ON recycler_ratings(recycler_id);
CREATE INDEX IF NOT EXISTS idx_recycler_ratings_resident_id ON recycler_ratings(resident_id);
CREATE INDEX IF NOT EXISTS idx_recycler_ratings_collection_claim_id ON recycler_ratings(collection_claim_id);
