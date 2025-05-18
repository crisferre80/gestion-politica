/*
  # Add advertisements feature

  1. New Tables
    - `advertisements`
      - `id` (uuid, primary key)
      - `title` (text)
      - `image_url` (text)
      - `link` (text)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for:
      - Anyone can view active ads
      - Only admins can manage ads
*/

-- Create advertisements table
CREATE TABLE advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  link text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for advertisements
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'advertisements',
  'advertisements',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies for advertisements table
CREATE POLICY "Anyone can view active advertisements"
  ON advertisements
  FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can manage advertisements"
  ON advertisements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies for advertisements storage
CREATE POLICY "Advertisement images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'advertisements');

CREATE POLICY "Admins can upload advertisement images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'advertisements'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update advertisement images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'advertisements'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'advertisements'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete advertisement images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'advertisements'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);