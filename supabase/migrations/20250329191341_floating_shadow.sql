/*
  # Add email column to profiles table

  1. Changes
    - Add `email` column to `profiles` table
    - Make email column required and unique
    - Add index on email column for faster lookups

  2. Security
    - No changes to RLS policies needed
*/

-- Add email column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email text NOT NULL;

-- Add unique constraint to email
ALTER TABLE profiles
ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles (email);